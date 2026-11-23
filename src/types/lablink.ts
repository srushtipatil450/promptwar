export type UserRole = 'student' | 'lab_admin' | 'system_admin';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string;
  assignedLabIds: string[]; // For lab_admin
  studentId?: string;
  year?: string;
  avatarInitials: string;
  previousUsageHours: number;
  recentBookingCount: number;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  head: string;
  colorHex: string;
}

export interface CampusBuilding {
  id: string;
  code: string;
  name: string;
  zone: string;
  floors: number;
  mapX: number; // Percentage 0-100 on campus map
  mapY: number; // Percentage 0-100 on campus map
  widthPct: number;
  heightPct: number;
}

export interface Laboratory {
  id: string;
  code: string;
  name: string;
  buildingId: string;
  floor: number;
  roomNumber: string;
  departmentId: string;
  leadAdminId: string;
  operatingHours: {
    openHour: number; // 0-23
    closeHour: number; // 0-23
    days: string[];
  };
  safetyTier: 'standard' | 'supervised' | 'restricted';
  requiredTrainingIds: string[];
  capacity: number;
  description: string;
}

export type EquipmentCategory =
  | 'Electronics & Signal'
  | 'Robotics & Automation'
  | 'Fabrication & CNC'
  | 'Bioengineering'
  | 'Materials & Metrology'
  | 'Optics & Thermal';

export interface EquipmentSpecs {
  powerRequirements: string;
  voltage: string;
  interfaceType: string;
  footprint: string;
  precision: string;
  adaptersRequired?: string;
}

export interface EquipmentItem {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  category: EquipmentCategory;
  laboratoryId: string;
  departmentId: string;
  description: string;
  specs: EquipmentSpecs;
  safetyTier: 'standard' | 'supervised' | 'restricted';
  requiredCertificationId: string | null;
  requiresCrossDeptApproval: boolean;
  keywords: string[];
  maxBookingHours: number;
  hourlyDemandBaseline: number; // Historical average weekly hours
}

export type PhysicalUnitStatus =
  | 'available'
  | 'booked'
  | 'checked_out'
  | 'maintenance'
  | 'faulty';

export interface PhysicalUnit {
  id: string;
  unitCode: string; // e.g., OSC-001, OSC-002
  equipmentId: string;
  laboratoryId: string;
  serialNumber: string;
  qrPayload: string;
  status: PhysicalUnitStatus;
  conditionScore: number; // 0-100
  measuredUsageHours: number;
  lastCalibrationDate: string;
  nextInspectionDue: string;
  assignedToBookingId: string | null;
  notes: string;
}

export interface StudentProject {
  id: string;
  title: string;
  ownerId: string;
  departmentId: string;
  category: EquipmentCategory;
  description: string;
  deadline: string; // ISO date YYYY-MM-DD
  complexity: 'low' | 'moderate' | 'high';
  requiredEquipmentIds: string[];
  savedAlternativeIds: string[];
  createdAt: string;
  feasibilityScore?: number;
}

export interface ProjectRecommendation {
  equipmentId: string;
  laboratoryId: string;
  matchScore: number; // 0-100
  matchedKeywords: string[];
  explanation: string;
  availableUnitCount: number;
  totalUnitCount: number;
  requiresCertification: boolean;
  requiresCrossDeptApproval: boolean;
}

export type BookingStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'completed';

export interface PriorityBreakdown {
  totalScore: number;
  deadlineUrgency: number;
  projectDependency: number;
  durationFeasibility: number;
  fairnessScore: number;
  submissionTimeScore: number;
  explanation: string;
}

export interface BookingRequest {
  id: string;
  userId: string;
  projectId: string | null;
  equipmentId: string;
  preferredUnitId: string | null;
  allocatedUnitId: string | null;
  laboratoryId: string;
  departmentId: string;
  date: string; // YYYY-MM-DD
  startHour: number; // e.g. 9
  endHour: number; // e.g. 12
  purpose: string;
  urgencyLevel: 'standard' | 'high' | 'critical';
  projectDependencyLevel: 'optional' | 'supporting' | 'blocking';
  status: BookingStatus;
  priority: PriorityBreakdown;
  decisionReason: string;
  overrideByAdminId?: string;
  overrideReason?: string;
  crossDeptRequestId?: string | null;
  createdAt: string;
}

export interface ConfirmedAllocation {
  id: string;
  bookingId: string;
  unitId: string;
  equipmentId: string;
  laboratoryId: string;
  userId: string;
  date: string;
  startHour: number;
  endHour: number;
  createdAt: string;
}

export type SharingStatus = 'pending_approval' | 'approved' | 'rejected' | 'scheduled';

export interface CrossDeptSharingRequest {
  id: string;
  requesterId: string;
  requesterDeptId: string;
  hostDeptId: string;
  laboratoryId: string;
  equipmentId: string;
  requestedDate: string;
  startHour: number;
  endHour: number;
  projectId: string | null;
  justification: string;
  status: SharingStatus;
  reviewedByAdminId?: string;
  reviewNotes?: string;
  linkedBookingId?: string;
  createdAt: string;
}

export interface WaitingListEntry {
  id: string;
  userId: string;
  equipmentId: string;
  laboratoryId: string;
  projectId: string | null;
  desiredDate: string;
  startHour: number;
  endHour: number;
  priorityScore: number;
  priorityBreakdown: {
    deadlineUrgency: number;
    projectDependency: number;
    previousWaitBoost: number;
    timeWaitingScore: number;
    submissionTimeScore: number;
  };
  status: 'waiting' | 'offered' | 'accepted' | 'expired' | 'fulfilled';
  createdAt: string;
}

