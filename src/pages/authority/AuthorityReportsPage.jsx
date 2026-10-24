import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Calendar,
  CheckCircle2,
  DollarSign,
  AlertTriangle,
  Clock,
  Layers,
  FileText
} from 'lucide-react';
import { subscribePotholes } from '../../lib/potholeService';

export default function AuthorityReportsPage() {
  const [potholes, setPotholes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [includeArchived, setIncludeArchived] = useState(false);

  useEffect(() => {
    const unsub = subscribePotholes((data) => {
      setPotholes(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredData = useMemo(() => {
    return potholes.filter(p => {
      if (!includeArchived && p.isDeleted) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (severityFilter !== 'all' && p.severity !== severityFilter) return false;
      if (sourceFilter !== 'all' && p.source !== sourceFilter) return false;
      return true;
    });
  }, [potholes, statusFilter, severityFilter, sourceFilter, includeArchived]);

  // Summary Metrics
  const summary = useMemo(() => {
    const total = filteredData.length;
    const critical = filteredData.filter(p => p.severity === 'high').length;
    const repaired = filteredData.filter(p => p.status === 'repaired').length;
    const totalCost = filteredData.reduce((acc, p) => acc + (Number(p.completion?.cost) || 0), 0);
    return { total, critical, repaired, totalCost };
  }, [filteredData]);

  // CSV Export Generator
  const handleExportCsv = () => {
    if (!filteredData.length) {
      alert('No data records available to export.');
      return;
    }

    const headers = [
      'Pothole ID',
      'Latitude',
      'Longitude',
      'Geocoded Address',
      'Severity',
      'MPU6050 Magnitude (G)',
      'Status',
      'Source Channel',
      'Confirmations',
      'Contributing Device IDs',
      'First Detected',
      'Last Detected',
      'Assigned Department',
      'Expected Completion',
      'Repaired Date',
      'Certifying Officer',
      'Repair Cost ($)',
      'Remarks',
      'Soft Deleted'
    ];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = filteredData.map(p => [
      escapeCsv(p.id),
      p.location?.lat || '',
      p.location?.lng || '',
      escapeCsv(p.address || ''),
      escapeCsv(p.severity || ''),
      p.severityScore || '',
      escapeCsv(p.status || ''),
      escapeCsv(p.source || ''),
      p.confirmationCount || 1,
      escapeCsv((p.deviceIds || []).join('; ')),
      escapeCsv(p.firstDetectedAt || ''),
      escapeCsv(p.lastDetectedAt || ''),
      escapeCsv(p.assignedDepartment || ''),
      escapeCsv(p.expectedCompletionDate || ''),
      escapeCsv(p.completion?.completedAt || ''),
      escapeCsv(p.completion?.completedBy?.name || ''),
      p.completion?.cost || 0,
      escapeCsv(p.completion?.remarks || p.description || ''),
      p.isDeleted ? 'YES' : 'NO'
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `roadsense-municipal-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-civic-400" />
            <span>Reports, Audit & CSV Export</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Generate formal municipal road quality reports and audit logs for council review.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all hover:scale-102"
        >
          <Download className="w-4 h-4" />
          <span>Export {filteredData.length} Records to CSV</span>
        </button>
      </div>

      {/* Filter Parameters Card */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-civic-400" />
          <span>Report Filter Parameters</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Status Filter</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-civic-500"
            >
              <option value="all">All Statuses</option>
              <option value="reported">Reported</option>
              <option value="verified">Verified</option>
              <option value="in_progress">In Progress</option>
              <option value="repaired">Repaired</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Severity Impact</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-civic-500"
            >
              <option value="all">All Severities</option>
              <option value="high">Critical (High Impact)</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Source Ingestion Channel</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-civic-500"
            >
              <option value="all">All Sources</option>
              <option value="device">IoT Accelerometer Nodes (ESP32)</option>
              <option value="citizen">Citizen Field Reports</option>
            </select>
          </div>

          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                className="w-4 h-4 rounded-sm accent-civic-600 cursor-pointer"
              />
              <span className="text-xs">Include Soft-Deleted Records</span>
            </label>
          </div>
        </div>
      </div>

      {/* Summary KPI Highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <span className="text-[11px] text-slate-400 uppercase font-semibold">Matching Inquiries</span>
          <p className="text-2xl font-black text-white mt-1">{summary.total}</p>
          <span className="text-[10px] text-slate-500">Defects filtered</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <span className="text-[11px] text-rose-400 uppercase font-semibold">Critical Impact Craters</span>
          <p className="text-2xl font-black text-rose-400 mt-1">{summary.critical}</p>
          <span className="text-[10px] text-slate-500">High severity</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <span className="text-[11px] text-emerald-400 uppercase font-semibold">Total Repaired</span>
          <p className="text-2xl font-black text-emerald-400 mt-1">{summary.repaired}</p>
          <span className="text-[10px] text-slate-500">Certified closed</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <span className="text-[11px] text-civic-300 uppercase font-semibold">Documented Expenditure</span>
          <p className="text-2xl font-black text-white mt-1">${summary.totalCost.toLocaleString()}</p>
          <span className="text-[10px] text-slate-500">Total cost claimed</span>
        </div>
      </div>

      {/* Preview Table of Records to be exported */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Report Dataset Preview (First 15 Entries)
          </span>
          <span className="text-xs font-mono text-slate-500">
            {filteredData.length} total rows ready
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase font-semibold bg-slate-950/60">
                <th className="p-3">Pothole ID</th>
                <th className="p-3">Address</th>
                <th className="p-3">Severity</th>
                <th className="p-3">Status</th>
                <th className="p-3">Source</th>
                <th className="p-3">First Detected</th>
                <th className="p-3">Cost ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredData.slice(0, 15).map(item => (
                <tr key={item.id} className="hover:bg-slate-800/30">
                  <td className="p-3 font-mono text-[11px] text-slate-400">#{item.id?.slice(0, 8)}</td>
                  <td className="p-3 max-w-xs truncate text-white">{item.address || 'Street defect'}</td>
                  <td className="p-3 font-bold uppercase text-[10px]">{item.severity}</td>
                  <td className="p-3 capitalize">{item.status?.replace('_', ' ')}</td>
                  <td className="p-3 capitalize">{item.source}</td>
                  <td className="p-3 text-slate-400">{item.firstDetectedAt ? new Date(item.firstDetectedAt).toLocaleDateString() : 'N/A'}</td>
                  <td className="p-3 font-mono text-emerald-400">${item.completion?.cost || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
