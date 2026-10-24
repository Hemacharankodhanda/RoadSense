import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, LogOut, ArrowLeft, Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const { currentUser, userProfile, isAuthority, loading, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-civic-400 mb-4" />
        <p className="text-sm font-medium tracking-wide text-slate-300">
          Verifying Municipal Authority Credentials...
        </p>
      </div>
    );
  }

  // Not logged in -> go to authority login
  if (!currentUser) {
    return <Navigate to="/authority/login" state={{ from: location }} replace />;
  }

  // Logged in, but role is not 'authority'
  if (!isAuthority) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Restricted Authority Area</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Your account (<span className="text-slate-200 font-mono">{currentUser.email}</span>) is authenticated as <span className="text-amber-400 font-medium">"{userProfile?.role || 'citizen'}"</span>. Only official accounts with <span className="text-emerald-400 font-semibold">role: "authority"</span> are authorized to triage defects.
          </p>

          <div className="p-3 bg-slate-800/60 rounded-lg text-xs text-slate-400 text-left mb-6 font-mono border border-slate-700/50">
            <p className="text-slate-300 font-semibold mb-1">To gain authority access:</p>
            Run <span className="text-civic-300">node create-authority.js</span> in the server terminal, or update your Firestore doc at <span className="text-civic-300">users/{currentUser.uid}</span> to set <span className="text-emerald-400">role: "authority"</span>.
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => logout()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out & Switch Account
            </button>
            <Link
              to="/"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-transparent hover:bg-slate-800/40 text-slate-400 hover:text-white rounded-lg text-sm font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Public Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
