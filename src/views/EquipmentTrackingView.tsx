import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Camera, CheckCircle2, QrCode, RotateCcw, Search } from 'lucide-react';
import { useLabLink } from '../context/LabLinkContext';
import { qrTrackingService } from '../services/qrTrackingService';
import { StatusBadge, unitStatusLabel, unitStatusTone } from '../components/shared/StatusBadge';

export const EquipmentTrackingView: React.FC = () => {
  const { db, focusedUnitId, qrCheckOut, qrReturnUnit, notifyAction } = useLabLink();

  const [lookupInput, setLookupInput] = useState(
    db.physicalUnits.find((u) => u.id === focusedUnitId)?.unitCode ?? 'OSC-001'
  );
  const [selectedUnitId, setSelectedUnitId] = useState(
    focusedUnitId ?? db.physicalUnits[0]?.id ?? 'unit-osc-001'
  );
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [conditionNote, setConditionNote] = useState('');
  const [returnHours, setReturnHours] = useState(2);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (focusedUnitId) {
      const u = db.physicalUnits.find((item) => item.id === focusedUnitId);
      if (u) {
        setSelectedUnitId(u.id);
        setLookupInput(u.unitCode);
      }
    }
  }, [focusedUnitId, db.physicalUnits]);

  const selectedUnit = useMemo(
    () => db.physicalUnits.find((u) => u.id === selectedUnitId) ?? db.physicalUnits[0],
    [db.physicalUnits, selectedUnitId]
  );
  const equipment = db.equipment.find((e) => e.id === selectedUnit?.equipmentId);
  const lab = db.laboratories.find((l) => l.id === selectedUnit?.laboratoryId);

  useEffect(() => {
    if (!selectedUnit) return;
    QRCode.toDataURL(selectedUnit.qrPayload, {
      width: 160,
      margin: 1,
      color: { dark: '#202B3C', light: '#FFFFFF' },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [selectedUnit]);

  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const found = qrTrackingService.lookupUnitByCode(db, lookupInput);
    if (found) {
      setSelectedUnitId(found.id);
      notifyAction({ ok: true, message: `Loaded physical unit ${found.unitCode}.` });
    } else {
      notifyAction({
        ok: false,
        message: `No physical unit matched "${lookupInput.trim()}". Try a unit code like OSC-001 or PWR-001.`,
      });
    }
  };

  const toggleCamera = async () => {
    setCameraError(null);
    if (cameraActive) {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
      setCameraActive(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera API unavailable in this browser context. Use manual unit lookup below.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch {
      setCameraError(
        'Camera permission denied or no camera device detected. Manual unit ID lookup remains active.'
      );
      setCameraActive(false);
    }
  };

  const approvedBooking = db.bookingRequests.find(
    (b) => b.status === 'approved' && b.allocatedUnitId === selectedUnit?.id
  );
  const bookingOwner = approvedBooking
    ? db.users.find((u) => u.id === approvedBooking.userId)
    : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Scanner & Manual Lookup */}
        <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6 lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#202B3C]">
                QR Code & Unit ID Lookup
              </h2>
              <p className="text-xs text-[#718096]">
                Check-out strictly requires an approved unit booking
              </p>
            </div>
            <button
              type="button"
              onClick={toggleCamera}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] px-3 py-1.5 text-xs font-medium text-[#202B3C] hover:bg-[#EAF2FF]"
            >
              <Camera className="h-3.5 w-3.5 text-[#3978E8]" />
              <span>{cameraActive ? 'Stop Camera' : 'Camera Scan'}</span>
            </button>
          </div>

          {cameraError && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {cameraError}
            </p>
          )}

          {cameraActive && (
            <div className="overflow-hidden rounded-xl border border-[#E6EAF0] bg-slate-900">
              <video ref={videoRef} autoPlay playsInline muted className="h-44 w-full object-cover" />
            </div>
          )}

          <form onSubmit={handleLookup} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#718096]" />
              <input
                type="text"
                value={lookupInput}
                onChange={(e) => setLookupInput(e.target.value)}
                placeholder="Enter Unit Code (e.g. OSC-001, PWR-001)"
                className="w-full rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] py-2 pl-8 pr-3 font-mono text-xs text-[#202B3C] focus:border-[#3978E8] focus:bg-white focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-[#3978E8] px-4 py-2 text-xs font-medium text-white hover:bg-[#2E67CE]"
            >
              Lookup
            </button>
          </form>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#718096]">
              Or Select Physical Unit Directly
            </label>
            <select
              value={selectedUnit?.id ?? ''}
              onChange={(e) => {
                const u = db.physicalUnits.find((item) => item.id === e.target.value);
                setSelectedUnitId(e.target.value);
                if (u) setLookupInput(u.unitCode);
              }}
              className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-xs"
            >
              {db.physicalUnits.map((u) => {
                const eq = db.equipment.find((e) => e.id === u.equipmentId);
                return (
                  <option key={u.id} value={u.id}>
                    {u.unitCode} — {eq?.name} ({unitStatusLabel(u.status)})
                  </option>
                );
              })}
            </select>
          </div>
        </section>

        {/* Active Unit QR Card & Check-Out/Return Controls */}
        {selectedUnit && (
          <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6 lg:col-span-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center rounded-2xl border border-[#E6EAF0] bg-[#F7F9FC] p-4 shrink-0">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR code for ${selectedUnit.unitCode}`}
                    className="h-36 w-36 rounded-lg bg-white p-1"
                  />
                ) : (
                  <div className="flex h-36 w-36 items-center justify-center rounded-lg bg-white">
                    <QrCode className="h-12 w-12 text-[#718096]" />
                  </div>
                )}
                <p className="mt-2 font-mono text-[10px] font-medium text-[#526075]">
                  {selectedUnit.qrPayload}
                </p>
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-bold text-[#3978E8]">
                      {selectedUnit.unitCode} · SN {selectedUnit.serialNumber}
                    </p>
                    <h3 className="mt-0.5 text-base font-semibold text-[#202B3C]">
                      {equipment?.name}
                    </h3>
                    <p className="text-xs text-[#718096]">
                      {lab?.code} ({lab?.name}) · Usage {selectedUnit.measuredUsageHours}h
                    </p>
                  </div>
                  <StatusBadge
                    label={unitStatusLabel(selectedUnit.status)}
                    tone={unitStatusTone(selectedUnit.status)}
                  />
                </div>

                {approvedBooking ? (
                  <div className="rounded-xl border border-[#C9DDFE] bg-[#EAF2FF] px-3 py-2 text-xs text-[#285EC7]">
                    Approved Booking <strong className="font-mono">{approvedBooking.id}</strong> for{' '}
                    <strong>{bookingOwner?.name}</strong> ({approvedBooking.date},{' '}
                    {approvedBooking.startHour}:00–{approvedBooking.endHour}:00).
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] px-3 py-2 text-xs text-[#718096]">
                    No active approved booking assigned to {selectedUnit.unitCode}. Check-out is
                    blocked until a booking is approved.
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <input
                    type="text"
                    value={conditionNote}
                    onChange={(e) => setConditionNote(e.target.value)}
                    placeholder="Condition / calibration note..."
                    className="sm:col-span-2 rounded-xl border border-[#E6EAF0] px-3 py-2 text-xs"
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[#718096]">Hours:</span>
                    <input
                      type="number"
                      min={0.5}
                      max={12}
                      step={0.5}
                      value={returnHours}
                      onChange={(e) => setReturnHours(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#E6EAF0] px-2.5 py-2 font-mono text-xs tabular-nums"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const res = qrCheckOut(selectedUnit.id, conditionNote);
                      if (res.ok) setConditionNote('');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#3978E8] px-4 py-2 text-xs font-medium text-white hover:bg-[#2E67CE]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Check Out Unit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const res = qrReturnUnit(selectedUnit.id, returnHours, conditionNote);
                      if (res.ok) setConditionNote('');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6EAF0] bg-white px-4 py-2 text-xs font-medium text-[#202B3C] hover:bg-[#F7F9FC]"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Return & Release Unit</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Tracking History Log */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-[#202B3C]">
          Unit QR Check-Out & Return History ({db.qrTrackingHistory.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E6EAF0] text-[#718096]">
              <tr>
                <th className="pb-2.5 font-medium">Unit</th>
                <th className="pb-2.5 font-medium">Action</th>
                <th className="pb-2.5 font-medium">Actor</th>
                <th className="pb-2.5 font-medium">Location</th>
                <th className="pb-2.5 font-medium">Condition Note</th>
                <th className="pb-2.5 font-medium text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EAF0]">
              {db.qrTrackingHistory.map((ev) => {
                const unit = db.physicalUnits.find((u) => u.id === ev.unitId);
                const actor = db.users.find((u) => u.id === ev.userId);
                return (
                  <tr key={ev.id} className="hover:bg-[#F7F9FC]">
                    <td className="py-3 font-mono font-semibold text-[#202B3C]">
                      {unit?.unitCode}
                    </td>
                    <td className="py-3">
                      <StatusBadge
                        label={ev.action.replace('_', ' ').toUpperCase()}
                        tone={
                          ev.action === 'returned'
                            ? 'success'
                            : ev.action === 'checked_out'
                              ? 'lavender'
                              : 'warning'
                        }
                      />
                    </td>
                    <td className="py-3 text-[#526075]">{actor?.name}</td>
                    <td className="py-3 text-[#526075]">{ev.locationLabel}</td>
                    <td className="py-3 text-[#526075]">{ev.conditionNote}</td>
                    <td className="py-3 text-right font-mono tabular-nums text-[#718096]">
                      {ev.timestamp.slice(0, 16).replace('T', ' ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
