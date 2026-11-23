import React from 'react';
import { ArrowRight, Bell, CheckCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLabLink } from '../context/LabLinkContext';
import { StatusBadge } from '../components/shared/StatusBadge';

export const NotificationsView: React.FC = () => {
  const {
    db,
    currentUser,
    markNotificationRead,
    markAllNotificationsRead,
    setActiveView,
  } = useLabLink();

  const visible = db.notifications.filter(
    (n) =>
      n.recipientUserId === currentUser.id ||
      n.recipientUserId === 'all' ||
      currentUser.role === 'system_admin'
  );

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between rounded-2xl border border-[#E6EAF0] bg-white p-5">
        <div className="flex items-center gap-2.5">
          <Bell className="h-4 w-4 text-[#3978E8]" />
          <div>
            <h2 className="text-base font-semibold text-[#202B3C]">
              Ecosystem Notifications ({visible.length})
            </h2>
            <p className="text-xs text-[#718096]">
              Real-time alerts for bookings, waiting-list offers, maintenance lockouts, and safety
              sign-offs
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={markAllNotificationsRead}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6EAF0] bg-white px-3.5 py-2 text-xs font-medium text-[#202B3C] hover:bg-[#F7F9FC]"
        >
          <CheckCheck className="h-3.5 w-3.5 text-[#3978E8]" />
          <span>Mark All Read</span>
        </button>
      </section>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-[#E6EAF0] bg-white p-12 text-center text-xs text-[#718096]">
          No notifications for {currentUser.name}.
        </div>
      ) : (
        <section className="space-y-2.5">
          <AnimatePresence>
            {visible.map((n, idx) => (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.2) }}
                className={`flex flex-col justify-between gap-3 rounded-2xl border p-4 transition-colors sm:flex-row sm:items-center ${
                  n.read
                    ? 'border-[#E6EAF0] bg-white'
                    : 'border-[#C9DDFE] bg-[#EAF2FF]/60'
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={n.category.replace('_', ' ').toUpperCase()}
                      tone={
                        n.category === 'maintenance'
                          ? 'warning'
                          : n.category === 'safety'
                            ? 'error'
                            : n.category === 'waiting_list'
                              ? 'lavender'
                              : 'info'
                      }
                    />
                    <h3 className="text-sm font-semibold text-[#202B3C]">{n.title}</h3>
                    {!n.read && (
                      <motion.span
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="rounded-md bg-[#3978E8] px-1.5 py-0.5 text-[10px] font-semibold text-white"
                      >
                        Unread
                      </motion.span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#526075]">{n.message}</p>
                  <p className="mt-1 font-mono text-[10px] text-[#718096]">
                    {n.createdAt.slice(0, 16).replace('T', ' ')}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => markNotificationRead(n.id)}
                      className="rounded-xl border border-[#E6EAF0] bg-white px-3 py-1.5 text-xs font-medium text-[#202B3C] hover:bg-[#F7F9FC]"
                    >
                      Mark Read
                    </button>
                  )}
                  {n.targetView && (
                    <button
                      type="button"
                      onClick={() => {
                        markNotificationRead(n.id);
                        setActiveView(n.targetView!);
                      }}
                      className="inline-flex items-center gap-1 rounded-xl bg-[#3978E8] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2E67CE]"
                    >
                      <span>Open</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
};
