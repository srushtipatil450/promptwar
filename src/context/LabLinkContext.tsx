import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { storageRepository } from '../repositories/storageRepository';
import { adminService } from '../services/adminService';
import { analyticsService } from '../services/analyticsService';
import { bookingService } from '../services/bookingService';
import { maintenanceService } from '../services/maintenanceService';
import { getCurrentUser } from '../services/permissionService';
import { qrTrackingService } from '../services/qrTrackingService';
import { recommendationService } from '../services/recommendationService';
import { safetyService } from '../services/safetyService';
import { sharingService } from '../services/sharingService';
import { waitingListService } from '../services/waitingListService';
import {
  ActionResult,
  AppDatabase,
  BookingRequest,
  EquipmentCategory,
  FairnessConfig,
  MaintenanceRecord,
  NavViewId,
  SafetyIncident,
  StudentProject,
  UserProfile,
  UserRole,
} from '../types/lablink';

export interface ToastMessage {
  id: string;
  ok: boolean;
  text: string;
}

export interface BookingDraft {
  equipmentId: string;
  preferredUnitId?: string | null;
  projectId?: string | null;
  date?: string;
  startHour?: number;
  endHour?: number;
}

interface LabLinkContextValue {
  db: AppDatabase;
  currentUser: UserProfile;
  activeView: NavViewId;
  setActiveView: (view: NavViewId) => void;
  globalSearch: string;
  setGlobalSearch: (q: string) => void;
  focusedEquipmentId: string | null;
  setFocusedEquipmentId: (id: string | null) => void;
  focusedUnitId: string | null;
  setFocusedUnitId: (id: string | null) => void;
  focusedProjectId: string | null;
  setFocusedProjectId: (id: string | null) => void;
  bookingModalDraft: BookingDraft | null;
  openBookingModal: (draft: BookingDraft) => void;
  closeBookingModal: () => void;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  notifyAction: (res: ActionResult<unknown>) => ActionResult<unknown>;
  unreadNotificationCount: number;

  // Actions wired to central services
  switchUser: (userId: string) => void;
  resetDemoData: () => void;
  createBooking: (payload: {
    equipmentId: string;
    preferredUnitId?: string | null;
    projectId: string | null;
    date: string;
    startHour: number;
    endHour: number;
    purpose: string;
    urgencyLevel: BookingRequest['urgencyLevel'];
    projectDependencyLevel: BookingRequest['projectDependencyLevel'];
  }) => ActionResult<unknown>;
  allocateOrOverrideBooking: (bookingId: string, targetUnitId: string, overrideReason?: string) => ActionResult<unknown>;
  cancelBooking: (bookingId: string, reason?: string) => ActionResult<unknown>;
  joinWaitingList: (payload: {
    equipmentId: string;
    projectId: string | null;
    desiredDate: string;
    startHour: number;
    endHour: number;
  }) => ActionResult<unknown>;
  acceptOffer: (offerId: string) => ActionResult<unknown>;
  declineOffer: (offerId: string) => ActionResult<unknown>;
  withdrawWaitingListEntry: (entryId: string) => ActionResult<unknown>;
  submitSharingRequest: (payload: {
    equipmentId: string;
    requestedDate: string;
    startHour: number;
    endHour: number;
    projectId: string | null;
    justification: string;
  }) => ActionResult<unknown>;
  approveSharingRequest: (requestId: string, notes: string) => ActionResult<unknown>;
  rejectSharingRequest: (requestId: string, notes: string) => ActionResult<unknown>;
  saveProjectPlan: (payload: {
    title: string;
    category: EquipmentCategory;
    description: string;
    deadline: string;
    departmentId: string;
    complexity: StudentProject['complexity'];
    requiredEquipmentIds: string[];
  }) => ActionResult<StudentProject>;
  attachSetupToProject: (projectId: string, equipmentIds: string[]) => ActionResult<unknown>;
  swapProjectEquipment: (
    projectId: string,
    removeEquipmentId: string,
    addEquipmentId: string
  ) => ActionResult<unknown>;
  submitTrainingQuiz: (moduleId: string, answers: Record<string, number>) => ActionResult<unknown>;
  verifyCertification: (recordId: string) => ActionResult<unknown>;
  reportSafetyIncident: (payload: {
    laboratoryId: string;
    unitId: string | null;
    severity: SafetyIncident['severity'];
    title: string;
    description: string;
  }) => ActionResult<unknown>;
  reviewSafetyIncident: (incidentId: string, status: SafetyIncident['status'], notes: string) => ActionResult<unknown>;
  reportMaintenanceIssue: (payload: {
    unitId: string;
    issueTitle: string;
    description: string;
    severity: MaintenanceRecord['severity'];
  }) => ActionResult<unknown>;
  updateMaintenanceProgress: (
    recordId: string,
    status: 'in_progress' | 'awaiting_inspection',
    notes?: string
  ) => ActionResult<unknown>;
  approveReturnToService: (recordId: string, inspectionNotes: string) => ActionResult<unknown>;
  qrCheckOut: (unitId: string, conditionNote: string) => ActionResult<unknown>;
  qrReturnUnit: (unitId: string, sessionHours: number, conditionNote: string) => ActionResult<unknown>;
  updateFairnessWeights: (weights: FairnessConfig['schedulingWeights']) => ActionResult<unknown>;
  updateUserRole: (userId: string, role: UserRole) => ActionResult<unknown>;
  addPhysicalUnit: (payload: {
    equipmentId: string;
    unitCode: string;
    serialNumber: string;
    notes: string;
  }) => ActionResult<unknown>;
  addEquipmentItem: (payload: {
    name: string;
    model: string;
    manufacturer: string;
    category: EquipmentCategory;
    laboratoryId: string;
    description: string;
    initialUnitCode: string;
    serialNumber: string;
  }) => ActionResult<unknown>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

const LabLinkContext = createContext<LabLinkContextValue | null>(null);

export const LabLinkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<AppDatabase>(() => {
    const { db: loaded } = storageRepository.load();
    return loaded;
  });

