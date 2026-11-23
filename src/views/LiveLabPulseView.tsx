import React, { useMemo, useState } from 'react';
import { Activity, Building2, Calendar, Layers, ShieldAlert, Wrench } from 'lucide-react';
import { useLabLink } from '../context/LabLinkContext';
import { analyticsService, LabPulseMetric } from '../services/analyticsService';
import { EquipmentCard } from '../components/shared/EquipmentCard';
import {
  AnimatedNumber,
  CursorSpotlightSection,
  MagneticParallaxLayer,
  MagneticTiltCard,
  ProgressRing,
} from '../components/shared/MotionPrimitives';
import { StatusBadge } from '../components/shared/StatusBadge';

export const LiveLabPulseView: React.FC = () => {
  const { db, setActiveView, setFocusedEquipmentId } = useLabLink();
  const [selectedDate, setSelectedDate] = useState('2026-11-23');
  const [deptFilter, setDeptFilter] = useState('all');
  const [selectedLabId, setSelectedLabId] = useState<string>(db.laboratories[0]?.id ?? '');
  const [hoveredCell, setHoveredCell] = useState<{
    labCode: string;
    hour: number;
    occupancyPct: number;
    confirmedBookings: number;
    dataBasis: string;
  } | null>(null);

  const pulse = useMemo(
    () => analyticsService.getLiveLabPulse(db, selectedDate),
    [db, selectedDate]
  );

  const visibleLabs = useMemo(
    () =>
      deptFilter === 'all'
        ? pulse.labs
        : pulse.labs.filter((l) => {
            const labObj = db.laboratories.find((x) => x.id === l.laboratoryId);
            return labObj?.departmentId === deptFilter;
          }),
    [pulse.labs, deptFilter, db.laboratories]
  );

  const activeLabMetric: LabPulseMetric | undefined =
    visibleLabs.find((l) => l.laboratoryId === selectedLabId) ?? visibleLabs[0];
  const activeLabObj = db.laboratories.find(
    (l) => l.id === activeLabMetric?.laboratoryId
  );
  const activeLabEquipment = useMemo(
    () =>
      activeLabMetric
        ? db.equipment.filter((e) => e.laboratoryId === activeLabMetric.laboratoryId)
        : [],
    [db.equipment, activeLabMetric]
  );
  const activeLabMaintenance = useMemo(() => {
    if (!activeLabMetric) return [];
    const unitIds = new Set(
      db.physicalUnits
        .filter((u) => u.laboratoryId === activeLabMetric.laboratoryId)
        .map((u) => u.id)
    );
    return db.maintenanceRecords.filter((m) => unitIds.has(m.unitId) && m.status !== 'resolved');
  }, [db.physicalUnits, db.maintenanceRecords, activeLabMetric]);

  const unitAvailabilityPct =
    pulse.totalUnits > 0 ? Math.round((pulse.availableUnits / pulse.totalUnits) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header Controls & Data Transparency Strip */}
      <CursorSpotlightSection
        spotlightRadius={380}
        className="rounded-2xl border border-[#E6EAF0] bg-white p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#3978E8]" />
              <h2 className="text-base font-semibold text-[#202B3C]">
                Live Campus Laboratory Pulse
              </h2>
              <StatusBadge
                label={`${pulse.openLabsCount}/${pulse.totalLabs} Labs Open (${pulse.dayLabel})`}
                tone="info"
              />
            </div>
            <p className="mt-1 text-xs text-[#718096]">
              Derived directly from serialized unit statuses, confirmed reservations, and active
              maintenance tickets. Unbooked hours show clearly labeled historical baseline estimates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] px-3 py-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#3978E8]" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs tabular-nums text-[#202B3C] focus:outline-none"
              />
            </div>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="rounded-xl border border-[#E6EAF0] bg-white px-3 py-1.5 text-xs text-[#202B3C]"
            >
              <option value="all">All Departments</option>
              {db.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CursorSpotlightSection>

      {/* Top Campus Pulse KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MagneticTiltCard index={0} className="rounded-2xl border border-[#E6EAF0] bg-white p-5">
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#718096]">Available Units Right Now</p>
              <p className="mt-2 text-2xl font-bold text-[#202B3C]">
                <AnimatedNumber value={pulse.availableUnits} />{' '}
                <span className="text-sm font-normal text-[#718096]">/ {pulse.totalUnits}</span>
              </p>
              <p className="mt-1 text-xs text-[#718096]">
                {pulse.inUseOrBookedUnits} booked or checked out
              </p>
            </div>
            <MagneticParallaxLayer depth={6}>
              <ProgressRing
                percent={unitAvailabilityPct}
                label={`${unitAvailabilityPct}%`}
                color="#16A34A"
              />
            </MagneticParallaxLayer>
          </div>
        </MagneticTiltCard>

        <MagneticTiltCard index={1} className="rounded-2xl border border-[#E6EAF0] bg-white p-5">
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[#718096]">Confirmed Bookings ({selectedDate})</p>
              <MagneticParallaxLayer depth={5}>
                <Layers className="h-4 w-4 text-[#3978E8]" />
              </MagneticParallaxLayer>
            </div>
            <p className="mt-2 text-2xl font-bold text-[#202B3C]">
              <AnimatedNumber value={pulse.confirmedBookingsOnDate} />
            </p>
            <p className="mt-1 text-xs text-[#718096]">
              {pulse.labs.reduce((s, l) => s + l.confirmedBookedHoursOnDate, 0)} scheduled bench hours
            </p>
          </div>
        </MagneticTiltCard>

        <MagneticTiltCard index={2} className="rounded-2xl border border-[#E6EAF0] bg-white p-5">
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[#718096]">Active Maintenance Lockouts</p>
              <MagneticParallaxLayer depth={5}>
                <Wrench className="h-4 w-4 text-amber-600" />
              </MagneticParallaxLayer>
            </div>
            <p className="mt-2 text-2xl font-bold text-[#202B3C]">
              <AnimatedNumber value={pulse.maintenanceLockedUnits} />
            </p>
            <p className="mt-1 text-xs text-[#718096]">
              {pulse.activeMaintenanceTickets} open maintenance ticket(s)
            </p>
          </div>
        </MagneticTiltCard>

        <MagneticTiltCard index={3} className="rounded-2xl border border-[#E6EAF0] bg-white p-5">
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[#718096]">Seat & Lab Capacity</p>
              <MagneticParallaxLayer depth={5}>
                <Building2 className="h-4 w-4 text-[#3978E8]" />
              </MagneticParallaxLayer>
            </div>
            <p className="mt-2 text-2xl font-bold text-[#202B3C]">
              <AnimatedNumber
                value={pulse.labs.reduce((s, l) => s + (l.isOpenOnDate ? l.capacitySeats : 0), 0)}
              />
            </p>
            <p className="mt-1 text-xs text-[#718096]">
              Total bench seats across open campus labs
            </p>
          </div>
        </MagneticTiltCard>
      </section>

      {/* Interactive Laboratory Activity Heatmap */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[#202B3C]">
              Interactive Hourly Laboratory Utilisation Heatmap
            </h3>
            <p className="text-xs text-[#718096]">
              Click any laboratory row to inspect rooms, equipment cards, and maintenance status
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#526075]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-[#3978E8]" />
              Confirmed Booking Load
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-[#DCE9FF]" />
              Historical Baseline Estimate
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-amber-300" />
              Maintenance Lock
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-[#F1F5F9] border border-[#E6EAF0]" />
              Lab Closed
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E6EAF0] text-[#718096]">
                <th className="w-60 py-2 pr-3 text-left font-medium">Laboratory & Capacity</th>
                {(pulse.labs[0]?.hourlyHeatmap ?? []).map((cell) => (
                  <th
                    key={cell.hour}
                    className="px-1 py-2 text-center font-mono text-[11px] font-medium tabular-nums"
                  >
                    {cell.hour}
                  </th>
                ))}
                <th className="pl-3 py-2 text-right font-medium">Confirmed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EAF0]">
              {visibleLabs.map((lab) => {
                const isSelected = activeLabMetric?.laboratoryId === lab.laboratoryId;
                return (
                  <tr
                    key={lab.laboratoryId}
                    onClick={() => setSelectedLabId(lab.laboratoryId)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#EAF2FF]/60' : 'hover:bg-[#F7F9FC]'
                    }`}
                  >
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#202B3C] truncate">
                            <span className="font-mono text-[#3978E8]">{lab.code}</span> · {lab.name}
                          </p>
                          <p className="text-[11px] text-[#718096] tabular-nums">
                            {lab.availableUnits}/{lab.totalUnits} units open · {lab.capacitySeats}{' '}
                            seats
                          </p>
                        </div>
                      </div>
                    </td>

                    {lab.hourlyHeatmap.map((cell) => {
                      let bgClass = 'bg-[#F1F5F9] text-[#94A3B8]';
                      if (cell.dataBasis === 'confirmed') {
                        bgClass =
                          cell.occupancyPct >= 65
                            ? 'bg-[#285EC7] text-white'
                            : 'bg-[#3978E8] text-white';
                      } else if (cell.dataBasis === 'locked') {
                        bgClass = 'bg-amber-200 text-amber-900';
                      } else if (cell.dataBasis === 'baseline_estimate') {
                        bgClass =
                          cell.occupancyPct >= 30
                            ? 'bg-[#C9DDFE] text-[#202B3C]'
                            : 'bg-[#EAF2FF] text-[#526075]';
                      }

                      return (
                        <td key={cell.hour} className="p-1">
                          <div
                            onMouseEnter={() =>
                              setHoveredCell({
                                labCode: lab.code,
                                hour: cell.hour,
                                occupancyPct: cell.occupancyPct,
                                confirmedBookings: cell.confirmedBookings,
                                dataBasis: cell.dataBasis,
                              })
                            }
                            onMouseLeave={() => setHoveredCell(null)}
                            className={`flex h-7 items-center justify-center rounded-md font-mono text-[10px] font-medium tabular-nums transition-transform hover:scale-105 ${bgClass}`}
                          >
                            {cell.dataBasis === 'closed'
                              ? '—'
                              : cell.dataBasis === 'confirmed'
                                ? `${cell.confirmedBookings}b`
                                : `${cell.occupancyPct}%`}
                          </div>
                        </td>
                      );
                    })}

                    <td className="pl-3 py-2.5 text-right font-mono font-semibold tabular-nums text-[#202B3C]">
                      {lab.confirmedUtilisationPct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E6EAF0] pt-3 text-xs text-[#718096]">
          <span>
            {hoveredCell
              ? `${hoveredCell.labCode} @ ${hoveredCell.hour}:00 — ${
                  hoveredCell.dataBasis === 'confirmed'
                    ? `${hoveredCell.confirmedBookings} confirmed booking(s) (${hoveredCell.occupancyPct}% unit occupancy)`
                    : hoveredCell.dataBasis === 'baseline_estimate'
                      ? `No confirmed booking yet; historical baseline estimate ~${hoveredCell.occupancyPct}%`
                      : hoveredCell.dataBasis === 'locked'
                        ? 'All units locked under maintenance'
                        : 'Laboratory closed for selected operating window'
                }`
              : 'Hover any heatmap cell for hour-level occupancy basis; click a row to inspect equipment.'}
          </span>
          <span className="font-mono text-[11px]">b = confirmed bookings · % = baseline load</span>
        </div>
      </section>

      {/* Department Usage Breakdown & Selected Lab Drill-Down */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Department Resource Usage */}
        <section className="rounded-2xl border border-[#E6EAF0] bg-white p-5 lg:col-span-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-[#202B3C]">
              Department-Wise Resource Usage
            </h3>
            <p className="text-xs text-[#718096]">
              Weekly baseline demand combined with confirmed reservations on {selectedDate}
            </p>
          </div>

          <div className="space-y-3.5">
            {pulse.departments.map((d) => (
              <div key={d.departmentId} className="rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-[#202B3C]">
                      {d.code} · {d.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#718096] tabular-nums">
                      {d.openUnits}/{d.totalUnits} open · {d.confirmedHoursOnDate}h booked today ·{' '}
                      {d.weeklyBaselineHours}h/wk baseline
                    </p>
                  </div>
                  <ProgressRing
                    percent={d.utilisationPct}
                    size={44}
                    strokeWidth={4.5}
                    color={d.colorHex}
                    label={`${d.utilisationPct}%`}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Clicked Laboratory Details & Equipment Records */}
        <section className="rounded-2xl border border-[#E6EAF0] bg-white p-5 lg:col-span-8 space-y-4">
          {activeLabMetric && activeLabObj ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E6EAF0] pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-[#EAF2FF] px-2.5 py-1 font-mono text-xs font-semibold text-[#285EC7]">
                      {activeLabMetric.code}
                    </span>
                    <StatusBadge
                      label={activeLabMetric.isOpenOnDate ? 'Open Today' : 'Closed Today'}
                      tone={activeLabMetric.isOpenOnDate ? 'success' : 'neutral'}
                    />
                    <StatusBadge
                      label={`${activeLabMetric.safetyTier.toUpperCase()} TIER`}
                      tone={
                        activeLabMetric.safetyTier === 'standard'
                          ? 'success'
                          : activeLabMetric.safetyTier === 'supervised'
                            ? 'warning'
                            : 'error'
                      }
                    />
                  </div>
                  <h3 className="mt-2 text-base font-bold text-[#202B3C]">
                    {activeLabMetric.name}
                  </h3>
                  <p className="text-xs text-[#718096]">
                    {activeLabMetric.buildingName} · Room {activeLabObj.roomNumber} ·{' '}
                    {activeLabMetric.openHour}:00–{activeLabMetric.closeHour}:00 (
                    {activeLabObj.operatingHours.days.join(', ')})
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeLabEquipment[0]) setFocusedEquipmentId(activeLabEquipment[0].id);
                      setActiveView('digital-twin');
                    }}
                    className="rounded-xl border border-[#E6EAF0] bg-white px-3 py-1.5 text-xs font-medium text-[#202B3C] hover:bg-[#F7F9FC]"
                  >
                    Explore in 3D Twin
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView('equipment-health')}
                    className="rounded-xl border border-[#E6EAF0] bg-white px-3 py-1.5 text-xs font-medium text-[#202B3C] hover:bg-[#F7F9FC]"
                  >
                    Maintenance Log ({activeLabMaintenance.length})
                  </button>
                </div>
              </div>

              {activeLabMaintenance.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                    <span>Active Maintenance Notices in {activeLabMetric.code}</span>
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {activeLabMaintenance.map((m) => {
                      const u = db.physicalUnits.find((unit) => unit.id === m.unitId);
                      return (
                        <li key={m.id}>
                          <strong className="font-mono">{u?.unitCode}</strong> — {m.issueTitle} (
                          {m.status.replace('_', ' ')})
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {activeLabEquipment.map((eq) => (
                  <EquipmentCard key={eq.id} equipment={eq} />
                ))}
              </div>
            </>
          ) : (
            <p className="py-10 text-center text-xs text-[#718096]">
              Select a laboratory from the heatmap to inspect live equipment records.
            </p>
          )}
        </section>
      </div>
    </div>
  );
};
