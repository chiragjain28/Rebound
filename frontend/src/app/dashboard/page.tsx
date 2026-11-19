'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { api } from '../../lib/api';
import { Table, TableBooking } from '../../types';
import { BookTableModal } from '../../components/BookTableModal';
import { QuickSaleModal } from '../../components/QuickSaleModal';
import { RegisterCustomerModal } from '../../components/RegisterCustomerModal';
import { AssignTableModal } from '../../components/AssignTableModal';
import { AddOrderModal } from '../../components/AddOrderModal';
import {
  Pencil,
  Trash2,
  Calendar, 
  RefreshCw,
  X,
  Gamepad2,
  Search,
  Sparkles,
  User,
  UserPlus,
  ArrowRight,
  Eye,
  Clock,
  Coffee,
  CheckCircle2,
  StopCircle,
  Phone,
  Activity,
  Layers,
  CircleDot
} from 'lucide-react';

interface ActivePlayInfo {
  id: number;
  visitId: string;
  tableId: number | null;
  gameType: string;
  stationName: string;
  tableNumber?: number;
  startTime: string;
  durationStr: string;
  elapsedMinutes: number;
  runningCost: number;
  ratePerHour: number;
  customerName: string;
  customerPhone: string;
  customerId?: number;
  currentCreditDue: number;
  ordersCount: number;
  orders: any[];
}

