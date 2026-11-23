import { ActionResult, AppDatabase, FairnessConfig } from '../types/lablink';
import { appendAuditLog, getCurrentUser, requireSystemAdmin } from './permissionService';
import { schedulingService } from './schedulingService';

export interface PredictiveDaySlot {
  date: string;
  confirmedBookedUnits: number;
  healthyTotalUnits: number;
  maintenanceLockedUnits: number;
  predictedOpenRatio: number; // 0-100
  demandLevel: 'Low' | 'Moderate' | 'High';
  suggestedWindow: string;
  distinctionNote: string;
}

export interface IdleEquipmentInsight {
  equipmentId: string;
  equipmentName: string;
  departmentCode: string;
  labCode: string;
  measuredHoursPerUnit: number;
  bookingEstimatedWeeklyHours: number;
  utilisationPct: number;
  trend: 'Declining' | 'Steady' | 'Underutilised';
  shareableCandidate: boolean;
  availabilityCaveat: string;
}

export interface LabHeatmapCell {
  hour: number;
  confirmedBookings: number;
  maintenanceLocks: number;
  isOpen: boolean;
  occupancyPct: number;
  dataBasis: 'confirmed' | 'baseline_estimate' | 'closed' | 'locked';
}

export interface LabPulseMetric {
  laboratoryId: string;
  code: string;
  name: string;
  buildingName: string;
  departmentCode: string;
  departmentColorHex: string;
  safetyTier: 'standard' | 'supervised' | 'restricted';
  openHour: number;
  closeHour: number;
  isOpenOnDate: boolean;
  totalUnits: number;
  availableUnits: number;
  bookedOrInUseUnits: number;
  checkedOutUnits: number;
  maintenanceLockedUnits: number;
  confirmedBookingsOnDate: number;
  confirmedBookedHoursOnDate: number;
  confirmedUtilisationPct: number;
  baselineDemandHoursPerWeek: number;
  activeMaintenanceTickets: number;
  capacitySeats: number;
  hourlyHeatmap: LabHeatmapCell[];
}

export interface DepartmentPulseSummary {
  departmentId: string;
  code: string;
  name: string;
  colorHex: string;
  equipmentModels: number;
  totalUnits: number;
  openUnits: number;
  lockedUnits: number;
  confirmedHoursOnDate: number;
  weeklyBaselineHours: number;
  utilisationPct: number;
}

export interface LiveLabPulseReport {
  date: string;
  dayLabel: string;
  totalLabs: number;
  openLabsCount: number;
  totalUnits: number;
  availableUnits: number;
  inUseOrBookedUnits: number;
  maintenanceLockedUnits: number;
  confirmedBookingsOnDate: number;
  activeMaintenanceTickets: number;
  labs: LabPulseMetric[];
  departments: DepartmentPulseSummary[];
}

export interface AchievementBadge {
  id: string;
  title: string;
  category: 'Bookings' | 'Safety' | 'Mastery' | 'Collaboration' | 'Projects' | 'Stewardship';
  description: string;
  criteria: string;
  current: number;
  target: number;
  progressPct: number;
  unlocked: boolean;
  evidenceSummary: string;
  unlockedAt?: string;
  targetView: 'smart-scheduling' | 'safety-readiness' | 'equipment-explorer' | 'cross-dept-sharing' | 'project-matcher' | 'equipment-tracking';
}

export interface UserAchievementReport {
  userId: string;
  unlockedCount: number;
  totalCount: number;
  completionPct: number;
  badges: AchievementBadge[];
}

