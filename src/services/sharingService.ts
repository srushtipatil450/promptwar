import { ActionResult, AppDatabase, CrossDeptSharingRequest } from '../types/lablink';
import { bookingService } from './bookingService';
import {
  appendAuditLog,
  appendNotification,
  createUniqueId,
  getCurrentUser,
  requireLabAdmin,
} from './permissionService';

export const sharingService = {
  submitSharingRequest(
    db: AppDatabase,
    payload: {
      equipmentId: string;
      requestedDate: string;
      startHour: number;
      endHour: number;
      projectId: string | null;
      justification: string;
    }
  ): { nextDb: AppDatabase; result: ActionResult<CrossDeptSharingRequest> } {
    const actor = getCurrentUser(db);
    const equipment = db.equipment.find((e) => e.id === payload.equipmentId);
    if (!equipment) {
      return { nextDb: db, result: { ok: false, message: 'Equipment item not found.' } };
    }
    if (!payload.justification.trim()) {
      return { nextDb: db, result: { ok: false, message: 'Project justification is required.' } };
    }
    if (payload.startHour >= payload.endHour) {
      return { nextDb: db, result: { ok: false, message: 'End hour must be after start hour.' } };
    }

    const req: CrossDeptSharingRequest = {
      id: createUniqueId('shr'),
      requesterId: actor.id,
      requesterDeptId: actor.departmentId,
      hostDeptId: equipment.departmentId,
      laboratoryId: equipment.laboratoryId,
      equipmentId: equipment.id,
      requestedDate: payload.requestedDate,
      startHour: payload.startHour,
      endHour: payload.endHour,
      projectId: payload.projectId,
      justification: payload.justification.trim(),
      status: 'pending_approval',
      createdAt: new Date().toISOString(),
    };

    const lab = db.laboratories.find((l) => l.id === equipment.laboratoryId);
    const nextDb: AppDatabase = {
      ...db,
      sharingRequests: [req, ...db.sharingRequests],
      auditLogs: appendAuditLog(
        db,
        actor,
        'CROSS_DEPT_REQUESTED',
        req.id,
        `Requested cross-department access for ${equipment.name} on ${payload.requestedDate}.`
      ),
      notifications: appendNotification(
        db,
        lab?.leadAdminId ?? 'usr-admin-elena',
        'sharing',
        'Cross-Department Resource Request',
        `${actor.name} requested ${equipment.name} (${lab?.code ?? ''}) for ${payload.requestedDate}.`,
        'cross-dept-sharing'
      ),
    };

    return {
      nextDb,
      result: {
        ok: true,
        message: 'Cross-department request submitted for host Lab Administrator approval.',
        data: req,
      },
    };
  },

  approveSharingRequest(
    db: AppDatabase,
    requestId: string,
    reviewNotes: string
  ): { nextDb: AppDatabase; result: ActionResult } {
    const actor = getCurrentUser(db);
    const req = db.sharingRequests.find((r) => r.id === requestId);
    if (!req) {
      return { nextDb: db, result: { ok: false, message: 'Sharing request not found.' } };
    }

    const perm = requireLabAdmin(actor, req.laboratoryId, 'approve cross-department sharing requests');
    if (!perm.allowed) {
      return { nextDb: db, result: { ok: false, message: perm.reason! } };
    }

    if (req.status !== 'pending_approval') {
      return { nextDb: db, result: { ok: false, message: `Request already ${req.status}.` } };
    }

    // Revalidate availability and route directly through the common bookingService / scheduler
    const bookingAttempt = bookingService.createBookingRequest(db, {
      userId: req.requesterId,
      equipmentId: req.equipmentId,
      projectId: req.projectId,
      date: req.requestedDate,
      startHour: req.startHour,
      endHour: req.endHour,
      purpose: `[Cross-Dept Share ${req.id}] ${req.justification}`,
      urgencyLevel: 'high',
      projectDependencyLevel: 'supporting',
      crossDeptApproved: true,
      crossDeptRequestId: req.id,
    });

    if (!bookingAttempt.result.ok || !bookingAttempt.result.data) {
      return {
        nextDb: db,
        result: {
          ok: false,
          message: `Approved permission check, but scheduler revalidation failed: ${bookingAttempt.result.message}`,
        },
      };
    }

    const linkedBooking = bookingAttempt.result.data;
    const nextSharing = bookingAttempt.nextDb.sharingRequests.map((r) =>
      r.id === requestId
        ? {
            ...r,
            status: (linkedBooking.status === 'approved' ? 'scheduled' : 'approved') as CrossDeptSharingRequest['status'],
            reviewedByAdminId: actor.id,
            reviewNotes: reviewNotes.trim() || 'Approved and revalidated by host lab.',
            linkedBookingId: linkedBooking.id,
          }
        : r
    );

    const nextDb: AppDatabase = {
      ...bookingAttempt.nextDb,
      sharingRequests: nextSharing,
      auditLogs: appendAuditLog(
        bookingAttempt.nextDb,
        actor,
        'CROSS_DEPT_APPROVED',
        requestId,
        `Approved sharing request ${requestId} -> linked booking ${linkedBooking.id} (${linkedBooking.status}).`
      ),
    };

    return {
      nextDb,
      result: {
        ok: true,
        message:
          linkedBooking.status === 'approved'
            ? `Cross-department request approved and unit allocated (${linkedBooking.allocatedUnitId}).`
            : 'Cross-department request approved and queued in Smart Scheduling.',
      },
    };
  },

  rejectSharingRequest(
    db: AppDatabase,
    requestId: string,
    reviewNotes: string
  ): { nextDb: AppDatabase; result: ActionResult } {
    const actor = getCurrentUser(db);
    const req = db.sharingRequests.find((r) => r.id === requestId);
    if (!req) {
      return { nextDb: db, result: { ok: false, message: 'Sharing request not found.' } };
    }

    const perm = requireLabAdmin(actor, req.laboratoryId, 'reject cross-department sharing requests');
    if (!perm.allowed) {
      return { nextDb: db, result: { ok: false, message: perm.reason! } };
    }

    const nextSharing = db.sharingRequests.map((r) =>
      r.id === requestId
        ? {
            ...r,
            status: 'rejected' as const,
            reviewedByAdminId: actor.id,
            reviewNotes: reviewNotes.trim() || 'Declined by host laboratory administrator.',
          }
        : r
    );

    const nextDb: AppDatabase = {
      ...db,
      sharingRequests: nextSharing,
      auditLogs: appendAuditLog(
        db,
        actor,
        'CROSS_DEPT_REJECTED',
        requestId,
        `Rejected sharing request ${requestId}: ${reviewNotes || 'No notes'}`
      ),
      notifications: appendNotification(
        db,
        req.requesterId,
        'sharing',
        'Cross-Department Request Declined',
        `Your request ${req.id} was declined: ${reviewNotes.trim() || 'See department guidelines.'}`,
        'cross-dept-sharing'
      ),
    };

    return { nextDb, result: { ok: true, message: 'Cross-department request rejected.' } };
  },
};
