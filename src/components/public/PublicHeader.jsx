import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, PlusCircle, Map, List, Lock, Radio } from 'lucide-react';

export default function PublicHeader({
  activeTab = 'map',
  setActiveTab = () => {},
  onOpenReportModal = () => {}
}) {
  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-[600] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo & Civic Tag */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-civic-700 to-civic-900 flex items-center justify-center text-white shadow-md shadow-civic-800/20 group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5 text-civic-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold tracking-tight text-slate-900 font-sans">
                  RoadSense
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-civic-100 text-civic-800 uppercase tracking-wider">
                  IoT + Civic
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Pothole & Surface Quality Monitoring
              </p>
            </div>
          </Link>

          {/* Real-Time Telemetry Live Pulse */}
          <div className="hidden lg:flex items-center gap-1.5 ml-4 pl-4 border-l border-slate-200 text-xs text-slate-500">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span className="font-medium text-slate-600">Live Firebase Stream</span>
          </div>
        </div>

        {/* Navigation & Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Map vs Directory Tab Switcher */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold text-slate-600 border border-slate-200/60">
            <button
              type="button"
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'map'
                  ? 'bg-white text-civic-800 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              <Map className="w-3.5 h-3.5 text-civic-600" />
              <span>Map View</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'list'
                  ? 'bg-white text-civic-800 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5 text-civic-600" />
              <span>Directory</span>
            </button>
          </div>

          {/* Report Button */}
          <button
            type="button"
            onClick={onOpenReportModal}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 bg-civic-700 hover:bg-civic-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all hover:shadow"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Report Hazard</span>
            <span className="sm:hidden">Report</span>
          </button>

          {/* Authority Portal Link */}
          <Link
            to="/authority"
            className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline">Authority Login</span>
            <span className="md:hidden">Authority</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
