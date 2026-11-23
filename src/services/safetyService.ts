import {
  ActionResult,
  AppDatabase,
  EquipmentItem,
  Laboratory,
  SafetyIncident,
  SafetyTrainingRecord,
} from '../types/lablink';
import {
  appendAuditLog,
  appendNotification,
  createUniqueId,
  getCurrentUser,
  requireLabAdmin,
} from './permissionService';

export interface ReadinessEvaluation {
  eligible: boolean;
  missingCertifications: string[];
  pendingVerification: string[];
  expiredCertifications: string[];
  statusLabel: 'Ready' | 'Pending Admin Verification' | 'Training Required' | 'Expired';
}

export const safetyService = {
  evaluateUserReadiness(
    db: AppDatabase,
    userId: string,
    equipment: EquipmentItem,
    lab?: Laboratory
  ): ReadinessEvaluation {
    const user = db.users.find((u) => u.id === userId);
    if (user && (user.role === 'lab_admin' || user.role === 'system_admin')) {
      return {
        eligible: true,
        missingCertifications: [],
        pendingVerification: [],
        expiredCertifications: [],
        statusLabel: 'Ready',
      };
    }

    const requiredCertIds = new Set<string>();
    if (equipment.requiredCertificationId) {
      requiredCertIds.add(equipment.requiredCertificationId);
    }
    if (lab) {
      for (const modId of lab.requiredTrainingIds) {
        const cert = db.certifications.find((c) => c.requiredModuleId === modId);
        if (cert) requiredCertIds.add(cert.id);
      }
    }

    const missingCertifications: string[] = [];
    const pendingVerification: string[] = [];
    const expiredCertifications: string[] = [];

    for (const certId of requiredCertIds) {
      const cert = db.certifications.find((c) => c.id === certId);
      if (!cert) continue;

      const record = db.trainingRecords.find(
        (r) => r.userId === userId && r.certificationId === certId
      );

      if (!record || record.status === 'not_started') {
        missingCertifications.push(cert.title);
      } else if (record.status === 'quiz_passed_pending_verification') {
        pendingVerification.push(cert.title);
      } else if (record.status === 'expired') {
        expiredCertifications.push(cert.title);
      }
    }

    if (expiredCertifications.length > 0) {
      return {
        eligible: false,
        missingCertifications,
        pendingVerification,
        expiredCertifications,
        statusLabel: 'Expired',
      };
    }
    if (missingCertifications.length > 0) {
      return {
        eligible: false,
        missingCertifications,
        pendingVerification,
        expiredCertifications,
        statusLabel: 'Training Required',
      };
    }
    if (pendingVerification.length > 0) {
      return {
        eligible: false,
        missingCertifications,
        pendingVerification,
        expiredCertifications,
        statusLabel: 'Pending Admin Verification',
      };
    }

    return {
      eligible: true,
      missingCertifications: [],
      pendingVerification: [],
      expiredCertifications: [],
      statusLabel: 'Ready',
    };
  },

  submitTrainingQuiz(
    db: AppDatabase,
    moduleId: string,
    selectedAnswers: Record<string, number>
  ): { nextDb: AppDatabase; result: ActionResult<{ score: number; passed: boolean; needsAdminSignoff: boolean }> } {
    const actor = getCurrentUser(db);
    const mod = db.trainingModules.find((m) => m.id === moduleId);
    if (!mod) {
      return { nextDb: db, result: { ok: false, message: 'Training module not found.' } };
    }

    if (mod.questions.some((q) => selectedAnswers[q.id] === undefined)) {
      return {
        nextDb: db,
        result: { ok: false, message: 'Please answer every quiz question before submitting.' },
      };
    }

    const correctCount = mod.questions.filter(
      (q) => selectedAnswers[q.id] === q.correctIndex
    ).length;
    const score = Math.round((correctCount / mod.questions.length) * 100);
    const passed = score >= 80;

    if (!passed) {
      return {
        nextDb: db,
        result: {
          ok: false,
          message: `Score ${score}% — 80% or higher is required to pass ${mod.code}. Review the safety rules and retry.`,
          data: { score, passed: false, needsAdminSignoff: false },
        },
      };
    }

    const cert = db.certifications.find((c) => c.requiredModuleId === mod.id);
    const needsAdminSignoff = cert ? cert.requiresAdminSignoff : true;

    // Students NEVER self-issue certifications that require admin signoff.
    const nextStatus: SafetyTrainingRecord['status'] = needsAdminSignoff
      ? 'quiz_passed_pending_verification'
      : 'verified';

    const now = new Date();
    const expires = new Date(now.getTime() + (cert?.validityDays ?? 365) * 86400000).toISOString();

    const existing = db.trainingRecords.find(
      (r) => r.userId === actor.id && r.moduleId === mod.id
    );

    let nextRecords: SafetyTrainingRecord[];
    if (existing) {
      nextRecords = db.trainingRecords.map((r) =>
        r.id === existing.id
          ? {
              ...r,
              quizScore: score,
              status: nextStatus,
              completedAt: now.toISOString(),
              expiresAt: nextStatus === 'verified' ? expires : undefined,
            }
          : r
      );
    } else {
      const created: SafetyTrainingRecord = {
        id: createUniqueId('tr'),
        userId: actor.id,
        moduleId: mod.id,
        certificationId: cert?.id ?? null,
        quizScore: score,
        status: nextStatus,
        completedAt: now.toISOString(),
        expiresAt: nextStatus === 'verified' ? expires : undefined,
      };
      nextRecords = [created, ...db.trainingRecords];
    }

    let nextDb: AppDatabase = {
      ...db,
      trainingRecords: nextRecords,
      auditLogs: appendAuditLog(
        db,
        actor,
        'TRAINING_QUIZ_COMPLETED',
        mod.id,
        `Passed ${mod.code} with ${score}% (${nextStatus}).`
      ),
    };

    if (needsAdminSignoff) {
      const lab = db.laboratories.find((l) => l.id === mod.laboratoryId);
      const adminId = lab?.leadAdminId ?? 'usr-admin-elena';
      nextDb = {
        ...nextDb,
        notifications: appendNotification(
          nextDb,
          adminId,
          'safety',
          'Certification Verification Requested',
          `${actor.name} passed ${mod.code} (${score}%) and awaits physical bench sign-off for ${cert?.title ?? mod.title}.`,
          'lab-passport'
        ),
      };
    } else {
      nextDb = {
        ...nextDb,
        notifications: appendNotification(
          nextDb,
          actor.id,
          'safety',
          'Certification Verified',
          `You completed ${mod.code} (${score}%). ${cert?.title ?? mod.title} is now active on your Lab Passport.`,
          'lab-passport'
        ),
      };
    }

    return {
      nextDb,
      result: {
        ok: true,
        message: needsAdminSignoff
          ? `Quiz passed (${score}%). Lab Administrator sign-off is required before restricted access activates.`
          : `Quiz passed (${score}%). Certification activated on your Digital Lab Passport.`,
        data: { score, passed: true, needsAdminSignoff },
      },
    };
  },

  verifyStudentCertification(
    db: AppDatabase,
    recordId: string
  ): { nextDb: AppDatabase; result: ActionResult } {
    const actor = getCurrentUser(db);
    const record = db.trainingRecords.find((r) => r.id === recordId);
    if (!record) {
      return { nextDb: db, result: { ok: false, message: 'Training record not found.' } };
    }

    const cert = db.certifications.find((c) => c.id === record.certificationId);
    const labId = cert?.laboratoryId ?? 'lab-ece-signals';
    const perm = requireLabAdmin(actor, labId, 'verify student safety certifications');
    if (!perm.allowed) {
      return { nextDb: db, result: { ok: false, message: perm.reason! } };
    }

    if (record.userId === actor.id && actor.role === 'student') {
      return {
        nextDb: db,
        result: { ok: false, message: 'Students cannot verify or issue their own certifications.' },
      };
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (cert?.validityDays ?? 365) * 86400000
    ).toISOString();

    const nextRecords = db.trainingRecords.map((r) =>
      r.id === recordId
        ? {
            ...r,
            status: 'verified' as const,
            verifiedByAdminId: actor.id,
            expiresAt,
          }
        : r
    );

    const student = db.users.find((u) => u.id === record.userId);
    let nextDb: AppDatabase = {
      ...db,
      trainingRecords: nextRecords,
      auditLogs: appendAuditLog(
        db,
        actor,
        'CERTIFICATION_VERIFIED',
        recordId,
        `Verified ${cert?.title ?? record.moduleId} for ${student?.name ?? record.userId}.`
      ),
    };
    nextDb = {
      ...nextDb,
      notifications: appendNotification(
        nextDb,
        record.userId,
        'safety',
        'Lab Certification Approved',
        `${actor.name} verified your ${cert?.title ?? 'safety'} certification. Your Digital Lab Passport is updated.`,
        'lab-passport'
      ),
    };

    return {
      nextDb,
      result: { ok: true, message: `Verified ${cert?.title ?? 'certification'} for ${student?.name ?? 'student'}.` },
    };
  },

  reportIncident(
    db: AppDatabase,
    payload: {
      laboratoryId: string;
      unitId: string | null;
      severity: SafetyIncident['severity'];
      title: string;
      description: string;
    }
  ): { nextDb: AppDatabase; result: ActionResult<SafetyIncident> } {
    const actor = getCurrentUser(db);
    if (!payload.title.trim() || !payload.description.trim()) {
      return {
        nextDb: db,
        result: { ok: false, message: 'Incident title and description are required.' },
      };
    }

    const incident: SafetyIncident = {
      id: createUniqueId('inc'),
      reporterId: actor.id,
      laboratoryId: payload.laboratoryId,
      unitId: payload.unitId,
      severity: payload.severity,
      title: payload.title.trim(),
      description: payload.description.trim(),
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    const lab = db.laboratories.find((l) => l.id === payload.laboratoryId);
    let nextDb: AppDatabase = {
      ...db,
      safetyIncidents: [incident, ...db.safetyIncidents],
      auditLogs: appendAuditLog(
        db,
        actor,
        'SAFETY_INCIDENT_REPORTED',
        incident.id,
        `Reported ${payload.severity} incident in ${lab?.code ?? payload.laboratoryId}: ${incident.title}`
      ),
    };

    nextDb = {
      ...nextDb,
      notifications: appendNotification(
        nextDb,
        lab?.leadAdminId ?? 'usr-admin-elena',
        'safety',
        `Safety Incident (${payload.severity.toUpperCase()})`,
        `${actor.name} reported: ${incident.title} in ${lab?.code ?? payload.laboratoryId}.`,
        'safety-readiness'
      ),
    };

    return {
      nextDb,
      result: { ok: true, message: 'Safety incident logged and routed to Lab Administration.', data: incident },
    };
  },

  reviewIncident(
    db: AppDatabase,
    incidentId: string,
    status: SafetyIncident['status'],
    resolutionNotes: string
  ): { nextDb: AppDatabase; result: ActionResult } {
    const actor = getCurrentUser(db);
    const incident = db.safetyIncidents.find((i) => i.id === incidentId);
    if (!incident) {
      return { nextDb: db, result: { ok: false, message: 'Incident record not found.' } };
    }

    const perm = requireLabAdmin(actor, incident.laboratoryId, 'review safety incidents');
    if (!perm.allowed) {
      return { nextDb: db, result: { ok: false, message: perm.reason! } };
    }

    const nextIncidents = db.safetyIncidents.map((i) =>
      i.id === incidentId
        ? {
            ...i,
            status,
            reviewedByAdminId: actor.id,
            resolutionNotes: resolutionNotes.trim() || i.resolutionNotes,
          }
        : i
    );

    const nextDb: AppDatabase = {
      ...db,
      safetyIncidents: nextIncidents,
      auditLogs: appendAuditLog(
        db,
        actor,
        'SAFETY_INCIDENT_REVIEWED',
        incidentId,
        `Marked incident ${incidentId} as ${status}.`
      ),
    };

    return {
      nextDb,
      result: { ok: true, message: `Incident updated to ${status.replace('_', ' ')}.` },
    };
  },
};
