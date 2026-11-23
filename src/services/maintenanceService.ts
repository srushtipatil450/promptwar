import { ActionResult, AppDatabase, MaintenanceRecord } from '../types/lablink';
import {
  appendAuditLog,
  appendNotification,
  createUniqueId,
  getCurrentUser,
  requireLabAdmin,
} from './permissionService';

export const maintenanceService = {
  reportIssue(
    db: AppDatabase,
    payload: {
      unitId: string;
      issueTitle: string;
      description: string;
      severity: MaintenanceRecord['severity'];
    }
  ): { nextDb: AppDatabase; result: ActionResult<MaintenanceRecord> } {
    const actor = getCurrentUser(db);
    const unit = db.physicalUnits.find((u) => u.id === payload.unitId);
    if (!unit) {
      return { nextDb: db, result: { ok: false, message: 'Physical unit not found.' } };
    }
    if (!payload.issueTitle.trim() || !payload.description.trim()) {
      return {
        nextDb: db,
        result: { ok: false, message: 'Issue title and description are required.' },
      };
    }

    const lab = db.laboratories.find((l) => l.id === unit.laboratoryId);
    const blocksBooking = payload.severity === 'major' || payload.severity === 'critical';
    const now = new Date().toISOString();

    const record: MaintenanceRecord = {
      id: createUniqueId('mnt'),
      unitId: unit.id,
      equipmentId: unit.equipmentId,
      reportedByUserId: actor.id,
      assignedAdminId: lab?.leadAdminId ?? null,
      issueTitle: payload.issueTitle.trim(),
      description: payload.description.trim(),
      severity: payload.severity,
      status: 'reported',
      blocksBooking,
      createdAt: now,
      updatedAt: now,
    };

    // Lock faulty/major unit out of booking pool & update health score
    const nextUnits = db.physicalUnits.map((u) =>
      u.id === unit.id
        ? {
            ...u,
            status: blocksBooking ? ('faulty' as const) : u.status,
            conditionScore: Math.max(
              35,
              u.conditionScore - (payload.severity === 'critical' ? 35 : payload.severity === 'major' ? 20 : 8)
            ),
            notes: `Issue reported: ${record.issueTitle}`,
          }
        : u
    );

    // Expire any active waiting-list offers targeting this locked unit
    const nextOffers = blocksBooking
      ? db.availabilityOffers.map((o) =>
          o.unitId === unit.id && o.status === 'active' ? { ...o, status: 'expired' as const } : o
        )
      : db.availabilityOffers;

    const nextDb: AppDatabase = {
      ...db,
      maintenanceRecords: [record, ...db.maintenanceRecords],
      physicalUnits: nextUnits,
      availabilityOffers: nextOffers,
      auditLogs: appendAuditLog(
        db,
        actor,
        'MAINTENANCE_ISSUE_REPORTED',
        unit.id,
        `Reported ${payload.severity} issue on ${unit.unitCode}: ${record.issueTitle}.`
      ),
      notifications: appendNotification(
        db,
        lab?.leadAdminId ?? 'usr-admin-elena',
        'maintenance',
        `Equipment Issue: ${unit.unitCode}`,
        `${actor.name} reported ${payload.severity} issue "${record.issueTitle}". ${blocksBooking ? 'Unit automatically blocked from bookings.' : ''}`,
        'equipment-health'
      ),
    };

    return {
      nextDb,
      result: {
        ok: true,
        message: blocksBooking
          ? `Issue logged. ${unit.unitCode} has been locked out from bookings and forecasts.`
          : `Minor issue logged for ${unit.unitCode}.`,
        data: record,
      },
    };
  },

  updateRepairProgress(
    db: AppDatabase,
    recordId: string,
    status: 'in_progress' | 'awaiting_inspection',
    notes?: string
  ): { nextDb: AppDatabase; result: ActionResult } {
    const actor = getCurrentUser(db);
    const rec = db.maintenanceRecords.find((m) => m.id === recordId);
    if (!rec) {
      return { nextDb: db, result: { ok: false, message: 'Maintenance ticket not found.' } };
    }
    const unit = db.physicalUnits.find((u) => u.id === rec.unitId);
    const perm = requireLabAdmin(actor, unit?.laboratoryId ?? '', 'update repair progress');
    if (!perm.allowed) {
      return { nextDb: db, result: { ok: false, message: perm.reason! } };
    }

    const nextRecords = db.maintenanceRecords.map((m) =>
      m.id === recordId
        ? {
            ...m,
            status,
            assignedAdminId: actor.id,
            inspectionNotes: notes?.trim() || m.inspectionNotes,
            updatedAt: new Date().toISOString(),
          }
        : m
    );

    const nextUnits = db.physicalUnits.map((u) =>
      u.id === rec.unitId
        ? { ...u, status: 'maintenance' as const, conditionScore: Math.min(85, u.conditionScore + 15) }
        : u
    );

    const nextDb: AppDatabase = {
      ...db,
      maintenanceRecords: nextRecords,
      physicalUnits: nextUnits,
      auditLogs: appendAuditLog(
        db,
        actor,
        'MAINTENANCE_UPDATED',
        recordId,
        `Updated ${unit?.unitCode ?? rec.unitId} maintenance to ${status}.`
      ),
    };

    return {
      nextDb,
      result: { ok: true, message: `Ticket updated to ${status.replace('_', ' ')}.` },
    };
  },

  approveReturnToService(
    db: AppDatabase,
    recordId: string,
    inspectionNotes: string
  ): { nextDb: AppDatabase; result: ActionResult } {
    const actor = getCurrentUser(db);
    const rec = db.maintenanceRecords.find((m) => m.id === recordId);
    if (!rec) {
      return { nextDb: db, result: { ok: false, message: 'Maintenance ticket not found.' } };
    }
    const unit = db.physicalUnits.find((u) => u.id === rec.unitId);
    const perm = requireLabAdmin(
      actor,
      unit?.laboratoryId ?? '',
      'inspect and return equipment to service'
    );
    if (!perm.allowed) {
      return { nextDb: db, result: { ok: false, message: perm.reason! } };
    }

    if (!inspectionNotes.trim()) {
      return {
        nextDb: db,
        result: { ok: false, message: 'Authorised inspection sign-off notes are required.' },
      };
    }

    const now = new Date().toISOString();
    const nextRecords = db.maintenanceRecords.map((m) =>
      m.id === recordId
        ? {
            ...m,
            status: 'resolved' as const,
            blocksBooking: false,
            inspectionApprovedByAdminId: actor.id,
            inspectionNotes: inspectionNotes.trim(),
            updatedAt: now,
          }
        : m
    );

    const hasOtherBlocking = nextRecords.some(
      (m) => m.unitId === rec.unitId && m.blocksBooking && m.status !== 'resolved'
    );

    const nextUnits = db.physicalUnits.map((u) =>
      u.id === rec.unitId
        ? {
            ...u,
            status: hasOtherBlocking ? u.status : ('available' as const),
            conditionScore: Math.max(92, u.conditionScore),
            lastCalibrationDate: now.slice(0, 10),
            notes: `Returned to service: ${inspectionNotes.trim()}`,
          }
        : u
    );

    const nextDb: AppDatabase = {
      ...db,
      maintenanceRecords: nextRecords,
      physicalUnits: nextUnits,
      auditLogs: appendAuditLog(
        db,
        actor,
        'MAINTENANCE_INSPECTED_RTS',
        rec.unitId,
        `Authorised return-to-service for ${unit?.unitCode ?? rec.unitId}: ${inspectionNotes.trim()}`
      ),
      notifications: appendNotification(
        db,
        rec.reportedByUserId,
        'maintenance',
        `${unit?.unitCode ?? 'Unit'} Returned to Service`,
        `${actor.name} completed inspection and restored ${unit?.unitCode ?? 'unit'} to the active booking pool.`,
        'equipment-health'
      ),
    };

    return {
      nextDb,
      result: {
        ok: true,
        message: `Inspection recorded. ${unit?.unitCode ?? 'Unit'} is back in the available pool.`,
      },
    };
  },
};
