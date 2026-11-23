import { ActionResult, AppDatabase, PhysicalUnit, QRTrackingEvent } from '../types/lablink';
import {
  appendAuditLog,
  appendNotification,
  createUniqueId,
  getCurrentUser,
} from './permissionService';
import { safetyService } from './safetyService';

export const qrTrackingService = {
  lookupUnitByCode(db: AppDatabase, query: string): PhysicalUnit | null {
    const clean = query.trim().toUpperCase();
    if (!clean) return null;

    // Support direct unitCode (e.g. OSC-001) or full QR payload (LABLINK:UNIT:OSC-001:MAX-204)
    return (
      db.physicalUnits.find(
        (u) =>
          u.unitCode.toUpperCase() === clean ||
          u.qrPayload.toUpperCase() === clean ||
          u.serialNumber.toUpperCase() === clean ||
          clean.includes(u.unitCode.toUpperCase())
      ) ?? null
    );
  },

  checkOutUnit(
    db: AppDatabase,
    payload: { unitId: string; conditionNote: string }
  ): { nextDb: AppDatabase; result: ActionResult<QRTrackingEvent> } {
    const actor = getCurrentUser(db);
    const unit = db.physicalUnits.find((u) => u.id === payload.unitId);
    if (!unit) {
      return { nextDb: db, result: { ok: false, message: 'Physical unit not found.' } };
    }

    if (unit.status === 'maintenance' || unit.status === 'faulty') {
      return {
        nextDb: db,
        result: {
          ok: false,
          message: `Check-out blocked: Unit ${unit.unitCode} is currently marked as ${unit.status}.`,
        },
      };
    }

    if (unit.status === 'checked_out') {
      return {
        nextDb: db,
        result: { ok: false, message: `Unit ${unit.unitCode} is already checked out.` },
      };
    }

    // Strict check: Require an approved booking for this physical unit before check-out
    const matchingBookings = db.bookingRequests
      .filter(
        (b) =>
          b.status === 'approved' &&
          b.allocatedUnitId === unit.id &&
          (b.userId === actor.id || actor.role === 'lab_admin' || actor.role === 'system_admin')
      )
      .sort((a, b) => {
        if (a.userId === actor.id && b.userId !== actor.id) return -1;
        if (b.userId === actor.id && a.userId !== actor.id) return 1;
        return a.date.localeCompare(b.date);
      });
    const matchingBooking = matchingBookings[0];

    if (!matchingBooking) {
      return {
        nextDb: db,
        result: {
          ok: false,
          message: `Check-out denied: An approved booking allocated to ${unit.unitCode} for ${actor.name} is required before check-out.`,
        },
      };
    }

    const equipment = db.equipment.find((e) => e.id === unit.equipmentId);
    const lab = db.laboratories.find((l) => l.id === unit.laboratoryId);
    if (equipment) {
      const readiness = safetyService.evaluateUserReadiness(db, matchingBooking.userId, equipment, lab);
      if (!readiness.eligible) {
        return {
          nextDb: db,
          result: {
            ok: false,
            message: `Check-out blocked: Safety readiness status is "${readiness.statusLabel}".`,
          },
        };
      }
    }

    const event: QRTrackingEvent = {
      id: createUniqueId('qr'),
      unitId: unit.id,
      equipmentId: unit.equipmentId,
      userId: actor.id,
      bookingId: matchingBooking.id,
      action: 'checked_out',
      timestamp: new Date().toISOString(),
      conditionNote: payload.conditionNote.trim() || 'Pre-use visual inspection nominal.',
      locationLabel: `${lab?.code ?? unit.laboratoryId} Bench`,
    };

    const nextUnits = db.physicalUnits.map((u) =>
      u.id === unit.id
        ? { ...u, status: 'checked_out' as const, assignedToBookingId: matchingBooking.id }
        : u
    );

    const nextDb: AppDatabase = {
      ...db,
      physicalUnits: nextUnits,
      qrTrackingHistory: [event, ...db.qrTrackingHistory],
      auditLogs: appendAuditLog(
        db,
        actor,
        'QR_CHECK_OUT',
        unit.id,
        `Checked out ${unit.unitCode} under approved booking ${matchingBooking.id}.`
      ),
    };

    return {
      nextDb,
      result: {
        ok: true,
        message: `${unit.unitCode} checked out against booking ${matchingBooking.id}.`,
        data: event,
      },
    };
  },

  returnUnit(
    db: AppDatabase,
    payload: { unitId: string; sessionHours: number; conditionNote: string }
  ): { nextDb: AppDatabase; result: ActionResult<QRTrackingEvent> } {
    const actor = getCurrentUser(db);
    const unit = db.physicalUnits.find((u) => u.id === payload.unitId);
    if (!unit) {
      return { nextDb: db, result: { ok: false, message: 'Physical unit not found.' } };
    }

    if (unit.status !== 'checked_out') {
      return {
        nextDb: db,
        result: {
          ok: false,
          message: `Unit ${unit.unitCode} is not currently checked out (status: ${unit.status}).`,
        },
      };
    }

    const bookingId = unit.assignedToBookingId;
    const booking = db.bookingRequests.find((b) => b.id === bookingId);
    const isOwner = booking?.userId === actor.id;
    const isAdmin = actor.role === 'lab_admin' || actor.role === 'system_admin';
    if (booking && !isOwner && !isAdmin) {
      return {
        nextDb: db,
        result: {
          ok: false,
          message: 'Permission denied: Only the borrower or a Lab Administrator can return this unit.',
        },
      };
    }

    const hours = Math.max(0.5, Math.min(12, payload.sessionHours || 2));
    const lab = db.laboratories.find((l) => l.id === unit.laboratoryId);

    const event: QRTrackingEvent = {
      id: createUniqueId('qr'),
      unitId: unit.id,
      equipmentId: unit.equipmentId,
      userId: actor.id,
      bookingId: bookingId ?? null,
      action: 'returned',
      timestamp: new Date().toISOString(),
      conditionNote: payload.conditionNote.trim() || 'Returned clean and calibrated.',
      locationLabel: `${lab?.code ?? unit.laboratoryId} Return Bay`,
    };

    // Mark completed booking if matched and free unit back to available (unless another allocation holds it)
    const nextBookings = db.bookingRequests.map((b) =>
      b.id === bookingId ? { ...b, status: 'completed' as const } : b
    );
    const nextAllocations = db.confirmedAllocations.filter((a) => a.bookingId !== bookingId);
    const remainingAlloc = nextAllocations.find((a) => a.unitId === unit.id);

    const nextUnits = db.physicalUnits.map((u) =>
      u.id === unit.id
        ? {
            ...u,
            status: remainingAlloc ? ('booked' as const) : ('available' as const),
            assignedToBookingId: remainingAlloc?.bookingId ?? null,
            measuredUsageHours: Math.round((u.measuredUsageHours + hours) * 10) / 10,
          }
        : u
    );

    const nextUsers = db.users.map((u) =>
      u.id === (booking?.userId ?? actor.id)
        ? { ...u, previousUsageHours: Math.round((u.previousUsageHours + hours) * 10) / 10 }
        : u
    );

    const nextDb: AppDatabase = {
      ...db,
      physicalUnits: nextUnits,
      bookingRequests: nextBookings,
      confirmedAllocations: nextAllocations,
      users: nextUsers,
      qrTrackingHistory: [event, ...db.qrTrackingHistory],
      auditLogs: appendAuditLog(
        db,
        actor,
        'QR_RETURN',
        unit.id,
        `Returned ${unit.unitCode} (+${hours}h logged). Availability updated.`
      ),
      notifications: appendNotification(
        db,
        actor.id,
        'booking',
        `Unit ${unit.unitCode} Returned`,
        `${unit.unitCode} returned (${hours}h logged) and restored to ${remainingAlloc ? 'scheduled queue' : 'available'}.`,
        'equipment-tracking'
      ),
    };

    return {
      nextDb,
      result: {
        ok: true,
        message: `${unit.unitCode} returned (+${hours}h measured usage) and availability updated.`,
        data: event,
      },
    };
  },
};
