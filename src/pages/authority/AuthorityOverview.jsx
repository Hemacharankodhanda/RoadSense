import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  Wrench,
  CheckCircle2,
  TrendingUp,
  MapPin,
  ArrowRight,
  Shield,
  Layers,
  BarChart3
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import { subscribePotholes } from '../../lib/potholeService';
import { StatusBadge, SeverityBadge } from '../../components/common/Badges';
import AuthorityActionDrawer from '../../components/authority/AuthorityActionDrawer';

export default function AuthorityOverview() {
  const [potholes, setPotholes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPothole, setSelectedPothole] = useState(null);

  useEffect(() => {
    const unsub = subscribePotholes((data) => {
      setPotholes(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Compute Metrics
  const total = potholes.length;
  const pending = potholes.filter(p => p.status === 'reported' || p.status === 'verified').length;
  const critical = potholes.filter(p => p.severity === 'high' && p.status !== 'repaired' && p.status !== 'rejected').length;
  const inProgress = potholes.filter(p => p.status === 'in_progress').length;
  const repaired = potholes.filter(p => p.status === 'repaired').length;

  // Turnaround days calculation
  const avgTurnaroundDays = useMemo(() => {
    const completed = potholes.filter(p => p.status === 'repaired' && p.completion?.completedAt);
    if (!completed.length) return '1.8';
    const sumMs = completed.reduce((acc, cur) => {
      const start = new Date(cur.firstDetectedAt || cur.lastDetectedAt).getTime();
      const end = new Date(cur.completion.completedAt).getTime();
      return acc + Math.max(0, end - start);
    }, 0);
    return ((sumMs / completed.length) / (1000 * 60 * 60 * 24)).toFixed(1);
  }, [potholes]);

  // Chart 1: Status Breakdown
  const statusChartData = useMemo(() => {
    const counts = { reported: 0, verified: 0, in_progress: 0, repaired: 0, rejected: 0 };
    potholes.forEach(p => {
      const st = p.status || 'reported';
      if (counts[st] !== undefined) counts[st]++;
      else counts.reported++;
    });
    return [
      { name: 'Reported', value: counts.reported, color: '#ef4444' },
      { name: 'Verified', value: counts.verified, color: '#f97316' },
      { name: 'In Progress', value: counts.in_progress, color: '#f59e0b' },
      { name: 'Repaired', value: counts.repaired, color: '#10b981' },
      { name: 'Rejected', value: counts.rejected, color: '#64748b' },
    ].filter(item => item.value > 0);
  }, [potholes]);

  // Chart 2: Severity Distribution
  const severityChartData = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    potholes.forEach(p => {
      const sev = p.severity || 'low';
      if (counts[sev] !== undefined) counts[sev]++;
    });
    return [
      { severity: 'High (Critical)', count: counts.high, fill: '#dc2626' },
      { severity: 'Medium', count: counts.medium, fill: '#d97706' },
      { severity: 'Low', count: counts.low, fill: '#059669' },
    ];
  }, [potholes]);

  // Chart 3: Weekly Activity Trend (Simulated buckets or group by day of week)
  const weeklyTrendData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    // Group actual potholes by day of week
    const buckets = days.map(day => ({ day, detected: 0, repaired: 0 }));
    potholes.forEach(p => {
      if (p.firstDetectedAt) {
        const d = new Date(p.firstDetectedAt).getDay();
        const index = d === 0 ? 6 : d - 1;
        buckets[index].detected++;
      }
      if (p.status === 'repaired' && p.completion?.completedAt) {
        const d = new Date(p.completion.completedAt).getDay();
        const index = d === 0 ? 6 : d - 1;
        buckets[index].repaired++;
      }
    });
    return buckets;
  }, [potholes]);

  // Top Critical Potholes (requiring urgent triage)
  const urgentQueue = useMemo(() => {
    return potholes
      .filter(p => p.status !== 'repaired' && p.status !== 'rejected')
      .sort((a, b) => {
        const scoreA = (a.severity === 'high' ? 10 : a.severity === 'medium' ? 5 : 1) + (a.confirmationCount || 1) * 2;
        const scoreB = (b.severity === 'high' ? 10 : b.severity === 'medium' ? 5 : 1) + (b.confirmationCount || 1) * 2;
        return scoreB - scoreA;
      })
      .slice(0, 5);
  }, [potholes]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">
            Municipal Operational Overview
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time IoT telemetry and road maintenance dispatch metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/authority/queue"
            className="px-3.5 py-2 bg-civic-600 hover:bg-civic-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md transition-colors"
          >
            <span>Triage Active Queue</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Total Logged
          </div>
          <div className="text-2xl font-black text-white">{total}</div>
          <p className="text-[10px] text-slate-500 mt-1">IoT + Citizen feeds</p>
        </div>

        <div className="p-4 bg-slate-900 border border-red-950/80 rounded-2xl shadow-sm">
          <div className="text-[11px] font-semibold text-red-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Critical Hazards</span>
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
          </div>
          <div className="text-2xl font-black text-red-500">{critical}</div>
          <p className="text-[10px] text-slate-500 mt-1">High-impact craters</p>
        </div>

        <div className="p-4 bg-slate-900 border border-amber-950/80 rounded-2xl shadow-sm">
          <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Active Roadworks</span>
            <Wrench className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-400">{inProgress}</div>
          <p className="text-[10px] text-slate-500 mt-1">Dispatched to crews</p>
        </div>

        <div className="p-4 bg-slate-900 border border-emerald-950/80 rounded-2xl shadow-sm">
          <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Repaired Total</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{repaired}</div>
          <p className="text-[10px] text-slate-500 mt-1">Proof certified</p>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
          <div className="text-[11px] font-semibold text-civic-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Avg Resolution</span>
            <Clock className="w-3.5 h-3.5 text-civic-400" />
          </div>
          <div className="text-2xl font-black text-white">{avgTurnaroundDays} <span className="text-xs font-normal text-slate-400">days</span></div>
          <p className="text-[10px] text-slate-500 mt-1">City-wide turnaround</p>
        </div>
      </div>

      {/* Visual Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart 1: Status Breakdown */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm flex flex-col">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
            Potholes by Lifecycle Status
          </h3>
          <div className="h-60 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#ffffff' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  formatter={(value) => <span className="text-slate-300">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Severity Distribution */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm flex flex-col">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
            Impact Severity Breakdown
          </h3>
          <div className="h-60 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="severity" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#ffffff' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Weekly Telemetry & Repair Trends */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm flex flex-col">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
            Weekly Detection vs Repair Rate
          </h3>
          <div className="h-60 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#ffffff' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="detected" name="Detected" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="repaired" name="Repaired" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Urgent Potholes Table Preview */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              High Priority Attention Queue
            </h2>
          </div>
          <Link
            to="/authority/queue"
            className="text-xs text-civic-400 hover:text-civic-300 font-semibold flex items-center gap-1"
          >
            <span>View Full Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase font-semibold bg-slate-950/40">
                <th className="p-3.5">Address / ID</th>
                <th className="p-3.5">Severity</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Confirmations</th>
                <th className="p-3.5">Assigned Contractor</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {urgentQueue.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedPothole(item)}
                  className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <td className="p-3.5 max-w-xs">
                    <p className="font-bold text-white truncate">{item.address || 'Street Defect'}</p>
                    <p className="text-[10px] text-slate-500 font-mono">#{item.id?.slice(0, 8)}</p>
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    <SeverityBadge severity={item.severity} score={item.severityScore} showScore />
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    <StatusBadge status={item.status} size="xs" />
                  </td>
                  <td className="p-3.5 whitespace-nowrap font-mono text-slate-300">
                    {item.confirmationCount || 1} hits
                  </td>
                  <td className="p-3.5 whitespace-nowrap text-slate-400">
                    {item.assignedDepartment || <span className="text-slate-600 italic">Unassigned</span>}
                  </td>
                  <td className="p-3.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPothole(item);
                      }}
                      className="px-2.5 py-1 bg-civic-700 hover:bg-civic-600 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      Triage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Action Drawer */}
      {selectedPothole && (
        <AuthorityActionDrawer
          pothole={selectedPothole}
          onClose={() => setSelectedPothole(null)}
          onRefresh={() => setSelectedPothole(null)}
        />
      )}
    </div>
  );
}
