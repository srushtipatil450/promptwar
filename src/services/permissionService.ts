import { AppDatabase, AuditLogEntry, LabNotification, NavViewId, UserProfile } from '../types/lablink';

let idCounter = 0;

export function createUniqueId(prefix: string): string {
  idCounter = (idCounter + 1) % 1000000;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

export function getCurrentUser(db: AppDatabase): UserProfile {
  return db.users.find((u) => u.id === db.currentUserId) ?? db.users[0];
}

export function canManageLab(user: UserProfile, laboratoryId: string): boolean {
  if (user.role === 'system_admin') return true;
  if (user.role === 'lab_admin') {
    return user.assignedLabIds.includes(laboratoryId);
  }
  return false;
}

export function requireLabAdmin(
  user: UserProfile,
  laboratoryId: string,
  actionLabel: string
): { allowed: boolean; reason?: string } {
  if (canManageLab(user, laboratoryId)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `Permission denied: ${user.name} (${user.role}) is not authorised to ${actionLabel} for laboratory ${laboratoryId}.`,
  };
}

export function requireSystemAdmin(
  user: UserProfile,
  actionLabel: string
): { allowed: boolean; reason?: string } {
  if (user.role === 'system_admin') {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `Permission denied: Only System Administrators can ${actionLabel}.`,
  };
}

export function appendAuditLog(
  db: AppDatabase,
  actor: UserProfile,
  actionType: string,
  targetEntity: string,
  details: string
): AuditLogEntry[] {
  const entry: AuditLogEntry = {
    id: createUniqueId('aud'),
    actorUserId: actor.id,
    actorRole: actor.role,
    actionType,
    targetEntity,
    details,
    timestamp: new Date().toISOString(),
  };
  return [entry, ...db.auditLogs];
}

export function appendNotification(
  db: AppDatabase,
  recipientUserId: string | 'all',
  category: LabNotification['category'],
  title: string,
  message: string,
  targetView?: NavViewId
): LabNotification[] {
  const item: LabNotification = {
    id: createUniqueId('ntf'),
    recipientUserId,
    category,
    title,
    message,
    read: false,
    createdAt: new Date().toISOString(),
    targetView,
  };
  return [item, ...db.notifications];
}
