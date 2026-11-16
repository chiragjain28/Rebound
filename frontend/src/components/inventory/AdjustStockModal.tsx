'use client';

import React, { useState } from 'react';
import { X, SlidersHorizontal, AlertCircle, Check, HelpCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { InventoryItemSummary } from './RestockModal';

interface AdjustStockModalProps {
  item: InventoryItemSummary;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdjustStockModal: React.FC<AdjustStockModalProps> = ({
  item,
  onClose,
  onSuccess,
}) => {
  const [actualStock, setActualStock] = useState<string>(item.currentStock.toString());
  const [reason, setReason] = useState<'audit' | 'damage' | 'wastage' | 'personal'>('audit');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const targetNum = parseInt(actualStock) || 0;
  const diff = targetNum - item.currentStock;

  const piecesPerBox = item.piecesPerBox > 0 ? item.piecesPerBox : 1;
  const currentBoxes = Math.floor(item.currentStock / piecesPerBox);
  const currentLoose = item.currentStock % piecesPerBox;

  const targetBoxes = Math.floor(targetNum / piecesPerBox);
  const targetLoose = targetNum % piecesPerBox;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isNaN(targetNum) || targetNum < 0) {
      setError('Please enter a valid stock count (0 or higher).');
      return;
    }

    try {
      setLoading(true);
      await api.post('/inventory/adjust', {
        itemId: item.id,
        newStock: targetNum,
        reason,
        notes: notes.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to adjust stock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-display">
                Adjust Physical Stock
              </h2>
              <p className="text-xs text-slate-500 truncate max-w-[240px]">
                {item.name}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Current System vs Physical Count */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">System Recorded Stock:</span>
              <strong className="text-slate-900 font-bold">
                {item.currentStock} {item.unit}
                {piecesPerBox > 1 && ` (${currentBoxes} boxes, ${currentLoose} loose)`}
              </strong>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Pack / Box Standard:</span>
              <span className="font-semibold text-slate-700">{piecesPerBox} {item.unit} per box</span>
            </div>
          </div>

          {/* New Physical Count Input */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              Actual Physical Count ({item.unit})
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={actualStock}
              onChange={e => setActualStock(e.target.value)}
              className="w-full px-4 py-2.5 text-base font-bold text-slate-900 bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
              placeholder="0"
            />
            {piecesPerBox > 1 && (
              <p className="mt-1 text-center text-[11px] text-slate-500 font-medium">
                Equivalent to: <strong className="text-purple-700 font-bold">{targetBoxes} full boxes + {targetLoose} loose pieces</strong>
              </p>
            )}
          </div>

          {/* Difference Indicator */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold">
            <span className="text-slate-500">Stock Discrepancy / Adjustment:</span>
            <span
              className={
                diff > 0
                  ? 'text-emerald-600 font-black'
                  : diff < 0
                  ? 'text-rose-600 font-black'
                  : 'text-slate-600'
              }
            >
              {diff > 0 ? `+${diff}` : diff} {item.unit}
            </span>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              Adjustment Reason
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value as any)}
              className="w-full px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="audit">Physical Count Audit Discrepancy</option>
              <option value="damage">Damaged / Expired / Broken Goods</option>
              <option value="wastage">Loss / Shrinkage / Wastage</option>
              <option value="personal">Owner / Staff Personal Consumption</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              Audit Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. End of night counter audit, counted drawer"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Apply Adjustment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

