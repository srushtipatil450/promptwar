import React, { useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  Award,
  BadgeCheck,
  Bell,
  Box,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Compass,
  Cpu,
  GitBranch,
  Hourglass,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Menu,
  Plus,
  QrCode,
  Radio,
  Scale,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useLabLink } from '../../context/LabLinkContext';
import { NavViewId } from '../../types/lablink';
import { BookingModal } from '../shared/BookingModal';
import { MagneticButton } from '../shared/MotionPrimitives';

interface NavItem {
  id: NavViewId;
  label: string;
  section: 'Main' | 'Resource Management' | 'Laboratory Management' | 'System';
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  // Main
  { id: 'overview', label: 'Overview', section: 'Main', icon: LayoutDashboard },
  { id: 'live-pulse', label: 'Live Lab Pulse', section: 'Main', icon: Radio },
  { id: 'project-matcher', label: 'Project Matcher', section: 'Main', icon: Sparkles },
  { id: 'journey-planner', label: 'Project Journey', section: 'Main', icon: Compass },
  { id: 'equipment-explorer', label: 'Equipment Explorer', section: 'Main', icon: Cpu },
  { id: 'digital-twin', label: 'Digital Lab Twin', section: 'Main', icon: Box },
  { id: 'alternative-finder', label: 'Alternative Finder', section: 'Main', icon: ArrowLeftRight },
  { id: 'resource-rescue', label: 'Resource Rescue', section: 'Main', icon: LifeBuoy },
  { id: 'lab-map', label: 'Lab Map', section: 'Main', icon: MapPin },
  { id: 'compatibility-graph', label: 'Compatibility Graph', section: 'Main', icon: GitBranch },
  { id: 'feasibility-checker', label: 'Feasibility Checker', section: 'Main', icon: Compass },

  // Resource Management
  { id: 'my-bookings', label: 'My Bookings', section: 'Resource Management', icon: CalendarCheck },
  { id: 'smart-scheduling', label: 'Smart Scheduling', section: 'Resource Management', icon: CalendarClock },
  { id: 'cross-dept-sharing', label: 'Cross-Dept Sharing', section: 'Resource Management', icon: ArrowLeftRight },
  { id: 'waiting-list', label: 'Waiting List', section: 'Resource Management', icon: Hourglass },
  { id: 'predictive-availability', label: 'Predictive Availability', section: 'Resource Management', icon: TrendingUp },
  { id: 'idle-resources', label: 'Idle Resources', section: 'Resource Management', icon: Activity },

  // Laboratory Management
  { id: 'equipment-tracking', label: 'Equipment Tracking', section: 'Laboratory Management', icon: QrCode },
  { id: 'equipment-health', label: 'Equipment Health', section: 'Laboratory Management', icon: Wrench },
  { id: 'lab-passport', label: 'Lab Passport', section: 'Laboratory Management', icon: BadgeCheck },
  { id: 'safety-readiness', label: 'Safety Readiness', section: 'Laboratory Management', icon: ShieldAlert },
  { id: 'fair-access', label: 'Fair Access', section: 'Laboratory Management', icon: Scale },
  { id: 'achievements', label: 'Achievements', section: 'Laboratory Management', icon: Award },

  // System
  { id: 'notifications', label: 'Notifications', section: 'System', icon: Bell },
  { id: 'settings', label: 'Settings', section: 'System', icon: Settings },
];

