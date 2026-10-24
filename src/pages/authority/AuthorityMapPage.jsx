import React, { useState, useEffect } from 'react';
import PotholeMap from '../../components/map/PotholeMap';
import AuthorityActionDrawer from '../../components/authority/AuthorityActionDrawer';
import { subscribePotholes } from '../../lib/potholeService';
import { Layers, Shield, AlertTriangle, CheckCircle2, Wrench, RefreshCw } from 'lucide-react';

export default function AuthorityMapPage() {
  const [potholes, setPotholes] = useState([]);
  const [selectedPothole, setSelectedPothole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Status Filter
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  useEffect(() => {
    const unsub = subscribePotholes((data) => {
      setPotholes(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredPotholes = potholes.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (severityFilter !== 'all' && p.severity !== severityFilter) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full min-h-[calc(100vh-4rem)] md:min-h-screen relative">
      {/* Top Floating Tactical Control Bar */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 z-10">
        <div>
          <h1 className="text-base font-bold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-civic-400" />
            <span>Tactical Road Condition Map</span>
          </h1>
          <p className="text-[11px] text-slate-400">
            Real-time IoT nodes & citizen reports overlay. Click defect to triage.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-civic-500"
          >
            <option value="all">All Statuses ({potholes.length})</option>
            <option value="reported">Reported</option>
            <option value="verified">Verified</option>
            <option value="in_progress">Under Repair</option>
            <option value="repaired">Repaired</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-xs bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-civic-500"
          >
            <option value="all">All Severities</option>
            <option value="high">Critical Impact (High)</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <span className="text-xs font-mono text-slate-400 pl-2 border-l border-slate-800">
            Showing <strong className="text-white">{filteredPotholes.length}</strong> pins
          </span>
        </div>
      </div>

      {/* Map Element */}
      <div className="flex-1 relative">
        <PotholeMap
          potholes={filteredPotholes}
          selectedPothole={selectedPothole}
          onSelectPothole={(p) => setSelectedPothole(p)}
          className="w-full h-full min-h-[500px]"
        />
      </div>

      {/* Authority Action & Triage Drawer */}
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