export interface AvailabilityOffer {
  id: string;
  waitingListEntryId: string;
  userId: string;
  equipmentId: string;
  unitId: string;
  date: string;
  startHour: number;
  endHour: number;
  expiresAt: string;
  status: 'active' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
}

export interface EquipmentCertification {
  id: string;
  code: string;
  title: string;
  laboratoryId: string;
  requiredModuleId: string;
  validityDays: number;
  requiresAdminSignoff: boolean;
}

export interface SafetyQuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
}

export interface SafetyTrainingModule {
  id: string;
  code: string;
  title: string;
  laboratoryId: string | null;
  estimatedMinutes: number;
  summary: string;
  keyRules: string[];
  questions: SafetyQuizQuestion[];
}

export interface SafetyTrainingRecord {
  id: string;
  userId: string;
  moduleId: string;
  certificationId: string | null;
  quizScore: number | null;
  status: 'not_started' | 'quiz_passed_pending_verification' | 'verified' | 'expired';
  completedAt?: string;
  verifiedByAdminId?: string;
  expiresAt?: string;
}

export interface SafetyIncident {
  id: string;
  reporterId: string;
  laboratoryId: string;
  unitId: string | null;
  severity: 'low' | 'moderate' | 'high';
  title: string;
  description: string;
  status: 'open' | 'under_review' | 'resolved';
  reviewedByAdminId?: string;
  resolutionNotes?: string;
  createdAt: string;
}

export interface EquipmentHealthRecord {
  unitId: string;
  conditionScore: number;
  temperatureStatus: 'nominal' | 'elevated';
  calibrationValid: boolean;
  lastDiagnosticAt: string;
  diagnosticNotes: string;
}

export interface MaintenanceRecord {
  id: string;
  unitId: string;
  equipmentId: string;
  reportedByUserId: string;
  assignedAdminId: string | null;
  issueTitle: string;
  description: string;
  severity: 'minor' | 'major' | 'critical';
  status: 'reported' | 'in_progress' | 'awaiting_inspection' | 'resolved';
  blocksBooking: boolean;
  inspectionApprovedByAdminId?: string;
  inspectionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export type CompatibilityLevel =
  | 'verified'
  | 'conditional'
  | 'uncertain'
  | 'incompatible';

export interface CompatibilityRelationship {
  id: string;
  sourceEquipmentId: string;
  targetEquipmentId: string;
  level: CompatibilityLevel;
  interfaceDetails: string;
  voltageMatch: string;
  adapterRequired: string | null;
  limitations: string;
  verifiedBy: string;
}

export interface QRTrackingEvent {
  id: string;
  unitId: string;
  equipmentId: string;
  userId: string;
  bookingId: string | null;
  action: 'checked_out' | 'returned' | 'inspected' | 'flagged';
  timestamp: string;
  conditionNote: string;
  locationLabel: string;
}

export interface LabNotification {
  id: string;
  recipientUserId: string | 'all';
  category: 'booking' | 'waiting_list' | 'sharing' | 'maintenance' | 'safety' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  targetView?: NavViewId;
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string;
  actorRole: UserRole;
  actionType: string;
  targetEntity: string;
  details: string;
  timestamp: string;
}

export interface FairnessConfig {
  schedulingWeights: {
    deadlineUrgency: number;
    projectDependency: number;
    durationFeasibility: number;
    previousFairness: number;
    submissionTime: number;
  };
  waitingListWeights: {
    deadlineUrgency: number;
    projectDependency: number;
    previousWaitBoost: number;
    timeWaiting: number;
    submissionTime: number;
  };
  fairAccessWeights: {
    deadlineUrgency: number;
    previousUsage: number;
    timeWaiting: number;
    projectDependency: number;
    submissionTime: number;
  };
}

export type NavViewId =
  | 'overview'
  | 'live-pulse'
  | 'project-matcher'
  | 'journey-planner'
  | 'equipment-explorer'
  | 'digital-twin'
  | 'alternative-finder'
  | 'resource-rescue'
  | 'lab-map'
  | 'compatibility-graph'
  | 'feasibility-checker'
  | 'my-bookings'
  | 'smart-scheduling'
  | 'cross-dept-sharing'
  | 'waiting-list'
  | 'predictive-availability'
  | 'idle-resources'
  | 'equipment-tracking'
  | 'equipment-health'
  | 'lab-passport'
  | 'safety-readiness'
  | 'fair-access'
  | 'achievements'
  | 'notifications'
  | 'settings';

export interface AppDatabase {
  schemaVersion: number;
  currentUserId: string;
  users: UserProfile[];
  departments: Department[];
  buildings: CampusBuilding[];
  laboratories: Laboratory[];
  equipment: EquipmentItem[];
  physicalUnits: PhysicalUnit[];
  projects: StudentProject[];
  bookingRequests: BookingRequest[];
  confirmedAllocations: ConfirmedAllocation[];
  sharingRequests: CrossDeptSharingRequest[];
  waitingList: WaitingListEntry[];
  availabilityOffers: AvailabilityOffer[];
  certifications: EquipmentCertification[];
  trainingModules: SafetyTrainingModule[];
  trainingRecords: SafetyTrainingRecord[];
  safetyIncidents: SafetyIncident[];
  healthRecords: EquipmentHealthRecord[];
  maintenanceRecords: MaintenanceRecord[];
  compatibilityEdges: CompatibilityRelationship[];
  qrTrackingHistory: QRTrackingEvent[];
  notifications: LabNotification[];
  auditLogs: AuditLogEntry[];
  fairnessConfig: FairnessConfig;
}

export interface ActionResult<T = void> {
  ok: boolean;
  message: string;
  data?: T;
}
