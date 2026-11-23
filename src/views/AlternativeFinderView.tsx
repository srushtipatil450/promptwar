import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, CheckCircle2, HelpCircle } from 'lucide-react';
import { useLabLink } from '../context/LabLinkContext';
import { recommendationService } from '../services/recommendationService';
import { MagneticButton, MagneticTiltCard } from '../components/shared/MotionPrimitives';
import { StatusBadge } from '../components/shared/StatusBadge';

export const AlternativeFinderView: React.FC = () => {
  const { db, focusedEquipmentId, openBookingModal, setActiveView } = useLabLink();
  const [selectedId, setSelectedId] = useState(
    focusedEquipmentId ?? db.equipment[0]?.id ?? 'eq-oscilloscope'
  );

  useEffect(() => {
    if (focusedEquipmentId) {
      setSelectedId(focusedEquipmentId);
    }
  }, [focusedEquipmentId]);

  const source = useMemo(
    () => db.equipment.find((e) => e.id === selectedId) ?? db.equipment[0],
    [db.equipment, selectedId]
  );

  const sourceUnits = useMemo(
    () => db.physicalUnits.filter((u) => u.equipmentId === source.id),
    [db.physicalUnits, source.id]
  );

  const alternatives = useMemo(
    () => recommendationService.findAlternatives(db, source.id),
    [db, source.id]
  );

  return (
    <div className="space-y-6">
      {/* Selector Bar */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-[#202B3C]">
              Target Unavailable or Constrained Equipment
            </label>
            <select
              value={source.id}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full max-w-xl rounded-xl border border-[#E6EAF0] bg-white px-3.5 py-2.5 text-sm text-[#202B3C] focus:border-[#3978E8] focus:outline-none"
            >
              {db.equipment.map((eq) => {
                const openCount = db.physicalUnits.filter(
                  (u) => u.equipmentId === eq.id && u.status === 'available'
                ).length;
                return (
                  <option key={eq.id} value={eq.id}>
                    {eq.name} ({openCount} open unit(s))
                  </option>
                );
              })}
            </select>
          </div>

          <div className="rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] px-4 py-2.5 text-xs">
            <p className="font-medium text-[#202B3C]">
              Target Specs: {source.specs.voltage} · {source.specs.interfaceType}
            </p>
            <p className="mt-0.5 text-[#718096]">
              Precision: {source.specs.precision} · {sourceUnits.length} physical unit(s)
            </p>
          </div>
        </div>
      </section>

      {/* Alternatives List */}
      {alternatives.length === 0 ? (
        <div className="rounded-2xl border border-[#E6EAF0] bg-white p-10 text-center">
          <p className="text-sm font-semibold text-[#202B3C]">No compatible substitutes indexed</p>
          <p className="mt-1 text-xs text-[#718096]">
            Join the Smart Waiting List for {source.name} or inspect the Compatibility Graph.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {alternatives.map((alt, idx) => {
            const lab = db.laboratories.find((l) => l.id === alt.equipment.laboratoryId);
            const dept = db.departments.find((d) => d.id === alt.equipment.departmentId);
            const isVerified = alt.compatibilityLevel === 'verified';
            const isConditional = alt.compatibilityLevel === 'conditional';

            return (
              <MagneticTiltCard
                key={alt.equipment.id}
                index={idx}
                maxTilt={2.2}
                className="rounded-2xl border border-[#E6EAF0] bg-white p-6"
              >
                <div className="relative z-10 flex flex-col justify-between gap-4 border-b border-[#E6EAF0] pb-4 md:flex-row md:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        label={alt.confidenceLabel}
                        tone={isVerified ? 'success' : isConditional ? 'warning' : 'neutral'}
                        icon={isVerified ? 'check' : isConditional ? 'warn' : 'none'}
                      />
                      <span className="text-xs text-[#718096]">
                        {dept?.code} · {lab?.code} · {alt.equipment.model}
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-[#202B3C]">
                      {alt.equipment.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <StatusBadge
                      label={`${alt.availableUnits}/${alt.totalUnits} Open`}
                      tone={alt.availableUnits > 0 ? 'success' : 'error'}
                    />
                    <MagneticButton
                      onClick={() => openBookingModal({ equipmentId: alt.equipment.id })}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#3978E8] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#2E67CE]"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover/magbtn:rotate-180" />
                      <span>Request Alternative</span>
                    </MagneticButton>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold text-[#202B3C]">Specification Comparison</p>
                    <dl className="mt-2 space-y-1 text-xs">
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#718096]">Voltage:</dt>
                        <dd className="font-mono text-[#202B3C]">{alt.equipment.specs.voltage}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#718096]">Interface:</dt>
                        <dd className="text-right text-[#202B3C]">
                          {alt.equipment.specs.interfaceType}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#718096]">Precision:</dt>
                        <dd className="text-right text-[#202B3C]">
                          {alt.equipment.specs.precision}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-emerald-700">Advantages</p>
                    <ul className="mt-2 space-y-1 text-xs text-[#526075]">
                      {alt.advantages.map((adv, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          <span>{adv}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-amber-800">
                      Limitations & Required Modifications
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-[#526075]">
                      {alt.limitations.map((lim, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          {isConditional ? (
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                          ) : (
                            <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#718096]" />
                          )}
                          <span>{lim}</span>
                        </li>
                      ))}
                      <li className="mt-2 rounded-lg bg-[#F7F9FC] px-2.5 py-1.5 text-[11px] font-medium text-[#202B3C]">
                        Adapter / Setup: {alt.requiredModifications}
                      </li>
                    </ul>
                  </div>
                </div>
              </MagneticTiltCard>
            );
          })}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setActiveView('compatibility-graph')}
          className="text-xs font-medium text-[#3978E8] hover:underline"
        >
          Inspect full hardware Compatibility Graph
        </button>
      </div>
    </div>
  );
};
