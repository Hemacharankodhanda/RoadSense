import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  LayoutDashboard,
  Map,
  ListOrdered,
  CheckCircle2,
  FileSpreadsheet,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Radio,
  Cpu,
  UserCheck
} from 'lucide-react';
import { subscribeDevices } from '../../lib/potholeService';

export default function AuthorityLayout() {
  const { userProfile, logout, currentUser } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    const unsub = subscribeDevices((devList) => {
      setDevices(devList);
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/authority/login');
  };

  const navLinks = [
    { to: '/authority', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/authority/map', label: 'Map Control Center', icon: Map },
    { to: '/authority/queue', label: 'Pothole Queue', icon: ListOrdered },
    { to: '/authority/completed', label: 'Completed Works', icon: CheckCircle2 },
    { to: '/authority/reports', label: 'Reports & Export', icon: FileSpreadsheet },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* MOBILE TOP BAR */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-civic-700 flex items-center justify-center text-white">
            <Shield className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-tight text-white">RoadSense Authority</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* SIDEBAR NAVIGATION (Desktop & Mobile Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-civic-600 to-civic-800 flex items-center justify-center text-white shadow-lg border border-civic-500/20">
            <Shield className="w-5 h-5 text-civic-200" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm text-white tracking-tight">RoadSense</h1>
            <span className="text-[10px] font-semibold text-civic-400 uppercase tracking-wider block">
              Municipal Portal
            </span>
          </div>
        </div>

        {/* Officer Profile Card */}
        <div className="p-4 mx-3 my-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-civic-900 border border-civic-400/40 text-civic-300 flex items-center justify-center font-bold text-[10px]">
              {userProfile?.name?.charAt(0) || userProfile?.email?.charAt(0) || 'A'}
            </div>
            <div className="truncate flex-1">
              <p className="font-semibold text-slate-200 truncate">
                {userProfile?.name || userProfile?.email?.split('@')[0] || 'Official'}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {userProfile?.department || 'Public Works Dept'}
              </p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[10px]">
            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
              <UserCheck className="w-3 h-3" />
              Role: Authority
            </span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-civic-600 text-white shadow-md shadow-civic-900/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* IoT Fleet Telemetry Status Pill */}
        <div className="p-3 mx-3 my-2 bg-slate-950/60 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>IoT Patrol Nodes</span>
          </div>
          <span className="font-mono font-bold text-slate-200">
            {devices.length || 3} Online
          </span>
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-800 space-y-1">
          <Link
            to="/"
            target="_blank"
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Public Portal</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-950/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN VIEW CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-950">
        <Outlet />
      </main>
    </div>
  );
}
