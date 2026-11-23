import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CheckCircle2, XCircle } from 'lucide-react';
import { useLabLink } from '../context/LabLinkContext';
import { StatusBadge } from '../components/shared/StatusBadge';

export const CrossDeptSharingView: React.FC = () => {
  const {
    db,
    currentUser,
    submitSharingRequest,
    approveSharingRequest,
    rejectSharingRequest,
  } = useLabLink();

  const crossDeptEquipment = useMemo(
    () =>
      db.equipment.filter(
        (e) => e.requiresCrossDeptApproval || e.departmentId !== currentUser.departmentId
      ),
    [db.equipment, currentUser.departmentId]
  );

  const [equipmentId, setEquipmentId] = useState(crossDeptEquipment[0]?.id ?? db.equipment[0]?.id ?? '');
  const [requestedDate, setRequestedDate] = useState('2026-11-26');
  const [startHour, setStartHour] = useState(10);
  const [endHour, setEndHour] = useState(13);
  const [projectId, setProjectId] = useState(
    db.projects.find((p) => p.ownerId === currentUser.id)?.id ?? ''
  );
  const [justification, setJustification] = useState('');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (crossDeptEquipment.length > 0 && !crossDeptEquipment.some((e) => e.id === equipmentId)) {
      setEquipmentId(crossDeptEquipment[0].id);
    }
  }, [crossDeptEquipment, equipmentId]);

  useEffect(() => {
    const owned = db.projects.find((p) => p.ownerId === currentUser.id);
    setProjectId(owned?.id ?? '');
  }, [currentUser.id, db.projects]);

  const isAdmin = currentUser.role === 'lab_admin' || currentUser.role === 'system_admin';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = submitSharingRequest({
      equipmentId,
      requestedDate,
      startHour,
      endHour,
      projectId: projectId || null,
      justification,
    });
    if (res.ok) setJustification('');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Borrow Request Form */}
        <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6 lg:col-span-5">
          <div className="mb-4 flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-[#3978E8]" />
            <div>
              <h2 className="text-base font-semibold text-[#202B3C]">
                Request Cross-Department Resource
              </h2>
              <p className="text-xs text-[#718096]">
                Approved requests automatically revalidate availability and enter Smart Scheduling
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#202B3C]">
                Host Department Equipment
              </label>
              <select
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value)}
                className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-xs text-[#202B3C]"
              >
                {crossDeptEquipment.map((eq) => {
                  const dept = db.departments.find((d) => d.id === eq.departmentId);
                  return (
                    <option key={eq.id} value={eq.id}>
                      [{dept?.code}] {eq.name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#202B3C]">Date</label>
                <input
                  type="date"
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[#E6EAF0] px-2.5 py-2 text-xs tabular-nums"
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
                  className="w-full rounded-xl border border-[#E6EAF0] bg-white px-2.5 py-2 text-xs tabular-nums"
                >
                  {[9, 10, 11, 12, 13, 14, 15, 16].map((h) => (
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
                  className="w-full rounded-xl border border-[#E6EAF0] bg-white px-2.5 py-2 text-xs tabular-nums"
                >
                  {[10, 11, 12, 13, 14, 15, 16, 17, 18].map((h) => (
                    <option key={h} value={h} disabled={h <= startHour}>
                      {h}:00
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#202B3C]">
                Project Reference
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-xs"
              >
                <option value="">Independent Research</option>
                {db.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#202B3C]">
                Cross-Department Justification
              </label>
              <textarea
                rows={3}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                required
                placeholder="Explain why your project requires this host department instrument..."
                className="w-full rounded-xl border border-[#E6EAF0] px-3 py-2 text-xs"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-[#3978E8] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#2E67CE]"
            >
              Submit Borrow Request
            </button>
          </form>
        </section>

        {/* Requests & Approval Queue */}
        <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#202B3C]">
                Cross-Department Sharing Queue ({db.sharingRequests.length})
              </h3>
              <p className="text-xs text-[#718096]">
                Host Lab Administrators review safety eligibility and approve directly into the
                scheduler
              </p>
            </div>
            {!isAdmin && <StatusBadge label="Student View" tone="neutral" />}
          </div>

          <div className="space-y-3">
            {db.sharingRequests.map((req) => {
              const eq = db.equipment.find((e) => e.id === req.equipmentId);
              const requester = db.users.find((u) => u.id === req.requesterId);
              const fromDept = db.departments.find((d) => d.id === req.requesterDeptId);
              const toDept = db.departments.find((d) => d.id === req.hostDeptId);
              const canApprove =
                isAdmin &&
                (currentUser.role === 'system_admin' ||
                  currentUser.assignedLabIds.includes(req.laboratoryId));

              return (
                <div
                  key={req.id}
                  className="rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-4 space-y-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-[#3978E8]">
                        {fromDept?.code} → {toDept?.code} · {req.requestedDate} ({req.startHour}:00–
                        {req.endHour}:00)
                      </p>
                      <h4 className="mt-0.5 text-sm font-semibold text-[#202B3C]">{eq?.name}</h4>
                      <p className="mt-0.5 text-xs text-[#526075]">
                        Requested by <strong>{requester?.name}</strong>: {req.justification}
                      </p>
                    </div>
                    <StatusBadge
                      label={req.status.replace('_', ' ').toUpperCase()}
                      tone={
                        req.status === 'scheduled' || req.status === 'approved'
                          ? 'success'
                          : req.status === 'pending_approval'
                            ? 'warning'
                            : 'error'
                      }
                    />
                  </div>

                  {req.reviewNotes && (
                    <p className="text-[11px] text-[#718096]">
                      Admin Note: {req.reviewNotes}
                      {req.linkedBookingId ? ` · Linked Booking: ${req.linkedBookingId}` : ''}
                    </p>
                  )}

                  {req.status === 'pending_approval' && canApprove && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-[#E6EAF0] pt-2.5">
                      <input
                        type="text"
                        placeholder="Optional review notes..."
                        value={reviewNotes[req.id] ?? ''}
                        onChange={(e) =>
                          setReviewNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        className="flex-1 min-w-[180px] rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => approveSharingRequest(req.id, reviewNotes[req.id] ?? '')}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Approve & Schedule</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectSharingRequest(req.id, reviewNotes[req.id] ?? '')}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
