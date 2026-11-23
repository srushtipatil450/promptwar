import {
  ActionResult,
  AppDatabase,
  CompatibilityLevel,
  CompatibilityRelationship,
  EquipmentCategory,
  EquipmentItem,
  ProjectRecommendation,
  StudentProject,
} from '../types/lablink';
import { appendAuditLog, createUniqueId, getCurrentUser } from './permissionService';
import { safetyService } from './safetyService';
import { schedulingService } from './schedulingService';

export interface AlternativeCandidate {
  equipment: EquipmentItem;
  compatibilityLevel: CompatibilityLevel | 'same_category_unverified';
  confidenceLabel: 'Verified Compatible' | 'Conditional (Adapter/Limit)' | 'Uncertain Compatibility';
  advantages: string[];
  limitations: string[];
  requiredModifications: string;
  availableUnits: number;
  totalUnits: number;
  matchScore: number;
}

export interface FeasibilityReport {
  overallScore: number;
  classification: 'Highly Feasible' | 'Conditionally Feasible' | 'At Risk';
  dimensions: {
    availability: number;
    compatibility: number;
    timelineMargin: number;
    accessAndSafety: number;
    complexityReadiness: number;
  };
  missingResources: string[];
  technicalRisks: string[];
  recommendations: string[];
}

export interface ProjectJourneyEquipmentLink {
  equipmentId: string;
  equipmentName: string;
  laboratoryId: string;
  laboratoryCode: string;
  laboratoryName: string;
  departmentCode: string;
  availableUnits: number;
  totalUnits: number;
  recommendedSessionHours: number;
  requiresCertification: boolean;
  safetyEligible: boolean;
  requiresCrossDeptApproval: boolean;
  compatibilityNote?: string;
}

export interface ProjectJourneyStage {
  stageNumber: number;
  id: string;
  title: string;
  phaseFocus: string;
  estimatedDays: number;
  estimatedLabHours: number;
  startDate: string;
  endDate: string;
  dependsOnStageIds: string[];
  bookingRequirements: string[];
  deliverables: string[];
  equipmentLinks: ProjectJourneyEquipmentLink[];
  readinessStatus: 'ready' | 'action_required' | 'constrained';
}

export interface ProjectJourneyPlan {
  projectTitle: string;
  category: EquipmentCategory;
  deadline: string;
  totalEstimatedDays: number;
  totalLabHours: number;
  complexity: StudentProject['complexity'];
  stages: ProjectJourneyStage[];
  summaryNote: string;
}

export interface RescueAlternativeOption {
  kind: 'verified_substitute' | 'cross_dept_borrow' | 'multi_tool_combination' | 'open_time_slot' | 'plan_adjustment';
  title: string;
  equipmentId: string;
  equipmentName: string;
  secondaryEquipmentId?: string;
  secondaryEquipmentName?: string;
  laboratoryCode: string;
  departmentCode: string;
  recommendedDate: string;
  recommendedStartHour: number;
  recommendedEndHour: number;
  openUnitCode: string | null;
  confidenceLabel: string;
  reason: string;
  tradeoffOrAdapter: string;
  requiresCrossDept: boolean;
  canApplyToProject: boolean;
}

export interface ResourceRescueReport {
  targetEquipmentId: string;
  targetEquipmentName: string;
  requestedDate: string;
  requestedStartHour: number;
  requestedEndHour: number;
  blockerSummary: string[];
  isDirectlyAvailable: boolean;
  directOpenUnitCode: string | null;
  suggestions: RescueAlternativeOption[];
}

