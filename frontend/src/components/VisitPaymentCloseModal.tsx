'use client';

import React, { useState } from 'react';
import { api } from '../lib/api';
import { X, CheckCircle2, AlertCircle, Banknote, QrCode } from 'lucide-react';

interface VisitPaymentCloseModalProps {
  visitId: string;
  customerName: string;
  customerId: string | number;
  visitTotal: number;
  initialMode?: 'full' | 'partial';
  onClose: () => void;
  onSuccess: () => void;
}

export const VisitPaymentCloseModal: React.FC<VisitPaymentCloseModalProps> = ({
  visitId,
  customerName,
  customerId,
  visitTotal,
  initialMode = 'full',
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'full' | 'partial'>(initialMode);
  const [amountInput, setAmountInput] = useState<string>(
    initialMode === 'full' ? visitTotal.toFixed(2) : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI'>('Cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const numAmount = mode === 'full' ? visitTotal : Math.max(0, parseFloat(amountInput || '0'));
  const remainingUdhar = Math.max(0, Math.round((visitTotal - numAmount) * 100) / 100);

  const handleModeChange = (newMode: 'full' | 'partial') => {
    setMode(newMode);
    setError('');
    if (newMode === 'full') {
      setAmountInput(visitTotal.toFixed(2));
    } else {
      setAmountInput('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'partial') {
      if (isNaN(numAmount) || numAmount < 0) {
        setError('Please enter a valid amount paid now (enter 0 if entirely unpaid).');
        return;
      }
      if (numAmount > visitTotal) {
        setError(`Amount paid (₹${numAmount.toFixed(2)}) cannot exceed visit total (₹${visitTotal.toFixed(2)}).`);
        return;
      }
    }

    try {
      setLoading(true);
      const todayDateStr = new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      await api.post(`/visits/${visitId}/close`, {
        paymentAmount: numAmount,
        paymentMethod: numAmount > 0 ? paymentMethod : undefined,
        notes: remainingUdhar > 0
          ? `Partial payment (₹${numAmount.toFixed(2)}); remaining ₹${remainingUdhar.toFixed(2)} recorded to Udhar on ${todayDateStr}`
          : 'Full payment'
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to complete payment and close visit.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 font-display">
              Settle &amp; Close Visit
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {customerName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode Switcher Segmented Control */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => handleModeChange('full')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'full'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Full Payment (₹{visitTotal.toFixed(2)})
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('partial')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'partial'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Partial / Custom
            </button>
          </div>

          {/* Full Payment View */}
          {mode === 'full' ? (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono block">
                  Total Bill Due
                </span>
                <span className="text-xs text-emerald-700 font-semibold mt-0.5 block">
                  Zero balance remaining
                </span>
              </div>
              <span className="text-2xl font-black font-mono text-slate-900">
                ₹{visitTotal.toFixed(2)}
              </span>
            </div>
          ) : (
            /* Partial Payment View */
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Amount Paying Now
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 font-mono">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max={visitTotal}
                    autoFocus
                    placeholder="0.00"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white font-mono font-bold text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                  />
                </div>
              </div>

              {/* Clean Ledger Breakdown */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-600">
                  <span>Visit Total:</span>
                  <span className="font-bold text-slate-900">₹{visitTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Paying Today:</span>
                  <span className="font-bold text-slate-900">₹{numAmount.toFixed(2)}</span>
                </div>
                {remainingUdhar > 0 ? (
                  <div className="flex justify-between text-rose-700 font-bold pt-1.5 border-t border-slate-200">
                    <span>Added to Udhar:</span>
                    <span>+₹{remainingUdhar.toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-emerald-700 font-semibold pt-1.5 border-t border-slate-200">
                    <span>Remaining Balance:</span>
                    <span>₹0.00 (Fully Settled)</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment Method Selector (Only when paying > 0) */}
          {numAmount > 0 && (
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                Payment Channel
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Cash')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    paymentMethod === 'Cash'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('UPI')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    paymentMethod === 'UPI'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>UPI / Online</span>
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 active:scale-95 shadow-2xs transition-all flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <span>Processing...</span>
              ) : mode === 'full' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Confirm Full Payment (₹{visitTotal.toFixed(2)})</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    {numAmount > 0
                      ? `Pay ₹${numAmount.toFixed(2)} & Close Visit`
                      : `Add ₹${visitTotal.toFixed(2)} to Udhar & Close`}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
