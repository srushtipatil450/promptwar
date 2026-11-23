import React, { useMemo, useState } from 'react';
import { ArrowRight, BookmarkCheck, CheckSquare, Compass, Sparkles, Square } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLabLink } from '../context/LabLinkContext';
import { recommendationService } from '../services/recommendationService';
import { EquipmentCategory, StudentProject } from '../types/lablink';
import {
  MagneticButton,
  MagneticParallaxLayer,
  MagneticTiltCard,
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

export const ProjectMatcherView: React.FC = () => {
  const { db, currentUser, saveProjectPlan, openBookingModal, setActiveView, setFocusedProjectId } =
    useLabLink();

  const [title, setTitle] = useState('Autonomous Drone Power & IMU Diagnostics');
  const [category, setCategory] = useState<EquipmentCategory>('Electronics & Signal');
  const [departmentId, setDepartmentId] = useState(currentUser.departmentId);
  const [deadline, setDeadline] = useState('2026-12-08');
  const [complexity, setComplexity] = useState<StudentProject['complexity']>('moderate');
  const [description, setDescription] = useState(
    'Design a high-efficiency brushless motor inverter PCB with thermal hotspot validation, SPI sensor waveform debugging, and 3D-printed SLA aerodynamic shroud.'
  );
  const [selectedEqIds, setSelectedEqIds] = useState<string[]>([
    'eq-oscilloscope',
    'eq-dc-array',
    'eq-thermal-cam',
  ]);
  const [hasAnalyzed, setHasAnalyzed] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  const recommendations = useMemo(() => {
    if (!hasAnalyzed) return [];
    return recommendationService
      .matchEquipmentForProject(db, {
        title,
        category,
        description,
        deadline,
        departmentId,
      })
      .slice(0, 6);
  }, [db, hasAnalyzed, title, category, description, deadline, departmentId]);

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    setIsScanning(true);
    setHasAnalyzed(true);
    const topIds = recommendationService
      .matchEquipmentForProject(db, { title, category, description, deadline, departmentId })
      .slice(0, 3)
      .map((r) => r.equipmentId);
    setSelectedEqIds(topIds);
    window.setTimeout(() => setIsScanning(false), 320);
  };

  const toggleEquip = (id: string) => {
    setSelectedEqIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSaveProject = () => {
    const res = saveProjectPlan({
      title,
      category,
      description,
      deadline,
      departmentId,
      complexity,
      requiredEquipmentIds: selectedEqIds,
    });
    if (res.ok && res.data) {
      setFocusedProjectId(res.data.id);
      setActiveView('feasibility-checker');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Input Form */}
        <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6 lg:col-span-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EAF2FF] text-[#3978E8]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#202B3C]">
                Deterministic Project-to-Equipment Matcher
              </h2>
              <p className="text-xs text-[#718096]">
                Local rule-based requirement extraction & live inventory matching
              </p>
            </div>
          </div>

          <form onSubmit={handleAnalyze} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#202B3C]">
                Project Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-xl border border-[#E6EAF0] px-3 py-2 text-sm text-[#202B3C] focus:border-[#3978E8] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#202B3C]">
                  Primary Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as EquipmentCategory)}
                  className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-sm text-[#202B3C] focus:border-[#3978E8] focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#202B3C]">
                  Home Department
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-sm text-[#202B3C] focus:border-[#3978E8] focus:outline-none"
                >
                  {db.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#202B3C]">
                  Target Deadline
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[#E6EAF0] px-3 py-2 text-sm tabular-nums text-[#202B3C] focus:border-[#3978E8] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#202B3C]">
                  Technical Complexity
                </label>
                <select
                  value={complexity}
                  onChange={(e) => setComplexity(e.target.value as StudentProject['complexity'])}
                  className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-sm text-[#202B3C] focus:border-[#3978E8] focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#202B3C]">
                Project Scope & Technical Requirements
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                placeholder="Describe signals, materials, tolerances, sensors, fabrication, or testing needs..."
                className="w-full rounded-xl border border-[#E6EAF0] px-3 py-2 text-sm text-[#202B3C] focus:border-[#3978E8] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <MagneticButton
                type="submit"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#3978E8] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#2E67CE]"
              >
                <Sparkles className="h-3.5 w-3.5 transition-transform duration-200 group-hover/magbtn:rotate-12 group-hover/magbtn:scale-110" />
                <span>Analyze & Recommend</span>
              </MagneticButton>
              <MagneticButton
                strength={3}
                onClick={handleSaveProject}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6EAF0] bg-white px-4 py-2.5 text-xs font-medium text-[#202B3C] hover:border-[#C9DDFE] hover:bg-[#F7F9FC]"
              >
                <BookmarkCheck className="h-3.5 w-3.5 text-[#3978E8] transition-transform duration-150 group-hover/magbtn:scale-110" />
                <span>Save Project ({selectedEqIds.length})</span>
              </MagneticButton>
            </div>
          </form>
        </section>

        {/* Recommendations Output */}
        <section className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between rounded-2xl border border-[#E6EAF0] bg-white px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-[#202B3C]">
                Recommended Laboratories & Equipment ({recommendations.length})
              </h3>
              <p className="text-xs text-[#718096]">
                Check instruments to include in your saved project plan, or book directly
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveView('journey-planner')}
                className="inline-flex items-center gap-1 rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] px-2.5 py-1 text-xs font-medium text-[#202B3C] hover:border-[#3978E8]"
              >
                <Compass className="h-3.5 w-3.5 text-[#3978E8]" />
                <span>Plan Journey</span>
              </button>
              <span className="rounded-lg bg-[#EAF2FF] px-2.5 py-1 text-xs font-medium tabular-nums text-[#285EC7]">
                {selectedEqIds.length} Selected
              </span>
            </div>
          </div>

          <AnimatePresence>
            {isScanning && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden rounded-xl border border-[#C9DDFE] bg-[#EAF2FF] px-4 py-2.5"
              >
                <div className="flex items-center justify-between text-xs font-medium text-[#285EC7]">
                  <span>Matching project requirements against 6 campus laboratories...</span>
                  <span className="font-mono">Scanning</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white">
                  <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: 0.32, ease: 'easeInOut' }}
                    className="h-full w-1/2 rounded-full bg-[#3978E8]"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-3">
            {recommendations.map((rec, idx) => {
              const eq = db.equipment.find((e) => e.id === rec.equipmentId);
              const lab = db.laboratories.find((l) => l.id === rec.laboratoryId);
              const dept = db.departments.find((d) => d.id === eq?.departmentId);
              if (!eq) return null;
              const isSelected = selectedEqIds.includes(eq.id);

              return (
                <MagneticTiltCard
                  key={eq.id}
                  index={idx}
                  maxTilt={2.6}
                  className={`rounded-2xl border bg-white p-5 ${
                    isSelected ? 'border-[#3978E8]' : 'border-[#E6EAF0]'
                  }`}
                >
                  <div className="relative z-10 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleEquip(eq.id)}
                        className="mt-0.5 text-[#3978E8] transition-transform duration-150 hover:scale-110"
                        aria-label={`Select ${eq.name}`}
                      >
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5" />
                        ) : (
                          <Square className="h-5 w-5 text-[#718096]" />
                        )}
                      </button>
                      <div>
                        <p className="text-xs text-[#718096]">
                          {dept?.code} · {lab?.code} ({lab?.name})
                        </p>
                        <h4 className="mt-0.5 text-sm font-semibold text-[#202B3C]">{eq.name}</h4>
                        <p className="mt-1 text-xs text-[#526075]">{rec.explanation}</p>
                        {rec.matchedKeywords.length > 0 && (
                          <p className="mt-1.5 text-[11px] text-[#718096]">
                            Matched signals: {rec.matchedKeywords.join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>

                    <MagneticParallaxLayer
                      depth={6}
                      className="flex flex-col items-end gap-2 shrink-0"
                    >
                      <span className="rounded-lg bg-[#EEEAFE] px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-[#5B47C7]">
                        {rec.matchScore}% Match
                      </span>
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#F1F5F9]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${rec.matchScore}%` }}
                          transition={{ duration: 0.35, delay: idx * 0.04 }}
                          className="h-full rounded-full bg-[#3978E8]"
                        />
                      </div>
                      <StatusBadge
                        label={`${rec.availableUnitCount}/${rec.totalUnitCount} Open`}
                        tone={rec.availableUnitCount > 0 ? 'success' : 'warning'}
                      />
                    </MagneticParallaxLayer>
                  </div>

                  <div className="relative z-10 mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E6EAF0] pt-3">
                    <div className="flex flex-wrap gap-2">
                      {rec.requiresCertification && (
                        <StatusBadge label="Certification Required" tone="info" />
                      )}
                      {rec.requiresCrossDeptApproval && (
                        <StatusBadge label="Cross-Dept Approval" tone="lavender" />
                      )}
                    </div>
                    <MagneticButton
                      strength={3}
                      onClick={() => openBookingModal({ equipmentId: eq.id })}
                      className="inline-flex items-center gap-1 rounded-xl bg-[#EAF2FF] px-3 py-1.5 text-xs font-medium text-[#285EC7] hover:bg-[#DCE9FF]"
                    >
                      <span>Request Equipment</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover/magbtn:translate-x-0.5" />
                    </MagneticButton>
                  </div>
                </MagneticTiltCard>
              );
            })}
          </div>
        </section>
      </div>

      {/* Saved Projects List */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#202B3C]">Saved Campus Project Plans</h3>
          <button
            type="button"
            onClick={() => setActiveView('feasibility-checker')}
            className="text-xs font-medium text-[#3978E8] hover:underline"
          >
            Run Feasibility Check
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {db.projects.map((p, pIdx) => {
            const owner = db.users.find((u) => u.id === p.ownerId);
            return (
              <MagneticTiltCard
                key={p.id}
                index={pIdx}
                maxTilt={2.5}
                onClick={() => {
                  setFocusedProjectId(p.id);
                  setActiveView('feasibility-checker');
                }}
                className="cursor-pointer rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-4"
              >
                <div className="relative z-10 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-[#718096]">
                      {p.category} · Due {p.deadline} · {owner?.name}
                    </p>
                    <h4 className="mt-0.5 text-sm font-semibold text-[#202B3C]">{p.title}</h4>
                  </div>
                  <StatusBadge
                    label={`${p.feasibilityScore ?? 75}/100 Feasibility`}
                    tone={(p.feasibilityScore ?? 75) >= 75 ? 'success' : 'warning'}
                  />
                </div>
                <p className="relative z-10 mt-2 text-xs text-[#526075]">{p.description}</p>
                <div className="relative z-10 mt-2.5 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium text-[#202B3C]">
                    Required:{' '}
                    {p.requiredEquipmentIds
                      .map((id) => db.equipment.find((e) => e.id === id)?.name)
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <span className="shrink-0 text-[11px] font-medium text-[#3978E8] transition-transform duration-150 group-hover/tilt:translate-x-0.5">
                    Evaluate →
                  </span>
                </div>
              </MagneticTiltCard>
            );
          })}
        </div>
      </section>
    </div>
  );
};
