import React, { useMemo } from 'react';
import { Activity, ArrowRight, Info } from 'lucide-react';
import { useLabLink } from '../context/LabLinkContext';
import { analyticsService } from '../services/analyticsService';
import { StatusBadge } from '../components/shared/StatusBadge';

export const IdleResourcesView: React.FC = () => {
  const { db, openBookingModal } = useLabLink();
  const insights = useMemo(() => analyticsService.getIdleResourceInsights(db), [db]);

  const shareableCount = insights.filter((i) => i.shareableCandidate).length;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E6EAF0] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF2FF] text-[#3978E8]">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#202B3C]">
              Idle & Underutilised Campus Resource Discovery
            </h2>
            <p className="text-xs text-[#718096]">
              Distinguishes measured QR/meter hours from booking-based weekly estimates. Idle
              capacity still requires active safety certification and maintenance clearance.
            </p>
          </div>
        </div>
        <StatusBadge label={`${shareableCount} Cross-Dept Share Candidates`} tone="info" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#E6EAF0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E6EAF0] bg-[#F7F9FC] text-[#718096]">
              <tr>
                <th className="px-5 py-3 font-medium">Equipment & Host Lab</th>
                <th className="px-4 py-3 font-medium text-right">Measured Hours / Unit</th>
                <th className="px-4 py-3 font-medium text-right">Booking Estimate (h/wk)</th>
                <th className="px-4 py-3 font-medium">Utilisation Trend</th>
                <th className="px-4 py-3 font-medium">Access Caveat</th>
                <th className="px-5 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EAF0]">
              {insights.map((item) => (
                <tr key={item.equipmentId} className="hover:bg-[#F7F9FC]">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-[#202B3C]">{item.equipmentName}</p>
                    <p className="text-[11px] text-[#718096]">
                      {item.departmentCode} · {item.labCode}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-[#202B3C]">
                    {item.measuredHoursPerUnit}h
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-[#526075]">
                    {item.bookingEstimatedWeeklyHours}h
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-[#F7F9FC] border border-[#E6EAF0]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${item.utilisationPct}%`,
                            backgroundColor:
                              item.utilisationPct < 35
                                ? '#3978E8'
                                : item.utilisationPct < 60
                                  ? '#D97706'
                                  : '#16A34A',
                          }}
                        />
                      </div>
                      <span className="font-mono tabular-nums font-medium">
                        {item.utilisationPct}%
                      </span>
                      <StatusBadge
                        label={item.trend}
                        tone={item.trend === 'Underutilised' ? 'info' : 'neutral'}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3.5 max-w-xs text-[11px] text-[#718096]">
                    <span className="inline-flex items-start gap-1">
                      <Info className="mt-0.5 h-3 w-3 shrink-0 text-[#3978E8]" />
                      <span>{item.availabilityCaveat}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => openBookingModal({ equipmentId: item.equipmentId })}
                      className="inline-flex items-center gap-1 rounded-xl bg-[#EAF2FF] px-3 py-1.5 text-xs font-medium text-[#285EC7] hover:bg-[#DCE9FF] whitespace-nowrap"
                    >
                      <span>Request Share</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
