import {
  AppDatabase,
  BookingRequest,
  EquipmentItem,
  FairnessConfig,
  PhysicalUnit,
  PriorityBreakdown,
} from '../types/lablink';
import { safetyService } from './safetyService';

export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export const schedulingService = {
  computePriorityBreakdown(
    db: AppDatabase,
    params: {
      userId: string;
      equipmentId: string;
      projectId: string | null;
      startHour: number;
      endHour: number;
      urgencyLevel: BookingRequest['urgencyLevel'];
      projectDependencyLevel: BookingRequest['projectDependencyLevel'];
      createdAt?: string;
    },
    weightsOverride?: FairnessConfig['schedulingWeights']
  ): PriorityBreakdown {
    const weights = weightsOverride ?? db.fairnessConfig.schedulingWeights;
    const user = db.users.find((u) => u.id === params.userId);
    const equipment = db.equipment.find((e) => e.id === params.equipmentId);
    const project = db.projects.find((p) => p.id === params.projectId);

    // 1. Deadline urgency (0-100)
    let deadlineUrgency = params.urgencyLevel === 'critical' ? 95 : params.urgencyLevel === 'high' ? 80 : 60;
    if (project) {
      const daysUntil = Math.max(
        1,
        Math.ceil((new Date(project.deadline).getTime() - new Date('2026-11-23').getTime()) / 86400000)
      );
      const deadlineScore = Math.max(40, Math.min(100, 105 - daysUntil * 2));
      deadlineUrgency = Math.round((deadlineUrgency + deadlineScore) / 2);
    }

    // 2. Project dependency (0-100)
    const projectDependency =
      params.projectDependencyLevel === 'blocking'
        ? 94
        : params.projectDependencyLevel === 'supporting'
          ? 74
          : 48;

    // 3. Duration feasibility (0-100)
    const duration = Math.max(1, params.endHour - params.startHour);
    const maxHours = equipment?.maxBookingHours ?? 6;
    const durationFeasibility =
      duration <= maxHours ? Math.max(65, Math.round(100 - (duration / maxHours) * 20)) : 35;

    // 4. Previous allocation fairness (0-100): higher recent usage gently lowers score without permanently penalising
    const recentHours = user?.previousUsageHours ?? 0;
    const fairnessScore = Math.max(40, Math.round(92 - Math.min(50, recentHours * 1.15)));

    // 5. Submission time score (0-100): earlier submission gets slight edge
    const ageHours = params.createdAt
      ? Math.max(0, (Date.now() - new Date(params.createdAt).getTime()) / 3600000)
      : 0;
    const submissionTimeScore = Math.min(95, Math.round(62 + ageHours * 0.7));

    const totalScore = Math.round(
      (deadlineUrgency * weights.deadlineUrgency +
        projectDependency * weights.projectDependency +
        durationFeasibility * weights.durationFeasibility +
        fairnessScore * weights.previousFairness +
        submissionTimeScore * weights.submissionTime) /
        100
    );

    const explanation = `Weighted ${totalScore}/100 (${weights.deadlineUrgency}% urgency, ${weights.projectDependency}% dependency, ${weights.durationFeasibility}% duration, ${weights.previousFairness}% prior-usage fairness [${recentHours}h], ${weights.submissionTime}% queue time).`;

    return {
      totalScore,
      deadlineUrgency,
      projectDependency,
      durationFeasibility,
      fairnessScore,
      submissionTimeScore,
      explanation,
    };
  },

  isUnitBookableForSlot(
    db: AppDatabase,
    unit: PhysicalUnit,
    date: string,
    startHour: number,
    endHour: number,
    ignoreBookingId?: string
  ): { ok: boolean; reason?: string } {
    if (unit.status === 'maintenance' || unit.status === 'faulty') {
      return { ok: false, reason: `Unit ${unit.unitCode} is locked out (${unit.status}).` };
    }

    const activeMaint = db.maintenanceRecords.some(
      (m) => m.unitId === unit.id && m.blocksBooking && m.status !== 'resolved'
    );
    if (activeMaint) {
      return { ok: false, reason: `Unit ${unit.unitCode} has an active blocking maintenance ticket.` };
    }

    const conflictingAlloc = db.confirmedAllocations.find(
      (a) =>
        a.unitId === unit.id &&
        a.date === date &&
        a.bookingId !== ignoreBookingId &&
        intervalsOverlap(startHour, endHour, a.startHour, a.endHour)
    );

    if (conflictingAlloc) {
      return {
        ok: false,
        reason: `Unit ${unit.unitCode} already allocated ${conflictingAlloc.startHour}:00–${conflictingAlloc.endHour}:00 on ${date}.`,
      };
    }

    return { ok: true };
  },

  validateBookingConstraints(
    db: AppDatabase,
    params: {
      userId: string;
      equipment: EquipmentItem;
      date: string;
      startHour: number;
      endHour: number;
      crossDeptApproved?: boolean;
    }
  ): { ok: boolean; reason?: string } {
    const lab = db.laboratories.find((l) => l.id === params.equipment.laboratoryId);
    if (!lab) {
      return { ok: false, reason: 'Laboratory not found.' };
    }

    if (params.startHour >= params.endHour) {
      return { ok: false, reason: 'End hour must be later than start hour.' };
    }

    const duration = params.endHour - params.startHour;
    if (duration > params.equipment.maxBookingHours) {
      return {
        ok: false,
        reason: `Requested duration (${duration}h) exceeds maximum session limit (${params.equipment.maxBookingHours}h) for ${params.equipment.name}.`,
      };
    }

    if (
      params.startHour < lab.operatingHours.openHour ||
      params.endHour > lab.operatingHours.closeHour
    ) {
      return {
        ok: false,
        reason: `Requested hours (${params.startHour}:00–${params.endHour}:00) fall outside ${lab.code} operating hours (${lab.operatingHours.openHour}:00–${lab.operatingHours.closeHour}:00).`,
      };
    }

    // Check day of week
    const dayIdx = new Date(`${params.date}T12:00:00`).getDay();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayLabel = dayNames[dayIdx];
    if (!lab.operatingHours.days.includes(dayLabel)) {
      return {
        ok: false,
        reason: `${lab.code} is closed on ${dayLabel} (${params.date}). Open days: ${lab.operatingHours.days.join(', ')}.`,
      };
    }

    // Check safety readiness
    const readiness = safetyService.evaluateUserReadiness(db, params.userId, params.equipment, lab);
    if (!readiness.eligible) {
      const details = [
        ...readiness.expiredCertifications.map((c) => `Expired: ${c}`),
        ...readiness.missingCertifications.map((c) => `Missing: ${c}`),
        ...readiness.pendingVerification.map((c) => `Awaiting admin sign-off: ${c}`),
      ].join('; ');
      return {
        ok: false,
        reason: `Safety readiness gate blocked booking (${details}). Complete training in Lab Passport / Safety Readiness.`,
      };
    }

    // Cross-department restriction check
    const user = db.users.find((u) => u.id === params.userId);
    if (
      user &&
      user.role === 'student' &&
      params.equipment.requiresCrossDeptApproval &&
      user.departmentId !== params.equipment.departmentId &&
      !params.crossDeptApproved
    ) {
      return {
        ok: false,
        reason: `Cross-department access approval is required to book ${params.equipment.name} from another department. Submit via Cross-Department Sharing.`,
      };
    }

    return { ok: true };
  },

  findAvailableUnitForSlot(
    db: AppDatabase,
    equipmentId: string,
    date: string,
    startHour: number,
    endHour: number,
    preferredUnitId?: string | null
  ): PhysicalUnit | null {
    const units = db.physicalUnits.filter((u) => u.equipmentId === equipmentId);
    if (preferredUnitId) {
      const preferred = units.find((u) => u.id === preferredUnitId);
      if (preferred && this.isUnitBookableForSlot(db, preferred, date, startHour, endHour).ok) {
        return preferred;
      }
    }
    for (const u of units) {
      if (this.isUnitBookableForSlot(db, u, date, startHour, endHour).ok) {
        return u;
      }
    }
    return null;
  },
};
