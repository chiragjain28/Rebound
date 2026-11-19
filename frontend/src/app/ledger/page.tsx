'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { Udhar } from '../../types';
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

  // Search input debouncer (350ms delay)
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchTerm);
      setCurrentPage(1);
    }, 350);

    return () => clearTimeout(handler);
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
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleSettleUdhar = async (id: number | string) => {
    try {
      await api.post(`/udhar/${id}/settle`, {});
      fetchUdhars();
    } catch (err: any) {
      alert(err.message || 'Failed to settle account');
    }
  };

  const groupedUdharsList = React.useMemo(() => {
    const map = new Map<string, { customerName: string; entries: Udhar[] }>();

    udhars.forEach((u) => {
      const key = u.customerName.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, { customerName: u.customerName, entries: [] });
      }
      map.get(key)!.entries.push(u);
    });

    const list = Array.from(map.values()).map((group) => {
      const sortedEntries = group.entries.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const totalOutstanding = group.entries
        .filter((e) => e.status === 'unpaid')
        .reduce((sum, e) => sum + e.amount, 0);

      const mostRecentUnpaidEntry = group.entries
        .filter((e) => e.status === 'unpaid')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      const mostRecentUnpaidDate = mostRecentUnpaidEntry
        ? new Date(mostRecentUnpaidEntry.createdAt).getTime()
        : 0;

      return {
        customerName: group.customerName,
        phone: sortedEntries[0]?.session?.customerPhone || '',
        totalOutstanding,
        entries: sortedEntries,
        mostRecentUnpaidDate
      };
    });

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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-700"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 font-sans">

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">

        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors mb-2 gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Floor Plan
            </button>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-display">Customer Credit &amp; Outstanding Balances</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Track, audit, search, and settle customer running balances across all visits.
            </p>
          </div>

          {/* Refresh Action */}
          <button
            onClick={fetchUdhars}
            className="inline-flex items-center justify-center px-4 py-2 border border-slate-200 text-xs font-bold rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-all shadow-xs w-fit"
            title="Refresh list"
          >
            <RefreshCw className={`h-4 w-4 mr-2 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filter / Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-4">
          <div className="relative w-full flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search customer by name or phone number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-10 py-2 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs font-semibold placeholder-slate-400"
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="shrink-0 text-xs font-mono font-bold text-slate-500">
            {searchQuery ? `Found ${totalDebtors} matching accounts` : `Total ${totalDebtors} open credit accounts`}
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="bg-rose-50 text-rose-700 text-xs font-semibold p-4 rounded-2xl border border-rose-200">
            {error}
          </div>
        )}

        {/* Debtors Content */}
        {loading ? (
          <div className="flex items-center justify-center py-32 bg-white rounded-2xl border border-slate-200">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-slate-600"></div>
              <p className="text-xs text-slate-500 font-bold">Loading ledger entries...</p>
            </div>
          </div>
        ) : groupedUdharsList.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
            No open credit accounts found {searchQuery && `matching "${searchQuery}"`}.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {groupedUdharsList.map((group) => (
              <div
                key={group.customerName}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between hover:border-slate-300 hover:shadow-md transition-all"
              >
                <div>
                  <div className="flex justify-between items-start p-4 bg-slate-50/70 border-b border-slate-100">
                    <div className="min-w-0 pr-2">
                      <span className="block font-bold text-slate-900 text-sm tracking-tight truncate flex items-center gap-1.5 font-display">
                        <User className="h-4 w-4 text-slate-400 shrink-0" />
                        {group.customerName}
                      </span>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}
                      </p>
                    </div>
                    <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${
                      group.totalOutstanding > 0
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {group.totalOutstanding > 0 ? `₹${group.totalOutstanding.toFixed(0)} Due` : 'Settled'}
                    </span>
                  </div>

                  <div className="p-3.5 space-y-2.5 max-h-[220px] overflow-y-auto">
                    {group.entries.map((udhar) => (
                      <div
                        key={udhar.id}
                        className="flex justify-between items-center p-2.5 rounded-xl border border-slate-100 text-xs bg-slate-50/50"
                      >
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {formatDateTime(udhar.createdAt)}
                          </p>
                          <button
                            onClick={() => router.push(`/customers?phone=${encodeURIComponent(group.phone || group.customerName)}`)}
                            className="text-[10px] text-slate-600 hover:text-slate-900 font-bold mt-0.5 inline-flex items-center gap-0.5 font-mono"
                            title="View Customer Profile & Visits"
                          >
                            <span>Customer Profile</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`font-mono font-bold ${udhar.status === 'paid' ? 'text-emerald-700' : 'text-rose-700'}`}>
                            ₹{udhar.amount.toFixed(0)}
                          </span>
                          {udhar.status === 'unpaid' ? (
                            <button
                              onClick={() => handleSettleUdhar(udhar.id)}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 transition-all"
                            >
                              <Check className="h-3 w-3" />
                              Settle
                            </button>
                          ) : (
                            <span className="text-[9px] font-bold text-emerald-700 uppercase bg-emerald-50 px-2 py-0.2 rounded border border-emerald-200 font-mono">
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mt-6">
            <span className="text-xs text-slate-500 font-mono">
              Showing {Math.min((currentPage - 1) * 15 + 1, totalDebtors)} to {Math.min(currentPage * 15, totalDebtors)} of {totalDebtors} debtors
            </span>

            <div className="inline-flex items-center -space-x-px rounded-xl shadow-2xs">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center px-3 py-2 rounded-l-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="ml-1">Prev</span>
              </button>

              {getPageNumbers().map((pageNum, idx) => (
                <button
                  key={idx}
                  onClick={() => typeof pageNum === 'number' && setCurrentPage(pageNum)}
                  disabled={pageNum === '...'}
                  className={`inline-flex items-center px-3.5 py-2 border text-xs font-bold font-mono transition-all ${
                    pageNum === currentPage
                      ? 'bg-slate-900 border-slate-900 text-white shadow-2xs'
                      : pageNum === '...'
                      ? 'border-slate-200 bg-white text-slate-400 cursor-default'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center px-3 py-2 rounded-r-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
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
