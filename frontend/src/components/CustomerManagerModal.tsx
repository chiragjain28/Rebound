'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api';
import { 
  X, 
  Search, 
  UserPlus, 
  User, 
  Phone, 
  Lock, 
  Calendar, 
  Trash2, 
  Check, 
  AlertTriangle, 
  CreditCard,
  IndianRupee,
  ChevronRight,
  ArrowLeft,
  Users
} from 'lucide-react';

interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  createdAt: string;
}

interface CustomerPayment {
  id: number;
  amount: number;
  method: string;
  createdAt: string;
  sessionId: string;
  session?: {
    id: string;
    customerName: string;
    status: string;
    totalBill: number;
  };
}

interface DeletionEligibility {
  canDelete: boolean;
  hasActiveSession: boolean;
  activeSession?: { id: string; tableName: string } | null;
  hasUdhar: boolean;
  totalUdhar: number;
  reasons: string[];
  reasonText?: string;
}

interface CustomerManagerModalProps {
  onClose: () => void;
  onCustomerUpdated?: () => void;
}

export const CustomerManagerModal: React.FC<CustomerManagerModalProps> = ({
  onClose,
  onCustomerUpdated
}) => {
  const [mounted, setMounted] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // Edit form state
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [eligibility, setEligibility] = useState<DeletionEligibility | null>(null);
  const [loadingEligibility, setLoadingEligibility] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteTooltip, setShowDeleteTooltip] = useState(false);

  // Add customer form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addingCustomer, setAddingCustomer] = useState(false);

  // Notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchCustomers = async (query = '') => {
    try {
      setLoading(true);
      const endpoint = query ? `/customers/search?q=${encodeURIComponent(query)}` : '/customers';
      const data = await api.get(endpoint);
      setCustomers(data);
    } catch (err: any) {
      console.error('Failed to fetch customers:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchCustomers(searchQuery.trim());
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditFirstName(customer.firstName || '');
    setEditLastName(customer.lastName || '');
    setShowDeleteConfirm(false);
    setShowAddForm(false);
    setNotification(null);

    // 1. Fetch last 3-4 payments
    try {
      setLoadingPayments(true);
      const paymentData = await api.get(`/customers/${encodeURIComponent(customer.phone)}/payments`);
      setPayments(paymentData);
    } catch (err: any) {
      console.error('Failed to fetch payments:', err.message);
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }

    // 2. Fetch deletion eligibility
    try {
      setLoadingEligibility(true);
      const eligibilityData = await api.get(`/customers/${encodeURIComponent(customer.phone)}/eligibility`);
      setEligibility(eligibilityData);
    } catch (err: any) {
      console.error('Failed to fetch eligibility:', err.message);
      setEligibility(null);
    } finally {
      setLoadingEligibility(false);
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    if (!editFirstName.trim()) {
      setNotification({ type: 'error', message: 'First name is required' });
      return;
    }

    try {
      setSavingEdit(true);
      setNotification(null);
      const updated = await api.put(`/customers/${encodeURIComponent(selectedCustomer.phone)}`, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim()
      });

      if (typeof window !== 'undefined') {
        localStorage.removeItem('rebound_customer_profiles_cache');
      }

      setSelectedCustomer(updated);
      setNotification({ type: 'success', message: 'Customer details updated successfully' });
      fetchCustomers(searchQuery);
      if (onCustomerUpdated) onCustomerUpdated();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to update customer' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;

    try {
      setDeletingCustomer(true);
      setNotification(null);
      await api.delete(`/customers/${encodeURIComponent(selectedCustomer.phone)}`);

      if (typeof window !== 'undefined') {
        localStorage.removeItem('rebound_customer_profiles_cache');
      }

      setNotification({ type: 'success', message: `Customer "${selectedCustomer.name}" deleted successfully` });
      setSelectedCustomer(null);
      setShowDeleteConfirm(false);
      fetchCustomers(searchQuery);
      if (onCustomerUpdated) onCustomerUpdated();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to delete customer' });
    } finally {
      setDeletingCustomer(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName.trim()) {
      setNotification({ type: 'error', message: 'First name is required' });
      return;
    }
    if (!newPhone.trim()) {
      setNotification({ type: 'error', message: 'Mobile number is required' });
      return;
    }

    try {
      setAddingCustomer(true);
      setNotification(null);
      const created = await api.post('/customers', {
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        phone: newPhone.trim()
      });

      if (typeof window !== 'undefined') {
        localStorage.removeItem('rebound_customer_profiles_cache');
      }

      setNewFirstName('');
      setNewLastName('');
      setNewPhone('');
      setShowAddForm(false);
      setNotification({ type: 'success', message: `Customer "${created.name}" created successfully` });
      fetchCustomers(searchQuery);
      handleSelectCustomer(created);
      if (onCustomerUpdated) onCustomerUpdated();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to create customer' });
    } finally {
      setAddingCustomer(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl shadow-2xl p-6 flex flex-col h-[640px] max-h-[92vh] space-y-4">
        
        {/* Header */}
        <div className="flex justify-between items-center shrink-0 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight font-display flex items-center gap-2">
                Rebound Customer Directory
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Manage customer directory, view statements and payment logs</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status Notification */}
        {notification && (
          <div className={`text-xs font-semibold p-3 rounded-xl border shrink-0 flex items-center justify-between ${
            notification.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} className="opacity-70 hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Main Content Layout */}
        <div className="flex-1 flex gap-5 min-h-0">
          
          {/* Left Column: Customer Search & List */}
          <div className="w-80 shrink-0 flex flex-col space-y-3 min-h-0 border-r border-slate-200 pr-5">
            
            {/* Action Bar: Search + Add Customer */}
            <div className="space-y-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-7 py-2 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-900 bg-slate-50 text-slate-900 placeholder-slate-400"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(true);
                    setSelectedCustomer(null);
                    setNotification(null);
                  }}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs shrink-0 transition-all"
                  title="Add New Customer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </div>

              <div className="text-[11px] font-mono text-slate-400 px-1 flex justify-between items-center">
                <span>{loading ? 'Searching...' : `${customers.length} customers`}</span>
                {searchQuery && (
                  <span className="text-slate-600 text-[10px] font-semibold">Filtered</span>
                )}
              </div>
            </div>

            {/* Scrollable Customer List */}
            <div className="flex-1 overflow-y-auto min-h-0 border border-slate-200 rounded-xl bg-white divide-y divide-slate-100">
              {loading && customers.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs">
                  Loading customers...
                </div>
              ) : customers.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs space-y-2">
                  <p>No customers found</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(true);
                      setNewFirstName(searchQuery);
                    }}
                    className="text-slate-900 font-bold hover:underline text-xs"
                  >
                    + Add as new customer
                  </button>
                </div>
              ) : (
                customers.map((c) => {
                  const isSelected = selectedCustomer?.phone === c.phone;
                  return (
                    <div
                      key={c.phone}
                      onClick={() => handleSelectCustomer(c)}
                      className={`p-3 cursor-pointer transition-all flex items-center justify-between ${
                        isSelected 
                          ? 'bg-slate-100 border-l-4 border-slate-900 text-slate-900 font-bold' 
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-slate-900 text-xs truncate flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{c.name}</span>
                        </p>
                        <p className="text-[11px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{c.phone}</span>
                        </p>
                      </div>
                      <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isSelected ? 'text-slate-900 translate-x-0.5' : 'text-slate-300'}`} />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Customer Details / Edit / Add Form */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-slate-50/50 rounded-xl border border-slate-200 p-5 overflow-y-auto">
            
            {showAddForm ? (
              /* Add Customer Form */
              <div className="space-y-4 animate-in fade-in">
                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 font-display">
                      Register Permanent Customer
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Save customer permanently to database</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                </div>

                <form onSubmit={handleAddCustomer} className="space-y-4 max-w-lg">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        First Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newFirstName}
                        onChange={(e) => setNewFirstName(e.target.value)}
                        placeholder="e.g. Tony"
                        className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Surname / Last Name
                      </label>
                      <input
                        type="text"
                        value={newLastName}
                        onChange={(e) => setNewLastName(e.target.value)}
                        placeholder="e.g. Stark"
                        className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mobile Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs font-mono font-semibold"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Mobile number is the unique immutable identifier.</p>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 border border-slate-200 text-xs font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addingCustomer}
                      className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50 transition-all"
                    >
                      {addingCustomer ? 'Saving...' : 'Create Customer'}
                    </button>
                  </div>
                </form>
              </div>
            ) : selectedCustomer ? (
              /* Edit Selected Customer View */
              <div className="space-y-5 animate-in fade-in">
                
                {/* Customer Title */}
                <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                      Customer Profile
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-0.5 flex items-center gap-2 font-display">
                      <User className="h-4 w-4 text-slate-500 shrink-0" />
                      <span>{selectedCustomer.name}</span>
                    </h3>
                  </div>

                  {/* Delete Customer Button */}
                  <div 
                    className="relative flex flex-col items-end"
                    onMouseEnter={() => setShowDeleteTooltip(true)}
                    onMouseLeave={() => setShowDeleteTooltip(false)}
                  >
                    <button
                      type="button"
                      disabled={!eligibility?.canDelete || loadingEligibility}
                      onClick={() => {
                        if (eligibility?.canDelete) {
                          setShowDeleteConfirm(!showDeleteConfirm);
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        loadingEligibility
                          ? 'bg-slate-100 text-slate-400 cursor-wait'
                          : eligibility?.canDelete
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer shadow-xs'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-70'
                      }`}
                    >
                      {eligibility?.canDelete ? (
                        <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                      ) : (
                        <Lock className="h-3.5 w-3.5 text-slate-400" />
                      )}
                      Delete Customer
                    </button>

                    {showDeleteTooltip && eligibility && !eligibility.canDelete && (
                      <div className="absolute right-0 top-full mt-2 w-80 z-50 pointer-events-none bg-white border border-amber-300 rounded-xl p-3 text-amber-900 text-xs space-y-2 shadow-xl animate-in fade-in">
                        <div className="flex items-center gap-2 font-bold text-amber-800">
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>Deletion Protected</span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Customer cannot be deleted while they have an active table session or unpaid outstanding balance.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delete Confirmation Alert */}
                {showDeleteConfirm && eligibility?.canDelete && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-800 space-y-3 animate-in fade-in">
                    <p className="text-xs font-semibold">
                      Are you sure you want to delete <b>{selectedCustomer.name}</b>?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-xl text-xs font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteCustomer}
                        disabled={deletingCustomer}
                        className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                      >
                        {deletingCustomer ? 'Deleting...' : 'Yes, Delete'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Editable Form */}
                <form onSubmit={handleSaveCustomer} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        First Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2 text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Surname / Last Name
                      </label>
                      <input
                        type="text"
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        placeholder="e.g. Stark"
                        className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2 text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex justify-between items-center text-xs font-bold text-slate-700 mb-1">
                      <span>Mobile Number</span>
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Immutable Key
                      </span>
                    </label>
                    <input
                      type="text"
                      disabled
                      value={selectedCustomer.phone}
                      className="w-full rounded-xl bg-slate-100 border border-slate-200 px-3.5 py-2 text-slate-500 font-mono text-xs cursor-not-allowed"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50 transition-all"
                    >
                      {savingEdit ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>

                {/* Last 3-4 Payments */}
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4 text-slate-500" />
                      Recent Payment Transactions
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400">
                      {payments.length} transactions
                    </span>
                  </div>

                  {loadingPayments ? (
                    <div className="text-center py-6 text-slate-400 text-xs font-medium">
                      Loading payment history...
                    </div>
                  ) : payments.length === 0 ? (
                    <div className="text-center py-6 bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                      No payment records found for this customer.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {payments.map((p) => (
                        <div
                          key={p.id}
                          className="bg-white border border-slate-200 rounded-xl p-3 flex justify-between items-center shadow-xs"
                        >
                          <div className="min-w-0 pr-2 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-emerald-700">
                                ₹{p.amount.toFixed(2)}
                              </span>
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {p.method}
                              </span>
                            </div>
                            <p className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              {new Date(p.createdAt).toLocaleDateString([], { dateStyle: 'medium' })}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-mono text-slate-400 block truncate max-w-[140px]">
                              {p.sessionId}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3 text-slate-400">
                <User className="h-8 w-8 text-slate-300" />
                <p className="text-xs">Select a customer from the left to view profile & payment history</p>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>,
    document.body
  );
};
