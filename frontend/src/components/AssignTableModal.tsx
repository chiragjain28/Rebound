'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { Table } from '../types';
import { 
  X, 
  Search, 
  User, 
  Phone, 
  Play, 
  UserPlus, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Gamepad2,
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface CustomerSuggestion {
  id: number;
  name: string;
  firstName: string;
  lastName?: string;
  phone: string;
  createdAt?: string;
}

interface AssignTableModalProps {
  table: Table;
  onClose: () => void;
  onSuccess?: (customer: any, session: any) => void;
}

export const AssignTableModal: React.FC<AssignTableModalProps> = ({
  table,
  onClose,
  onSuccess
}) => {
  const router = useRouter();

  // Search existing customer state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [assigningId, setAssigningId] = useState<number | null>(null);

  // New customer form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [submittingNew, setSubmittingNew] = useState(false);

  // Error state
  const [error, setError] = useState('');

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Live search existing customers
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 1) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setSearching(true);
        const results = await api.get(`/customers/search?q=${encodeURIComponent(q)}`);
        if (Array.isArray(results)) {
          setSearchResults(results);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.error('Customer search failed:', err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Assign to existing customer
  const handleAssignExisting = async (customer: CustomerSuggestion) => {
    try {
      setError('');
      setAssigningId(customer.id);

      const res = await api.post(`/tables/${table.id}/assign`, {
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone
      });

      if (onSuccess) {
        onSuccess(res.customer, res.session);
      }

      onClose();
      // Redirect to customer's dedicated page
      router.push(`/customers?phone=${encodeURIComponent(res.customer.phone || res.customer.id)}`);
    } catch (err: any) {
      setError(err.message || 'Failed to assign table to customer');
      setAssigningId(null);
    }
  };

  // Assign to new customer
  const handleAssignNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = newName.trim();
    const cleanPhone = newPhone.trim().replace(/\D/g, '');

    if (!cleanName) {
      setError('Customer name is required');
      return;
    }

    try {
      setSubmittingNew(true);
      const res = await api.post(`/tables/${table.id}/assign`, {
        customerName: cleanName,
        customerPhone: cleanPhone || undefined
      });

      if (onSuccess) {
        onSuccess(res.customer, res.session);
      }

      onClose();
      // Redirect to customer's dedicated page
      router.push(`/customers?phone=${encodeURIComponent(res.customer.phone || res.customer.id)}`);
    } catch (err: any) {
      setError(err.message || 'Failed to register customer and start table');
      setSubmittingNew(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 font-display">
                  Assign {table.name || (table.gameType === 'PS4' ? `Station ${table.number}` : `Table ${table.number}`)}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                  {table.gameType} • Available
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Select an existing customer or enter new walk-in details to start game
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* SECTION 1: Existing / Registered Customer Search */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-500" />
                <span>Existing / Registered Customer</span>
              </label>
              <span className="text-[10px] font-semibold text-slate-400">
                1-click table start
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type customer name or phone number..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-9 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all shadow-2xs"
              />
              {searching ? (
                <div className="absolute right-3.5 top-3">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {/* Live Search Suggestions Dropdown */}
            {searchQuery.trim().length > 0 && (
              <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs animate-in fade-in max-h-48 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    {searching ? 'Searching registered customers...' : `No registered customer found for "${searchQuery}". You can create them below.`}
                  </div>
                ) : (
                  searchResults.map((cust) => (
                    <div
                      key={cust.id}
                      onClick={() => handleAssignExisting(cust)}
                      className="p-3 hover:bg-slate-100 cursor-pointer flex items-center justify-between transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs group-hover:scale-105 transition-transform">
                          {cust.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {cust.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                            <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span>{cust.phone.startsWith('WALK-') ? 'Walk-in (No Phone)' : cust.phone}</span>
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={assigningId === cust.id}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-2xs group-hover:bg-blue-600 transition-all"
                      >
                        {assigningId === cust.id ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Starting...</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3 fill-white" />
                            <span>Start Table</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* DIVIDER: OR NEW CUSTOMER */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
              <span className="bg-white px-3 text-slate-400 font-mono">
                — OR REGISTER / WALK-IN CUSTOMER —
              </span>
            </div>
          </div>

          {/* SECTION 2: New Customer Form */}
          <form onSubmit={handleAssignNew} className="space-y-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-slate-600" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                New Customer Details
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Customer Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center justify-between">
                <span>Phone Number</span>
                <span className="text-[10px] text-slate-400 font-normal normal-case">
                  Optional (system assigns unique ID for analytics)
                </span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="tel"
                  maxLength={10}
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit mobile number (optional)"
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 font-mono transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingNew || !newName.trim()}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {submittingNew ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Assigning Table &amp; Starting Game...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-white" />
                  <span>Assign Table &amp; Start Game</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
