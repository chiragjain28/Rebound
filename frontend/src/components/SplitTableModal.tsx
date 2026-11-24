'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { 
  X, 
  Search, 
  User, 
  Users, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Gamepad2,
  Percent,
  Calculator
} from 'lucide-react';

interface SplitTableModalProps {
  tablePlay: {
    id: number;
    tableName?: string;
    gameType: string;
    cost: number;
    startTime: string;
    endTime?: string | null;
  };
  currentCustomer: {
    id: number | string;
    name: string;
    phone?: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

interface SplitParticipant {
  customerId: number | string;
  name: string;
  phone?: string;
  amount: number;
  isOriginal?: boolean;
}

interface CustomerSuggestion {
  id: number;
  name: string;
  phone: string;
}

export const SplitTableModal: React.FC<SplitTableModalProps> = ({
  tablePlay,
  currentCustomer,
  onClose,
  onSuccess
}) => {
  const totalCost = tablePlay.cost;
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [participants, setParticipants] = useState<SplitParticipant[]>([
    {
      customerId: currentCustomer.id,
      name: currentCustomer.name,
      phone: currentCustomer.phone,
      amount: totalCost,
      isOriginal: true
    }
  ]);

  // Co-player search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Recalculate equal amounts whenever participant list changes (if in equal mode)
  const calculateEqualSplit = (playerList: SplitParticipant[]) => {
    const n = playerList.length;
    if (n === 0) return playerList;

    const baseAmount = Math.floor((totalCost / n) * 100) / 100;
    let remainder = Math.round((totalCost - baseAmount * n) * 100) / 100;

    return playerList.map((p, idx) => {
      let share = baseAmount;
      if (remainder > 0.009) {
        share = Math.round((share + 0.01) * 100) / 100;
        remainder = Math.round((remainder - 0.01) * 100) / 100;
      }
      return { ...p, amount: share };
    });
  };

  // Live customer search
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
          // Exclude already added participants
          const existingIds = new Set(participants.map((p) => String(p.customerId)));
          setSearchResults(results.filter((c: any) => !existingIds.has(String(c.id))));
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
  }, [searchQuery, participants]);

  // Add co-player to split
  const handleAddParticipant = (cust: CustomerSuggestion) => {
    const updated = [
      ...participants,
      {
        customerId: cust.id,
        name: cust.name,
        phone: cust.phone,
        amount: 0
      }
    ];

    if (splitMode === 'equal') {
      setParticipants(calculateEqualSplit(updated));
    } else {
      setParticipants(updated);
    }

    setSearchQuery('');
    setSearchResults([]);
    setError('');
  };

  // Remove co-player from split
  const handleRemoveParticipant = (customerId: number | string) => {
    if (participants.length <= 1) return;
    const updated = participants.filter((p) => String(p.customerId) !== String(customerId));

    if (splitMode === 'equal') {
      setParticipants(calculateEqualSplit(updated));
    } else {
      setParticipants(updated);
    }
  };

  // Switch to Equal mode
  const handleSelectEqualMode = () => {
    setSplitMode('equal');
    setParticipants(calculateEqualSplit(participants));
    setError('');
  };

  // Update specific player's custom amount
  const handleCustomAmountChange = (customerId: number | string, value: string) => {
    const parsed = parseFloat(value) || 0;
    setParticipants((prev) =>
      prev.map((p) => (String(p.customerId) === String(customerId) ? { ...p, amount: parsed } : p))
    );
  };

  // Financial verification
  const allocatedSum = Math.round(participants.reduce((sum, p) => sum + (p.amount || 0), 0) * 100) / 100;
  const difference = Math.round((totalCost - allocatedSum) * 100) / 100;
  const isBalanced = Math.abs(difference) <= 0.05 && participants.length >= 2;