export const analyticsService = {
  getPredictiveAvailability(
    db: AppDatabase,
    equipmentId: string,
    days = 7
  ): PredictiveDaySlot[] {
    const eq = db.equipment.find((e) => e.id === equipmentId);
    if (!eq) return [];

    const units = db.physicalUnits.filter((u) => u.equipmentId === equipmentId);
    const maintenanceLockedUnits = units.filter((u) => {
      if (u.status === 'maintenance' || u.status === 'faulty') return true;
      return db.maintenanceRecords.some(
        (m) => m.unitId === u.id && m.blocksBooking && m.status !== 'resolved'
      );
    }).length;
    const healthyTotalUnits = Math.max(0, units.length - maintenanceLockedUnits);

    const lab = db.laboratories.find((l) => l.id === eq.laboratoryId);
    const baseDate = new Date('2026-11-23T12:00:00');
    const results: PredictiveDaySlot[] = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(baseDate.getTime() + i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayLabel = dayNames[d.getDay()];
      const labOpen = lab ? lab.operatingHours.days.includes(dayLabel) : true;

      const dayAllocs = db.confirmedAllocations.filter(
        (a) => a.equipmentId === equipmentId && a.date === iso
      );
      const bookedUnitIds = new Set(dayAllocs.map((a) => a.unitId));
      const confirmedBookedUnits = bookedUnitIds.size;

      // Also inspect pending requests & waiting list pressure for demand estimation
      const pendingDemand = db.bookingRequests.filter(
        (b) => b.equipmentId === equipmentId && b.date === iso && b.status === 'pending'
      ).length;
      const waitPressure = db.waitingList.filter(
        (w) => w.equipmentId === equipmentId && w.desiredDate === iso && w.status === 'waiting'
      ).length;

      const totalBookedHours = dayAllocs.reduce((acc, a) => acc + (a.endHour - a.startHour), 0);
      const openCapacityHours = healthyTotalUnits * 10; // ~10h active lab day
      const historicalLoadFactor = eq.hourlyDemandBaseline / Math.max(1, units.length * 40);

      let predictedOpenRatio = 0;
      if (labOpen && healthyTotalUnits > 0) {
        const confirmedOccupiedRatio = totalBookedHours / Math.max(1, openCapacityHours);
        const estimatedRatio = Math.min(
          0.95,
          confirmedOccupiedRatio + historicalLoadFactor * 0.35 + (pendingDemand + waitPressure) * 0.08
        );
        predictedOpenRatio = Math.max(5, Math.round((1 - estimatedRatio) * 100));
      }

      const demandLevel: PredictiveDaySlot['demandLevel'] =
        !labOpen || healthyTotalUnits === 0
          ? 'High'
          : predictedOpenRatio >= 65
            ? 'Low'
            : predictedOpenRatio >= 38
              ? 'Moderate'
              : 'High';

      const suggestedWindow = !labOpen
        ? 'Laboratory Closed'
        : healthyTotalUnits === 0
          ? 'Unavailable (Maintenance Lock)'
          : confirmedBookedUnits < healthyTotalUnits
            ? `${lab?.operatingHours.openHour ?? 9}:00–12:00 (Open Unit Predicted)`
            : '15:00–18:00 (Post-Return Window)';

      results.push({
        date: iso,
        confirmedBookedUnits,
        healthyTotalUnits,
        maintenanceLockedUnits,
        predictedOpenRatio,
        demandLevel,
        suggestedWindow,
        distinctionNote:
          confirmedBookedUnits > 0
            ? `${confirmedBookedUnits} unit(s) confirmed booked; forecast reflects ${eq.hourlyDemandBaseline}h/wk baseline + ${waitPressure} waiting.`
            : `No confirmed bookings yet; forecast based on ${eq.hourlyDemandBaseline}h/wk historical usage.`,
      });
    }

    return results;
  },

  getIdleResourceInsights(db: AppDatabase): IdleEquipmentInsight[] {
    return db.equipment
      .map((eq) => {
        const units = db.physicalUnits.filter((u) => u.equipmentId === eq.id);
        const dept = db.departments.find((d) => d.id === eq.departmentId);
        const lab = db.laboratories.find((l) => l.id === eq.laboratoryId);

        const avgMeasuredHours =
          units.length > 0
            ? Math.round(
                units.reduce((sum, u) => sum + u.measuredUsageHours, 0) / units.length
              )
            : 0;

        // Booking-based estimate from current confirmed + pending hours
        const bookingHours = db.bookingRequests
          .filter((b) => b.equipmentId === eq.id && b.status !== 'cancelled' && b.status !== 'rejected')
          .reduce((sum, b) => sum + (b.endHour - b.startHour), 0);

        // Weekly capacity ~45h per unit
        const weeklyCapacity = Math.max(1, units.length * 45);
        const utilisationPct = Math.min(
          100,
          Math.round(((eq.hourlyDemandBaseline + bookingHours) / weeklyCapacity) * 100)
        );

        const healthyOpenUnits = units.filter((u) => u.status === 'available').length;
        const lockedUnits = units.filter(
          (u) => u.status === 'maintenance' || u.status === 'faulty'
        ).length;

        const trend: IdleEquipmentInsight['trend'] =
          utilisationPct < 35 ? 'Underutilised' : utilisationPct < 58 ? 'Declining' : 'Steady';

        const shareableCandidate = utilisationPct < 45 && healthyOpenUnits > 0;

        const availabilityCaveat =
          lockedUnits > 0
            ? `${lockedUnits} unit(s) locked in maintenance — idle capacity never bypasses safety or repair checks.`
            : eq.requiresCrossDeptApproval
              ? 'Requires host department approval and valid safety certification before cross-dept booking.'
              : 'Requires valid lab passport certification and open operating hours.';

        return {
          equipmentId: eq.id,
          equipmentName: eq.name,
          departmentCode: dept?.code ?? 'N/A',
          labCode: lab?.code ?? 'N/A',
          measuredHoursPerUnit: avgMeasuredHours,
          bookingEstimatedWeeklyHours: eq.hourlyDemandBaseline + bookingHours,
          utilisationPct,
          trend,
          shareableCandidate,
          availabilityCaveat,
        };
      })
      .sort((a, b) => a.utilisationPct - b.utilisationPct);
  },

  getDepartmentParticipationMetrics(db: AppDatabase) {
    return db.departments.map((dept) => {
      const requests = db.bookingRequests.filter((b) => {
        const u = db.users.find((usr) => usr.id === b.userId);
        return u?.departmentId === dept.id;
      });
      const approved = requests.filter((r) => r.status === 'approved' || r.status === 'completed');
      const crossDeptSharedIn = db.sharingRequests.filter(
        (s) => s.requesterDeptId === dept.id && (s.status === 'approved' || s.status === 'scheduled')
      ).length;
      const totalAllocatedHours = approved.reduce((sum, b) => sum + (b.endHour - b.startHour), 0);

      return {
        departmentId: dept.id,
        code: dept.code,
        name: dept.name,
        colorHex: dept.colorHex,
        totalRequests: requests.length,
        approvedRequests: approved.length,
        approvalRatePct:
          requests.length > 0 ? Math.round((approved.length / requests.length) * 100) : 100,
        allocatedHours: totalAllocatedHours,
        crossDeptSharedIn,
      };
    });
  },

  simulateFairnessWeights(
    db: AppDatabase,
    candidateWeights: FairnessConfig['schedulingWeights']
  ) {
    return db.bookingRequests
      .filter((b) => b.status === 'pending' || b.status === 'approved')
      .map((b) => {
        const currentScore = b.priority.totalScore;
        const simulated = schedulingService.computePriorityBreakdown(
          db,
          {
            userId: b.userId,
            equipmentId: b.equipmentId,
            projectId: b.projectId,
            startHour: b.startHour,
            endHour: b.endHour,
            urgencyLevel: b.urgencyLevel,
            projectDependencyLevel: b.projectDependencyLevel,
            createdAt: b.createdAt,
          },
          candidateWeights
        );
        return {
          bookingId: b.id,
          userId: b.userId,
          equipmentId: b.equipmentId,
          status: b.status,
          currentScore,
          simulatedScore: simulated.totalScore,
          delta: simulated.totalScore - currentScore,
        };
      })
      .sort((a, b) => b.simulatedScore - a.simulatedScore);
  },

  updateFairnessWeights(
    db: AppDatabase,
    weights: FairnessConfig['schedulingWeights']
  ): { nextDb: AppDatabase; result: ActionResult } {
    const actor = getCurrentUser(db);
    const perm = requireSystemAdmin(actor, 'update global fairness allocation weights');
    if (!perm.allowed) {
      return { nextDb: db, result: { ok: false, message: perm.reason! } };
    }

    const total =
      weights.deadlineUrgency +
      weights.projectDependency +
      weights.durationFeasibility +
      weights.previousFairness +
      weights.submissionTime;

    if (total !== 100) {
      return {
        nextDb: db,
        result: { ok: false, message: `Fairness weights must total exactly 100% (currently ${total}%).` },
      };
    }

    const nextConfig: FairnessConfig = {
      ...db.fairnessConfig,
      schedulingWeights: weights,
    };

    const nextBookings = db.bookingRequests.map((b) => {
      if (b.status !== 'pending') return b;
      const updatedPriority = schedulingService.computePriorityBreakdown(
        db,
        {
          userId: b.userId,
          equipmentId: b.equipmentId,
          projectId: b.projectId,
          startHour: b.startHour,
          endHour: b.endHour,
          urgencyLevel: b.urgencyLevel,
          projectDependencyLevel: b.projectDependencyLevel,
          createdAt: b.createdAt,
        },
        weights
      );
      return { ...b, priority: updatedPriority };
    });

    const nextDb: AppDatabase = {
      ...db,
      fairnessConfig: nextConfig,
      bookingRequests: nextBookings,
      auditLogs: appendAuditLog(
        db,
        actor,
        'FAIRNESS_WEIGHTS_UPDATED',
        'fairnessConfig',
        `Updated scheduling weights to ${weights.deadlineUrgency}/${weights.projectDependency}/${weights.durationFeasibility}/${weights.previousFairness}/${weights.submissionTime}.`
      ),
    };

    return {
      nextDb,
      result: { ok: true, message: 'Fairness allocation weights saved and active across scheduler.' },
    };
  },

  getLiveLabPulse(db: AppDatabase, selectedDate = '2026-11-23'): LiveLabPulseReport {
    const dayIdx = new Date(`${selectedDate}T12:00:00`).getDay();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayLabel = dayNames[dayIdx] ?? 'Mon';
    const heatmapHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

    const labs: LabPulseMetric[] = db.laboratories.map((lab) => {
      const building = db.buildings.find((b) => b.id === lab.buildingId);
      const dept = db.departments.find((d) => d.id === lab.departmentId);
      const labEq = db.equipment.filter((e) => e.laboratoryId === lab.id);
      const labUnits = db.physicalUnits.filter((u) => u.laboratoryId === lab.id);

      const maintenanceLockedUnits = labUnits.filter((u) => {
        if (u.status === 'maintenance' || u.status === 'faulty') return true;
        return db.maintenanceRecords.some(
          (m) => m.unitId === u.id && m.blocksBooking && m.status !== 'resolved'
        );
      }).length;

      const availableUnits = labUnits.filter((u) => u.status === 'available').length;
      const checkedOutUnits = labUnits.filter((u) => u.status === 'checked_out').length;
      const bookedOrInUseUnits = labUnits.filter(
        (u) => u.status === 'booked' || u.status === 'checked_out'
      ).length;

      const activeMaintenanceTickets = db.maintenanceRecords.filter((m) => {
        const u = labUnits.find((unit) => unit.id === m.unitId);
        return Boolean(u) && m.status !== 'resolved';
      }).length;

      const labAllocations = db.confirmedAllocations.filter(
        (a) => a.laboratoryId === lab.id && a.date === selectedDate
      );
      const confirmedBookingsOnDate = db.bookingRequests.filter(
        (b) =>
          b.laboratoryId === lab.id &&
          b.date === selectedDate &&
          (b.status === 'approved' || b.status === 'completed')
      ).length;
      const confirmedBookedHoursOnDate = labAllocations.reduce(
        (sum, a) => sum + (a.endHour - a.startHour),
        0
      );

      const healthyUnits = Math.max(1, labUnits.length - maintenanceLockedUnits);
      const operatingSpan = Math.max(1, lab.operatingHours.closeHour - lab.operatingHours.openHour);
      const isOpenOnDate = lab.operatingHours.days.includes(dayLabel);

      const confirmedUtilisationPct = isOpenOnDate
        ? Math.min(
            100,
            Math.round((confirmedBookedHoursOnDate / (healthyUnits * operatingSpan)) * 100)
          )
        : 0;

      const baselineDemandHoursPerWeek = labEq.reduce((s, e) => s + e.hourlyDemandBaseline, 0);

      const hourlyHeatmap: LabHeatmapCell[] = heatmapHours.map((hour) => {
        const isOpen =
          isOpenOnDate &&
          hour >= lab.operatingHours.openHour &&
          hour < lab.operatingHours.closeHour;
        if (!isOpen) {
          return {
            hour,
            confirmedBookings: 0,
            maintenanceLocks: maintenanceLockedUnits,
            isOpen: false,
            occupancyPct: 0,
            dataBasis: 'closed',
          };
        }

        const confirmedAtHour = labAllocations.filter(
          (a) => hour >= a.startHour && hour < a.endHour
        ).length;
        const unitDenom = Math.max(1, labUnits.length);

        if (confirmedAtHour > 0) {
          return {
            hour,
            confirmedBookings: confirmedAtHour,
            maintenanceLocks: maintenanceLockedUnits,
            isOpen: true,
            occupancyPct: Math.min(
              100,
              Math.round(((confirmedAtHour + maintenanceLockedUnits * 0.5) / unitDenom) * 100)
            ),
            dataBasis: 'confirmed',
          };
        }

        if (maintenanceLockedUnits === labUnits.length && labUnits.length > 0) {
          return {
            hour,
            confirmedBookings: 0,
            maintenanceLocks: maintenanceLockedUnits,
            isOpen: true,
            occupancyPct: 100,
            dataBasis: 'locked',
          };
        }

        // Baseline historical shape when no confirmed booking is present (clearly labeled baseline_estimate)
        const peakWeight = hour >= 10 && hour <= 16 ? 1.15 : 0.65;
        const baselineShare =
          (baselineDemandHoursPerWeek / Math.max(1, labUnits.length * 40)) * peakWeight * 55;
        return {
          hour,
          confirmedBookings: 0,
          maintenanceLocks: maintenanceLockedUnits,
          isOpen: true,
          occupancyPct: Math.min(48, Math.max(6, Math.round(baselineShare))),
          dataBasis: 'baseline_estimate',
        };
      });

      return {
        laboratoryId: lab.id,
        code: lab.code,
        name: lab.name,
        buildingName: building?.name ?? 'Campus Hall',
        departmentCode: dept?.code ?? 'N/A',
        departmentColorHex: dept?.colorHex ?? '#3978E8',
        safetyTier: lab.safetyTier,
        openHour: lab.operatingHours.openHour,
        closeHour: lab.operatingHours.closeHour,
        isOpenOnDate,
        totalUnits: labUnits.length,
        availableUnits,
        bookedOrInUseUnits,
        checkedOutUnits,
        maintenanceLockedUnits,
        confirmedBookingsOnDate,
        confirmedBookedHoursOnDate,
        confirmedUtilisationPct,
        baselineDemandHoursPerWeek,
        activeMaintenanceTickets,
        capacitySeats: lab.capacity,
        hourlyHeatmap,
      };
    });

    const departments: DepartmentPulseSummary[] = db.departments.map((dept) => {
      const eqs = db.equipment.filter((e) => e.departmentId === dept.id);
      const eqIds = new Set(eqs.map((e) => e.id));
      const units = db.physicalUnits.filter((u) => eqIds.has(u.equipmentId));
      const openUnits = units.filter((u) => u.status === 'available').length;
      const lockedUnits = units.filter(
        (u) => u.status === 'maintenance' || u.status === 'faulty'
      ).length;
      const confirmedHoursOnDate = db.confirmedAllocations
        .filter((a) => eqIds.has(a.equipmentId) && a.date === selectedDate)
        .reduce((s, a) => s + (a.endHour - a.startHour), 0);
      const weeklyBaselineHours = eqs.reduce((s, e) => s + e.hourlyDemandBaseline, 0);
      const utilisationPct = Math.min(
        100,
        Math.round(
          ((weeklyBaselineHours + confirmedHoursOnDate * 3) / Math.max(1, units.length * 45)) * 100
        )
      );

      return {
        departmentId: dept.id,
        code: dept.code,
        name: dept.name,
        colorHex: dept.colorHex,
        equipmentModels: eqs.length,
        totalUnits: units.length,
        openUnits,
        lockedUnits,
        confirmedHoursOnDate,
        weeklyBaselineHours,
        utilisationPct,
      };
    });

    return {
      date: selectedDate,
      dayLabel,
      totalLabs: labs.length,
      openLabsCount: labs.filter((l) => l.isOpenOnDate).length,
      totalUnits: db.physicalUnits.length,
      availableUnits: db.physicalUnits.filter((u) => u.status === 'available').length,
      inUseOrBookedUnits: db.physicalUnits.filter(
        (u) => u.status === 'booked' || u.status === 'checked_out'
      ).length,
      maintenanceLockedUnits: labs.reduce((s, l) => s + l.maintenanceLockedUnits, 0),
      confirmedBookingsOnDate: labs.reduce((s, l) => s + l.confirmedBookingsOnDate, 0),
      activeMaintenanceTickets: db.maintenanceRecords.filter((m) => m.status !== 'resolved').length,
      labs,
      departments,
    };
  },

  getUserAchievements(db: AppDatabase, userId: string): UserAchievementReport {
    const userBookings = db.bookingRequests.filter(
      (b) => b.userId === userId && b.status !== 'cancelled' && b.status !== 'rejected'
    );
    const verifiedCerts = db.trainingRecords.filter(
      (r) => r.userId === userId && r.status === 'verified'
    );
    const distinctEqBooked = new Set(userBookings.map((b) => b.equipmentId));
    const userQrEvents = db.qrTrackingHistory.filter((e) => e.userId === userId);
    for (const ev of userQrEvents) {
      distinctEqBooked.add(ev.equipmentId);
    }
    const userShares = db.sharingRequests.filter((s) => s.requesterId === userId);
    const approvedCrossDeptBookings = userBookings.filter((b) => {
      const user = db.users.find((u) => u.id === userId);
      return Boolean(user && b.departmentId !== user.departmentId);
    });
    const userProjects = db.projects.filter((p) => p.ownerId === userId);
    const cleanReturns = userQrEvents.filter((e) => e.action === 'returned');

    const badges: AchievementBadge[] = [
      {
        id: 'ach-first-booking',
        title: 'First Lab Booking',
        category: 'Bookings',
        description: 'Reserved and scheduled a serialized laboratory instrument through LabLink.',
        criteria: 'Record at least 1 active or completed booking request.',
        current: Math.min(1, userBookings.length),
        target: 1,
        progressPct: userBookings.length >= 1 ? 100 : 0,
        unlocked: userBookings.length >= 1,
        evidenceSummary:
          userBookings.length >= 1
            ? `${userBookings.length} recorded booking(s) on file.`
            : 'No non-cancelled booking requests recorded yet.',
        unlockedAt: userBookings[0]?.createdAt,
        targetView: 'smart-scheduling',
      },
      {
        id: 'ach-safety-ready',
        title: 'Safety Ready',
        category: 'Safety',
        description: 'Passed training assessment and received verified Lab Passport clearance.',
        criteria: 'Hold at least 1 admin-verified safety certification.',
        current: Math.min(1, verifiedCerts.length),
        target: 1,
        progressPct: verifiedCerts.length >= 1 ? 100 : 0,
        unlocked: verifiedCerts.length >= 1,
        evidenceSummary:
          verifiedCerts.length >= 1
            ? `${verifiedCerts.length} verified safety certification(s).`
            : 'Complete a training quiz and obtain verification in Lab Passport.',
        unlockedAt: verifiedCerts[0]?.completedAt,
        targetView: 'safety-readiness',
      },
      {
        id: 'ach-equipment-expert',
        title: 'Equipment Expert',
        category: 'Mastery',
        description: 'Operated or reserved instruments across at least 3 distinct hardware platforms.',
        criteria: 'Record bookings or QR check-ins across 3 unique equipment models.',
        current: Math.min(3, distinctEqBooked.size),
        target: 3,
        progressPct: Math.min(100, Math.round((distinctEqBooked.size / 3) * 100)),
        unlocked: distinctEqBooked.size >= 3,
        evidenceSummary: `${distinctEqBooked.size}/3 distinct equipment models recorded.`,
        unlockedAt: distinctEqBooked.size >= 3 ? userBookings[0]?.createdAt : undefined,
        targetView: 'equipment-explorer',
      },
      {
        id: 'ach-resource-sharer',
        title: 'Resource Sharer',
        category: 'Collaboration',
        description: 'Collaborated across department boundaries using shared campus instruments.',
        criteria: 'Submit or complete at least 1 cross-department sharing request.',
        current: Math.min(1, userShares.length + approvedCrossDeptBookings.length),
        target: 1,
        progressPct: userShares.length + approvedCrossDeptBookings.length >= 1 ? 100 : 0,
        unlocked: userShares.length + approvedCrossDeptBookings.length >= 1,
        evidenceSummary:
          userShares.length > 0
            ? `${userShares.length} cross-department request(s) submitted.`
            : 'Submit a cross-department access request to unlock.',
        unlockedAt: userShares[0]?.createdAt ?? approvedCrossDeptBookings[0]?.createdAt,
        targetView: 'cross-dept-sharing',
      },
      {
        id: 'ach-project-builder',
        title: 'Project Builder',
        category: 'Projects',
        description: 'Mapped project scope, feasibility dependencies, and hardware plans in LabLink.',
        criteria: 'Save at least 1 Student Project plan with matched equipment.',
        current: Math.min(1, userProjects.length),
        target: 1,
        progressPct: userProjects.length >= 1 ? 100 : 0,
        unlocked: userProjects.length >= 1,
        evidenceSummary:
          userProjects.length >= 1
            ? `${userProjects.length} saved project plan(s) (${userProjects[0].title}).`
            : 'Save a project plan in Project Matcher to unlock.',
        unlockedAt: userProjects[0]?.createdAt,
        targetView: 'project-matcher',
      },
      {
        id: 'ach-responsible-return',
        title: 'Responsible Equipment Return',
        category: 'Stewardship',
        description: 'Logged condition notes and returned checked-out lab hardware via QR tracking.',
        criteria: 'Complete at least 1 QR equipment return inspection.',
        current: Math.min(1, cleanReturns.length),
        target: 1,
        progressPct: cleanReturns.length >= 1 ? 100 : 0,
        unlocked: cleanReturns.length >= 1,
        evidenceSummary:
          cleanReturns.length >= 1
            ? `${cleanReturns.length} QR return inspection(s) logged.`
            : 'Check out and return a unit in Equipment Tracking to unlock.',
        unlockedAt: cleanReturns[0]?.timestamp,
        targetView: 'equipment-tracking',
      },
    ];

    const unlockedCount = badges.filter((b) => b.unlocked).length;
    return {
      userId,
      unlockedCount,
      totalCount: badges.length,
      completionPct: Math.round((unlockedCount / badges.length) * 100),
      badges,
    };
  },
};
