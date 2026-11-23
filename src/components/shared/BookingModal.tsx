import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarClock, CheckCircle2, Layers, LifeBuoy, ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLabLink } from '../../context/LabLinkContext';
import { safetyService } from '../../services/safetyService';
import { schedulingService } from '../../services/schedulingService';
import { BookingRequest } from '../../types/lablink';
import { StatusBadge, unitStatusLabel, unitStatusTone } from './StatusBadge';

export const BookingModal: React.FC = () => {
  const {
    db,
    currentUser,
    bookingModalDraft,
    closeBookingModal,
    createBooking,
    joinWaitingList,
    submitSharingRequest,
    setActiveView,
    setFocusedEquipmentId,
  } = useLabLink();

  const [equipmentId, setEquipmentId] = useState(
    bookingModalDraft?.equipmentId ?? db.equipment[0]?.id ?? ''
  );
  const [preferredUnitId, setPreferredUnitId] = useState<string>(
    bookingModalDraft?.preferredUnitId ?? ''
  );
  const [projectId, setProjectId] = useState<string>(
    bookingModalDraft?.projectId ?? db.projects.find((p) => p.ownerId === currentUser.id)?.id ?? ''
  );
  const [date, setDate] = useState(bookingModalDraft?.date ?? '2026-11-24');
  const [startHour, setStartHour] = useState(10);
  const [endHour, setEndHour] = useState(12);
  const [purpose, setPurpose] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState<BookingRequest['urgencyLevel']>('high');
  const [dependencyLevel, setDependencyLevel] =
    useState<BookingRequest['projectDependencyLevel']>('blocking');
  const [confirmedLabel, setConfirmedLabel] = useState<string | null>(null);

  useEffect(() => {
    if (bookingModalDraft) {
      setEquipmentId(bookingModalDraft.equipmentId);
      setPreferredUnitId(bookingModalDraft.preferredUnitId ?? '');
      setProjectId(
        bookingModalDraft.projectId !== undefined
          ? (bookingModalDraft.projectId ?? '')
          : (db.projects.find((p) => p.ownerId === currentUser.id)?.id ?? '')
      );
      setDate(bookingModalDraft.date ?? '2026-11-24');
      setStartHour(bookingModalDraft.startHour ?? 10);
      setEndHour(bookingModalDraft.endHour ?? 12);
      setPurpose('');
      setUrgencyLevel('high');
      setDependencyLevel('blocking');
      setConfirmedLabel(null);
    }
  }, [bookingModalDraft, db.projects, currentUser.id]);

  useEffect(() => {
    if (!bookingModalDraft) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeBookingModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bookingModalDraft, closeBookingModal]);

  const equipment = useMemo(
    () => db.equipment.find((e) => e.id === equipmentId),
    [db.equipment, equipmentId]
  );
  const lab = useMemo(
    () => db.laboratories.find((l) => l.id === equipment?.laboratoryId),
    [db.laboratories, equipment]
  );
  const units = useMemo(
    () => db.physicalUnits.filter((u) => u.equipmentId === equipmentId),
    [db.physicalUnits, equipmentId]
  );

  const readiness = useMemo(() => {
    if (!equipment) return null;
    return safetyService.evaluateUserReadiness(db, currentUser.id, equipment, lab);
  }, [db, currentUser.id, equipment, lab]);

  const needsCrossDept = Boolean(
    equipment &&
      currentUser.role === 'student' &&
      equipment.requiresCrossDeptApproval &&
      equipment.departmentId !== currentUser.departmentId
  );

  const openUnitForSlot = useMemo(() => {
    if (!equipment) return null;
    return schedulingService.findAvailableUnitForSlot(
      db,
      equipment.id,
      date,
      startHour,
      endHour,
      preferredUnitId || null
    );
  }, [db, equipment, date, startHour, endHour, preferredUnitId]);

  const previewPriority = useMemo(() => {
    if (!equipment) return null;
    return schedulingService.computePriorityBreakdown(db, {
      userId: currentUser.id,
      equipmentId: equipment.id,
      projectId: projectId || null,
      startHour,
      endHour,
      urgencyLevel,
      projectDependencyLevel: dependencyLevel,
    });
  }, [db, currentUser.id, equipment, projectId, startHour, endHour, urgencyLevel, dependencyLevel]);

  if (!bookingModalDraft || !equipment) return null;

  const userProjects = db.projects.filter(
    (p) => p.ownerId === currentUser.id || currentUser.role !== 'student'
  );

  const triggerConfirmedClose = (summaryText: string) => {
    setConfirmedLabel(summaryText);
    window.setTimeout(() => {
      setConfirmedLabel(null);
      closeBookingModal();
    }, 450);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (needsCrossDept) {
      const res = submitSharingRequest({
        equipmentId: equipment.id,
        requestedDate: date,
        startHour,
        endHour,
        projectId: projectId || null,
        justification: purpose || 'Project hardware verification session',
      });
      if (res.ok) triggerConfirmedClose('Cross-department sharing request submitted');
      return;
    }

    const res = createBooking({
      equipmentId: equipment.id,
      preferredUnitId: preferredUnitId || null,
      projectId: projectId || null,
      date,
      startHour,
      endHour,
      purpose,
      urgencyLevel,
      projectDependencyLevel: dependencyLevel,
    });
    if (res.ok) triggerConfirmedClose(res.message);
  };

  const handleJoinWaitlist = () => {
    const res = joinWaitingList({
      equipmentId: equipment.id,
      projectId: projectId || null,
      desiredDate: date,
      startHour,
      endHour,
    });
    if (res.ok) {
      closeBookingModal();
      setActiveView('waiting-list');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[#E6EAF0] bg-white shadow-xl"
        >
        <div className="flex items-center justify-between border-b border-[#E6EAF0] px-6 py-4">
          <div>
            <h2 id="booking-modal-title" className="text-lg font-semibold text-[#202B3C]">
              {needsCrossDept ? 'Cross-Department Request & Booking' : 'Schedule Equipment Booking'}
            </h2>
            <p className="text-xs text-[#718096]">
              {lab?.code} · {lab?.name} · Hours {lab?.operatingHours.openHour}:00–
              {lab?.operatingHours.closeHour}:00
            </p>
          </div>
          <button
            type="button"
            onClick={closeBookingModal}
            className="rounded-lg p-2 text-[#718096] hover:bg-[#F7F9FC] hover:text-[#202B3C]"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] space-y-4 overflow-y-auto px-6 py-5">
          {/* Equipment selector */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#202B3C]">
                Equipment Model
              </label>
              <select
                value={equipmentId}
                onChange={(e) => {
                  setEquipmentId(e.target.value);
                  setPreferredUnitId('');
                }}
                className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-sm text-[#202B3C] focus:border-[#3978E8] focus:outline-none"
              >
                {db.equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#202B3C]">
                Preferred Physical Unit (Optional)
              </label>
              <select
                value={preferredUnitId}
                onChange={(e) => setPreferredUnitId(e.target.value)}
                className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-sm text-[#202B3C] focus:border-[#3978E8] focus:outline-none"
              >
                <option value="">Auto-assign best open unit</option>
                {units.map((u) => (
                  <option
                    key={u.id}
                    value={u.id}
                    disabled={u.status === 'maintenance' || u.status === 'faulty'}
                  >
                    {u.unitCode} ({unitStatusLabel(u.status)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Physical units status strip */}
          <div className="rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-[#718096]">
              <span className="inline-flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-[#3978E8]" />
                Physical Units for {equipment.name}
              </span>
              <span className="tabular-nums">Max {equipment.maxBookingHours}h / session</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {units.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-2 rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-xs"
                >
                  <span className="font-mono font-semibold text-[#202B3C]">{u.unitCode}</span>
                  <StatusBadge label={unitStatusLabel(u.status)} tone={unitStatusTone(u.status)} />
                </div>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#202B3C]">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-xl border border-[#E6EAF0] px-3 py-2 text-sm tabular-nums text-[#202B3C] focus:border-[#3978E8] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#202B3C]">Start Hour</label>
              <select
                value={startHour}
                onChange={(e) => {
                  const nextStart = Number(e.target.value);
                  setStartHour(nextStart);
                  if (endHour <= nextStart) {
                    setEndHour(Math.min(21, nextStart + 1));
                  }
                }}
                className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-sm tabular-nums text-[#202B3C] focus:border-[#3978E8] focus:outline-none"
              >
                {Array.from({ length: 14 }, (_, idx) => idx + 7).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#202B3C]">End Hour</label>
              <select
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
                className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-sm tabular-nums text-[#202B3C] focus:border-[#3978E8] focus:outline-none"
              >
                {Array.from({ length: 14 }, (_, idx) => idx + 8).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Project & Priority */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#202B3C]">
                Linked Project
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-sm text-[#202B3C] focus:border-[#3978E8] focus:outline-none"
              >
                <option value="">Independent Session</option>
                {userProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#202B3C]">
                Deadline Urgency
              </label>
              <select
                value={urgencyLevel}
                onChange={(e) => setUrgencyLevel(e.target.value as BookingRequest['urgencyLevel'])}
                className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-sm text-[#202B3C] focus:border-[#3978E8] focus:outline-none"
              >
                <option value="standard">Standard</option>
                <option value="high">High (Milestone)</option>
                <option value="critical">Critical (Final Demo)</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#202B3C]">
                Project Dependency
              </label>
              <select
                value={dependencyLevel}
                onChange={(e) =>
                  setDependencyLevel(e.target.value as BookingRequest['projectDependencyLevel'])
                }
                className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-sm text-[#202B3C] focus:border-[#3978E8] focus:outline-none"
              >
                <option value="optional">Optional</option>
                <option value="supporting">Supporting</option>
                <option value="blocking">Blocking Path</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#202B3C]">
              Session Purpose / Experiment Scope
            </label>
            <textarea
              rows={2}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              required
              placeholder="Describe the measurement, fabrication run, or test objective..."
              className="w-full rounded-xl border border-[#E6EAF0] px-3 py-2 text-sm text-[#202B3C] focus:border-[#3978E8] focus:outline-none"
            />
          </div>

          {/* Safety & Cross-Dept & Live Slot Diagnostics */}
          <div className="space-y-2.5">
            {readiness && !readiness.eligible && (
              <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">Safety Gate: {readiness.statusLabel}</p>
                    <p className="mt-0.5">
                      {[
                        ...readiness.missingCertifications,
                        ...readiness.pendingVerification,
                        ...readiness.expiredCertifications,
                      ].join(' · ')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    closeBookingModal();
                    setActiveView('safety-readiness');
                  }}
                  className="rounded-lg bg-white px-2.5 py-1 font-medium text-rose-700 border border-rose-200 hover:bg-rose-100 whitespace-nowrap shrink-0"
                >
                  Open Safety Training
                </button>
              </div>
            )}

            {readiness?.eligible && (
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs text-emerald-800">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="h-4 w-4" />
                  Lab Passport Safety Verified for {currentUser.name}
                </span>
                {previewPriority && (
                  <span className="font-mono font-semibold tabular-nums">
                    Fair Priority Score: {previewPriority.totalScore}/100
                  </span>
                )}
              </div>
            )}

            {needsCrossDept && (
              <div className="flex items-start gap-2 rounded-xl border border-[#D9D1FC] bg-[#EEEAFE] px-3.5 py-2.5 text-xs text-[#4C3AB0]">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  This instrument belongs to another department and requires Cross-Department Sharing
                  approval. Submitting will route directly to the host Lab Administrator.
                </span>
              </div>
            )}

            {!needsCrossDept && !openUnitForSlot && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                <span>
                  All healthy physical units are occupied for {date} ({startHour}:00–{endHour}:00).
                  Join the Smart Waiting List or launch Resource Rescue for instant alternatives.
                </span>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setFocusedEquipmentId(equipment.id);
                      closeBookingModal();
                      setActiveView('resource-rescue');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-medium text-amber-900 hover:bg-amber-100 whitespace-nowrap"
                  >
                    <LifeBuoy className="h-3.5 w-3.5" />
                    <span>Resource Rescue</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleJoinWaitlist}
                    className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-medium text-amber-900 hover:bg-amber-100 whitespace-nowrap"
                  >
                    Join Waiting List
                  </button>
                </div>
              </div>
            )}

            {!needsCrossDept && openUnitForSlot && readiness?.eligible && (
              <div className="flex items-center gap-2 rounded-xl border border-[#C9DDFE] bg-[#EAF2FF] px-3.5 py-2 text-xs text-[#285EC7]">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Unit <strong className="font-mono">{openUnitForSlot.unitCode}</strong> is open for
                  immediate scheduler confirmation on {date}.
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[#E6EAF0] pt-4">
            <button
              type="button"
              onClick={closeBookingModal}
              className="rounded-xl border border-[#E6EAF0] bg-white px-4 py-2 text-sm font-medium text-[#202B3C] hover:bg-[#F7F9FC]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#3978E8] px-4 py-2 text-sm font-medium text-white hover:bg-[#2E67CE] transition-colors"
            >
              {needsCrossDept ? 'Submit Cross-Dept Request' : 'Submit Booking Request'}
            </button>
          </div>
        </form>

        <AnimatePresence>
          {confirmedLabel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/95 p-6 text-center backdrop-blur-xs"
            >
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
              >
                <CheckCircle2 className="h-8 w-8" />
              </motion.div>
              <p className="mt-3 text-base font-semibold text-[#202B3C]">Booking Recorded</p>
              <p className="mt-1 max-w-sm text-xs text-[#526075]">{confirmedLabel}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
    </AnimatePresence>
  );
};
