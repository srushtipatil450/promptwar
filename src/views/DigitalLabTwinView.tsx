import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  CalendarClock,
  Layers,
  LifeBuoy,
  QrCode,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLabLink } from '../context/LabLinkContext';
import { safetyService } from '../services/safetyService';
import type { TwinBenchNode } from '../components/shared/LabTwinThreeScene';
import { MagneticButton } from '../components/shared/MotionPrimitives';
import { StatusBadge, unitStatusLabel, unitStatusTone } from '../components/shared/StatusBadge';

const LazyLabTwinThreeScene = lazy(() => import('../components/shared/LabTwinThreeScene'));

export const DigitalLabTwinView: React.FC = () => {
  const {
    db,
    currentUser,
    focusedEquipmentId,
    setFocusedEquipmentId,
    setFocusedUnitId,
    openBookingModal,
    setActiveView,
  } = useLabLink();

  const initialLabId = useMemo(() => {
    if (focusedEquipmentId) {
      const eq = db.equipment.find((e) => e.id === focusedEquipmentId);
      if (eq) return eq.laboratoryId;
    }
    return db.laboratories[0]?.id ?? 'lab-ece-signals';
  }, [db.equipment, db.laboratories, focusedEquipmentId]);

  const [selectedLabId, setSelectedLabId] = useState(initialLabId);
  const [viewMode, setViewMode] = useState<'3d' | 'isometric'>('3d');
  const [webglBlocked, setWebglBlocked] = useState(false);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [hoveredBench, setHoveredBench] = useState<{
    equipmentId: string;
    x: number;
    y: number;
  } | null>(null);

  const selectedLab =
    db.laboratories.find((l) => l.id === selectedLabId) ?? db.laboratories[0];
  const selectedBuilding = db.buildings.find((b) => b.id === selectedLab?.buildingId);

  const labNodes: TwinBenchNode[] = useMemo(() => {
    if (!selectedLab) return [];
    return db.equipment
      .filter((e) => e.laboratoryId === selectedLab.id)
      .map((eq, benchIndex) => {
        const units = db.physicalUnits.filter((u) => u.equipmentId === eq.id);
        const availableCount = units.filter((u) => u.status === 'available').length;
        const maintCount = units.filter(
          (u) => u.status === 'maintenance' || u.status === 'faulty'
        ).length;
        return { equipment: eq, units, benchIndex, availableCount, maintCount };
      });
  }, [db.equipment, db.physicalUnits, selectedLab]);

  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>(
    focusedEquipmentId && labNodes.some((n) => n.equipment.id === focusedEquipmentId)
      ? focusedEquipmentId
      : (labNodes[0]?.equipment.id ?? '')
  );

  useEffect(() => {
    setHoveredBench(null);
    if (!labNodes.some((n) => n.equipment.id === selectedEquipmentId)) {
      setSelectedEquipmentId(labNodes[0]?.equipment.id ?? '');
    }
  }, [labNodes, selectedEquipmentId]);

  const selectedNode =
    labNodes.find((n) => n.equipment.id === selectedEquipmentId) ?? labNodes[0] ?? null;
  const hoveredNode = hoveredBench
    ? labNodes.find((n) => n.equipment.id === hoveredBench.equipmentId) ?? null
    : null;

  const readiness = useMemo(() => {
    if (!selectedNode) return null;
    return safetyService.evaluateUserReadiness(
      db,
      currentUser.id,
      selectedNode.equipment,
      selectedLab
    );
  }, [db, currentUser.id, selectedNode, selectedLab]);

  const activeMaintRecords = useMemo(() => {
    if (!selectedNode) return [];
    const unitIds = new Set(selectedNode.units.map((u) => u.id));
    return db.maintenanceRecords.filter((m) => unitIds.has(m.unitId) && m.status !== 'resolved');
  }, [db.maintenanceRecords, selectedNode]);

  const handleWebglUnavailable = useCallback(() => {
    setWebglBlocked(true);
    setViewMode('isometric');
  }, []);

  return (
    <div className="space-y-6">
      {/* Header & Lab Switcher */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Box className="h-4 w-4 text-[#3978E8]" />
              <h2 className="text-base font-semibold text-[#202B3C]">
                Interactive Digital Laboratory Twin
              </h2>
              <StatusBadge label="Illustrative Inventory Layout" tone="lavender" />
            </div>
            <p className="mt-1 text-xs text-[#718096]">
              Hover or click any laboratory workbench or instrument to inspect live unit statuses,
              technical specifications, maintenance lockouts, and safety readiness. Layout is
              illustrative of LabLink inventory and does not depict actual physical room CAD
              coordinates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-1">
              {!webglBlocked && (
                <button
                  type="button"
                  onClick={() => setViewMode('3d')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === '3d'
                      ? 'bg-white text-[#3978E8] shadow-xs'
                      : 'text-[#718096] hover:text-[#202B3C]'
                  }`}
                >
                  3D Studio Twin
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewMode('isometric')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'isometric'
                    ? 'bg-white text-[#3978E8] shadow-xs'
                    : 'text-[#718096] hover:text-[#202B3C]'
                }`}
              >
                Isometric Blueprint
              </button>
            </div>

            {viewMode === '3d' && !webglBlocked && (
              <MagneticButton
                strength={3}
                onClick={() => setResetTrigger((n) => n + 1)}
                className="inline-flex items-center gap-1 rounded-xl border border-[#E6EAF0] bg-white px-3 py-1.5 text-xs font-medium text-[#202B3C] hover:border-[#C9DDFE] hover:bg-[#F7F9FC]"
              >
                <RotateCcw className="h-3.5 w-3.5 text-[#3978E8] transition-transform duration-200 group-hover/magbtn:-rotate-45" />
                <span>Reset Camera</span>
              </MagneticButton>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {db.laboratories.map((lab) => {
            const isSel = lab.id === selectedLab?.id;
            const openUnits = db.physicalUnits.filter(
              (u) => u.laboratoryId === lab.id && u.status === 'available'
            ).length;
            return (
              <button
                key={lab.id}
                type="button"
                onClick={() => setSelectedLabId(lab.id)}
                className={`rounded-xl border px-3 py-2 text-left text-xs transition-all duration-150 hover:-translate-y-0.5 ${
                  isSel
                    ? 'border-[#3978E8] bg-[#EAF2FF] text-[#285EC7]'
                    : 'border-[#E6EAF0] bg-[#F7F9FC] text-[#202B3C] hover:border-[#3978E8]'
                }`}
              >
                <span className="font-mono font-semibold">{lab.code}</span> · {lab.name}
                <span className="ml-2 text-[11px] opacity-80">({openUnits} open)</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Split: 3D/Isometric Viewport + Live Equipment Inspector */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-2xl border border-[#E6EAF0] bg-white p-5 lg:col-span-7 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#202B3C]">
                {selectedLab?.code} — {selectedLab?.name}
              </h3>
              <p className="text-xs text-[#718096]">
                {selectedBuilding?.name} · Floor {selectedLab?.floor} · Room{' '}
                {selectedLab?.roomNumber} ·{' '}
                {viewMode === '3d' && !webglBlocked
                  ? 'Drag to orbit, scroll to zoom, hover or click any workbench'
                  : 'Hover or click any isometric workbench station to inspect equipment'}
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[#526075]">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Open
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#3978E8]" />
                Booked
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                Maint. Lock
              </span>
            </div>
          </div>

          <div className="relative">
            {viewMode === '3d' && !webglBlocked ? (
              <Suspense
                fallback={
                  <div className="flex h-[420px] items-center justify-center rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] text-xs text-[#718096]">
                    Initializing 3D Digital Laboratory Twin...
                  </div>
                }
              >
                <LazyLabTwinThreeScene
                  nodes={labNodes}
                  selectedEquipmentId={selectedEquipmentId}
                  onSelectEquipment={setSelectedEquipmentId}
                  onHoverEquipment={setHoveredBench}
                  onWebglUnavailable={handleWebglUnavailable}
                  resetTrigger={resetTrigger}
                />
              </Suspense>
            ) : (
              <div
                className="relative rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-4"
                onMouseLeave={() => setHoveredBench(null)}
              >
                <svg viewBox="0 0 760 400" className="w-full h-[388px]">
                  {/* Isometric Room Floor Diamond */}
                  <polygon
                    points="380,35 710,185 380,355 50,185"
                    fill="#FFFFFF"
                    stroke="#CBD5E1"
                    strokeWidth="2"
                  />
                  <polygon
                    points="380,55 680,190 380,335 80,190"
                    fill="#F7F9FC"
                    stroke="#E6EAF0"
                    strokeWidth="1.2"
                  />
                  <text x="380" y="24" textAnchor="middle" fontSize="11" fill="#718096" fontWeight="600">
                    {selectedLab?.code} · ILLUSTRATIVE ISOMETRIC BENCH SCHEMATIC
                  </text>

                  {labNodes.map((node, idx) => {
                    const col = idx % 2;
                    const row = Math.floor(idx / 2);
                    const isoX = 270 + col * 200 - row * 70;
                    const isoY = 140 + row * 95 + col * 42;
                    const isSelected = node.equipment.id === selectedNode?.equipment.id;
                    const isHovered = node.equipment.id === hoveredBench?.equipmentId;
                    const statusColor =
                      node.availableCount > 0
                        ? '#16A34A'
                        : node.maintCount === node.units.length
                          ? '#D97706'
                          : '#3978E8';

                    return (
                      <motion.g
                        key={node.equipment.id}
                        onClick={() => setSelectedEquipmentId(node.equipment.id)}
                        onMouseEnter={(e) => {
                          const parentRect = (
                            e.currentTarget.ownerSVGElement?.parentElement
                          )?.getBoundingClientRect();
                          if (parentRect) {
                            setHoveredBench({
                              equipmentId: node.equipment.id,
                              x: e.clientX - parentRect.left,
                              y: e.clientY - parentRect.top,
                            });
                          }
                        }}
                        animate={{ y: isHovered ? -4 : 0 }}
                        transition={{ duration: 0.16 }}
                        className="cursor-pointer"
                      >
                        {/* Workbench isometric prism */}
                        <polygon
                          points={`${isoX},${isoY - 26} ${isoX + 86},${isoY + 12} ${isoX},${isoY + 50} ${isoX - 86},${isoY + 12}`}
                          fill={isSelected ? '#EAF2FF' : isHovered ? '#F5F8FF' : '#FFFFFF'}
                          stroke={isSelected || isHovered ? '#3978E8' : '#94A3B8'}
                          strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5}
                        />
                        <polygon
                          points={`${isoX - 86},${isoY + 12} ${isoX},${isoY + 50} ${isoX},${isoY + 68} ${isoX - 86},${isoY + 30}`}
                          fill="#E2E8F0"
                          stroke="#94A3B8"
                          strokeWidth="1"
                        />
                        <polygon
                          points={`${isoX},${isoY + 50} ${isoX + 86},${isoY + 12} ${isoX + 86},${isoY + 30} ${isoX},${isoY + 68}`}
                          fill="#CBD5E1"
                          stroke="#94A3B8"
                          strokeWidth="1"
                        />
                        {/* Status indicator dot on bench */}
                        <circle cx={isoX} cy={isoY + 8} r="7" fill={statusColor} />
                        <text
                          x={isoX}
                          y={isoY - 34}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="700"
                          fill={isSelected || isHovered ? '#285EC7' : '#202B3C'}
                        >
                          {node.units[0]?.unitCode ?? 'BENCH'} ·{' '}
                          {node.equipment.name.slice(0, 22)}
                        </text>
                      </motion.g>
                    );
                  })}
                </svg>
              </div>
            )}

            {/* Crisp solid-white floating equipment tooltip (no backdrop-blur over WebGL) */}
            {hoveredBench && hoveredNode && (
              <div
                className="pointer-events-none absolute z-20 w-56 rounded-xl border border-[#C9DDFE] bg-white px-3 py-2.5 shadow-md"
                style={{
                  left: Math.min(Math.max(hoveredBench.x + 14, 12), 420),
                  top: Math.max(hoveredBench.y - 68, 10),
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-[#202B3C] leading-snug">
                    {hoveredNode.equipment.name}
                  </p>
                  <StatusBadge
                    label={`${hoveredNode.availableCount}/${hoveredNode.units.length}`}
                    tone={hoveredNode.availableCount > 0 ? 'success' : 'warning'}
                  />
                </div>
                <p className="mt-1 font-mono text-[10px] text-[#718096]">
                  {hoveredNode.units.map((u) => u.unitCode).join(', ')} · Room{' '}
                  {selectedLab?.roomNumber}
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-[#3978E8]">
                  Click workbench to inspect specs & book
                </p>
              </div>
            )}
          </div>

          {/* Quick Bench Selector Strip */}
          <div className="flex flex-wrap gap-2 pt-1">
            {labNodes.map((node) => {
              const isSelected = node.equipment.id === selectedNode?.equipment.id;
              return (
                <button
                  key={node.equipment.id}
                  type="button"
                  onClick={() => setSelectedEquipmentId(node.equipment.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all duration-150 hover:-translate-y-0.5 ${
                    isSelected
                      ? 'border-[#3978E8] bg-[#EAF2FF] text-[#285EC7]'
                      : 'border-[#E6EAF0] bg-[#F7F9FC] text-[#202B3C] hover:border-[#3978E8]'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      node.availableCount > 0
                        ? 'bg-emerald-500'
                        : node.maintCount === node.units.length
                          ? 'bg-amber-500'
                          : 'bg-[#3978E8]'
                    }`}
                  />
                  <span>{node.equipment.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Equipment Telemetry & Action Inspector */}
        <section className="rounded-2xl border border-[#E6EAF0] bg-white p-5 lg:col-span-5">
          {selectedNode ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-[#E6EAF0] pb-4">
                <div>
                  <p className="text-xs font-medium text-[#3978E8]">
                    {selectedLab?.code} · Room {selectedLab?.roomNumber} ·{' '}
                    {selectedNode.equipment.category}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-[#202B3C]">
                    {selectedNode.equipment.name}
                  </h3>
                  <p className="text-xs text-[#718096]">
                    {selectedNode.equipment.manufacturer} · {selectedNode.equipment.model}
                  </p>
                </div>
                <StatusBadge
                  label={`${selectedNode.availableCount}/${selectedNode.units.length} Open`}
                  tone={selectedNode.availableCount > 0 ? 'success' : 'warning'}
                />
              </div>

              <p className="text-xs leading-relaxed text-[#526075]">
                {selectedNode.equipment.description}
              </p>

              {/* Technical Specifications */}
              <div className="rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-3.5 text-xs space-y-1.5">
                <p className="font-semibold text-[#202B3C]">Hardware Specifications</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-[#718096]">Voltage / Supply:</span>
                  <span className="font-mono text-[#202B3C]">
                    {selectedNode.equipment.specs.voltage}
                  </span>
                  <span className="text-[#718096]">Interface:</span>
                  <span className="text-[#202B3C]">
                    {selectedNode.equipment.specs.interfaceType}
                  </span>
                  <span className="text-[#718096]">Precision:</span>
                  <span className="text-[#202B3C]">{selectedNode.equipment.specs.precision}</span>
                  <span className="text-[#718096]">Footprint:</span>
                  <span className="font-mono text-[#202B3C]">
                    {selectedNode.equipment.specs.footprint}
                  </span>
                </div>
              </div>

              {/* Serialized Units */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[#202B3C]">
                  <Layers className="h-3.5 w-3.5 text-[#3978E8]" />
                  <span>Bench Units ({selectedNode.units.length})</span>
                </p>
                <div className="space-y-1.5">
                  {selectedNode.units.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between rounded-xl border border-[#E6EAF0] px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="font-mono font-semibold text-[#202B3C]">
                          {u.unitCode}
                        </span>
                        <span className="ml-2 text-[11px] text-[#718096]">
                          Cond {u.conditionScore}% · {u.measuredUsageHours}h logged
                        </span>
                      </div>
                      <StatusBadge label={unitStatusLabel(u.status)} tone={unitStatusTone(u.status)} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Safety & Maintenance Status */}
              <div className="space-y-2">
                {readiness && (
                  <div
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${
                      readiness.eligible
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-rose-200 bg-rose-50 text-rose-800'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      {readiness.eligible ? (
                        <ShieldCheck className="h-4 w-4" />
                      ) : (
                        <ShieldAlert className="h-4 w-4" />
                      )}
                      Safety Gate: {readiness.statusLabel}
                    </span>
                    {!readiness.eligible && (
                      <button
                        type="button"
                        onClick={() => setActiveView('safety-readiness')}
                        className="underline font-medium"
                      >
                        Complete Training
                      </button>
                    )}
                  </div>
                )}

                {activeMaintRecords.length > 0 && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <Wrench className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                      {activeMaintRecords.length} active maintenance ticket(s):{' '}
                      {activeMaintRecords[0].issueTitle}
                    </span>
                  </div>
                )}
              </div>

              {/* Direct Actions */}
              <div className="flex flex-wrap gap-2 border-t border-[#E6EAF0] pt-4">
                <MagneticButton
                  onClick={() =>
                    openBookingModal({ equipmentId: selectedNode.equipment.id })
                  }
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#3978E8] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#2E67CE]"
                >
                  <CalendarClock className="h-3.5 w-3.5 transition-transform duration-150 group-hover/magbtn:scale-110" />
                  <span>Request / Book</span>
                </MagneticButton>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedNode.units[0]) setFocusedUnitId(selectedNode.units[0].id);
                    setActiveView('equipment-tracking');
                  }}
                  className="group/act inline-flex items-center gap-1.5 rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-xs font-medium text-[#202B3C] transition-colors hover:border-[#C9DDFE] hover:bg-[#F7F9FC]"
                >
                  <QrCode className="h-3.5 w-3.5 text-[#3978E8] transition-transform duration-150 group-hover/act:scale-110" />
                  <span>QR Details</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFocusedEquipmentId(selectedNode.equipment.id);
                    setActiveView('resource-rescue');
                  }}
                  className="group/act inline-flex items-center gap-1.5 rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-xs font-medium text-[#202B3C] transition-colors hover:border-[#C9DDFE] hover:bg-[#F7F9FC]"
                >
                  <LifeBuoy className="h-3.5 w-3.5 text-amber-600 transition-transform duration-150 group-hover/act:rotate-12" />
                  <span>Rescue</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="py-12 text-center text-xs text-[#718096]">
              No equipment records registered in this laboratory.
            </p>
          )}
        </section>
      </div>
    </div>
  );
};
