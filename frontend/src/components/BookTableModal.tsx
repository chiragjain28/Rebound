'use client';

import React, { useState, useEffect } from 'react';
import { Table } from '../types';
import { api } from '../lib/api';
import { X, Calendar } from 'lucide-react';

interface BookTableModalProps {
  tables: Table[];
  onClose: () => void;
  onSuccess: (booking: any) => void;
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
  const [customerList, setCustomerList] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const CUSTOMER_CACHE_KEY = 'rebound_customer_names_cache';
  const CUSTOMER_CACHE_TTL = 30 * 60 * 1000;

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const cached = localStorage.getItem(CUSTOMER_CACHE_KEY);
        if (cached) {
          const { names, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CUSTOMER_CACHE_TTL && Array.isArray(names)) {
            setCustomerList(names);
            return;
          }
        }
      } catch (e) { /* ignore corrupt cache */ }

      try {
        const names = await api.get('/sessions/customers/all');
        if (Array.isArray(names)) {
          setCustomerList(names);
          localStorage.setItem(CUSTOMER_CACHE_KEY, JSON.stringify({ names, timestamp: Date.now() }));
        }
      } catch (err) {
        console.error('Failed to fetch customer list', err);
      }
    };
    fetchCustomers();
  }, []);

  const trimmedInput = customerName.trim();
  const matchedSuggestions = trimmedInput.length >= 1
    ? customerList.filter(name => name.toLowerCase().includes(trimmedInput.toLowerCase()) && name.toLowerCase() !== trimmedInput.toLowerCase())
    : [];
  const isExactMatch = customerList.some(name => name.toLowerCase() === trimmedInput.toLowerCase());
  const hasPartialMatches = customerList.some(name => name.toLowerCase().includes(trimmedInput.toLowerCase()) && name.toLowerCase() !== trimmedInput.toLowerCase());
  const isNew = trimmedInput.length > 0 && !isExactMatch && !hasPartialMatches;

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
                  Table {t.number}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <label className="flex justify-between items-center text-xs font-bold text-slate-700 mb-1">
              <span>Customer Name</span>
              {isNew && <span className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-mono">New Customer</span>}
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs font-semibold"
              placeholder="e.g. Tony Stark"
            />
            {showSuggestions && matchedSuggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                {matchedSuggestions.map(name => (
                  <li 
                    key={name}
                    className="px-4 py-2 text-xs text-slate-800 hover:bg-slate-50 cursor-pointer font-medium"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setCustomerName(name);
                      setShowSuggestions(false);
                    }}
                  >
                    {name}
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
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="e.g. 9876543210"
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
