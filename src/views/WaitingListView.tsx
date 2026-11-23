import React, { useEffect, useState } from 'react';
import { CheckCircle2, Hourglass, XCircle } from 'lucide-react';
import { useLabLink } from '../context/LabLinkContext';
import { StatusBadge } from '../components/shared/StatusBadge';

export const WaitingListView: React.FC = () => {
  const {
    db,
    currentUser,
    joinWaitingList,
    acceptOffer,
    declineOffer,
    withdrawWaitingListEntry,
  } = useLabLink();

  const [equipmentId, setEquipmentId] = useState(db.equipment[0]?.id ?? 'eq-oscilloscope');
  const [projectId, setProjectId] = useState(
    db.projects.find((p) => p.ownerId === currentUser.id)?.id ?? ''
  );
  const [desiredDate, setDesiredDate] = useState('2026-11-24');
  const [startHour, setStartHour] = useState(10);
  const [endHour, setEndHour] = useState(12);

  useEffect(() => {
    const owned = db.projects.find((p) => p.ownerId === currentUser.id);
    setProjectId(owned?.id ?? '');
  }, [currentUser.id, db.projects]);

  const activeOffers = db.availabilityOffers.filter(
    (o) =>
      o.status === 'active' &&
      (o.userId === currentUser.id || currentUser.role !== 'student')
  );

  const sortedQueue = [...db.waitingList].sort((a, b) => b.priorityScore - a.priorityScore);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    joinWaitingList({
      equipmentId,
      projectId: projectId || null,
      desiredDate,
      startHour,
      endHour,
    });
  };

  return (
    <div className="space-y-6">
      {/* Time-limited Availability Offers */}
      {activeOffers.length > 0 && (
        <section className="rounded-2xl border border-[#C9DDFE] bg-[#EAF2FF] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Hourglass className="h-4 w-4 text-[#3978E8]" />
            <h2 className="text-sm font-semibold text-[#202B3C]">
              Active Time-Limited Availability Offers ({activeOffers.length})
            </h2>
          </div>
          <p className="text-xs text-[#526075]">
            Students must explicitly accept an availability offer before the scheduler revalidates
            the physical unit and confirms allocation.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {activeOffers.map((offer) => {
              const eq = db.equipment.find((e) => e.id === offer.equipmentId);
              const unit = db.physicalUnits.find((u) => u.id === offer.unitId);
              const targetUser = db.users.find((u) => u.id === offer.userId);
              return (
                <div
                  key={offer.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-[#C9DDFE] bg-white p-4"
                >
                  <div>
                    <p className="font-mono text-xs font-semibold text-[#3978E8]">
                      Unit {unit?.unitCode} · Expires {offer.expiresAt.slice(0, 16).replace('T', ' ')}
                    </p>
                    <h3 className="mt-1 text-sm font-semibold text-[#202B3C]">{eq?.name}</h3>
                    <p className="mt-0.5 text-xs text-[#718096]">
                      For {targetUser?.name} · {offer.date} ({offer.startHour}:00–{offer.endHour}:00)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => acceptOffer(offer.id)}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#3978E8] px-3 py-2 text-xs font-medium text-white hover:bg-[#2E67CE]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Accept & Allocate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => declineOffer(offer.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-xs font-medium text-[#202B3C] hover:bg-[#F7F9FC]"
                    >
                      <XCircle className="h-3.5 w-3.5 text-rose-600" />
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Join Waitlist Form */}
        <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6 lg:col-span-4">
          <h3 className="text-base font-semibold text-[#202B3C]">Join Smart Waiting List</h3>
          <p className="mt-1 text-xs text-[#718096]">
            Duplicate requests for overlapping slots are automatically blocked.
          </p>

          <form onSubmit={handleJoin} className="mt-4 space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#202B3C]">Equipment</label>
              <select
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value)}
                className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-xs"
              >
                {db.equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#202B3C]">
                Linked Project
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-xs"
              >
                <option value="">Independent Session</option>
                {db.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#202B3C]">Date</label>
                <input
                  type="date"
                  value={desiredDate}
                  onChange={(e) => setDesiredDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[#E6EAF0] px-2 py-2 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#202B3C]">Start</label>
                <select
                  value={startHour}
                  onChange={(e) => {
                    const nextStart = Number(e.target.value);
                    setStartHour(nextStart);
                    if (endHour <= nextStart) setEndHour(nextStart + 1);
                  }}
                  className="w-full rounded-xl border border-[#E6EAF0] bg-white px-2 py-2 text-xs tabular-nums"
                >
                  {[8, 9, 10, 11, 12, 13, 14, 15, 16].map((h) => (
                    <option key={h} value={h}>
                      {h}:00
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#202B3C]">End</label>
                <select
                  value={endHour}
                  onChange={(e) => setEndHour(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#E6EAF0] bg-white px-2 py-2 text-xs tabular-nums"
                >
                  {[9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((h) => (
                    <option key={h} value={h} disabled={h <= startHour}>
                      {h}:00
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-[#3978E8] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#2E67CE]"
            >
              Join Priority Queue
            </button>
          </form>
        </section>

        {/* Ranked Waiting Queue */}
        <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6 lg:col-span-8">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-[#202B3C]">
              Ranked Waiting List ({sortedQueue.length})
            </h3>
            <p className="text-xs text-[#718096]">
              Weights: Deadline 30% · Dependency 25% · Previous Wait Boost 15% · Time Waiting 20% ·
              Submission Time 10%
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E6EAF0] text-[#718096]">
                <tr>
                  <th className="pb-2.5 font-medium">Rank</th>
                  <th className="pb-2.5 font-medium">Equipment</th>
                  <th className="pb-2.5 font-medium">Student</th>
                  <th className="pb-2.5 font-medium">Desired Slot</th>
                  <th className="pb-2.5 font-medium text-right">Score Breakdown</th>
                  <th className="pb-2.5 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EAF0]">
                {sortedQueue.map((entry, idx) => {
                  const eq = db.equipment.find((e) => e.id === entry.equipmentId);
                  const student = db.users.find((u) => u.id === entry.userId);
                  return (
                    <tr key={entry.id} className="hover:bg-[#F7F9FC]">
                      <td className="py-3 font-mono font-bold tabular-nums text-[#3978E8]">
                        #{idx + 1}
                      </td>
                      <td className="py-3 pr-3 font-medium text-[#202B3C]">{eq?.name}</td>
                      <td className="py-3 pr-3 text-[#526075]">{student?.name}</td>
                      <td className="py-3 pr-3 tabular-nums text-[#526075]">
                        {entry.desiredDate} · {entry.startHour}:00–{entry.endHour}:00
                      </td>
                      <td className="py-3 pr-3 text-right">
                        <span className="font-mono font-semibold tabular-nums text-[#202B3C]">
                          {entry.priorityScore}/100
                        </span>
                        <span className="block text-[10px] text-[#718096]">
                          U:{entry.priorityBreakdown.deadlineUrgency} · D:
                          {entry.priorityBreakdown.projectDependency} · W:
                          {entry.priorityBreakdown.timeWaitingScore}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <StatusBadge
                            label={entry.status.toUpperCase()}
                            tone={
                              entry.status === 'offered'
                                ? 'info'
                                : entry.status === 'fulfilled'
                                  ? 'success'
                                  : entry.status === 'waiting'
                                    ? 'warning'
                                    : 'neutral'
                            }
                          />
                          {(entry.status === 'waiting' || entry.status === 'offered') &&
                            (currentUser.role !== 'student' || entry.userId === currentUser.id) && (
                              <button
                                type="button"
                                onClick={() => withdrawWaitingListEntry(entry.id)}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
                              >
                                Withdraw
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
