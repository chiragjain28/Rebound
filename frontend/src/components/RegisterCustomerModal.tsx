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
  Sparkles
} from 'lucide-react';

interface RegisterCustomerModalProps {
  onClose: () => void;
  onSuccess?: (customer: any) => void;
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
  const [matchingCustomer, setMatchingCustomer] = useState<any | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check duplicate as user types phone or full name
  useEffect(() => {
    const cleanPhone = phone.trim().replace(/\D/g, '');
    const cleanFirst = firstName.trim();

    if (cleanPhone.length < 4 && cleanFirst.length < 2) {
      setMatchingCustomer(null);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setCheckingDuplicate(true);
        const query = cleanPhone.length >= 4 ? cleanPhone : cleanFirst;
        const results = await api.get(`/customers/search?q=${encodeURIComponent(query)}`);
        
        if (Array.isArray(results) && results.length > 0) {
          const exactPhone = cleanPhone.length >= 10 
            ? results.find(c => c.phone.replace(/\D/g, '').endsWith(cleanPhone) || cleanPhone.endsWith(c.phone.replace(/\D/g, '')))
            : null;
          
          const exactName = cleanFirst.length >= 3
            ? results.find(c => c.name.toLowerCase().includes(cleanFirst.toLowerCase()))
            : null;

          setMatchingCustomer(exactPhone || exactName || results[0]);
        } else {
          setMatchingCustomer(null);
        }
      } catch (e) {
        // Silent duplicate check failure
      } finally {
        setCheckingDuplicate(false);
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [firstName, phone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanPhone = phone.trim().replace(/\D/g, '');

    if (!cleanFirst) {
      setError('First name is required');
      return;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit phone number');
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
      // Redirect straight to customer 360 profile
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
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-display">
                Register New Customer
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Create permanent profile for orders, tables & udhar
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Duplicate Match Warning */}
          {matchingCustomer && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start justify-between gap-3 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Existing Customer Found</p>
                  <p className="text-[11px] text-amber-700 mt-0.5 font-medium flex items-center gap-1.5">
                    <span>{matchingCustomer.name}</span>
                    <span>•</span>
                    <Phone className="w-2.5 h-2.5 text-amber-700 inline shrink-0" />
                    <span>{matchingCustomer.phone}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/customers?phone=${encodeURIComponent(matchingCustomer.phone)}`);
                }}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg shrink-0 flex items-center gap-1 shadow-2xs"
              >
                <span>View</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Name Row */}
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
                  placeholder="e.g. Tony"
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
                placeholder="e.g. Stark"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Mobile Phone Number <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="tel"
                required
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="10-digit mobile number (e.g. 9876543210)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 font-mono transition-all"
              />
              {checkingDuplicate && (
                <div className="absolute right-3 top-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">
              Phone number is uniquely tied to this customer&apos;s lifetime visits & udhar balance.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Register & Open Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
