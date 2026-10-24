import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  Filter,
  AlertTriangle,
  Layers,
  Calendar,
  Building,
  CheckCircle,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Flame,
  Clock,
  Eye
} from 'lucide-react';
import { subscribePotholes } from '../../lib/potholeService';
import { StatusBadge, SeverityBadge } from '../../components/common/Badges';
import AuthorityActionDrawer from '../../components/authority/AuthorityActionDrawer';

// Priority Score Calculator: higher severity + more confirmations + older = higher priority
function computePriority(pothole) {
  let severityScore = 5;
  if (pothole.severity === 'high') severityScore = 35;
  else if (pothole.severity === 'medium') severityScore = 20;

  const confirmations = (pothole.confirmationCount || 1) * 5;

  const now = new Date().getTime();
  const detected = new Date(pothole.firstDetectedAt || pothole.lastDetectedAt || now).getTime();
  const ageDays = Math.max(0, (now - detected) / (1000 * 60 * 60 * 24));
  const ageScore = Math.min(30, Math.round(ageDays * 3));

  const total = severityScore + confirmations + ageScore;

  let tier = 'LOW';
  let badgeColor = 'bg-blue-950/60 text-blue-400 border-blue-800';
  if (total >= 45) {
    tier = 'CRITICAL';
    badgeColor = 'bg-red-950/80 text-red-400 border-red-800 animate-pulse';
  } else if (total >= 30) {
    tier = 'HIGH';
    badgeColor = 'bg-orange-950/70 text-orange-400 border-orange-800';
  } else if (total >= 20) {
    tier = 'MEDIUM';
    badgeColor = 'bg-amber-950/60 text-amber-400 border-amber-800';
  }

  return { total, tier, badgeColor, ageDays: Math.round(ageDays) };
}

export default function AuthorityQueuePage() {
  const [potholes, setPotholes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPothole, setSelectedPothole] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // Sorting
  const [sortField, setSortField] = useState('priority'); // 'priority', 'severity', 'age', 'confirmations'
  const [sortOrder, setSortOrder] = useState('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    const unsub = subscribePotholes((data) => {
      setPotholes(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Compute enriched list with priority metadata
  const enrichedPotholes = useMemo(() => {
    return potholes.map(p => ({
      ...p,
      priorityMeta: computePriority(p)
    }));
  }, [potholes]);

  // Extract unique departments for filter
  const departments = useMemo(() => {
    const set = new Set();
    potholes.forEach(p => {
      if (p.assignedDepartment) set.add(p.assignedDepartment);
    });
    return Array.from(set);
  }, [potholes]);

  // Filter & Sort
  const processedData = useMemo(() => {
    return enrichedPotholes.filter(item => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (severityFilter !== 'all' && item.severity !== severityFilter) return false;
      if (departmentFilter === 'unassigned' && item.assignedDepartment) return false;
      if (departmentFilter !== 'all' && departmentFilter !== 'unassigned' && item.assignedDepartment !== departmentFilter) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const addr = (item.address || '').toLowerCase();
        const id = (item.id || '').toLowerCase();
        const dept = (item.assignedDepartment || '').toLowerCase();
        return addr.includes(query) || id.includes(query) || dept.includes(query);
      }
      return true;
    }).sort((a, b) => {
      let valA, valB;
      if (sortField === 'priority') {
        valA = a.priorityMeta.total;
        valB = b.priorityMeta.total;
      } else if (sortField === 'severity') {
        const map = { high: 3, medium: 2, low: 1 };
        valA = map[a.severity] || 0;
        valB = map[b.severity] || 0;
      } else if (sortField === 'confirmations') {
        valA = a.confirmationCount || 1;
        valB = b.confirmationCount || 1;
      } else if (sortField === 'age') {
        valA = a.priorityMeta.ageDays;
        valB = b.priorityMeta.ageDays;
      } else {
        valA = new Date(a.firstDetectedAt || 0).getTime();
        valB = new Date(b.firstDetectedAt || 0).getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [enrichedPotholes, statusFilter, severityFilter, departmentFilter, searchTerm, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(processedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, currentPage, pageSize]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">
            Pothole Queue & Smart Triage
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Ranked municipal defect queue ordered by severity impact, sensor confirmations, and age.
          </p>
        </div>
      </div>

      {/* Control / Filter Bar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search address, defect ID, contractor..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-civic-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-800 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-civic-500"
          >
            <option value="all">All Statuses</option>
            <option value="reported">Reported</option>
            <option value="verified">Verified</option>
            <option value="in_progress">Under Repair</option>
            <option value="repaired">Repaired</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-800 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-civic-500"
          >
            <option value="all">All Severities</option>
            <option value="high">Critical High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={departmentFilter}
            onChange={(e) => {
              setDepartmentFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-800 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-civic-500"
          >
            <option value="all">All Departments</option>
            <option value="unassigned">Unassigned Only</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase font-semibold bg-slate-950/60">
                <th
                  onClick={() => toggleSort('priority')}
                  className="p-3.5 cursor-pointer hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Priority Rank</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="p-3.5">Address & Defect ID</th>
                <th
                  onClick={() => toggleSort('severity')}
                  className="p-3.5 cursor-pointer hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Severity</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="p-3.5">Status</th>
                <th
                  onClick={() => toggleSort('confirmations')}
                  className="p-3.5 cursor-pointer hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Confirmations</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('age')}
                  className="p-3.5 cursor-pointer hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Age / Days</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="p-3.5">Assigned Contractor</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                    No defects match your filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedPothole(item)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="p-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${item.priorityMeta.badgeColor}`}>
                        <Flame className="w-3 h-3" />
                        <span>{item.priorityMeta.tier}</span>
                        <span className="opacity-75">({item.priorityMeta.total} pts)</span>
                      </span>
                    </td>
                    <td className="p-3.5 max-w-xs">
                      <p className="font-bold text-white truncate">{item.address || 'Street defect'}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">#{item.id?.slice(0, 8)}</p>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <SeverityBadge severity={item.severity} score={item.severityScore} showScore />
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <StatusBadge status={item.status} size="xs" />
                    </td>
                    <td className="p-3.5 whitespace-nowrap font-mono text-slate-300">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-civic-400" />
                        <span>{item.confirmationCount || 1} hits</span>
                      </span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap text-slate-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{item.priorityMeta.ageDays}d old</span>
                      </span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap text-slate-400">
                      {item.assignedDepartment ? (
                        <span className="text-civic-300 font-medium">{item.assignedDepartment}</span>
                      ) : (
                        <span className="text-slate-600 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPothole(item);
                        }}
                        className="px-3 py-1 bg-civic-600 hover:bg-civic-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ml-auto"
                      >
                        <Wrench className="w-3 h-3" />
                        <span>Triage</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <strong className="text-slate-200">{processedData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to <strong className="text-slate-200">{Math.min(currentPage * pageSize, processedData.length)}</strong> of <strong className="text-slate-200">{processedData.length}</strong> items
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-1 rounded-lg border border-slate-700 disabled:opacity-40 hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium text-slate-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="p-1 rounded-lg border border-slate-700 disabled:opacity-40 hover:bg-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
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
