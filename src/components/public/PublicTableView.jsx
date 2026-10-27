import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Eye,
  Calendar,
  Layers,
  Cpu,
  User
} from 'lucide-react';
import { StatusBadge, SeverityBadge } from '../common/Badges';

export default function PublicTableView({
  potholes = [],
  onSelectPothole = () => {}
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [sortField, setSortField] = useState('lastDetectedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filter and sort pipeline
  const filteredData = useMemo(() => {
    return potholes.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (severityFilter !== 'all' && item.severity !== severityFilter) return false;
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const address = (item.address || '').toLowerCase();
        const id = (item.id || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        return address.includes(query) || id.includes(query) || desc.includes(query);
      }
      return true;
    }).sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'severity') {
        const order = { high: 3, medium: 2, low: 1 };
        valA = order[a.severity] || 0;
        valB = order[b.severity] || 0;
      } else if (sortField === 'depth_cm') {
        valA = typeof a.depth_cm === 'number' && !isNaN(a.depth_cm) ? a.depth_cm : -1;
        valB = typeof b.depth_cm === 'number' && !isNaN(b.depth_cm) ? b.depth_cm : -1;
      } else if (sortField === 'firstDetectedAt' || sortField === 'lastDetectedAt') {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [potholes, statusFilter, severityFilter, searchTerm, sortField, sortOrder]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return 'N/A';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return isoStr;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
      {/* Top Controls Bar */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-50/50">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search address, ID, description..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-civic-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-civic-500"
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
            className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-civic-500"
          >
            <option value="all">All Severities</option>
            <option value="high">Critical / High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Table Element */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <th className="p-3.5">Defect / Location</th>
              <th
                onClick={() => toggleSort('severity')}
                className="p-3.5 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Severity</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('depth_cm')}
                className="p-3.5 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Depth (cm)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5">Source</th>
              <th
                onClick={() => toggleSort('confirmationCount')}
                className="p-3.5 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Confirmations</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('lastDetectedAt')}
                className="p-3.5 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Detected</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="p-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                  No potholes found matching your criteria.
                </td>
              </tr>
            ) : (
              paginatedData.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onSelectPothole(item)}
                  className="hover:bg-civic-50/40 cursor-pointer transition-colors"
                >
                  <td className="p-3.5 max-w-xs">
                    <div className="font-bold text-slate-900 truncate">
                      {item.address || 'Street defect location'}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-civic-500 shrink-0" />
                      <span>{item.location?.lat?.toFixed(4)}, {item.location?.lng?.toFixed(4)}</span>
                      <span className="text-slate-300">•</span>
                      <span>#{item.id?.slice(0, 6)}</span>
                    </div>
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    <SeverityBadge severity={item.severity} score={item.severityScore} showScore />
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    {typeof item.depth_cm === 'number' && !isNaN(item.depth_cm) ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                        <span>{Number(item.depth_cm).toFixed(1)} cm</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          item.depth_cm >= 7
                            ? 'bg-rose-100 text-rose-700'
                            : item.depth_cm >= 3
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {item.depth_cm >= 7 ? 'Deep' : item.depth_cm >= 3 ? 'Moderate' : 'Shallow'}
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-400 font-mono">n/a</span>
                    )}
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    <StatusBadge status={item.status} size="xs" />
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                      {item.source === 'device' ? (
                        <>
                          <Cpu className="w-3 h-3 text-civic-600" />
                          <span>IoT Node</span>
                        </>
                      ) : (
                        <>
                          <User className="w-3 h-3 text-slate-600" />
                          <span>Citizen</span>
                        </>
                      )}
                    </span>
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                      <Layers className="w-3 h-3 text-civic-600" />
                      <span>{item.confirmationCount || 1} hits</span>
                    </span>
                  </td>
                  <td className="p-3.5 whitespace-nowrap text-slate-500 font-medium">
                    {formatDate(item.lastDetectedAt || item.firstDetectedAt)}
                  </td>
                  <td className="p-3.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPothole(item);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-civic-700 bg-civic-50 hover:bg-civic-100 rounded-lg transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
        <div>
          Showing <span className="font-semibold text-slate-800">{filteredData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to <span className="font-semibold text-slate-800">{Math.min(currentPage * pageSize, filteredData.length)}</span> of <span className="font-semibold text-slate-800">{filteredData.length}</span> records
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className="p-1 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-200/60 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 font-medium text-slate-700">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className="p-1 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-200/60 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
