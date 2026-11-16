'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Table } from '../types';
import { api } from '../lib/api';
import { X, Calendar, User, Phone, CheckCircle2 } from 'lucide-react';

interface BookTableModalProps {
  tables: Table[];
  onClose: () => void;
  onSuccess: (booking: any) => void;
}

interface CustomerMatch {
  id: number;
  name: string;
  firstName: string;
  lastName?: string;
  phone: string;
  totalVisits?: number;
}

export const BookTableModal: React.FC<BookTableModalProps> = ({
  tables,
  onClose,
  onSuccess
}) => {
  const [gameType, setGameType] = useState('Pool');
  const [tableId, setTableId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Live customer search states
  const [suggestions, setSuggestions] = useState<CustomerMatch[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerMatch | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Live search when typing name or phone
  useEffect(() => {
    const query = customerName.trim();
    if (query.length < 2) {
      setSuggestions([]);
      if (!selectedCustomer) {
        // clear selected if user erased
      }
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await api.get(`/customers/search?q=${encodeURIComponent(query)}`);
        if (Array.isArray(results)) {
          setSuggestions(results);
          // Auto-match if exact match found
          const exact = results.find(
            c => c.name.toLowerCase() === query.toLowerCase() ||
                 c.firstName.toLowerCase() === query.toLowerCase() ||
                 (contactNumber && c.phone === contactNumber.trim())
          );
          if (exact && !selectedCustomer) {
            setSelectedCustomer(exact);
            if (!contactNumber && exact.phone) {
              setContactNumber(exact.phone);
            }
          }
        }
      } catch (err) {
        console.error('Customer lookup failed:', err);
      }
    }, 200);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [customerName]);

  // Also check if contactNumber matches an existing customer
  useEffect(() => {
    const cleanPhone = contactNumber.trim().replace(/\D/g, '');
    if (cleanPhone.length >= 10 && !selectedCustomer) {
      api.get(`/customers/search?q=${encodeURIComponent(cleanPhone)}`)
        .then(results => {
          if (Array.isArray(results) && results.length > 0) {
            const matched = results.find(c => c.phone.includes(cleanPhone));
            if (matched) {
              setSelectedCustomer(matched);
              if (!customerName) {
                setCustomerName(matched.name);
              }
            }
          }
        })
        .catch(() => {});
    }
  }, [contactNumber]);

  const handleSelectSuggestion = (c: CustomerMatch) => {
    setCustomerName(c.name);
    setContactNumber(c.phone);
    setSelectedCustomer(c);
    setShowSuggestions(false);
  };

  const isExisting = Boolean(selectedCustomer) || suggestions.some(
    c => c.name.toLowerCase() === customerName.trim().toLowerCase() ||
         (contactNumber && c.phone === contactNumber.trim())
  );

  const isNew = customerName.trim().length >= 2 && !isExisting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableId || !customerName || !bookingTime) {
      setError('Please fill in all fields');
      return;
    }
    
    const selectedTime = new Date(bookingTime).getTime();
    if (selectedTime < Date.now()) {
      setError('You cannot book a table for a time in the past');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await api.post('/bookings', {
        tableId: parseInt(tableId),
        customerName: customerName.trim(),
        contactNumber: contactNumber.trim() || undefined,
        bookingTime: new Date(bookingTime).toISOString(),
      });
      onSuccess(data);
    } catch (err: any) {
      setError(err.message || 'Failed to book table');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-5">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 font-display">Advance Table Booking</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Reserve table for upcoming guest</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-700 text-xs font-semibold p-3 rounded-xl border border-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Game Category
            </label>
            <select
              value={gameType}
              onChange={(e) => {
                setGameType(e.target.value);
                setTableId('');
              }}
              className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs font-semibold"
            >
              <option value="Pool">Pool</option>
              <option value="MidSnooker">MidSnooker</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Select Table
            </label>
            <select
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs font-semibold"
            >
              <option value="">-- Choose a table --</option>
              {tables.filter(t => t.gameType === gameType).map((t) => (
                <option key={t.id} value={t.id.toString()}>
                  {t.name || (t.gameType === 'PS4' ? `Station ${t.number}` : `Table ${t.number}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-700">
                Customer Name
              </label>
              {isExisting ? (
                <span className="text-[10px] font-bold text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-blue-600" />
                  Existing Regular
                </span>
              ) : isNew ? (
                <span className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-mono">
                  New Customer
                </span>
              ) : null}
            </div>

            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                setSelectedCustomer(null);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs font-semibold"
              placeholder="e.g. Chirag Jain"
            />

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                {suggestions.map(c => (
                  <li 
                    key={c.id}
                    className="px-4 py-2.5 text-xs text-slate-800 hover:bg-slate-50 cursor-pointer font-medium flex items-center justify-between"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectSuggestion(c);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold text-slate-900">{c.name}</span>
                    </div>
                    {c.phone && (
                      <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {c.phone}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Contact Number
            </label>
            <input
              type="tel"
              value={contactNumber}
              onChange={(e) => {
                setContactNumber(e.target.value);
                setSelectedCustomer(null);
              }}
              placeholder="e.g. 7828872160"
              className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs font-mono font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Booking Date & Time
            </label>
            <input
              type="datetime-local"
              required
              min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
              value={bookingTime}
              onChange={(e) => setBookingTime(e.target.value)}
              className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs font-mono font-semibold"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex justify-center items-center px-4 py-2 border border-slate-200 text-xs font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex justify-center items-center px-5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-50 text-xs font-bold rounded-xl shadow-sm disabled:opacity-50 transition-all"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-1.5" />
                  Book Table
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
