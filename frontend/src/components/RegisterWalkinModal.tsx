'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { 
  X, 
  UserCheck, 
  Phone, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  Loader2
} from 'lucide-react';

interface RegisterWalkinModalProps {
  customerId: number | string;
  currentName: string;
  currentFirstName?: string;
  currentLastName?: string;
  currentWalkinPhone?: string;
  onClose: () => void;
  onSuccess: (updatedCustomer: any) => void;
}

export const RegisterWalkinModal: React.FC<RegisterWalkinModalProps> = ({
  customerId,
  currentName,
  currentFirstName = '',
  currentLastName = '',
  currentWalkinPhone = '',
  onClose,
  onSuccess
}) => {
  const initialFirst = currentFirstName || currentName.split(' ')[0] || '';
  const initialLast = currentLastName || currentName.split(' ').slice(1).join(' ') || '';

  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Duplicate phone check states
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [duplicateCustomer, setDuplicateCustomer] = useState<{ id: number; name: string; phone: string } | null>(null);
  const phoneCheckTimeout = useRef<NodeJS.Timeout | null>(null);

  const rawDigits = phone.trim().replace(/\D/g, '');
  let cleanPhone = rawDigits;
  if (rawDigits.length === 11 && rawDigits.startsWith('0')) {
    cleanPhone = rawDigits.slice(1);
  } else if (rawDigits.length === 12 && rawDigits.startsWith('91')) {
    cleanPhone = rawDigits.slice(2);
  } else if (rawDigits.length > 10) {
    cleanPhone = rawDigits.slice(-10);
  }

  useEffect(() => {
    if (cleanPhone.length < 10) {
      setDuplicateCustomer(null);
      setCheckingDuplicate(false);
      return;
    }

    if (phoneCheckTimeout.current) clearTimeout(phoneCheckTimeout.current);

    phoneCheckTimeout.current = setTimeout(async () => {
      try {
        setCheckingDuplicate(true);
        const results = await api.get(`/customers/search?q=${encodeURIComponent(cleanPhone)}`);
        if (Array.isArray(results)) {
          const match = results.find((c: any) => 
            c.id !== customerId && 
            !c.phone?.startsWith('WALK-') &&
            (c.phone === cleanPhone || c.phone.replace(/\D/g, '').endsWith(cleanPhone))
          );
          setDuplicateCustomer(match || null);
        } else {
          setDuplicateCustomer(null);
        }
      } catch (err) {
        setDuplicateCustomer(null);
      } finally {
        setCheckingDuplicate(false);
      }
    }, 250);

    return () => {
      if (phoneCheckTimeout.current) clearTimeout(phoneCheckTimeout.current);
    };
  }, [cleanPhone, customerId]);

  const isFormValid = firstName.trim().length > 0 && cleanPhone.length === 10 && !duplicateCustomer && !checkingDuplicate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();

    if (!cleanFirst) {
      setError('First name is required');
      return;
    }

    if (cleanPhone.length !== 10) {
      setError(`Mobile phone number must be 10 digits (currently ${cleanPhone.length} digits)`);
      return;
    }

    if (duplicateCustomer) {
      setError(`Phone number ${cleanPhone} is already registered to ${duplicateCustomer.name}. Duplicate phone numbers are prohibited.`);
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post(`/customers/${customerId}/register-walkin`, {
        phone: cleanPhone,
        firstName: cleanFirst,
        lastName: cleanLast
      });

      onSuccess(res.customer || res);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to register customer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  Register Customer
                </h2>
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  Walk-in #{customerId}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Add phone number to complete profile
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Duplicate Phone Warning */}
          {duplicateCustomer && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between animate-in fade-in">
              <span>Already registered to <span className="font-bold">{duplicateCustomer.name}</span> ({duplicateCustomer.phone})</span>
            </div>
          )}

          {/* Names */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                First Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                />
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
                placeholder="Last name"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
              />
            </div>
          </div>

          {/* Mobile Phone Number */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Phone Number <span className="text-rose-500">*</span>
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
                autoFocus
                maxLength={14}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError('');
                }}
                placeholder="10-digit mobile number"
                className={`w-full bg-slate-50 border rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 font-mono transition-all ${
                  duplicateCustomer
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10 bg-rose-50/20'
                    : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                }`}
              />
              {checkingDuplicate && (
                <div className="absolute right-3 top-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              )}
              {!checkingDuplicate && cleanPhone.length === 10 && !duplicateCustomer && (
                <div className="absolute right-3 top-2.5 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-xs hover:shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Customer</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
