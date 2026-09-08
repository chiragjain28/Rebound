'use client';

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldAlert, Lock, User, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#0a0d14] px-4 py-12 sm:px-6 lg:px-8 overflow-hidden">
      
      {/* Background Ambient Neon Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative w-full max-w-md space-y-8 bg-[#111827]/80 backdrop-blur-2xl p-8 sm:p-10 rounded-3xl border border-slate-800/90 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
        
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 via-purple-500 to-indigo-600 p-[2px] shadow-[0_0_25px_rgba(0,242,254,0.4)]">
            <div className="w-full h-full bg-[#0a0d14] rounded-[14px] flex items-center justify-center">
              <span className="text-3xl">🎱</span>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-wider bg-gradient-to-r from-cyan-400 via-sky-300 to-purple-400 bg-clip-text text-transparent glow-text-cyan uppercase font-display">
              Rebound ERP
            </h1>
            <p className="mt-1 text-xs font-semibold text-slate-400 tracking-wider font-mono">
              GAMING LOUNGE & SNOOKER CLUB
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-rose-950/50 p-4 border border-rose-500/30 backdrop-blur-md animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ShieldAlert className="h-5 w-5 text-rose-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-xs font-bold text-rose-200">{error}</h3>
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 font-mono">
                Staff Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter staff ID or username"
                  className="block w-full pl-10 pr-4 py-3 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all duration-300"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 font-mono">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-4 py-3 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all duration-300"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 p-[1px] font-bold text-white shadow-[0_0_20px_rgba(0,242,254,0.3)] hover:shadow-[0_0_30px_rgba(0,242,254,0.5)] transition-all duration-300 active:scale-[0.99] disabled:opacity-50"
            >
              <div className="w-full h-full py-3.5 rounded-[11px] bg-gradient-to-r from-cyan-500 to-blue-600 group-hover:from-cyan-400 group-hover:to-blue-500 flex items-center justify-center transition-all">
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <span className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider">
                    <Sparkles className="h-4 w-4" />
                    Enter Lounge Portal
                  </span>
                )}
              </div>
            </button>
          </div>
        </form>

        <div className="pt-4 text-center">
          <p className="text-[11px] text-slate-500 font-mono">
            Powered by Rebound ERP System v1.0
          </p>
        </div>
      </div>
    </div>
  );
}

