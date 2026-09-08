'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { X, Play, User, Phone } from 'lucide-react';

interface CustomerProfile {
  customerName: string;
  customerPhone?: string;
}

interface NewSessionModalProps {
  tables?: any;
  staffUsername: string;
  udhars?: { customerName: string; totalOutstanding: number }[];
  activeSessions?: any[];
  onClose: () => void;
  onSuccess: (session: any) => void;
}

export const NewSessionModal: React.FC<NewSessionModalProps> = ({
  staffUsername,
  udhars = [],
  activeSessions = [],
  onClose,
  onSuccess,
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceMethod, setAdvanceMethod] = useState('Cash');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [customerList, setCustomerList] = useState<CustomerProfile[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const CUSTOMER_CACHE_KEY = 'rebound_customer_profiles_cache';
  const CUSTOMER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  useEffect(() => {
    const fetchCustomers = async () => {
      // 1. Check localStorage cache first
      try {
        const cached = localStorage.getItem(CUSTOMER_CACHE_KEY);
        if (cached) {
          const { profiles, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CUSTOMER_CACHE_TTL && Array.isArray(profiles)) {
            setCustomerList(profiles);
            return;
          }
        }
      } catch (e) { /* ignore corrupt cache */ }

      // 2. Fetch fresh list from API
      try {
        const raw = await api.get('/sessions/customers/all');
        if (Array.isArray(raw)) {
          // Standardize profiles array
          const profiles: CustomerProfile[] = raw.map(item => 
            typeof item === 'string' 
              ? { customerName: item, customerPhone: '' } 
              : { customerName: item.customerName || '', customerPhone: item.customerPhone || '' }
          );
          setCustomerList(profiles);
          localStorage.setItem(CUSTOMER_CACHE_KEY, JSON.stringify({ profiles, timestamp: Date.now() }));
        }
      } catch (err) {
        console.error('Failed to fetch customer list', err);
      }
    };
    fetchCustomers();
  }, []);

  // Matching logic based on First Name and/or Mobile Number
  const trimmedFirstName = firstName.trim().toLowerCase();
  const trimmedPhone = customerPhone.trim();
  const fullTypedName = (firstName.trim() + ' ' + lastName.trim()).trim().toLowerCase();

  const matchedSuggestions = (trimmedFirstName.length >= 1 || trimmedPhone.length >= 2)
    ? customerList.filter(profile => {
        const nameMatch = trimmedFirstName && profile.customerName.toLowerCase().includes(trimmedFirstName);
        const phoneMatch = trimmedPhone && profile.customerPhone && profile.customerPhone.includes(trimmedPhone);
        return nameMatch || phoneMatch;
      })
    : [];

  const isExactMatch = customerList.some(p => {
    const nameMatches = p.customerName.toLowerCase() === fullTypedName || p.customerName.toLowerCase() === trimmedFirstName;
    const phoneMatches = trimmedPhone ? (p.customerPhone && p.customerPhone.trim() === trimmedPhone) : false;
    return nameMatches || phoneMatches;
  });
  
  const hasBothRequiredFields = firstName.trim().length > 0 && customerPhone.trim().length > 0;
  const isNewCustomer = hasBothRequiredFields && !isExactMatch && matchedSuggestions.length === 0;

  const handleSelectSuggestion = (profile: CustomerProfile) => {
    const parts = profile.customerName.trim().split(' ');
    if (parts.length > 1) {
      setFirstName(parts[0]);
      setLastName(parts.slice(1).join(' '));
    } else {
      setFirstName(profile.customerName);
      setLastName('');
    }
    if (profile.customerPhone) {
      setCustomerPhone(profile.customerPhone);
    }
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    if (!customerPhone.trim()) {
      setError('Mobile number is required');
      return;
    }
    setError('');
    setLoading(true);

    const fullCustomerName = (firstName.trim() + ' ' + lastName.trim()).trim();

    try {
      const data = await api.post('/sessions', {
        staffUsername,
        customerName: fullCustomerName,
        customerPhone: customerPhone.trim(),
        advanceAmount: advanceAmount ? parseFloat(advanceAmount) : undefined,
        advanceMethod: advanceAmount ? advanceMethod : undefined,
      });
      // Invalidate customer cache
      localStorage.removeItem(CUSTOMER_CACHE_KEY);
      onSuccess(data);
    } catch (err: any) {
      setError(err.message || 'Failed to start session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-[#111827] rounded-3xl border border-slate-800 w-full max-w-md shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden p-6 space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-extrabold text-white font-display uppercase tracking-wide">Start New Session</h2>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">Search or enter customer details</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-950/60 text-rose-300 text-xs font-bold p-3 rounded-xl border border-rose-500/40">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* First Name (Required) */}
          <div className="relative">
            <label className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 font-mono">
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-cyan-400" />
                First Name <span className="text-cyan-400">*</span>
              </span>
            </label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="block w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-semibold"
              placeholder="e.g. Rahul"
            />
          </div>

          {/* Last Name (Optional) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 font-mono">
              Last Name <span className="text-slate-500 text-[10px] font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="block w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-semibold"
              placeholder="e.g. Sharma"
            />
          </div>

          {/* Mobile Number (Required) */}
          <div className="relative">
            <label className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 font-mono">
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5 text-cyan-400" />
                Mobile Number <span className="text-cyan-400">*</span>
              </span>
              {isNewCustomer && (
                <span className="text-[9px] font-extrabold text-emerald-300 uppercase tracking-widest bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-500/40 font-mono">
                  New Customer
                </span>
              )}
            </label>
            <input
              type="tel"
              required
              value={customerPhone}
              onChange={(e) => {
                setCustomerPhone(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="block w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-semibold font-mono"
              placeholder="e.g. 9876543210"
            />

            {/* Suggestions Dropdown */}
            {showSuggestions && matchedSuggestions.length > 0 && (
              <ul className="absolute z-30 mt-1 w-full bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                <div className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase text-slate-400 border-b border-slate-800 bg-slate-950/80">
                  Matching Customers in Database
                </div>
                {matchedSuggestions.map((profile, idx) => (
                  <li
                    key={idx}
                    className="px-4 py-2.5 text-xs text-slate-200 hover:bg-slate-800 hover:text-cyan-300 cursor-pointer font-semibold border-b border-slate-800/60 last:border-0 flex justify-between items-center"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectSuggestion(profile);
                    }}
                  >
                    <span>{profile.customerName}</span>
                    {profile.customerPhone && (
                      <span className="text-[11px] font-mono text-cyan-400/80 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                        📱 {profile.customerPhone}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Advance Payment (Optional) */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
              Advance Payment Received <span className="text-slate-500 text-[10px] font-normal">(Optional)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                step="1"
                min="0"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                className="col-span-2 rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm font-mono font-extrabold"
                placeholder="e.g. 1000"
              />
              <select
                value={advanceMethod}
                onChange={(e) => setAdvanceMethod(e.target.value)}
                className="rounded-xl bg-slate-900 border border-slate-800 px-2 py-2 text-white focus:border-emerald-500 focus:outline-none text-xs font-semibold"
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
              </select>
            </div>
            {advanceAmount && parseFloat(advanceAmount) > 0 && (
              <p className="text-[10px] text-emerald-400 font-mono">
                ✓ ₹{parseFloat(advanceAmount).toFixed(2)} advance will be credited to this session immediately.
              </p>
            )}
          </div>

          {/* Active Session & Udhar Warning Banners */}
          {(() => {
            if (!firstName.trim() && !customerPhone.trim()) return null;

            const searchPhone = customerPhone.trim();
            const searchName = fullTypedName;

            const matchingActive = activeSessions.find((s) => {
              const nameMatches = searchName && s.customerName.toLowerCase() === searchName;
              const phoneMatches = searchPhone && s.customerPhone && s.customerPhone === searchPhone;
              return nameMatches || phoneMatches;
            });

            const matchingUdhar = udhars.find((u) => {
              const nameMatches = searchName && u.customerName.toLowerCase() === searchName;
              return (nameMatches) && u.totalOutstanding > 0;
            });

            if (!matchingActive && !matchingUdhar) return null;

            return (
              <div className="space-y-2 pt-1">
                {matchingActive && (
                  <div className="text-[11px] text-rose-300 bg-rose-950/60 p-3 rounded-xl border border-rose-500/40 leading-relaxed font-semibold">
                    🚨 <b>{matchingActive.customerName}</b> {matchingActive.customerPhone ? `(${matchingActive.customerPhone})` : ''} currently has an <b>Active Session</b>!<br/>
                    <span className="opacity-80 block mt-1">Please confirm if this is the same person or use unique details.</span>
                  </div>
                )}
                {matchingUdhar && (
                  <div className="text-[11px] text-amber-300 bg-amber-950/60 p-3 rounded-xl border border-amber-500/40 leading-relaxed font-semibold">
                    ⚠️ <b>{matchingUdhar.customerName}</b> has an outstanding debt of <b>₹{matchingUdhar.totalOutstanding.toFixed(2)}</b>.
                  </div>
                )}
              </div>
            );
          })()}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex justify-center items-center px-4 py-2.5 border border-slate-800 text-xs font-bold uppercase tracking-wider rounded-xl text-slate-300 bg-slate-900 hover:bg-slate-800 transition-all custom-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex justify-center items-center px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-xs font-extrabold uppercase tracking-wider rounded-xl text-white shadow-[0_0_15px_rgba(0,242,254,0.3)] disabled:opacity-50 transition-all custom-button"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1.5" />
                  Start Session
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
