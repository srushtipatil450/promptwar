import { ActionResult, AppDatabase, BookingRequest, ConfirmedAllocation } from '../types/lablink';
import {
  appendAuditLog,
  appendNotification,
  createUniqueId,
  getCurrentUser,
  requireLabAdmin,
} from './permissionService';
import { schedulingService } from './schedulingService';
import { waitingListService } from './waitingListService';

export const bookingService = {
  createBookingRequest(
    db: AppDatabase,
    payload: {
      userId?: string;
      equipmentId: string;
      preferredUnitId?: string | null;
      projectId: string | null;
      date: string;
      startHour: number;
      endHour: number;
      purpose: string;
      urgencyLevel: BookingRequest['urgencyLevel'];
      projectDependencyLevel: BookingRequest['projectDependencyLevel'];
      crossDeptApproved?: boolean;
      crossDeptRequestId?: string | null;
    }
  ): { nextDb: AppDatabase; result: ActionResult<BookingRequest> } {
    const actor = getCurrentUser(db);
    const targetUserId = payload.userId ?? actor.id;
    const equipment = db.equipment.find((e) => e.id === payload.equipmentId);
    if (!equipment) {
      return { nextDb: db, result: { ok: false, message: 'Equipment item not found.' } };
    }

    if (!payload.purpose.trim()) {
      return { nextDb: db, result: { ok: false, message: 'Booking purpose is required.' } };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
      return { nextDb: db, result: { ok: false, message: 'Please enter a valid booking date (YYYY-MM-DD).' } };
    }

    const constraintCheck = schedulingService.validateBookingConstraints(db, {
      userId: targetUserId,
      equipment,
      date: payload.date,
      startHour: payload.startHour,
      endHour: payload.endHour,
      crossDeptApproved: payload.crossDeptApproved,
    });
    if (!constraintCheck.ok) {
      return { nextDb: db, result: { ok: false, message: constraintCheck.reason! } };
    }

    const priority = schedulingService.computePriorityBreakdown(db, {
      userId: targetUserId,
      equipmentId: equipment.id,
      projectId: payload.projectId,
      startHour: payload.startHour,
      endHour: payload.endHour,
      urgencyLevel: payload.urgencyLevel,
      projectDependencyLevel: payload.projectDependencyLevel,
    });

    const availableUnit = schedulingService.findAvailableUnitForSlot(
      db,
      equipment.id,
      payload.date,
      payload.startHour,
      payload.endHour,
      payload.preferredUnitId
    );

    const canAutoAllocate = Boolean(availableUnit);
    const bookingId = createUniqueId('bk');

    const newRequest: BookingRequest = {
      id: bookingId,
      userId: targetUserId,
      projectId: payload.projectId,
      equipmentId: equipment.id,
      preferredUnitId: payload.preferredUnitId ?? null,
      allocatedUnitId: canAutoAllocate ? availableUnit!.id : null,
      laboratoryId: equipment.laboratoryId,
      departmentId: equipment.departmentId,
      date: payload.date,
      startHour: payload.startHour,
      endHour: payload.endHour,
      purpose: payload.purpose.trim(),
      urgencyLevel: payload.urgencyLevel,
      projectDependencyLevel: payload.projectDependencyLevel,
      status: canAutoAllocate ? 'approved' : 'pending',
      priority,
      decisionReason: canAutoAllocate
        ? `Allocated ${availableUnit!.unitCode} (${priority.totalScore}/100 priority score).`
        : 'All physical units occupied or under maintenance for this slot. Queued for conflict review or waiting list.',
      crossDeptRequestId: payload.crossDeptRequestId ?? null,
      createdAt: new Date().toISOString(),
    };

    let nextAllocations = db.confirmedAllocations;
    let nextUnits = db.physicalUnits;

    if (canAutoAllocate && availableUnit) {
      const alloc: ConfirmedAllocation = {
        id: createUniqueId('alloc'),
        bookingId,
        unitId: availableUnit.id,
        equipmentId: equipment.id,
        laboratoryId: equipment.laboratoryId,
        userId: targetUserId,
        date: payload.date,
        startHour: payload.startHour,
        endHour: payload.endHour,
        createdAt: new Date().toISOString(),
      };
      nextAllocations = [alloc, ...db.confirmedAllocations];
      nextUnits = db.physicalUnits.map((u) =>
        u.id === availableUnit.id && u.status === 'available'
          ? { ...u, status: 'booked' as const, assignedToBookingId: bookingId }
          : u
      );
    }

    const nextDb: AppDatabase = {
      ...db,
      bookingRequests: [newRequest, ...db.bookingRequests],
      confirmedAllocations: nextAllocations,
      physicalUnits: nextUnits,
      auditLogs: appendAuditLog(
        db,
        actor,
        canAutoAllocate ? 'BOOKING_ALLOCATED' : 'BOOKING_QUEUED',
        bookingId,
        newRequest.decisionReason
      ),
      notifications: appendNotification(
        db,
        targetUserId,
        'booking',
        canAutoAllocate ? 'Booking Confirmed' : 'Booking Pending Conflict Resolution',
        canAutoAllocate
          ? `${equipment.name} (${availableUnit!.unitCode}) booked on ${payload.date}, ${payload.startHour}:00–${payload.endHour}:00.`
          : `Request for ${equipment.name} on ${payload.date} is pending: all units currently occupied or locked.`,
        'my-bookings'
      ),
    };

    return {
      nextDb,
      result: {
        ok: true,
        message: canAutoAllocate
          ? `Confirmed allocation on unit ${availableUnit!.unitCode}.`
          : 'No open unit for that slot — request logged as Pending. You can also join the Smart Waiting List.',
        data: newRequest,
      },
    };
  },

  allocateOrOverrideBooking(
    db: AppDatabase,
    payload: {
      bookingId: string;
      targetUnitId: string;
      overrideReason?: string;
    }
  ): { nextDb: AppDatabase; result: ActionResult } {
    const actor = getCurrentUser(db);
    const booking = db.bookingRequests.find((b) => b.id === payload.bookingId);
    if (!booking) {
      return { nextDb: db, result: { ok: false, message: 'Booking request not found.' } };
    }

    const perm = requireLabAdmin(actor, booking.laboratoryId, 'allocate or override bookings');
    if (!perm.allowed) {
      return { nextDb: db, result: { ok: false, message: perm.reason! } };
    }

    const unit = db.physicalUnits.find((u) => u.id === payload.targetUnitId);
    const equipment = db.equipment.find((e) => e.id === booking.equipmentId);
    if (!unit || !equipment) {
      return { nextDb: db, result: { ok: false, message: 'Unit or equipment not found.' } };
    }

    if (unit.equipmentId !== booking.equipmentId) {
      return {
        nextDb: db,
        result: { ok: false, message: `Unit ${unit.unitCode} does not match ${equipment.name}.` },
      };
    }

    // Never allocate faulty/maintenance units even on admin override
    if (unit.status === 'maintenance' || unit.status === 'faulty') {
      return {
        nextDb: db,
        result: { ok: false, message: `Cannot allocate ${unit.unitCode}: unit status is ${unit.status}.` },
      };
    }

    // Revalidate safety & operating hours
    const constraint = schedulingService.validateBookingConstraints(db, {
      userId: booking.userId,
      equipment,
      date: booking.date,
      startHour: booking.startHour,
      endHour: booking.endHour,
      crossDeptApproved: Boolean(booking.crossDeptRequestId),
    });
    if (!constraint.ok) {
      return { nextDb: db, result: { ok: false, message: constraint.reason! } };
    }

    const bookable = schedulingService.isUnitBookableForSlot(
      db,
      unit,
      booking.date,
      booking.startHour,
      booking.endHour,
      booking.id
    );
    if (!bookable.ok) {
      return { nextDb: db, result: { ok: false, message: bookable.reason! } };
    }

    const reasonText = payload.overrideReason?.trim()
      ? `Admin allocation by ${actor.name}: ${payload.overrideReason.trim()}`
      : `Allocated ${unit.unitCode} by ${actor.name} via scheduler conflict resolver.`;

    const nextRequests = db.bookingRequests.map((b) =>
      b.id === booking.id
        ? {
            ...b,
            status: 'approved' as const,
            allocatedUnitId: unit.id,
            decisionReason: reasonText,
            overrideByAdminId: actor.id,
            overrideReason: payload.overrideReason?.trim() || undefined,
          }
        : b
    );

    const newAlloc: ConfirmedAllocation = {
      id: createUniqueId('alloc'),
      bookingId: booking.id,
      unitId: unit.id,
      equipmentId: equipment.id,
      laboratoryId: booking.laboratoryId,
      userId: booking.userId,
      date: booking.date,
      startHour: booking.startHour,
      endHour: booking.endHour,
      createdAt: new Date().toISOString(),
    };

    const nextAllocations = [
      newAlloc,
      ...db.confirmedAllocations.filter((a) => a.bookingId !== booking.id),
    ];

    const nextUnits = db.physicalUnits.map((u) =>
      u.id === unit.id && u.status === 'available'
        ? { ...u, status: 'booked' as const, assignedToBookingId: booking.id }
        : u
    );

    const nextDb: AppDatabase = {
      ...db,
      bookingRequests: nextRequests,
      confirmedAllocations: nextAllocations,
      physicalUnits: nextUnits,
      auditLogs: appendAuditLog(db, actor, 'SCHEDULER_ALLOCATION', booking.id, reasonText),
      notifications: appendNotification(
        db,
        booking.userId,
        'booking',
        'Booking Request Approved',
        `${unit.unitCode} (${equipment.name}) allocated for ${booking.date} (${booking.startHour}:00–${booking.endHour}:00).`,
        'my-bookings'
      ),
    };

    return {
      nextDb,
      result: { ok: true, message: `Allocated ${unit.unitCode} to booking ${booking.id}.` },
    };
  },

  cancelBooking(
    db: AppDatabase,
    bookingId: string,
    reason?: string
  ): { nextDb: AppDatabase; result: ActionResult } {
    const actor = getCurrentUser(db);
    const booking = db.bookingRequests.find((b) => b.id === bookingId);
    if (!booking) {
      return { nextDb: db, result: { ok: false, message: 'Booking not found.' } };
    }

    const isOwner = booking.userId === actor.id;
    const isAdmin =
      actor.role === 'system_admin' ||
      (actor.role === 'lab_admin' && actor.assignedLabIds.includes(booking.laboratoryId));

    if (!isOwner && !isAdmin) {
      return {
        nextDb: db,
        result: { ok: false, message: 'Permission denied: You can only cancel your own bookings.' },
      };
    }

    if (booking.status === 'cancelled' || booking.status === 'completed') {
      return {
        nextDb: db,
        result: { ok: false, message: `Booking is already ${booking.status}.` },
      };
    }

    const releasedUnitId = booking.allocatedUnitId;
    const nextRequests = db.bookingRequests.map((b) =>
      b.id === bookingId
        ? {
            ...b,
            status: 'cancelled' as const,
            decisionReason: reason?.trim()
              ? `Cancelled by ${actor.name}: ${reason.trim()}`
              : `Cancelled by ${actor.name}.`,
          }
        : b
    );

    const nextAllocations = db.confirmedAllocations.filter((a) => a.bookingId !== bookingId);
    const nextUnits = db.physicalUnits.map((u) => {
      if (u.id === releasedUnitId) {
        const remainingAlloc = nextAllocations.find((a) => a.unitId === u.id);
        return {
          ...u,
          status:
            u.status === 'booked' && !remainingAlloc
              ? ('available' as const)
              : u.status,
          assignedToBookingId:
            u.assignedToBookingId === bookingId
              ? (remainingAlloc?.bookingId ?? null)
              : u.assignedToBookingId,
        };
      }
      return u;
    });

    let nextDb: AppDatabase = {
      ...db,
      bookingRequests: nextRequests,
      confirmedAllocations: nextAllocations,
      physicalUnits: nextUnits,
      auditLogs: appendAuditLog(
        db,
        actor,
        'BOOKING_CANCELLED',
        bookingId,
        `Cancelled booking ${bookingId}${releasedUnitId ? ` and released unit ${releasedUnitId}` : ''}.`
      ),
    };

    // Trigger Smart Waiting List offer if a confirmed physical unit slot opened up
    if (releasedUnitId) {
      nextDb = waitingListService.triggerOfferForReleasedSlot(nextDb, {
        equipmentId: booking.equipmentId,
        unitId: releasedUnitId,
        date: booking.date,
        startHour: booking.startHour,
        endHour: booking.endHour,
      });
    }

    return {
      nextDb,
      result: {
        ok: true,
        message: releasedUnitId
          ? 'Booking cancelled, unit released, and Smart Waiting List checked for eligible offers.'
          : 'Booking request cancelled.',
      },
    };
  },
};
