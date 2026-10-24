import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Shield, Lock, Mail, ArrowLeft, Loader2, Sparkles, KeyRound } from 'lucide-react';

export default function AuthorityLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/authority';

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLoading(true);

    try {
      await login(email || 'officer@city.gov', password || 'admin123');
      navigate(from, { replace: true });
    } catch (err) {
      console.error('[AuthorityLogin] Login error:', err);
      // Fallback direct navigation
      navigate('/authority', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const handleInstantLogin = async () => {
    setLoading(true);
    await login('chief.inspector@amaravati.gov', 'anyPassword');
    navigate('/authority', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-civic-900/30 to-transparent pointer-events-none blur-3xl" />

      {/* Return to Public Portal link */}
      <div className="absolute top-6 left-6 z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Public Portal</span>
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="w-14 h-14 bg-gradient-to-br from-civic-600 to-civic-900 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl shadow-civic-900/40 border border-civic-500/20 mb-4">
          <Shield className="w-7 h-7 text-civic-200" />
        </div>
        <h2 className="text-center text-2xl font-extrabold tracking-tight text-white">
          Municipal Authority Portal
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Public Works & Road Infrastructure Dispatch System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-slate-900/90 backdrop-blur-xl py-8 px-6 sm:px-8 shadow-2xl rounded-2xl border border-slate-800 space-y-5">
          {/* Quick Instant Login Banner */}
          <div className="p-3 bg-civic-950/60 border border-civic-800 rounded-xl text-xs text-civic-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-civic-400 shrink-0" />
              <span>Any credentials accepted</span>
            </div>
            <button
              type="button"
              onClick={handleInstantLogin}
              className="px-2.5 py-1 bg-civic-600 hover:bg-civic-500 text-white rounded-lg font-bold text-[11px] shadow-sm transition-colors"
            >
              1-Click Sign In
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Government Email or Username
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. officer@city.gov (or any text)"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-civic-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Any password or leave blank"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-civic-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-civic-600 hover:bg-civic-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-civic-900/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in as Official...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Sign In to Authority Portal</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Notice */}
          <div className="pt-3 border-t border-slate-800 text-center">
            <p className="text-[11px] text-slate-400">
              Authentication requirement has been removed. You can enter any random email/password or click <strong>1-Click Sign In</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
