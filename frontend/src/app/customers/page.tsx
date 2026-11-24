'use client';

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { AddOrderModal } from '../../components/AddOrderModal';
import { RecordPaymentModal } from '../../components/RecordPaymentModal';
import { RegisterCustomerModal } from '../../components/RegisterCustomerModal';
import { VisitPaymentCloseModal } from '../../components/VisitPaymentCloseModal';
import { CustomerSettleBalanceModal } from '../../components/CustomerSettleBalanceModal';
import { TransferTableModal } from '../../components/TransferTableModal';
import { SplitTableModal } from '../../components/SplitTableModal';
import { RegisterWalkinModal } from '../../components/RegisterWalkinModal';
import { 
  Users, 
  Search, 
  UserPlus, 
  UserCheck,
  Phone, 
  Calendar, 
  Clock, 
  IndianRupee, 
  AlertCircle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronLeft,
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
  RotateCcw,
  ShoppingCart,
  ArrowRight,
  Info,
  Trash2
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
  paidAmount?: number;
  balanceDue?: number;
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

interface LegacySessionItem {
  id: string;
  startTime: string;
  endTime?: string;
  status: string;
  staffUsername?: string;
  tablesTotal: number;
  itemsTotal: number;
  customAmount: number;
  totalBill: number;
  paidAmount: number;
  balanceDue: number;
  paymentStatus: string;
  orders: {
    id: number;
    name: string;
    category?: string;
    price: number;
    quantity: number;
    total: number;
    createdAt?: string;
  }[];
  tablePlays: {
    id: string | number;
    tableName: string;
    gameType: string;
    playerCount: number;
    startTime: string;
    endTime?: string;
    cost: number;
    createdBy?: string;
  }[];
  payments: {
    id: number;
    amount: number;
    method: string;
    createdAt?: string;
  }[];
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
    totalLegacySessions?: number;
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
  legacySessions?: LegacySessionItem[];
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
  const [activeTab, setActiveTab] = useState<'today' | 'history' | 'legacy'>('today');
  const [legacySearchTerm, setLegacySearchTerm] = useState('');
  const [expandedLegacyIds, setExpandedLegacyIds] = useState<Set<string>>(new Set());

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
  const [showRegisterWalkinModal, setShowRegisterWalkinModal] = useState(false);
  const [registerWalkinTarget, setRegisterWalkinTarget] = useState<any | null>(null);
  const [paymentCloseModal, setPaymentCloseModal] = useState<{
    open: boolean;
    mode: 'all' | 'visit' | 'full' | 'partial';
    visitId: string;
    visitTotal: number;
    previousCreditDue?: number;
  } | null>(null);

  // Available floor tables for "+ Assign Table" modal
  const [floorTables, setFloorTables] = useState<any[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [assigningTableId, setAssigningTableId] = useState<number | null>(null);
  const [ps4PlayerCount, setPs4PlayerCount] = useState<number>(1);

  // Ending table play & deleting state
  const [endingPlayId, setEndingPlayId] = useState<string | number | null>(null);
  const [deletingPlayId, setDeletingPlayId] = useState<string | number | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<number | null>(null);
  const [settling, setSettling] = useState(false);
  const [closingVisit, setClosingVisit] = useState(false);

  // Table play Transfer & Split modal targets
  const [transferTargetPlay, setTransferTargetPlay] = useState<any | null>(null);
  const [splitTargetPlay, setSplitTargetPlay] = useState<any | null>(null);

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
  const handleAssignTableToCustomer = async (tableId: number, playerCount: number = 1) => {
    if (!customerData) return;
    try {
      setAssigningTableId(tableId);
      await api.post(`/tables/${tableId}/assign`, {
        customerId: customerData.customer.id,
        customerName: customerData.customer.name,
        customerPhone: customerData.customer.phone,
        playerCount
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

  // Delete table play entry from visit
  const handleDeleteTablePlay = async (sessionId: string, playId: string | number) => {
    if (!confirm('Are you sure you want to delete this table play entry from this visit?')) {
      return;
    }
    try {
      setDeletingPlayId(playId);
      await api.delete(`/visits/${sessionId}/table-play/${playId}`);
      if (selectedPhone) {
        await loadCustomerHistory(selectedPhone);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete table play entry');
    } finally {
      setDeletingPlayId(null);
    }
  };

  // Delete order item from visit
  const handleDeleteOrder = async (orderId: number) => {
    if (!confirm('Are you sure you want to remove this item from this visit?')) {
      return;
    }
    try {
      setDeletingOrderId(orderId);
      await api.delete(`/orders/${orderId}`);
      if (selectedPhone) {
        await loadCustomerHistory(selectedPhone);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to remove order item');
    } finally {
      setDeletingOrderId(null);
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

  // Calendar popover & month view state
  const [showDatePickerPopover, setShowDatePickerPopover] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const calendarPopoverRef = useRef<HTMLDivElement>(null);

  // Close calendar popover on click outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (calendarPopoverRef.current && !calendarPopoverRef.current.contains(event.target as Node)) {
        setShowDatePickerPopover(false);
      }
    };
    if (showDatePickerPopover) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showDatePickerPopover]);

  // Map of visited dates for fast lookup & visual highlights
  const visitedDatesMap = useMemo(() => {
    const map = new Map<string, DayTimeline>();
    if (customerData?.timeline) {
      for (const day of customerData.timeline) {
        if (day.visits && day.visits.length > 0) {
          map.set(day.date, day);
        }
      }
    }
    return map;
  }, [customerData]);

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

  // Outstanding Udhar from visits OTHER than this selected visit (avoids double-counting if selected visit is closed)
  const otherVisitsCreditRecords = (customerData?.customer?.unpaidCreditsBreakdown || []).filter(
    (cr: any) => cr.visitId !== selectedVisit?.id
  );
  const selectedVisitPreviousCreditDue = otherVisitsCreditRecords.reduce(
    (sum: number, cr: any) => sum + (cr.due ?? (cr.amount - (cr.settledAmount || 0))),
    0
  );
  const selectedVisitGrandTotal = Math.round((selectedVisitBalanceDue + selectedVisitPreviousCreditDue) * 100) / 100;

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

      {/* TOP BAR */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 shadow-sm sticky top-14 md:top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5 text-xs font-bold"
              title="Return to Floor Plan"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span>Back to Floor Plan</span>
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
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-500 bg-slate-100 border border-slate-200">
                    {customerData.customer.phone.startsWith('WALK-') ? `Walk-in #${customerData.customer.id}` : `#CUST-${String(customerData.customer.id).padStart(3, '0')}`}
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
              <span>Register New Customer</span>
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
                        <h2 className="text-xl font-bold text-slate-900 font-display">
                          {customerData.customer.name}
                        </h2>
                        {customerData.customer.phone.startsWith('WALK-') ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                              Walk-in #{customerData.customer.id}
                            </span>
                            <button
                              type="button"
                              onClick={() => setRegisterWalkinTarget(customerData.customer)}
                              className="text-xs font-semibold text-slate-900 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2.5 py-0.5 rounded-md transition-colors cursor-pointer"
                            >
                              + Add Phone
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-mono text-slate-400">
                            #CUST-{String(customerData.customer.id).padStart(3, '0')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1.5 font-mono">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{customerData.customer.phone.startsWith('WALK-') ? 'Walk-in (No Phone)' : customerData.customer.phone}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {customerData.customer.phone.startsWith('WALK-') ? 'First visit ' : 'Member since '}
                          {new Date(customerData.customer.memberSince).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <span>•</span>
                        <span>{customerData.customer.totalVisits} Lifetime Visits</span>
                        <span>•</span>

                        {/* CALENDAR DATE SELECTOR */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Interactive Date Picker with Custom Calendar Popover */}
                          <div className="relative" ref={calendarPopoverRef}>
                            <button
                              type="button"
                              onClick={() => {
                                if (!showDatePickerPopover) {
                                  try {
                                    const [y, m] = (selectedDate || todayStr).split('-').map(Number);
                                    if (y && m) setCalendarMonth(new Date(y, m - 1, 1));
                                  } catch {}
                                }
                                setShowDatePickerPopover((v) => !v);
                              }}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 hover:border-blue-500 text-slate-800 text-xs font-bold cursor-pointer shadow-2xs transition-all group"
                              title="Click to choose a visit date from the calendar"
                            >
                              <Calendar className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
                              <span>Date: <strong className="text-slate-900 font-black">{formatDisplayDate(selectedDate)}</strong></span>
                              {isViewingToday ? (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-100 text-emerald-800 font-mono font-bold">
                                  Today
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-blue-100 text-blue-800 font-mono font-bold">
                                  Visited Date
                                </span>
                              )}
                              <ChevronDown className={`w-3 h-3 text-slate-400 group-hover:text-slate-700 transition-transform ${showDatePickerPopover ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Calendar Popover (Only Visited Dates are Active) */}
                            {showDatePickerPopover && (
                              <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 w-72 sm:w-80 space-y-3 animate-in fade-in zoom-in-95 duration-100">
                                {/* Month Navigation Header */}
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                  <button
                                    type="button"
                                    onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                                    title="Previous Month"
                                  >
                                    <ChevronLeft className="w-4 h-4" />
                                  </button>

                                  <div className="text-center">
                                    <span className="text-xs font-extrabold text-slate-900 font-display">
                                      {calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                                    title="Next Month"
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* Month Days Grid & Footer */}
                                {(() => {
                                  const calYear = calendarMonth.getFullYear();
                                  const calMonth = calendarMonth.getMonth();
                                  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();
                                  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                                  const calMonthName = calendarMonth.toLocaleDateString('en-IN', { month: 'long' });
                                  const currentMonthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;

                                  let currentMonthVisitsCount = 0;
                                  let currentMonthVisitedDatesCount = 0;

                                   visitedDatesMap.forEach((dayData, dateStr) => {
                                     if (dateStr.startsWith(currentMonthPrefix)) {
                                       currentMonthVisitedDatesCount++;
                                       currentMonthVisitsCount += (dayData.visits?.length || 0);
                                     }
                                   });

                                  return (
                                    <>
                                      <div className="space-y-2">
                                        {/* Weekday headers */}
                                        <div className="grid grid-cols-7 gap-1 text-center">
                                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((dayName) => (
                                            <span key={dayName} className="text-[10px] font-bold text-slate-400 font-mono uppercase">
                                              {dayName}
                                            </span>
                                          ))}
                                        </div>

                                        {/* Days grid */}
                                        <div className="grid grid-cols-7 gap-1">
                                          {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                                            <div key={`blank-${idx}`} className="w-8 h-8 sm:w-9 sm:h-9" />
                                          ))}

                                          {Array.from({ length: daysInMonth }).map((_, idx) => {
                                            const dayNum = idx + 1;
                                            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                                            const hasVisited = visitedDatesMap.has(dateStr);
                                            const isToday = dateStr === todayStr;
                                            const isSelected = dateStr === selectedDate;
                                            const dayTimeline = visitedDatesMap.get(dateStr);
                                            const visitsCount = dayTimeline?.visits?.length || 0;
                                            const isEnabled = hasVisited || isToday;

                                            if (!isEnabled) {
                                              return (
                                                <div
                                                  key={dateStr}
                                                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-xs text-slate-300 bg-slate-50/40 select-none cursor-not-allowed"
                                                  title="No visits on this date"
                                                >
                                                  {dayNum}
                                                </div>
                                              );
                                            }

                                            return (
                                              <button
                                                key={dateStr}
                                                type="button"
                                                onClick={() => {
                                                  setSelectedDate(dateStr);
                                                  setSelectedDateManuallyChanged(true);
                                                  setActiveTab('today');
                                                  setShowDatePickerPopover(false);
                                                }}
                                                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex flex-col items-center justify-center text-xs transition-all cursor-pointer relative ${
                                                  isSelected
                                                    ? 'bg-slate-900 text-white font-black shadow-xs ring-2 ring-slate-900 ring-offset-1 z-10'
                                                    : hasVisited
                                                    ? 'bg-blue-50 text-blue-900 font-bold border border-blue-200 hover:bg-blue-100 hover:border-blue-400'
                                                    : 'border border-dashed border-emerald-400 text-emerald-800 hover:bg-emerald-50 font-bold'
                                                }`}
                                                title={
                                                  hasVisited
                                                    ? `${visitsCount} visit${visitsCount > 1 ? 's' : ''} on ${formatDisplayDate(dateStr)}`
                                                    : 'Today (No visits recorded yet)'
                                                }
                                              >
                                                <span className="leading-none">{dayNum}</span>
                                                {hasVisited && (
                                                  <span
                                                    className={`w-1 h-1 rounded-full mt-0.5 ${
                                                      isSelected ? 'bg-blue-400' : 'bg-blue-600'
                                                    }`}
                                                  />
                                                )}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      {/* Popover Legend with Month-wise visit count */}
                                      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                                          <span className="font-semibold text-slate-700">
                                            {currentMonthVisitsCount > 0
                                              ? `${currentMonthVisitsCount} visit${currentMonthVisitsCount !== 1 ? 's' : ''} in ${calMonthName}`
                                              : `0 visits in ${calMonthName}`}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1 text-slate-400">
                                          <span className="w-2 h-2 rounded-sm bg-slate-100 border border-slate-200 inline-block"></span>
                                          <span>Disabled (No Visit)</span>
                                        </div>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>

                          {/* Reset to Today Button */}
                          {!isViewingToday && (
                            <button
                              onClick={() => {
                                setSelectedDate(todayStr);
                                setSelectedDateManuallyChanged(false);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border border-blue-200 shadow-2xs"
                              title="Reset view back to today"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reset to Today</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4 Clean Customer KPI Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Card 1: Total Unpaid (Udhar) */}
                  <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                    customerData.customer.currentUdharDue > 0 
                      ? 'bg-rose-50/70 border-rose-200 text-rose-900' 
                      : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider block font-mono">
                          Outstanding Balance
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowUdharBreakdown(true)}
                          className={`w-5 h-5 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                            customerData.customer.currentUdharDue > 0
                              ? 'bg-rose-200/80 hover:bg-rose-300 text-rose-900'
                              : 'bg-emerald-200/80 hover:bg-emerald-300 text-emerald-900'
                          }`}
                          title="Click (i) to view dates breakdown of unpaid balance"
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

                  {/* Card 2: Today / Selected Date Spend */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
                        {isViewingToday ? "Today's Spend" : `Spend on ${formatDisplayDate(selectedDate)}`}
                      </span>
                      <span className="text-xl font-extrabold text-slate-900 mt-1 block font-display">
                        ₹{dayTotalBilled.toFixed(2)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold mt-2 block font-mono">
                      Tables ₹{dayGameSubtotal.toFixed(0)} • Items ₹{dayCafeSubtotal.toFixed(0)}
                    </span>
                  </div>

                  {/* Card 3: Lifetime Spend */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
                        Lifetime Spend
                      </span>
                      <span className="text-xl font-extrabold text-slate-900 mt-1 block font-display">
                        ₹{(customerData.customer.lifetimeSpend || 0).toFixed(2)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold mt-2 block">
                      Total lounge expenditure
                    </span>
                  </div>

                  {/* Card 4: Total Visits */}
                  <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col justify-between shadow-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                        Visit History
                      </span>
                      <span className="text-xl font-black text-white mt-1 block font-display">
                        {customerData.customer.totalVisits} Visits
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-300 font-medium mt-2 block">
                      {customerData.legacySessions && customerData.legacySessions.length > 0 ? (
                        <span className="text-purple-300 font-bold">
                          +{customerData.legacySessions.length} Past Sessions in Archive
                        </span>
                      ) : (
                        <span>Member since {new Date(customerData.customer.memberSince).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* View Switcher Tabs & Quick Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setActiveTab('today')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      activeTab === 'today'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {isViewingToday
                        ? "Today's Activity"
                        : `Activity on ${formatDisplayDate(selectedDate)}`}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      activeTab === 'history'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Visit Timeline</span>
                    {customerData.timeline.length > 0 && (
                      <span className={`px-2 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                        activeTab === 'history' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {customerData.timeline.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('legacy')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      activeTab === 'legacy'
                        ? 'bg-purple-900 text-white shadow-xs'
                        : 'bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-purple-400" />
                    <span>Past Session Archive</span>
                    {customerData.legacySessions && customerData.legacySessions.length > 0 && (
                      <span className={`px-2 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                        activeTab === 'legacy' ? 'bg-purple-800 text-purple-200' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {customerData.legacySessions.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Direct Action Buttons */}
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => {
                      loadFloorTables();
                      setShowAssignTableModal(true);
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>Assign Table</span>
                  </button>

                  <button
                    onClick={handleOpenAddOrder}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-white" />
                    <span>Add Item / Order</span>
                  </button>
                </div>
              </div>

              {/* TAB 1: TABLES, CAFE ORDERS & BILL SUMMARY */}
              {activeTab === 'today' && (
                <div className="space-y-6">

                  {/* SECONDARY VISIT SWITCHER (Only shown when there are 2+ visits on this date) */}
                  {currentVisits.length > 1 && (
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono mr-1">
                        Switch Visit:
                      </span>
                      {currentVisits.map((v, idx) => {
                        const vNum = idx + 1;
                        const isSelected = selectedVisit?.id === v.id;
                        const startTimeStr = new Date(v.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const isQuickSale = v.id?.startsWith('QS_');

                        return (
                          <button
                            key={v.id}
                            onClick={() => setSelectedVisitId(v.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <span>{isQuickSale ? `Quick Sale` : `Visit ${vNum}`}</span>
                            <span className={`text-[10px] font-mono ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                              ({startTimeStr})
                            </span>
                            {!v.endTime ? (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500 text-white font-mono font-bold">
                                Open
                              </span>
                            ) : isQuickSale ? (
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold ${isSelected ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                                Counter
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* ====================================================================== */}
                  {/* SINGLE BIG SECTION: SELECTED VISIT ACTIVITY & VISIT BILL SUMMARY       */}
                  {/* ====================================================================== */}
                  {selectedVisit ? (
                    <div id="selected-visit-container" className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-0 scroll-mt-24">
                      
                      {/* VISIT HEADER STRIP: Title, Status Badge, Timestamps */}
                      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-700">
                        <div className="flex items-center gap-2.5">
                          <span className="font-extrabold text-slate-900 font-display text-base">
                            {selectedVisit.id?.startsWith('QS_') ? 'Quick Sale (Counter Order)' : `Visit ${selectedVisitNumber} Activity`}
                          </span>
                          {!selectedVisit.endTime ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                              Open
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 font-mono">
                              Closed
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

                      {/* VISIT INTERNAL CONTENT (Side-by-Side: Tables on Left, Items on Right, and Compact Bill) */}
                      <div className="p-5 space-y-4">

                        {/* SIDE BY SIDE: Tables on Left, Orders/Items on Right */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

                          {/* LEFT COLUMN: TABLE ASSIGNED / FLOOR TABLES */}
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
                            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80">
                              <div>
                                <h3 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2">
                                  <Gamepad2 className="w-4 h-4 text-blue-600" />
                                  <span>Assigned Tables — Visit {selectedVisitNumber}</span>
                                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-mono text-xs font-bold">
                                    ₹{displayGameSubtotal.toFixed(2)}
                                  </span>
                                </h3>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  {isSelectedVisitReadOnly
                                    ? `Tables played in Visit ${selectedVisitNumber} (Archive)`
                                    : `Billiard, snooker & gaming stations`}
                                </p>
                              </div>
                            </div>

                            {displayTablePlays.length === 0 ? (
                              <div className="py-7 text-center text-slate-400 text-xs bg-white rounded-xl border border-dashed border-slate-200">
                                <p>No tables currently playing for <strong>{customerData.customer.name}</strong>.</p>
                                <p className="text-[11px] text-slate-400 mt-1">Use the <strong>[+ Assign Table]</strong> button above to start a station.</p>
                              </div>
                            ) : (
                              <div className="space-y-2.5">
                                {displayTablePlays.map((tp) => {
                                  const isLive = !tp.endTime;
                                  const elapsedMins = Math.floor(
                                    (Date.now() - new Date(tp.startTime).getTime()) / (1000 * 60)
                                  );

                                  return (
                                    <div
                                      key={tp.id}
                                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                                        isLive
                                          ? 'bg-blue-50/70 border-blue-200 shadow-2xs'
                                          : 'bg-white border-slate-200 hover:border-slate-300'
                                      }`}
                                    >
                                      {/* Left Info: Table Name, Status Badge, Timestamps */}
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <h4 className="font-bold text-sm text-slate-900">{tp.tableName}</h4>
                                          {isLive ? (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse font-mono">
                                              ● Running Now
                                            </span>
                                          ) : (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                                              Completed
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                          Started: <strong className="text-slate-800">{new Date(tp.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
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

                                      {/* Right Info & Actions: Cost, Duration, Stop (if live), Trash Icon */}
                                      <div className="flex items-center gap-3 shrink-0">
                                        <div className="text-right">
                                          <span className="text-base font-extrabold text-slate-900 font-display block leading-tight">
                                            ₹{tp.cost.toFixed(2)}
                                          </span>
                                          {isLive ? (
                                            <span className="text-[10px] text-blue-700 font-bold font-mono">
                                              ⏱ {elapsedMins} mins elapsed
                                            </span>
                                          ) : (
                                            <span className="text-[10px] text-slate-400 font-mono">
                                              {Math.max(1, Math.round((new Date(tp.endTime!).getTime() - new Date(tp.startTime).getTime()) / 60000))} mins
                                            </span>
                                          )}
                                        </div>

                                        {isLive && isSelectedVisitActive && selectedVisit && (
                                          <button
                                            onClick={() => handleStopTablePlay(selectedVisit.id, tp.id)}
                                            disabled={endingPlayId === tp.id}
                                            className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                                            title="Stop Table Play"
                                          >
                                            <Square className="w-3 h-3 fill-white" />
                                            <span className="hidden sm:inline">{endingPlayId === tp.id ? 'Stopping...' : 'Stop'}</span>
                                          </button>
                                        )}

                                        {/* Transfer Table to Another Player (Loser Pays) */}
                                        {isSelectedVisitActive && (
                                          <button
                                            onClick={() => setTransferTargetPlay(tp)}
                                            className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                                            title="Transfer Table Charge to Co-Player (Loser Pays)"
                                          >
                                            <ArrowRightLeft className="w-4 h-4" />
                                          </button>
                                        )}

                                        {/* Split Table Bill with Co-Players */}
                                        {isSelectedVisitActive && (
                                          <button
                                            onClick={() => setSplitTargetPlay(tp)}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                            title="Split Table Bill with Co-Players"
                                          >
                                            <Users className="w-4 h-4" />
                                          </button>
                                        )}

                                        {/* Compact Delete Table Button - Icon Only */}
                                        <button
                                          onClick={() => handleDeleteTablePlay(selectedVisit.id, tp.id)}
                                          disabled={deletingPlayId === tp.id}
                                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                          title="Delete Table Entry"
                                        >
                                          {deletingPlayId === tp.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                                          ) : (
                                            <Trash2 className="w-4 h-4" />
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* RIGHT COLUMN: ITEMS / CAFE ORDERS */}
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
                            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80">
                              <div>
                                <h3 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2">
                                  <Coffee className="w-4 h-4 text-amber-700" />
                                  <span>Items Ordered — Visit {selectedVisitNumber}</span>
                                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-mono text-xs font-bold">
                                    ₹{displayCafeSubtotal.toFixed(2)}
                                  </span>
                                </h3>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  {isSelectedVisitReadOnly
                                    ? `Items logged during Visit ${selectedVisitNumber} (Archive)`
                                    : `Drinks, snacks, and food logged to Visit ${selectedVisitNumber}`}
                                </p>
                              </div>
                            </div>

                            {displayOrders.length === 0 ? (
                              <div className="py-7 text-center text-slate-400 text-xs bg-white rounded-xl border border-dashed border-slate-200">
                                <p>No items ordered yet for <strong>{customerData.customer.name}</strong>.</p>
                                <p className="text-[11px] text-slate-400 mt-1">Use the <strong>[+ Add Item / Order]</strong> button above to add drinks or snacks.</p>
                              </div>
                            ) : (
                              <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
                                <table className="w-full text-xs text-left">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                                      <th className="py-2.5 px-3">Item</th>
                                      <th className="py-2.5 px-2.5 text-right">Qty</th>
                                      <th className="py-2.5 px-2.5 text-right">Price</th>
                                      <th className="py-2.5 px-2.5 text-right">Total</th>
                                      <th className="py-2.5 px-2.5 text-right">Time</th>
                                      {isSelectedVisitActive && (
                                        <th className="py-2.5 px-2 text-center w-8"></th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {displayOrders.map((order) => (
                                      <tr key={order.id} className="hover:bg-slate-50 font-medium">
                                        <td className="py-2.5 px-3 font-bold text-slate-900">{order.name}</td>
                                        <td className="py-2.5 px-2.5 text-right font-mono font-bold">{order.quantity}</td>
                                        <td className="py-2.5 px-2.5 text-right font-mono text-slate-500">₹{order.price.toFixed(2)}</td>
                                        <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-900">₹{order.total.toFixed(2)}</td>
                                        <td className="py-2.5 px-2.5 text-right text-[10px] text-slate-400 font-mono">
                                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        {isSelectedVisitActive && (
                                          <td className="py-2.5 px-2 text-center">
                                            <button
                                              onClick={() => handleDeleteOrder(order.id)}
                                              disabled={deletingOrderId === order.id}
                                              title="Remove this item"
                                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                        </div>

                        {/* COMPACT BILL SUMMARY FOR THIS VISIT */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                              <Receipt className="w-4 h-4 text-slate-700" />
                              <h3 className="text-sm font-bold text-slate-900 font-display">
                                Bill Summary — Visit {selectedVisitNumber}
                              </h3>
                            </div>

                            {/* Paid or Not Paid Status Badge */}
                            {selectedVisitTotal === 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 font-mono">
                                ₹0.00
                              </span>
                            ) : selectedVisitBalanceDue === 0 ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                                ✓ Paid in Full
                              </span>
                            ) : selectedVisitPaid > 0 ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 font-mono">
                                ● Partially Paid (₹{selectedVisitPaid.toFixed(2)} Paid • ₹{selectedVisitBalanceDue.toFixed(2)} Remaining)
                              </span>
                            ) : !isSelectedVisitActive ? (
                              selectedVisit.paymentStatus === 'unsettled' ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 font-mono">
                                  ● Unsettled at Cutoff (Due ₹{selectedVisitBalanceDue.toFixed(2)})
                                </span>
                              ) : selectedVisit.paymentStatus === 'loss' ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                                  ● Walk-in Loss
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 font-mono">
                                  ● Unpaid (Due ₹{selectedVisitBalanceDue.toFixed(2)})
                                </span>
                              )
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 font-mono">
                                ● Running Tab (Due ₹{selectedVisitBalanceDue.toFixed(2)})
                              </span>
                            )}
                          </div>

                          {/* SINGLE-COLUMN ITEMIZED RECEIPT BREAKDOWN */}
                          {(() => {
                            const customerCreditDue = selectedVisitPreviousCreditDue;
                            const grandTotalCollectible = selectedVisitGrandTotal;

                            return (
                              <div className="space-y-1.5 py-1 text-xs">
                                {/* 1. Tables Total */}
                                <div className="flex items-center justify-between py-1 text-slate-600 border-b border-slate-100">
                                  <span>Tables / Gaming Total:</span>
                                  <span className="font-mono font-bold text-slate-900">₹{displayGameSubtotal.toFixed(2)}</span>
                                </div>

                                {/* 2. Items / Cafe Orders Total */}
                                <div className="flex items-center justify-between py-1 text-slate-600 border-b border-slate-100">
                                  <span>Items / Cafe Orders Total:</span>
                                  <span className="font-mono font-bold text-slate-900">₹{displayCafeSubtotal.toFixed(2)}</span>
                                </div>

                                {/* 3. Current Visit Bill */}
                                <div className="flex items-center justify-between py-1.5 text-slate-900 font-bold border-b border-slate-100">
                                  <span>Current Visit Bill:</span>
                                  <span className="font-mono text-sm font-extrabold text-slate-900">₹{selectedVisitTotal.toFixed(2)}</span>
                                </div>

                                {/* 4. Advance Paid Today (Only shown if payment was already made earlier in the visit) */}
                                {selectedVisitPaid > 0 && (
                                  <div className="flex items-center justify-between py-1 text-emerald-700 font-bold border-b border-slate-100">
                                    <span>Advance Paid Today:</span>
                                    <span className="font-mono text-sm font-extrabold text-emerald-700">-₹{selectedVisitPaid.toFixed(2)}</span>
                                  </div>
                                )}

                                {/* 5. Remaining for this visit (Only shown if advance was paid) */}
                                {selectedVisitPaid > 0 && (
                                  <div className="flex items-center justify-between py-1 text-slate-700 font-semibold border-b border-slate-100">
                                    <span>Remaining Visit Bill:</span>
                                    <span className="font-mono text-sm font-bold text-slate-900">₹{selectedVisitBalanceDue.toFixed(2)}</span>
                                  </div>
                                )}

                                {/* 6. Previous Udhar / Credit (Only shown if customer owes past credit from other visits) */}
                                {customerCreditDue > 0 && (
                                  <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900">
                                    <span className="font-medium">+ Previous Outstanding Udhar (Credit):</span>
                                    <span className="font-mono text-sm font-bold text-amber-900">+₹{customerCreditDue.toFixed(2)}</span>
                                  </div>
                                )}

                                {/* 7. Final Grand Total Row */}
                                <div className="flex items-center justify-between py-2.5 px-3 bg-slate-50 rounded-xl border border-slate-200 mt-2">
                                  <div className="flex flex-col">
                                    <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-600">
                                      {customerCreditDue > 0 ? "Total to Collect (Visit + Udhar):" : (selectedVisitBalanceDue > 0 ? "Remaining Balance to Pay:" : "Final Balance:")}
                                    </span>
                                    {customerCreditDue > 0 && (
                                      <span className="text-[11px] text-slate-500 font-mono mt-0.5">
                                        ₹{selectedVisitBalanceDue.toFixed(2)} visit + ₹{customerCreditDue.toFixed(2)} previous udhar
                                      </span>
                                    )}
                                  </div>
                                  <span className={`font-mono text-xl font-black ${customerCreditDue > 0 ? "text-slate-900" : (selectedVisitBalanceDue > 0 ? "text-rose-700" : "text-emerald-700")}`}>
                                    ₹{(customerCreditDue > 0 ? grandTotalCollectible : selectedVisitBalanceDue).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}

                          {/* FULL PAYMENT & PARTIAL PAYMENT ACTION BUTTONS */}
                          {(() => {
                            const customerCreditDue = selectedVisitPreviousCreditDue;
                            const grandTotalCollectible = selectedVisitGrandTotal;

                            return isSelectedVisitActive ? (
                              <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                {selectedVisitBalanceDue > 0 ? (
                                  customerCreditDue > 0 ? (
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPaymentCloseModal({
                                            open: true,
                                            mode: 'all',
                                            visitId: selectedVisit.id,
                                            visitTotal: selectedVisitBalanceDue,
                                            previousCreditDue: customerCreditDue
                                          });
                                        }}
                                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-2"
                                      >
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        <span>Pay All ₹{grandTotalCollectible.toFixed(2)} (Visit + Udhar)</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPaymentCloseModal({
                                            open: true,
                                            mode: 'visit',
                                            visitId: selectedVisit.id,
                                            visitTotal: selectedVisitBalanceDue,
                                            previousCreditDue: customerCreditDue
                                          });
                                        }}
                                        className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 active:scale-95 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer flex items-center gap-2"
                                      >
                                        <span>Pay Visit Only (₹{selectedVisitBalanceDue.toFixed(2)})</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPaymentCloseModal({
                                            open: true,
                                            mode: 'partial',
                                            visitId: selectedVisit.id,
                                            visitTotal: selectedVisitBalanceDue,
                                            previousCreditDue: customerCreditDue
                                          });
                                        }}
                                        className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 active:scale-95 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer flex items-center gap-2"
                                      >
                                        <CreditCard className="w-4 h-4 text-slate-500" />
                                        <span>Custom Amount</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPaymentCloseModal({
                                            open: true,
                                            mode: 'visit',
                                            visitId: selectedVisit.id,
                                            visitTotal: selectedVisitBalanceDue,
                                            previousCreditDue: 0
                                          });
                                        }}
                                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-2"
                                      >
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        <span>Full Payment (₹{selectedVisitBalanceDue.toFixed(2)})</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPaymentCloseModal({
                                            open: true,
                                            mode: 'partial',
                                            visitId: selectedVisit.id,
                                            visitTotal: selectedVisitBalanceDue,
                                            previousCreditDue: 0
                                          });
                                        }}
                                        className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 active:scale-95 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer flex items-center gap-2"
                                      >
                                        <CreditCard className="w-4 h-4 text-slate-500" />
                                        <span>Partial Payment</span>
                                      </button>
                                    </div>
                                  )
                                ) : (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => handleCloseVisit(selectedVisit.id, 0, selectedVisitNumber)}
                                      disabled={closingVisit}
                                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-2"
                                    >
                                      <Check className="w-4 h-4 text-emerald-400" />
                                      <span>{closingVisit ? 'Closing...' : 'Close Visit'}</span>
                                    </button>
                                    {customerCreditDue > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => setShowSettleModal(true)}
                                        className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                                      >
                                        <span>Settle Outstanding Udhar (₹{customerCreditDue.toFixed(2)})</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : null;
                          })()}

                          {!isSelectedVisitActive && selectedVisit.endTime && (
                            <div className="pt-2 text-xs text-slate-500 font-mono flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>✓ Visit Closed at {new Date(selectedVisit.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {selectedVisitBalanceDue > 0 ? (
                                  (customerData.customer.phone.startsWith('WALK-') || selectedVisit.paymentStatus === 'unsettled') ? (
                                    <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                      Unsettled Walk-in Bill (₹{selectedVisitBalanceDue.toFixed(2)})
                                    </span>
                                  ) : selectedVisit.paymentStatus === 'loss' ? (
                                    <span className="text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                      Written off as Walk-in Loss
                                    </span>
                                  ) : (
                                    <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                      Unpaid ₹{selectedVisitBalanceDue.toFixed(2)} recorded to Outstanding Balance
                                    </span>
                                  )
                                ) : (
                                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                    Paid in Full
                                  </span>
                                )}
                              </div>

                              {selectedVisitBalanceDue > 0 && (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPaymentCloseModal({
                                        open: true,
                                        mode: selectedVisitPreviousCreditDue > 0 ? 'all' : 'full',
                                        visitId: selectedVisit.id,
                                        visitTotal: selectedVisitBalanceDue,
                                        previousCreditDue: selectedVisitPreviousCreditDue
                                      });
                                    }}
                                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-2xs"
                                  >
                                    Settle Payment
                                  </button>
                                  {(customerData.customer.phone.startsWith('WALK-') || selectedVisit.paymentStatus === 'unsettled') && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (confirm(`Write off this ₹${selectedVisitBalanceDue.toFixed(2)} unpaid walk-in bill as loss?`)) {
                                          try {
                                            await api.post(`/visits/${selectedVisit.id}/mark-loss`, {});
                                            if (selectedPhone) await loadCustomerHistory(selectedPhone);
                                          } catch (err: any) {
                                            alert(err.message || 'Failed to mark as loss');
                                          }
                                        }
                                      }}
                                      className="px-2.5 py-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                                    >
                                      Mark as Loss
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                        <Coffee className="w-6 h-6 text-slate-400" />
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 font-display">
                        No visits recorded {isViewingToday ? 'today' : `on ${formatDisplayDate(selectedDate)}`}
                      </h3>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Use the <strong>[+ Assign Table]</strong> or <strong>[+ Add Item / Order]</strong> buttons above to start activity. A visit is automatically created.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: LIFETIME DAY-WISE HISTORY */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  {customerData.timeline.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 text-xs bg-white rounded-2xl border border-slate-200 space-y-2">
                      <p className="font-bold text-slate-800 text-sm">No new visits recorded yet in this software.</p>
                      <p className="text-slate-500 max-w-md mx-auto">
                        Real visits will appear here as they occur. All historical lounge sessions prior to release are safely preserved in the <strong>Past Session Archive</strong> tab.
                      </p>
                      {customerData.legacySessions && customerData.legacySessions.length > 0 && (
                        <div className="pt-2">
                          <button
                            onClick={() => setActiveTab('legacy')}
                            className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                          >
                            <FileText className="w-3.5 h-3.5 text-purple-600" />
                            <span>View {customerData.legacySessions.length} Past Archived Sessions →</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    customerData.timeline.map((day) => {
                      const dayPaid = day.visits.reduce((sum, v) => sum + (v.paidAmount ?? v.payments.reduce((s, p) => s + (p.amount || 0), 0)), 0);
                      const dayRemaining = day.visits.reduce((sum, v) => sum + (v.balanceDue ?? Math.max(0, v.totalBill - (v.paidAmount || 0))), 0);

                      return (
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

                            <div className="text-right">
                              <span className="text-sm font-extrabold text-slate-900 font-display block">
                                Total: ₹{day.totalDayBill.toFixed(2)}
                              </span>
                              <div className="flex items-center gap-2 justify-end mt-0.5">
                                <span className="text-[11px] text-emerald-700 font-bold font-mono">
                                  Paid: ₹{dayPaid.toFixed(2)}
                                </span>
                                {dayRemaining > 0 && (
                                  <span className="text-[11px] text-rose-700 font-black font-mono bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                    Remaining: ₹{dayRemaining.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Itemized day details */}
                          <div className="space-y-3">
                            {day.visits.map((v, vIdx) => {
                              const vPaid = v.paidAmount ?? v.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
                              const vRemaining = Math.max(0, v.totalBill - vPaid);
                              const isPartiallyPaid = vPaid > 0 && vRemaining > 0;
                              const isUnpaid = vPaid === 0 && vRemaining > 0;
                              const isFullyPaid = vRemaining === 0 && v.totalBill > 0;

                              return (
                                <div
                                  key={v.id || vIdx}
                                  className={`p-4 rounded-xl border text-xs space-y-2.5 transition-all ${
                                    vRemaining > 0
                                      ? 'bg-rose-50/30 border-rose-200'
                                      : 'bg-slate-50 border-slate-200'
                                  }`}
                                >
                                  {/* Visit Header: Time, Status & Red Remaining Amount */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200/60 gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-slate-900 text-xs font-display">
                                        {v.id?.startsWith('QS_') ? 'Quick Sale' : `Visit ${vIdx + 1}`} at {new Date(v.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      {v.id?.startsWith('QS_') && (
                                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                                          Counter
                                        </span>
                                      )}
                                      {v.endTime && (
                                        <span className="text-[10px] text-slate-500 font-mono">
                                          (Closed {new Date(v.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                        </span>
                                      )}

                                      {isUnpaid ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 font-mono">
                                          ● Unpaid
                                        </span>
                                      ) : isPartiallyPaid ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 font-mono">
                                          ● Partially Paid
                                        </span>
                                      ) : isFullyPaid ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                                          ✓ Paid
                                        </span>
                                      ) : null}
                                    </div>

                                    {/* Bill & Red Colour Remaining Amount */}
                                    <div className="flex items-center gap-2.5 font-mono text-xs flex-wrap">
                                      <span className="text-slate-600">
                                        Bill: <strong className="text-slate-900">₹{v.totalBill.toFixed(2)}</strong>
                                      </span>
                                      {vPaid > 0 && (
                                        <span className="text-emerald-700 font-bold">
                                          Paid: ₹{vPaid.toFixed(2)}
                                        </span>
                                      )}
                                      {vRemaining > 0 && (
                                        <span className="text-rose-700 font-black bg-rose-100/90 px-2 py-0.5 rounded-md border border-rose-300 text-xs shadow-2xs">
                                          Remaining: ₹{vRemaining.toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {v.tablePlays.length > 0 && (
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-bold uppercase text-slate-400 font-mono">Tables Played:</span>
                                      {v.tablePlays.map(tp => (
                                        <div key={tp.id} className="flex justify-between text-slate-600">
                                          <span className="flex items-center gap-1.5"><Gamepad2 className="w-3 h-3 text-slate-400" /> {tp.tableName}</span>
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
                                          <span className="flex items-center gap-1.5"><Coffee className="w-3 h-3 text-slate-400" /> {o.quantity}x {o.name}</span>
                                          <span className="font-mono">₹{o.total.toFixed(2)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 3: PAST SESSION ARCHIVE */}
              {activeTab === 'legacy' && (
                <div className="space-y-4">
                  {/* Archive Banner */}
                  <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-purple-950 font-display">
                          Past Session Archive (Pre-Cutover History)
                        </h3>
                        <p className="text-xs text-purple-800/80 mt-0.5 max-w-xl">
                          All historical sessions imported from the original Rebound system with itemized orders, tables played, and payments. Any unpaid balances were carried forward into <strong>Outstanding Balance</strong>.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-center font-mono text-xs">
                      <span className="px-3 py-1.5 rounded-xl bg-white border border-purple-200 text-purple-900 font-bold shadow-2xs">
                        {customerData.legacySessions?.length || 0} Archived Sessions
                      </span>
                    </div>
                  </div>

                  {/* Search inside archive if many sessions */}
                  {(customerData.legacySessions?.length || 0) > 3 && (
                    <div className="relative">
                      <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Filter archived sessions by item name, table, staff, or date..."
                        value={legacySearchTerm}
                        onChange={(e) => setLegacySearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-medium"
                      />
                    </div>
                  )}

                  {/* Sessions List */}
                  {(!customerData.legacySessions || customerData.legacySessions.length === 0) ? (
                    <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
                      No historical sessions found for this customer.
                    </div>
                  ) : (
                    customerData.legacySessions
                      .filter(ls => {
                        if (!legacySearchTerm.trim()) return true;
                        const term = legacySearchTerm.toLowerCase();
                        const matchId = ls.id.toLowerCase().includes(term);
                        const matchStaff = (ls.staffUsername || '').toLowerCase().includes(term);
                        const matchOrders = ls.orders.some(o => o.name.toLowerCase().includes(term));
                        const matchTables = ls.tablePlays.some(tp => tp.tableName.toLowerCase().includes(term));
                        return matchId || matchStaff || matchOrders || matchTables;
                      })
                      .map((ls, idx) => {
                        const isExpanded = expandedLegacyIds.has(ls.id);
                        const toggleExpand = () => {
                          setExpandedLegacyIds(prev => {
                            const next = new Set(prev);
                            if (next.has(ls.id)) next.delete(ls.id);
                            else next.add(ls.id);
                            return next;
                          });
                        };

                        const sDate = new Date(ls.startTime);
                        const formattedDate = sDate.toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        });
                        const timeStr = sDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const endTimeStr = ls.endTime ? new Date(ls.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

                        return (
                          <div
                            key={ls.id}
                            className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all hover:border-purple-200"
                          >
                            {/* Session Card Header */}
                            <div 
                              onClick={toggleExpand}
                              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 select-none"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 font-mono font-bold text-xs">
                                  #{idx + 1}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-slate-900 text-sm font-display">
                                      {formattedDate} • {timeStr}
                                      {endTimeStr && ` - ${endTimeStr}`}
                                    </span>
                                    {ls.paymentStatus === 'paid' ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                                        ✓ Settled
                                      </span>
                                    ) : ls.balanceDue > 0 ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 font-mono">
                                        Unpaid (On Account)
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 font-mono">
                                        {ls.paymentStatus}
                                      </span>
                                    )}
                                    {ls.staffUsername && (
                                      <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-full">
                                        Staff: {ls.staffUsername}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono mt-1">
                                    <span>ID: <code className="text-slate-700">{ls.id}</code></span>
                                    <span>•</span>
                                    <span>{ls.tablePlays.length} Tables</span>
                                    <span>•</span>
                                    <span>{ls.orders.length} Items</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-center font-mono">
                                <div className="text-right">
                                  <div className="text-xs text-slate-500">
                                    Total: <strong className="text-slate-900 text-sm">₹{ls.totalBill.toFixed(2)}</strong>
                                  </div>
                                  <div className="text-[11px]">
                                    {ls.paidAmount > 0 && (
                                      <span className="text-emerald-700 font-bold mr-2">Paid: ₹{ls.paidAmount.toFixed(2)}</span>
                                    )}
                                    {ls.balanceDue > 0 && (
                                      <span className="text-rose-700 font-black">Due: ₹{ls.balanceDue.toFixed(2)}</span>
                                    )}
                                  </div>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </div>
                            </div>

                            {/* Collapsible Details */}
                            {isExpanded && (
                              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 space-y-4">
                                {/* Tables Played */}
                                {ls.tablePlays.length > 0 && (
                                  <div className="space-y-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                                      <Gamepad2 className="w-3 h-3 text-purple-600" /> Tables & Stations Played:
                                    </span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {ls.tablePlays.map((tp, tpIdx) => (
                                        <div key={tp.id || tpIdx} className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between text-xs">
                                          <div>
                                            <div className="font-bold text-slate-900">{tp.tableName}</div>
                                            <div className="text-[10px] text-slate-400 font-mono">
                                              {tp.gameType} • {tp.playerCount || 1} Players
                                              {tp.startTime && ` • ${new Date(tp.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                            </div>
                                          </div>
                                          <span className="font-mono font-bold text-slate-900">₹{tp.cost.toFixed(2)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Items Ordered */}
                                {ls.orders.length > 0 && (
                                  <div className="space-y-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                                      <Coffee className="w-3 h-3 text-amber-600" /> Items & Food Ordered:
                                    </span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                      {ls.orders.map((o, oIdx) => (
                                        <div key={o.id || oIdx} className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between text-xs">
                                          <div>
                                            <div className="font-bold text-slate-900">{o.quantity}x {o.name}</div>
                                            <div className="text-[10px] text-slate-400 font-mono">
                                              {o.category || 'Item'} @ ₹{o.price}
                                            </div>
                                          </div>
                                          <span className="font-mono font-bold text-slate-900">₹{o.total.toFixed(2)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Historical Payments Recorded */}
                                {ls.payments.length > 0 && (
                                  <div className="space-y-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                                      <CreditCard className="w-3 h-3 text-emerald-600" /> Past Session Payments:
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                      {ls.payments.map((p, pIdx) => (
                                        <div key={p.id || pIdx} className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-900 flex items-center gap-2">
                                          <span>Method: <strong>{p.method}</strong></span>
                                          <span>•</span>
                                          <span>Amount: <strong>₹{p.amount.toFixed(2)}</strong></span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
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
                  Customer Directory
                </h2>
                <p className="text-xs text-slate-500">
                  Customer profiles, active visits, and billing history
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customer by name or phone number..."
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
                    customers.map((c) => {
                      const isWalkIn = Boolean(c.phone && (c.phone.startsWith('WALK-') || c.phone.replace(/\D/g, '').length < 10));
                      return (
                        <tr 
                          key={c.id || c.phone} 
                          className="hover:bg-slate-50 font-medium group transition-colors"
                        >
                          <td 
                            onClick={() => {
                              setSelectedPhone(c.phone);
                              router.push(`/customers?phone=${encodeURIComponent(c.phone)}`);
                            }}
                            className="py-3 px-4 cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs bg-slate-900 text-white">
                                {c.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                  {c.name}
                                </span>
                                {isWalkIn && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                    Walk-in
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td 
                            onClick={() => {
                              setSelectedPhone(c.phone);
                              router.push(`/customers?phone=${encodeURIComponent(c.phone)}`);
                            }}
                            className="py-3 px-4 font-mono text-slate-500 cursor-pointer"
                          >
                            {isWalkIn ? (
                              <span className="text-slate-600 text-xs font-mono">
                                #{c.id}
                              </span>
                            ) : (
                              <span className="text-xs font-mono">#CUST-{String(c.id).padStart(3, '0')}</span>
                            )}
                          </td>
                          <td 
                            onClick={() => {
                              setSelectedPhone(c.phone);
                              router.push(`/customers?phone=${encodeURIComponent(c.phone)}`);
                            }}
                            className="py-3 px-4 font-mono font-bold text-slate-700 cursor-pointer"
                          >
                            {isWalkIn ? (
                              <span className="text-slate-400 text-xs font-normal italic">
                                No phone
                              </span>
                            ) : (
                              <span>{c.phone}</span>
                            )}
                          </td>
                          <td 
                            onClick={() => {
                              setSelectedPhone(c.phone);
                              router.push(`/customers?phone=${encodeURIComponent(c.phone)}`);
                            }}
                            className="py-3 px-4 text-slate-500 cursor-pointer"
                          >
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Active Member'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isWalkIn && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRegisterWalkinTarget(c);
                                  }}
                                  className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <UserPlus className="w-3 h-3 text-slate-500" />
                                  <span>+ Add Phone</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPhone(c.phone);
                                  router.push(`/customers?phone=${encodeURIComponent(c.phone)}`);
                                }}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                              >
                                <span>View Profile →</span>
                              </button>
                              {isWalkIn && (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm(`Delete unregistered walk-in customer "${c.name}"?`)) {
                                      try {
                                        await api.delete(`/customers/${encodeURIComponent(c.phone)}`);
                                        await loadCustomers(searchQuery.trim());
                                      } catch (err: any) {
                                        alert(err.message || 'Failed to delete walk-in customer');
                                      }
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete accidental duplicate walk-in"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
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
                floorTables.filter(t => t.status !== 'occupied').map((t) => {
                  const isPS4 = t.gameType === 'PS4';
                  const ps4Rate = ps4PlayerCount === 1 ? 80 : ps4PlayerCount === 2 ? 150 : 200;
                  const tableRate = t.ratePerHour || (t.gameType === 'MidSnooker' ? 220 : 160);

                  if (isPS4) {
                    return (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-xl border-2 border-indigo-200/90 bg-indigo-50/50 space-y-2.5 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                              <Gamepad2 className="w-3.5 h-3.5 text-indigo-600" />
                              <span>{t.name || `PS4 Station ${t.number}`}</span>
                            </h4>
                            <p className="text-[10px] text-indigo-700 font-semibold mt-0.5">
                              Select Number of Players:
                            </p>
                          </div>
                          <span className="text-xs font-mono font-black text-indigo-700 bg-white px-2.5 py-0.5 rounded-lg border border-indigo-200 shadow-2xs">
                            ₹{ps4Rate}/hr
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { count: 1, label: '1P', rate: '₹80/hr' },
                            { count: 2, label: '2P', rate: '₹150/hr' },
                            { count: 3, label: '3P', rate: '₹200/hr' },
                            { count: 4, label: '4P', rate: '₹200/hr' },
                          ].map((p) => {
                            const isSelected = ps4PlayerCount === p.count;
                            return (
                              <button
                                key={p.count}
                                type="button"
                                onClick={() => setPs4PlayerCount(p.count)}
                                className={`py-1.5 px-1 rounded-lg text-center border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-500/20'
                                    : 'bg-white hover:bg-indigo-50/60 text-slate-700 border-slate-200'
                                }`}
                              >
                                <div className="text-xs font-black">{p.label}</div>
                                <div className={`text-[10px] font-mono font-bold ${isSelected ? 'text-indigo-100' : 'text-indigo-600'}`}>
                                  {p.rate}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        <div className="pt-2 border-t border-indigo-100 flex items-center justify-between">
                          <span className="text-[10px] font-mono text-slate-500">
                            {ps4PlayerCount} Player{ps4PlayerCount > 1 ? 's' : ''} • ₹{ps4Rate}/hr
                          </span>
                          <button
                            onClick={() => handleAssignTableToCustomer(t.id, ps4PlayerCount)}
                            disabled={assigningTableId === t.id}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer"
                          >
                            {assigningTableId === t.id ? 'Starting...' : 'Start PS4 Play'}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={t.id}
                      onClick={() => handleAssignTableToCustomer(t.id, 1)}
                      className="p-3 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-all group"
                    >
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">
                          {t.name || `${t.gameType} Table ${t.number}`}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Rate: ₹{tableRate}/hr
                        </p>
                      </div>
                      <button
                        disabled={assigningTableId === t.id}
                        className="px-3 py-1 bg-slate-900 group-hover:bg-blue-600 text-white text-[11px] font-bold rounded-lg cursor-pointer"
                      >
                        {assigningTableId === t.id ? 'Starting...' : 'Start Play'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD ORDER MODAL */}
      {showAddOrderModal && customerData && (
        <AddOrderModal
          sessionId={activeVisit?.id || selectedVisit?.id || ''}
          customerId={customerData.customer.id}
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

      {/* MODAL 5: SETTLE OUTSTANDING BALANCE MODAL (Full / Partial Amount) */}
      {showSettleModal && customerData && (
        <CustomerSettleBalanceModal
          customer={{
            id: customerData.customer.id,
            name: customerData.customer.name,
            phone: customerData.customer.phone,
            currentCreditDue: customerData.customer.currentCreditDue ?? customerData.customer.currentUdharDue,
          }}
          onClose={() => setShowSettleModal(false)}
          onSuccess={async () => {
            setShowSettleModal(false);
            if (selectedPhone) {
              await loadCustomerHistory(selectedPhone);
            }
          }}
        />
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
            <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 text-[11px] text-slate-500 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Click any visit to jump to its date and bill.</span>
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
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400" /> {item.timeStr}</span>
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

      {/* MODAL 7: VISIT PAYMENT & CLOSE (Full / Partial Payment with Udhar) */}
      {paymentCloseModal && paymentCloseModal.open && customerData && (
        <VisitPaymentCloseModal
          visitId={paymentCloseModal.visitId}
          customerName={customerData.customer.name}
          customerId={customerData.customer.id}
          customerPhone={customerData.customer.phone}
          visitTotal={paymentCloseModal.visitTotal}
          previousCreditDue={paymentCloseModal.previousCreditDue ?? 0}
          initialMode={paymentCloseModal.mode}
          onClose={() => setPaymentCloseModal(null)}
          onOpenRegisterWalkin={() => setShowRegisterWalkinModal(true)}
          onSuccess={async () => {
            setPaymentCloseModal(null);
            if (selectedPhone) {
              await loadCustomerHistory(selectedPhone);
            }
          }}
        />
      )}

      {/* MODAL 8: TRANSFER TABLE PLAY (Loser Pays) */}
      {transferTargetPlay && customerData && (
        <TransferTableModal
          tablePlay={transferTargetPlay}
          currentCustomer={customerData.customer}
          onClose={() => setTransferTargetPlay(null)}
          onSuccess={async () => {
            setTransferTargetPlay(null);
            if (selectedPhone) {
              await loadCustomerHistory(selectedPhone);
            }
          }}
        />
      )}

      {/* MODAL 9: SPLIT TABLE PLAY (Multi-player Split) */}
      {splitTargetPlay && customerData && (
        <SplitTableModal
          tablePlay={splitTargetPlay}
          currentCustomer={customerData.customer}
          onClose={() => setSplitTargetPlay(null)}
          onSuccess={async () => {
            setSplitTargetPlay(null);
            if (selectedPhone) {
              await loadCustomerHistory(selectedPhone);
            }
          }}
        />
      )}

      {/* MODAL 10: REGISTER WALKIN CUSTOMER (UPGRADE TO PERMANENT MEMBER) */}
      {(registerWalkinTarget || (showRegisterWalkinModal && customerData)) && (
        <RegisterWalkinModal
          customerId={registerWalkinTarget ? registerWalkinTarget.id : customerData!.customer.id}
          currentName={registerWalkinTarget ? registerWalkinTarget.name : customerData!.customer.name}
          currentFirstName={registerWalkinTarget ? registerWalkinTarget.firstName : customerData!.customer.firstName}
          currentLastName={registerWalkinTarget ? registerWalkinTarget.lastName : customerData!.customer.lastName}
          currentWalkinPhone={registerWalkinTarget ? registerWalkinTarget.phone : customerData!.customer.phone}
          onClose={() => {
            setShowRegisterWalkinModal(false);
            setRegisterWalkinTarget(null);
          }}
          onSuccess={async (updatedCustomer) => {
            setShowRegisterWalkinModal(false);
            setRegisterWalkinTarget(null);
            const newPhone = updatedCustomer.phone;
            if (selectedPhone) {
              setSelectedPhone(newPhone);
              router.push(`/customers?phone=${encodeURIComponent(newPhone)}`);
              await loadCustomerHistory(newPhone);
            }
            await loadCustomers(searchQuery.trim());
          }}
        />
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
