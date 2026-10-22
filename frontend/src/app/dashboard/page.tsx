'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { api } from '../../lib/api';
import { Table, Session, TableBooking } from '../../types';
import { Navbar } from '../../components/Navbar';
import { SessionCard } from '../../components/SessionCard';
import { NewSessionModal } from '../../components/NewSessionModal';
import { BookTableModal } from '../../components/BookTableModal';
import { AddOrderModal } from '../../components/AddOrderModal';
import { QuickSaleModal } from '../../components/QuickSaleModal';
import { SwitchTableModal } from '../../components/SwitchTableModal';
import { RegisterCustomerModal } from '../../components/RegisterCustomerModal';
import { AssignTableModal } from '../../components/AssignTableModal';
import { 
  Play, 
  Calendar, 
  RefreshCw,
  X,
  Coffee,
  Gamepad2,
  Eye,
  Lock,
  Unlock,
  Search,
  Sparkles,
  ArrowRightLeft,
  User,
  UserPlus
} from 'lucide-react';

export default function DashboardPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();

  // Component states
  const [tables, setTables] = useState<Table[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [bookings, setBookings] = useState<TableBooking[]>([]);
  const [salesToday, setSalesToday] = useState(0);

  // Modal controls
  const [showNewSession, setShowNewSession] = useState(false);
  const [showBookTable, setShowBookTable] = useState(false);
  const [showQuickSale, setShowQuickSale] = useState(false);
  const [showRegisterCustomer, setShowRegisterCustomer] = useState(false);
  const [selectedAssignTable, setSelectedAssignTable] = useState<Table | null>(null);
  const [showActiveDrawer, setShowActiveDrawer] = useState(false);
  const [activeOrderSessionId, setActiveOrderSessionId] = useState<string | null>(null);
  const [switchTableSession, setSwitchTableSession] = useState<Session | null>(null);

  const [liveSessionSearch, setLiveSessionSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const globalSearchRef = useRef<HTMLInputElement>(null);

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
    }, 200);

    return () => clearTimeout(timer);
  }, [globalSearch]);

  const [loadingData, setLoadingData] = useState(true);

  // Sales Today lock/flip card states
  const [isFlipped, setIsFlipped] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isUnlocked && isFlipped) {
      timer = setTimeout(() => {
        setIsUnlocked(false);
        setIsFlipped(false);
        setPasswordInput('');
        setPasswordError('');
      }, 30000);
    }
    return () => clearTimeout(timer);
  }, [isUnlocked, isFlipped]);

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput) {
      setPasswordError('Password required');
      return;
    }
    try {
      setVerifyingPassword(true);
      setPasswordError('');
      await api.post('/auth/verify-password', { password: passwordInput, username: user?.username });
      setIsUnlocked(true);
      setPasswordInput('');
    } catch (err: any) {
      setPasswordError(err.message || 'Incorrect password');
    } finally {
      setVerifyingPassword(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('rebound_dashboard_cache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.tables) setTables(parsed.tables);
          if (parsed.activeSessions) setActiveSessions(parsed.activeSessions);
          if (parsed.bookings) setBookings(parsed.bookings);
          if (typeof parsed.salesToday === 'number') setSalesToday(parsed.salesToday);
          setLoadingData(false);
        } catch (err) {
          console.error('Failed to parse dashboard cache:', err);
        }
      }
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
      const hasCache = localStorage.getItem('rebound_dashboard_cache') !== null;
      if (!hasCache) {
        setLoadingData(true);
      }
      
      const [dashboard, allBookings] = await Promise.all([
        api.get('/dashboard'),
        api.get('/bookings')
      ]);

      const fetchedTables = dashboard.tables || [];
      const fetchedActive = dashboard.activeSessions || [];
      const fetchedSales = dashboard.salesToday || 0;
      const fetchedBookings = allBookings || [];

      setTables(fetchedTables);
      setActiveSessions(fetchedActive);
      setSalesToday(fetchedSales);
      setBookings(fetchedBookings);

      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'rebound_dashboard_cache',
          JSON.stringify({
            tables: fetchedTables,
            activeSessions: fetchedActive,
            salesToday: fetchedSales,
            bookings: fetchedBookings
          })
        );
      }
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
    return () => {
      if (fetchDataTimeoutRef.current) {
        clearTimeout(fetchDataTimeoutRef.current);
      }
    };
  }, [token]);

  useWebSocket((message) => {
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

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-700"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 font-sans">
      <Navbar />

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
                  className="ml-1 p-0.5 hover:bg-rose-200 rounded-full text-rose-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        
        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Active Sessions Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex items-center justify-between h-[115px]">
            <div>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Active In-Lounge Players</p>
              <h2 className="text-3xl font-extrabold text-slate-900 mt-1 font-display">
                {activeSessions.length}
              </h2>
            </div>
            <button 
              onClick={() => setShowActiveDrawer(true)}
              className="bg-slate-100 hover:bg-slate-200 border border-slate-200 p-3 rounded-2xl text-slate-700 transition-all"
              title="View Live Sessions"
            >
              <Play className="h-5 w-5" />
            </button>
          </div>

          {/* Sales Today Flip Card */}
          <div className="flip-card h-[115px] w-full relative">
            <div className={`flip-card-inner ${isFlipped ? 'flipped' : ''}`}>
              <div 
                className="flip-card-front bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 flex items-center justify-between cursor-pointer select-none transition-all"
                onClick={() => {
                  setIsFlipped(true);
                  setPasswordError('');
                }}
              >
                <div>
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Today&apos;s Revenue</p>
                  <h2 className="text-2xl font-bold text-slate-300 mt-1 tracking-widest font-mono">
                    ••••••
                  </h2>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Click with password to reveal</p>
                </div>
                <div className="bg-slate-100 border border-slate-200 p-3 rounded-2xl text-slate-500">
                  <Lock className="h-5 w-5" />
                </div>
              </div>

              <div className="flip-card-back w-full h-full">
                {!isUnlocked ? (
                  <form 
                    onSubmit={handleVerifyPassword} 
                    className="bg-white p-3.5 rounded-2xl border border-slate-300 shadow-lg flex flex-col justify-between h-full select-none"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Staff Password</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          setIsFlipped(false);
                          setPasswordInput('');
                          setPasswordError('');
                        }} 
                        className="text-slate-400 hover:text-slate-700"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Password..."
                        className="block flex-1 rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                      <button
                        type="submit"
                        disabled={verifyingPassword}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-xs font-bold rounded-xl text-white shrink-0 disabled:opacity-50"
                      >
                        {verifyingPassword ? '...' : 'Unlock'}
                      </button>
                    </div>
                    {passwordError && (
                      <p className="text-[10px] text-rose-600 font-semibold truncate">{passwordError}</p>
                    )}
                  </form>
                ) : (
                  <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between h-full select-none">
                    <div>
                      <p className="text-[11px] text-emerald-700 font-bold uppercase tracking-wider">Today&apos;s Revenue</p>
                      <h2 className="text-2xl font-black text-emerald-700 mt-1 font-display">
                        ₹{salesToday.toFixed(2)}
                      </h2>
                    </div>
                    <button 
                      onClick={() => {
                        setIsUnlocked(false);
                        setIsFlipped(false);
                      }}
                      title="Lock Revenue Display"
                      className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      <Unlock className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Floor Tables Readiness Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex items-center justify-between h-[115px]">
            <div>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Floor Tables Readiness</p>
              <h2 className="text-2xl font-extrabold text-slate-900 mt-1 font-display">
                {tables.filter(t => t.status === 'occupied').length} <span className="text-sm font-semibold text-slate-500">/ {tables.length} in play</span>
              </h2>
              <p className="text-[10px] text-emerald-700 font-semibold mt-0.5 font-mono">
                {tables.filter(t => t.status !== 'occupied').length} Tables Available
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-2xl text-blue-700">
              <Gamepad2 className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Dashboard Actions Bar */}
        <div className="flex flex-wrap justify-between items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-bold text-slate-900 font-display uppercase tracking-wide">
              Floor Plan & Live Table Control
            </h2>
            {loadingData && <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQuickSale(true)}
              className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-all gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Instant Quick POS Sale</span>
            </button>

            <button
              onClick={() => setShowBookTable(true)}
              className="inline-flex items-center px-3.5 py-2 border border-slate-200 text-xs font-bold rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-all gap-1.5"
            >
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span>Book Table</span>
            </button>

            <button
              onClick={() => setShowRegisterCustomer(true)}
              className="inline-flex items-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-sm transition-all gap-1.5"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Register New Customer</span>
            </button>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative">
          <div className="relative flex items-center bg-white rounded-2xl border border-slate-200 shadow-xs px-4 py-2.5 gap-2.5 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-900/10 transition-all">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              ref={globalSearchRef}
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search customer by name (Tony, Ayush) or phone number (98765)..."
              className="flex-1 bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none font-semibold"
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
                className="text-slate-400 hover:text-slate-700 shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {globalSearch.trim() && (() => {
            const q = globalSearch.trim().toLowerCase();
            const matchedActive = activeSessions.filter(s => 
              s.customerName.toLowerCase().includes(q) || 
              (s.customerPhone && s.customerPhone.includes(q))
            );

            const hasActive = matchedActive.length > 0;
            const hasRegistered = customerSearchResults.length > 0;

            return (
              <div className="absolute top-full left-0 right-0 mt-2 z-40 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in max-h-[460px] overflow-y-auto">
                <div className="p-3 divide-y divide-slate-100">
                  
                  {/* Matching Registered Customers from Database */}
                  {hasRegistered && (
                    <div className="pb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2 font-mono">
                        Registered Permanent Customers ({customerSearchResults.length})
                      </span>
                      <div className="space-y-1.5">
                        {customerSearchResults.map((c) => {
                          const activePlaying = activeSessions.find(s => 
                            (s.customerPhone && s.customerPhone === c.phone) || 
                            s.customerName.toLowerCase() === c.name.toLowerCase()
                          );
                          return (
                            <div
                              key={c.id || c.phone}
                              onClick={() => {
                                router.push(`/customers?phone=${encodeURIComponent(c.phone)}`);
                                setGlobalSearch('');
                              }}
                              className="p-3 rounded-xl hover:bg-slate-50 cursor-pointer flex items-center justify-between border border-slate-100 transition-all group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs group-hover:scale-105 transition-transform">
                                  {c.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-xs text-slate-900">{c.name}</p>
                                    {activePlaying && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 border border-blue-200 animate-pulse">
                                        ● Live In Lounge
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                                    <span>📞 {c.phone}</span>
                                    <span>• Registered {new Date(c.createdAt).toLocaleDateString()}</span>
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900 flex items-center gap-1">
                                  Open Customer Page →
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Active In-Lounge Matches */}
                  {hasActive && (
                    <div className="py-2.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-2 font-mono">
                        Active Tickets on Floor ({matchedActive.length})
                      </span>
                      <div className="space-y-1.5">
                        {matchedActive.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => { router.push(`/sessions/${s.id}`); setGlobalSearch(''); }}
                            className="p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer flex justify-between items-center border border-slate-100"
                          >
                            <div>
                              <p className="font-bold text-xs text-slate-900">{s.customerName}</p>
                              <p className="text-[10px] text-slate-500 font-mono">Ticket {s.id} • {s.customerPhone || 'Walk-in'}</p>
                            </div>
                            <span className="font-bold text-xs text-emerald-700">₹{(s.totalBill || 0).toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No Results found notice */}
                  {!hasRegistered && !hasActive && !isSearchingCustomers && (
                    <div className="py-4 text-center">
                      <p className="text-xs text-slate-500">No registered customers found matching &ldquo;{globalSearch}&rdquo;</p>
                    </div>
                  )}

                  <div className="pt-2">
                    <div 
                      onClick={() => {
                        router.push(`/customers?search=${encodeURIComponent(globalSearch.trim())}`);
                        setGlobalSearch('');
                      }}
                      className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer flex items-center justify-between text-xs font-bold text-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-500" />
                        <span>Search &ldquo;{globalSearch.trim()}&rdquo; in Permanent Customer Directory</span>
                      </div>
                      <span className="text-[11px] text-emerald-700 font-mono">View Directory →</span>
                    </div>
                  </div>

                </div>
              </div>
            );
          })()}
        </div>

        {/* Live Visual Floor Plan Table Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Live Tables Status Floor Plan ({tables.length} Tables)
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {tables.map((table) => {
              const isOccupied = table.status === 'occupied';
              const occupiedSession = activeSessions.find(s => 
                s.tableId === table.id || s.tablePlays?.some(tp => !tp.endTime && tp.tableId === table.id)
              );

              return (
                <div
                  key={table.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between select-none ${
                    isOccupied
                      ? 'bg-blue-50/50 border-blue-200 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {table.gameType}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isOccupied
                          ? 'bg-blue-100 text-blue-800 border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {isOccupied ? 'Occupied' : 'Available'}
                      </span>
                    </div>

                    <h4 className="text-base font-extrabold text-slate-900 font-display mt-1">
                      Table {table.number}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {table.gameType || 'Pool'} · ₹{table.ratePerHour || (table.gameType === 'MidSnooker' ? 220 : 160)}/hr
                    </p>
                  </div>

                  {isOccupied && occupiedSession ? (
                    <div className="mt-4 pt-3 border-t border-blue-200/60 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <button
                          onClick={() => router.push(`/customers?phone=${encodeURIComponent(occupiedSession.customerPhone || occupiedSession.customerName)}`)}
                          className="font-bold text-slate-900 hover:text-blue-600 truncate pr-1 text-left flex items-center gap-1 group/name"
                        >
                          <span className="group-hover/name:underline">👤 {occupiedSession.customerName}</span>
                        </button>
                      </div>

                      <div className="flex gap-1.5 pt-1">
                        <button
                          onClick={() => setSwitchTableSession(occupiedSession)}
                          title="Transfer / Switch Table"
                          className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 shadow-2xs"
                        >
                          <ArrowRightLeft className="w-3 h-3 text-slate-500" /> Switch
                        </button>
                        <button
                          onClick={() => setActiveOrderSessionId(occupiedSession.id)}
                          title="+ Add Cafe Order"
                          className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 shadow-2xs"
                        >
                          <Coffee className="w-3 h-3 text-slate-500" /> + Order
                        </button>
                        <button
                          onClick={() => router.push(`/customers?phone=${encodeURIComponent(occupiedSession.customerPhone || occupiedSession.customerName)}`)}
                          title="Open Customer Page"
                          className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg flex items-center justify-center"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-[11px] text-slate-400 font-medium">Ready for play</span>
                      <button
                        onClick={() => setSelectedAssignTable(table)}
                        className="text-xs font-bold text-slate-900 hover:text-blue-600 flex items-center gap-1 transition-colors"
                      >
                        + Assign Table
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Active In-Lounge Sessions List */}
        <div>
          <h3 className="text-xs font-bold text-slate-600 mb-3 uppercase tracking-wider">
            Active Playing & Lounge Sessions ({activeSessions.length})
          </h3>
          
          {loadingData && activeSessions.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-white p-5 rounded-2xl border border-slate-200 animate-pulse space-y-3 h-[180px]">
                  <div className="h-5 w-24 bg-slate-100 rounded-lg"></div>
                  <div className="h-4 w-32 bg-slate-100 rounded-lg"></div>
                </div>
              ))}
            </div>
          ) : activeSessions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
              No active players in the lounge. Search a customer above, click <strong className="text-slate-900">&quot;Register New Customer&quot;</strong>, or use <strong className="text-emerald-700">&quot;Instant Quick POS Sale&quot;</strong> to begin.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onOrderAdded={fetchData}
                  onAddItemsClick={(sid) => setActiveOrderSessionId(sid)}
                />
              ))}
            </div>
          )}
        </div>

      </main>

      {/* Modals */}
      {showNewSession && (
        <NewSessionModal
          tables={tables}
          staffUsername={user.username}
          activeSessions={activeSessions}
          onClose={() => setShowNewSession(false)}
          onSuccess={(session) => {
            setShowNewSession(false);
            router.push(`/sessions/${session.id}`);
          }}
        />
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

      {switchTableSession && (
        <SwitchTableModal 
          session={switchTableSession}
          onClose={() => setSwitchTableSession(null)}
          onSuccess={fetchData}
        />
      )}

      {/* Active Sessions Quick-Peek Drawer */}
      {showActiveDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" 
            onClick={() => setShowActiveDrawer(false)}
          ></div>
          
          <div className="relative w-full max-w-sm bg-white border-l border-slate-200 h-full shadow-2xl flex flex-col animate-in slide-in-from-right">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h2 className="text-sm font-bold text-slate-900 font-display uppercase tracking-wide">Live Lounge Sessions</h2>
                <p className="text-xs text-slate-500">{activeSessions.length} active sessions</p>
              </div>
              <button 
                onClick={() => setShowActiveDrawer(false)} 
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100">
              <input
                type="text"
                placeholder="Search by customer name..."
                value={liveSessionSearch}
                onChange={(e) => setLiveSessionSearch(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeSessions
                .filter(s => s.customerName.toLowerCase().includes(liveSessionSearch.toLowerCase()))
                .map((s) => (
                  <div key={s.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{s.customerName}</p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button
                      onClick={() => router.push(`/sessions/${s.id}`)}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Items Modal */}
      {activeOrderSessionId && (
        <AddOrderModal
          sessionId={activeOrderSessionId}
          onClose={() => setActiveOrderSessionId(null)}
          onSuccess={() => {
            setActiveOrderSessionId(null);
            fetchData();
          }}
        />
      )}

    </div>
  );
}
