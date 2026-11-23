import React, { useMemo, useState } from 'react';
import { CalendarCheck, QrCode, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useLabLink } from '../context/LabLinkContext';
import { StatusBadge } from '../components/shared/StatusBadge';

export const MyBookingsView: React.FC = () => {
  const { db, currentUser, cancelBooking, openBookingModal, setActiveView, setFocusedUnitId } =
    useLabLink();
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'cancelled' | 'completed'>('all');

  const bookings = useMemo(() => {
    return db.bookingRequests
      .filter((b) => {
        if (currentUser.role === 'student' && b.userId !== currentUser.id) return false;
        if (statusFilter !== 'all' && b.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [db.bookingRequests, currentUser, statusFilter]);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E6EAF0] bg-white p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'approved', 'pending', 'completed', 'cancelled'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-[#EAF2FF] text-[#3978E8]'
                  : 'text-[#718096] hover:bg-[#F7F9FC] hover:text-[#202B3C]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => openBookingModal({ equipmentId: db.equipment[0]?.id ?? 'eq-oscilloscope' })}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#3978E8] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#2E67CE]"
        >
          <CalendarCheck className="h-3.5 w-3.5" />
          <span>New Booking</span>
        </button>
      </section>

      {bookings.length === 0 ? (
        <div className="rounded-2xl border border-[#E6EAF0] bg-white p-12 text-center">
          <p className="text-sm font-semibold text-[#202B3C]">No bookings match this filter</p>
          <p className="mt-1 text-xs text-[#718096]">
            Request laboratory hardware from the Equipment Explorer or Project Matcher.
          </p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[#E6EAF0] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E6EAF0] bg-[#F7F9FC] text-[#718096]">
                <tr>
                  <th className="px-5 py-3 font-medium">Equipment & Physical Unit</th>
                  <th className="px-4 py-3 font-medium">User & Purpose</th>
                  <th className="px-4 py-3 font-medium">Date & Window</th>
                  <th className="px-4 py-3 font-medium">Priority Reason</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EAF0]">
                {bookings.map((b, idx) => {
                  const eq = db.equipment.find((e) => e.id === b.equipmentId);
                  const unit = db.physicalUnits.find((u) => u.id === b.allocatedUnitId);
                  const lab = db.laboratories.find((l) => l.id === b.laboratoryId);
                  const owner = db.users.find((u) => u.id === b.userId);
                  return (
                    <motion.tr
                      key={b.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: Math.min(idx * 0.025, 0.15) }}
                      className="hover:bg-[#F7F9FC]"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-[#202B3C]">{eq?.name}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-[#718096]">
                          {lab?.code} · {unit ? `Unit ${unit.unitCode}` : 'Awaiting Unit'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 max-w-xs">
                        <p className="font-medium text-[#202B3C]">{owner?.name}</p>
                        <p className="truncate text-[#718096]">{b.purpose}</p>
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-[#202B3C]">
                        {b.date}
                        <span className="block text-[11px] text-[#718096]">
                          {b.startHour}:00–{b.endHour}:00
                        </span>
                      </td>
                      <td className="px-4 py-3.5 max-w-xs">
                        <span className="font-mono font-semibold tabular-nums text-[#3978E8]">
                          {b.priority.totalScore}/100
                        </span>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-[#718096]">
                          {b.decisionReason}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge
                          label={b.status.toUpperCase()}
                          tone={
                            b.status === 'approved'
                              ? 'success'
                              : b.status === 'pending'
                                ? 'warning'
                                : b.status === 'completed'
                                  ? 'info'
                                  : 'neutral'
                          }
                        />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          {b.status === 'approved' && unit && (
                            <button
                              type="button"
                              onClick={() => {
                                setFocusedUnitId(unit.id);
                                setActiveView('equipment-tracking');
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#202B3C] hover:bg-[#F7F9FC]"
                            >
                              <QrCode className="h-3 w-3 text-[#3978E8]" />
                              <span>QR Track</span>
                            </button>
                          )}
                          {(b.status === 'approved' || b.status === 'pending') && (
                            <button
                              type="button"
                              onClick={() => cancelBooking(b.id, 'Released by user')}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
                            >
                              <XCircle className="h-3 w-3" />
                              <span>Cancel</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
