import { ActionResult, AppDatabase, EquipmentCategory, PhysicalUnit, UserRole } from '../types/lablink';
import {
  appendAuditLog,
  createUniqueId,
  getCurrentUser,
  requireLabAdmin,
  requireSystemAdmin,
} from './permissionService';

export const adminService = {
  switchActiveUser(db: AppDatabase, userId: string): AppDatabase {
    const exists = db.users.some((u) => u.id === userId);
    if (!exists) return db;
    return { ...db, currentUserId: userId };
  },

  updateUserRole(
    db: AppDatabase,
    targetUserId: string,
    newRole: UserRole
  ): { nextDb: AppDatabase; result: ActionResult } {
    const actor = getCurrentUser(db);
    const perm = requireSystemAdmin(actor, 'modify user roles');
    if (!perm.allowed) {
      return { nextDb: db, result: { ok: false, message: perm.reason! } };
    }

    const target = db.users.find((u) => u.id === targetUserId);
    if (!target) {
      return { nextDb: db, result: { ok: false, message: 'User not found.' } };
    }

    const nextUsers = db.users.map((u) =>
      u.id === targetUserId
        ? {
            ...u,
            role: newRole,
            assignedLabIds:
              newRole === 'system_admin'
                ? db.laboratories.map((l) => l.id)
                : newRole === 'lab_admin' && u.assignedLabIds.length === 0
                  ? [db.laboratories[0].id]
                  : newRole === 'student'
                    ? []
                    : u.assignedLabIds,
          }
        : u
    );

    const nextDb: AppDatabase = {
      ...db,
      users: nextUsers,
      auditLogs: appendAuditLog(
        db,
        actor,
        'USER_ROLE_CHANGED',
        targetUserId,
        `Changed ${target.name} role from ${target.role} to ${newRole}.`
      ),
    };

    return {
      nextDb,
      result: { ok: true, message: `Updated ${target.name}'s role to ${newRole.replace('_', ' ')}.` },
    };
  },

  addPhysicalUnit(
    db: AppDatabase,
    payload: {
      equipmentId: string;
      unitCode: string;
      serialNumber: string;
      notes: string;
    }
  ): { nextDb: AppDatabase; result: ActionResult<PhysicalUnit> } {
    const actor = getCurrentUser(db);
    const equipment = db.equipment.find((e) => e.id === payload.equipmentId);
    if (!equipment) {
      return { nextDb: db, result: { ok: false, message: 'Equipment catalog item not found.' } };
    }

    const perm = requireLabAdmin(actor, equipment.laboratoryId, 'register new physical equipment units');
    if (!perm.allowed) {
      return { nextDb: db, result: { ok: false, message: perm.reason! } };
    }

    const cleanCode = payload.unitCode.trim().toUpperCase();
    if (!cleanCode || !payload.serialNumber.trim()) {
      return { nextDb: db, result: { ok: false, message: 'Unit code and serial number are required.' } };
    }

    if (db.physicalUnits.some((u) => u.unitCode.toUpperCase() === cleanCode)) {
      return { nextDb: db, result: { ok: false, message: `Unit code ${cleanCode} already exists.` } };
    }

    const lab = db.laboratories.find((l) => l.id === equipment.laboratoryId);
    const newUnit: PhysicalUnit = {
      id: createUniqueId(`unit-${cleanCode.toLowerCase()}`),
      unitCode: cleanCode,
      equipmentId: equipment.id,
      laboratoryId: equipment.laboratoryId,
      serialNumber: payload.serialNumber.trim(),
      qrPayload: `LABLINK:UNIT:${cleanCode}:${lab?.code ?? equipment.laboratoryId}`,
      status: 'available',
      conditionScore: 100,
      measuredUsageHours: 0,
      lastCalibrationDate: '2026-11-23',
      nextInspectionDue: '2027-05-23',
      assignedToBookingId: null,
      notes: payload.notes.trim() || 'Newly commissioned physical unit.',
    };

    const nextDb: AppDatabase = {
      ...db,
      physicalUnits: [newUnit, ...db.physicalUnits],
      auditLogs: appendAuditLog(
        db,
        actor,
        'UNIT_COMMISSIONED',
        newUnit.id,
        `Registered physical unit ${cleanCode} (${equipment.name}) in ${lab?.code ?? equipment.laboratoryId}.`
      ),
    };

    return {
      nextDb,
      result: { ok: true, message: `Physical unit ${cleanCode} added to inventory.`, data: newUnit },
    };
  },

  addEquipmentCatalogItem(
    db: AppDatabase,
    payload: {
      name: string;
      model: string;
      manufacturer: string;
      category: EquipmentCategory;
      laboratoryId: string;
      description: string;
      initialUnitCode: string;
      serialNumber: string;
    }
  ): { nextDb: AppDatabase; result: ActionResult } {
    const actor = getCurrentUser(db);
    const perm = requireLabAdmin(actor, payload.laboratoryId, 'add equipment catalog items');
    if (!perm.allowed) {
      return { nextDb: db, result: { ok: false, message: perm.reason! } };
    }

    const lab = db.laboratories.find((l) => l.id === payload.laboratoryId);
    if (!lab) {
      return { nextDb: db, result: { ok: false, message: 'Laboratory not found.' } };
    }

    if (!payload.name.trim() || !payload.initialUnitCode.trim()) {
      return { nextDb: db, result: { ok: false, message: 'Equipment name and initial unit code are required.' } };
    }

    const eqId = createUniqueId('eq');
    const newItem = {
      id: eqId,
      name: payload.name.trim(),
      model: payload.model.trim() || 'Standard Bench Model',
      manufacturer: payload.manufacturer.trim() || 'Campus Spec',
      category: payload.category,
      laboratoryId: lab.id,
      departmentId: lab.departmentId,
      description: payload.description.trim() || 'Newly registered laboratory instrument.',
      specs: {
        powerRequirements: '120W AC',
        voltage: '120V AC',
        interfaceType: 'USB / Ethernet',
        footprint: 'Benchtop',
        precision: 'Calibrated Lab Grade',
      },
      safetyTier: lab.safetyTier,
      requiredCertificationId: null,
      requiresCrossDeptApproval: lab.safetyTier !== 'standard',
      keywords: payload.name.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
      maxBookingHours: 4,
      hourlyDemandBaseline: 6,
    };

    const cleanCode = payload.initialUnitCode.trim().toUpperCase();
    const newUnit: PhysicalUnit = {
      id: createUniqueId(`unit-${cleanCode.toLowerCase()}`),
      unitCode: cleanCode,
      equipmentId: eqId,
      laboratoryId: lab.id,
      serialNumber: payload.serialNumber.trim() || createUniqueId('SN'),
      qrPayload: `LABLINK:UNIT:${cleanCode}:${lab.code}`,
      status: 'available',
      conditionScore: 100,
      measuredUsageHours: 0,
      lastCalibrationDate: '2026-11-23',
      nextInspectionDue: '2027-05-23',
      assignedToBookingId: null,
      notes: 'Initial unit commissioned with catalog item.',
    };

    const nextDb: AppDatabase = {
      ...db,
      equipment: [newItem, ...db.equipment],
      physicalUnits: [newUnit, ...db.physicalUnits],
      auditLogs: appendAuditLog(
        db,
        actor,
        'EQUIPMENT_ADDED',
        eqId,
        `Added ${newItem.name} with unit ${cleanCode} to ${lab.code}.`
      ),
    };

    return {
      nextDb,
      result: { ok: true, message: `Added ${newItem.name} (${cleanCode}) to shared inventory.` },
    };
  },

  markNotificationRead(db: AppDatabase, notificationId: string): AppDatabase {
    return {
      ...db,
      notifications: db.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      ),
    };
  },

  markAllNotificationsRead(db: AppDatabase): AppDatabase {
    const actor = getCurrentUser(db);
    return {
      ...db,
      notifications: db.notifications.map((n) =>
        n.recipientUserId === actor.id || n.recipientUserId === 'all' ? { ...n, read: true } : n
      ),
    };
  },

  attachCompatibilitySetupToProject(
    db: AppDatabase,
    projectId: string,
    equipmentIds: string[]
  ): { nextDb: AppDatabase; result: ActionResult } {
    const actor = getCurrentUser(db);
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) {
      return { nextDb: db, result: { ok: false, message: 'Project not found.' } };
    }
    if (project.ownerId !== actor.id && actor.role === 'student') {
      return { nextDb: db, result: { ok: false, message: 'You can only update your own project plans.' } };
    }

    const merged = Array.from(new Set([...project.requiredEquipmentIds, ...equipmentIds]));
    const nextDb: AppDatabase = {
      ...db,
      projects: db.projects.map((p) =>
        p.id === projectId ? { ...p, requiredEquipmentIds: merged } : p
      ),
      auditLogs: appendAuditLog(
        db,
        actor,
        'PROJECT_EQUIPMENT_UPDATED',
        projectId,
        `Attached ${equipmentIds.length} compatible instrument(s) to "${project.title}".`
      ),
    };

    return {
      nextDb,
      result: { ok: true, message: `Saved compatible equipment setup to "${project.title}".` },
    };
  },

  swapProjectEquipment(
    db: AppDatabase,
    projectId: string,
    removeEquipmentId: string,
    addEquipmentId: string
  ): { nextDb: AppDatabase; result: ActionResult } {
    const actor = getCurrentUser(db);
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) {
      return { nextDb: db, result: { ok: false, message: 'Project not found.' } };
    }
    if (project.ownerId !== actor.id && actor.role === 'student') {
      return { nextDb: db, result: { ok: false, message: 'You can only modify your own project plans.' } };
    }

    const oldEq = db.equipment.find((e) => e.id === removeEquipmentId);
    const newEq = db.equipment.find((e) => e.id === addEquipmentId);
    if (!newEq) {
      return { nextDb: db, result: { ok: false, message: 'Replacement equipment not found.' } };
    }

    const replaced = project.requiredEquipmentIds.filter((id) => id !== removeEquipmentId);
    if (!replaced.includes(addEquipmentId)) {
      replaced.push(addEquipmentId);
    }
    const nextSavedAlts = Array.from(new Set([...project.savedAlternativeIds, addEquipmentId]));

    const nextDb: AppDatabase = {
      ...db,
      projects: db.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              requiredEquipmentIds: replaced,
              savedAlternativeIds: nextSavedAlts,
            }
          : p
      ),
      auditLogs: appendAuditLog(
        db,
        actor,
        'PROJECT_EQUIPMENT_SWAPPED',
        projectId,
        `Rescued project "${project.title}": swapped ${oldEq?.name ?? removeEquipmentId} -> ${newEq.name}.`
      ),
    };

    return {
      nextDb,
      result: {
        ok: true,
        message: `Updated "${project.title}": replaced ${oldEq?.name ?? 'unavailable item'} with ${newEq.name}.`,
      },
    };
  },
};
