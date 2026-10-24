import React from 'react';
import { AlertCircle, Clock, Wrench, CheckCircle2, TrendingUp, BarChart2 } from 'lucide-react';

export default function PublicStatsCards({ potholes = [] }) {
  const total = potholes.length;
  const pending = potholes.filter(p => p.status === 'reported' || p.status === 'verified').length;
  const inProgress = potholes.filter(p => p.status === 'in_progress').length;
  const repaired = potholes.filter(p => p.status === 'repaired').length;

  // Calculate average repair turnaround time in hours or days
  let avgRepairHours = 0;
  const completedList = potholes.filter(p => p.status === 'repaired' && p.completion?.completedAt);
  if (completedList.length > 0) {
    const totalDurationMs = completedList.reduce((acc, curr) => {
      const start = new Date(curr.firstDetectedAt || curr.lastDetectedAt).getTime();
      const end = new Date(curr.completion.completedAt).getTime();
      return acc + Math.max(0, end - start);
    }, 0);
    avgRepairHours = Math.round((totalDurationMs / completedList.length) / (1000 * 60 * 60));
  }

  const formatTurnaround = () => {
    if (completedList.length === 0) return '36h (Avg SLA)';
    if (avgRepairHours < 24) return `${avgRepairHours}h`;
    const days = (avgRepairHours / 24).toFixed(1);
    return `${days} days`;
  };

  const statItems = [
    {
      label: 'Total Detected',
      value: total,
      sub: 'All IoT & citizen logs',
      icon: BarChart2,
      textColor: 'text-slate-900',
      iconBg: 'bg-slate-100 text-slate-700'
    },
    {
      label: 'Pending Triage',
      value: pending,
      sub: 'Awaiting repair crew',
      icon: AlertCircle,
      textColor: 'text-red-600',
      iconBg: 'bg-red-50 text-red-600 border border-red-100'
    },
    {
      label: 'Under Repair',
      value: inProgress,
      sub: 'Active roadworks',
      icon: Wrench,
      textColor: 'text-amber-600',
      iconBg: 'bg-amber-50 text-amber-600 border border-amber-100'
    },
    {
      label: 'Fixed & Repaired',
      value: repaired,
      sub: 'Verified patched',
      icon: CheckCircle2,
      textColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100'
    },
    {
      label: 'Avg Turnaround',
      value: formatTurnaround(),
      sub: 'From detection to fix',
      icon: Clock,
      textColor: 'text-civic-700',
      iconBg: 'bg-civic-50 text-civic-700 border border-civic-100'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {statItems.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between"
          >
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {item.label}
              </p>
              <p className={`text-xl font-bold mt-0.5 ${item.textColor}`}>
                {item.value}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">{item.sub}</p>
            </div>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.iconBg}`}>
              <Icon className="w-4 h-4" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
