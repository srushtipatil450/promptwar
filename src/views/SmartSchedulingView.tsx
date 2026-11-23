import React, { useMemo, useState } from 'react';
import { AlertTriangle, Calendar, CheckCircle2, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { useLabLink } from '../context/LabLinkContext';
import { schedulingService } from '../services/schedulingService';
import { StatusBadge, unitStatusLabel, unitStatusTone } from '../components/shared/StatusBadge';

export const SmartSchedulingView: React.FC = () => {
  const { db, currentUser, allocateOrOverrideBooking, cancelBooking, openBookingModal } =
    useLabLink();

  const [selectedDate, setSelectedDate] = useState('2026-11-23');
  const [labFilter, setLabFilter] = useState('all');
  const [overrideBookingId, setOverrideBookingId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  const isAdmin = currentUser.role === 'lab_admin' || currentUser.role === 'system_admin';

  const visibleUnits = useMemo(
    () =>
      labFilter === 'all'
        ? db.physicalUnits
        : db.physicalUnits.filter((u) => u.laboratoryId === labFilter),
    [db.physicalUnits, labFilter]
  );

  const dayAllocations = useMemo(
    () => db.confirmedAllocations.filter((a) => a.date === selectedDate),
    [db.confirmedAllocations, selectedDate]
  );

  const dayApprovedBookings = useMemo(
    () => db.bookingRequests.filter((b) => b.status === 'approved' && b.date === selectedDate),
    [db.bookingRequests, selectedDate]
  );

  const pendingRequests = useMemo(
    () =>
      db.bookingRequests
        .filter((b) => b.status === 'pending')
        .sort((a, b) => b.priority.totalScore - a.priority.totalScore),
    [db.bookingRequests]
  );

  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

  const handleOpenAllocate = (bookingId: string, equipmentId: string) => {
    const req = db.bookingRequests.find((b) => b.id === bookingId);
    const units = db.physicalUnits.filter((u) => u.equipmentId === equipmentId);
    const firstBookable = req
      ? units.find(
          (u) =>
            schedulingService.isUnitBookableForSlot(
              db,
              u,
              req.date,
              req.startHour,
              req.endHour,
              req.id
            ).ok
        )
      : units.find((u) => u.status !== 'maintenance' && u.status !== 'faulty');
    setOverrideBookingId(bookingId);
    setSelectedUnitId(firstBookable?.id ?? '');
    setOverrideReason('');
  };

  const handleConfirmAllocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideBookingId || !selectedUnitId) return;
    const res = allocateOrOverrideBooking(overrideBookingId, selectedUnitId, overrideReason);
    if (res.ok) {
      setOverrideBookingId(null);
      setOverrideReason('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Interactive Unit Calendar */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#202B3C]">
              Physical Unit Allocation Calendar
            </h2>
            <p className="text-xs text-[#718096]">
              Each row corresponds to an individual serialized unit — preventing overlapping
              reservations
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={labFilter}
              onChange={(e) => setLabFilter(e.target.value)}
              className="rounded-xl border border-[#E6EAF0] bg-white px-3 py-1.5 text-xs text-[#202B3C]"
            >
              <option value="all">All Laboratories ({db.physicalUnits.length} units)</option>
              {db.laboratories.map((lab) => (
                <option key={lab.id} value={lab.id}>
                  {lab.code} — {lab.name}
                </option>
              ))}
            </select>
            <Calendar className="h-4 w-4 text-[#3978E8]" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-xl border border-[#E6EAF0] px-3 py-1.5 text-xs tabular-nums text-[#202B3C]"
            />
            <button
              type="button"
              onClick={() =>
                openBookingModal({
                  equipmentId: db.equipment[0]?.id ?? 'eq-oscilloscope',
                  date: selectedDate,
                })
              }
              className="rounded-xl bg-[#3978E8] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#2E67CE]"
            >
              Add Reservation
            </button>
          </div>
        </div>

        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-[11px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-[#E6EAF0] bg-[#F7F9FC] text-[#718096]">
                <th className="w-48 px-3 py-2 font-medium">Unit & Status</th>
                {hours.map((h) => (
                  <th key={h} className="px-1.5 py-2 text-center font-mono font-medium tabular-nums">
                    {h}:00
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EAF0]">
              {visibleUnits.map((unit) => {
                const eq = db.equipment.find((e) => e.id === unit.equipmentId);
                const unitAllocs = dayAllocations.filter((a) => a.unitId === unit.id);
                const isLocked = unit.status === 'maintenance' || unit.status === 'faulty';

                return (
                  <tr key={unit.id} className="hover:bg-[#F7F9FC]">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-mono font-semibold text-[#202B3C]">
                            {unit.unitCode}
                          </span>
                          <span className="block max-w-[125px] truncate text-[10px] text-[#718096]">
                            {eq?.name}
                          </span>
                        </div>
                        <StatusBadge
                          label={unitStatusLabel(unit.status)}
                          tone={unitStatusTone(unit.status)}
                        />
                      </div>
                    </td>

                    {hours.map((h) => {
                      const alloc = unitAllocs.find((a) => h >= a.startHour && h < a.endHour);
                      const owner = alloc
                        ? db.users.find((u) => u.id === alloc.userId)
                        : null;
                      return (
                        <td key={h} className="p-1">
                          {isLocked ? (
                            <div
                              title={`Unit locked (${unit.status})`}
                              className="h-6 rounded bg-amber-100/80 border border-amber-200"
                            />
                          ) : alloc ? (
                            <motion.div
                              initial={{ scaleX: 0.75, opacity: 0.6 }}
                              animate={{ scaleX: 1, opacity: 1 }}
                              transition={{ duration: 0.2 }}
                              title={`${owner?.name}: ${alloc.startHour}:00-${alloc.endHour}:00`}
                              className="flex h-6 items-center justify-center rounded bg-[#3978E8] px-1 text-[10px] font-medium text-white truncate"
                            >
                              {owner?.avatarInitials}
                            </motion.div>
                          ) : (
                            <div className="h-6 rounded bg-[#F7F9FC] transition-colors hover:bg-[#EAF2FF]/60" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pending Conflict & Priority Queue */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#202B3C]">
              Pending Queue & Conflict Resolution ({pendingRequests.length})
            </h3>
            <p className="text-xs text-[#718096]">
              Ranked by transparent weighted scoring (Urgency 30% · Dependency 25% · Duration 15% ·
              Fairness 20% · Queue Time 10%)
            </p>
          </div>
          {!isAdmin && (
            <StatusBadge
              label="Read-Only (Admin required to override)"
              tone="neutral"
              icon="lock"
            />
          )}
        </div>

        {pendingRequests.length === 0 ? (
          <div className="rounded-xl bg-[#F7F9FC] p-6 text-center text-xs text-[#718096]">
            All booking requests are currently resolved.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((req) => {
              const eq = db.equipment.find((e) => e.id === req.equipmentId);
              const user = db.users.find((u) => u.id === req.userId);
              const candidateUnits = db.physicalUnits.filter((u) => u.equipmentId === req.equipmentId);
              const openUnit = schedulingService.findAvailableUnitForSlot(
                db,
                req.equipmentId,
                req.date,
                req.startHour,
                req.endHour
              );

              return (
                <div
                  key={req.id}
                  className="rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-4"
                >
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#3978E8] tabular-nums">
                          Score {req.priority.totalScore}/100
                        </span>
                        <span className="text-sm font-semibold text-[#202B3C]">{eq?.name}</span>
                        <StatusBadge
                          label={openUnit ? `Open Unit: ${openUnit.unitCode}` : 'Unit Overlap'}
                          tone={openUnit ? 'success' : 'warning'}
                          icon={openUnit ? 'check' : 'warn'}
                        />
                      </div>
                      <p className="mt-1 text-xs text-[#526075]">
                        Requester: <strong>{user?.name}</strong> · {req.date} ({req.startHour}:00–
                        {req.endHour}:00) · {req.purpose}
                      </p>
                      <p className="mt-1 text-[11px] text-[#718096]">{req.priority.explanation}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleOpenAllocate(req.id, req.equipmentId)}
                          className="rounded-xl bg-[#3978E8] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2E67CE]"
                        >
                          Allocate / Override
                        </button>
                      )}
                      {(isAdmin || req.userId === currentUser.id) && (
                        <button
                          type="button"
                          onClick={() => cancelBooking(req.id, 'Cancelled from scheduler queue')}
                          className="rounded-xl border border-[#E6EAF0] bg-white px-3 py-1.5 text-xs font-medium text-[#202B3C] hover:bg-rose-50 hover:text-rose-700"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  {overrideBookingId === req.id && isAdmin && (
                    <form
                      onSubmit={handleConfirmAllocation}
                      className="mt-3 flex flex-wrap items-end gap-3 border-t border-[#E6EAF0] pt-3"
                    >
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-[#202B3C]">
                          Target Physical Unit
                        </label>
                        <select
                          value={selectedUnitId}
                          onChange={(e) => setSelectedUnitId(e.target.value)}
                          className="rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-xs"
                        >
                          {candidateUnits.map((u) => {
                            const ok = schedulingService.isUnitBookableForSlot(
                              db,
                              u,
                              req.date,
                              req.startHour,
                              req.endHour,
                              req.id
                            ).ok;
                            return (
                              <option key={u.id} value={u.id} disabled={!ok}>
                                {u.unitCode} ({ok ? 'Open for slot' : 'Blocked/Booked'})
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="flex-1 min-w-[220px]">
                        <label className="mb-1 block text-[11px] font-medium text-[#202B3C]">
                          Recorded Decision / Override Reason
                        </label>
                        <input
                          type="text"
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          required
                          placeholder="e.g. Reassigned from OSC-001 to open bench OSC-002"
                          className="w-full rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={!selectedUnitId}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-45"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Confirm Allocation</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOverrideBookingId(null)}
                        className="rounded-lg border border-[#E6EAF0] bg-white px-3 py-1.5 text-xs text-[#718096]"
                      >
                        Close
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Approved Allocations for Selected Date */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#202B3C]">
              Confirmed Allocations on {selectedDate} ({dayApprovedBookings.length})
            </h3>
            <p className="text-xs text-[#718096]">
              Inspect active unit assignments, override reasons, or release a slot back to the waiting pool
            </p>
          </div>
        </div>

        {dayApprovedBookings.length === 0 ? (
          <div className="rounded-xl bg-[#F7F9FC] p-5 text-center text-xs text-[#718096]">
            No confirmed reservations scheduled for {selectedDate}.
          </div>
        ) : (
          <div className="space-y-2.5">
            {dayApprovedBookings.map((bk) => {
              const eq = db.equipment.find((e) => e.id === bk.equipmentId);
              const unit = db.physicalUnits.find((u) => u.id === bk.allocatedUnitId);
              const user = db.users.find((u) => u.id === bk.userId);
              return (
                <div
                  key={bk.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] px-4 py-3 text-xs"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-[#3978E8]">
                        {unit?.unitCode ?? 'Unassigned'}
                      </span>
                      <span className="font-semibold text-[#202B3C]">{eq?.name}</span>
                      <StatusBadge label={`${bk.startHour}:00–${bk.endHour}:00`} tone="success" />
                    </div>
                    <p className="mt-1 text-[#526075]">
                      {user?.name} · Score {bk.priority.totalScore}/100 · {bk.decisionReason}
                    </p>
                  </div>
                  {(isAdmin || bk.userId === currentUser.id) && (
                    <button
                      type="button"
                      onClick={() => cancelBooking(bk.id, 'Released from scheduler calendar')}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                    >
                      Release Slot
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Weight Transparency Footer */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E6EAF0] bg-white px-5 py-3.5 text-xs text-[#718096]">
        <span className="inline-flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#3978E8]" />
          <span>
            Active Fairness Weights: Deadline {db.fairnessConfig.schedulingWeights.deadlineUrgency}%
            · Dependency {db.fairnessConfig.schedulingWeights.projectDependency}% · Duration{' '}
            {db.fairnessConfig.schedulingWeights.durationFeasibility}% · Prior Fairness{' '}
            {db.fairnessConfig.schedulingWeights.previousFairness}% · Queue Time{' '}
            {db.fairnessConfig.schedulingWeights.submissionTime}%
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-[#202B3C] font-medium">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          Maintenance & safety gates strictly enforced
        </span>
      </section>
    </div>
  );
};
