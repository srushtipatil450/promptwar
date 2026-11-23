import React, { useMemo, useState } from 'react';
import { Building2, Clock, List, Map, Navigation, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { useLabLink } from '../context/LabLinkContext';
import { EquipmentCard } from '../components/shared/EquipmentCard';
import {
  CursorSpotlightSection,
  MagneticTiltCard,
} from '../components/shared/MotionPrimitives';
import { CursorParticleField } from '../components/shared/ScientificVisuals';
import { StatusBadge } from '../components/shared/StatusBadge';

export const LabMapView: React.FC = () => {
  const { db } = useLabLink();
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(db.buildings[0]?.id ?? '');
  const [selectedLabId, setSelectedLabId] = useState<string>(db.laboratories[0]?.id ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [hoveredLabPreview, setHoveredLabPreview] = useState<{
    labId: string;
    xPct: number;
    yPct: number;
  } | null>(null);

  const filteredLabs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return db.laboratories.filter((lab) => {
      if (tierFilter !== 'all' && lab.safetyTier !== tierFilter) return false;
      if (q) {
        const bld = db.buildings.find((b) => b.id === lab.buildingId);
        const eqMatch = db.equipment.some(
          (e) => e.laboratoryId === lab.id && e.name.toLowerCase().includes(q)
        );
        return (
          lab.name.toLowerCase().includes(q) ||
          lab.code.toLowerCase().includes(q) ||
          (bld?.name.toLowerCase().includes(q) ?? false) ||
          eqMatch
        );
      }
      return true;
    });
  }, [db.laboratories, db.buildings, db.equipment, searchQuery, tierFilter]);

  const activeLab =
    filteredLabs.find((l) => l.id === selectedLabId) ?? filteredLabs[0] ?? null;
  const activeBuilding = activeLab
    ? db.buildings.find((b) => b.id === activeLab.buildingId)
    : undefined;
  const labEquipment = activeLab
    ? db.equipment.filter((e) => e.laboratoryId === activeLab.id)
    : [];

  const hoveredLabObj = hoveredLabPreview
    ? db.laboratories.find((l) => l.id === hoveredLabPreview.labId) ?? null
    : null;

  return (
    <div className="space-y-6">
      {/* Map Controls */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E6EAF0] bg-white p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search building, room, or instrument..."
            className="w-64 rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] px-3 py-1.5 text-xs text-[#202B3C] focus:border-[#3978E8] focus:bg-white focus:outline-none"
          />
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="rounded-xl border border-[#E6EAF0] bg-white px-3 py-1.5 text-xs text-[#202B3C]"
          >
            <option value="all">All Safety Tiers</option>
            <option value="standard">Standard Access</option>
            <option value="supervised">Supervised Tier</option>
            <option value="restricted">Restricted Access</option>
          </select>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-[#F7F9FC] p-1 border border-[#E6EAF0]">
          <button
            type="button"
            onClick={() => setViewMode('map')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'map'
                ? 'bg-white text-[#3978E8] shadow-xs'
                : 'text-[#718096] hover:text-[#202B3C]'
            }`}
          >
            <Map className="h-3.5 w-3.5" />
            <span>Campus Map</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-white text-[#3978E8] shadow-xs'
                : 'text-[#718096] hover:text-[#202B3C]'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span>Directory List</span>
          </button>
        </div>
      </section>

      {viewMode === 'map' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Interactive Campus SVG Map */}
          <CursorSpotlightSection
            spotlightRadius={360}
            className="rounded-2xl border border-[#E6EAF0] bg-white p-5 lg:col-span-7"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#202B3C]">
                  Interactive Engineering & Science Campus Plan
                </h2>
                <p className="text-xs text-[#718096]">
                  Hover or click a building or laboratory pin to inspect room hours, safety tier,
                  and live equipment
                </p>
              </div>
              <span className="text-xs text-[#718096]">North Quad / South Science Walk</span>
            </div>

            <div
              className="relative h-[380px] w-full overflow-hidden rounded-xl border border-[#E6EAF0] bg-[#F7F9FC]"
              onMouseLeave={() => setHoveredLabPreview(null)}
            >
              <CursorParticleField particleCount={14} />

              {/* Subtle walkway grid lines & animated pedestrian route to active building */}
              <svg className="relative z-10 h-full w-full" viewBox="0 0 800 420" preserveAspectRatio="none">
                <line x1="0" y1="210" x2="800" y2="210" stroke="#E6EAF0" strokeWidth="14" />
                <line x1="400" y1="0" x2="400" y2="420" stroke="#E6EAF0" strokeWidth="14" />
                <text x="20" y="205" fill="#718096" fontSize="11" fontWeight="500">
                  Central Campus Pedestrian Spine
                </text>
                {activeBuilding && (
                  <motion.path
                    key={activeBuilding.id}
                    d={`M 400 210 L ${Math.round(((activeBuilding.mapX + activeBuilding.widthPct / 2) / 100) * 800)} 210 L ${Math.round(((activeBuilding.mapX + activeBuilding.widthPct / 2) / 100) * 800)} ${Math.round(((activeBuilding.mapY + activeBuilding.heightPct / 2) / 100) * 420)}`}
                    fill="none"
                    stroke="#3978E8"
                    strokeWidth="3.5"
                    strokeDasharray="7 5"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0.4 }}
                    animate={{ pathLength: 1, opacity: 0.9 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
                <circle cx="400" cy="210" r="7" fill="#3978E8" />
              </svg>

              {/* Building Zones */}
              {db.buildings.map((bld) => {
                const labsInBld = filteredLabs.filter((l) => l.buildingId === bld.id);
                const isSelectedBld = selectedBuildingId === bld.id;

                return (
                  <motion.div
                    key={bld.id}
                    onClick={() => {
                      setSelectedBuildingId(bld.id);
                      if (labsInBld[0]) setSelectedLabId(labsInBld[0].id);
                    }}
                    animate={{ scale: isSelectedBld ? 1.015 : 1 }}
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.18 }}
                    style={{
                      left: `${bld.mapX}%`,
                      top: `${bld.mapY}%`,
                      width: `${bld.widthPct}%`,
                      height: `${bld.heightPct}%`,
                    }}
                    className={`absolute z-10 cursor-pointer rounded-2xl border p-3 transition-colors ${
                      isSelectedBld
                        ? 'border-[#3978E8] bg-white shadow-sm'
                        : 'border-[#D6DCE6] bg-white/95 hover:border-[#3978E8] hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#202B3C] truncate">
                        {bld.code} · {bld.name}
                      </span>
                      <span className="text-[10px] text-[#718096] shrink-0">{bld.zone}</span>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {labsInBld.map((lab) => {
                        const isSelLab = activeLab?.id === lab.id;
                        const openCount = db.physicalUnits.filter(
                          (u) => u.laboratoryId === lab.id && u.status === 'available'
                        ).length;
                        return (
                          <motion.button
                            key={lab.id}
                            type="button"
                            whileHover={{ y: -2, scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onMouseEnter={() =>
                              setHoveredLabPreview({
                                labId: lab.id,
                                xPct: Math.min(bld.mapX + bld.widthPct * 0.5, 68),
                                yPct: Math.max(bld.mapY - 14, 4),
                              })
                            }
                            onMouseLeave={() => setHoveredLabPreview(null)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBuildingId(bld.id);
                              setSelectedLabId(lab.id);
                            }}
                            className={`rounded-lg border px-2 py-1 text-left text-[11px] font-medium transition-colors ${
                              isSelLab
                                ? 'border-[#3978E8] bg-[#EAF2FF] text-[#285EC7] shadow-xs'
                                : 'border-[#E6EAF0] bg-[#F7F9FC] text-[#202B3C] hover:border-[#3978E8] hover:bg-white'
                            }`}
                          >
                            <span className="font-mono font-semibold">{lab.code}</span> · {openCount}{' '}
                            open
                          </motion.button>
                        );
                      })}
                      {labsInBld.length === 0 && (
                        <span className="text-[11px] text-[#718096]">No labs match filter</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}

              {/* Floating Lab Hover Preview Tooltip */}
              {hoveredLabPreview && hoveredLabObj && (
                <div
                  className="pointer-events-none absolute z-20 w-56 rounded-xl border border-[#C9DDFE] bg-white px-3 py-2 shadow-md"
                  style={{
                    left: `${hoveredLabPreview.xPct}%`,
                    top: `${hoveredLabPreview.yPct}%`,
                  }}
                >
                  <p className="text-xs font-semibold text-[#202B3C] truncate">
                    {hoveredLabObj.code} — {hoveredLabObj.name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#718096]">
                    Room {hoveredLabObj.roomNumber} · {hoveredLabObj.operatingHours.openHour}:00–
                    {hoveredLabObj.operatingHours.closeHour}:00 · {hoveredLabObj.safetyTier}
                  </p>
                </div>
              )}
            </div>
          </CursorSpotlightSection>

          {/* Selected Lab Details */}
          <section className="rounded-2xl border border-[#E6EAF0] bg-white p-5 lg:col-span-5">
            {activeLab ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2 border-b border-[#E6EAF0] pb-3">
                  <div>
                    <p className="text-xs font-medium text-[#3978E8]">
                      {activeBuilding?.name} · Floor {activeLab.floor} · Room {activeLab.roomNumber}
                    </p>
                    <h3 className="mt-1 text-base font-bold text-[#202B3C]">
                      {activeLab.code} — {activeLab.name}
                    </h3>
                  </div>
                  <StatusBadge
                    label={activeLab.safetyTier.toUpperCase()}
                    tone={
                      activeLab.safetyTier === 'standard'
                        ? 'success'
                        : activeLab.safetyTier === 'supervised'
                          ? 'warning'
                          : 'error'
                    }
                  />
                </div>

                <p className="text-xs leading-relaxed text-[#526075]">{activeLab.description}</p>

                <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-[#F7F9FC] p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#3978E8]" />
                    <span>
                      {activeLab.operatingHours.openHour}:00–{activeLab.operatingHours.closeHour}:00
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-[#3978E8]" />
                    <span>{activeBuilding?.zone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[#718096]" />
                    <span>{activeLab.operatingHours.days.join(', ')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-600" />
                    <span>Bench Cap: {activeLab.capacity}</span>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-xs font-semibold text-[#202B3C]">
                    Instruments in {activeLab.code} ({labEquipment.length})
                  </h4>
                  <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {labEquipment.map((eq) => {
                      const units = db.physicalUnits.filter((u) => u.equipmentId === eq.id);
                      const open = units.filter((u) => u.status === 'available').length;
                      return (
                        <div
                          key={eq.id}
                          className="flex items-center justify-between rounded-xl border border-[#E6EAF0] px-3 py-2 text-xs transition-colors hover:border-[#C9DDFE] hover:bg-[#F7F9FC]"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="truncate font-medium text-[#202B3C]">{eq.name}</p>
                            <p className="font-mono text-[11px] text-[#718096]">
                              {units.map((u) => u.unitCode).join(', ')}
                            </p>
                          </div>
                          <StatusBadge
                            label={`${open}/${units.length} Open`}
                            tone={open > 0 ? 'success' : 'warning'}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                <p className="text-sm font-semibold text-[#202B3C]">
                  No laboratories match the current filter
                </p>
                <p className="mt-1 text-xs text-[#718096]">
                  Try clearing your search or changing the safety tier filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setTierFilter('all');
                  }}
                  className="mt-3 rounded-xl border border-[#E6EAF0] bg-white px-3.5 py-1.5 text-xs font-medium text-[#202B3C] hover:bg-[#F7F9FC]"
                >
                  Reset Map Filters
                </button>
              </div>
            )}
          </section>
        </div>
      ) : filteredLabs.length === 0 ? (
        <div className="rounded-2xl border border-[#E6EAF0] bg-white p-12 text-center">
          <p className="text-sm font-semibold text-[#202B3C]">
            No laboratories match the current filter
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setTierFilter('all');
            }}
            className="mt-3 rounded-xl border border-[#E6EAF0] bg-white px-4 py-2 text-xs font-medium text-[#202B3C] hover:bg-[#F7F9FC]"
          >
            Reset Map Filters
          </button>
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLabs.map((lab, idx) => {
            const bld = db.buildings.find((b) => b.id === lab.buildingId);
            const dept = db.departments.find((d) => d.id === lab.departmentId);
            const eqCount = db.equipment.filter((e) => e.laboratoryId === lab.id).length;
            return (
              <MagneticTiltCard
                key={lab.id}
                index={idx}
                onClick={() => {
                  setSelectedLabId(lab.id);
                  setViewMode('map');
                }}
                className="cursor-pointer rounded-2xl border border-[#E6EAF0] bg-white p-5"
              >
                <div className="relative z-10 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-[#718096]">
                      {dept?.code} · {bld?.name} (Fl {lab.floor})
                    </p>
                    <h3 className="mt-1 text-sm font-semibold text-[#202B3C]">
                      {lab.code} — {lab.name}
                    </h3>
                  </div>
                  <StatusBadge label={lab.safetyTier} tone="info" />
                </div>
                <p className="relative z-10 mt-2 text-xs text-[#526075]">{lab.description}</p>
                <p className="relative z-10 mt-3 text-xs font-medium text-[#3978E8]">
                  {eqCount} Equipment Models · {lab.operatingHours.openHour}:00–
                  {lab.operatingHours.closeHour}:00
                </p>
              </MagneticTiltCard>
            );
          })}
        </section>
      )}

      {/* Connected Inventory Cards for Active Lab */}
      {activeLab && (
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-[#202B3C]">
            Available Equipment in {activeLab.code} ({activeLab.name})
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {labEquipment.map((eq, idx) => (
              <EquipmentCard key={eq.id} equipment={eq} index={idx} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
