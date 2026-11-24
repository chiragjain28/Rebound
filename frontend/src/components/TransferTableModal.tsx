'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { 
  X, 
  Search, 
  User, 
  Phone, 
  ArrowRightLeft, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Gamepad2,
  ShieldAlert
} from 'lucide-react';

interface TransferTableModalProps {
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

interface CustomerSuggestion {
  id: number;
  name: string;
  phone: string;
}

export const TransferTableModal: React.FC<TransferTableModalProps> = ({
  tablePlay,
  currentCustomer,
  onClose,
  onSuccess
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<CustomerSuggestion | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          // Exclude current customer from transfer suggestions
          setSearchResults(results.filter((c: any) => String(c.id) !== String(currentCustomer.id)));
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
  }, [searchQuery, currentCustomer.id]);

  const handleConfirmTransfer = async () => {
    if (!selectedTarget) {
      setError('Please select a target customer to transfer this table to.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      await api.post(`/visits/table-play/${tablePlay.id}/transfer`, {
        targetCustomerId: selectedTarget.id
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to transfer table play');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-display">
                Transfer Table Play
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Loser pays / Shift table charge to co-player
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

          {/* Table Details Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-200/80 flex items-center justify-center text-slate-700">
                <Gamepad2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 font-display">
                  {tablePlay.tableName || `${tablePlay.gameType} Table`}
                </p>
                <p className="text-[10px] text-slate-500">
                  Currently billed to: <span className="font-bold text-slate-700">{currentCustomer.name}</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-black text-slate-900 font-mono">
                ₹{tablePlay.cost.toFixed(2)}
              </span>
              <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">
                Full Charge
              </p>
            </div>
          </div>

          {/* Search Co-Player / Target Customer */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 font-mono">
              <User className="h-3.5 w-3.5 text-slate-500" />
              <span>Select Co-Player to Bill (Transfer To)</span>
            </label>

            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search friend by name or phone..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-9 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600/10 focus:border-purple-600 transition-all shadow-2xs"
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

            {/* Suggestions List */}
            {searchQuery.trim().length > 0 && !selectedTarget && (
              <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs max-h-48 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <div className="p-3.5 text-center text-xs text-slate-400">
                    {searching ? 'Searching registered players...' : `No registered customer found for "${searchQuery}"`}
                  </div>
                ) : (
                  searchResults.map((cust) => (
                    <div
                      key={cust.id}
                      onClick={() => {
                        setSelectedTarget(cust);
                        setSearchQuery('');
                        setError('');
                      }}
                      className="p-3 hover:bg-purple-50/70 cursor-pointer flex items-center justify-between transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs group-hover:scale-105 transition-transform font-display">
                          {cust.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                            {cust.name}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{cust.phone}</span>
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                        Select
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected Target Customer Card */}
          {selectedTarget && (
            <div className="p-4 rounded-2xl bg-purple-50/70 border-2 border-purple-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                  <span>Transfer Recipient</span>
                </span>
                <button
                  onClick={() => setSelectedTarget(null)}
                  className="text-xs text-purple-700 hover:text-purple-900 font-bold underline cursor-pointer"
                >
                  Change
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-700 text-white flex items-center justify-center font-bold text-sm font-display shadow-2xs">
                  {selectedTarget.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    {selectedTarget.name}
                  </h4>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedTarget.phone}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-purple-900 font-medium pt-1 border-t border-purple-200/60">
                ₹{tablePlay.cost.toFixed(2)} will be removed from <span className="font-bold">{currentCustomer.name}</span> and added to <span className="font-bold">{selectedTarget.name}</span>&apos;s bill.
              </p>
            </div>
          )}
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
            onClick={handleConfirmTransfer}
            disabled={!selectedTarget || submitting}
            className="flex-1 py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Transferring...</span>
              </>
            ) : (
              <span>Confirm Transfer (₹{tablePlay.cost.toFixed(2)})</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
