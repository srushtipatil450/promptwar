import React from 'react';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Box,
  CalendarClock,
  Cpu,
  Hourglass,
  Layers,
  Radio,
  ShieldAlert,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLabLink } from '../context/LabLinkContext';
import { analyticsService } from '../services/analyticsService';
import {
  AnimatedNumber,
  CursorSpotlightSection,
  MagneticButton,
  MagneticParallaxLayer,
  MagneticTiltCard,
  ProgressRing,
} from '../components/shared/MotionPrimitives';
import {
  CursorParticleField,
  ScientificOrbitalIllustration,
} from '../components/shared/ScientificVisuals';
import { StatusBadge, unitStatusLabel, unitStatusTone } from '../components/shared/StatusBadge';

export const OverviewView: React.FC = () => {
  const { db, currentUser, setActiveView, openBookingModal, acceptOffer, declineOffer } =
    useLabLink();

  const totalUnits = db.physicalUnits.length;
  const availableUnits = db.physicalUnits.filter((u) => u.status === 'available').length;
  const lockedUnits = db.physicalUnits.filter(
    (u) => u.status === 'maintenance' || u.status === 'faulty'
  ).length;
  const activeBookings = db.bookingRequests.filter((b) => b.status === 'approved').length;
  const pendingBookings = db.bookingRequests.filter((b) => b.status === 'pending').length;
  const pendingSharing = db.sharingRequests.filter((s) => s.status === 'pending_approval').length;

  const activeOffersForUser = db.availabilityOffers.filter(
    (o) =>
      o.status === 'active' &&
      (o.userId === currentUser.id || currentUser.role !== 'student')
  );

  const userVerifiedCerts = db.trainingRecords.filter(
    (r) => r.userId === currentUser.id && r.status === 'verified'
  ).length;

  const deptMetrics = analyticsService.getDepartmentParticipationMetrics(db);
  const achievements = analyticsService.getUserAchievements(db, currentUser.id);
  const recentBookings = db.bookingRequests.slice(0, 5);
  const openRatioPct = totalUnits > 0 ? Math.round((availableUnits / totalUnits) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Welcome Banner with Global Cursor Spotlight, Subtle Particle Field & Scientific Orbital Graphic */}
      <CursorSpotlightSection
        spotlightRadius={420}
        intensity="medium"
        className="rounded-2xl border border-[#E6EAF0] bg-white p-6"
      >
        <CursorParticleField particleCount={16} />
        <div className="relative z-10 flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#3978E8]">
              Intelligent Campus Laboratory Ecosystem · {currentUser.role.replace('_', ' ').toUpperCase()}
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#202B3C]">
              Welcome back, {currentUser.name}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-[#718096]">
              Discover cross-department instruments, verify safety readiness, resolve scheduling
              conflicts fairly, and track physical laboratory units from one shared source of truth.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <MagneticButton
                onClick={() => setActiveView('project-matcher')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#3978E8] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#2E67CE] whitespace-nowrap"
              >
                <Sparkles className="h-3.5 w-3.5 transition-transform duration-200 group-hover/magbtn:rotate-12 group-hover/magbtn:scale-110" />
                <span>Match Project Hardware</span>
              </MagneticButton>
              <MagneticButton
                strength={3}
                onClick={() => setActiveView('lab-map')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6EAF0] bg-white px-4 py-2.5 text-xs font-medium text-[#202B3C] hover:border-[#C9DDFE] hover:bg-[#F7F9FC] whitespace-nowrap"
              >
                <span>Explore Lab Map</span>
                <ArrowRight className="h-3.5 w-3.5 text-[#3978E8] transition-transform duration-150 group-hover/magbtn:translate-x-0.5" />
              </MagneticButton>
            </div>
          </div>

          <div className="hidden shrink-0 lg:block">
            <ScientificOrbitalIllustration className="h-32 w-52" />
          </div>
        </div>
      </CursorSpotlightSection>

      {/* Active Waiting List Offer Alert */}
      {activeOffersForUser.length > 0 && (
        <section className="rounded-2xl border border-[#C9DDFE] bg-[#EAF2FF] p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-[#3978E8]" />
              <div>
                <h3 className="text-sm font-semibold text-[#202B3C]">
                  Active Waiting-List Availability Offer
                </h3>
                {activeOffersForUser.map((offer) => {
                  const eq = db.equipment.find((e) => e.id === offer.equipmentId);
                  const unit = db.physicalUnits.find((u) => u.id === offer.unitId);
                  return (
                    <p key={offer.id} className="mt-0.5 text-xs text-[#285EC7]">
                      Unit <strong className="font-mono">{unit?.unitCode}</strong> ({eq?.name}) is
                      open on {offer.date} ({offer.startHour}:00–{offer.endHour}:00). Accept to
                      revalidate and confirm allocation.
                    </p>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <MagneticButton
                onClick={() => acceptOffer(activeOffersForUser[0].id)}
                className="rounded-xl bg-[#3978E8] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#2E67CE]"
              >
                Accept & Confirm
              </MagneticButton>
              <button
                type="button"
                onClick={() => declineOffer(activeOffersForUser[0].id)}
                className="rounded-xl border border-[#C9DDFE] bg-white px-3.5 py-2 text-xs font-medium text-[#202B3C] hover:bg-[#F7F9FC]"
              >
                Decline
              </button>
            </div>
          </div>
        </section>
      )}

      {/* KPI Summary Strip (Derived live from shared DB) */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MagneticTiltCard
          index={0}
          className="rounded-2xl border border-[#E6EAF0] bg-white p-5"
        >
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-medium text-[#718096]">Physical Units Open</span>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[#202B3C]">
                <AnimatedNumber value={availableUnits} />{' '}
                <span className="text-sm font-normal text-[#718096]">/ {totalUnits}</span>
              </p>
              <p className="mt-1 text-xs text-[#718096]">
                Across {db.laboratories.length} labs in {db.buildings.length} buildings
              </p>
            </div>
            <MagneticParallaxLayer depth={7}>
              <ProgressRing
                percent={openRatioPct}
                size={48}
                strokeWidth={4.5}
                color="#3978E8"
                label={`${openRatioPct}%`}
              />
            </MagneticParallaxLayer>
          </div>
        </MagneticTiltCard>

        <MagneticTiltCard
          index={1}
          className="rounded-2xl border border-[#E6EAF0] bg-white p-5"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#718096]">Active & Pending Bookings</span>
              <MagneticParallaxLayer depth={5}>
                <CalendarClock className="h-4 w-4 text-[#3978E8]" />
              </MagneticParallaxLayer>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-[#202B3C]">
              <AnimatedNumber value={activeBookings} />{' '}
              <span className="text-sm font-normal text-[#718096]">
                approved · <AnimatedNumber value={pendingBookings} /> pending
              </span>
            </p>
            <p className="mt-1 text-xs text-[#718096]">
              {pendingSharing} cross-department request(s) awaiting review
            </p>
          </div>
        </MagneticTiltCard>

        <MagneticTiltCard
          index={2}
          className="rounded-2xl border border-[#E6EAF0] bg-white p-5"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#718096]">Maintenance Lockouts</span>
              <MagneticParallaxLayer depth={5}>
                <Wrench className="h-4 w-4 text-amber-600" />
              </MagneticParallaxLayer>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-[#202B3C]">
              <AnimatedNumber value={lockedUnits} />
            </p>
            <p className="mt-1 text-xs text-[#718096]">
              Automatically excluded from bookings & forecasts
            </p>
          </div>
        </MagneticTiltCard>

        <MagneticTiltCard
          index={3}
          onClick={() => setActiveView('achievements')}
          className="cursor-pointer rounded-2xl border border-[#E6EAF0] bg-white p-5"
        >
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-medium text-[#718096]">
                Passport & Achievements
              </span>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[#202B3C]">
                {currentUser.role === 'student' ? (
                  <>
                    <AnimatedNumber value={userVerifiedCerts} /> Verified
                  </>
                ) : (
                  'Admin'
                )}
              </p>
              <p className="mt-1 text-xs text-[#718096]">
                {achievements.unlockedCount}/{achievements.totalCount} badges ·{' '}
                {currentUser.previousUsageHours}h logged
              </p>
            </div>
            <MagneticParallaxLayer depth={7}>
              <ProgressRing
                percent={achievements.completionPct}
                size={48}
                strokeWidth={4.5}
                color="#16A34A"
                label={`${achievements.unlockedCount}/${achievements.totalCount}`}
              />
            </MagneticParallaxLayer>
          </div>
        </MagneticTiltCard>
      </section>

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Scheduling Activity */}
        <section className="rounded-2xl border border-[#E6EAF0] bg-white p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#202B3C]">
                Live Allocation & Scheduling Queue
              </h3>
              <p className="text-xs text-[#718096]">
                Shared physical-unit reservations across all departments
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('smart-scheduling')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#3978E8] hover:underline"
            >
              <span>Open Scheduler</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E6EAF0] text-[#718096]">
                  <th className="pb-2.5 font-medium">Equipment & Unit</th>
                  <th className="pb-2.5 font-medium">Requester</th>
                  <th className="pb-2.5 font-medium">Schedule</th>
                  <th className="pb-2.5 font-medium text-right">Priority</th>
                  <th className="pb-2.5 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EAF0]">
                {recentBookings.map((bk) => {
                  const eq = db.equipment.find((e) => e.id === bk.equipmentId);
                  const unit = db.physicalUnits.find((u) => u.id === bk.allocatedUnitId);
                  const user = db.users.find((u) => u.id === bk.userId);
                  return (
                    <tr key={bk.id} className="hover:bg-[#F7F9FC]">
                      <td className="py-3 pr-3">
                        <p className="font-medium text-[#202B3C]">{eq?.name}</p>
                        <p className="font-mono text-[11px] text-[#718096]">
                          {unit ? unit.unitCode : 'Unassigned'}
                        </p>
                      </td>
                      <td className="py-3 pr-3 text-[#526075]">{user?.name}</td>
                      <td className="py-3 pr-3 tabular-nums text-[#526075]">
                        {bk.date} · {bk.startHour}:00–{bk.endHour}:00
                      </td>
                      <td className="py-3 pr-3 text-right font-mono font-semibold tabular-nums text-[#202B3C]">
                        {bk.priority.totalScore}/100
                      </td>
                      <td className="py-3 text-right">
                        <StatusBadge
                          label={bk.status.charAt(0).toUpperCase() + bk.status.slice(1)}
                          tone={
                            bk.status === 'approved'
                              ? 'success'
                              : bk.status === 'pending'
                                ? 'warning'
                                : bk.status === 'completed'
                                  ? 'info'
                                  : 'neutral'
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Department Participation & Physical Unit Snapshot */}
        <section className="space-y-4">
          <div className="rounded-2xl border border-[#E6EAF0] bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#202B3C]">Department Resource Balance</h3>
              <button
                type="button"
                onClick={() => setActiveView('fair-access')}
                className="text-xs font-medium text-[#3978E8] hover:underline"
              >
                Fairness
              </button>
            </div>
            <div className="space-y-3">
              {deptMetrics.map((d) => (
                <div key={d.departmentId}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#202B3C]">
                      {d.code} · {d.allocatedHours}h allocated
                    </span>
                    <span className="tabular-nums text-[#718096]">{d.approvalRatePct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#F7F9FC]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(12, d.approvalRatePct)}%` }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: d.colorHex }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#E6EAF0] bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-[#202B3C]">Quick Ecosystem Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveView('live-pulse')}
                className="group/qa flex items-center gap-2 rounded-xl border border-[#E6EAF0] p-2.5 text-left text-xs font-medium text-[#202B3C] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#C9DDFE] hover:bg-[#F7F9FC]"
              >
                <Radio className="h-4 w-4 text-[#3978E8] transition-transform duration-150 group-hover/qa:scale-110" />
                <span>Live Lab Pulse</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('digital-twin')}
                className="group/qa flex items-center gap-2 rounded-xl border border-[#E6EAF0] p-2.5 text-left text-xs font-medium text-[#202B3C] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#C9DDFE] hover:bg-[#F7F9FC]"
              >
                <Box className="h-4 w-4 text-[#3978E8] transition-transform duration-150 group-hover/qa:rotate-12" />
                <span>3D Lab Twin</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('equipment-tracking')}
                className="group/qa flex items-center gap-2 rounded-xl border border-[#E6EAF0] p-2.5 text-left text-xs font-medium text-[#202B3C] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#C9DDFE] hover:bg-[#F7F9FC]"
              >
                <Layers className="h-4 w-4 text-[#3978E8] transition-transform duration-150 group-hover/qa:-translate-y-0.5" />
                <span>QR Check-Out</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('achievements')}
                className="group/qa flex items-center gap-2 rounded-xl border border-[#E6EAF0] p-2.5 text-left text-xs font-medium text-[#202B3C] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#C9DDFE] hover:bg-[#F7F9FC]"
              >
                <Award className="h-4 w-4 text-emerald-600 transition-transform duration-150 group-hover/qa:scale-110 group-hover/qa:-rotate-6" />
                <span>Achievements</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('safety-readiness')}
                className="group/qa flex items-center gap-2 rounded-xl border border-[#E6EAF0] p-2.5 text-left text-xs font-medium text-[#202B3C] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#C9DDFE] hover:bg-[#F7F9FC]"
              >
                <ShieldAlert className="h-4 w-4 text-emerald-600 transition-transform duration-150 group-hover/qa:scale-110" />
                <span>Safety Quiz</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  openBookingModal({ equipmentId: db.equipment[0]?.id ?? 'eq-oscilloscope' })
                }
                className="group/qa flex items-center gap-2 rounded-xl border border-[#E6EAF0] p-2.5 text-left text-xs font-medium text-[#202B3C] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#C9DDFE] hover:bg-[#F7F9FC]"
              >
                <Cpu className="h-4 w-4 text-[#3978E8] transition-transform duration-150 group-hover/qa:rotate-6 group-hover/qa:scale-110" />
                <span>New Booking</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Physical Unit Health Strip */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#202B3C]">
              Serialized Physical Units Snapshot
            </h3>
            <p className="text-xs text-[#718096]">
              Individual unit identity prevents overlapping reservations across multi-unit inventory
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveView('equipment-health')}
            className="text-xs font-medium text-[#3978E8] hover:underline"
          >
            Manage Maintenance
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {db.physicalUnits.slice(0, 12).map((u) => {
            const eq = db.equipment.find((e) => e.id === u.equipmentId);
            return (
              <div
                key={u.id}
                className="flex flex-col justify-between rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-3"
              >
                <div>
                  <p className="font-mono text-xs font-bold text-[#202B3C]">{u.unitCode}</p>
                  <p className="mt-0.5 truncate text-[11px] text-[#718096]">{eq?.name}</p>
                </div>
                <div className="mt-2.5">
                  <StatusBadge label={unitStatusLabel(u.status)} tone={unitStatusTone(u.status)} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
