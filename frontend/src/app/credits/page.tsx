'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { CustomerSettleBalanceModal } from '../../components/CustomerSettleBalanceModal';
import {
  CreditCard,
  Users,
  Search,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertCircle,
  ArrowRight,
  Phone,
  Clock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  CheckCircle2,
  IndianRupee,
  Layers
} from 'lucide-react';

interface MonthlyCreditStat {
  monthKey: string;
  label: string;
  incurred: number;
  settled: number;
  outstanding: number;
  recoveryRate: number;
  recordsCount: number;
  debtorsCount: number;
}

interface CreditAnalyticsSummary {
  totalOutstanding: number;
  debtorsCount: number;
  totalCreditGiven: number;
  totalCreditSettled: number;
  overallRecoveryRate: number;
}

interface DebtorCustomer {
  customerId: number;
  customerName: string;
  customerPhone: string;
  totalCreditDue: number;
  unpaidCount: number;
  oldestUnpaidDate?: string | null;
  creditRecords: {
    id: number;
    amount: number;
    settledAmount: number;
    due: number;
    status: string;
    notes?: string | null;
    createdAt: string;
    visitId?: string | null;
  }[];
}

function CreditsPageContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [analytics, setAnalytics] = useState<{
    summary: CreditAnalyticsSummary;
    monthlyBreakdown: MonthlyCreditStat[];
  } | null>(null);

  const [debtors, setDebtors] = useState<DebtorCustomer[]>([]);
  const [totalDebtors, setTotalDebtors] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [loadingDebtors, setLoadingDebtors] = useState(true);
  const [activeMonthFilter, setActiveMonthFilter] = useState<string | null>(null);

  // Settlement modal state
  const [settlingCustomer, setSettlingCustomer] = useState<{
    id: number;
    name: string;
    phone: string;
    currentCreditDue: number;
  } | null>(null);

  // Load analytics
  const fetchAnalytics = async () => {
    try {
      setLoadingAnalytics(true);
      const data = await api.get('/credits/analytics');
      setAnalytics(data);
    } catch (err: any) {
      console.error('Failed to load credit analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Load debtors list (ordered by highest credit first)
  const fetchDebtors = async (pageNum = 1, searchQuery = search) => {
    try {
      setLoadingDebtors(true);
      const query = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : '';
      const data = await api.get(`/credits?page=${pageNum}&limit=15${query}`);
      setDebtors(data.debtors || []);
      setTotalDebtors(data.total || 0);
      setPage(data.page || 1);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      console.error('Failed to load debtors list:', err);
    } finally {
      setLoadingDebtors(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    fetchDebtors(1, '');
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDebtors(1, search);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const refreshAll = () => {
    fetchAnalytics();
    fetchDebtors(page, search);
  };

  const handleSettleSuccess = () => {
    setSettlingCustomer(null);
    refreshAll();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header & Quick Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center border border-rose-200 shadow-2xs">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-display tracking-tight">
                  Customer Credit &amp; Receivables
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lounge-wide credit accounts, monthly recovery trends, and outstanding receivables
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={refreshAll}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAnalytics || loadingDebtors ? 'animate-spin text-slate-900' : 'text-slate-500'}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => router.push('/customers')}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Customer 360 Profiles</span>
            </button>
          </div>
        </div>

        {/* 1. EXECUTIVE SUMMARY KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Outstanding */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Total Outstanding Receivables
                </span>
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-rose-700 font-display mt-1 block">
                ₹{(analytics?.summary.totalOutstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Across open credit accounts</span>
              <span className="font-bold font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                {analytics?.summary.debtorsCount || 0} customers
              </span>
            </div>
          </div>

          {/* Card 2: Overall Recovery Rate */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Overall Recovery Rate
                </span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-emerald-700 font-display mt-1 block">
                {analytics?.summary.overallRecoveryRate || 0}%
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Total Recovered</span>
              <span className="font-bold font-mono text-emerald-700">
                ₹{(analytics?.summary.totalCreditSettled || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {/* Card 3: Total Credit Ever Given */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Lifetime Credit Incurred
                </span>
                <Layers className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 font-display mt-1 block">
                ₹{(analytics?.summary.totalCreditGiven || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Settled + Outstanding</span>
              <span className="font-bold font-mono text-slate-700">
                100% Audited
              </span>
            </div>
          </div>

          {/* Card 4: Top Debtor Concentration */}
          <div className="p-5 rounded-2xl bg-slate-900 text-white shadow-xs flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block">
                Highest Single Balance
              </span>
              <span className="text-2xl sm:text-3xl font-black text-rose-400 font-display mt-1 block">
                ₹{(debtors[0]?.totalCreditDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300 font-medium">
              <span className="truncate max-w-[140px] font-bold">
                {debtors[0]?.customerName || 'None'}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Rank #1
              </span>
            </div>
          </div>
        </div>

        {/* 2. MONTH-WISE CREDIT ANALYTICS SECTION */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 font-display flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-600" />
                <span>Month-Wise Credit Analytics on Rebound</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Monthly breakdown of credit extended, debt settled, and remaining unpaid receivables
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400 self-start sm:self-auto">
              {analytics?.monthlyBreakdown.length || 0} Months Tracked
            </span>
          </div>

          {loadingAnalytics ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
              <span>Aggregating monthly credit trends...</span>
            </div>
          ) : !analytics || analytics.monthlyBreakdown.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No monthly credit records found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analytics.monthlyBreakdown.map((m) => {
                const isCurrentMonth = m.monthKey === new Date().toISOString().slice(0, 7);

                return (
                  <div
                    key={m.monthKey}
                    className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                      isCurrentMonth
                        ? 'bg-slate-50/70 border-slate-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Month Header & Badges */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-sm text-slate-900 font-display">
                            {m.label}
                          </h3>
                          {isCurrentMonth && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200 font-mono">
                              Active Month
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {m.recordsCount} credit records • {m.debtorsCount} unique debtors
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">
                          Recovery Rate
                        </span>
                        <span className={`text-sm font-black font-mono ${
                          m.recoveryRate >= 70
                            ? 'text-emerald-700'
                            : m.recoveryRate >= 40
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}>
                          {m.recoveryRate}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar of Recovery */}
                    <div>
                      <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                        <div
                          className="bg-emerald-600 h-full transition-all"
                          style={{ width: `${Math.min(100, m.recoveryRate)}%` }}
                          title={`Settled: ₹${m.settled.toFixed(2)} (${m.recoveryRate}%)`}
                        />
                        <div
                          className="bg-rose-500 h-full transition-all"
                          style={{ width: `${Math.max(0, 100 - m.recoveryRate)}%` }}
                          title={`Outstanding: ₹${m.outstanding.toFixed(2)}`}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                        <span>Settled: {m.recoveryRate}%</span>
                        <span>Outstanding: {(100 - m.recoveryRate).toFixed(1)}%</span>
                      </div>
                    </div>

                    {/* 3 Metric Pills: Incurred, Settled, Due */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                      <div className="p-2.5 rounded-xl bg-slate-100/70 border border-slate-200/60">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
                          Incurred
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono mt-0.5 block truncate">
                          ₹{m.incurred.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/70">
                        <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider block font-mono">
                          Settled
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-emerald-800 font-mono mt-0.5 block truncate">
                          ₹{m.settled.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200/70">
                        <span className="text-[9px] font-bold text-rose-800 uppercase tracking-wider block font-mono">
                          Unpaid Due
                        </span>
                        <span className="text-xs sm:text-sm font-black text-rose-700 font-mono mt-0.5 block truncate">
                          ₹{m.outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. CREDITORS LIST (ORDERED BY HIGHEST CREDIT FIRST) */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 font-display">
                  Customer Outstanding Balances Ranking
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200 text-xs font-mono font-bold">
                  Highest Credit First
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                All customers with active outstanding credit balances, sorted in descending order
              </p>
            </div>

            {/* Instant Search Bar */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer name or phone..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-colors bg-slate-50"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Debtors List Table / Cards */}
          {loadingDebtors ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
              <span>Loading creditors ranking...</span>
            </div>
          ) : debtors.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              {search ? (
                <>No customer accounts matched &ldquo;<strong>{search}</strong>&rdquo;.</>
              ) : (
                <>🎉 Zero outstanding balances! All customer accounts are completely clear.</>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {debtors.map((debtor, idx) => {
                const rank = (page - 1) * 15 + idx + 1;
                const isTopThree = rank <= 3;

                return (
                  <div
                    key={debtor.customerId}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isTopThree
                        ? 'bg-rose-50/20 border-rose-200/80 hover:border-rose-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Left: Rank, Name, Phone, and Records info */}
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Rank Badge */}
                      <div
                        className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center font-mono font-black text-xs border ${
                          rank === 1
                            ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                            : rank === 2
                            ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                            : rank === 3
                            ? 'bg-slate-700 text-white border-slate-800'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                        title={`Rank #${rank} by highest outstanding balance`}
                      >
                        #{rank}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-sm text-slate-900 truncate">
                            {debtor.customerName}
                          </h4>
                          <span className="text-[11px] font-mono font-semibold text-slate-500">
                            • {debtor.customerPhone || 'No Phone'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {debtor.unpaidCount} unpaid visit record{debtor.unpaidCount > 1 ? 's' : ''}
                          {debtor.oldestUnpaidDate && (
                            <span> • Oldest: {new Date(debtor.oldestUnpaidDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Right: Outstanding Amount & Action Buttons */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                          Outstanding Balance
                        </span>
                        <span className="text-base sm:text-lg font-black text-rose-700 font-display">
                          ₹{debtor.totalCreditDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Quick Settle Button */}
                        <button
                          type="button"
                          onClick={() => setSettlingCustomer({
                            id: debtor.customerId,
                            name: debtor.customerName,
                            phone: debtor.customerPhone,
                            currentCreditDue: debtor.totalCreditDue
                          })}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Settle</span>
                        </button>

                        {/* View 360 Profile */}
                        <button
                          type="button"
                          onClick={() => router.push(`/customers?phone=${encodeURIComponent(debtor.customerPhone || debtor.customerName)}`)}
                          className="p-2 border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl text-xs transition-colors cursor-pointer"
                          title="Open Customer 360 Profile & Visits"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
              <span className="text-slate-500 font-medium">
                Showing Page <strong className="text-slate-900">{page}</strong> of <strong className="text-slate-900">{totalPages}</strong> ({totalDebtors} accounts)
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => fetchDebtors(page - 1)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => fetchDebtors(page + 1)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Settle Balance Modal */}
      {settlingCustomer && (
        <CustomerSettleBalanceModal
          customer={settlingCustomer}
          onClose={() => setSettlingCustomer(null)}
          onSuccess={handleSettleSuccess}
        />
      )}
    </div>
  );
}

export default function CreditsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
        </div>
      }
    >
      <CreditsPageContent />
    </Suspense>
  );
}
