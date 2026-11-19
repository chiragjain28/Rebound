'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { X, Play, User, Phone, AlertTriangle, Lock, ExternalLink } from 'lucide-react';

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
  const router = useRouter();
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

      try {
        let raw;
        try {
          raw = await api.get('/customers/all');
        } catch {
          raw = await api.get('/sessions/customers/all');
        }
        if (Array.isArray(raw)) {
          const profiles: CustomerProfile[] = raw.map(item => 
            typeof item === 'string' 
              ? { customerName: item, customerPhone: '' } 
              : { customerName: item.customerName || item.name || '', customerPhone: item.customerPhone || item.phone || '' }
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

  const currentEnteredDigits = customerPhone.replace(/\D/g, '');
  const matchingActive = activeSessions.find(s => {
    const sDigits = (s.customerPhone || '').replace(/\D/g, '');
    const phoneMatch = currentEnteredDigits.length >= 6 && sDigits.length >= 6 && (
      currentEnteredDigits === sDigits || 
      sDigits.endsWith(currentEnteredDigits) || 
      currentEnteredDigits.endsWith(sDigits)
    );
    const sName = (s.customerName || '').toLowerCase().trim();
    const nameMatch = (fullTypedName && sName === fullTypedName) || (trimmedFirstName && sName === trimmedFirstName);
    return Boolean(phoneMatch || (nameMatch && !customerPhone));
  });

  const matchingUdhar = udhars.find(u => {
    const uName = u.customerName.toLowerCase().trim();
    return (fullTypedName && uName === fullTypedName) || (trimmedFirstName && uName === trimmedFirstName);
  });

  const handleSelectSuggestion = (profile: CustomerProfile) => {
    const parts = profile.customerName.trim().split(/\s+/);
    setFirstName(parts[0] || '');
    setLastName(parts.slice(1).join(' ') || '');
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

    if (matchingActive) {
      setError(`Cannot start session: ${matchingActive.customerName} already has an active session.`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const parsedAdvance = parseFloat(advanceAmount);
      const payload: any = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        customerName: (firstName.trim() + ' ' + lastName.trim()).trim(),
        customerPhone: customerPhone.trim(),
        gameType: 'None',
        playerCount: 1,
        tableId: null,
        staffUsername
      };

      if (!isNaN(parsedAdvance) && parsedAdvance > 0) {
        payload.advanceAmount = parsedAdvance;
        payload.advanceMethod = advanceMethod;
      }

      const res = await api.post('/sessions', payload);
      onSuccess(res);
    } catch (err: any) {
      setError(err.message || 'Failed to start session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 px-5 py-3.5 bg-slate-50/70 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight font-display">Start New Lounge Session</h2>
            <p className="text-xs text-slate-500">Search customer or register new guest</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 bg-rose-50 text-rose-700 text-xs font-semibold p-2.5 rounded-xl border border-rose-200 shrink-0">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* First Name & Last Name in 2 Columns */}
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <label className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  <span className="flex items-center gap-1 truncate">
                    <User className="h-3 w-3 text-slate-400 shrink-0" />
                    First Name <span className="text-rose-500">*</span>
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
                  className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs font-semibold"
                  placeholder="e.g. Tony"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 truncate">
                  Last Name <span className="text-slate-400 text-[10px] font-normal">(Opt)</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs font-semibold"
                  placeholder="e.g. Stark"
                />
              </div>
            </div>

            {/* Mobile Number (Required) */}
            <div className="relative">
              <label className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3 text-slate-400" />
                  Mobile Number <span className="text-rose-500">*</span>
                </span>
                {isNewCustomer && (
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-mono">
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
                className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs font-semibold font-mono"
                placeholder="e.g. 9876543210"
              />

              {/* Suggestions Dropdown */}
              {showSuggestions && matchedSuggestions.length > 0 && (
                <ul className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-44 overflow-y-auto divide-y divide-slate-100">
                  <div className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase text-slate-400 bg-slate-50">
                    Existing Customers ({matchedSuggestions.length})
                  </div>
                  {matchedSuggestions.map((profile, idx) => {
                    const pPhone = (profile.customerPhone || '').replace(/\D/g, '');
                    const pName = profile.customerName.toLowerCase().trim();
                    const profileHasActive = activeSessions.some((s) => {
                      const sName = (s.customerName || '').toLowerCase().trim();
                      const sPhone = (s.customerPhone || '').replace(/\D/g, '');
                      const phoneMatch = pPhone.length >= 6 && sPhone.length >= 6 && (pPhone === sPhone || sPhone.endsWith(pPhone) || pPhone.endsWith(sPhone));
                      const nameMatch = pName && sName === pName;
                      return Boolean(phoneMatch || nameMatch);
                    });

                    return (
                      <li
                        key={idx}
                        className={`px-3 py-2 text-xs cursor-pointer font-medium flex justify-between items-center transition-colors ${
                          profileHasActive
                            ? 'bg-rose-50 text-rose-800'
                            : 'text-slate-800 hover:bg-slate-50'
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectSuggestion(profile);
                        }}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-bold text-slate-900 truncate">{profile.customerName}</span>
                          {profileHasActive && (
                            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 border border-rose-200 shrink-0">
                              Active
                            </span>
                          )}
                        </div>
                        {profile.customerPhone && (
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                            {profile.customerPhone}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Advance Payment (Optional) */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700 font-mono">
                Advance Payment Received <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  className="col-span-2 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none text-xs font-mono font-bold"
                  placeholder="e.g. 500"
                />
                <select
                  value={advanceMethod}
                  onChange={(e) => setAdvanceMethod(e.target.value)}
                  className="rounded-lg bg-white border border-slate-200 px-2 py-1.5 text-slate-900 focus:border-slate-400 focus:outline-none text-xs font-semibold"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>
              {advanceAmount && parseFloat(advanceAmount) > 0 && (
                <p className="text-[10px] text-emerald-700 font-semibold font-mono">
                  ✓ ₹{parseFloat(advanceAmount).toFixed(2)} advance will be credited to this session.
                </p>
              )}
            </div>

            {/* Active Session & Udhar Warning Banners */}
            {(matchingActive || matchingUdhar) && (
              <div className="space-y-2 pt-1">
                {matchingActive && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-rose-800 font-bold text-xs uppercase tracking-wider">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                        <span>Active Session Detected</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-rose-200 text-rose-800 px-2 py-0.5 rounded-full border border-rose-300 uppercase">
                        Blocked
                      </span>
                    </div>

                    <p className="text-xs text-rose-800 leading-relaxed">
                      <strong>{matchingActive.customerName}</strong> already has a running session in the lounge.
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push(`/sessions/${matchingActive.id}`);
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open Existing Active Session
                    </button>
                  </div>
                )}

                {matchingUdhar && (
                  <div className="text-xs text-amber-800 bg-amber-50 py-2 px-3 rounded-xl border border-amber-200 leading-tight font-medium flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span>
                      <b>{matchingUdhar.customerName}</b> has an outstanding balance of <b>₹{matchingUdhar.totalOutstanding.toFixed(2)}</b>.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky Bottom Actions Bar */}
          <div className="flex justify-end gap-2.5 px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex justify-center items-center px-4 py-2 border border-slate-200 text-xs font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || Boolean(matchingActive)}
              className={`inline-flex justify-center items-center px-5 py-2 text-xs font-bold rounded-xl transition-all shadow-sm ${
                matchingActive
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
              ) : matchingActive ? (
                <>
                  <Lock className="h-3 w-3 mr-1" />
                  Active Session Exists
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 mr-1" />
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
