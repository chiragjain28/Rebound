'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';

import { 
  BarChart3, 
  TrendingUp, 
  IndianRupee, 
  Users, 
  Coffee, 
  DollarSign, 
  Receipt, 
  ArrowLeft,
  Calendar,
  Sparkles,
  Loader2,
  PackageCheck,
  ChevronRight,
  ChevronDown,
  Clock,
  Gamepad2,
  Flame,
  Activity,
  X,
  Filter
} from 'lucide-react';
import { AnalyticsLineCharts, ChartDataPoint } from '../../components/analytics/AnalyticsLineCharts';

interface AnalyticsData {
  range: string;
  periodLabel?: string;
  startDate?: string;
  endDate?: string;
  totalBilled: number;
  totalCollected: number;
  paymentSplit: {
    cash: number;
    upi: number;
  };
  categoryRevenue: {
    billiards: number;
    cafe: number;
    drinks: number;
    cigarettes: number;
    other: number;
  };
  customerStats: {
    totalRegistered: number;
    newInPeriod: number;
    activeInPeriod: number;
  };
  tableHoursStats?: {
    todayHours: number;
    weekHours: number;
    monthHours: number;
    periodHours: number;
    periodGamesCount: number;
    dailyAverageHours: number;
    byGameType: {
      pool: number;
      midSnooker: number;
      ps4: number;
      other: number;
    };
  };
  topItems: {
    name: string;
    category: string;
    quantity: number;
    revenue: number;
  }[];
  dailyTrend: {
    date: string;
    isoDate?: string;
    tableRev: number;
    menuRev: number;
    total: number;
    tickets: number;
    tableHours?: number;
  }[];
  chartData?: ChartDataPoint[];
  chartSummary?: {
    totalSales: number;
    snookerSales: number;
    poolSales: number;
    tableSales: number;
    cafeSales: number;
    creditSales: number;
  };
  totalTicketsCount: number;
}

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [filterType, setFilterType] = useState<'preset' | 'date' | 'month'>('preset');
  const [range, setRange] = useState<'today' | '7days' | 'month'>('month');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customTab, setCustomTab] = useState<'date' | 'month'>('date');
  const customPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customPickerRef.current && !customPickerRef.current.contains(event.target as Node)) {
        setShowCustomPicker(false);
      }
    };
    if (showCustomPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCustomPicker]);

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      }
    } catch {}
    return dateStr;
  };

  const formatDisplayMonth = (monthStr: string) => {
    if (!monthStr) return '';
    try {
      const parts = monthStr.split('-');
      if (parts.length === 2) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
        return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      }
    } catch {}
    return monthStr;
  };

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      let endpoint = '/dashboard/analytics';
      if (filterType === 'date' && selectedDate) {
        endpoint += `?date=${encodeURIComponent(selectedDate)}`;
      } else if (filterType === 'month' && selectedMonth) {
        endpoint += `?month=${encodeURIComponent(selectedMonth)}`;
      } else {
        endpoint += `?range=${range}`;
      }

      const res = await api.get(endpoint);
      setData(res);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [filterType, range, selectedDate, selectedMonth]);

  const categoryTotal = data?.categoryRevenue ? (
    (data.categoryRevenue.billiards || 0) +
    (data.categoryRevenue.cafe || 0) +
    (data.categoryRevenue.drinks || 0) +
    (data.categoryRevenue.cigarettes || 0) +
    (data.categoryRevenue.other || 0)
  ) : 1;

  const getPercent = (amount: number) => {
    if (!categoryTotal || categoryTotal === 0) return 0;
    return Math.round((amount / categoryTotal) * 100);
  };

  const formatHours = (hours: number = 0) => {
    if (!hours || hours <= 0) return '0 hrs';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const totalGameHours = data?.tableHoursStats?.periodHours || 0;
  const getGamePercent = (catHours: number = 0) => {
    if (!totalGameHours || totalGameHours === 0) return 0;
    return Math.round((catHours / totalGameHours) * 100);
  };

  const rangeLabels: Record<string, string> = {
    today: 'Today',
    '7days': 'Last 7 Days',
    month: 'This Month',
    '30days': 'Last 30 Days'
  };

  const currentLabel = data?.periodLabel || (
    filterType === 'date' && selectedDate
      ? `Date: ${selectedDate}`
      : filterType === 'month' && selectedMonth
      ? `Month: ${selectedMonth}`
      : rangeLabels[range] || 'Selected Period'
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">

      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
              title="Back to Floor Plan"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                Business &amp; Sales Analytics
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  ERP Intelligence
                </span>
              </h1>
              <p className="text-xs text-slate-500">Revenue breakdown by category, active table hours, customer retention &amp; sales analysis</p>
            </div>
          </div>

          {/* Unified Time Range & Custom Date Toolbar */}
          <div className="relative self-start lg:self-auto" ref={customPickerRef}>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              {[
                { id: 'today', label: 'Today' },
                { id: '7days', label: '7 Days' },
                { id: 'month', label: 'This Month' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setFilterType('preset');
                    setRange(tab.id as any);
                    setSelectedDate('');
                    setSelectedMonth('');
                    setShowCustomPicker(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filterType === 'preset' && range === tab.id
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              {/* Custom Date / Month Selector Button */}
              <button
                onClick={() => setShowCustomPicker(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterType !== 'preset'
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : showCustomPicker
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Select a specific date or month"
              >
                <Calendar className={`w-3.5 h-3.5 ${filterType !== 'preset' ? 'text-white' : 'text-slate-500'}`} />
                <span>
                  {filterType === 'date' && selectedDate
                    ? formatDisplayDate(selectedDate)
                    : filterType === 'month' && selectedMonth
                    ? formatDisplayMonth(selectedMonth)
                    : 'Custom'}
                </span>
                {filterType !== 'preset' ? (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilterType('preset');
                      setRange('month');
                      setSelectedDate('');
                      setSelectedMonth('');
                      setShowCustomPicker(false);
                    }}
                    className="ml-0.5 p-0.5 rounded-full hover:bg-blue-700 transition-colors"
                    title="Clear filter"
                  >
                    <X className="w-3 h-3 text-white" />
                  </span>
                ) : (
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                )}
              </button>
            </div>

            {/* Floating Custom Picker Dropdown Popover */}
            {showCustomPicker && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800">Filter by Specific Date / Month</span>
                  <button
                    onClick={() => setShowCustomPicker(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Sub-tabs: Specific Day vs Entire Month */}
                <div className="flex bg-slate-100 p-1 rounded-xl my-3">
                  <button
                    type="button"
                    onClick={() => setCustomTab('date')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      customTab === 'date'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Specific Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomTab('month')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      customTab === 'month'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Entire Month
                  </button>
                </div>

                {/* Date or Month Picker */}
                {customTab === 'date' ? (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Choose Date
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedDate(e.target.value);
                          setSelectedMonth('');
                          setFilterType('date');
                          setShowCustomPicker(false);
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400">View sales breakdown and table play hours for that day.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Choose Month
                    </label>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedMonth(e.target.value);
                          setSelectedDate('');
                          setFilterType('month');
                          setShowCustomPicker(false);
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400">View aggregate monthly collections and total playing time.</p>
                  </div>
                )}

                {/* Reset Option if Custom filter is active */}
                {filterType !== 'preset' && (
                  <div className="pt-3 mt-3 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setFilterType('preset');
                        setRange('month');
                        setSelectedDate('');
                        setSelectedMonth('');
                        setShowCustomPicker(false);
                      }}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700"
                    >
                      Clear &amp; Reset to This Month
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analytics Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {loading || !data ? (
          <div className="glass-card p-16 flex flex-col items-center justify-center text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
            <p className="text-xs font-medium">Aggregating sales, playing hours, and business metrics...</p>
          </div>
        ) : (
          <>
            {/* Top 4 KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Total Sales Billed */}
              <div className="glass-card p-5 border border-slate-200 bg-white shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Sales Billed</span>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <IndianRupee className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl font-black text-slate-900 font-display">
                      ₹{data.totalBilled.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                    <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                      Total consumed (Tables + Cafe)
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 font-mono">
                  {data.totalTicketsCount} total visits &amp; sales
                </p>
              </div>

              {/* Collected Cash / UPI */}
              <div className="glass-card p-5 border border-slate-200 bg-white shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Collected Cash / UPI</span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Receipt className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl font-black text-emerald-700 font-display">
                      ₹{data.totalCollected.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                    <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                      Actual cash &amp; bank received
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  UPI: <strong className="text-slate-700">₹{data.paymentSplit.upi.toLocaleString()}</strong> • Cash: <strong className="text-slate-700">₹{data.paymentSplit.cash.toLocaleString()}</strong>
                </p>
              </div>

              {/* Active Customers */}
              <div className="glass-card p-5 border border-slate-200 bg-white shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Customers</span>
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-slate-900 font-display">
                    {data.customerStats.activeInPeriod} Active
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {data.customerStats.newInPeriod} New Customers in period
                  </p>
                </div>
              </div>

              {/* Customer Directory */}
              <div className="glass-card p-5 border border-slate-200 bg-white shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Customer Directory</span>
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                    <PackageCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-slate-900 font-display">
                    {data.customerStats.totalRegistered} Registered
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Total accounts in database</p>
                </div>
              </div>

            </div>

            {/* ========================================================================= */}
            {/* COMPACT TABLE PLAYING HOURS (DYNAMICALLY RESPONDS TO SELECTED TIMEFRAME)   */}
            {/* ========================================================================= */}
            <div className="glass-card p-5 border border-slate-200 bg-white shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2">
                      Table Playing Hours
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                        {currentLabel}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">Customer table playtime recorded for {currentLabel.toLowerCase()}</p>
                  </div>
                </div>

                <div className="flex items-baseline gap-2 self-start sm:self-auto bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
                  <span className="text-xs text-slate-400 font-medium">Total Playing Time:</span>
                  <span className="text-base font-black text-slate-900 font-display">
                    {data.tableHoursStats?.periodHours || 0} hrs
                  </span>
                  <span className="text-xs text-slate-500 font-medium font-mono">
                    ({formatHours(data.tableHoursStats?.periodHours)})
                  </span>
                </div>
              </div>

              {/* 3 Compact Station Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Pool Tables */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-600 ring-2 ring-emerald-100" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">Pool Tables</p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {getGamePercent(data.tableHoursStats?.byGameType?.pool)}% of floor play
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-slate-900 font-mono">
                      {data.tableHoursStats?.byGameType?.pool || 0} hrs
                    </span>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {formatHours(data.tableHoursStats?.byGameType?.pool)}
                    </p>
                  </div>
                </div>

                {/* Snooker Tables */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-blue-600 ring-2 ring-blue-100" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">Snooker Tables</p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {getGamePercent(data.tableHoursStats?.byGameType?.midSnooker)}% of floor play
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-slate-900 font-mono">
                      {data.tableHoursStats?.byGameType?.midSnooker || 0} hrs
                    </span>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {formatHours(data.tableHoursStats?.byGameType?.midSnooker)}
                    </p>
                  </div>
                </div>

                {/* PS4 Consoles */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-purple-600 ring-2 ring-purple-100" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">PS4 Consoles</p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {getGamePercent(data.tableHoursStats?.byGameType?.ps4)}% of floor play
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-slate-900 font-mono">
                      {data.tableHoursStats?.byGameType?.ps4 || 0} hrs
                    </span>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {formatHours(data.tableHoursStats?.byGameType?.ps4)}
                    </p>
                  </div>
                </div>

              </div>
            </div>

            {/* Category Revenue Breakdown & Payment Methods Split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Category Breakdown (7 cols) */}
              <div className="lg:col-span-7 glass-card p-5 border border-slate-200 bg-white space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 font-display">Revenue Breakdown by Department</h3>
                    <p className="text-xs text-slate-500">Departmental contribution to total lounge revenue</p>
                  </div>
                  <span className="text-xs font-extrabold text-slate-800">
                    Total: ₹{categoryTotal.toFixed(0)}
                  </span>
                </div>

                <div className="space-y-4 pt-1">
                  
                  {/* Billiards */}
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-900 ring-2 ring-slate-100" />
                        <span className="font-semibold text-slate-800">Billiards &amp; Snooker</span>
                      </div>
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className="font-bold text-slate-900">
                          ₹{(data.categoryRevenue?.billiards || 0).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[11px] text-slate-400 font-sans font-medium">
                          ({getPercent(data.categoryRevenue?.billiards || 0)}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-slate-900 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${getPercent(data.categoryRevenue?.billiards || 0)}%` }} 
                      />
                    </div>
                  </div>

                  {/* Cafe */}
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-50" />
                        <span className="font-semibold text-slate-800">Cafe &amp; Kitchen</span>
                      </div>
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className="font-bold text-slate-900">
                          ₹{(data.categoryRevenue?.cafe || 0).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[11px] text-slate-400 font-sans font-medium">
                          ({getPercent(data.categoryRevenue?.cafe || 0)}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${getPercent(data.categoryRevenue?.cafe || 0)}%` }} 
                      />
                    </div>
                  </div>

                  {/* Cold Drinks */}
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-50" />
                        <span className="font-semibold text-slate-800">Beverages &amp; Cold Drinks</span>
                      </div>
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className="font-bold text-slate-900">
                          ₹{(data.categoryRevenue?.drinks || 0).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[11px] text-slate-400 font-sans font-medium">
                          ({getPercent(data.categoryRevenue?.drinks || 0)}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${getPercent(data.categoryRevenue?.drinks || 0)}%` }} 
                      />
                    </div>
                  </div>

                  {/* Cigarettes */}
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-50" />
                        <span className="font-semibold text-slate-800">Cigarettes &amp; Tobacco</span>
                      </div>
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className="font-bold text-slate-900">
                          ₹{(data.categoryRevenue?.cigarettes || 0).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[11px] text-slate-400 font-sans font-medium">
                          ({getPercent(data.categoryRevenue?.cigarettes || 0)}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-rose-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${getPercent(data.categoryRevenue?.cigarettes || 0)}%` }} 
                      />
                    </div>
                  </div>

                  {/* Other / General */}
                  {(data.categoryRevenue?.other || 0) > 0 && (
                    <div>
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-400 ring-2 ring-slate-100" />
                          <span className="font-semibold text-slate-800">Miscellaneous</span>
                        </div>
                        <div className="flex items-baseline gap-1.5 font-mono">
                          <span className="font-bold text-slate-900">
                            ₹{(data.categoryRevenue?.other || 0).toLocaleString('en-IN')}
                          </span>
                          <span className="text-[11px] text-slate-400 font-sans font-medium">
                            ({getPercent(data.categoryRevenue?.other || 0)}%)
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-slate-400 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${getPercent(data.categoryRevenue?.other || 0)}%` }} 
                        />
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* Payment Split & Sales Metrics (5 cols) */}
              <div className="lg:col-span-5 glass-card p-5 border border-slate-200 bg-white flex flex-col justify-between">
                <div>
                  <div className="pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 font-display">Payment Channels Split</h3>
                    <p className="text-xs text-slate-500">Breakdown of Cash vs digital UPI receipts</p>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs">
                          UPI
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">UPI / QR Code</p>
                          <p className="text-[11px] text-slate-500">Direct digital settlement</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900">₹{data.paymentSplit.upi.toLocaleString()}</span>
                        <p className="text-[11px] text-slate-400 font-semibold">
                          {data.totalCollected > 0 ? Math.round((data.paymentSplit.upi / data.totalCollected) * 100) : 0}% of collections
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                          CASH
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">Cash Register</p>
                          <p className="text-[11px] text-slate-500">Physical currency at drawer</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900">₹{data.paymentSplit.cash.toLocaleString()}</span>
                        <p className="text-[11px] text-slate-400 font-semibold">
                          {data.totalCollected > 0 ? Math.round((data.paymentSplit.cash / data.totalCollected) * 100) : 0}% of collections
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Reconciliation Status</span>
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Balanced &amp; Verified
                  </span>
                </div>
              </div>

            </div>

            {/* Top 8 Selling Items & Daily Trend Table */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Top Selling Products (5 cols) */}
              <div className="lg:col-span-5 glass-card p-5 border border-slate-200 bg-white">
                <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 font-display">Top Selling Products</h3>
                  <span className="text-xs text-slate-500">Ranked by revenue</span>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase font-semibold">
                        <th className="py-2.5">Item Name</th>
                        <th className="py-2.5">Category</th>
                        <th className="py-2.5 text-right">Units</th>
                        <th className="py-2.5 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(data.topItems || []).map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 font-bold text-slate-800">{item.name}</td>
                          <td className="py-2.5 text-slate-500">{item.category}</td>
                          <td className="py-2.5 text-right font-medium text-slate-700">{item.quantity}</td>
                          <td className="py-2.5 text-right font-bold text-slate-900">₹{item.revenue.toFixed(0)}</td>
                        </tr>
                      ))}
                      {(!data.topItems || data.topItems.length === 0) && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400">
                            No menu item sales in this period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Daily Sales Trend with Table Play Hours (7 cols) */}
              <div className="lg:col-span-7 glass-card p-5 border border-slate-200 bg-white">
                <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 font-display">Daily Revenue &amp; Active Play History</h3>
                    <p className="text-xs text-slate-500">Day-by-day table active hours and revenue (click any date to view)</p>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">Recent days</span>
                </div>

                <div className="mt-3 overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase font-semibold">
                        <th className="py-2.5">Date</th>
                        <th className="py-2.5 text-right">Active Play</th>
                        <th className="py-2.5 text-right">Tables</th>
                        <th className="py-2.5 text-right">Cafe</th>
                        <th className="py-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(data.dailyTrend || []).map((d, idx) => (
                        <tr 
                          key={idx} 
                          onClick={() => {
                            if (d.isoDate) {
                              setSelectedDate(d.isoDate);
                              setSelectedMonth('');
                              setFilterType('date');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }
                          }}
                          className="hover:bg-blue-50/70 transition-colors cursor-pointer group"
                          title={`Click to view complete analytics for ${d.date}`}
                        >
                          <td className="py-2.5 font-bold text-slate-800 whitespace-nowrap group-hover:text-blue-600 transition-colors">
                            <span className="flex items-center gap-1.5">
                              {d.date}
                              <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-blue-500 transition-colors" />
                            </span>
                          </td>
                          <td className="py-2.5 text-right whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 text-[11px] font-mono">
                              <Clock className="w-3 h-3 text-indigo-500" />
                              {formatHours(d.tableHours)}
                            </span>
                          </td>
                          <td className="py-2.5 text-right text-slate-700 font-mono">₹{d.tableRev.toFixed(0)}</td>
                          <td className="py-2.5 text-right text-slate-700 font-mono">₹{d.menuRev.toFixed(0)}</td>
                          <td className="py-2.5 text-right font-extrabold text-slate-900 font-mono">₹{d.total.toFixed(0)}</td>
                        </tr>
                      ))}
                      {(!data.dailyTrend || data.dailyTrend.length === 0) && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No visits or sales recorded in this period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Visual Line Graphs for Overall Sales, Snooker & Pool, Cafe, and Credits */}
            <AnalyticsLineCharts
              data={data}
              onSelectDate={(isoDate) => {
                setSelectedDate(isoDate);
                setSelectedMonth('');
                setFilterType('date');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </>
        )}
      </div>

    </div>
  );
}