  const handleConfirmSplit = async () => {
    if (participants.length < 2) {
      setError('Please add at least one co-player to split this bill.');
      return;
    }

    if (!isBalanced) {
      setError(`Allocated sum (₹${allocatedSum.toFixed(2)}) must exactly equal the total bill of ₹${totalCost.toFixed(2)}.`);
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      await api.post(`/visits/table-play/${tablePlay.id}/split`, {
        splits: participants.map((p) => ({
          customerId: p.customerId,
          amount: p.amount
        }))
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to split table play');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-display">
                Split Table Bill
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Divide charge among 2, 3, 4 or more players
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

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Table Summary & Total Banner */}
          <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Table Session
                </span>
                <p className="text-sm font-extrabold font-display">
                  {tablePlay.tableName || `${tablePlay.gameType} Table`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                Total Bill
              </span>
              <span className="text-xl font-black font-mono text-emerald-400">
                ₹{totalCost.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Mode Switcher Pills */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
              Split Strategy:
            </span>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={handleSelectEqualMode}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  splitMode === 'equal'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calculator className="w-3.5 h-3.5 text-blue-600" />
                <span>Split Equally</span>
              </button>
              <button
                type="button"
                onClick={() => setSplitMode('custom')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  splitMode === 'custom'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Percent className="w-3.5 h-3.5 text-amber-600" />
                <span>Custom Amounts</span>
              </button>
            </div>
          </div>

          {/* Add Co-Player Search Input */}
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="+ Add Co-Player by name or phone..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-9 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition-all shadow-2xs"
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
              <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs max-h-40 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400">
                    {searching ? 'Searching players...' : `No registered customer matching "${searchQuery}"`}
                  </div>
                ) : (
                  searchResults.map((cust) => (
                    <div
                      key={cust.id}
                      onClick={() => handleAddParticipant(cust)}
                      className="p-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs font-display">
                          {cust.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 group-hover:text-blue-600">
                            {cust.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {cust.phone}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Participant Breakdown List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono px-1">
              <span>Split Participants ({participants.length} Players)</span>
              <span>Amount to Bill</span>
            </div>

            <div className="space-y-2">
              {participants.map((p, idx) => (
                <div
                  key={p.customerId}
                  className="p-3 rounded-2xl border border-slate-200 bg-white flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-xs font-black font-display text-slate-700 shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-extrabold text-xs text-slate-900 truncate">
                          {p.name}
                        </p>
                        {p.isOriginal && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono shrink-0">
                            Host
                          </span>
                        )}
                      </div>
                      {p.phone && (
                        <p className="text-[10px] text-slate-400 font-mono truncate">
                          {p.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Share Amount Input or Display */}
                  <div className="flex items-center gap-2 shrink-0">
                    {splitMode === 'custom' ? (
                      <div className="relative w-28">
                        <span className="absolute left-2.5 top-2 text-xs font-mono text-slate-400 font-bold">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={p.amount}
                          onChange={(e) => handleCustomAmountChange(p.customerId, e.target.value)}
                          className="w-full pl-6 pr-2 py-1.5 text-xs font-mono font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white text-right"
                        />
                      </div>
                    ) : (
                      <div className="text-right">
                        <span className="text-sm font-black font-mono text-slate-900">
                          ₹{p.amount.toFixed(2)}
                        </span>
                        <p className="text-[9px] font-bold text-blue-600 font-mono">
                          {((p.amount / totalCost) * 100).toFixed(0)}%
                        </p>
                      </div>
                    )}

                    {!p.isOriginal && (
                      <button
                        type="button"
                        onClick={() => handleRemoveParticipant(p.customerId)}
                        title="Remove co-player"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Allocation Balance Status Ribbon */}
          <div
            className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-semibold ${
              isBalanced
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {isBalanced ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>
                {participants.length < 2
                  ? 'Add at least 1 co-player to split'
                  : isBalanced
                  ? 'Perfect Split: Exact ₹' + totalCost.toFixed(2) + ' allocated'
                  : difference > 0
                  ? `Remaining to allocate: ₹${difference.toFixed(2)}`
                  : `Overallocated by: ₹${Math.abs(difference).toFixed(2)}`}
              </span>
            </div>
            <span className="font-mono font-bold">
              ₹{allocatedSum.toFixed(2)} / ₹{totalCost.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmSplit}
            disabled={!isBalanced || submitting}
            className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Splitting...</span>
              </>
            ) : (
              <span>Confirm Split ({participants.length} Players)</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
