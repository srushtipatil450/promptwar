import {
  ActionResult,
  AppDatabase,
  AvailabilityOffer,
  FairnessConfig,
  WaitingListEntry,
} from '../types/lablink';
import {
  appendAuditLog,
  appendNotification,
  createUniqueId,
  getCurrentUser,
} from './permissionService';
import { intervalsOverlap, schedulingService } from './schedulingService';

export const waitingListService = {
  computeWaitingPriority(
    db: AppDatabase,
    params: {
      userId: string;
      equipmentId: string;
      projectId: string | null;
      createdAt: string;
    },
    weightsOverride?: FairnessConfig['waitingListWeights']
  ) {
    const w = weightsOverride ?? db.fairnessConfig.waitingListWeights;
    const project = db.projects.find((p) => p.id === params.projectId);
    const user = db.users.find((u) => u.id === params.userId);

    const daysUntil = project
      ? Math.max(1, Math.ceil((new Date(project.deadline).getTime() - new Date('2026-11-23').getTime()) / 86400000))
      : 14;
    const deadlineUrgency = Math.max(40, Math.min(98, 102 - daysUntil * 2));
    const projectDependency = project ? 88 : 60;
    const previousWaitBoost = Math.min(95, 65 + (user?.recentBookingCount === 0 ? 20 : 5));
    const hoursWaiting = Math.max(1, (Date.now() - new Date(params.createdAt).getTime()) / 3600000);
    const timeWaitingScore = Math.min(98, Math.round(55 + hoursWaiting * 0.9));
    const submissionTimeScore = Math.min(95, Math.round(60 + hoursWaiting * 0.6));

    const priorityScore = Math.round(
      (deadlineUrgency * w.deadlineUrgency +
        projectDependency * w.projectDependency +
        previousWaitBoost * w.previousWaitBoost +
        timeWaitingScore * w.timeWaiting +
        submissionTimeScore * w.submissionTime) /
        100
    );

    return {
      priorityScore,
      priorityBreakdown: {
        deadlineUrgency,
        projectDependency,
        previousWaitBoost,
        timeWaitingScore,
        submissionTimeScore,
      },
    };
  },

  joinWaitingList(
    db: AppDatabase,
    payload: {
      equipmentId: string;
      projectId: string | null;
      desiredDate: string;
      startHour: number;
      endHour: number;
    }
  ): { nextDb: AppDatabase; result: ActionResult<WaitingListEntry> } {
    const actor = getCurrentUser(db);
    const equipment = db.equipment.find((e) => e.id === payload.equipmentId);
    if (!equipment) {
      return { nextDb: db, result: { ok: false, message: 'Equipment item not found.' } };
    }

    if (payload.startHour >= payload.endHour) {
      return { nextDb: db, result: { ok: false, message: 'Invalid time range.' } };
    }

    // Prevent duplicate waiting-list requests for same user + equipment + date + overlapping window
    const duplicate = db.waitingList.find(
      (w) =>
        w.userId === actor.id &&
        w.equipmentId === payload.equipmentId &&
        w.desiredDate === payload.desiredDate &&
        (w.status === 'waiting' || w.status === 'offered') &&
        intervalsOverlap(w.startHour, w.endHour, payload.startHour, payload.endHour)
    );
    if (duplicate) {
      return {
        nextDb: db,
        result: {
          ok: false,
          message: `Duplicate prevented: You already have an active waiting-list entry for ${equipment.name} on ${payload.desiredDate}.`,
        },
      };
    }

    const createdAt = new Date().toISOString();
    const { priorityScore, priorityBreakdown } = this.computeWaitingPriority(db, {
      userId: actor.id,
      equipmentId: payload.equipmentId,
      projectId: payload.projectId,
      createdAt,
    });

    const entry: WaitingListEntry = {
      id: createUniqueId('wl'),
      userId: actor.id,
      equipmentId: payload.equipmentId,
      laboratoryId: equipment.laboratoryId,
      projectId: payload.projectId,
      desiredDate: payload.desiredDate,
      startHour: payload.startHour,
      endHour: payload.endHour,
      priorityScore,
      priorityBreakdown,
      status: 'waiting',
      createdAt,
    };

    const nextList = [entry, ...db.waitingList].sort((a, b) => b.priorityScore - a.priorityScore);
    const nextDb: AppDatabase = {
      ...db,
      waitingList: nextList,
      auditLogs: appendAuditLog(
        db,
        actor,
        'WAITING_LIST_JOINED',
        entry.id,
        `Joined waiting list for ${equipment.name} on ${payload.desiredDate} (${payload.startHour}:00-${payload.endHour}:00), priority ${priorityScore}.`
      ),
    };

    return {
      nextDb,
      result: {
        ok: true,
        message: `Added to waiting list for ${equipment.name} with priority score ${priorityScore}/100.`,
        data: entry,
      },
    };
  },

  triggerOfferForReleasedSlot(
    db: AppDatabase,
    params: { equipmentId: string; unitId: string; date: string; startHour: number; endHour: number }
  ): AppDatabase {
    const unit = db.physicalUnits.find((u) => u.id === params.unitId);
    if (!unit || unit.status === 'maintenance' || unit.status === 'faulty') {
      return db;
    }

    const activeMaint = db.maintenanceRecords.some(
      (m) => m.unitId === unit.id && m.blocksBooking && m.status !== 'resolved'
    );
    if (activeMaint) return db;

    // Rank eligible waiting entries
    const candidates = db.waitingList
      .filter(
        (w) =>
          w.equipmentId === params.equipmentId &&
          w.desiredDate === params.date &&
          w.status === 'waiting' &&
          intervalsOverlap(w.startHour, w.endHour, params.startHour, params.endHour)
      )
      .sort((a, b) => b.priorityScore - a.priorityScore);

    if (candidates.length === 0) return db;

    const top = candidates[0];
    const equipment = db.equipment.find((e) => e.id === params.equipmentId);
    const expiresAt = new Date(Date.now() + 6 * 3600000).toISOString();

    const offer: AvailabilityOffer = {
      id: createUniqueId('off'),
      waitingListEntryId: top.id,
      userId: top.userId,
      equipmentId: params.equipmentId,
      unitId: params.unitId,
      date: params.date,
      startHour: top.startHour,
      endHour: top.endHour,
      expiresAt,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const nextWaiting = db.waitingList.map((w) =>
      w.id === top.id ? { ...w, status: 'offered' as const } : w
    );

    const nextDb: AppDatabase = {
      ...db,
      waitingList: nextWaiting,
      availabilityOffers: [offer, ...db.availabilityOffers],
      notifications: appendNotification(
        db,
        top.userId,
        'waiting_list',
        'Time-Limited Availability Offer',
        `Unit ${unit.unitCode} (${equipment?.name ?? 'Equipment'}) became available on ${params.date} (${top.startHour}:00–${top.endHour}:00). Accept your offer to attempt allocation.`,
        'waiting-list'
      ),
    };

    return nextDb;
  },

  acceptOffer(
    db: AppDatabase,
    offerId: string
  ): { nextDb: AppDatabase; result: ActionResult } {
    const actor = getCurrentUser(db);
    const offer = db.availabilityOffers.find((o) => o.id === offerId);
    if (!offer) {
      return { nextDb: db, result: { ok: false, message: 'Offer not found.' } };
    }
    if (offer.userId !== actor.id && actor.role === 'student') {
      return { nextDb: db, result: { ok: false, message: 'You cannot accept another user’s availability offer.' } };
    }
    if (offer.status !== 'active') {
      return { nextDb: db, result: { ok: false, message: `Offer is already ${offer.status}.` } };
    }

    const equipment = db.equipment.find((e) => e.id === offer.equipmentId);
    const unit = db.physicalUnits.find((u) => u.id === offer.unitId);
    if (!equipment || !unit) {
      return { nextDb: db, result: { ok: false, message: 'Equipment or unit no longer exists.' } };
    }

    // Revalidate safety, operating hours, maintenance, and unit overlap before scheduler allocates!
    const constraint = schedulingService.validateBookingConstraints(db, {
      userId: offer.userId,
      equipment,
      date: offer.date,
      startHour: offer.startHour,
      endHour: offer.endHour,
    });
    if (!constraint.ok) {
      return { nextDb: db, result: { ok: false, message: constraint.reason! } };
    }

    const bookable = schedulingService.isUnitBookableForSlot(
      db,
      unit,
      offer.date,
      offer.startHour,
      offer.endHour
    );
    if (!bookable.ok) {
      const expiredOffers = db.availabilityOffers.map((o) =>
        o.id === offerId ? { ...o, status: 'expired' as const } : o
      );
      return {
        nextDb: { ...db, availabilityOffers: expiredOffers },
        result: { ok: false, message: `Revalidation failed: ${bookable.reason}` },
      };
    }

    const waitEntry = db.waitingList.find((w) => w.id === offer.waitingListEntryId);
    const priority = schedulingService.computePriorityBreakdown(db, {
      userId: offer.userId,
      equipmentId: offer.equipmentId,
      projectId: waitEntry?.projectId ?? null,
      startHour: offer.startHour,
      endHour: offer.endHour,
      urgencyLevel: 'high',
      projectDependencyLevel: 'blocking',
    });

    const bookingId = createUniqueId('bk');
    const newBooking = {
      id: bookingId,
      userId: offer.userId,
      projectId: waitEntry?.projectId ?? null,
      equipmentId: offer.equipmentId,
      preferredUnitId: unit.id,
      allocatedUnitId: unit.id,
      laboratoryId: equipment.laboratoryId,
      departmentId: equipment.departmentId,
      date: offer.date,
      startHour: offer.startHour,
      endHour: offer.endHour,
      purpose: 'Allocated from accepted Smart Waiting List offer.',
      urgencyLevel: 'high' as const,
      projectDependencyLevel: 'blocking' as const,
      status: 'approved' as const,
      priority,
      decisionReason: `Accepted waiting-list offer ${offer.id}; scheduler revalidated ${unit.unitCode} availability.`,
      createdAt: new Date().toISOString(),
    };

    const newAllocation = {
      id: createUniqueId('alloc'),
      bookingId,
      unitId: unit.id,
      equipmentId: equipment.id,
      laboratoryId: equipment.laboratoryId,
      userId: offer.userId,
      date: offer.date,
      startHour: offer.startHour,
      endHour: offer.endHour,
      createdAt: new Date().toISOString(),
    };

    const nextUnits = db.physicalUnits.map((u) =>
      u.id === unit.id && u.status === 'available'
        ? { ...u, status: 'booked' as const, assignedToBookingId: bookingId }
        : u
    );

    const nextDb: AppDatabase = {
      ...db,
      physicalUnits: nextUnits,
      bookingRequests: [newBooking, ...db.bookingRequests],
      confirmedAllocations: [newAllocation, ...db.confirmedAllocations],
      availabilityOffers: db.availabilityOffers.map((o) =>
        o.id === offerId ? { ...o, status: 'accepted' as const } : o
      ),
      waitingList: db.waitingList.map((w) =>
        w.id === offer.waitingListEntryId ? { ...w, status: 'fulfilled' as const } : w
      ),
      auditLogs: appendAuditLog(
        db,
        actor,
        'WAITING_OFFER_ACCEPTED',
        bookingId,
        `Accepted offer ${offerId}; allocated ${unit.unitCode} on ${offer.date}.`
      ),
      notifications: appendNotification(
        db,
        offer.userId,
        'booking',
        'Waiting List Allocation Confirmed',
        `${unit.unitCode} (${equipment.name}) is now confirmed for ${offer.date} (${offer.startHour}:00–${offer.endHour}:00).`,
        'my-bookings'
      ),
    };

    return {
      nextDb,
      result: {
        ok: true,
        message: `Offer accepted and validated! Confirmed allocation on ${unit.unitCode}.`,
      },
    };
  },

  declineOffer(
    db: AppDatabase,
    offerId: string
  ): { nextDb: AppDatabase; result: ActionResult } {
    const actor = getCurrentUser(db);
    const offer = db.availabilityOffers.find((o) => o.id === offerId);
    if (!offer) {
      return { nextDb: db, result: { ok: false, message: 'Offer not found.' } };
    }

    let nextDb: AppDatabase = {
      ...db,
      availabilityOffers: db.availabilityOffers.map((o) =>
        o.id === offerId ? { ...o, status: 'declined' as const } : o
      ),
      waitingList: db.waitingList.map((w) =>
        w.id === offer.waitingListEntryId ? { ...w, status: 'expired' as const } : w
      ),
      auditLogs: appendAuditLog(db, actor, 'WAITING_OFFER_DECLINED', offerId, 'Declined availability offer.'),
    };

    // Cascade offer to next candidate on the waiting list
    nextDb = this.triggerOfferForReleasedSlot(nextDb, {
      equipmentId: offer.equipmentId,
      unitId: offer.unitId,
      date: offer.date,
      startHour: offer.startHour,
      endHour: offer.endHour,
    });

    return {
      nextDb,
      result: { ok: true, message: 'Offer declined and slot offered to next waiting student.' },
    };
  },

  recalculateQueueScores(db: AppDatabase): AppDatabase {
    const nextList = db.waitingList
      .map((entry) => {
        if (entry.status !== 'waiting') return entry;
        const { priorityScore, priorityBreakdown } = this.computeWaitingPriority(db, {
          userId: entry.userId,
          equipmentId: entry.equipmentId,
          projectId: entry.projectId,
          createdAt: entry.createdAt,
        });
        return { ...entry, priorityScore, priorityBreakdown };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);

    return { ...db, waitingList: nextList };
  },

  withdrawEntry(
    db: AppDatabase,
    entryId: string
  ): { nextDb: AppDatabase; result: ActionResult } {
    const actor = getCurrentUser(db);
    const entry = db.waitingList.find((w) => w.id === entryId);
    if (!entry) {
      return { nextDb: db, result: { ok: false, message: 'Waiting list entry not found.' } };
    }
    if (entry.userId !== actor.id && actor.role === 'student') {
      return {
        nextDb: db,
        result: { ok: false, message: 'Permission denied: You can only withdraw your own waiting list entries.' },
      };
    }

    const nextDb: AppDatabase = {
      ...db,
      waitingList: db.waitingList.filter((w) => w.id !== entryId),
      availabilityOffers: db.availabilityOffers.map((o) =>
        o.waitingListEntryId === entryId && o.status === 'active'
          ? { ...o, status: 'declined' as const }
          : o
      ),
      auditLogs: appendAuditLog(
        db,
        actor,
        'WAITING_LIST_WITHDRAWN',
        entryId,
        `Withdrew waiting list entry ${entryId}.`
      ),
    };

    return {
      nextDb,
      result: { ok: true, message: 'Removed entry from Smart Waiting List.' },
    };
  },
};
