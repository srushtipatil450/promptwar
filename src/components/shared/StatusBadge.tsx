import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lock,
  ShieldAlert,
  Wrench,
  XCircle,
} from 'lucide-react';

type BadgeTone = 'success' | 'warning' | 'error' | 'info' | 'lavender' | 'neutral';

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  warning: 'bg-amber-50 text-amber-800 border-amber-200/80',
  error: 'bg-rose-50 text-rose-700 border-rose-200/80',
  info: 'bg-[#EAF2FF] text-[#285EC7] border-[#C9DDFE]',
  lavender: 'bg-[#EEEAFE] text-[#5B47C7] border-[#D9D1FC]',
  neutral: 'bg-slate-50 text-[#526075] border-[#E6EAF0]',
};

export const StatusBadge: React.FC<{
  label: string;
  tone?: BadgeTone;
  icon?: 'check' | 'clock' | 'warn' | 'error' | 'wrench' | 'lock' | 'shield' | 'none';
}> = ({ label, tone = 'neutral', icon = 'none' }) => {
  const IconComp =
    icon === 'check'
      ? CheckCircle2
      : icon === 'clock'
        ? Clock
        : icon === 'warn'
          ? AlertTriangle
          : icon === 'error'
            ? XCircle
            : icon === 'wrench'
              ? Wrench
              : icon === 'lock'
                ? Lock
                : icon === 'shield'
                  ? ShieldAlert
                  : null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${TONE_CLASSES[tone]}`}
    >
      {IconComp && <IconComp className="h-3.5 w-3.5 shrink-0" />}
      <span>{label}</span>
    </span>
  );
};

export function unitStatusTone(status: string): BadgeTone {
  switch (status) {
    case 'available':
      return 'success';
    case 'booked':
      return 'info';
    case 'checked_out':
      return 'lavender';
    case 'maintenance':
      return 'warning';
    case 'faulty':
      return 'error';
    default:
      return 'neutral';
  }
}

export function unitStatusLabel(status: string): string {
  switch (status) {
    case 'available':
      return 'Available';
    case 'booked':
      return 'Booked';
    case 'checked_out':
      return 'Checked Out';
    case 'maintenance':
      return 'Maintenance';
    case 'faulty':
      return 'Faulty / Locked';
    default:
      return status;
  }
}
