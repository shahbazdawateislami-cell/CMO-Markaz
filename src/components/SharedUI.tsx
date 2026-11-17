import React from 'react';
import { Camera, Inbox } from 'lucide-react';
import { formatCounter } from '../types';

export function CounterStat({
  label,
  value,
  subtext,
}: {
  label: string;
  value: number | string;
  subtext?: string;
}) {
  const display = typeof value === 'number' ? formatCounter(value) : value;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="text-xs font-medium text-slate-500 truncate">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 font-mono tabular-nums">
        {display}
      </div>
      {subtext && <div className="mt-1 text-xs text-slate-500 truncate">{subtext}</div>}
    </div>
  );
}

export function StatusTag({
  status,
  tone,
}: {
  status: string;
  tone?: 'emerald' | 'amber' | 'red' | 'sky' | 'slate';
}) {
  const s = status.toLowerCase();
  const resolvedTone =
    tone ||
    (s.includes('approv') || s === 'active' || s === 'present' || s === 'paid' || s === 'completed' || s === 'posted' || s === 'published'
      ? 'emerald'
      : s.includes('pending') || s === 'late' || s === 'probation' || s === 'teacher_verified' || s === 'hr_verified' || s === 'draft' || s === 'onboarding'
        ? 'amber'
        : s.includes('reject') || s === 'absent' || s === 'cancelled' || s === 'refunded' || s === 'suspended' || s === 'terminated'
          ? 'red'
          : s === 'leave' || s === 'sick' || s === 'half day' || s === 'processed'
            ? 'sky'
            : 'slate');

  const cls = {
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    red: 'bg-red-50 text-red-800 border-red-200',
    sky: 'bg-sky-50 text-sky-800 border-sky-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  }[resolvedTone];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-md whitespace-nowrap shrink-0 ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function AvatarFrame({
  photoUrl,
  alt,
  size = 'md',
  onUpload,
  uploading = false,
}: {
  photoUrl?: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  onUpload?: (file: File) => void;
  uploading?: boolean;
}) {
  const dims =
    size === 'sm' ? 'w-10 h-10' : size === 'lg' ? 'w-20 h-20' : 'w-14 h-14';

  return (
    <div className="inline-flex items-center gap-3">
      <div
        className={`${dims} rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0`}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={alt}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-[10px] font-medium text-slate-400 text-center px-1 leading-tight select-none">
            Empty
          </span>
        )}
      </div>
      {onUpload && (
        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0">
          <Camera className="w-3.5 h-3.5 text-slate-500" />
          {uploading ? 'Uploading...' : photoUrl ? 'Replace Photo' : 'Upload Photo'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = '';
            }}
          />
        </label>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
      <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
        <Inbox className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 inline-flex items-center px-4 py-2 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors whitespace-nowrap"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}
