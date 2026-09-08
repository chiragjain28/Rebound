'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { Udhar } from '../../types';
import { Navbar } from '../../components/Navbar';
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  RefreshCw,
  BookOpen,
  Check,
  User,
  ExternalLink
} from 'lucide-react';

export default function UdharLedgerPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  // Pagination and Search states
  const [udhars, setUdhars] = useState<Udhar[]>([]);
  const [totalDebtors, setTotalDebtors] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
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

  const fetchUdhars = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const res = await api.get(
        `/udhar?page=${currentPage}&limit=15&search=${encodeURIComponent(searchQuery)}`
      );
      setUdhars(res.udhars || []);
      setTotalDebtors(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      console.error('Failed to load udhar ledger:', err);
      setError(err.message || 'Failed to load udhar ledger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUdhars();
  }, [currentPage, searchQuery, token]);

  const handleClearSearch = () => {
    setSearchTerm('');
  };

  const handleSettleUdhar = async (id: number) => {
    if (confirm('Mark this udhar as fully paid and settled?')) {
      try {
        await api.post(`/udhar/${id}/pay`, {});
        fetchUdhars();
      } catch (err: any) {
        alert(err.message || 'Failed to settle udhar');
      }
    }
  };

  // Group fetched udhars by customer name case-insensitively
  const groupedUdharsList = React.useMemo(() => {
    const groupsMap = new Map<string, { customerName: string; entries: Udhar[] }>();

    udhars.forEach((udhar) => {
      const key = udhar.customerName.trim().toLowerCase();
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          customerName: udhar.customerName.trim(),
          entries: [],
        });
      }
      groupsMap.get(key)!.entries.push(udhar);
    });

    const list = Array.from(groupsMap.values()).map((group) => {
      const totalOutstanding = group.entries
        .filter((e) => e.status === 'unpaid')
        .reduce((sum, e) => sum + e.amount, 0);

      // Sort entries strictly by date descending (newest debt at the top)
      const sortedEntries = [...group.entries].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      // Find the date of the most recent unpaid debt
      const mostRecentUnpaidEntry = group.entries
        .filter((e) => e.status === 'unpaid')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      const mostRecentUnpaidDate = mostRecentUnpaidEntry
        ? new Date(mostRecentUnpaidEntry.createdAt).getTime()
        : 0;

      return {
        customerName: group.customerName,
        totalOutstanding,
        entries: sortedEntries,
        mostRecentUnpaidDate
      };
    });

    // Sort customer groups: outstanding first, then sorted by mostRecentUnpaidDate descending
    return list.sort((a, b) => {
      if (a.totalOutstanding > 0 && b.totalOutstanding === 0) return -1;
      if (a.totalOutstanding === 0 && b.totalOutstanding > 0) return 1;
      if (a.totalOutstanding > 0 && b.totalOutstanding > 0) {
        return b.mostRecentUnpaidDate - a.mostRecentUnpaidDate;
      }
      return a.customerName.localeCompare(b.customerName);
    });
  }, [udhars]);

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

  const formatDateTime = (dateStr: string | Date) => {
    const dateObj = new Date(dateStr);
    return `${dateObj.toLocaleDateString([], { day: '2-digit', month: 'short' })} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  if (authLoading || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0d14]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
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
            <h1 className="text-2xl font-extrabold text-white tracking-tight font-display">Udhar Ledger History</h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              View, search, and settle customer debts and outstanding credits.
            </p>
          </div>

          {/* Refresh Action */}
          <button
            onClick={fetchUdhars}
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
              placeholder="Search by customer name (e.g. Ram)..."
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

          <div className="shrink-0 text-xs font-mono font-bold text-slate-400">
            {searchQuery ? `Found ${totalDebtors} matching debtors` : `Total ${totalDebtors} debtors`}
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="bg-rose-950/60 text-rose-300 text-xs font-bold p-4 rounded-2xl border border-rose-500/40">
            {error}
          </div>
        )}

        {/* Debtors Content */}
        {loading ? (
          <div className="flex items-center justify-center py-32 bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-800">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400"></div>
              <p className="text-xs text-slate-400 font-bold font-mono">Loading ledger entries...</p>
            </div>
          </div>
        ) : groupedUdharsList.length === 0 ? (
          <div className="text-center py-24 bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-800 text-slate-400 font-semibold text-sm">
            No debtors found {searchQuery && 'matching your search'}.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groupedUdharsList.map((group) => (
              <div
                key={group.customerName}
                className="bg-[#111827]/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between hover:border-cyan-500/50 transition-all duration-300"
              >
                {/* Header of Customer Card */}
                <div>
                  <div className="flex justify-between items-start p-4 bg-slate-900 border-b border-slate-800">
                    <div className="min-w-0">
                      <span className="block font-extrabold text-white text-base tracking-tight truncate flex items-center gap-1.5 font-display">
                        <User className="h-4 w-4 text-cyan-400 shrink-0" />
                        {group.customerName}
                      </span>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">
                        {group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}
                      </p>
                    </div>
                    <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-xl border shrink-0 ${group.totalOutstanding > 0
                      ? 'bg-rose-950/80 text-rose-300 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                      : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                      }`}>
                      {group.totalOutstanding > 0 ? `Owed: ₹${group.totalOutstanding.toFixed(2)}` : 'Settled'}
                    </span>
                  </div>

                  {/* List of Entries */}
                  <div className="p-4 space-y-3 max-h-[220px] overflow-y-auto">
                    {group.entries.map((udhar) => (
                      <div
                        key={udhar.id}
                        className={`flex justify-between items-center p-3 rounded-xl border text-xs bg-slate-900 ${udhar.status === 'paid'
                          ? 'border-emerald-500/30 text-emerald-300'
                          : 'border-rose-500/30 text-rose-300'
                          }`}
                      >
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-500" />
                            {formatDateTime(udhar.createdAt)}
                          </p>
                          {udhar.sessionId && (
                            <button
                              onClick={() => router.push(`/sessions/${udhar.sessionId}`)}
                              className="text-[9px] text-cyan-400 hover:text-cyan-300 font-bold mt-1 inline-flex items-center gap-0.5 font-mono"
                              title="Go to related session"
                            >
                              Ref: {udhar.sessionId.slice(-12)}
                              <ExternalLink className="h-2 w-2" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`font-mono font-extrabold ${udhar.status === 'paid' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            ₹{udhar.amount.toFixed(2)}
                          </span>
                          {udhar.status === 'unpaid' ? (
                            <button
                              onClick={() => handleSettleUdhar(udhar.id)}
                              className="bg-emerald-950/80 hover:bg-emerald-500 hover:text-black text-emerald-300 border border-emerald-500/50 px-2 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-0.5 shadow-sm transition-all duration-200"
                            >
                              <Check className="h-3 w-3" />
                              Settle
                            </button>
                          ) : (
                            <span className="text-[9px] font-extrabold text-emerald-400 uppercase bg-emerald-950 px-2 py-0.5 rounded-lg border border-emerald-800 font-mono">
                              Paid
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#111827]/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-800 shadow-xl mt-8">
            <span className="text-xs text-slate-400 font-mono">
              Showing <span className="font-extrabold text-white">{Math.min((currentPage - 1) * 15 + 1, totalDebtors)}</span> to{' '}
              <span className="font-extrabold text-white">{Math.min(currentPage * 15, totalDebtors)}</span> of{' '}
              <span className="font-extrabold text-white">{totalDebtors}</span> debtors
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
                  className={`inline-flex items-center px-3.5 py-2 border text-xs font-extrabold font-mono transition-all duration-300 ${pageNum === currentPage
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
