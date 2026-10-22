'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { Navbar } from '../../components/Navbar';
import { AddOrderModal } from '../../components/AddOrderModal';
import { RecordPaymentModal } from '../../components/RecordPaymentModal';
import { RegisterCustomerModal } from '../../components/RegisterCustomerModal';
import { 
  Users, 
  Search, 
  UserPlus, 
  Phone, 
  Calendar, 
  Clock, 
  IndianRupee, 
  AlertCircle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight, 
  ArrowLeft,
  Coffee,
  Gamepad2,
  Receipt,
  FileText,
  Loader2,
  Sparkles,
  Check,
  X,
  CreditCard,
  Play,
  Square,
  ArrowRightLeft,
  Plus,
  RefreshCw,
  ShoppingCart,
  ArrowRight,
  Info
} from 'lucide-react';

interface CustomerSummary {
  id: string | number;
  name: string;
  firstName: string;
  lastName?: string;
  phone: string;
  createdAt?: string;
}

interface VisitDetail {
  id: string;
  status: string;
  startTime: string;
  endTime?: string;
  totalBill: number;
  gameCost: number;
  menuCost: number;
  customAmount: number;
  paymentStatus: string;
  tablePlays: {
    id: string | number;
    gameType: string;
    tableName: string;
    playerCount: number;
    startTime: string;
    endTime?: string;
    cost: number;
  }[];
  orders: {
    id: number;
    name: string;
    category: string;
    price: number;
    quantity: number;
    total: number;
    createdAt: string;
  }[];
  payments: {
    id: number;
    amount: number;
    method: string;
    createdAt: string;
  }[];
  udhars: {
    id: string | number;
    amount: number;
    status: string;
    createdAt: string;
  }[];
  creditRecords?: {
    id: string | number;
    amount: number;
    settledAmount: number;
    due: number;
    status: string;
    notes?: string | null;
    createdAt: string;
  }[];
}

interface DayTimeline {
  date: string;
  formattedDate: string;
  isToday: boolean;
  totalDayBill: number;
  totalDayPaid: number;
  dayUdharAdded: number;
  dayCreditAdded?: number;
  visits: VisitDetail[];
}

interface UdharBreakdownItem {
  id: number | string;
  amount: number;
  settledAmount?: number;
  due?: number;
  date: string;
  formattedDate: string;
  timeStr: string;
  visitId?: string | null;
  sessionId: string | null;
  visitNumber: number | null;
  isManual: boolean;
  notes?: string | null;
  sessionTotal?: number | null;
  visitTotal?: number | null;
  sessionStatus?: string | null;
  visitStatus?: string | null;
}

interface Customer360Data {
  customer: {
    id: string | number;
    name: string;
    firstName: string;
    lastName?: string;
    phone: string;
    memberSince: string;
    totalVisits: number;
    lifetimeSpend: number;
    lifetimePaid: number;
    currentUdharDue: number;
    currentCreditDue?: number;
    previousUdharDue?: number;
    previousCreditDue?: number;
    unpaidUdharsBreakdown?: UdharBreakdownItem[];
    unpaidCreditsBreakdown?: UdharBreakdownItem[];
  };
  timeline: DayTimeline[];
}

function CustomerPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);

  const [customerData, setCustomerData] = useState<Customer360Data | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');

  // Modals & Actions state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [paymentSessionTarget, setPaymentSessionTarget] = useState<{
    sessionId: string;
    maxAmount: number;
    title?: string;
  } | null>(null);
  const [showAssignTableModal, setShowAssignTableModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showUdharBreakdown, setShowUdharBreakdown] = useState(false);

  // Available floor tables for "+ Assign Table" modal
  const [floorTables, setFloorTables] = useState<any[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [assigningTableId, setAssigningTableId] = useState<number | null>(null);

  // Ending table play state
  const [endingPlayId, setEndingPlayId] = useState<string | number | null>(null);
  const [settling, setSettling] = useState(false);
  const [closingVisit, setClosingVisit] = useState(false);

  // Live timer tick for active plays
  const [timerTick, setTimerTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTimerTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Fetch all customers for directory
  const loadCustomers = async (q = '') => {
    try {
      setLoadingList(true);
      const url = q ? `/customers/search?q=${encodeURIComponent(q)}` : '/customers';
      const data = await api.get(url);
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load customers:', err.message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadCustomers(searchQuery.trim());
  }, [searchQuery]);

  // Read URL query parameter for phone or customer identifier
  useEffect(() => {
    const phoneParam = searchParams.get('phone') || searchParams.get('id');
    if (phoneParam) {
      setSelectedPhone(phoneParam);
      loadCustomerHistory(phoneParam);
    } else {
      setSelectedPhone(null);
      setCustomerData(null);
    }
  }, [searchParams]);

  // Load Customer 360 History
  const loadCustomerHistory = async (identifier: string) => {
    try {
      setLoadingProfile(true);
      const data = await api.get(`/customers/${encodeURIComponent(identifier)}/history`);
      setCustomerData(data);
    } catch (err: any) {
      console.error('Failed to load customer profile:', err.message);
      setCustomerData(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Load available floor tables for assigning
  const loadFloorTables = async () => {
    try {
      setLoadingTables(true);
      const data = await api.get('/tables');
      setFloorTables(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load tables:', err);
    } finally {
      setLoadingTables(false);
    }
  };

  // Assign Table to this Customer
  const handleAssignTableToCustomer = async (tableId: number) => {
    if (!customerData) return;
    try {
      setAssigningTableId(tableId);
      await api.post(`/tables/${tableId}/assign`, {
        customerId: customerData.customer.id,
        customerName: customerData.customer.name,
        customerPhone: customerData.customer.phone
      });
      setShowAssignTableModal(false);
      await loadCustomerHistory(customerData.customer.phone || String(customerData.customer.id));
    } catch (err: any) {
      alert(err.message || 'Failed to assign table');
    } finally {
      setAssigningTableId(null);
    }
  };

  // Stop active table play
  const handleStopTablePlay = async (sessionId: string, playId: string | number) => {
    if (!confirm('Are you sure you want to stop this table play and lock the cost to the bill?')) {
      return;
    }
    try {
      setEndingPlayId(playId);
      await api.post(`/visits/${sessionId}/table/end`, {
        tablePlayId: playId,
        endTime: new Date().toISOString()
      });
      if (selectedPhone) {
        await loadCustomerHistory(selectedPhone);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to stop table play');
    } finally {
      setEndingPlayId(null);
    }
  };

  // Ensure active session for adding items
  const handleOpenAddOrder = async () => {
    if (!customerData) return;
    const activeVisit = customerData.timeline
      .flatMap(d => d.visits)
      .find(v => v.status === 'active');

    if (activeVisit) {
      setShowAddOrderModal(true);
    } else {
      // Create an active visit for this customer so items can be ordered
      try {
        await api.post('/visits', {
          staffUsername: user?.username || 'chirag',
          customerId: customerData.customer.id,
          customerName: customerData.customer.name,
          customerPhone: customerData.customer.phone
        });
        if (selectedPhone) {
          await loadCustomerHistory(selectedPhone);
        }
        setShowAddOrderModal(true);
      } catch (err: any) {
        alert(err.message || 'Failed to open order visit');
      }
    }
  };

  // Settle all unpaid credit
  const handleSettleAllUdhar = async () => {
    if (!customerData) return;
    try {
      setSettling(true);
      const unpaidRecords = customerData.customer.unpaidCreditsBreakdown || customerData.customer.unpaidUdharsBreakdown || [];

      if (unpaidRecords.length > 0) {
        for (const u of unpaidRecords) {
          await api.post(`/credits/${u.id}/pay`, {});
        }
      } else {
        const unpaidUdhars = customerData.timeline
          .flatMap(d => d.visits)
          .flatMap(v => v.udhars || v.creditRecords)
          .filter(u => u.status === 'unpaid');

        for (const u of unpaidUdhars) {
          await api.post(`/credits/${u.id}/pay`, {});
        }
      }

      setShowSettleModal(false);
      if (selectedPhone) {
        await loadCustomerHistory(selectedPhone);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to settle credit');
    } finally {
      setSettling(false);
    }
  };

  // Close active visit (with carry-forward prompt if unpaid)
  const handleCloseVisit = async (sessionId: string, unpaidAmount: number = 0, visitNum?: number) => {
    let confirmMsg = visitNum 
      ? `Complete and close Visit ${visitNum} for this customer?`
      : 'Complete and close this visit for this customer?';

    if (unpaidAmount > 0) {
      confirmMsg = `Close Visit ${visitNum || ''} without full payment?\n\nThe remaining unpaid balance of ₹${unpaidAmount.toFixed(2)} will be carried forward to the next visit / outstanding credit.`;
    }

    if (!confirm(confirmMsg)) {
      return;
    }
    try {
      setClosingVisit(true);
      await api.post(`/visits/${sessionId}/close`, {});
      if (selectedPhone) {
        await loadCustomerHistory(selectedPhone);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to close visit');
    } finally {
      setClosingVisit(false);
    }
  };

  // Start a new visit for this customer (e.g. Visit 2, Visit 3)
  const [startingNewVisit, setStartingNewVisit] = useState(false);
  const handleStartNewVisit = async () => {
    if (!customerData) return;
    try {
      setStartingNewVisit(true);
      await api.post('/visits', {
        staffUsername: user?.username || 'chirag',
        customerId: customerData.customer.id,
        customerName: customerData.customer.name,
        customerPhone: customerData.customer.phone
      });
      if (selectedPhone) {
        await loadCustomerHistory(selectedPhone);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to start new visit');
    } finally {
      setStartingNewVisit(false);
    }
  };

  // Helper to format local date YYYY-MM-DD
  const getLocalDateStr = (d: Date | string | number = new Date()): string => {
    const date = new Date(d);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Date selection state (defaults to today in local timezone)
  const todayStr = getLocalDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedDateManuallyChanged, setSelectedDateManuallyChanged] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Auto-sync selectedDate with active visit date or today from timeline
  useEffect(() => {
    if (customerData?.timeline && !selectedDateManuallyChanged) {
      // 1. If customer currently has an active running visit (even if started before midnight), prioritize showing that day
      const activeDay = customerData.timeline.find(d => d.visits.some(v => v.status === 'active'));
      if (activeDay) {
        setSelectedDate(activeDay.date);
        return;
      }

      // 2. Otherwise auto-sync with today if today has activity or exists
      const todayEntry = customerData.timeline.find(d => d.isToday || d.date === todayStr);
      if (todayEntry) {
        setSelectedDate(todayEntry.date);
        return;
      }

      // 3. Fallback to latest day in timeline if available
      if (customerData.timeline.length > 0) {
        setSelectedDate(customerData.timeline[0].date);
      }
    }
  }, [customerData, selectedDateManuallyChanged, todayStr]);

  const isViewingToday = selectedDate === todayStr;

  // Format date helper for human-readable display
  const formatDisplayDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      if (y && m && d) {
        return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      }
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Find day in timeline matching selected date
  const currentViewDay = customerData?.timeline?.find(d => 
    d.date === selectedDate || (isViewingToday && d.isToday)
  );
  const currentVisits = currentViewDay ? currentViewDay.visits : [];
  const activeVisit = currentVisits.find(v => v.status === 'active');
  const activeVisitIndex = activeVisit ? currentVisits.findIndex(v => v.id === activeVisit.id) : -1;
  const activeVisitNumber = activeVisitIndex >= 0 ? activeVisitIndex + 1 : currentVisits.length;

  // Multi-visit selection state: allows toggling between Visit 1, Visit 2, etc.
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);

  // Auto-select active visit if running, otherwise select the latest visit of the day
  useEffect(() => {
    if (currentVisits.length > 0) {
      const active = currentVisits.find(v => v.status === 'active');
      if (active) {
        setSelectedVisitId(active.id);
      } else if (!selectedVisitId || !currentVisits.some(v => v.id === selectedVisitId)) {
        setSelectedVisitId(currentVisits[currentVisits.length - 1].id);
      }
    } else {
      setSelectedVisitId(null);
    }
  }, [customerData, selectedDate]);

  const selectedVisit = (selectedVisitId ? currentVisits.find(v => v.id === selectedVisitId) : null)
    || activeVisit 
    || (currentVisits.length > 0 ? currentVisits[currentVisits.length - 1] : null);

  const selectedVisitIndex = selectedVisit ? currentVisits.findIndex(v => v.id === selectedVisit.id) : -1;
  const selectedVisitNumber = selectedVisitIndex >= 0 ? selectedVisitIndex + 1 : 1;
  const isSelectedVisitActive = selectedVisit?.status === 'active';
  const isSelectedVisitReadOnly = selectedVisit ? selectedVisit.status !== 'active' : false;

  // Items and tables for the selected visit
  const displayTablePlays = selectedVisit ? selectedVisit.tablePlays : [];
  const displayOrders = selectedVisit ? selectedVisit.orders : [];
  const displayCafeSubtotal = displayOrders.reduce((sum, o) => sum + o.total, 0);
  const displayGameSubtotal = displayTablePlays.reduce((sum, tp) => sum + tp.cost, 0);

  // Group orders by category for category-wise vertical bill lines (e.g. Cigarettes, Cafe, etc.)
  const ordersByCategory = displayOrders.reduce((acc: Record<string, number>, order) => {
    const rawCat = order.category && order.category.trim() ? order.category.trim() : 'Cafe Items';
    const cat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1);
    acc[cat] = (acc[cat] || 0) + order.total;
    return acc;
  }, {});

  // Day-wide totals (across all visits on this date)
  const dayTotalBilled = currentVisits.reduce((sum, v) => sum + v.totalBill, 0);
  const dayTotalPaid = currentVisits.reduce((sum, v) => {
    const vPaid = v.payments.reduce((pSum, p) => pSum + (p.amount || 0), 0);
    return sum + vPaid;
  }, 0);
  const dayGameSubtotal = currentVisits.flatMap(v => v.tablePlays).reduce((sum, tp) => sum + tp.cost, 0);
  const dayCafeSubtotal = currentVisits.flatMap(v => v.orders).reduce((sum, o) => sum + o.total, 0);

  // Active visit bill & balance specifically for payment & closing
  const activeVisitTotalBilled = activeVisit ? activeVisit.totalBill : 0;
  const activeVisitTotalPaid = activeVisit ? activeVisit.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
  const activeVisitBalanceDue = Math.max(0, activeVisitTotalBilled - activeVisitTotalPaid);

  // Selected visit bill & balance specifically for the selected visit
  const selectedVisitTotal = selectedVisit ? selectedVisit.totalBill : 0;
  const selectedVisitPaid = selectedVisit ? selectedVisit.payments.reduce((sum, p) => sum + (p.amount || 0), 0) : 0;
  const selectedVisitBalanceDue = Math.max(0, selectedVisitTotal - selectedVisitPaid);

  // Unpaid balance from prior visits on this date (transferred forward into this visit)
  const priorVisitsTodayUnpaid = selectedVisitIndex > 0
    ? currentVisits.slice(0, selectedVisitIndex).reduce((sum, pv) => {
        const pvPaid = pv.payments.reduce((pSum, p) => pSum + (p.amount || 0), 0);
        return sum + Math.max(0, pv.totalBill - pvPaid);
      }, 0)
    : 0;

  // Carried forward total into this visit from earlier visits
  const totalCarriedForwardToThisVisit = priorVisitsTodayUnpaid;
  const visitTotalPayable = selectedVisitTotal + totalCarriedForwardToThisVisit;
  const visitNetBalanceDue = Math.max(0, visitTotalPayable - selectedVisitPaid);

  // Previous Days Outstanding Credit (Udhar accumulated from prior visits)
  const previousDaysOutstanding = typeof customerData?.customer?.previousUdharDue === 'number'
    ? customerData.customer.previousUdharDue
    : Math.max(0, (customerData?.customer?.currentUdharDue || 0) - (currentViewDay?.dayUdharAdded || 0));

  // Grand Total of All Days (Day's Total + Previous Outstanding if positive)
  const grandTotalAllDays = dayTotalBilled + (previousDaysOutstanding > 0 ? previousDaysOutstanding : 0);

  // Final Net Balance to Collect Now
  const netBalanceDueNow = Math.max(0, grandTotalAllDays - dayTotalPaid);

  // Compute effective udhar breakdown list from backend or timeline
  const getUdharBreakdownList = (): UdharBreakdownItem[] => {
    if (!customerData) return [];

    // 1. If backend provided unpaidUdharsBreakdown, use it
    if (customerData.customer.unpaidUdharsBreakdown && customerData.customer.unpaidUdharsBreakdown.length > 0) {
      return customerData.customer.unpaidUdharsBreakdown;
    }

    // 2. Fallback / supplementary computation from timeline
    const list: UdharBreakdownItem[] = [];
    for (const day of customerData.timeline) {
      day.visits.forEach((v, idx) => {
        const vPaid = v.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const vUnpaid = Math.max(0, v.totalBill - vPaid);
        if (vUnpaid > 0) {
          list.push({
            id: v.id,
            amount: vUnpaid,
            date: day.date,
            formattedDate: day.formattedDate,
            timeStr: new Date(v.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            sessionId: v.id,
            visitNumber: idx + 1,
            isManual: false,
            sessionTotal: v.totalBill,
            sessionStatus: v.status
          });
        }
      });
    }
    return list;
  };

  // Jump from Udhar split directly into that older day's visit workflow
  const handleJumpToUdharVisit = (entry: { date: string; visitId?: string | null }) => {
    setSelectedDate(entry.date);
    setSelectedDateManuallyChanged(true);
    if (entry.visitId) {
      setSelectedVisitId(entry.visitId);
    }
    setActiveTab('today');
    setShowUdharBreakdown(false);

    setTimeout(() => {
      const visitEl = document.getElementById('selected-visit-container');
      if (visitEl) {
        visitEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar />

      {/* TOP BAR */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 shadow-2xs sticky top-16 z-30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5 text-xs font-bold"
              title="Return to Floor Plan"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span>← Back to Floor Plan</span>
            </button>

            {selectedPhone && (
              <button
                onClick={() => {
                  setSelectedPhone(null);
                  router.push('/customers');
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold"
              >
                All Customers Directory
              </button>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-slate-900 font-display">
                  {selectedPhone && customerData ? customerData.customer.name : 'Customer Accounts & Profiles'}
                </h1>
                {customerData && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                    ID: #CUST-{String(customerData.customer.id).padStart(3, '0')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedPhone && (
              <button
                onClick={() => loadCustomerHistory(selectedPhone)}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-bold flex items-center gap-1"
                title="Refresh customer data"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            )}

            <button
              onClick={() => setShowRegisterModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Register New Customer</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: DEDICATED CUSTOMER PROFILE (NO LEFT SIDEBAR!) */}
      {selectedPhone ? (
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
          {loadingProfile ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center justify-center text-slate-400 space-y-3 shadow-xs">
              <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
              <p className="text-xs font-semibold">Loading dedicated customer account...</p>
            </div>
          ) : !customerData ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-500 text-xs shadow-xs">
              Customer profile not found.
            </div>
          ) : (
            <>
              {/* Customer Identity & Executive KPI Row */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-md font-display">
                      {customerData.customer.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-xl font-black text-slate-900 font-display">
                          {customerData.customer.name}
                        </h2>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          ID: #{customerData.customer.id}
                        </span>
                        {activeVisit && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1.5 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                            Live in Lounge
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1 font-mono">
                          📞 {customerData.customer.phone.startsWith('WALK-') ? 'Walk-in (No Phone)' : customerData.customer.phone}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          Registered {new Date(customerData.customer.memberSince).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <span>•</span>
                        <span>{customerData.customer.totalVisits} Lifetime Visits</span>
                        <span>•</span>

                        {/* CALENDAR DATE SELECTOR */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Interactive Date Picker Pill */}
                          <div 
                            onClick={() => {
                              try {
                                dateInputRef.current?.showPicker();
                              } catch {
                                dateInputRef.current?.focus();
                              }
                            }}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 hover:border-blue-500 text-slate-800 text-xs font-bold cursor-pointer shadow-2xs transition-all group relative"
                            title="Click to open calendar date picker"
                          >
                            <Calendar className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
                            <span>Date: <strong className="text-slate-900 font-black">{formatDisplayDate(selectedDate)}</strong></span>
                            {isViewingToday ? (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-100 text-emerald-800 font-mono font-bold">
                                Today
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-blue-100 text-blue-800 font-mono font-bold">
                                Selected Date
                              </span>
                            )}
                            <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-700" />

                            <input
                              ref={dateInputRef}
                              id="customer-date-picker"
                              type="date"
                              value={selectedDate}
                              onChange={(e) => {
                                if (e.target.value) {
                                  setSelectedDate(e.target.value);
                                  setSelectedDateManuallyChanged(true);
                                  setActiveTab('today');
                                }
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full pointer-events-none"
                            />
                          </div>

                          {/* Quick past dates switcher if available */}
                          {customerData?.timeline && customerData.timeline.length > 1 && (
                            <select
                              value={selectedDate}
                              onChange={(e) => {
                                setSelectedDate(e.target.value);
                                setSelectedDateManuallyChanged(true);
                                setActiveTab('today');
                              }}
                              className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer shadow-2xs transition-all"
                              title="Quickly switch between past visit dates"
                            >
                              <option value={todayStr}>Today ({formatDisplayDate(todayStr)})</option>
                              {customerData.timeline
                                .filter(d => d.date !== todayStr)
                                .map(d => (
                                  <option key={d.date} value={d.date}>
                                    {formatDisplayDate(d.date)} ({d.visits.length} visit{d.visits.length > 1 ? 's' : ''})
                                  </option>
                                ))}
                            </select>
                          )}

                          {!isViewingToday && (
                            <button
                              onClick={() => {
                                setSelectedDate(todayStr);
                                setSelectedDateManuallyChanged(false);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 border border-blue-200"
                              title="Reset view back to today"
                            >
                              <span>↺</span>
                              <span>Reset to Today</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions for this customer */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        loadFloorTables();
                        setShowAssignTableModal(true);
                      }}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                    >
                      <Gamepad2 className="w-3.5 h-3.5" />
                      <span>+ Assign Table</span>
                    </button>

                    <button
                      onClick={handleOpenAddOrder}
                      className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all"
                    >
                      <Coffee className="w-3.5 h-3.5 text-slate-500" />
                      <span>+ Add Items</span>
                    </button>
                  </div>
                </div>

                {/* 4 KPI Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Total Lifetime Udhar Card */}
                  <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                    customerData.customer.currentUdharDue > 0 
                      ? 'bg-rose-50/70 border-rose-200 text-rose-900' 
                      : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider block font-mono">
                          Total Outstanding Credit
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowUdharBreakdown(true)}
                          className={`w-5 h-5 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                            customerData.customer.currentUdharDue > 0
                              ? 'bg-rose-200/80 hover:bg-rose-300 text-rose-900'
                              : 'bg-emerald-200/80 hover:bg-emerald-300 text-emerald-900'
                          }`}
                          title="Click to view dates & visits breakdown of outstanding balance"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className={`text-xl font-black mt-1 block font-display ${
                        customerData.customer.currentUdharDue > 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}>
                        ₹{customerData.customer.currentUdharDue.toFixed(2)}
                      </span>
                    </div>
                    {customerData.customer.currentUdharDue > 0 ? (
                      <div className="mt-2 flex items-center gap-1.5">
                        <button
                          onClick={() => setShowSettleModal(true)}
                          className="flex-1 py-1 px-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-[10px] font-bold shadow-2xs transition-all text-center cursor-pointer"
                        >
                          Settle Balance →
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowUdharBreakdown(true)}
                          className="py-1 px-2 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300/80 rounded-lg text-[10px] font-bold transition-all text-center cursor-pointer flex items-center gap-1"
                          title="View dates and visits breakdown"
                        >
                          <Info className="w-3 h-3" />
                          <span>Breakdown</span>
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-emerald-700 font-bold block">
                          ✓ All Clear (Zero Balance)
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowUdharBreakdown(true)}
                          className="text-[10px] text-emerald-700 hover:underline font-bold cursor-pointer"
                        >
                          Details
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Today / Selected Date Total Bill */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
                        {isViewingToday ? "Today's Total Bill" : `Bill on ${formatDisplayDate(selectedDate)}`}
                      </span>
                      <span className="text-xl font-extrabold text-slate-900 mt-1 block font-display">
                        ₹{dayTotalBilled.toFixed(2)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold mt-2 block font-mono">
                      Tables ₹{dayGameSubtotal.toFixed(0)} • Items ₹{dayCafeSubtotal.toFixed(0)}
                    </span>
                  </div>

                  {/* Previous Days Outstanding Card (Shown if outstanding > 0, otherwise shows Lifetime Spend) */}
                  {previousDaysOutstanding > 0 ? (
                    <div className="p-4 rounded-xl border bg-amber-50/60 border-amber-200 text-amber-950 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider block font-mono text-amber-800">
                          Past Days Outstanding
                        </span>
                        <span className="text-xl font-extrabold mt-1 block font-display text-amber-900">
                          ₹{previousDaysOutstanding.toFixed(2)}
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-700 font-semibold mt-2 block">
                        Unpaid prior days
                      </span>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
                          Lifetime Spend
                        </span>
                        <span className="text-xl font-extrabold text-slate-900 mt-1 block font-display">
                          ₹{(customerData.customer.lifetimeSpend || 0).toFixed(2)}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-600 font-semibold mt-2 block">
                        ✓ All prior visits settled
                      </span>
                    </div>
                  )}

                  {/* Net Payable Now */}
                  <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col justify-between shadow-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                        Net Payable Now
                      </span>
                      <span className="text-xl font-black text-white mt-1 block font-display">
                        ₹{netBalanceDueNow.toFixed(2)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-300 font-medium mt-2 block">
                      {netBalanceDueNow > 0 ? "Today's Due + Past Balance" : 'Fully Settled ✓'}
                    </span>
                  </div>
                </div>
              </div>

              {/* View Switcher Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  onClick={() => setActiveTab('today')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeTab === 'today'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {isViewingToday
                      ? "Today's Activity"
                      : `Activity on ${formatDisplayDate(selectedDate)}`}
                  </span>
                  {isViewingToday && activeVisit && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500 text-white font-mono">
                      Live
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeTab === 'history'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>History</span>
                </button>
              </div>

              {/* TAB 1: ACTIVE / SELECTED DATE TABLES, CAFE ORDERS & BILL SUMMARY */}
              {activeTab === 'today' && (
                <div className="space-y-6">

                  {/* VISITS SELECTOR BAR (Shown when visits exist or for today) */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono mr-1">
                        {isViewingToday ? "Today's Visits:" : "Visits on Date:"}
                      </span>

                      {currentVisits.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">No visits recorded</span>
                      ) : (
                        currentVisits.map((v, idx) => {
                          const vNum = idx + 1;
                          const isActive = v.status === 'active';
                          const isSelected = selectedVisit?.id === v.id;
                          const startTimeStr = new Date(v.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          const endTimeStr = v.endTime ? new Date(v.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

                          return (
                            <button
                              key={v.id}
                              onClick={() => setSelectedVisitId(v.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-slate-900 text-white shadow-xs ring-2 ring-slate-900/10'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                              }`}
                            >
                              <span>Visit {vNum}</span>
                              <span className={`text-[10px] font-mono ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                                ({startTimeStr}{endTimeStr ? ` - ${endTimeStr}` : ''})
                              </span>
                              {isActive ? (
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500 text-white font-mono font-bold animate-pulse">
                                  Live
                                </span>
                              ) : (
                                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                                  isSelected ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-600'
                                }`}>
                                  Closed
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* Button to start a new visit if viewing today and no active visit is running */}
                    {isViewingToday && !activeVisit && (
                      <button
                        onClick={handleStartNewVisit}
                        disabled={startingNewVisit}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{startingNewVisit ? 'Starting...' : '+ Start New Visit'}</span>
                      </button>
                    )}
                  </div>

                  {/* ====================================================================== */}
                  {/* SINGLE BIG SECTION: SELECTED VISIT ACTIVITY & VISIT BILL SUMMARY       */}
                  {/* ====================================================================== */}
                  {selectedVisit ? (
                    <div id="selected-visit-container" className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-0 scroll-mt-24">
                      
                      {/* VISIT HEADER STRIP: Title, Live/Closed Badge, Timestamps */}
                      <div className={`px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isSelectedVisitActive
                          ? 'bg-blue-50/70 border-blue-200 text-blue-950'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}>
                        <div className="flex items-center gap-2.5">
                          <span className="font-extrabold text-slate-900 font-display text-base">
                            Visit {selectedVisitNumber} Activity
                          </span>
                          {isSelectedVisitActive ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono flex items-center gap-1.5 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              Live &amp; Editable
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 font-mono">
                              🔒 Closed (Read-Only)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5 font-mono text-xs text-slate-600 flex-wrap">
                          <span>Started: <strong className="text-slate-900">{new Date(selectedVisit.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                          {selectedVisit.endTime ? (
                            <>
                              <span>•</span>
                              <span>
                                Closed: <strong className="text-slate-900">{new Date(selectedVisit.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                                {getLocalDateStr(selectedVisit.startTime) !== getLocalDateStr(selectedVisit.endTime) && (
                                  <span className="ml-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-sans font-bold">
                                    Next Day (+1d)
                                  </span>
                                )}
                              </span>
                              <span>•</span>
                              <span>Duration: <strong className="text-slate-900">{Math.max(1, Math.round((new Date(selectedVisit.endTime).getTime() - new Date(selectedVisit.startTime).getTime()) / 60000))} mins</strong></span>
                            </>
                          ) : (
                            <>
                              <span>•</span>
                              <span className="text-emerald-700 font-bold font-sans">In Progress</span>
                              {getLocalDateStr(selectedVisit.startTime) !== todayStr && (
                                <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded font-sans font-bold">
                                  Running across midnight
                                </span>
                              )}
                            </>
                          )}
                          {!isSelectedVisitActive && activeVisit && (
                            <button
                              onClick={() => setSelectedVisitId(activeVisit.id)}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-bold font-sans ml-1 text-xs"
                            >
                              Switch to Live Visit →
                            </button>
                          )}
                        </div>
                      </div>

                      {/* VISIT INTERNAL CONTENT (Items, Tables, and Visit Bill) */}
                      <div className="p-6 space-y-6">

                        {/* SUB-SECTION 1: CAFE & REFRESHMENT ORDERS (ITEMS) */}
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-5 space-y-4">
                          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2">
                                <Coffee className="w-4 h-4 text-amber-700" />
                                <span>Cafe &amp; Refreshment Orders — Visit {selectedVisitNumber}</span>
                                <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-mono text-xs font-bold">
                                  ₹{displayCafeSubtotal.toFixed(2)}
                                </span>
                              </h3>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {isSelectedVisitReadOnly
                                  ? `Orders logged during Visit ${selectedVisitNumber} (Read-Only archive)`
                                  : `Drinks, snacks, and food logged to Visit ${selectedVisitNumber}`}
                              </p>
                            </div>

                            {isSelectedVisitActive && (
                              <button
                                onClick={handleOpenAddOrder}
                                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>+ Add Items</span>
                              </button>
                            )}
                          </div>

                          {displayOrders.length === 0 ? (
                            <div className="py-6 text-center text-slate-400 text-xs bg-white rounded-xl border border-dashed border-slate-200">
                              <p>No cafe orders placed by <strong>{customerData.customer.name}</strong> for Visit {selectedVisitNumber}.</p>
                              {isSelectedVisitActive && (
                                <button
                                  onClick={handleOpenAddOrder}
                                  className="mt-2 px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Add Drinks / Food</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
                              <table className="w-full text-xs text-left">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                                    <th className="py-2.5 px-3.5">Item</th>
                                    <th className="py-2.5 px-3.5">Category</th>
                                    <th className="py-2.5 px-3.5 text-right">Qty</th>
                                    <th className="py-2.5 px-3.5 text-right">Price</th>
                                    <th className="py-2.5 px-3.5 text-right">Total</th>
                                    <th className="py-2.5 px-3.5 text-right">Time</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {displayOrders.map((order) => (
                                    <tr key={order.id} className="hover:bg-slate-50 font-medium">
                                      <td className="py-2.5 px-3.5 font-bold text-slate-900">{order.name}</td>
                                      <td className="py-2.5 px-3.5">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                          {order.category}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3.5 text-right font-mono font-bold">{order.quantity}</td>
                                      <td className="py-2.5 px-3.5 text-right font-mono text-slate-500">₹{order.price.toFixed(2)}</td>
                                      <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900">₹{order.total.toFixed(2)}</td>
                                      <td className="py-2.5 px-3.5 text-right text-[11px] text-slate-400 font-mono">
                                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* SUB-SECTION 2: FLOOR TABLES */}
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-5 space-y-4">
                          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2">
                                <Gamepad2 className="w-4 h-4 text-blue-600" />
                                <span>Floor Tables — Visit {selectedVisitNumber}</span>
                                <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-mono text-xs font-bold">
                                  ₹{displayGameSubtotal.toFixed(2)}
                                </span>
                              </h3>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {isSelectedVisitReadOnly
                                  ? `Tables played during Visit ${selectedVisitNumber} (Read-Only archive)`
                                  : `Billiard & Snooker tables assigned to Visit ${selectedVisitNumber}`}
                              </p>
                            </div>

                            {isSelectedVisitActive && (
                              <button
                                onClick={() => {
                                  loadFloorTables();
                                  setShowAssignTableModal(true);
                                }}
                                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Assign Table</span>
                              </button>
                            )}
                          </div>

                          {displayTablePlays.length === 0 ? (
                            <div className="py-6 text-center text-slate-400 text-xs bg-white rounded-xl border border-dashed border-slate-200">
                              <p>No tables assigned to <strong>{customerData.customer.name}</strong> for Visit {selectedVisitNumber}.</p>
                              {isSelectedVisitActive && (
                                <button
                                  onClick={() => {
                                    loadFloorTables();
                                    setShowAssignTableModal(true);
                                  }}
                                  className="mt-2 px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Play className="w-3 h-3 fill-white" />
                                  <span>Start a Table Now</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                              {displayTablePlays.map((tp) => {
                                const isLive = !tp.endTime;
                                const elapsedMins = Math.floor(
                                  (Date.now() - new Date(tp.startTime).getTime()) / (1000 * 60)
                                );

                                return (
                                  <div
                                    key={tp.id}
                                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                                      isLive
                                        ? 'bg-blue-50/70 border-blue-200 shadow-xs'
                                        : 'bg-white border-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <h4 className="font-bold text-sm text-slate-900">{tp.tableName}</h4>
                                          {isLive ? (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse font-mono">
                                              ● Running Now
                                            </span>
                                          ) : (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono">
                                              Completed
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[11px] text-slate-500 font-mono mt-1">
                                          Started: {new Date(tp.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          {tp.endTime ? (
                                            <>
                                              {` · Ended: ${new Date(tp.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                              {getLocalDateStr(tp.startTime) !== getLocalDateStr(tp.endTime) && (
                                                <span className="ml-1 text-[10px] text-amber-700 font-sans font-bold">
                                                  (+1d)
                                                </span>
                                              )}
                                            </>
                                          ) : (
                                            getLocalDateStr(tp.startTime) !== todayStr && (
                                              <span className="ml-1 text-[10px] text-blue-700 font-sans font-bold">
                                                (Overnight)
                                              </span>
                                            )
                                          )}
                                        </p>
                                      </div>

                                      <div className="text-right">
                                        <span className="text-base font-extrabold text-slate-900 font-display block">
                                          ₹{tp.cost.toFixed(2)}
                                        </span>
                                        {isLive && (
                                          <span className="text-[10px] text-blue-700 font-bold font-mono">
                                            ⏱ {elapsedMins} mins elapsed
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {isLive && isSelectedVisitActive && selectedVisit && (
                                      <div className="mt-4 pt-3 border-t border-blue-200/60 flex items-center justify-end gap-2">
                                        <button
                                          onClick={() => handleStopTablePlay(selectedVisit.id, tp.id)}
                                          disabled={endingPlayId === tp.id}
                                          className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                                        >
                                          <Square className="w-3 h-3 fill-white" />
                                          <span>{endingPlayId === tp.id ? 'Stopping...' : 'Stop Table Play'}</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* SUB-SECTION 3: BILL SUMMARY FOR THIS VISIT (VERTICAL LINES RECEIPT) */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                              <Receipt className="w-4 h-4 text-slate-700" />
                              <h3 className="text-sm font-bold text-slate-900 font-display">
                                Bill Summary
                              </h3>
                            </div>

                            {/* Paid or Not Paid Status Badge */}
                            {selectedVisitTotal === 0 && totalCarriedForwardToThisVisit === 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 font-mono">
                                ₹0.00
                              </span>
                            ) : visitNetBalanceDue === 0 ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                                ✓ Paid in Full
                              </span>
                            ) : !isSelectedVisitActive ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 font-mono">
                                ● Unpaid (Transferred to Next Visit · Due ₹{selectedVisitBalanceDue.toFixed(2)})
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 font-mono">
                                ● Not Paid (Due ₹{visitNetBalanceDue.toFixed(2)})
                              </span>
                            )}
                          </div>

                          {/* VERTICAL ONLY LINES */}
                          <div className="space-y-2 text-xs">
                            {/* Category-wise items totals (e.g. Cigarettes Total, Cafe Total) */}
                            {Object.keys(ordersByCategory).length > 0 ? (
                              Object.entries(ordersByCategory).map(([catName, catTotal]) => (
                                <div key={catName} className="flex items-center justify-between py-1 text-slate-700 border-b border-slate-100">
                                  <span className="capitalize font-medium text-slate-700">{catName} Total</span>
                                  <span className="font-mono font-bold text-slate-900">₹{catTotal.toFixed(2)}</span>
                                </div>
                              ))
                            ) : (
                              <div className="flex items-center justify-between py-1 text-slate-400 border-b border-slate-100">
                                <span className="font-medium">Items Total</span>
                                <span className="font-mono">₹0.00</span>
                              </div>
                            )}

                            {/* Floor Tables Total Line */}
                            <div className="flex items-center justify-between py-1 text-slate-700 border-b border-slate-100">
                              <span className="font-medium">Tables Total</span>
                              <span className="font-mono font-bold text-slate-900">₹{displayGameSubtotal.toFixed(2)}</span>
                            </div>

                            {/* Current Visit */}
                            <div className="flex items-center justify-between py-1 text-slate-700 font-medium border-b border-slate-100">
                              <span>Current Visit</span>
                              <span className="font-mono font-bold text-slate-900">₹{selectedVisitTotal.toFixed(2)}</span>
                            </div>

                            {/* Carried Forward from previous visit(s) of today or prior debt */}
                            {totalCarriedForwardToThisVisit > 0 && (
                              <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-950">
                                <span className="font-semibold text-xs flex items-center gap-1.5">
                                  <span>↩</span>
                                  <span>
                                    Carried Forward ({priorVisitsTodayUnpaid > 0 ? `Unpaid from Visit ${selectedVisitIndex}` : 'Previous Outstanding'})
                                  </span>
                                </span>
                                <span className="font-mono font-bold text-rose-700 text-xs">
                                  + ₹{totalCarriedForwardToThisVisit.toFixed(2)}
                                </span>
                              </div>
                            )}

                            {/* Total Amount Payable */}
                            <div className="flex items-center justify-between py-2.5 font-bold text-slate-900 border-b border-slate-200">
                              <span className="text-sm">
                                {totalCarriedForwardToThisVisit > 0 ? 'Total Amount Payable' : 'Total Amount'}
                              </span>
                              <span className="font-mono text-base font-extrabold text-slate-900">
                                ₹{visitTotalPayable.toFixed(2)}
                              </span>
                            </div>

                            {/* Paid Amount if any */}
                            {selectedVisitPaid > 0 && (
                              <div className="flex items-center justify-between py-1 text-slate-500 font-medium">
                                <span>Paid for this Visit</span>
                                <span className="font-mono text-emerald-700 font-bold">- ₹{selectedVisitPaid.toFixed(2)}</span>
                              </div>
                            )}

                            {/* Net Balance Due */}
                            {visitNetBalanceDue > 0 && (
                              <div className="flex items-center justify-between py-1 text-rose-700 font-bold">
                                <span>Balance Due</span>
                                <span className="font-mono font-extrabold text-sm">₹{visitNetBalanceDue.toFixed(2)}</span>
                              </div>
                            )}

                            {/* BELOW THAT: PAY NOW AND CLOSE VISIT (ALWAYS ENABLED) */}
                            {isSelectedVisitActive ? (
                              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                                {visitNetBalanceDue > 0 ? (
                                  <button
                                    onClick={() => {
                                      setPaymentSessionTarget({
                                        sessionId: selectedVisit.id,
                                        maxAmount: visitNetBalanceDue,
                                        title: `Pay Bill for Visit ${selectedVisitNumber}`
                                      });
                                      setShowRecordPaymentModal(true);
                                    }}
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-2"
                                  >
                                    <CreditCard className="w-4 h-4" />
                                    <span>Pay Now (₹{visitNetBalanceDue.toFixed(2)})</span>
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                                    <Check className="w-4 h-4" />
                                    <span>Paid in Full</span>
                                  </div>
                                )}

                                {/* CLOSE VISIT BUTTON: Always clickable, prompts carry-forward if unpaid */}
                                <button
                                  onClick={() => handleCloseVisit(selectedVisit.id, visitNetBalanceDue, selectedVisitNumber)}
                                  disabled={closingVisit}
                                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-2"
                                >
                                  <Check className="w-4 h-4 text-emerald-400" />
                                  <span>{closingVisit ? 'Closing...' : 'Close Visit'}</span>
                                </button>
                              </div>
                            ) : (
                              selectedVisit.endTime && (
                                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                                  ✓ Visit Closed at {new Date(selectedVisit.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {selectedVisitBalanceDue > 0 && (
                                    <span className="text-amber-700 font-bold ml-2">
                                      (Unpaid balance of ₹{selectedVisitBalanceDue.toFixed(2)} was transferred to next visit)
                                    </span>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
                      No visits recorded for this day.
                    </div>
                  )}

                  {/* ====================================================================== */}
                  {/* SEPARATE SECTION OUTSIDE VISIT: BILL OF ALL VISITS (CUMULATIVE SUMMARY) */}
                  {/* ====================================================================== */}
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-slate-800" />
                        <div>
                          <h3 className="text-base font-bold text-slate-900 font-display">
                            Bill of All Visits {isViewingToday ? "(Today's Cumulative Summary)" : `(${formatDisplayDate(selectedDate)})`}
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            Cumulative breakdown of all visits, prior day outstanding balances, and final checkout
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Visits Breakdown List */}
                    <div className="space-y-2.5 text-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400 block">
                        Visits Breakdown:
                      </span>

                      {currentVisits.length === 0 ? (
                        <div className="text-slate-400 italic text-xs py-2">
                          No visits recorded for this day.
                        </div>
                      ) : (
                        currentVisits.map((v, idx) => {
                          const vNum = idx + 1;
                          const vBill = v.totalBill;
                          const vPaid = v.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
                          const vBalance = Math.max(0, vBill - vPaid);
                          const isPaid = vBalance === 0 && vBill > 0;
                          const isFree = vBill === 0;

                          return (
                            <div
                              key={v.id}
                              onClick={() => setSelectedVisitId(v.id)}
                              className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                                selectedVisit?.id === v.id
                                  ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20'
                                  : 'border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="font-bold text-slate-900 text-sm">
                                  Visit {vNum}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  ({new Date(v.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {v.endTime ? ` - ${new Date(v.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' · Live'})
                                </span>

                                {isPaid ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                                    ✓ Paid
                                  </span>
                                ) : isFree ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 font-mono">
                                    ₹0.00
                                  </span>
                                ) : v.status !== 'active' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 font-mono">
                                    ● Unpaid (Transferred · ₹{vBalance.toFixed(2)})
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 font-mono">
                                    ● Not Paid (Due ₹{vBalance.toFixed(2)})
                                  </span>
                                )}
                              </div>

                              <div className="font-mono font-bold text-slate-900 text-sm">
                                ₹{vBill.toFixed(2)}
                              </div>
                            </div>
                          );
                        })
                      )}

                      {/* Total Amount of All Visits */}
                      <div className="flex items-center justify-between py-2 border-t border-slate-200 font-bold text-slate-900 pt-3">
                        <span className="text-slate-700">Total Amount of All Visits</span>
                        <span className="font-mono text-sm font-extrabold text-slate-900">
                          ₹{dayTotalBilled.toFixed(2)}
                        </span>
                      </div>

                      {/* Previous Outstanding Bar (ONLY shown if positive; completely hidden otherwise) */}
                      {previousDaysOutstanding > 0 && (
                        <div className="flex items-center justify-between py-2 px-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-950 font-medium">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">⚠️</span>
                            <span className="text-xs font-semibold">Previous Outstanding (Past Days)</span>
                          </div>
                          <span className="font-mono font-bold text-xs text-rose-700">
                            + ₹{previousDaysOutstanding.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {/* Today's Total Payable */}
                      <div className="flex items-center justify-between py-2 border-t border-slate-200 font-bold text-slate-900">
                        <span className="uppercase text-[11px] tracking-wide text-slate-600">
                          {isViewingToday ? "Today's Total Payable" : "Total Payable"}
                        </span>
                        <span className="font-mono text-base font-extrabold text-slate-900">
                          ₹{grandTotalAllDays.toFixed(2)}
                        </span>
                      </div>

                      {/* Paid Today / Paid on Date */}
                      {dayTotalPaid > 0 && (
                        <div className="flex items-center justify-between py-1 text-slate-500 font-medium">
                          <span>Paid {isViewingToday ? 'Today' : 'on Date'}</span>
                          <span className="font-mono text-emerald-700 font-bold">- ₹{dayTotalPaid.toFixed(2)}</span>
                        </div>
                      )}

                      {/* Net Balance & Pay Now at Bottom */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 text-white font-bold mt-2 shadow-xs">
                        <div className="flex items-baseline gap-2.5">
                          <span className="text-xs uppercase tracking-wider font-mono text-slate-300">
                            Net Balance Due:
                          </span>
                          <span className="font-mono text-2xl font-black text-white">
                            ₹{netBalanceDueNow.toFixed(2)}
                          </span>
                        </div>

                        {netBalanceDueNow > 0 ? (
                          <button
                            onClick={() => {
                              setPaymentSessionTarget({
                                sessionId: activeVisit?.id || selectedVisit?.id || '',
                                maxAmount: netBalanceDueNow,
                                title: `Pay Net Balance Due`
                              });
                              setShowRecordPaymentModal(true);
                            }}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>Pay Now</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Fully Settled &amp; Paid</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: LIFETIME DAY-WISE HISTORY */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  {customerData.timeline.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
                      No past visit history recorded yet for this customer.
                    </div>
                  ) : (
                    customerData.timeline.map((day) => (
                      <div key={day.date} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-slate-900 font-display">
                                {day.formattedDate}
                              </h4>
                              {day.isToday && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                                  Today
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {day.visits.length} visit session{day.visits.length > 1 ? 's' : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-sm font-extrabold text-slate-900 font-display block">
                                Total: ₹{day.totalDayBill.toFixed(2)}
                              </span>
                              <span className="text-[11px] text-emerald-600 font-semibold font-mono">
                                Paid: ₹{day.totalDayPaid.toFixed(2)}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedDate(day.date);
                                setSelectedDateManuallyChanged(true);
                                setActiveTab('today');
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-2xs hover:border-blue-400 transition-all flex items-center gap-1"
                              title="Inspect this day in detail"
                            >
                              <Calendar className="w-3.5 h-3.5 text-blue-600" />
                              <span>Select Date</span>
                            </button>
                          </div>
                        </div>

                        {/* Itemized day details */}
                        <div className="space-y-3">
                          {day.visits.map((v, vIdx) => (
                            <div key={v.id || vIdx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                              <div className="flex justify-between items-center text-[11px] font-bold text-slate-700">
                                <span>Visit at {new Date(v.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span>Bill: ₹{v.totalBill.toFixed(2)}</span>
                              </div>

                              {v.tablePlays.length > 0 && (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold uppercase text-slate-400 font-mono">Tables Played:</span>
                                  {v.tablePlays.map(tp => (
                                    <div key={tp.id} className="flex justify-between text-slate-600">
                                      <span>🎱 {tp.tableName}</span>
                                      <span className="font-mono">₹{tp.cost.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {v.orders.length > 0 && (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold uppercase text-slate-400 font-mono">Items Ordered:</span>
                                  {v.orders.map(o => (
                                    <div key={o.id} className="flex justify-between text-slate-600">
                                      <span>☕ {o.quantity}x {o.name}</span>
                                      <span className="font-mono">₹{o.total.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* VIEW 2: FULL-WIDTH CUSTOMER DIRECTORY (When no customer is currently selected) */
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-display">
                  Permanent Customer Accounts
                </h2>
                <p className="text-xs text-slate-500">
                  Select a customer to open their dedicated page, manage running tables, and view day-wise history
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name (Tony, Chirag) or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 font-semibold"
                />
              </div>
            </div>

            {/* Customers Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Customer ID</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4">Member Since</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingList ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-600" />
                        Loading registered customers...
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        No customers found matching &quot;{searchQuery}&quot;. Click &quot;+ Register New Customer&quot; above to create one.
                      </td>
                    </tr>
                  ) : (
                    customers.map((c) => (
                      <tr 
                        key={c.id || c.phone} 
                        onClick={() => {
                          setSelectedPhone(c.phone);
                          router.push(`/customers?phone=${encodeURIComponent(c.phone)}`);
                        }}
                        className="hover:bg-slate-50 cursor-pointer font-medium group transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs group-hover:scale-105 transition-transform">
                              {c.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {c.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          #CUST-{String(c.id).padStart(3, '0')}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">
                          {c.phone.startsWith('WALK-') ? 'Walk-in (No Phone)' : c.phone}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Active Member'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="px-3 py-1 bg-slate-900 group-hover:bg-blue-600 text-white text-[11px] font-bold rounded-lg shadow-2xs transition-all">
                            Open Dedicated Profile →
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: REGISTER NEW CUSTOMER */}
      {showRegisterModal && (
        <RegisterCustomerModal
          onClose={() => setShowRegisterModal(false)}
          onSuccess={(newCust) => {
            setShowRegisterModal(false);
            loadCustomers();
            setSelectedPhone(newCust.phone);
            router.push(`/customers?phone=${encodeURIComponent(newCust.phone)}`);
          }}
        />
      )}

      {/* MODAL 2: ASSIGN TABLE DIRECTLY FROM CUSTOMER PAGE */}
      {showAssignTableModal && customerData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900 font-display">
                  Assign Table to {customerData.customer.name}
                </h3>
                <p className="text-xs text-slate-400">Select an available billiard or snooker table</p>
              </div>
              <button onClick={() => setShowAssignTableModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {loadingTables ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading tables...</div>
              ) : floorTables.filter(t => t.status !== 'occupied').length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">All tables are currently occupied.</div>
              ) : (
                floorTables.filter(t => t.status !== 'occupied').map((t) => (
                  <div
                    key={t.id}
                    onClick={() => handleAssignTableToCustomer(t.id)}
                    className="p-3 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-all group"
                  >
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">
                        {t.gameType} Table {t.number}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Rate: ₹{t.gameType === 'MidSnooker' ? 220 : 160}/hr
                      </p>
                    </div>
                    <button
                      disabled={assigningTableId === t.id}
                      className="px-3 py-1 bg-slate-900 group-hover:bg-blue-600 text-white text-[11px] font-bold rounded-lg"
                    >
                      {assigningTableId === t.id ? 'Starting...' : 'Start Play'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD ORDER MODAL */}
      {showAddOrderModal && (activeVisit || selectedVisit) && (
        <AddOrderModal
          sessionId={activeVisit?.id || selectedVisit?.id || ''}
          onClose={() => setShowAddOrderModal(false)}
          onSuccess={() => {
            setShowAddOrderModal(false);
            if (selectedPhone) loadCustomerHistory(selectedPhone);
          }}
        />
      )}

      {/* MODAL 4: RECORD PAYMENT MODAL */}
      {showRecordPaymentModal && (activeVisit || selectedVisit || paymentSessionTarget) && (
        <RecordPaymentModal
          sessionId={paymentSessionTarget?.sessionId || activeVisit?.id || selectedVisit?.id || ''}
          maxAmount={paymentSessionTarget?.maxAmount ?? (activeVisitBalanceDue > 0 ? activeVisitBalanceDue : netBalanceDueNow)}
          onClose={() => {
            setShowRecordPaymentModal(false);
            setPaymentSessionTarget(null);
          }}
          onSuccess={() => {
            setShowRecordPaymentModal(false);
            setPaymentSessionTarget(null);
            if (selectedPhone) loadCustomerHistory(selectedPhone);
          }}
        />
      )}

      {/* MODAL 5: SETTLE OUTSTANDING BALANCE MODAL */}
      {showSettleModal && customerData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden p-5 space-y-4">
            <h3 className="font-bold text-sm text-slate-900">
              Settle Outstanding Balance for {customerData.customer.name}
            </h3>
            <p className="text-xs text-slate-600">
              Total outstanding balance to settle: <strong>₹{customerData.customer.currentUdharDue.toFixed(2)}</strong>.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSettleModal(false)}
                className="px-3 py-1.5 border border-slate-200 text-xs font-bold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSettleAllUdhar}
                disabled={settling}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
              >
                {settling ? 'Settling...' : 'Confirm Settle All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: OUTSTANDING BALANCE BREAKDOWN */}
      {showUdharBreakdown && customerData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center border border-rose-200 shadow-2xs">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 font-display">
                    Outstanding Balance Breakdown
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Total: <strong className="text-rose-700 font-display font-black text-sm">₹{customerData.customer.currentUdharDue.toFixed(2)}</strong> across past visits
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowUdharBreakdown(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-header instruction */}
            <div className="px-5 py-2.5 bg-blue-50/80 border-b border-blue-100 text-[11px] text-blue-900 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Click on any visit below to immediately jump into that day's workspace &amp; bill.</span>
            </div>

            {/* List of Credit Entries */}
            <div className="p-5 space-y-3 overflow-y-auto flex-1">
              {getUdharBreakdownList().length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-bold text-slate-700">All Clear!</p>
                  <p className="text-xs text-slate-500 mt-0.5">No outstanding credit records for this customer.</p>
                </div>
              ) : (
                getUdharBreakdownList().map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    onClick={() => handleJumpToUdharVisit({ date: item.date, visitId: item.sessionId })}
                    className="p-4 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 bg-white shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-4 group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-blue-600 text-slate-700 group-hover:text-white flex items-center justify-center font-bold text-xs font-mono transition-colors shrink-0 mt-0.5 shadow-2xs">
                        {item.visitNumber ? `V${item.visitNumber}` : 'CR'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900 group-hover:text-blue-950 transition-colors">
                            {item.formattedDate}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 group-hover:bg-blue-100 text-slate-700 group-hover:text-blue-800 font-mono transition-colors">
                            {item.visitNumber ? `Visit ${item.visitNumber}` : 'Manual Credit'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-1.5 flex-wrap">
                          <span>🕒 {item.timeStr}</span>
                          {item.notes && (
                            <>
                              <span>•</span>
                              <span>{item.notes}</span>
                            </>
                          )}
                          {typeof item.sessionTotal === 'number' && (
                            <>
                              <span>•</span>
                              <span>Bill: ₹{item.sessionTotal.toFixed(2)}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-extrabold text-rose-700 font-display">
                        ₹{item.amount.toFixed(2)}
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 group-hover:text-blue-800 mt-1">
                        <span>Open Visit</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowUdharBreakdown(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-200/50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>

              {customerData.customer.currentUdharDue > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowUdharBreakdown(false);
                    setShowSettleModal(true);
                  }}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Settle Outstanding Balance (₹{customerData.customer.currentUdharDue.toFixed(2)}) →</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default function CustomerHistoryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    }>
      <CustomerPageContent />
    </Suspense>
  );
}