export const recommendationService = {
  matchEquipmentForProject(
    db: AppDatabase,
    input: {
      title: string;
      category: EquipmentCategory;
      description: string;
      deadline: string;
      departmentId: string;
    }
  ): ProjectRecommendation[] {
    const tokens = `${input.title} ${input.description}`
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const results: ProjectRecommendation[] = db.equipment.map((eq) => {
      const matchedKeywords: string[] = [];
      let score = 22; // base relevance

      if (eq.category === input.category) {
        score += 32;
      }
      if (eq.departmentId === input.departmentId) {
        score += 8;
      }

      const searchable = `${eq.name} ${eq.description} ${eq.keywords.join(' ')}`.toLowerCase();
      for (const kw of eq.keywords) {
        if (tokens.some((tok) => tok === kw || kw.includes(tok) || tok.includes(kw))) {
          if (!matchedKeywords.includes(kw)) matchedKeywords.push(kw);
        }
      }
      for (const tok of tokens) {
        if (searchable.includes(tok) && !matchedKeywords.includes(tok)) {
          matchedKeywords.push(tok);
        }
      }

      score += Math.min(38, matchedKeywords.length * 10);

      const units = db.physicalUnits.filter((u) => u.equipmentId === eq.id);
      const availableUnitCount = units.filter((u) => u.status === 'available').length;
      if (availableUnitCount > 0) score += 5;

      const clampedScore = Math.min(99, Math.max(18, score));
      const reasons: string[] = [];
      if (eq.category === input.category) reasons.push(`Matches ${input.category} domain`);
      if (matchedKeywords.length > 0) {
        reasons.push(`Matched requirements: ${matchedKeywords.slice(0, 4).join(', ')}`);
      }
      if (availableUnitCount === 0) {
        reasons.push('All units currently busy/locked — alternatives or waiting list recommended');
      } else {
        reasons.push(`${availableUnitCount}/${units.length} physical unit(s) currently available`);
      }

      return {
        equipmentId: eq.id,
        laboratoryId: eq.laboratoryId,
        matchScore: clampedScore,
        matchedKeywords: matchedKeywords.slice(0, 5),
        explanation: reasons.join('. ') + '.',
        availableUnitCount,
        totalUnitCount: units.length,
        requiresCertification: Boolean(eq.requiredCertificationId),
        requiresCrossDeptApproval:
          eq.requiresCrossDeptApproval && eq.departmentId !== input.departmentId,
      };
    });

    return results.sort((a, b) => b.matchScore - a.matchScore);
  },

  saveProjectPlan(
    db: AppDatabase,
    payload: {
      title: string;
      category: EquipmentCategory;
      description: string;
      deadline: string;
      departmentId: string;
      complexity: StudentProject['complexity'];
      requiredEquipmentIds: string[];
    }
  ): { nextDb: AppDatabase; result: ActionResult<StudentProject> } {
    const actor = getCurrentUser(db);
    if (!payload.title.trim() || !payload.description.trim()) {
      return {
        nextDb: db,
        result: { ok: false, message: 'Project title and description are required.' },
      };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.deadline)) {
      return {
        nextDb: db,
        result: { ok: false, message: 'Please enter a valid target deadline (YYYY-MM-DD).' },
      };
    }
    if (payload.requiredEquipmentIds.length === 0) {
      return {
        nextDb: db,
        result: { ok: false, message: 'Select at least one recommended equipment item to save.' },
      };
    }

    const project: StudentProject = {
      id: createUniqueId('proj'),
      title: payload.title.trim(),
      ownerId: actor.id,
      departmentId: payload.departmentId,
      category: payload.category,
      description: payload.description.trim(),
      deadline: payload.deadline,
      complexity: payload.complexity,
      requiredEquipmentIds: payload.requiredEquipmentIds,
      savedAlternativeIds: [],
      createdAt: new Date().toISOString(),
    };

    const report = this.evaluateFeasibility(db, project, actor.id);
    project.feasibilityScore = report.overallScore;

    const nextDb: AppDatabase = {
      ...db,
      projects: [project, ...db.projects],
      auditLogs: appendAuditLog(
        db,
        actor,
        'PROJECT_SAVED',
        project.id,
        `Saved project plan "${project.title}" with ${project.requiredEquipmentIds.length} equipment dependencies.`
      ),
    };

    return {
      nextDb,
      result: {
        ok: true,
        message: `Project "${project.title}" saved (Feasibility: ${report.overallScore}/100).`,
        data: project,
      },
    };
  },

  findAlternatives(db: AppDatabase, targetEquipmentId: string): AlternativeCandidate[] {
    const source = db.equipment.find((e) => e.id === targetEquipmentId);
    if (!source) return [];

    const candidates: AlternativeCandidate[] = [];

    for (const candidate of db.equipment) {
      if (candidate.id === source.id) continue;

      const edge = db.compatibilityEdges.find(
        (e) =>
          (e.sourceEquipmentId === source.id && e.targetEquipmentId === candidate.id) ||
          (e.targetEquipmentId === source.id && e.sourceEquipmentId === candidate.id)
      );

      if (edge?.level === 'incompatible') continue;

      const sharedKeywords = source.keywords.filter((k) => candidate.keywords.includes(k));
      const sameCategory = source.category === candidate.category;

      if (!edge && !sameCategory && sharedKeywords.length === 0) continue;

      const units = db.physicalUnits.filter((u) => u.equipmentId === candidate.id);
      const availableUnits = units.filter((u) => u.status === 'available').length;

      let compatibilityLevel: AlternativeCandidate['compatibilityLevel'] = 'same_category_unverified';
      let confidenceLabel: AlternativeCandidate['confidenceLabel'] = 'Uncertain Compatibility';
      let score = 45;

      if (edge?.level === 'verified') {
        compatibilityLevel = 'verified';
        confidenceLabel = 'Verified Compatible';
        score = 88;
      } else if (edge?.level === 'conditional') {
        compatibilityLevel = 'conditional';
        confidenceLabel = 'Conditional (Adapter/Limit)';
        score = 72;
      } else if (edge?.level === 'uncertain') {
        compatibilityLevel = 'uncertain';
        confidenceLabel = 'Uncertain Compatibility';
        score = 52;
      } else if (sameCategory) {
        score = 62 + sharedKeywords.length * 5;
      }

      if (availableUnits > 0) score += 8;

      const advantages: string[] = [];
      if (availableUnits > 0) advantages.push(`${availableUnits} unit(s) immediately open`);
      if (sameCategory) advantages.push(`Same technical domain (${candidate.category})`);
      if (candidate.specs.precision) advantages.push(`Precision spec: ${candidate.specs.precision}`);
      if (!candidate.requiresCrossDeptApproval) advantages.push('No cross-department approval delay');

      const limitations: string[] = [];
      if (edge?.limitations) limitations.push(edge.limitations);
      if (!edge) limitations.push('No direct verified equivalence edge — verify probe/interface tolerance.');
      if (candidate.departmentId !== source.departmentId) {
        limitations.push('Hosted by another department; cross-department request may apply.');
      }

      candidates.push({
        equipment: candidate,
        compatibilityLevel,
        confidenceLabel,
        advantages,
        limitations,
        requiredModifications:
          edge?.adapterRequired ??
          candidate.specs.adaptersRequired ??
          'Verify connector pinout and mounting fixture before test.',
        availableUnits,
        totalUnits: units.length,
        matchScore: Math.min(98, score),
      });
    }

    return candidates.sort((a, b) => b.matchScore - a.matchScore);
  },

  findCompatibilityPath(
    db: AppDatabase,
    sourceId: string,
    targetId: string
  ): { path: EquipmentItem[]; edges: CompatibilityRelationship[] } | null {
    if (sourceId === targetId) return null;

    const queue: Array<{ nodeId: string; edges: CompatibilityRelationship[] }> = [
      { nodeId: sourceId, edges: [] },
    ];
    const visited = new Set<string>([sourceId]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const connected = db.compatibilityEdges.filter(
        (e) =>
          e.level !== 'incompatible' &&
          (e.sourceEquipmentId === current.nodeId || e.targetEquipmentId === current.nodeId)
      );

      for (const edge of connected) {
        const nextId =
          edge.sourceEquipmentId === current.nodeId ? edge.targetEquipmentId : edge.sourceEquipmentId;
        const nextEdges = [...current.edges, edge];
        if (nextId === targetId) {
          const nodeIds = [sourceId];
          let cursor = sourceId;
          for (const ed of nextEdges) {
            cursor = ed.sourceEquipmentId === cursor ? ed.targetEquipmentId : ed.sourceEquipmentId;
            nodeIds.push(cursor);
          }
          const path = nodeIds
            .map((id) => db.equipment.find((eq) => eq.id === id))
            .filter((eq): eq is EquipmentItem => Boolean(eq));
          return { path, edges: nextEdges };
        }
        if (!visited.has(nextId)) {
          visited.add(nextId);
          queue.push({ nodeId: nextId, edges: nextEdges });
        }
      }
    }
    return null;
  },

  evaluateFeasibility(
    db: AppDatabase,
    project: Pick<
      StudentProject,
      'requiredEquipmentIds' | 'deadline' | 'complexity' | 'departmentId'
    >,
    userId: string,
    whatIf?: {
      extraDays?: number;
      substituteFaultyWithAlternatives?: boolean;
      assumeTrainingComplete?: boolean;
    }
  ): FeasibilityReport {
    const reqIds = project.requiredEquipmentIds;
    if (reqIds.length === 0) {
      return {
        overallScore: 25,
        classification: 'At Risk',
        dimensions: {
          availability: 0,
          compatibility: 0,
          timelineMargin: 50,
          accessAndSafety: 50,
          complexityReadiness: 50,
        },
        missingResources: ['No equipment assigned to project yet.'],
        technicalRisks: ['Cannot validate compatibility without selected equipment.'],
        recommendations: ['Use AI Project Matcher to map required laboratory hardware.'],
      };
    }

    let availableCount = 0;
    let readyCount = 0;
    const missingResources: string[] = [];
    const technicalRisks: string[] = [];
    const recommendations: string[] = [];

    for (const eqId of reqIds) {
      const eq = db.equipment.find((e) => e.id === eqId);
      if (!eq) continue;
      const lab = db.laboratories.find((l) => l.id === eq.laboratoryId);
      const units = db.physicalUnits.filter((u) => u.equipmentId === eq.id);
      const openUnits = units.filter((u) => u.status === 'available' || u.status === 'booked');
      const healthyAvailable = units.filter((u) => u.status === 'available');

      if (healthyAvailable.length > 0) {
        availableCount += 1;
      } else if (openUnits.length > 0) {
        availableCount += 0.65;
        missingResources.push(`${eq.name} has busy units — book ahead or join waiting list.`);
      } else if (whatIf?.substituteFaultyWithAlternatives) {
        const alts = this.findAlternatives(db, eq.id).filter((a) => a.availableUnits > 0);
        if (alts.length > 0) {
          availableCount += 0.85;
          recommendations.push(
            `What-If Substitute: Replace ${eq.name} with ${alts[0].equipment.name} (${alts[0].confidenceLabel}).`
          );
        } else {
          missingResources.push(`${eq.name} has zero healthy units and no immediate substitute.`);
        }
      } else {
        missingResources.push(`${eq.name} has 0 immediately available units.`);
      }

      if (whatIf?.assumeTrainingComplete) {
        readyCount += 1;
      } else {
        const readiness = safetyService.evaluateUserReadiness(db, userId, eq, lab);
        if (readiness.eligible) {
          readyCount += 1;
        } else {
          technicalRisks.push(
            `Safety gate on ${eq.name}: ${readiness.statusLabel} (${[
              ...readiness.missingCertifications,
              ...readiness.pendingVerification,
              ...readiness.expiredCertifications,
            ].join(', ')}).`
          );
        }
      }

      if (eq.requiresCrossDeptApproval && eq.departmentId !== project.departmentId) {
        recommendations.push(`Submit cross-department sharing request early for ${eq.name}.`);
      }
    }

    // Compatibility check across pairs
    let pairCount = 0;
    let compatPoints = 0;
    for (let i = 0; i < reqIds.length; i++) {
      for (let j = i + 1; j < reqIds.length; j++) {
        pairCount++;
        const edge = db.compatibilityEdges.find(
          (e) =>
            (e.sourceEquipmentId === reqIds[i] && e.targetEquipmentId === reqIds[j]) ||
            (e.targetEquipmentId === reqIds[i] && e.sourceEquipmentId === reqIds[j])
        );
        if (!edge) {
          compatPoints += 65;
        } else if (edge.level === 'verified') {
          compatPoints += 100;
        } else if (edge.level === 'conditional') {
          compatPoints += 80;
          if (edge.adapterRequired) {
            recommendations.push(`Prepare adapter: ${edge.adapterRequired}`);
          }
        } else if (edge.level === 'uncertain') {
          compatPoints += 50;
          technicalRisks.push(`Uncertain compatibility: ${edge.interfaceDetails}`);
        } else {
          compatPoints += 15;
          technicalRisks.push(`Incompatible hardware pair detected: ${edge.limitations}`);
        }
      }
    }

    const availability = Math.round((availableCount / reqIds.length) * 100);
    const compatibility = pairCount === 0 ? 90 : Math.round(compatPoints / pairCount);
    const accessAndSafety = Math.round((readyCount / reqIds.length) * 100);

    const parsedDeadlineMs = new Date(project.deadline).getTime();
    const daysLeft = Number.isFinite(parsedDeadlineMs)
      ? Math.ceil((parsedDeadlineMs - new Date('2026-11-23').getTime()) / 86400000) +
        (whatIf?.extraDays ?? 0)
      : 14 + (whatIf?.extraDays ?? 0);
    const timelineMargin = Math.max(20, Math.min(100, daysLeft * 5));
    const complexityReadiness =
      project.complexity === 'low' ? 92 : project.complexity === 'moderate' ? 78 : 64;

    const overallScore = Math.round(
      availability * 0.28 +
        compatibility * 0.22 +
        timelineMargin * 0.2 +
        accessAndSafety * 0.18 +
        complexityReadiness * 0.12
    );

    const classification: FeasibilityReport['classification'] =
      overallScore >= 76 ? 'Highly Feasible' : overallScore >= 55 ? 'Conditionally Feasible' : 'At Risk';

    if (recommendations.length === 0) {
      recommendations.push('All required equipment and certifications align cleanly with project timeline.');
    }

    return {
      overallScore,
      classification,
      dimensions: {
        availability,
        compatibility,
        timelineMargin,
        accessAndSafety,
        complexityReadiness,
      },
      missingResources,
      technicalRisks,
      recommendations,
    };
  },

  generateProjectJourney(
    db: AppDatabase,
    input: {
      title: string;
      category: EquipmentCategory;
      description: string;
      deadline: string;
      departmentId: string;
      complexity: StudentProject['complexity'];
      requiredEquipmentIds?: string[];
      userId?: string;
    }
  ): ProjectJourneyPlan {
    const userId = input.userId ?? db.currentUserId;
    const matched = this.matchEquipmentForProject(db, {
      title: input.title,
      category: input.category,
      description: input.description,
      deadline: input.deadline,
      departmentId: input.departmentId,
    });

    const chosenIds =
      input.requiredEquipmentIds && input.requiredEquipmentIds.length > 0
        ? input.requiredEquipmentIds
        : matched.slice(0, 4).map((m) => m.equipmentId);

    const chosenEquipment = chosenIds
      .map((id) => db.equipment.find((e) => e.id === id))
      .filter((e): e is EquipmentItem => Boolean(e));

    // Bucket equipment cleanly into engineering workflow phases
    const fabCategories: EquipmentCategory[] = ['Fabrication & CNC', 'Materials & Metrology'];
    const benchCategories: EquipmentCategory[] = ['Electronics & Signal', 'Bioengineering'];
    const validationCategories: EquipmentCategory[] = ['Robotics & Automation', 'Optics & Thermal'];

    const fabItems = chosenEquipment.filter((e) => fabCategories.includes(e.category));
    const benchItems = chosenEquipment.filter((e) => benchCategories.includes(e.category));
    const validationItems = chosenEquipment.filter((e) => validationCategories.includes(e.category));

    // Ensure every chosen item appears in at least one active hardware stage
    if (benchItems.length === 0 && fabItems.length === 0 && validationItems.length === 0 && chosenEquipment.length > 0) {
      benchItems.push(...chosenEquipment);
    }

    const toEquipmentLink = (eq: EquipmentItem, sessionHours: number): ProjectJourneyEquipmentLink => {
      const lab = db.laboratories.find((l) => l.id === eq.laboratoryId);
      const dept = db.departments.find((d) => d.id === eq.departmentId);
      const units = db.physicalUnits.filter((u) => u.equipmentId === eq.id);
      const availableUnits = units.filter((u) => u.status === 'available').length;
      const readiness = safetyService.evaluateUserReadiness(db, userId, eq, lab);

      return {
        equipmentId: eq.id,
        equipmentName: eq.name,
        laboratoryId: eq.laboratoryId,
        laboratoryCode: lab?.code ?? 'LAB',
        laboratoryName: lab?.name ?? 'Campus Lab',
        departmentCode: dept?.code ?? 'DEPT',
        availableUnits,
        totalUnits: units.length,
        recommendedSessionHours: Math.min(eq.maxBookingHours, sessionHours),
        requiresCertification: Boolean(eq.requiredCertificationId),
        safetyEligible: readiness.eligible,
        requiresCrossDeptApproval: eq.requiresCrossDeptApproval && eq.departmentId !== input.departmentId,
        compatibilityNote: eq.specs.adaptersRequired,
      };
    };

    const complexityScale = input.complexity === 'high' ? 1.5 : input.complexity === 'moderate' ? 1.15 : 0.85;
    const baseStart = new Date('2026-11-23T12:00:00');
    const deadlineMs = new Date(`${input.deadline}T12:00:00`).getTime();
    const totalWindowDays = Number.isFinite(deadlineMs)
      ? Math.max(8, Math.round((deadlineMs - baseStart.getTime()) / 86400000))
      : 16;

    const rawStages: Array<{
      id: string;
      title: string;
      phaseFocus: string;
      weightDays: number;
      labHours: number;
      dependsOn: string[];
      deliverables: string[];
      items: EquipmentItem[];
    }> = [
      {
        id: 'stage-1',
        title: 'Architecture, CAD & Safety Clearance',
        phaseFocus: 'Finalize electrical/mechanical schematics, pass required safety modules, and verify cross-department access.',
        weightDays: 0.16,
        labHours: 2,
        dependsOn: [],
        deliverables: ['Bill of Materials & interface spec', 'Verified Lab Passport certifications'],
        items: chosenEquipment.slice(0, 1),
      },
      {
        id: 'stage-2',
        title: 'Fabrication & Structural Prototyping',
        phaseFocus: 'Machine brackets, enclosures, or microfluidic manifolds and inspect material tolerances.',
        weightDays: 0.24,
        labHours: Math.round(4 * complexityScale),
        dependsOn: ['stage-1'],
        deliverables: ['Fabricated housing / mounts', 'Dimensional fit & fastener inspection'],
        items: fabItems.length > 0 ? fabItems : chosenEquipment.slice(0, 1),
      },
      {
        id: 'stage-3',
        title: 'Bench Characterization & Signal Debug',
        phaseFocus: 'Verify power rails, impedance matching, protocol timing, or sensor calibration curves.',
        weightDays: 0.28,
        labHours: Math.round(5 * complexityScale),
        dependsOn: ['stage-1', 'stage-2'],
        deliverables: ['Scope / VNA / potentiostat baseline traces', 'Adapter & voltage limit validation'],
        items: benchItems.length > 0 ? benchItems : chosenEquipment.slice(0, 2),
      },
      {
        id: 'stage-4',
        title: 'Integrated Stress & System Validation',
        phaseFocus: 'Run closed-loop mechanical/thermal/motion capture tests under representative operating loads.',
        weightDays: 0.22,
        labHours: Math.round(4 * complexityScale),
        dependsOn: ['stage-3'],
        deliverables: ['Thermal / motion / tensile validation log', 'Full end-to-end milestone run'],
        items: validationItems.length > 0 ? validationItems : chosenEquipment.slice(-1),
      },
      {
        id: 'stage-5',
        title: 'Final Sign-Off & QR Hardware Return',
        phaseFocus: 'Complete final demonstration measurements, log QR unit return condition, and archive project report.',
        weightDays: 0.1,
        labHours: 2,
        dependsOn: ['stage-4'],
        deliverables: ['QR return inspection logged', 'Final reproducible lab report'],
        items: [],
      },
    ];

    let dayCursor = 0;
    const stages: ProjectJourneyStage[] = rawStages.map((raw, idx) => {
      const estDays = Math.max(1, Math.round(totalWindowDays * raw.weightDays));
      const startObj = new Date(baseStart.getTime() + dayCursor * 86400000);
      const endOffset = idx === rawStages.length - 1 ? Math.max(dayCursor + 1, totalWindowDays) : dayCursor + estDays;
      const endObj = new Date(baseStart.getTime() + endOffset * 86400000);
      dayCursor = endOffset;

      const links = raw.items.map((item) => toEquipmentLink(item, Math.max(2, Math.min(5, raw.labHours))));
      const bookingRequirements: string[] = [];

      for (const link of links) {
        if (!link.safetyEligible) {
          bookingRequirements.push(`Safety clearance pending for ${link.equipmentName} (${link.laboratoryCode}).`);
        }
        if (link.requiresCrossDeptApproval) {
          bookingRequirements.push(`Cross-department approval needed for ${link.departmentCode} · ${link.equipmentName}.`);
        }
        if (link.availableUnits === 0) {
          bookingRequirements.push(`0 units open for ${link.equipmentName} — use Resource Rescue or book ahead.`);
        } else {
          bookingRequirements.push(`Book ${link.equipmentName} (${link.laboratoryCode}) for ~${link.recommendedSessionHours}h.`);
        }
      }

      if (bookingRequirements.length === 0) {
        bookingRequirements.push('Log QR equipment check-in/return inspection at bench completion.');
      }

      const hasConstrained = links.some((l) => l.availableUnits === 0);
      const hasGate = links.some((l) => !l.safetyEligible || l.requiresCrossDeptApproval);
      const readinessStatus: ProjectJourneyStage['readinessStatus'] = hasConstrained
        ? 'constrained'
        : hasGate
          ? 'action_required'
          : 'ready';

      return {
        stageNumber: idx + 1,
        id: raw.id,
        title: raw.title,
        phaseFocus: raw.phaseFocus,
        estimatedDays: Math.max(1, endOffset - Math.max(0, endOffset - estDays)),
        estimatedLabHours: raw.labHours,
        startDate: startObj.toISOString().slice(0, 10),
        endDate: endObj.toISOString().slice(0, 10),
        dependsOnStageIds: raw.dependsOn,
        bookingRequirements,
        deliverables: raw.deliverables,
        equipmentLinks: links,
        readinessStatus,
      };
    });

    return {
      projectTitle: input.title,
      category: input.category,
      deadline: input.deadline,
      totalEstimatedDays: totalWindowDays,
      totalLabHours: stages.reduce((s, st) => s + st.estimatedLabHours, 0),
      complexity: input.complexity,
      stages,
      summaryNote: `Deterministic 5-stage engineering roadmap aligned with ${chosenEquipment.length} LabLink instrument(s) and live safety/unit constraints.`,
    };
  },

  runResourceRescue(
    db: AppDatabase,
    params: {
      equipmentId: string;
      date: string;
      startHour: number;
      endHour: number;
      userId: string;
      projectId?: string | null;
    }
  ): ResourceRescueReport {
    const target = db.equipment.find((e) => e.id === params.equipmentId) ?? db.equipment[0];
    const user = db.users.find((u) => u.id === params.userId) ?? getCurrentUser(db);
    const lab = db.laboratories.find((l) => l.id === target.laboratoryId);
    const units = db.physicalUnits.filter((u) => u.equipmentId === target.id);
    const duration = Math.max(1, params.endHour - params.startHour);

    const directUnit = schedulingService.findAvailableUnitForSlot(
      db,
      target.id,
      params.date,
      params.startHour,
      params.endHour
    );

    const blockerSummary: string[] = [];
    const maintCount = units.filter((u) => u.status === 'maintenance' || u.status === 'faulty').length;
    if (maintCount > 0) {
      blockerSummary.push(`${maintCount}/${units.length} unit(s) locked due to maintenance/calibration.`);
    }
    if (!directUnit) {
      blockerSummary.push(
        `All healthy units of ${target.name} are occupied on ${params.date} (${params.startHour}:00–${params.endHour}:00).`
      );
    }
    const readiness = safetyService.evaluateUserReadiness(db, user.id, target, lab);
    if (!readiness.eligible) {
      blockerSummary.push(`Safety gate active: ${readiness.statusLabel}.`);
    }
    if (target.requiresCrossDeptApproval && target.departmentId !== user.departmentId && user.role === 'student') {
      blockerSummary.push('Cross-department approval required for your home department.');
    }
    if (blockerSummary.length === 0) {
      blockerSummary.push(`Unit ${directUnit?.unitCode} is open for the selected window; rescue options below show backups & cross-dept choices.`);
    }

    const suggestions: RescueAlternativeOption[] = [];

    // 1 & 3. Compatible substitutes (same-dept and cross-dept borrow options)
    const alternatives = this.findAlternatives(db, target.id);
    for (const alt of alternatives.slice(0, 4)) {
      const altLab = db.laboratories.find((l) => l.id === alt.equipment.laboratoryId);
      const altDept = db.departments.find((d) => d.id === alt.equipment.departmentId);
      const slotUnit = schedulingService.findAvailableUnitForSlot(
        db,
        alt.equipment.id,
        params.date,
        params.startHour,
        params.endHour
      );
      const isCrossDept = alt.equipment.departmentId !== user.departmentId;
      suggestions.push({
        kind: isCrossDept ? 'cross_dept_borrow' : 'verified_substitute',
        title: isCrossDept
          ? `Cross-Department Alternative (${altDept?.code})`
          : `Compatible Bench Substitute (${alt.confidenceLabel})`,
        equipmentId: alt.equipment.id,
        equipmentName: alt.equipment.name,
        laboratoryCode: altLab?.code ?? 'LAB',
        departmentCode: altDept?.code ?? 'DEPT',
        recommendedDate: params.date,
        recommendedStartHour: params.startHour,
        recommendedEndHour: params.endHour,
        openUnitCode: slotUnit?.unitCode ?? null,
        confidenceLabel: alt.confidenceLabel,
        reason: slotUnit
          ? `Unit ${slotUnit.unitCode} is free during ${params.startHour}:00–${params.endHour}:00 with ${alt.matchScore}% functional match.`
          : `${alt.availableUnits}/${alt.totalUnits} unit(s) healthy; check alternate hour slots.`,
        tradeoffOrAdapter: alt.requiredModifications,
        requiresCrossDept: Boolean(alt.equipment.requiresCrossDeptApproval && isCrossDept),
        canApplyToProject: Boolean(params.projectId),
      });
    }

    // 2. Next open time slots on the SAME equipment across next 5 days
    const baseMs = new Date(`${params.date}T12:00:00`).getTime();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let foundSlots = 0;
    for (let dayOffset = 0; dayOffset < 6 && foundSlots < 3; dayOffset++) {
      const candidateDateObj = new Date((Number.isFinite(baseMs) ? baseMs : Date.now()) + dayOffset * 86400000);
      const candidateDate = candidateDateObj.toISOString().slice(0, 10);
      const dayLabel = dayNames[candidateDateObj.getDay()];
      if (lab && !lab.operatingHours.days.includes(dayLabel)) continue;

      const openStart = lab?.operatingHours.openHour ?? 8;
      const openEnd = lab?.operatingHours.closeHour ?? 18;
      for (let h = openStart; h <= openEnd - duration; h++) {
        if (dayOffset === 0 && h === params.startHour) continue;
        const unit = schedulingService.findAvailableUnitForSlot(
          db,
          target.id,
          candidateDate,
          h,
          h + duration
        );
        if (unit) {
          const dept = db.departments.find((d) => d.id === target.departmentId);
          suggestions.push({
            kind: 'open_time_slot',
            title: `Alternate Open Slot (${candidateDate})`,
            equipmentId: target.id,
            equipmentName: target.name,
            laboratoryCode: lab?.code ?? 'LAB',
            departmentCode: dept?.code ?? 'DEPT',
            recommendedDate: candidateDate,
            recommendedStartHour: h,
            recommendedEndHour: h + duration,
            openUnitCode: unit.unitCode,
            confidenceLabel: '100% Exact Instrument',
            reason: `Unit ${unit.unitCode} is unbooked from ${h}:00 to ${h + duration}:00 on ${candidateDate}.`,
            tradeoffOrAdapter: dayOffset === 0 ? 'Same-day shifted window; zero hardware changes needed.' : `Deferred by ${dayOffset} day(s); zero adapter modifications.`,
            requiresCrossDept: Boolean(target.requiresCrossDeptApproval && target.departmentId !== user.departmentId),
            canApplyToProject: false,
          });
          foundSlots++;
          break;
        }
      }
    }

    // 4. Multi-tool compatible combination from compatibilityEdges
    const verifiedCombos = db.compatibilityEdges.filter(
      (e) =>
        (e.level === 'verified' || e.level === 'conditional') &&
        (e.sourceEquipmentId === target.id || e.targetEquipmentId === target.id)
    );
    if (verifiedCombos.length >= 2) {
      const idA =
        verifiedCombos[0].sourceEquipmentId === target.id
          ? verifiedCombos[0].targetEquipmentId
          : verifiedCombos[0].sourceEquipmentId;
      const idB =
        verifiedCombos[1].sourceEquipmentId === target.id
          ? verifiedCombos[1].targetEquipmentId
          : verifiedCombos[1].sourceEquipmentId;
      const eqA = db.equipment.find((e) => e.id === idA);
      const eqB = db.equipment.find((e) => e.id === idB);
      if (eqA && eqB && eqA.id !== eqB.id) {
        const labA = db.laboratories.find((l) => l.id === eqA.laboratoryId);
        const deptA = db.departments.find((d) => d.id === eqA.departmentId);
        const unitA = schedulingService.findAvailableUnitForSlot(db, eqA.id, params.date, params.startHour, params.endHour);
        suggestions.push({
          kind: 'multi_tool_combination',
          title: 'Two-Instrument Workflow Combination',
          equipmentId: eqA.id,
          equipmentName: eqA.name,
          secondaryEquipmentId: eqB.id,
          secondaryEquipmentName: eqB.name,
          laboratoryCode: labA?.code ?? 'LAB',
          departmentCode: deptA?.code ?? 'DEPT',
          recommendedDate: params.date,
          recommendedStartHour: params.startHour,
          recommendedEndHour: params.endHour,
          openUnitCode: unitA?.unitCode ?? null,
          confidenceLabel: 'Combined Edge Coverage',
          reason: `Pair ${eqA.name} with ${eqB.name} using verified compatibility links to cover primary test signals without waiting for ${target.name}.`,
          tradeoffOrAdapter: verifiedCombos[0].adapterRequired ?? verifiedCombos[0].interfaceDetails,
          requiresCrossDept: Boolean(eqA.requiresCrossDeptApproval && eqA.departmentId !== user.departmentId),
          canApplyToProject: Boolean(params.projectId),
        });
      }
    }

    // 5. Project plan modification guidance
    if (duration > 2) {
      const dept = db.departments.find((d) => d.id === target.departmentId);
      suggestions.push({
        kind: 'plan_adjustment',
        title: 'Split Session into 2h Blocks & Swap Non-Critical Setup',
        equipmentId: alternatives[0]?.equipment.id ?? target.id,
        equipmentName: alternatives[0]?.equipment.name ?? target.name,
        laboratoryCode: lab?.code ?? 'LAB',
        departmentCode: dept?.code ?? 'DEPT',
        recommendedDate: params.date,
        recommendedStartHour: params.startHour,
        recommendedEndHour: Math.min(params.endHour, params.startHour + 2),
        openUnitCode: schedulingService.findAvailableUnitForSlot(
          db,
          target.id,
          params.date,
          params.startHour,
          Math.min(params.endHour, params.startHour + 2)
        )?.unitCode ?? null,
        confidenceLabel: 'Timeline Optimization',
        reason: `Reducing single block duration from ${duration}h to 2h raises scheduling duration-feasibility score and unlocks shorter inter-booking gaps.`,
        tradeoffOrAdapter: 'Prepare bench cables/test scripts beforehand to complete test in 2h.',
        requiresCrossDept: false,
        canApplyToProject: Boolean(params.projectId && alternatives[0]),
      });
    }

    return {
      targetEquipmentId: target.id,
      targetEquipmentName: target.name,
      requestedDate: params.date,
      requestedStartHour: params.startHour,
      requestedEndHour: params.endHour,
      blockerSummary,
      isDirectlyAvailable: Boolean(directUnit),
      directOpenUnitCode: directUnit?.unitCode ?? null,
      suggestions,
    };
  },
};
