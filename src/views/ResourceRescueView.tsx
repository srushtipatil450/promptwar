import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarClock,
  CheckCircle2,
  GitBranch,
  Hourglass,
  Layers,
  LifeBuoy,
  Sparkles,
} from 'lucide-react';
import { useLabLink } from '../context/LabLinkContext';
import { recommendationService, RescueAlternativeOption } from '../services/recommendationService';
import { StaggerCard } from '../components/shared/MotionPrimitives';
import { StatusBadge } from '../components/shared/StatusBadge';

const KIND_LABELS: Record<RescueAlternativeOption['kind'], string> = {
  verified_substitute: 'Compatible Substitute',
  cross_dept_borrow: 'Cross-Department Borrow',
  open_time_slot: 'Open Time Window',
  multi_tool_combination: 'Multi-Tool Combination',
  plan_adjustment: 'Plan Adjustment',
};

const KIND_TONES: Record<
  RescueAlternativeOption['kind'],
  'success' | 'lavender' | 'info' | 'warning' | 'neutral'
> = {
  verified_substitute: 'success',
  cross_dept_borrow: 'lavender',
  open_time_slot: 'info',
  multi_tool_combination: 'warning',
  plan_adjustment: 'neutral',
};

export const ResourceRescueView: React.FC = () => {
  const {
    db,
    currentUser,
    focusedEquipmentId,
    openBookingModal,
    joinWaitingList,
    swapProjectEquipment,
    setActiveView,
  } = useLabLink();

  const defaultBusyEq = useMemo(() => {
    const busy = db.equipment.find((eq) => {
      const units = db.physicalUnits.filter((u) => u.equipmentId === eq.id);
      return units.every((u) => u.status !== 'available');
    });
    return busy?.id ?? db.equipment[0]?.id ?? 'eq-oscilloscope';
  }, [db.equipment, db.physicalUnits]);

  const [equipmentId, setEquipmentId] = useState(focusedEquipmentId ?? defaultBusyEq);
  const [date, setDate] = useState('2026-11-23');
  const [startHour, setStartHour] = useState(10);
  const [endHour, setEndHour] = useState(13);
  const [projectId, setProjectId] = useState<string>(
    db.projects.find((p) => p.ownerId === currentUser.id)?.id ?? db.projects[0]?.id ?? ''
  );

  useEffect(() => {
    if (focusedEquipmentId) {
      setEquipmentId(focusedEquipmentId);
    }
  }, [focusedEquipmentId]);

  const rescue = useMemo(
    () =>
      recommendationService.runResourceRescue(db, {
        equipmentId,
        date,
        startHour,
        endHour,
        userId: currentUser.id,
        projectId: projectId || null,
      }),
    [db, equipmentId, date, startHour, endHour, currentUser.id, projectId]
  );

  const editableProjects = useMemo(
    () =>
      currentUser.role === 'student'
        ? db.projects.filter((p) => p.ownerId === currentUser.id)
        : db.projects,
    [db.projects, currentUser]
  );

  return (
    <div className="space-y-6">
      {/* Rescue Parameters Selector */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
              <LifeBuoy className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#202B3C]">
                Intelligent Resource Rescue
              </h2>
              <p className="text-xs text-[#718096]">
                Recovers blocked schedules using verified substitutes, cross-department lending,
                open windows, and multi-instrument pairings
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveView('compatibility-graph')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6EAF0] bg-white px-3.5 py-2 text-xs font-medium text-[#202B3C] hover:bg-[#F7F9FC]"
          >
            <GitBranch className="h-3.5 w-3.5 text-[#3978E8]" />
            <span>View Compatibility Graph</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <label className="mb-1 block text-xs font-medium text-[#202B3C]">
              Unavailable / Desired Instrument
            </label>
            <select
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-xs text-[#202B3C]"
            >
              {db.equipment.map((eq) => {
                const open = db.physicalUnits.filter(
                  (u) => u.equipmentId === eq.id && u.status === 'available'
                ).length;
                return (
                  <option key={eq.id} value={eq.id}>
                    {eq.name} ({open} open)
                  </option>
                );
              })}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[#202B3C]">Target Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-[#E6EAF0] px-3 py-2 text-xs tabular-nums text-[#202B3C]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[#202B3C]">Window</label>
            <div className="flex items-center gap-1">
              <select
                value={startHour}
                onChange={(e) => {
                  const s = Number(e.target.value);
                  setStartHour(s);
                  if (endHour <= s) setEndHour(Math.min(20, s + 2));
                }}
                className="w-full rounded-xl border border-[#E6EAF0] bg-white px-2 py-2 text-xs tabular-nums"
              >
                {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((h) => (
                  <option key={h} value={h}>
                    {h}:00
                  </option>
                ))}
              </select>
              <select
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
                className="w-full rounded-xl border border-[#E6EAF0] bg-white px-2 py-2 text-xs tabular-nums"
              >
                {[9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
                  .filter((h) => h > startHour)
                  .map((h) => (
                    <option key={h} value={h}>
                      {h}:00
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="md:col-span-4">
            <label className="mb-1 block text-xs font-medium text-[#202B3C]">
              Apply Substitutions to Project (Optional)
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-xs text-[#202B3C]"
            >
              <option value="">Standalone Rescue Session</option>
              {editableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Blocker Diagnosis Card */}
      <section
        className={`rounded-2xl border p-5 ${
          rescue.isDirectlyAvailable
            ? 'border-emerald-200 bg-emerald-50/70'
            : 'border-amber-200 bg-amber-50/70'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              {rescue.isDirectlyAvailable ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
              <h3 className="text-sm font-semibold text-[#202B3C]">
                {rescue.isDirectlyAvailable
                  ? `Direct Slot Open (${rescue.directOpenUnitCode}) — Backup Options Also Listed`
                  : `Constraint Detected for ${rescue.targetEquipmentName}`}
              </h3>
            </div>
            <ul className="space-y-1 text-xs text-[#526075]">
              {rescue.blockerSummary.map((line, i) => (
                <li key={i}>• {line}</li>
              ))}
            </ul>
          </div>

          {!rescue.isDirectlyAvailable && (
            <button
              type="button"
              onClick={() => {
                const res = joinWaitingList({
                  equipmentId: rescue.targetEquipmentId,
                  projectId: projectId || null,
                  desiredDate: date,
                  startHour,
                  endHour,
                });
                if (res.ok) setActiveView('waiting-list');
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100 shrink-0"
            >
              <Hourglass className="h-3.5 w-3.5" />
              <span>Join Smart Waiting List</span>
            </button>
          )}
        </div>
      </section>

      {/* Rescue Suggestions Grid */}
      {rescue.suggestions.length === 0 ? (
        <div className="rounded-2xl border border-[#E6EAF0] bg-white p-10 text-center text-xs text-[#718096]">
          No immediate recovery candidates found for this window. Try expanding to another day or
          joining the Smart Waiting List.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {rescue.suggestions.map((opt, idx) => (
            <StaggerCard
              key={`${opt.kind}-${opt.equipmentId}-${opt.recommendedDate}-${opt.recommendedStartHour}-${idx}`}
              index={idx}
              className="flex flex-col justify-between rounded-2xl border border-[#E6EAF0] bg-white p-5"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge label={KIND_LABELS[opt.kind]} tone={KIND_TONES[opt.kind]} />
                  <span className="font-mono text-[11px] font-semibold text-[#5B47C7]">
                    {opt.confidenceLabel}
                  </span>
                </div>

                <h4 className="mt-2.5 text-sm font-semibold text-[#202B3C]">{opt.title}</h4>
                <p className="mt-1 text-xs font-medium text-[#3978E8]">
                  {opt.equipmentName}
                  {opt.secondaryEquipmentName ? ` + ${opt.secondaryEquipmentName}` : ''} ·{' '}
                  {opt.departmentCode} · {opt.laboratoryCode}
                </p>

                <div className="mt-3 rounded-xl bg-[#F7F9FC] p-3 text-xs space-y-1.5">
                  <p className="text-[#202B3C]">
                    <strong>Why this rescues your schedule:</strong> {opt.reason}
                  </p>
                  <p className="text-[#526075]">
                    <strong>Adapter / Trade-off:</strong> {opt.tradeoffOrAdapter}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E6EAF0] pt-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px] tabular-nums text-[#718096]">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5 text-[#3978E8]" />
                    {opt.recommendedDate} · {opt.recommendedStartHour}:00–{opt.recommendedEndHour}:00
                  </span>
                  {opt.openUnitCode && (
                    <span className="inline-flex items-center gap-1 font-mono font-semibold text-emerald-700">
                      <Layers className="h-3 w-3" />
                      {opt.openUnitCode}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {opt.canApplyToProject &&
                    projectId &&
                    opt.equipmentId !== rescue.targetEquipmentId && (
                      <button
                        type="button"
                        onClick={() =>
                          swapProjectEquipment(projectId, rescue.targetEquipmentId, opt.equipmentId)
                        }
                        className="inline-flex items-center gap-1 rounded-xl border border-[#E6EAF0] bg-white px-3 py-1.5 text-xs font-medium text-[#202B3C] hover:bg-[#F7F9FC]"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5 text-[#3978E8]" />
                        <span>Swap in Project</span>
                      </button>
                    )}

                  <button
                    type="button"
                    onClick={() =>
                      openBookingModal({
                        equipmentId: opt.equipmentId,
                        projectId: projectId || null,
                        date: opt.recommendedDate,
                        startHour: opt.recommendedStartHour,
                        endHour: opt.recommendedEndHour,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-xl bg-[#3978E8] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#2E67CE]"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{opt.requiresCrossDept ? 'Request Cross-Dept' : 'Book Rescue Slot'}</span>
                  </button>
                </div>
              </div>
            </StaggerCard>
          ))}
        </div>
      )}
    </div>
  );
};
