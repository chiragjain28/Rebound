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
  const CUSTOMER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds

  useEffect(() => {
    const fetchCustomers = async () => {
      // 1. Check localStorage cache first
      try {
        const cached = localStorage.getItem(CUSTOMER_CACHE_KEY);
        if (cached) {
          const { names, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CUSTOMER_CACHE_TTL && Array.isArray(names)) {
            setCustomerList(names);
            return; // Cache is fresh — no DB hit needed
          }
        }
      } catch (e) { /* ignore corrupt cache */ }

      // 2. Cache is stale or missing — fetch from API
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

    setError('');
    setLoading(true);
    try {
      const data = await api.post('/bookings', {
        tableId: parseInt(tableId),
        customerName,
        contactNumber: contactNumber || null,
        bookingTime
      });
      onSuccess(data);
    } catch (err: any) {
      setError(err.message || 'Failed to book table');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-[#111827] rounded-3xl border border-slate-800 w-full max-w-md shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden p-6 space-y-6">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h2 className="text-lg font-extrabold text-white font-display uppercase tracking-wide">Book Billiard Table</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-950/60 text-rose-300 text-xs font-bold p-3 rounded-xl border border-rose-500/40">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 font-mono">
              Select Game Type
            </label>
            <select
              value={gameType}
              onChange={(e) => {
                setGameType(e.target.value);
                setTableId('');
              }}
              className="block w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-semibold"
            >
              <option value="Pool">Pool</option>
              <option value="MidSnooker">MidSnooker</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 font-mono">
              Select Table
            </label>
            <select
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              className="block w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-semibold"
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
            <label className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 font-mono">
              <span>Customer Name</span>
              {isNew && <span className="text-[9px] font-extrabold text-emerald-300 uppercase tracking-widest bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-500/40 font-mono">New Customer</span>}
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
              className="block w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-semibold"
              placeholder="e.g. John Doe"
            />
            {/* Suggestions Dropdown */}
            {showSuggestions && matchedSuggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                {matchedSuggestions.map(name => (
                  <li 
                    key={name}
                    className="px-4 py-2.5 text-xs text-slate-200 hover:bg-slate-800 hover:text-cyan-300 cursor-pointer font-semibold border-b border-slate-800/60 last:border-0"
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
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 font-mono">
              Contact Number
            </label>
            <input
              type="tel"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              className="block w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-mono font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 font-mono">
              Booking Time
            </label>
            <input
              type="datetime-local"
              required
              min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
              value={bookingTime}
              onChange={(e) => setBookingTime(e.target.value)}
              className="block w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-mono font-semibold"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800/80">
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
              className="inline-flex justify-center items-center px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-extrabold uppercase tracking-wider rounded-xl text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] disabled:opacity-50 transition-all custom-button"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
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

