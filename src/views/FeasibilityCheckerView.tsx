import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Compass, Lightbulb, SlidersHorizontal } from 'lucide-react';
import { useLabLink } from '../context/LabLinkContext';
import { recommendationService } from '../services/recommendationService';
import { StatusBadge } from '../components/shared/StatusBadge';

export const FeasibilityCheckerView: React.FC = () => {
  const { db, currentUser, focusedProjectId, openBookingModal, setActiveView } = useLabLink();
  const [selectedProjectId, setSelectedProjectId] = useState(
    focusedProjectId ?? db.projects[0]?.id ?? ''
  );
  const [extraDays, setExtraDays] = useState(0);
  const [substituteFaulty, setSubstituteFaulty] = useState(false);
  const [assumeTraining, setAssumeTraining] = useState(false);

  useEffect(() => {
    if (focusedProjectId) {
      setSelectedProjectId(focusedProjectId);
    }
  }, [focusedProjectId]);

  const project = useMemo(
    () => db.projects.find((p) => p.id === selectedProjectId) ?? db.projects[0],
    [db.projects, selectedProjectId]
  );

  const baselineReport = useMemo(() => {
    if (!project) return null;
    return recommendationService.evaluateFeasibility(db, project, currentUser.id);
  }, [db, project, currentUser.id]);

  const whatIfReport = useMemo(() => {
    if (!project) return null;
    return recommendationService.evaluateFeasibility(db, project, currentUser.id, {
      extraDays,
      substituteFaultyWithAlternatives: substituteFaulty,
      assumeTrainingComplete: assumeTraining,
    });
  }, [db, project, currentUser.id, extraDays, substituteFaulty, assumeTraining]);

  if (!project || !baselineReport || !whatIfReport) {
    return (
      <div className="rounded-2xl border border-[#E6EAF0] bg-white p-10 text-center">
        <p className="text-sm font-semibold text-[#202B3C]">No project plans saved yet</p>
        <button
          type="button"
          onClick={() => setActiveView('project-matcher')}
          className="mt-4 rounded-xl bg-[#3978E8] px-4 py-2 text-xs font-medium text-white"
        >
          Create Project in Matcher
        </button>
      </div>
    );
  }

  const delta = whatIfReport.overallScore - baselineReport.overallScore;
  const activeReport =
    extraDays > 0 || substituteFaulty || assumeTraining ? whatIfReport : baselineReport;

  const dimensions = [
    { label: 'Equipment Availability', value: activeReport.dimensions.availability },
    { label: 'Technical Compatibility', value: activeReport.dimensions.compatibility },
    { label: 'Timeline Margin', value: activeReport.dimensions.timelineMargin },
    { label: 'Access & Safety Readiness', value: activeReport.dimensions.accessAndSafety },
    { label: 'Complexity Readiness', value: activeReport.dimensions.complexityReadiness },
  ];

  return (
    <div className="space-y-6">
      {/* Project Selector */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E6EAF0] bg-white p-5">
        <div className="flex-1 min-w-[260px]">
          <label className="mb-1.5 block text-xs font-medium text-[#718096]">
            Select Project Plan to Evaluate
          </label>
          <select
            value={project.id}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full max-w-lg rounded-xl border border-[#E6EAF0] bg-white px-3.5 py-2 text-sm font-medium text-[#202B3C]"
          >
            {db.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} (Due {p.deadline})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-[#718096]">Feasibility Score</p>
            <p className="text-3xl font-bold tabular-nums text-[#202B3C]">
              {activeReport.overallScore}
              <span className="text-sm font-normal text-[#718096]">/100</span>
            </p>
          </div>
          <StatusBadge
            label={activeReport.classification}
            tone={
              activeReport.classification === 'Highly Feasible'
                ? 'success'
                : activeReport.classification === 'Conditionally Feasible'
                  ? 'warning'
                  : 'error'
            }
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 5-Axis Evaluation */}
        <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6 lg:col-span-7">
          <div className="mb-4 flex items-center gap-2">
            <Compass className="h-4 w-4 text-[#3978E8]" />
            <h2 className="text-base font-semibold text-[#202B3C]">
              Multi-Factor Feasibility Breakdown
            </h2>
          </div>

          <div className="space-y-4">
            {dimensions.map((d) => (
              <div key={d.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#202B3C]">{d.label}</span>
                  <span className="font-mono font-semibold tabular-nums text-[#202B3C]">
                    {d.value}%
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[#F7F9FC]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${d.value}%`,
                      backgroundColor:
                        d.value >= 75 ? '#16A34A' : d.value >= 50 ? '#D97706' : '#DC2626',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Required Equipment Status */}
          <div className="mt-6 border-t border-[#E6EAF0] pt-4">
            <h3 className="mb-2.5 text-xs font-semibold text-[#202B3C]">
              Required Project Hardware
            </h3>
            <div className="space-y-2">
              {project.requiredEquipmentIds.map((eqId) => {
                const eq = db.equipment.find((e) => e.id === eqId);
                if (!eq) return null;
                const openUnits = db.physicalUnits.filter(
                  (u) => u.equipmentId === eq.id && u.status === 'available'
                ).length;
                return (
                  <div
                    key={eq.id}
                    className="flex items-center justify-between rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] px-3.5 py-2 text-xs"
                  >
                    <span className="font-medium text-[#202B3C]">{eq.name}</span>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        label={`${openUnits} open`}
                        tone={openUnits > 0 ? 'success' : 'warning'}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          openBookingModal({ equipmentId: eq.id, projectId: project.id })
                        }
                        className="font-medium text-[#3978E8] hover:underline"
                      >
                        Book
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* What-If Simulator & Risks */}
        <section className="space-y-4 lg:col-span-5">
          <div className="rounded-2xl border border-[#E6EAF0] bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#202B3C]">
                <SlidersHorizontal className="h-4 w-4 text-[#3978E8]" />
                <span>Interactive What-If Analysis</span>
              </span>
              {delta !== 0 && (
                <span
                  className={`rounded-lg px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${
                    delta > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {delta > 0 ? `+${delta}` : delta} pts
                </span>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between">
                  <label className="font-medium text-[#202B3C]">Extend Deadline Buffer</label>
                  <span className="font-mono tabular-nums text-[#3978E8]">+{extraDays} days</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={14}
                  value={extraDays}
                  onChange={(e) => setExtraDays(Number(e.target.value))}
                  className="mt-1.5 w-full accent-[#3978E8]"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#E6EAF0] p-2.5">
                <input
                  type="checkbox"
                  checked={substituteFaulty}
                  onChange={(e) => setSubstituteFaulty(e.target.checked)}
                  className="accent-[#3978E8]"
                />
                <span>Simulate substituting busy/faulty units with compatible alternatives</span>
              </label>

              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#E6EAF0] p-2.5">
                <input
                  type="checkbox"
                  checked={assumeTraining}
                  onChange={(e) => setAssumeTraining(e.target.checked)}
                  className="accent-[#3978E8]"
                />
                <span>Simulate completing pending safety certifications</span>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E6EAF0] bg-white p-5 space-y-3">
            <h3 className="text-sm font-semibold text-[#202B3C]">
              Identified Risks & Missing Resources
            </h3>
            {activeReport.missingResources.length === 0 && activeReport.technicalRisks.length === 0 ? (
              <p className="flex items-center gap-2 text-xs text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                No blocking resource shortages or technical risks detected.
              </p>
            ) : (
              <ul className="space-y-2 text-xs text-rose-800">
                {[...activeReport.missingResources, ...activeReport.technicalRisks].map((r, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-xl bg-rose-50 p-2.5">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="pt-2 text-sm font-semibold text-[#202B3C]">Recommendations</h3>
            <ul className="space-y-2 text-xs text-[#285EC7]">
              {activeReport.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 rounded-xl bg-[#EAF2FF] p-2.5">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3978E8]" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
};
