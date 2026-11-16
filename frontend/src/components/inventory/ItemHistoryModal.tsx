'use client';

import React, { useState, useEffect } from 'react';
import { X, History, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle, Clock, User } from 'lucide-react';
import { api } from '../../lib/api';
import { InventoryItemSummary } from './RestockModal';

interface Transaction {
  id: number;
  type: string;
  quantity: number;
  boxesCount?: number | null;
  piecesPerBox?: number | null;
  unitCost?: number | null;
  totalCost?: number | null;
  stockBefore: number;
  stockAfter: number;
  notes?: string | null;
  staffUsername?: string | null;
  createdAt: string;
}

interface ItemHistoryModalProps {
  item: InventoryItemSummary;
  onClose: () => void;
}

export const ItemHistoryModal: React.FC<ItemHistoryModalProps> = ({ item, onClose }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.get(`/inventory/transactions?itemId=${item.id}&limit=50`);
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [item.id]);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-display">
                Stock &amp; Audit History
              </h2>
              <p className="text-xs text-slate-500 truncate max-w-md">
                {item.name} • Current: <strong>{item.currentStock} {item.unit}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mb-2 text-blue-500" />
              <p className="text-xs">Loading transaction audit log...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold">No transactions recorded yet.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Restocks, sales, and manual count audits will show up here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.map(t => {
                const isRestock = t.type === 'RESTOCK';
                const isSale = t.type === 'SALE';
                const isReturn = t.type === 'RETURN';
                const isPositive = t.quantity > 0;

                return (
                  <div key={t.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isRestock
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : isSale
                            ? 'bg-blue-50 text-blue-600 border border-blue-200'
                            : isReturn
                            ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                            : 'bg-amber-50 text-amber-600 border border-amber-200'
                        }`}
                      >
                        {isPositive ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {t.type}
                          </span>
                          {t.boxesCount && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {t.boxesCount} boxes ({t.piecesPerBox || 10}/box)
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">
                            {formatDate(t.createdAt)}
                          </span>
                        </div>
                        {t.notes && (
                          <p className="text-xs text-slate-600 mt-0.5">{t.notes}</p>
                        )}
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                          <span>Before: <strong>{t.stockBefore}</strong></span>
                          <span>→</span>
                          <span>After: <strong>{t.stockAfter}</strong></span>
                          {t.staffUsername && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <User className="w-2.5 h-2.5" />
                                {t.staffUsername}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-black ${
                          isPositive ? 'text-emerald-600' : 'text-slate-700'
                        }`}
                      >
                        {isPositive ? `+${t.quantity}` : t.quantity} {item.unit}
                      </span>
                      {t.totalCost && (
                        <div className="text-[10px] text-slate-400 font-semibold">
                          ₹{t.totalCost}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/70 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

