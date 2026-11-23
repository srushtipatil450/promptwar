import React, { useMemo, useState } from 'react';
import { CalendarPlus, TrendingUp } from 'lucide-react';
import { useLabLink } from '../context/LabLinkContext';
import { analyticsService } from '../services/analyticsService';
import { MagneticButton, MagneticTiltCard } from '../components/shared/MotionPrimitives';
import { StatusBadge } from '../components/shared/StatusBadge';

export const PredictiveAvailabilityView: React.FC = () => {
  const { db, openBookingModal } = useLabLink();
  const [selectedEqId, setSelectedEqId] = useState(db.equipment[0]?.id ?? 'eq-oscilloscope');

  const forecast = useMemo(
    () => analyticsService.getPredictiveAvailability(db, selectedEqId, 7),
    [db, selectedEqId]
  );

  const equipment = db.equipment.find((e) => e.id === selectedEqId);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E6EAF0] bg-white p-5">
        <div className="flex-1 min-w-[260px]">
          <label className="mb-1.5 block text-xs font-medium text-[#718096]">
            Select Instrument for 7-Day Availability Forecast
          </label>
          <select
            value={selectedEqId}
            onChange={(e) => setSelectedEqId(e.target.value)}
            className="w-full max-w-lg rounded-xl border border-[#E6EAF0] bg-white px-3.5 py-2 text-sm font-medium text-[#202B3C]"
          >
            {db.equipment.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.name} ({eq.hourlyDemandBaseline}h/wk baseline)
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-[#C9DDFE] bg-[#EAF2FF] px-4 py-2.5 text-xs text-[#285EC7]">
          <strong>Confirmed vs. Predicted:</strong> Predictions factor historical usage & waiting
          queue pressure, while confirmed bookings are revalidated live by the scheduler.
        </div>
      </section>

      {/* 7-Day Visual Bar Forecast */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#3978E8]" />
            <h2 className="text-base font-semibold text-[#202B3C]">
              7-Day Predicted Open Capacity — {equipment?.name}
            </h2>
          </div>
          <span className="text-xs text-[#718096]">Maintenance-locked units excluded</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {forecast.map((day, idx) => (
            <MagneticTiltCard
              key={day.date}
              index={idx}
              maxTilt={3.2}
              className="flex flex-col justify-between rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-3.5"
            >
              <div className="relative z-10">
                <p className="font-mono text-xs font-semibold text-[#202B3C] tabular-nums">
                  {day.date}
                </p>
                <div className="mt-2">
                  <StatusBadge
                    label={`${day.demandLevel} Demand`}
                    tone={
                      day.demandLevel === 'Low'
                        ? 'success'
                        : day.demandLevel === 'Moderate'
                          ? 'warning'
                          : 'error'
                    }
                  />
                </div>

                {/* Bar indicator */}
                <div className="mt-3">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#718096]">Pred. Open</span>
                    <span className="font-mono font-semibold tabular-nums text-[#202B3C]">
                      {day.predictedOpenRatio}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white border border-[#E6EAF0]">
                    <div
                      className="h-full rounded-full bg-[#3978E8] transition-all duration-300"
                      style={{ width: `${day.predictedOpenRatio}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-[11px] text-[#526075]">
                  <p className="tabular-nums">
                    Confirmed Booked: <strong>{day.confirmedBookedUnits}</strong> /{' '}
                    {day.healthyTotalUnits} healthy
                  </p>
                  {day.maintenanceLockedUnits > 0 && (
                    <p className="text-amber-700 tabular-nums">
                      {day.maintenanceLockedUnits} unit(s) locked
                    </p>
                  )}
                  <p className="text-[10px] text-[#718096]">{day.suggestedWindow}</p>
                </div>
              </div>

              <MagneticButton
                strength={2.5}
                disabled={day.healthyTotalUnits === 0}
                onClick={() => openBookingModal({ equipmentId: selectedEqId, date: day.date })}
                className="relative z-10 mt-3 inline-flex items-center justify-center gap-1 rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#3978E8] hover:border-[#C9DDFE] hover:bg-[#EAF2FF] disabled:opacity-40"
              >
                <CalendarPlus className="h-3 w-3 transition-transform duration-150 group-hover/magbtn:scale-110" />
                <span>Revalidate & Book</span>
              </MagneticButton>
            </MagneticTiltCard>
          ))}
        </div>
      </section>
    </div>
  );
};