  const [activeView, setActiveView] = useState<NavViewId>('overview');
  const [globalSearch, setGlobalSearch] = useState('');
  const [focusedEquipmentId, setFocusedEquipmentId] = useState<string | null>(null);
  const [focusedUnitId, setFocusedUnitId] = useState<string | null>(null);
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);
  const [bookingModalDraft, setBookingModalDraft] = useState<BookingDraft | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const persistDb = useCallback((next: AppDatabase) => {
    setDb(next);
    storageRepository.save(next);
  }, []);

  const pushToast = useCallback((ok: boolean, text: string) => {
    const id = `tst-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setToasts((prev) => [...prev.slice(-3), { id, ok, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notifyAction = useCallback(
    <T,>(res: ActionResult<T>): ActionResult<T> => {
      pushToast(res.ok, res.message);
      return res;
    },
    [pushToast]
  );

  const currentUser = useMemo(() => getCurrentUser(db), [db]);

  const unreadNotificationCount = useMemo(
    () =>
      db.notifications.filter(
        (n) => !n.read && (n.recipientUserId === currentUser.id || n.recipientUserId === 'all')
      ).length,
    [db.notifications, currentUser.id]
  );

  const openBookingModal = useCallback((draft: BookingDraft) => {
    setBookingModalDraft(draft);
  }, []);

  const closeBookingModal = useCallback(() => {
    setBookingModalDraft(null);
  }, []);

  const switchUser = useCallback(
    (userId: string) => {
      const next = adminService.switchActiveUser(db, userId);
      persistDb(next);
      const u = getCurrentUser(next);
      pushToast(true, `Switched active session to ${u.name} (${u.role.replace('_', ' ')}).`);
    },
    [db, persistDb, pushToast]
  );

  const resetDemoData = useCallback(() => {
    const fresh = storageRepository.resetToDemo();
    setDb(fresh);
    pushToast(true, 'Campus laboratory database reset to initial demo seed.');
  }, [pushToast]);

  const createBooking = useCallback(
    (payload: Parameters<LabLinkContextValue['createBooking']>[0]) => {
      const { nextDb, result } = bookingService.createBookingRequest(db, payload);
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const allocateOrOverrideBooking = useCallback(
    (bookingId: string, targetUnitId: string, overrideReason?: string) => {
      const { nextDb, result } = bookingService.allocateOrOverrideBooking(db, {
        bookingId,
        targetUnitId,
        overrideReason,
      });
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const cancelBooking = useCallback(
    (bookingId: string, reason?: string) => {
      const { nextDb, result } = bookingService.cancelBooking(db, bookingId, reason);
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const joinWaitingList = useCallback(
    (payload: Parameters<LabLinkContextValue['joinWaitingList']>[0]) => {
      const { nextDb, result } = waitingListService.joinWaitingList(db, payload);
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const acceptOffer = useCallback(
    (offerId: string) => {
      const { nextDb, result } = waitingListService.acceptOffer(db, offerId);
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const declineOffer = useCallback(
    (offerId: string) => {
      const { nextDb, result } = waitingListService.declineOffer(db, offerId);
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const withdrawWaitingListEntry = useCallback(
    (entryId: string) => {
      const { nextDb, result } = waitingListService.withdrawEntry(db, entryId);
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const submitSharingRequest = useCallback(
    (payload: Parameters<LabLinkContextValue['submitSharingRequest']>[0]) => {
      const { nextDb, result } = sharingService.submitSharingRequest(db, payload);
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const approveSharingRequest = useCallback(
    (requestId: string, notes: string) => {
      const { nextDb, result } = sharingService.approveSharingRequest(db, requestId, notes);
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const rejectSharingRequest = useCallback(
    (requestId: string, notes: string) => {
      const { nextDb, result } = sharingService.rejectSharingRequest(db, requestId, notes);
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const saveProjectPlan = useCallback(
    (payload: Parameters<LabLinkContextValue['saveProjectPlan']>[0]) => {
      const { nextDb, result } = recommendationService.saveProjectPlan(db, payload);
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const attachSetupToProject = useCallback(
    (projectId: string, equipmentIds: string[]) => {
      const { nextDb, result } = adminService.attachCompatibilitySetupToProject(
        db,
        projectId,
        equipmentIds
      );
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const swapProjectEquipment = useCallback(
    (projectId: string, removeEquipmentId: string, addEquipmentId: string) => {
      const { nextDb, result } = adminService.swapProjectEquipment(
        db,
        projectId,
        removeEquipmentId,
        addEquipmentId
      );
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const submitTrainingQuiz = useCallback(
    (moduleId: string, answers: Record<string, number>) => {
      const { nextDb, result } = safetyService.submitTrainingQuiz(db, moduleId, answers);
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const verifyCertification = useCallback(
    (recordId: string) => {
      const { nextDb, result } = safetyService.verifyStudentCertification(db, recordId);
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const reportSafetyIncident = useCallback(
    (payload: Parameters<LabLinkContextValue['reportSafetyIncident']>[0]) => {
      const { nextDb, result } = safetyService.reportIncident(db, payload);
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const reviewSafetyIncident = useCallback(
    (incidentId: string, status: SafetyIncident['status'], notes: string) => {
      const { nextDb, result } = safetyService.reviewIncident(db, incidentId, status, notes);
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const reportMaintenanceIssue = useCallback(
    (payload: Parameters<LabLinkContextValue['reportMaintenanceIssue']>[0]) => {
      const { nextDb, result } = maintenanceService.reportIssue(db, payload);
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const updateMaintenanceProgress = useCallback(
    (recordId: string, status: 'in_progress' | 'awaiting_inspection', notes?: string) => {
      const { nextDb, result } = maintenanceService.updateRepairProgress(
        db,
        recordId,
        status,
        notes
      );
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const approveReturnToService = useCallback(
    (recordId: string, inspectionNotes: string) => {
      const { nextDb, result } = maintenanceService.approveReturnToService(
        db,
        recordId,
        inspectionNotes
      );
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const qrCheckOut = useCallback(
    (unitId: string, conditionNote: string) => {
      const { nextDb, result } = qrTrackingService.checkOutUnit(db, { unitId, conditionNote });
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const qrReturnUnit = useCallback(
    (unitId: string, sessionHours: number, conditionNote: string) => {
      const { nextDb, result } = qrTrackingService.returnUnit(db, {
        unitId,
        sessionHours,
        conditionNote,
      });
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const updateFairnessWeights = useCallback(
    (weights: FairnessConfig['schedulingWeights']) => {
      const { nextDb, result } = analyticsService.updateFairnessWeights(db, weights);
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const updateUserRole = useCallback(
    (userId: string, role: UserRole) => {
      const { nextDb, result } = adminService.updateUserRole(db, userId, role);
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const addPhysicalUnit = useCallback(
    (payload: Parameters<LabLinkContextValue['addPhysicalUnit']>[0]) => {
      const { nextDb, result } = adminService.addPhysicalUnit(db, payload);
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const addEquipmentItem = useCallback(
    (payload: Parameters<LabLinkContextValue['addEquipmentItem']>[0]) => {
      const { nextDb, result } = adminService.addEquipmentCatalogItem(db, payload);
      if (nextDb !== db) persistDb(nextDb);
      pushToast(result.ok, result.message);
      return result;
    },
    [db, persistDb, pushToast]
  );

  const markNotificationRead = useCallback(
    (id: string) => {
      persistDb(adminService.markNotificationRead(db, id));
    },
    [db, persistDb]
  );

  const markAllNotificationsRead = useCallback(() => {
    persistDb(adminService.markAllNotificationsRead(db));
  }, [db, persistDb]);

  return (
    <LabLinkContext.Provider
      value={{
        db,
        currentUser,
        activeView,
        setActiveView,
        globalSearch,
        setGlobalSearch,
        focusedEquipmentId,
        setFocusedEquipmentId,
        focusedUnitId,
        setFocusedUnitId,
        focusedProjectId,
        setFocusedProjectId,
        bookingModalDraft,
        openBookingModal,
        closeBookingModal,
        toasts,
        dismissToast,
        notifyAction,
        unreadNotificationCount,
        switchUser,
        resetDemoData,
        createBooking,
        allocateOrOverrideBooking,
        cancelBooking,
        joinWaitingList,
        acceptOffer,
        declineOffer,
        withdrawWaitingListEntry,
        submitSharingRequest,
        approveSharingRequest,
        rejectSharingRequest,
        saveProjectPlan,
        attachSetupToProject,
        swapProjectEquipment,
        submitTrainingQuiz,
        verifyCertification,
        reportSafetyIncident,
        reviewSafetyIncident,
        reportMaintenanceIssue,
        updateMaintenanceProgress,
        approveReturnToService,
        qrCheckOut,
        qrReturnUnit,
        updateFairnessWeights,
        updateUserRole,
        addPhysicalUnit,
        addEquipmentItem,
        markNotificationRead,
        markAllNotificationsRead,
      }}
    >
      {children}
    </LabLinkContext.Provider>
  );
};

export function useLabLink(): LabLinkContextValue {
  const ctx = useContext(LabLinkContext);
  if (!ctx) throw new Error('useLabLink must be used inside LabLinkProvider');
  return ctx;
}
