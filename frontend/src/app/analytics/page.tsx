'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { Navbar } from '../../components/Navbar';
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
  ChevronRight
} from 'lucide-react';

interface AnalyticsData {
  range: string;
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
  topItems: {
    name: string;
    category: string;
    quantity: number;
    revenue: number;
  }[];
  dailyTrend: {
    date: string;
    tableRev: number;
    menuRev: number;
    total: number;
    tickets: number;
  }[];
  totalTicketsCount: number;
}

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [range, setRange] = useState<'today' | '7days' | 'month' | '30days'>('30days');
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
      const res = await api.get(`/dashboard/analytics?range=${range}`);
      setData(res);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [range]);

  const categoryTotal = data ? (
    data.categoryRevenue.billiards +
    data.categoryRevenue.cafe +
    data.categoryRevenue.drinks +
    data.categoryRevenue.cigarettes +
    data.categoryRevenue.other
  ) : 1;

  const getPercent = (amount: number) => {
    if (!categoryTotal || categoryTotal === 0) return 0;
    return Math.round((amount / categoryTotal) * 100);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar />

      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                Business & Sales Analytics
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  ERP Intelligence
                </span>
              </h1>
              <p className="text-xs text-slate-500">Revenue breakdown by category, customer retention metrics & item sales analysis</p>
            </div>
          </div>

          {/* Time Range Filter Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
            {[
              { id: 'today', label: 'Today' },
              { id: '7days', label: '7 Days' },
              { id: 'month', label: 'This Month' },
              { id: '30days', label: 'Last 30 Days' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setRange(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  range === tab.id
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Analytics Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {loading || !data ? (
          <div className="glass-card p-16 flex flex-col items-center justify-center text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
            <p className="text-xs font-medium">Aggregating sales and business metrics...</p>
          </div>
        ) : (
          <>
            {/* Top 4 KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="glass-card p-5 border border-slate-200 bg-white">
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
                  <p className="text-[11px] text-slate-400 mt-0.5">Across {data.totalTicketsCount} total visits & sales</p>
                </div>
              </div>

              <div className="glass-card p-5 border border-slate-200 bg-white">
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
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    UPI: ₹{data.paymentSplit.upi.toLocaleString()} • Cash: ₹{data.paymentSplit.cash.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="glass-card p-5 border border-slate-200 bg-white">
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
                    {data.customerStats.newInPeriod} New Customers registered in period
                  </p>
                </div>
              </div>

              <div className="glass-card p-5 border border-slate-200 bg-white">
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

            {/* Category Revenue Breakdown & Payment Methods Split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Category Breakdown (7 cols) */}
              <div className="lg:col-span-7 glass-card p-5 border border-slate-200 bg-white space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 font-display">Revenue Breakdown by Department</h3>
                    <p className="text-xs text-slate-500">Distribution across Billiards, Cafe, Cold Drinks & Cigarettes</p>
                  </div>
                  <span className="text-xs font-extrabold text-slate-800">
                    Total: ₹{categoryTotal.toFixed(0)}
                  </span>
                </div>

                <div className="space-y-3.5 pt-1">
                  
                  {/* Billiards */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-800 flex items-center gap-1.5">
                        🎱 Billiards & Snooker Tables
                      </span>
                      <span className="font-bold text-slate-900">
                        ₹{data.categoryRevenue.billiards.toFixed(0)} ({getPercent(data.categoryRevenue.billiards)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-slate-900 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${getPercent(data.categoryRevenue.billiards)}%` }} 
                      />
                    </div>
                  </div>

                  {/* Cafe */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-800 flex items-center gap-1.5">
                        ☕ Cafe, Coffee & Food
                      </span>
                      <span className="font-bold text-slate-900">
                        ₹{data.categoryRevenue.cafe.toFixed(0)} ({getPercent(data.categoryRevenue.cafe)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-amber-600 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${getPercent(data.categoryRevenue.cafe)}%` }} 
                      />
                    </div>
                  </div>

                  {/* Cold Drinks */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-800 flex items-center gap-1.5">
                        🥤 Cold Drinks & Energy Drinks (Red Bull, Coke)
                      </span>
                      <span className="font-bold text-slate-900">
                        ₹{data.categoryRevenue.drinks.toFixed(0)} ({getPercent(data.categoryRevenue.drinks)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${getPercent(data.categoryRevenue.drinks)}%` }} 
                      />
                    </div>
                  </div>

                  {/* Cigarettes */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-800 flex items-center gap-1.5">
                        🚬 Cigarettes & Smokes
                      </span>
                      <span className="font-bold text-slate-900">
                        ₹{data.categoryRevenue.cigarettes.toFixed(0)} ({getPercent(data.categoryRevenue.cigarettes)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-rose-600 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${getPercent(data.categoryRevenue.cigarettes)}%` }} 
                      />
                    </div>
                  </div>

                  {/* Other / General */}
                  {data.categoryRevenue.other > 0 && (
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-800">Other General Items</span>
                        <span className="font-bold text-slate-900">
                          ₹{data.categoryRevenue.other.toFixed(0)} ({getPercent(data.categoryRevenue.other)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-slate-400 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${getPercent(data.categoryRevenue.other)}%` }} 
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
                    Balanced & Verified
                  </span>
                </div>
              </div>

            </div>

            {/* Top 8 Selling Items & Daily Trend Table */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Top Selling Items (6 cols) */}
              <div className="lg:col-span-6 glass-card p-5 border border-slate-200 bg-white">
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
                      {data.topItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 font-bold text-slate-800">{item.name}</td>
                          <td className="py-2.5 text-slate-500">{item.category}</td>
                          <td className="py-2.5 text-right font-medium text-slate-700">{item.quantity}</td>
                          <td className="py-2.5 text-right font-bold text-slate-900">₹{item.revenue.toFixed(0)}</td>
                        </tr>
                      ))}
                      {data.topItems.length === 0 && (
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

              {/* Daily Sales Trend (6 cols) */}
              <div className="lg:col-span-6 glass-card p-5 border border-slate-200 bg-white">
                <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 font-display">Daily Revenue History</h3>
                  <span className="text-xs text-slate-500">Recent days breakdown</span>
                </div>

                <div className="mt-3 overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase font-semibold">
                        <th className="py-2.5">Date</th>
                        <th className="py-2.5 text-right">Visits</th>
                        <th className="py-2.5 text-right">Tables</th>
                        <th className="py-2.5 text-right">Cafe</th>
                        <th className="py-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.dailyTrend.map((d, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 font-bold text-slate-800">{d.date}</td>
                          <td className="py-2.5 text-right text-slate-500">{d.tickets}</td>
                          <td className="py-2.5 text-right text-slate-700">₹{d.tableRev.toFixed(0)}</td>
                          <td className="py-2.5 text-right text-slate-700">₹{d.menuRev.toFixed(0)}</td>
                          <td className="py-2.5 text-right font-extrabold text-slate-900">₹{d.total.toFixed(0)}</td>
                        </tr>
                      ))}
                      {data.dailyTrend.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No visits recorded in this period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </>
        )}
      </div>

    </div>
  );
}
