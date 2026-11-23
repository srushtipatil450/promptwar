import React, { useState } from 'react';
import { CheckCircle2, ShieldCheck, Wrench } from 'lucide-react';
import { useLabLink } from '../context/LabLinkContext';
import { MaintenanceRecord } from '../types/lablink';
import { StatusBadge, unitStatusLabel, unitStatusTone } from '../components/shared/StatusBadge';

export const EquipmentHealthView: React.FC = () => {
  const {
    db,
    currentUser,
    reportMaintenanceIssue,
    updateMaintenanceProgress,
    approveReturnToService,
  } = useLabLink();

  const [unitId, setUnitId] = useState(db.physicalUnits[0]?.id ?? '');
  const [issueTitle, setIssueTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<MaintenanceRecord['severity']>('major');
  const [inspectionNotes, setInspectionNotes] = useState<Record<string, string>>({});

  const isAdmin = currentUser.role === 'lab_admin' || currentUser.role === 'system_admin';

  const handleReport = (e: React.FormEvent) => {
    e.preventDefault();
    const res = reportMaintenanceIssue({ unitId, issueTitle, description, severity });
    if (res.ok) {
      setIssueTitle('');
      setDescription('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Student / User Issue Report Form */}
        <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6 lg:col-span-4">
          <div className="mb-4 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-amber-600" />
            <div>
              <h2 className="text-base font-semibold text-[#202B3C]">Report Equipment Issue</h2>
              <p className="text-xs text-[#718096]">
                Major/Critical reports automatically lock the unit from bookings and forecasts
              </p>
            </div>
          </div>

          <form onSubmit={handleReport} className="space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#202B3C]">
                Physical Equipment Unit
              </label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-xs"
              >
                {db.physicalUnits.map((u) => {
                  const eq = db.equipment.find((e) => e.id === u.equipmentId);
                  return (
                    <option key={u.id} value={u.id}>
                      {u.unitCode} — {eq?.name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#202B3C]">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as MaintenanceRecord['severity'])}
                className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-xs"
              >
                <option value="minor">Minor (Advisory, remains bookable)</option>
                <option value="major">Major (Blocks booking immediately)</option>
                <option value="critical">Critical Safety Fault (Lockout)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#202B3C]">
                Issue Summary
              </label>
              <input
                type="text"
                value={issueTitle}
                onChange={(e) => setIssueTitle(e.target.value)}
                required
                placeholder="e.g. Probe BNC connector loose / Axis drift"
                className="w-full rounded-xl border border-[#E6EAF0] px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#202B3C]">
                Diagnostic Details
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                placeholder="Describe symptoms, error codes, or observed calibration offset..."
                className="w-full rounded-xl border border-[#E6EAF0] px-3 py-2 text-xs"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-[#3978E8] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#2E67CE]"
            >
              Submit Issue Report
            </button>
          </form>
        </section>

        {/* Maintenance & Inspection Queue */}
        <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6 lg:col-span-8 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-[#202B3C]">
              Maintenance Tickets & Return-to-Service Sign-Off ({db.maintenanceRecords.length})
            </h3>
            <p className="text-xs text-[#718096]">
              Locked units require authorised Lab Administrator inspection before returning to the
              booking pool
            </p>
          </div>

          <div className="space-y-3">
            {db.maintenanceRecords.map((rec) => {
              const unit = db.physicalUnits.find((u) => u.id === rec.unitId);
              const eq = db.equipment.find((e) => e.id === rec.equipmentId);
              const reporter = db.users.find((u) => u.id === rec.reportedByUserId);
              const canManage =
                isAdmin &&
                (currentUser.role === 'system_admin' ||
                  (unit && currentUser.assignedLabIds.includes(unit.laboratoryId)));

              return (
                <div
                  key={rec.id}
                  className="rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#202B3C]">
                          {unit?.unitCode}
                        </span>
                        <span className="text-sm font-semibold text-[#202B3C]">
                          {rec.issueTitle}
                        </span>
                        <StatusBadge
                          label={rec.severity.toUpperCase()}
                          tone={
                            rec.severity === 'critical'
                              ? 'error'
                              : rec.severity === 'major'
                                ? 'warning'
                                : 'neutral'
                          }
                        />
                      </div>
                      <p className="mt-1 text-xs text-[#526075]">
                        {eq?.name} · Reported by {reporter?.name} · {rec.description}
                      </p>
                    </div>

                    <StatusBadge
                      label={rec.status.replace('_', ' ').toUpperCase()}
                      tone={
                        rec.status === 'resolved'
                          ? 'success'
                          : rec.status === 'awaiting_inspection'
                            ? 'info'
                            : 'warning'
                      }
                    />
                  </div>

                  {rec.inspectionNotes && (
                    <p className="text-[11px] text-emerald-700">
                      Inspection Record: {rec.inspectionNotes}
                    </p>
                  )}

                  {rec.status !== 'resolved' && canManage && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-[#E6EAF0] pt-3">
                      {rec.status === 'reported' && (
                        <button
                          type="button"
                          onClick={() => updateMaintenanceProgress(rec.id, 'in_progress')}
                          className="rounded-lg border border-[#E6EAF0] bg-white px-3 py-1.5 text-xs font-medium text-[#202B3C] hover:bg-[#EAF2FF]"
                        >
                          Assign & Start Repair
                        </button>
                      )}
                      {rec.status === 'in_progress' && (
                        <button
                          type="button"
                          onClick={() => updateMaintenanceProgress(rec.id, 'awaiting_inspection')}
                          className="rounded-lg border border-[#C9DDFE] bg-[#EAF2FF] px-3 py-1.5 text-xs font-medium text-[#285EC7]"
                        >
                          Mark Ready for Inspection
                        </button>
                      )}

                      <input
                        type="text"
                        placeholder="Authorised inspection sign-off notes..."
                        value={inspectionNotes[rec.id] ?? ''}
                        onChange={(e) =>
                          setInspectionNotes((prev) => ({ ...prev, [rec.id]: e.target.value }))
                        }
                        className="flex-1 min-w-[200px] rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          approveReturnToService(rec.id, inspectionNotes[rec.id] ?? '')
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Inspect & Return to Service</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Physical Unit Condition Matrix */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-[#202B3C]">
          Fleet Condition & Calibration Matrix
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {db.physicalUnits.map((u) => {
            const eq = db.equipment.find((e) => e.id === u.equipmentId);
            return (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-3.5"
              >
                <div className="min-w-0 pr-2">
                  <p className="font-mono text-xs font-bold text-[#202B3C]">{u.unitCode}</p>
                  <p className="truncate text-xs text-[#526075]">{eq?.name}</p>
                  <p className="mt-1 text-[11px] tabular-nums text-[#718096]">
                    Condition {u.conditionScore}% · Calibrated {u.lastCalibrationDate}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <StatusBadge label={unitStatusLabel(u.status)} tone={unitStatusTone(u.status)} />
                  {u.conditionScore >= 90 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Nominal
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