export default function DashboardPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();

  // Core component states
  const [tables, setTables] = useState<Table[]>([]);
  const [activePlays, setActivePlays] = useState<ActivePlayInfo[]>([]);
  const [bookings, setBookings] = useState<TableBooking[]>([]);

  // Group floor tables by Game Type so multiple tables (e.g. MidSnooker 1, MidSnooker 2)
  // appear neatly organized within a single unified Game Type card.
  const gameGroups = useMemo(() => {
    const preferredOrder = ['Pool', 'MidSnooker', 'PS4'];
    const groupsMap = new Map<string, {
      gameType: string;
      ratePerHour: number;
      tables: Table[];
    }>();

    tables.forEach((t) => {
      const key = t.gameType || 'Other';
      if (!groupsMap.has(key)) {
        const defaultRate = key === 'MidSnooker' ? 220 : key === 'PS4' ? 80 : 160;
        groupsMap.set(key, {
          gameType: key,
          ratePerHour: t.ratePerHour || defaultRate,
          tables: []
        });
      }
      groupsMap.get(key)!.tables.push(t);
    });

    // Sort tables within each group by table number ascending
    groupsMap.forEach(group => {
      group.tables.sort((a, b) => a.number - b.number);
    });

    // Return groups ordered by preferred lounge order
    return Array.from(groupsMap.values()).sort((a, b) => {
      const idxA = preferredOrder.indexOf(a.gameType);
      const idxB = preferredOrder.indexOf(b.gameType);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.gameType.localeCompare(b.gameType);
    });
  }, [tables]);

  // Modals state
  const [showBookTable, setShowBookTable] = useState(false);
  const [showQuickSale, setShowQuickSale] = useState(false);
  const [showRegisterCustomer, setShowRegisterCustomer] = useState(false);
  const [selectedAssignTable, setSelectedAssignTable] = useState<Table | null>(null);
  const [orderVisitId, setOrderVisitId] = useState<string | null>(null);
  const [endingPlayId, setEndingPlayId] = useState<number | null>(null);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameRate, setRenameRate] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameError, setRenameError] = useState('');

  // Search state
  const [globalSearch, setGlobalSearch] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const globalSearchRef = useRef<HTMLInputElement>(null);

  // Live customer search
  useEffect(() => {
    const q = globalSearch.trim();
    if (!q) {
      setCustomerSearchResults([]);
      setIsSearchingCustomers(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingCustomers(true);
        const res = await api.get(`/customers?search=${encodeURIComponent(q)}`);
        setCustomerSearchResults(Array.isArray(res) ? res : []);
      } catch (err) {
        console.error('Customer search error:', err);
      } finally {
        setIsSearchingCustomers(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [globalSearch]);

  const [loadingData, setLoadingData] = useState(true);

  // Purge any legacy browser session cache on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rebound_dashboard_cache');
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !token) {
      router.push('/login');
    }
  }, [token, authLoading, router]);

  const fetchData = async () => {
    if (!token) return;
    try {
      setLoadingData(true);
      const dashboard = await api.get('/dashboard');

      setTables(dashboard.tables || []);
      setActivePlays(dashboard.activePlays || []);
      setBookings(dashboard.bookings || []);
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchDataTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDataDebounced = () => {
    if (fetchDataTimeoutRef.current) {
      clearTimeout(fetchDataTimeoutRef.current);
    }
    fetchDataTimeoutRef.current = setTimeout(() => {
      fetchData();
    }, 300);
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh timer every 30 seconds for live table elapsed time
    const interval = setInterval(() => {
      fetchData();
    }, 30000);

    return () => {
      clearInterval(interval);
      if (fetchDataTimeoutRef.current) {
        clearTimeout(fetchDataTimeoutRef.current);
      }
    };
  }, [token]);

  useWebSocket(() => {
    fetchDataDebounced();
  });

  const handleDeleteBooking = async (id: number) => {
    try {
      await api.delete(`/bookings/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete booking');
    }
  };

  const handleStartRenameTable = (table: Table) => {
    if (table.status === 'occupied') {
      alert(`Cannot modify "${table.name || `${table.gameType} Table ${table.number}`}" while a game is actively running on it.`);
      return;
    }
    setEditingTable(table);
    const defaultLabel = table.gameType === 'PS4' ? `Station ${table.number}` : `Table ${table.number}`;
    setRenameValue(table.name || defaultLabel);
    const defaultRate = table.gameType === 'MidSnooker' ? 220 : table.gameType === 'PS4' ? 80 : 160;
    setRenameRate(table.ratePerHour ? String(table.ratePerHour) : String(defaultRate));
    setRenameError('');
  };

  const handleSaveRenameTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable) return;
    setRenameLoading(true);
    setRenameError('');
    try {
      const trimmed = renameValue.trim();
      const parsedRate = renameRate ? parseFloat(renameRate) : null;
      await api.patch(`/tables/${editingTable.id}`, {
        name: trimmed,
        ratePerHour: parsedRate
      });
      setEditingTable(null);
      fetchData();
    } catch (err: any) {
      setRenameError(err.message || 'Failed to update table');
    } finally {
      setRenameLoading(false);
    }
  };

  const handleDeleteTable = async (table: Table) => {
    const displayName = table.name || (table.gameType === 'PS4' ? `Station ${table.number}` : `Table ${table.number}`);
    if (!confirm(`Are you sure you want to permanently delete "${displayName}" (${table.gameType}) from the database?`)) {
      return;
    }
    try {
      await api.delete(`/tables/${table.id}`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete table');
    }
  };

  const handleEndTablePlay = async (play: ActivePlayInfo) => {
    if (!confirm(`Finish game for ${play.customerName} on ${play.stationName}?`)) {
      return;
    }
    try {
      setEndingPlayId(play.id);
      await api.post(`/visits/${play.visitId}/table/end`, {
        tablePlayId: play.id,
        endTime: new Date().toISOString()
      });
      fetchData();
      // Redirect directly to customer's account page to complete payment
      router.push(`/customers?phone=${encodeURIComponent(play.customerPhone || play.customerName)}`);
    } catch (err: any) {
      alert(err.message || 'Failed to end table play');
    } finally {
      setEndingPlayId(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-700"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 font-sans">

      {/* Bookings Marquee Banner */}
      {bookings.length > 0 && (
        <div className="w-full bg-rose-50 text-rose-900 overflow-hidden relative shadow-xs border-b border-rose-200 group/marquee">
          <div className="absolute left-0 top-0 bottom-0 bg-rose-100 text-rose-900 font-bold text-[11px] tracking-wider uppercase px-4 flex items-center border-r border-rose-200 z-10 font-display">
            <Calendar className="h-3.5 w-3.5 mr-1.5 text-rose-600" />
            Upcoming Bookings
          </div>
          <style>{`
            @keyframes marquee-scroll {
              0% { transform: translateX(100vw); }
              100% { transform: translateX(-100%); }
            }
            .animate-marquee-scroll {
              animation: marquee-scroll 16s linear infinite;
              white-space: nowrap;
              will-change: transform;
            }
            .group\\/marquee:hover .animate-marquee-scroll {
              animation-play-state: paused;
            }
          `}</style>
          <div className="animate-marquee-scroll py-2 inline-flex items-center gap-14 pr-14">
            {bookings.map(b => (
              <span key={b.id} className="inline-flex items-center gap-2">
                <span className="bg-white text-rose-800 px-2.5 py-0.5 rounded-lg text-[10px] uppercase font-bold border border-rose-200 shadow-2xs">
                  {b.table?.gameType ? `${b.table.gameType} Table` : 'Table'} {b.table?.number || b.tableId}
                </span>
                <span className="font-bold text-xs text-slate-900">{b.customerName}</span>
                <span className="text-slate-500 font-mono text-xs">
                  {new Date(b.bookingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  onClick={() => handleDeleteBooking(b.id)}
                  title="Cancel Booking"
                  className="ml-1 p-0.5 hover:bg-rose-200 rounded-full text-rose-600 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        
        {/* ========================================================================= */}
        {/* SIMPLE SEARCH & ACTION BAR                                               */}
        {/* ========================================================================= */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-base font-extrabold text-slate-900 font-display tracking-tight">
                Customer Search & Floor Control
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Search customer to open account, manage running table, or log a sale
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowQuickSale(true)}
                className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-all gap-1.5 cursor-pointer active:scale-95"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Quick Sale</span>
              </button>

              <button
                onClick={() => setShowRegisterCustomer(true)}
                className="inline-flex items-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all gap-1.5 cursor-pointer active:scale-95"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Register Customer</span>
              </button>

              <button
                onClick={() => setShowBookTable(true)}
                className="inline-flex items-center px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all gap-1.5 cursor-pointer active:scale-95"
              >
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                <span>Book Table</span>
              </button>
            </div>
          </div>

          {/* Clean Search Input */}
          <div className="relative">
            <div className="relative flex items-center bg-slate-50 hover:bg-white focus-within:bg-white rounded-xl border border-slate-200 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/10 px-3.5 py-2.5 gap-2.5 transition-all">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                ref={globalSearchRef}
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search customer by name or phone number..."
                className="flex-1 bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none font-bold"
              />
              {isSearchingCustomers && (
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400 shrink-0" />
              )}
              {globalSearch && (
                <button
                  onClick={() => {
                    setGlobalSearch('');
                    setCustomerSearchResults([]);
                  }}
                  className="text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Clean Search Results Dropdown (NO lifetime spend, NO bottom search link) */}
            {globalSearch.trim() && (() => {
              const hasRegistered = customerSearchResults.length > 0;

              return (
                <div className="absolute top-full left-0 right-0 mt-2 z-40 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in max-h-[420px] overflow-y-auto">
                  <div className="p-3">
                    {hasRegistered ? (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 px-1 font-mono">
                          Found {customerSearchResults.length} Customer{customerSearchResults.length > 1 ? 's' : ''}
                        </span>

                        {customerSearchResults.map((c) => {
                          const hasDebt = (c.currentCreditDue || 0) > 0;
                          return (
                            <div
                              key={c.id || c.phone}
                              onClick={() => {
                                router.push(`/customers?phone=${encodeURIComponent(c.phone)}`);
                                setGlobalSearch('');
                              }}
                              className="p-3 rounded-xl hover:bg-slate-50 cursor-pointer flex items-center justify-between border border-slate-100 hover:border-slate-200 transition-all group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs group-hover:scale-105 transition-transform font-display">
                                  {c.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-xs text-slate-900">{c.name}</p>
                                    {hasDebt && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                                        Due: ₹{c.currentCreditDue.toFixed(0)}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
                                    <Phone className="w-3 h-3 text-slate-400" />
                                    <span>{c.phone}</span>
                                  </p>
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="text-xs font-bold text-slate-700 group-hover:text-blue-600 flex items-center gap-1 transition-colors">
                                  <span>Open Profile</span>
                                  <ArrowRight className="h-3 w-3" />
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : !isSearchingCustomers ? (
                      <div className="py-6 text-center text-slate-500 text-xs">
                        No registered customer found matching &ldquo;{globalSearch}&rdquo;
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CURRENTLY PLAYING CARDS (POOL, SNOOKER, PS4)                              */}
        {/* ========================================================================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 font-display uppercase tracking-wide flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span>Currently Playing ({activePlays.length} Active Players)</span>
            </h2>
            {loadingData && <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          </div>

          {activePlays.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
              <Gamepad2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">No tables currently in play</p>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Assign a player to Pool, Snooker, or PS4 below to start a game.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activePlays.map((play) => {
                const isPool = play.gameType === 'Pool';
                const isSnooker = play.gameType === 'MidSnooker';
                const isPS4 = play.gameType === 'PS4';

                return (
                  <div
                    key={play.id}
                    className="bg-white rounded-2xl border-2 border-blue-200/80 hover:border-blue-400 shadow-xs hover:shadow-md transition-all p-4 flex flex-col justify-between space-y-3"
                  >
                    <div>
                      {/* Top Bar: Station badge & live duration */}
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                        <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border uppercase tracking-wider flex items-center gap-1.5 ${
                          isSnooker
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : isPS4
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isSnooker ? 'bg-purple-600' : isPS4 ? 'bg-indigo-600' : 'bg-blue-600'
                          }`} />
                          {play.stationName}
                        </span>

                        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                          <span>{play.durationStr}</span>
                        </div>
                      </div>

                      {/* Customer Info */}
                      <div className="pt-2.5 flex items-start justify-between gap-2">
                        <div>
                          <h3 
                            onClick={() => router.push(`/customers?phone=${encodeURIComponent(play.customerPhone || play.customerName)}`)}
                            className="font-extrabold text-sm text-slate-900 hover:text-blue-600 cursor-pointer flex items-center gap-1.5 font-display"
                          >
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            <span>{play.customerName}</span>
                          </h3>
                          {play.customerPhone && (
                            <p className="text-[11px] text-slate-400 font-mono pl-5">
                              {play.customerPhone}
                            </p>
                          )}
                        </div>

                        {play.currentCreditDue > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                            Outstanding Due: ₹{play.currentCreditDue}
                          </span>
                        )}
                      </div>

                      {/* Running charges preview */}
                      <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Running Table Bill:</span>
                        <span className="font-extrabold text-slate-900 font-mono">
                          ₹{play.runningCost.toFixed(0)} <span className="text-[10px] text-slate-400 font-normal">(@ ₹{play.ratePerHour}/hr)</span>
                        </span>
                      </div>

                      {/* Cafe items count if ordered */}
                      {play.ordersCount > 0 && (
                        <p className="mt-1.5 text-[11px] text-slate-600 font-medium flex items-center gap-1 px-1">
                          <Coffee className="w-3 h-3 text-slate-400" />
                          <span>{play.ordersCount} cafe items attached</span>
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5">
                      <button
                        onClick={() => setOrderVisitId(play.visitId)}
                        className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        title="Add cafe drinks or snacks"
                      >
                        <Coffee className="w-3 h-3 text-slate-500" />
                        <span>Order</span>
                      </button>

                      <button
                        onClick={() => router.push(`/customers?phone=${encodeURIComponent(play.customerPhone || play.customerName)}`)}
                        className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center justify-center cursor-pointer"
                        title="Open customer detailed account"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleEndTablePlay(play)}
                        disabled={endingPlayId === play.id}
                        className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <StopCircle className="w-3 h-3 text-rose-400" />
                        <span>{endingPlayId === play.id ? 'Finishing...' : 'End Game'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* FLOOR STATIONS & AVAILABILITY GRID (POOL, SNOOKER, PS4)                  */}
        {/* ========================================================================= */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 font-display uppercase tracking-wide flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-700" />
              <span>Floor Stations & Readiness ({tables.length} Stations in {gameGroups.length} Categories)</span>
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {tables.filter(t => t.status === 'available').length} Available
              </span>
              <span className="flex items-center gap-1.5 text-blue-700 font-semibold">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                {tables.filter(t => t.status === 'occupied').length} Occupied
              </span>
            </div>
          </div>

          {gameGroups.length === 0 ? (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
              <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">No floor stations created yet</p>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Use the &apos;+ Add Table&apos; button in the navigation bar to configure lounge stations.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {gameGroups.map((group) => {
                const totalCount = group.tables.length;
                const availableCount = group.tables.filter((t) => t.status === 'available').length;
                const isSnooker = group.gameType === 'MidSnooker';
                const isPS4 = group.gameType === 'PS4';

                // Human-readable game label with clean spacing
                const gameLabel = group.gameType === 'MidSnooker'
                  ? 'Mid Snooker'
                  : group.gameType === 'PS4'
                  ? 'PlayStation 4'
                  : group.gameType;

                // Rate calculation across tables in this group
                const tableRates = group.tables.map(t => t.ratePerHour || group.ratePerHour).filter(Boolean);
                const minRate = tableRates.length ? Math.min(...tableRates) : group.ratePerHour;
                const maxRate = tableRates.length ? Math.max(...tableRates) : group.ratePerHour;
                const rateDisplay = minRate === maxRate ? `₹${minRate}/hr` : `₹${minRate} - ₹${maxRate}/hr`;

                return (
                  <div
                    key={group.gameType}
                    className="bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                  >
                    {/* Game Type Header */}
                    <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm border shadow-2xs shrink-0 ${
                            isSnooker
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : isPS4
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {isPS4 ? (
                            <Gamepad2 className="w-5 h-5" />
                          ) : isSnooker ? (
                            <Layers className="w-5 h-5" />
                          ) : (
                            <CircleDot className="w-5 h-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-base font-extrabold text-slate-900 font-display truncate">
                            {gameLabel}
                          </h4>
                          <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500 font-medium mt-0.5">
                            <span className="font-bold text-slate-700 font-mono">{rateDisplay}</span>
                            <span className="text-slate-300">•</span>
                            <span className="whitespace-nowrap">
                              {totalCount} {totalCount === 1 ? (isPS4 ? 'Station' : 'Table') : (isPS4 ? 'Stations' : 'Tables')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Availability status badge */}
                      <div className="shrink-0 pt-0.5">
                        {availableCount === totalCount ? (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/90 flex items-center gap-1.5 whitespace-nowrap shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                            All Free ({totalCount})
                          </span>
                        ) : availableCount === 0 ? (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/90 flex items-center gap-1.5 whitespace-nowrap shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                            All Full ({totalCount})
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/90 flex items-center gap-1.5 whitespace-nowrap shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                            {availableCount}/{totalCount} Free
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tables included in this Game Type card */}
                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-start">
                      {group.tables.map((table) => {
                        const isOccupied = table.status === 'occupied';
                        const activePlay = activePlays.find((p) => p.tableId === table.id);
                        const tableDisplayName = table.name || (isPS4 ? `Station ${table.number}` : `Table ${table.number}`);
                        const hasCustomRate = table.ratePerHour && table.ratePerHour !== group.ratePerHour;
                        const currentRate = table.ratePerHour || group.ratePerHour;

                        return (
                          <div
                            key={table.id}
                            className={`p-3.5 rounded-xl border transition-all ${
                              isOccupied
                                ? 'bg-blue-50/60 border-blue-200 shadow-2xs'
                                : 'bg-slate-50/70 border-slate-200/90 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {/* Primary Row: Table Name & Availability Status */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="font-extrabold text-sm text-slate-900 font-display truncate" title={tableDisplayName}>
                                  {tableDisplayName}
                                </span>
                                {table.name && (
                                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                    (#{table.number})
                                  </span>
                                )}
                              </div>

                              <span
                                className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${
                                  isOccupied
                                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                                    : 'bg-emerald-100/70 text-emerald-800 border-emerald-200'
                                }`}
                              >
                                {isOccupied ? 'Occupied' : 'Available'}
                              </span>
                            </div>

                            {/* Secondary Row: Rate & Action Buttons */}
                            <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs font-bold text-slate-700 font-mono">
                                  ₹{currentRate}/hr
                                </span>
                                {hasCustomRate ? (
                                  <span className="text-[9px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded-md shrink-0">
                                    Custom
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-medium shrink-0">
                                    Standard
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {!isOccupied ? (
                                  <>
                                    {/* Edit Name & Price Button */}
                                    <button
                                      onClick={() => handleStartRenameTable(table)}
                                      title="Edit Table Name & Price"
                                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Delete Button */}
                                    <button
                                      onClick={() => handleDeleteTable(table)}
                                      title="Delete table from database"
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                      onClick={() => setSelectedAssignTable(table)}
                                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-2xs hover:shadow-xs flex items-center gap-1 cursor-pointer active:scale-95 ml-1"
                                    >
                                      <span>+ Assign</span>
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 font-mono tracking-wider uppercase">
                                    In Play
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Active play info if occupied */}
                            {isOccupied && activePlay && (
                              <div className="mt-2.5 pt-2 border-t border-blue-100 flex items-center justify-between text-xs">
                                <button
                                  onClick={() =>
                                    router.push(
                                      `/customers?phone=${encodeURIComponent(
                                        activePlay.customerPhone || activePlay.customerName
                                      )}`
                                    )
                                  }
                                  className="font-bold text-slate-900 hover:text-blue-600 truncate pr-2 flex items-center gap-1.5 max-w-[65%]"
                                  title="Open customer profile"
                                >
                                  <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  <span className="truncate">{activePlay.customerName}</span>
                                </button>

                                <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md border border-blue-200/80 shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                                  <span>{activePlay.durationStr}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>

      {/* Modals */}
      {editingTable && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-sm shadow-xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-display">Edit Table Name & Price</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {editingTable.gameType} #{editingTable.number}
                </p>
              </div>
              <button
                onClick={() => setEditingTable(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRenameTable} className="p-5 space-y-4">
              {renameError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {renameError}
                </div>
              )}

              <div className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-1.5">
                    Custom Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    placeholder="e.g. VIP Pool, Corner Snooker, Star Table"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-slate-500 bg-white"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-1.5">
                    Hourly Price / Rate (₹/hr)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm font-mono text-slate-400">₹</span>
                    <input
                      type="number"
                      required
                      min="0"
                      step="10"
                      value={renameRate}
                      onChange={(e) => setRenameRate(e.target.value)}
                      placeholder="160"
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:outline-none focus:ring-1 focus:ring-slate-500 bg-white"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">
                    Time played on this table will be billed at this hourly rate.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTable(null)}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renameLoading || !renameValue.trim()}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
                >
                  {renameLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRegisterCustomer && (
        <RegisterCustomerModal
          onClose={() => setShowRegisterCustomer(false)}
          onSuccess={() => {
            setShowRegisterCustomer(false);
            fetchData();
          }}
        />
      )}

      {selectedAssignTable && (
        <AssignTableModal
          table={selectedAssignTable}
          onClose={() => setSelectedAssignTable(null)}
          onSuccess={() => {
            setSelectedAssignTable(null);
            fetchData();
          }}
        />
      )}

      {showQuickSale && (
        <QuickSaleModal 
          onClose={() => setShowQuickSale(false)}
          onSuccess={fetchData}
        />
      )}

      {showBookTable && (
        <BookTableModal
          tables={tables}
          onClose={() => setShowBookTable(false)}
          onSuccess={() => {
            setShowBookTable(false);
            fetchData();
          }}
        />
      )}

      {orderVisitId && (
        <AddOrderModal
          sessionId={orderVisitId}
          onClose={() => setOrderVisitId(null)}
          onSuccess={() => {
            setOrderVisitId(null);
            fetchData();
          }}
        />
      )}

    </div>
  );
}
