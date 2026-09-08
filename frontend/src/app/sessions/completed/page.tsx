'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../lib/api';
import { Session } from '../../../types';
import { Navbar } from '../../../components/Navbar';
import { 
  ArrowLeft,
  Calendar, 
  ChevronLeft,
  ChevronRight,
  Coffee,
  Gamepad2,
  Cigarette,
  Eye,
  Search,
  X,
  RefreshCw
} from 'lucide-react';

export default function CompletedSessionsPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  // Pagination and Search states
  const [sessions, setSessions] = useState<Session[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !token) {
      router.push('/login');
    }
  }, [token, authLoading, router]);

  // Search input debouncer (400ms delay)
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchTerm);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const fetchSessions = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const res = await api.get(
        `/sessions/completed?page=${currentPage}&limit=15&search=${encodeURIComponent(searchQuery)}&date=${dateFilter}`
      );
      setSessions(res.sessions || []);
      setTotalSessions(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      console.error('Failed to load completed sessions:', err);
      setError(err.message || 'Failed to load completed sessions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [currentPage, searchQuery, dateFilter, token]);

  const handleClearSearch = () => {
    setSearchTerm('');
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const formatTime = (dateStr: string | Date) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string | Date) => {
    return new Date(dateStr).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (authLoading || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1a1a2e]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 pb-16 font-sans">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-cyan-400 transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1 text-cyan-400" />
              Back to Dashboard
            </button>
            <h1 className="text-2xl font-extrabold text-white tracking-tight font-display">Completed Sessions History</h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              View, search, and navigate through closed gaming and billing sessions.
            </p>
          </div>
          
          {/* Real-time Refresh Action */}
          <button
            onClick={fetchSessions}
            className="inline-flex items-center justify-center px-4 py-2 border border-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl text-slate-300 bg-slate-900 hover:bg-slate-800 hover:text-cyan-300 transition-all shadow-sm w-fit self-end sm:self-center"
            title="Refresh list"
          >
            <RefreshCw className={`h-4 w-4 mr-2 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filter / Search Bar */}
        <div className="bg-[#111827]/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center gap-4">
          <div className="relative w-full flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-cyan-400" />
            </div>
            <input
              type="text"
              placeholder="Search by customer name (e.g. Chirag)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-10 py-2.5 border border-slate-800 rounded-xl text-white bg-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs font-semibold placeholder-slate-500 transition-all duration-200"
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Date Filter */}
          <div className="relative w-full md:w-48 flex items-center">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-xl text-white bg-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs font-semibold font-mono"
            />
            {dateFilter && (
              <button
                onClick={() => {
                  setDateFilter('');
                  setCurrentPage(1);
                }}
                className="absolute right-7 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                title="Clear date"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="shrink-0 text-xs font-mono font-bold text-slate-400">
            {searchQuery || dateFilter ? `Found ${totalSessions} matches` : `Total ${totalSessions} closed sessions`}
          </div>
        </div>

        {/* Sessions Grid */}
        {error && (
          <div className="bg-rose-950/60 text-rose-300 text-xs font-bold p-4 rounded-2xl border border-rose-500/40">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-32 bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-800">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400"></div>
              <p className="text-xs text-slate-400 font-bold font-mono">Loading records...</p>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-24 bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-800 text-slate-400 font-semibold text-sm">
            No completed sessions found {(searchQuery || dateFilter) && 'matching your search criteria'}.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => {
              const hasCafe = session.orders?.some(
                (o) => o.menuItem?.category === 'Cafe' || o.menuItem?.category === 'Cold Drinks'
              );
              const hasCigarette = session.orders?.some(
                (o) => o.menuItem?.category === 'Cigarettes'
              );
              const hasTable = (session.tablePlays && session.tablePlays.length > 0) || session.gameCost > 0;

              return (
                <div
                  key={session.id}
                  className="group bg-[#111827]/90 border border-slate-800 p-5 rounded-2xl hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(0,242,254,0.15)] transition-all duration-300 flex flex-col justify-between h-[170px]"
                >
                  <div>
                    <div className="flex justify-between items-start gap-4">
                      <div className="min-w-0">
                        <span className="block font-extrabold text-white text-base tracking-tight truncate font-display">
                          {session.customerName}
                        </span>
                        <p className="text-[10px] text-slate-400 font-mono mt-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          <span className="truncate">
                            {session.startTime && session.endTime ? (
                              `${formatTime(session.startTime)} - ${formatTime(session.endTime)} · ${formatDate(session.endTime)}`
                            ) : (
                              'Closed'
                            )}
                          </span>
                        </p>
                      </div>
                      <span className="inline-flex items-center text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-1 rounded-xl shrink-0">
                        ₹{(session.totalBill || 0).toFixed(2)}
                      </span>
                    </div>

                    {/* Cyber minimalist tags */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {hasTable && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                          <Gamepad2 className="h-2.5 w-2.5 text-cyan-400" />
                          Table
                        </span>
                      )}
                      {hasCafe && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40">
                          <Coffee className="h-2.5 w-2.5 text-amber-400" />
                          Café
                        </span>
                      )}
                      {hasCigarette && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-500/40">
                          <Cigarette className="h-2.5 w-2.5 text-rose-400" />
                          Smoke
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-800 mt-2">
                    <span className="text-[10px] text-slate-500 font-mono truncate">
                      Staff: {session.staffUsername}
                    </span>
                    <button
                      onClick={() => router.push(`/sessions/${session.id}`)}
                      title="View Details"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-300 bg-slate-900 border border-slate-700 rounded-xl hover:bg-cyan-500 hover:text-black hover:border-cyan-400 transition-all duration-300 shadow-sm"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Session
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#111827]/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-800 shadow-xl mt-8">
            <span className="text-xs text-slate-400 font-mono">
              Showing <span className="font-extrabold text-white">{Math.min((currentPage - 1) * 15 + 1, totalSessions)}</span> to{' '}
              <span className="font-extrabold text-white">{Math.min(currentPage * 15, totalSessions)}</span> of{' '}
              <span className="font-extrabold text-white">{totalSessions}</span> completed sessions
            </span>

            <div className="inline-flex items-center -space-x-px rounded-xl shadow-sm">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center px-3 py-2 rounded-l-xl border border-slate-800 bg-slate-900 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="ml-1">Prev</span>
              </button>

              {getPageNumbers().map((pageNum, idx) => (
                <button
                  key={idx}
                  onClick={() => typeof pageNum === 'number' && setCurrentPage(pageNum)}
                  disabled={pageNum === '...'}
                  className={`inline-flex items-center px-3.5 py-2 border text-xs font-extrabold font-mono transition-all duration-300 ${
                    pageNum === currentPage
                      ? 'z-10 bg-cyan-500 border-cyan-400 text-black shadow-[0_0_15px_rgba(0,242,254,0.4)]'
                      : pageNum === '...'
                      ? 'border-slate-800 bg-slate-900 text-slate-500 cursor-default'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center px-3 py-2 rounded-r-xl border border-slate-800 bg-slate-900 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
              >
                <span className="mr-1">Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>

  );
}
