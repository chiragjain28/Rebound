'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { 
  X, 
  UserPlus, 
  Phone, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink, 
  Loader2, 
  Search 
} from 'lucide-react';

interface RegisterCustomerModalProps {
  onClose: () => void;
  onSuccess?: (customer: any) => void;
}

interface MatchingCustomer {
  id: number | string;
  name: string;
  firstName: string;
  lastName?: string;
  phone: string;
  currentCreditDue?: number;
}

export const RegisterCustomerModal: React.FC<RegisterCustomerModalProps> = ({
  onClose,
  onSuccess
}) => {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Dropdown & Search States
  const [nameMatches, setNameMatches] = useState<MatchingCustomer[]>([]);
  const [phoneMatches, setPhoneMatches] = useState<MatchingCustomer[]>([]);
  const [searchingName, setSearchingName] = useState(false);
  const [searchingPhone, setSearchingPhone] = useState(false);
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const [exactPhoneMatch, setExactPhoneMatch] = useState<MatchingCustomer | null>(null);

  const nameTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const phoneTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nameContainerRef = useRef<HTMLDivElement | null>(null);
  const phoneContainerRef = useRef<HTMLDivElement | null>(null);

  // Normalize phone (strip non-digits, and if 11 digits with leading 0 or 12 digits with leading 91, extract 10 digits)
  const rawDigits = phone.trim().replace(/\D/g, '');
  let cleanPhone = rawDigits;
  if (rawDigits.length === 11 && rawDigits.startsWith('0')) {
    cleanPhone = rawDigits.slice(1);
  } else if (rawDigits.length === 12 && rawDigits.startsWith('91')) {
    cleanPhone = rawDigits.slice(2);
  } else if (rawDigits.length > 10) {
    cleanPhone = rawDigits.slice(-10);
  }

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (nameContainerRef.current && !nameContainerRef.current.contains(e.target as Node)) {
        setShowNameDropdown(false);
      }
      if (phoneContainerRef.current && !phoneContainerRef.current.contains(e.target as Node)) {
        setShowPhoneDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // 1. Live Name Search (e.g. typing "Chi" brings all matching customers)
  useEffect(() => {
    const cleanFirst = firstName.trim();
    if (cleanFirst.length < 2) {
      setNameMatches([]);
      setShowNameDropdown(false);
      return;
    }

    if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current);

    nameTimeoutRef.current = setTimeout(async () => {
      try {
        setSearchingName(true);
        const results = await api.get(`/customers/search?q=${encodeURIComponent(cleanFirst)}`);
        if (Array.isArray(results)) {
          // Filter to those whose name or firstName contains the query
          const filtered = results.filter((c: any) => 
            (c.name || '').toLowerCase().includes(cleanFirst.toLowerCase()) ||
            (c.firstName || '').toLowerCase().includes(cleanFirst.toLowerCase()) ||
            (c.lastName || '').toLowerCase().includes(cleanFirst.toLowerCase())
          );
          setNameMatches(filtered);
          setShowNameDropdown(filtered.length > 0);
        } else {
          setNameMatches([]);
          setShowNameDropdown(false);
        }
      } catch (err) {
        setNameMatches([]);
      } finally {
        setSearchingName(false);
      }
    }, 250);

    return () => {
      if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current);
    };
  }, [firstName]);

  // 2. Live Phone Search (e.g. typing "7828" brings all matching phones & checks duplicates)
  useEffect(() => {
    if (cleanPhone.length < 3) {
      setPhoneMatches([]);
      setExactPhoneMatch(null);
      setShowPhoneDropdown(false);
      return;
    }

    if (phoneTimeoutRef.current) clearTimeout(phoneTimeoutRef.current);

    phoneTimeoutRef.current = setTimeout(async () => {
      try {
        setSearchingPhone(true);
        const results = await api.get(`/customers/search?q=${encodeURIComponent(cleanPhone)}`);
        if (Array.isArray(results)) {
          // Filter customers whose real phone contains the digits (exclude WALK- and QUICK- placeholders)
          const filtered = results.filter((c: any) => 
            !c.phone?.startsWith('WALK-') &&
            !c.phone?.startsWith('QUICK-') &&
            (c.phone || '').replace(/\D/g, '').includes(cleanPhone)
          );
          setPhoneMatches(filtered);
          setShowPhoneDropdown(filtered.length > 0 && cleanPhone.length < 10);

          // Check if there is an exact duplicate (strict 10-digit match)
          const exact = cleanPhone.length === 10 ? results.find((c: any) => {
            if (c.phone?.startsWith('WALK-') || c.phone?.startsWith('QUICK-')) return false;
            const cPhone = (c.phone || '').replace(/\D/g, '').slice(-10);
            return cPhone === cleanPhone;
          }) : null;
          setExactPhoneMatch(exact || null);
        } else {
          setPhoneMatches([]);
          setExactPhoneMatch(null);
          setShowPhoneDropdown(false);
        }
      } catch (err) {
        setPhoneMatches([]);
        setExactPhoneMatch(null);
      } finally {
        setSearchingPhone(false);
      }
    }, 250);

    return () => {
      if (phoneTimeoutRef.current) clearTimeout(phoneTimeoutRef.current);
    };
  }, [cleanPhone]);

  // Select customer from dropdown
  const handleSelectCustomer = (customer: MatchingCustomer) => {
    setFirstName(customer.firstName || customer.name.split(' ')[0] || '');
    setLastName(customer.lastName || customer.name.split(' ').slice(1).join(' ') || '');
    if (!customer.phone?.startsWith('WALK-') && !customer.phone?.startsWith('QUICK-')) {
      setPhone(customer.phone.replace(/\D/g, ''));
      setExactPhoneMatch(customer);
    } else {
      setPhone('');
      setExactPhoneMatch(null);
    }
    setShowNameDropdown(false);
    setShowPhoneDropdown(false);
  };

  const isDuplicatePhone = Boolean(exactPhoneMatch);
  const isFormValid = firstName.trim().length > 0 && cleanPhone.length === 10 && !isDuplicatePhone;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();

    if (!cleanFirst) {
      setError('Please enter first name');
      return;
    }

    if (cleanPhone.length !== 10) {
      setError(`Mobile phone number must be 10 digits (currently ${cleanPhone.length} digits)`);
      return;
    }

    if (isDuplicatePhone && exactPhoneMatch) {
      setError(`Phone number ${cleanPhone} is already registered to ${exactPhoneMatch.name}. Duplicate phone numbers are prohibited.`);
      return;
    }

    try {
      setSubmitting(true);
      const newCustomer = await api.post('/customers', {
        firstName: cleanFirst,
        lastName: cleanLast,
        phone: cleanPhone
      });

      if (onSuccess) {
        onSuccess(newCustomer);
      }

      onClose();
      // Redirect straight to customer profile
      router.push(`/customers?phone=${encodeURIComponent(cleanPhone)}`);
    } catch (err: any) {
      setError(err.message || 'Failed to register customer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-display">
                Register New Customer
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Create permanent profile for visits, gameplay &amp; credit account
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Name Row with Live Typeahead Dropdown */}
          <div ref={nameContainerRef} className="relative">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  First Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    autoFocus
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    onFocus={() => {
                      if (nameMatches.length > 0) setShowNameDropdown(true);
                    }}
                    placeholder="e.g. Chirag"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                  />
                  {searchingName && (
                    <div className="absolute right-2.5 top-2.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Last Name <span className="text-slate-400 text-[10px] normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  onFocus={() => setShowNameDropdown(false)}
                  placeholder="e.g. Jain"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                />
              </div>
            </div>

            {/* Live Name Search Results */}
            {showNameDropdown && nameMatches.length > 0 && (
              <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-40 overflow-y-auto">
                <div className="px-3 py-1.5 bg-slate-100/80 text-[10px] font-semibold text-slate-500 flex justify-between items-center">
                  <span>Existing customers matching &quot;{firstName}&quot; ({nameMatches.length})</span>
                  <button 
                    type="button" 
                    onClick={() => setShowNameDropdown(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs px-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                {nameMatches.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCustomer(c)}
                    className="p-2 hover:bg-slate-100/60 cursor-pointer flex items-center justify-between text-xs transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <span>{c.name}</span>
                        {c.phone === cleanPhone && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">
                            Exact Match
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" /> {c.phone}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                        router.push(`/customers?phone=${encodeURIComponent(c.phone)}`);
                      }}
                      className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-[10px] rounded-lg shrink-0 flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <span>View</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Phone Number with Live Search */}
          <div ref={phoneContainerRef} className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Mobile Phone Number <span className="text-rose-500">*</span>
              </label>
              <span className={`text-[10px] font-mono font-medium ${cleanPhone.length === 10 ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                {cleanPhone.length === 10 ? '✓ 10 digits' : `${cleanPhone.length}/10 digits`}
              </span>
            </div>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="tel"
                required
                maxLength={14}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setExactPhoneMatch(null);
                  setError('');
                }}
                onFocus={() => {
                  setShowNameDropdown(false);
                  if (phoneMatches.length > 0 && cleanPhone.length < 10) {
                    setShowPhoneDropdown(true);
                  }
                }}
                placeholder="10-digit mobile number"
                className={`w-full bg-slate-50 border rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 font-mono transition-all ${
                  isDuplicatePhone
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10 bg-rose-50/20'
                    : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                }`}
              />
              {searchingPhone && (
                <div className="absolute right-3 top-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              )}
            </div>

            {exactPhoneMatch && (
              <div className="text-xs text-rose-600 mt-1.5 flex items-center justify-between font-medium">
                <span>Already registered to {exactPhoneMatch.name} ({exactPhoneMatch.phone})</span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(`/customers?phone=${encodeURIComponent(exactPhoneMatch.phone)}`);
                  }}
                  className="text-slate-900 font-bold hover:underline cursor-pointer ml-2"
                >
                  View Profile →
                </button>
              </div>
            )}

            {/* Live Phone Number Search Results */}
            {showPhoneDropdown && phoneMatches.length > 0 && (
              <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-40 overflow-y-auto">
                <div className="px-3 py-1.5 bg-slate-100/80 text-[10px] font-semibold text-slate-500 flex justify-between items-center">
                  <span>Registered accounts matching &quot;{cleanPhone}&quot; ({phoneMatches.length})</span>
                  <button 
                    type="button" 
                    onClick={() => setShowPhoneDropdown(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs px-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                {phoneMatches.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCustomer(c)}
                    className="p-2 hover:bg-slate-100/60 cursor-pointer flex items-center justify-between text-xs transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-slate-900">{c.name}</p>
                      <p className="text-[11px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" /> {c.phone}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                        router.push(`/customers?phone=${encodeURIComponent(c.phone)}`);
                      }}
                      className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-[10px] rounded-lg shrink-0 flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <span>View</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white shadow-xs hover:shadow-sm cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <span>Register Customer</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
