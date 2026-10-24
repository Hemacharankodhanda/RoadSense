import React from 'react';
import { AlertCircle, Clock, CheckCircle2, XCircle, Wrench, ShieldCheck } from 'lucide-react';

export function StatusBadge({ status, size = 'sm' }) {
  const normalized = (status || 'reported').toLowerCase();
  
  const config = {
    reported: {
      label: 'Reported / Pending',
      bg: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50',
      dot: 'bg-red-500',
      icon: AlertCircle
    },
    verified: {
      label: 'Verified',
      bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50',
      dot: 'bg-blue-500',
      icon: ShieldCheck
    },
    in_progress: {
      label: 'In Progress',
      bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50',
      dot: 'bg-amber-500',
      icon: Wrench
    },
    repaired: {
      label: 'Repaired',
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50',
      dot: 'bg-emerald-500',
      icon: CheckCircle2
    },
    rejected: {
      label: 'Rejected',
      bg: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
      dot: 'bg-slate-400',
      icon: XCircle
    }
  };

  const item = config[normalized] || config.reported;
  const Icon = item.icon;

  const sizeClasses = size === 'xs' 
    ? 'text-[11px] px-2 py-0.5 gap-1' 
    : size === 'lg' 
      ? 'text-sm px-3.5 py-1.5 gap-2' 
      : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${item.bg} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${item.dot} shrink-0`} />
      <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" />
      <span>{item.label}</span>
    </span>
  );
}

export function SeverityBadge({ severity, score, showScore = false, size = 'sm' }) {
  const norm = (severity || 'low').toLowerCase();

  const config = {
    high: {
      label: 'High Severity',
      bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50',
      indicator: 'bg-rose-600',
      desc: 'Critical wheel hazard'
    },
    medium: {
      label: 'Medium Severity',
      bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50',
      indicator: 'bg-amber-500',
      desc: 'Moderate road bump'
    },
    low: {
      label: 'Low Severity',
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50',
      indicator: 'bg-emerald-500',
      desc: 'Surface deterioration'
    }
  };

  const item = config[norm] || config.low;
  const sizeClasses = size === 'xs' 
    ? 'text-[11px] px-2 py-0.5 gap-1' 
    : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span className={`inline-flex items-center font-semibold rounded-md border ${item.bg} ${sizeClasses}`}>
      <span className={`w-2 h-2 rounded-full ${item.indicator}`} />
      <span>{item.label}</span>
      {showScore && score !== undefined && (
        <span className="opacity-75 font-mono text-[10px] ml-0.5">
          ({Number(score).toFixed(2)}G)
        </span>
      )}
    </span>
  );
}
