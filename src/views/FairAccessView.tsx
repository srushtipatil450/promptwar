import React, { useEffect, useMemo, useState } from 'react';
import { Scale, SlidersHorizontal } from 'lucide-react';
import { useLabLink } from '../context/LabLinkContext';
import { analyticsService } from '../services/analyticsService';
import { StatusBadge } from '../components/shared/StatusBadge';

export const FairAccessView: React.FC = () => {
  const { db, currentUser, updateFairnessWeights } = useLabLink();

  const [weights, setWeights] = useState(db.fairnessConfig.schedulingWeights);

  useEffect(() => {
    setWeights(db.fairnessConfig.schedulingWeights);
  }, [db.fairnessConfig.schedulingWeights]);
  const weightSum =
    weights.deadlineUrgency +
    weights.projectDependency +
    weights.durationFeasibility +
    weights.previousFairness +
    weights.submissionTime;

  const deptMetrics = useMemo(
    () => analyticsService.getDepartmentParticipationMetrics(db),
    [db]
  );

  const simulatedQueue = useMemo(
    () => analyticsService.simulateFairnessWeights(db, weights),
    [db, weights]
  );

  const isSysAdmin = currentUser.role === 'system_admin';

  const handleApply = () => {
    updateFairnessWeights(weights);
  };

  return (
    <div className="space-y-6">
      {/* Department Participation */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Scale className="h-4 w-4 text-[#3978E8]" />
          <div>
            <h2 className="text-base font-semibold text-[#202B3C]">
              Department Allocation & Fair Access Distribution
            </h2>
            <p className="text-xs text-[#718096]">
              Higher prior usage applies a gentle fairness offset without permanently penalising any
              student or department
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {deptMetrics.map((d) => (
            <div key={d.departmentId} className="rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#202B3C]">{d.code}</span>
                <span className="font-mono text-xs font-semibold tabular-nums text-[#3978E8]">
                  {d.approvalRatePct}% Approved
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-[#526075] truncate">{d.name}</p>
              <div className="mt-3 flex items-center justify-between text-[11px] tabular-nums text-[#718096]">
                <span>{d.allocatedHours}h allocated</span>
                <span>{d.crossDeptSharedIn} shared in</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Weight Simulator */}
        <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6 lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#202B3C]">
              <SlidersHorizontal className="h-4 w-4 text-[#3978E8]" />
              <span>Allocation Weight Simulator</span>
            </span>
            <StatusBadge
              label={`Total: ${weightSum}%`}
              tone={weightSum === 100 ? 'success' : 'error'}
            />
          </div>

          <div className="space-y-3 text-xs">
            {(
              [
                ['deadlineUrgency', 'Deadline Urgency'],
                ['projectDependency', 'Project Dependency'],
                ['durationFeasibility', 'Duration Feasibility'],
                ['previousFairness', 'Previous Allocation Fairness'],
                ['submissionTime', 'Submission Queue Time'],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <div className="flex justify-between">
                  <label className="font-medium text-[#202B3C]">{label}</label>
                  <span className="font-mono font-semibold tabular-nums text-[#3978E8]">
                    {weights[key]}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={60}
                  step={5}
                  value={weights[key]}
                  onChange={(e) =>
                    setWeights((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                  }
                  className="mt-1 w-full accent-[#3978E8]"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-[#E6EAF0] pt-3">
            <button
              type="button"
              onClick={() => setWeights(db.fairnessConfig.schedulingWeights)}
              className="rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-xs font-medium text-[#202B3C]"
            >
              Reset
            </button>
            <button
              type="button"
              disabled={!isSysAdmin || weightSum !== 100}
              onClick={handleApply}
              className="rounded-xl bg-[#3978E8] px-4 py-2 text-xs font-medium text-white hover:bg-[#2E67CE] disabled:opacity-45"
            >
              {isSysAdmin ? 'Apply Global Weights' : 'System Admin Required'}
            </button>
          </div>
        </section>

        {/* Simulated Priority Impact & Audit Trail */}
        <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6 lg:col-span-7 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-[#202B3C]">
              Live Priority Explanation & Simulation Preview
            </h3>
            <p className="text-xs text-[#718096]">
              Compare current priority scores against your simulated weights before applying
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E6EAF0] text-[#718096]">
                <tr>
                  <th className="pb-2 font-medium">Booking</th>
                  <th className="pb-2 font-medium">Requester</th>
                  <th className="pb-2 font-medium text-right">Current</th>
                  <th className="pb-2 font-medium text-right">Simulated</th>
                  <th className="pb-2 font-medium text-right">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EAF0]">
                {simulatedQueue.map((row) => {
                  const user = db.users.find((u) => u.id === row.userId);
                  const eq = db.equipment.find((e) => e.id === row.equipmentId);
                  return (
                    <tr key={row.bookingId}>
                      <td className="py-2.5 pr-3">
                        <span className="font-mono font-semibold text-[#202B3C]">
                          {row.bookingId}
                        </span>
                        <span className="block text-[11px] text-[#718096]">{eq?.name}</span>
                      </td>
                      <td className="py-2.5 text-[#526075]">{user?.name}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums">
                        {row.currentScore}
                      </td>
                      <td className="py-2.5 text-right font-mono font-semibold tabular-nums text-[#3978E8]">
                        {row.simulatedScore}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums">
                        <span
                          className={
                            row.delta > 0
                              ? 'text-emerald-700'
                              : row.delta < 0
                                ? 'text-rose-700'
                                : 'text-[#718096]'
                          }
                        >
                          {row.delta > 0 ? `+${row.delta}` : row.delta}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#E6EAF0] pt-4">
            <h4 className="mb-2 text-xs font-semibold text-[#202B3C]">
              Administrative Override & Governance Audit Log ({db.auditLogs.length})
            </h4>
            <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1 text-[11px]">
              {db.auditLogs.slice(0, 8).map((log) => {
                const actor = db.users.find((u) => u.id === log.actorUserId);
                return (
                  <div
                    key={log.id}
                    className="flex items-start justify-between gap-2 rounded-lg bg-[#F7F9FC] px-3 py-2"
                  >
                    <div>
                      <span className="font-mono font-semibold text-[#3978E8]">
                        {log.actionType}
                      </span>{' '}
                      <span className="text-[#202B3C]">· {actor?.name}:</span>{' '}
                      <span className="text-[#526075]">{log.details}</span>
                    </div>
                    <span className="font-mono text-[10px] text-[#718096] shrink-0">
                      {log.timestamp.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