const SECTIONS: NavItem['section'][] = [
  'Main',
  'Resource Management',
  'Laboratory Management',
  'System',
];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    db,
    currentUser,
    activeView,
    setActiveView,
    globalSearch,
    setGlobalSearch,
    openBookingModal,
    switchUser,
    unreadNotificationCount,
    toasts,
    dismissToast,
  } = useLabLink();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeNav = NAV_ITEMS.find((n) => n.id === activeView) ?? NAV_ITEMS[0];
  const dept = db.departments.find((d) => d.id === currentUser.departmentId);

  const handleSelectNav = (id: NavViewId) => {
    setActiveView(id);
    setMobileMenuOpen(false);
  };

  const renderNavLinks = () => (
    <div className="space-y-5 px-3 py-4">
      {SECTIONS.map((section) => (
        <div key={section}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-[#718096]">
            {section}
          </p>
          <div className="space-y-0.5">
            {NAV_ITEMS.filter((item) => item.section === section).map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeView;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectNav(item.id)}
                  className={`group/nav flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#EAF2FF] text-[#3978E8]'
                      : 'text-[#526075] hover:bg-[#F7F9FC] hover:text-[#202B3C]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-transform duration-150 group-hover/nav:translate-x-0.5 ${
                        isActive ? 'text-[#3978E8] scale-105' : 'text-[#718096] group-hover/nav:text-[#3978E8]'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.id === 'notifications' && unreadNotificationCount > 0 && (
                    <span className="ml-2 rounded-md bg-[#3978E8] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
                      {unreadNotificationCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#F7F9FC] text-[#202B3C]">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[#E6EAF0] bg-white lg:flex">
        <div className="flex h-16 items-center justify-between border-b border-[#E6EAF0] px-5">
          <button
            type="button"
            onClick={() => handleSelectNav('overview')}
            className="group/brand flex items-center gap-2.5 text-left"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3978E8] text-white font-bold text-sm transition-transform duration-200 group-hover/brand:scale-105 group-hover/brand:shadow-sm">
              L
            </div>
            <div>
              <span className="block text-base font-bold tracking-tight text-[#202B3C] transition-colors group-hover/brand:text-[#3978E8]">
                LabLink
              </span>
              <span className="block text-[11px] text-[#718096]">Campus Lab Ecosystem</span>
            </div>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto" aria-label="Primary Navigation">
          {renderNavLinks()}
        </nav>

        {/* Active Account Switcher Summary */}
        <div className="border-t border-[#E6EAF0] p-3.5">
          <div className="group/profile rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-3 transition-colors hover:border-[#C9DDFE]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent bg-[#EEEAFE] text-xs font-semibold text-[#5B47C7] transition-all duration-200 group-hover/profile:scale-105 group-hover/profile:border-[#C9DDFE]">
                {currentUser.avatarInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[#202B3C]">{currentUser.name}</p>
                <p className="truncate text-[11px] text-[#718096]">
                  {currentUser.role.replace('_', ' ')} · {dept?.code}
                </p>
              </div>
            </div>
            <label className="mt-2.5 block text-[11px] font-medium text-[#718096]">
              Switch Demo Session
            </label>
            <select
              value={currentUser.id}
              onChange={(e) => switchUser(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E6EAF0] bg-white px-2 py-1.5 text-xs text-[#202B3C] focus:border-[#3978E8] focus:outline-none"
            >
              {db.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 flex w-72 flex-col bg-white border-r border-[#E6EAF0]">
            <div className="flex h-16 items-center justify-between border-b border-[#E6EAF0] px-5">
              <span className="text-base font-bold text-[#202B3C]">LabLink</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-[#718096] hover:bg-[#F7F9FC]"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto">{renderNavLinks()}</nav>
            <div className="border-t border-[#E6EAF0] p-3.5">
              <select
                value={currentUser.id}
                onChange={(e) => switchUser(e.target.value)}
                className="w-full rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-2 text-xs text-[#202B3C]"
              >
                {db.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-[#E6EAF0] bg-white/95 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg border border-[#E6EAF0] p-2 text-[#526075] hover:bg-[#F7F9FC] lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[#718096] truncate">
                LabLink / {activeNav.section} / {activeNav.label}
              </p>
              <h1 className="text-base font-semibold text-[#202B3C] truncate sm:text-lg">
                {activeNav.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="group/search relative hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#718096] transition-transform duration-150 group-hover/search:scale-110 group-focus-within/search:scale-110 group-focus-within/search:-rotate-6 group-focus-within/search:text-[#3978E8]" />
              <input
                type="search"
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  if (activeView !== 'equipment-explorer' && e.target.value.trim().length > 1) {
                    setActiveView('equipment-explorer');
                  }
                }}
                placeholder="Search equipment or unit..."
                className="w-56 rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] py-1.5 pl-8 pr-3 text-xs text-[#202B3C] placeholder:text-[#718096] transition-all focus:w-64 focus:border-[#3978E8] focus:bg-white focus:outline-none"
              />
            </div>

            <motion.button
              type="button"
              onClick={() => setActiveView('notifications')}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              className="group/bell relative rounded-xl border border-[#E6EAF0] bg-white p-2 text-[#526075] transition-colors hover:border-[#C9DDFE] hover:bg-[#F7F9FC] hover:text-[#3978E8]"
              aria-label="Notifications"
            >
              <motion.span
                className="inline-flex origin-top"
                whileHover={{ rotate: [0, -12, 12, -6, 0] }}
                transition={{ duration: 0.4 }}
              >
                <Bell className="h-4 w-4" />
              </motion.span>
              <AnimatePresence>
                {unreadNotificationCount > 0 && (
                  <motion.span
                    key={unreadNotificationCount}
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#3978E8] px-1 text-[10px] font-semibold tabular-nums text-white"
                  >
                    {unreadNotificationCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            <MagneticButton
              onClick={() => openBookingModal({ equipmentId: db.equipment[0]?.id ?? 'eq-oscilloscope' })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#3978E8] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#2E67CE] whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5 transition-transform duration-200 group-hover/magbtn:rotate-90" />
              <span>Book Equipment</span>
            </MagneticButton>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1320px] flex-1 p-4 sm:p-6">{children}</main>
      </div>

      {/* Global Booking Modal */}
      <BookingModal />

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs shadow-lg ${
                t.ok
                  ? 'border-emerald-200 bg-white text-[#202B3C]'
                  : 'border-rose-200 bg-rose-50 text-rose-900'
              }`}
            >
              {t.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              )}
              <p className="flex-1 leading-relaxed">{t.text}</p>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="text-[#718096] hover:text-[#202B3C]"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      </div>
    </MotionConfig>
  );
};
