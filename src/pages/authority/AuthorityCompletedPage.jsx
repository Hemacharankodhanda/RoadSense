import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Calendar,
  DollarSign,
  User,
  MapPin,
  Building,
  Search,
  LayoutGrid,
  List,
  Eye,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { subscribePotholes, getCachedPotholes } from '../../lib/potholeService';
import AuthorityActionDrawer from '../../components/authority/AuthorityActionDrawer';

export default function AuthorityCompletedPage() {
  const [potholes, setPotholes] = useState(() => getCachedPotholes());
  const [loading, setLoading] = useState(() => getCachedPotholes().length === 0);
  const [selectedPothole, setSelectedPothole] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsub = subscribePotholes((data) => {
      setPotholes(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Filter completed potholes only
  const completedList = useMemo(() => {
    return potholes
      .filter(p => p.status === 'repaired')
      .filter(p => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        const addr = (p.address || '').toLowerCase();
        const remarks = (p.completion?.remarks || '').toLowerCase();
        const officer = (p.completion?.completedBy?.name || '').toLowerCase();
        const dept = (p.assignedDepartment || '').toLowerCase();
        return addr.includes(q) || remarks.includes(q) || officer.includes(q) || dept.includes(q);
      });
  }, [potholes, searchTerm]);

  // Aggregate expenditures
  const totalExpenditure = useMemo(() => {
    return completedList.reduce((acc, cur) => acc + (Number(cur.completion?.cost) || 0), 0);
  }, [completedList]);

  const formatDate = (isoStr) => {
    if (!isoStr) return 'N/A';
    try {
      return new Date(isoStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return isoStr;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <span>Completed Works & Proof Gallery</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Archived record of all verified patched potholes with proof photos and expenditure.
          </p>
        </div>

        {/* View mode & Summary badge */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs font-semibold text-emerald-300">
            Total Spent: <strong className="text-white">${totalExpenditure.toLocaleString()}</strong>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center text-xs">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="max-w-md relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter by address, remarks, contractor, officer..."
          className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-civic-500"
        />
      </div>

      {/* Grid Gallery View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {completedList.length === 0 ? (
            <div className="col-span-full p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl italic">
              No completed works recorded yet.
            </div>
          ) : (
            completedList.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedPothole(item)}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col group"
              >
                {/* Proof Image Banner */}
                <div className="h-48 bg-slate-950 relative overflow-hidden flex items-center justify-center">
                  {item.completion?.proofPhotoUrl ? (
                    <img
                      src={item.completion.proofPhotoUrl}
                      alt="Completed repair"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt="Initial defect"
                      className="w-full h-full object-cover opacity-80"
                    />
                  ) : (
                    <div className="text-slate-600 text-xs flex flex-col items-center gap-1.5">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500/50" />
                      <span>Certified without photo upload</span>
                    </div>
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 bg-emerald-950/90 backdrop-blur-md border border-emerald-700 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>REPAIRED</span>
                  </div>

                  {item.completion?.cost > 0 && (
                    <div className="absolute top-3 right-3 bg-slate-950/90 backdrop-blur-md border border-slate-700 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                      ${Number(item.completion.cost).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-white line-clamp-1">
                      {item.address || 'Street Surface Fix'}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      #{item.id?.slice(0, 8)} • {item.location?.lat?.toFixed(4)}, {item.location?.lng?.toFixed(4)}
                    </p>
                  </div>

                  {item.completion?.remarks && (
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                      "{item.completion.remarks}"
                    </p>
                  )}

                  <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-500" />
                        <span>Certified By</span>
                      </span>
                      <span className="text-slate-300 font-medium">
                        {item.completion?.completedBy?.name || 'Municipal Officer'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>Completed Date</span>
                      </span>
                      <span className="text-slate-300">
                        {formatDate(item.completion?.completedAt)}
                      </span>
                    </div>

                    {item.assignedDepartment && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3 text-slate-500" />
                          <span>Contractor</span>
                        </span>
                        <span className="text-civic-300 font-medium truncate max-w-[150px]">
                          {item.assignedDepartment}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase font-semibold bg-slate-950/60">
                  <th className="p-3.5">Defect / Location</th>
                  <th className="p-3.5">Contractor / Dept</th>
                  <th className="p-3.5">Cost</th>
                  <th className="p-3.5">Completed Date</th>
                  <th className="p-3.5">Certified Officer</th>
                  <th className="p-3.5">Remarks</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {completedList.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedPothole(item)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="p-3.5 max-w-xs">
                      <p className="font-bold text-white truncate">{item.address || 'Street defect'}</p>
                      <p className="text-[10px] text-slate-500 font-mono">#{item.id?.slice(0, 8)}</p>
                    </td>
                    <td className="p-3.5 whitespace-nowrap text-slate-300 font-medium">
                      {item.assignedDepartment || 'Direct Works'}
                    </td>
                    <td className="p-3.5 whitespace-nowrap font-mono text-emerald-400 font-bold">
                      ${Number(item.completion?.cost || 0).toLocaleString()}
                    </td>
                    <td className="p-3.5 whitespace-nowrap text-slate-400">
                      {formatDate(item.completion?.completedAt)}
                    </td>
                    <td className="p-3.5 whitespace-nowrap text-slate-300">
                      {item.completion?.completedBy?.name || 'Officer'}
                    </td>
                    <td className="p-3.5 max-w-xs truncate text-slate-400">
                      {item.completion?.remarks || 'N/A'}
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPothole(item);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ml-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
