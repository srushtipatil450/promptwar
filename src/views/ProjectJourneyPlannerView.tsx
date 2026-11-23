import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Compass,
  GitMerge,
  LifeBuoy,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useLabLink } from '../context/LabLinkContext';
import { recommendationService } from '../services/recommendationService';
import { EquipmentCategory, StudentProject } from '../types/lablink';
import {
  CursorSpotlightSection,
  MagneticButton,
  MagneticTiltCard,
  StaggerCard,
} from '../components/shared/MotionPrimitives';
import { StatusBadge } from '../components/shared/StatusBadge';

const CATEGORIES: EquipmentCategory[] = [
  'Electronics & Signal',
  'Robotics & Automation',
  'Fabrication & CNC',
  'Bioengineering',
  'Materials & Metrology',
  'Optics & Thermal',
];

export const ProjectJourneyPlannerView: React.FC = () => {
  const {
    db,
    currentUser,
    focusedProjectId,
    openBookingModal,
    setFocusedEquipmentId,
    setActiveView,
  } = useLabLink();

  const [mode, setMode] = useState<'saved' | 'custom'>(
    db.projects.length > 0 ? 'saved' : 'custom'
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    focusedProjectId ?? db.projects[0]?.id ?? ''
  );

  const [customTitle, setCustomTitle] = useState('Autonomous Rover LiDAR & Power Harness');
  const [customCategory, setCustomCategory] =
    useState<EquipmentCategory>('Robotics & Automation');
  const [customDeadline, setCustomDeadline] = useState('2026-12-12');
  const [customComplexity, setCustomComplexity] =
    useState<StudentProject['complexity']>('moderate');
  const [customDesc, setCustomDesc] = useState(
    'Design custom CNC aluminum sensor bracket, verify high-current DC motor driver waveforms on oscilloscope, and calibrate 3D motion tracking trajectory.'
  );

  const selectedProject = db.projects.find((p) => p.id === selectedProjectId) ?? db.projects[0];

  const journey = useMemo(() => {
    if (mode === 'saved' && selectedProject) {
      return recommendationService.generateProjectJourney(db, {
        title: selectedProject.title,
        category: selectedProject.category,
        description: selectedProject.description,
        deadline: selectedProject.deadline,
        departmentId: selectedProject.departmentId,
        complexity: selectedProject.complexity,
        requiredEquipmentIds: selectedProject.requiredEquipmentIds,
        userId: currentUser.id,
      });
    }
    return recommendationService.generateProjectJourney(db, {
      title: customTitle,
      category: customCategory,
      description: customDesc,
      deadline: customDeadline,
      departmentId: currentUser.departmentId,
      complexity: customComplexity,
      userId: currentUser.id,
    });
  }, [
    db,
    mode,
    selectedProject,
    currentUser.id,
    currentUser.departmentId,
    customTitle,
    customCategory,
    customDesc,
    customDeadline,
    customComplexity,
  ]);

  return (
    <div className="space-y-6">
      {/* Configuration Header */}
      <CursorSpotlightSection
        spotlightRadius={380}
        className="rounded-2xl border border-[#E6EAF0] bg-white p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF2FF] text-[#3978E8]">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#202B3C]">
                AI Project Journey Planner
              </h2>
              <p className="text-xs text-[#718096]">
                Deterministic stage-by-stage execution roadmap linked to LabLink inventory,
                compatibility rules, and safety gates
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-1">
            <button
              type="button"
              onClick={() => setMode('saved')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === 'saved'
                  ? 'bg-white text-[#3978E8] shadow-xs'
                  : 'text-[#718096] hover:text-[#202B3C]'
              }`}
            >
              From Saved Project
            </button>
            <button
              type="button"
              onClick={() => setMode('custom')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === 'custom'
                  ? 'bg-white text-[#3978E8] shadow-xs'
                  : 'text-[#718096] hover:text-[#202B3C]'
              }`}
            >
              Plan New Concept
            </button>
          </div>
        </div>

        {mode === 'saved' && db.projects.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#202B3C]">
                Active Campus Project
              </label>
              <select
                value={selectedProject?.id ?? ''}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3.5 py-2 text-sm text-[#202B3C]"
              >
                {db.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.category} · Due {p.deadline})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setActiveView('project-matcher')}
                className="w-full rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] px-4 py-2 text-xs font-medium text-[#202B3C] hover:bg-[#EAF2FF]"
              >
                Modify Hardware in Project Matcher
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[#202B3C]">
                Project Title
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full rounded-xl border border-[#E6EAF0] px-3 py-2 text-xs text-[#202B3C]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#202B3C]">Category</label>
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value as EquipmentCategory)}
                className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-xs"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#202B3C]">Deadline</label>
                <input
                  type="date"
                  value={customDeadline}
                  onChange={(e) => setCustomDeadline(e.target.value)}
                  className="w-full rounded-xl border border-[#E6EAF0] px-2.5 py-2 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#202B3C]">Complexity</label>
                <select
                  value={customComplexity}
                  onChange={(e) =>
                    setCustomComplexity(e.target.value as StudentProject['complexity'])
                  }
                  className="w-full rounded-xl border border-[#E6EAF0] bg-white px-2.5 py-2 text-xs"
                >
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="md:col-span-4">
              <input
                type="text"
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                placeholder="Describe subsystems, materials, signals, or validation goals..."
                className="w-full rounded-xl border border-[#E6EAF0] px-3 py-2 text-xs text-[#202B3C]"
              />
            </div>
          </div>
        )}
      </CursorSpotlightSection>

      {/* Milestone Timeline Bar */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#202B3C]">
              Milestone Timeline — {journey.projectTitle}
            </h3>
            <p className="text-xs text-[#718096]">{journey.summaryNote}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <StatusBadge label={`${journey.totalEstimatedDays} Days`} tone="info" />
            <StatusBadge label={`${journey.totalLabHours}h Estimated Lab Bench Time`} tone="lavender" />
            <StatusBadge label={`Target: ${journey.deadline}`} tone="success" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-5">
          {journey.stages.map((stage, sIdx) => {
            const tone =
              stage.readinessStatus === 'ready'
                ? 'border-emerald-200 bg-emerald-50/70'
                : stage.readinessStatus === 'action_required'
                  ? 'border-[#C9DDFE] bg-[#EAF2FF]/70'
                  : 'border-amber-200 bg-amber-50/80';
            return (
              <MagneticTiltCard
                key={stage.id}
                index={sIdx}
                maxTilt={3}
                className={`rounded-xl border p-3 ${tone}`}
              >
                <div className="relative z-10 flex items-center justify-between gap-1 text-[11px] font-semibold text-[#202B3C]">
                  <span>Stage {stage.stageNumber}</span>
                  <span className="font-mono tabular-nums text-[#718096]">
                    ~{stage.estimatedLabHours}h
                  </span>
                </div>
                <p className="relative z-10 mt-1 text-xs font-semibold text-[#202B3C] line-clamp-2">
                  {stage.title}
                </p>
                <p className="relative z-10 mt-2 font-mono text-[10px] tabular-nums text-[#526075]">
                  {stage.startDate} → {stage.endDate}
                </p>
              </MagneticTiltCard>
            );
          })}
        </div>
      </section>

      {/* Detailed Stage-by-Stage Execution Cards */}
      <div className="space-y-4">
        {journey.stages.map((stage, idx) => (
          <StaggerCard
            key={stage.id}
            index={idx}
            className="rounded-2xl border border-[#E6EAF0] bg-white p-6"
          >
            <div className="flex flex-col justify-between gap-3 border-b border-[#E6EAF0] pb-4 md:flex-row md:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-[#3978E8] px-2.5 py-0.5 font-mono text-xs font-semibold text-white">
                    Stage {stage.stageNumber}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[#718096]">
                    {stage.startDate} to {stage.endDate} ({stage.estimatedDays}d ·{' '}
                    {stage.estimatedLabHours}h bench)
                  </span>
                  <StatusBadge
                    label={
                      stage.readinessStatus === 'ready'
                        ? 'Ready to Schedule'
                        : stage.readinessStatus === 'action_required'
                          ? 'Approval / Cert Gate'
                          : 'Unit Constrained'
                    }
                    tone={
                      stage.readinessStatus === 'ready'
                        ? 'success'
                        : stage.readinessStatus === 'action_required'
                          ? 'info'
                          : 'warning'
                    }
                  />
                </div>
                <h3 className="mt-2 text-base font-semibold text-[#202B3C]">{stage.title}</h3>
                <p className="mt-1 text-xs text-[#526075]">{stage.phaseFocus}</p>
              </div>

              {stage.dependsOnStageIds.length > 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] px-3 py-1.5 text-xs text-[#526075] shrink-0">
                  <GitMerge className="h-3.5 w-3.5 text-[#3978E8]" />
                  <span>
                    Depends on:{' '}
                    {stage.dependsOnStageIds
                      .map((id) => id.replace('stage-', 'Stage '))
                      .join(', ')}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* Stage Equipment & Labs */}
              <div className="space-y-2.5 lg:col-span-7">
                <p className="text-xs font-semibold text-[#202B3C]">
                  Required Equipment & Recommended Laboratories
                </p>
                {stage.equipmentLinks.length === 0 ? (
                  <div className="rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-3 text-xs text-[#718096]">
                    Final verification stage — complete QR return & calibration sign-off in
                    Equipment Tracking.
                  </div>
                ) : (
                  stage.equipmentLinks.map((link) => (
                    <div
                      key={link.equipmentId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-3.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-[#3978E8]">
                            {link.laboratoryCode}
                          </span>
                          <span className="text-xs font-semibold text-[#202B3C]">
                            {link.equipmentName}
                          </span>
                          <StatusBadge
                            label={`${link.availableUnits}/${link.totalUnits} Open`}
                            tone={link.availableUnits > 0 ? 'success' : 'warning'}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-[#718096]">
                          {link.departmentCode} · {link.laboratoryName} · ~
                          {link.recommendedSessionHours}h block
                          {link.compatibilityNote ? ` · Adapter: ${link.compatibilityNote}` : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <MagneticButton
                          strength={3}
                          onClick={() =>
                            openBookingModal({
                              equipmentId: link.equipmentId,
                              projectId: mode === 'saved' ? selectedProject?.id : null,
                              date: stage.startDate,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-xl bg-[#3978E8] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2E67CE]"
                        >
                          <CalendarClock className="h-3.5 w-3.5 transition-transform duration-150 group-hover/magbtn:scale-110" />
                          <span>Book</span>
                        </MagneticButton>
                        {link.availableUnits === 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setFocusedEquipmentId(link.equipmentId);
                              setActiveView('resource-rescue');
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                          >
                            <LifeBuoy className="h-3.5 w-3.5" />
                            <span>Rescue</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Booking Requirements & Deliverables */}
              <div className="space-y-3 lg:col-span-5">
                <div className="rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-[#202B3C]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#3978E8]" />
                    <span>Booking & Access Requirements</span>
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs text-[#526075]">
                    {stage.bookingRequirements.map((req, rIdx) => (
                      <li key={rIdx} className="flex items-start gap-1.5">
                        <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-[#3978E8]" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-[#E6EAF0] bg-white p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-[#202B3C]">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Stage Deliverables</span>
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-[#526075]">
                    {stage.deliverables.map((deliv, dIdx) => (
                      <li key={dIdx} className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span>{deliv}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </StaggerCard>
        ))}
      </div>
    </div>
  );
};
