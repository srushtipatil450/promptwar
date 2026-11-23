import React, { useMemo } from 'react';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  CalendarCheck,
  CheckCircle2,
  Compass,
  Cpu,
  Lock,
  QrCode,
  Share2,
} from 'lucide-react';
import { useLabLink } from '../context/LabLinkContext';
import { AchievementBadge, analyticsService } from '../services/analyticsService';
import {
  AnimatedNumber,
  CursorSpotlightSection,
  MagneticButton,
  MagneticParallaxLayer,
  MagneticTiltCard,
  ProgressRing,
} from '../components/shared/MotionPrimitives';
import { StatusBadge } from '../components/shared/StatusBadge';

const CATEGORY_ICON: Record<
  AchievementBadge['category'],
  React.ComponentType<{ className?: string }>
> = {
  Bookings: CalendarCheck,
  Safety: BadgeCheck,
  Mastery: Cpu,
  Collaboration: Share2,
  Projects: Compass,
  Stewardship: QrCode,
};

export const AchievementsView: React.FC = () => {
  const { db, currentUser, setActiveView } = useLabLink();

  const report = useMemo(
    () => analyticsService.getUserAchievements(db, currentUser.id),
    [db, currentUser.id]
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <CursorSpotlightSection
        spotlightRadius={400}
        className="rounded-2xl border border-[#E6EAF0] bg-white p-6"
      >
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EEEAFE] text-[#5B47C7]">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-[#3978E8]">
                Action-Verified Milestones · {currentUser.name}
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-[#202B3C]">
                LabLink Achievements & Stewardship Badges
              </h2>
              <p className="mt-1 max-w-2xl text-xs text-[#718096]">
                Every badge is computed strictly from recorded bookings, verified Lab Passport
                certifications, cross-department sharing requests, saved projects, and QR equipment
                returns — never awarded merely for browsing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-[#E6EAF0] bg-[#F7F9FC] px-5 py-3.5 shrink-0">
            <ProgressRing
              percent={report.completionPct}
              size={56}
              strokeWidth={5.5}
              color="#3978E8"
              label={`${report.completionPct}%`}
            />
            <div>
              <p className="text-xl font-bold text-[#202B3C]">
                <AnimatedNumber value={report.unlockedCount} />{' '}
                <span className="text-sm font-normal text-[#718096]">/ {report.totalCount}</span>
              </p>
              <p className="text-xs text-[#718096]">Badges Earned</p>
            </div>
          </div>
        </div>
      </CursorSpotlightSection>

      {/* Badge Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {report.badges.map((badge, idx) => {
          const Icon = CATEGORY_ICON[badge.category];
          return (
            <MagneticTiltCard
              key={badge.id}
              index={idx}
              className={`flex flex-col justify-between rounded-2xl border p-5 ${
                badge.unlocked
                  ? 'border-[#C9DDFE] bg-white'
                  : 'border-[#E6EAF0] bg-white/95'
              }`}
            >
              <div className="relative z-10">
                <div className="flex items-start justify-between gap-3">
                  <MagneticParallaxLayer depth={6}>
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-200 group-hover/tilt:scale-105 ${
                        badge.unlocked
                          ? 'bg-[#EAF2FF] text-[#3978E8]'
                          : 'bg-[#F7F9FC] text-[#94A3B8]'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </MagneticParallaxLayer>
                  <StatusBadge
                    label={badge.unlocked ? 'Unlocked' : 'In Progress'}
                    tone={badge.unlocked ? 'success' : 'neutral'}
                    icon={badge.unlocked ? 'check' : 'lock'}
                  />
                </div>

                <h3 className="mt-3.5 text-base font-semibold text-[#202B3C]">{badge.title}</h3>
                <p className="mt-1 text-xs text-[#526075]">{badge.description}</p>

                <div className="mt-3.5 rounded-xl bg-[#F7F9FC] p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-medium">
                    <span className="text-[#718096]">Progress ({badge.category})</span>
                    <span className="font-mono font-semibold tabular-nums text-[#202B3C]">
                      {badge.current} / {badge.target}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E6EAF0]">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        badge.unlocked ? 'bg-emerald-500' : 'bg-[#3978E8]'
                      }`}
                      style={{ width: `${badge.progressPct}%` }}
                    />
                  </div>
                  <p className="pt-1 text-[11px] text-[#526075]">{badge.evidenceSummary}</p>
                </div>
              </div>

              <div className="relative z-10 mt-4 flex items-center justify-between gap-2 border-t border-[#E6EAF0] pt-3">
                <span className="inline-flex items-center gap-1 text-[11px] text-[#718096]">
                  {badge.unlocked ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Verified record</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5 text-[#94A3B8]" />
                      <span>{badge.criteria}</span>
                    </>
                  )}
                </span>

                {!badge.unlocked && (
                  <MagneticButton
                    strength={3}
                    onClick={() => setActiveView(badge.targetView)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#EAF2FF] px-2.5 py-1 text-[11px] font-medium text-[#285EC7] hover:bg-[#DCE9FF] shrink-0"
                  >
                    <span>Earn Now</span>
                    <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover/magbtn:translate-x-0.5" />
                  </MagneticButton>
                )}
              </div>
            </MagneticTiltCard>
          );
        })}
      </div>
    </div>
  );
};
