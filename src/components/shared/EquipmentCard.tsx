import React from 'react';
import { ArrowRight, GitBranch, Layers, ShieldCheck, Wrench } from 'lucide-react';
import { useLabLink } from '../../context/LabLinkContext';
import { safetyService } from '../../services/safetyService';
import { EquipmentItem } from '../../types/lablink';
import {
  MagneticButton,
  MagneticParallaxLayer,
  MagneticTiltCard,
} from './MotionPrimitives';
import { EquipmentIllustration } from './ScientificVisuals';
import { StatusBadge } from './StatusBadge';

export const EquipmentCard: React.FC<{
  equipment: EquipmentItem;
  highlightNote?: string;
  index?: number;
}> = ({ equipment, highlightNote, index = 0 }) => {
  const {
    db,
    currentUser,
    openBookingModal,
    setFocusedEquipmentId,
    setActiveView,
  } = useLabLink();

  const lab = db.laboratories.find((l) => l.id === equipment.laboratoryId);
  const dept = db.departments.find((d) => d.id === equipment.departmentId);
  const units = db.physicalUnits.filter((u) => u.equipmentId === equipment.id);
  const availableCount = units.filter((u) => u.status === 'available').length;
  const maintCount = units.filter(
    (u) => u.status === 'maintenance' || u.status === 'faulty'
  ).length;
  const readiness = safetyService.evaluateUserReadiness(db, currentUser.id, equipment, lab);

  return (
    <MagneticTiltCard
      index={index}
      className="flex flex-col justify-between rounded-2xl border border-[#E6EAF0] bg-white p-5"
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#718096]">
              {dept?.code} · {lab?.code} · {equipment.category}
            </p>
            <h3 className="mt-1 text-base font-semibold text-[#202B3C] leading-snug">
              {equipment.name}
            </h3>
            <p className="mt-0.5 text-xs text-[#718096]">
              {equipment.manufacturer} · {equipment.model}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <MagneticParallaxLayer depth={6}>
              <EquipmentIllustration category={equipment.category} />
            </MagneticParallaxLayer>
            <div className="transition-transform duration-200 group-hover/tilt:scale-[1.03]">
              <StatusBadge
                label={
                  availableCount > 0
                    ? `${availableCount}/${units.length} Open`
                    : maintCount === units.length
                      ? 'In Maintenance'
                      : '0 Open'
                }
                tone={availableCount > 0 ? 'success' : maintCount > 0 ? 'warning' : 'error'}
              />
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm text-[#526075] line-clamp-2">{equipment.description}</p>

        {/* Smooth slide-in spec strip on hover / keyboard focus */}
        <div className="grid grid-rows-[0fr] transition-[grid-template-rows,opacity] duration-200 opacity-0 group-hover/tilt:grid-rows-[1fr] group-hover/tilt:opacity-100 group-focus-within/tilt:grid-rows-[1fr] group-focus-within/tilt:opacity-100">
          <div className="overflow-hidden">
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] px-3 py-1.5 text-[11px] text-[#526075]">
              <span>
                <strong className="text-[#202B3C]">Supply:</strong>{' '}
                <span className="font-mono">{equipment.specs.voltage}</span>
              </span>
              <span className="text-[#CBD5E1]">•</span>
              <span className="truncate">
                <strong className="text-[#202B3C]">Precision:</strong> {equipment.specs.precision}
              </span>
            </div>
          </div>
        </div>

        {highlightNote && (
          <p className="mt-2.5 rounded-xl bg-[#EAF2FF] px-3 py-2 text-xs text-[#285EC7]">
            {highlightNote}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#E6EAF0] pt-3 text-xs text-[#718096]">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Layers className="h-3.5 w-3.5 text-[#3978E8]" />
            {units.map((u) => u.unitCode).join(', ')}
          </span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            {readiness.eligible ? 'Passport Ready' : readiness.statusLabel}
          </span>
          {maintCount > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-700">
              <Wrench className="h-3.5 w-3.5" />
              {maintCount} locked
            </span>
          )}
        </div>
      </div>

      <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2 pt-2">
        <MagneticButton
          onClick={() => openBookingModal({ equipmentId: equipment.id })}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#3978E8] px-3 py-2 text-xs font-medium text-white hover:bg-[#2E67CE] whitespace-nowrap"
        >
          <span>Request Booking</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover/magbtn:translate-x-1" />
        </MagneticButton>

        <MagneticButton
          strength={3}
          onClick={() => {
            setFocusedEquipmentId(equipment.id);
            setActiveView('alternative-finder');
          }}
          className="inline-flex items-center gap-1 rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-xs font-medium text-[#202B3C] hover:border-[#C9DDFE] hover:bg-[#F7F9FC] whitespace-nowrap"
        >
          <span>Alternatives</span>
        </MagneticButton>

        <button
          type="button"
          onClick={() => {
            setFocusedEquipmentId(equipment.id);
            setActiveView('compatibility-graph');
          }}
          title="Inspect Compatibility Graph"
          aria-label={`Inspect compatibility graph for ${equipment.name}`}
          className="group/graph inline-flex items-center justify-center rounded-xl border border-[#E6EAF0] bg-white p-2 text-[#718096] transition-colors hover:border-[#C9DDFE] hover:bg-[#EAF2FF] hover:text-[#3978E8]"
        >
          <GitBranch className="h-3.5 w-3.5 transition-transform duration-200 group-hover/graph:scale-110 group-hover/graph:rotate-12" />
        </button>
      </div>
    </MagneticTiltCard>
  );
};
