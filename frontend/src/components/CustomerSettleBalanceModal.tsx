'use client';

import React, { useState } from 'react';
import { api } from '../lib/api';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Banknote, 
  QrCode, 
  CreditCard, 
  ArrowRight, 
  Loader2 
} from 'lucide-react';

interface CustomerSettleBalanceModalProps {
  customer: {
    id: number | string;
    name: string;
    phone: string;
    currentUdharDue: number;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export const CustomerSettleBalanceModal: React.FC<CustomerSettleBalanceModalProps> = ({
  customer,
  onClose,
  onSuccess,
}) => {
  const totalDue = Math.max(0, customer.currentUdharDue);
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [amountInput, setAmountInput] = useState<string>(
    Number.isInteger(totalDue) ? totalDue.toString() : totalDue.toFixed(2)
  );
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI'>('Cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const parsedAmount = mode === 'full' ? totalDue : parseFloat(amountInput || '0');
  const validAmount = !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const remainingDue = Math.max(0, Math.round((totalDue - validAmount) * 100) / 100);

  const handleModeChange = (newMode: 'full' | 'partial') => {
    setMode(newMode);
    setError('');
    if (newMode === 'full') {
      setAmountInput(Number.isInteger(totalDue) ? totalDue.toString() : totalDue.toFixed(2));
    } else {
      setAmountInput('');
    }
  };

  const handleAmountChange = (val: string) => {
    setAmountInput(val);
    setError('');
    const num = parseFloat(val);
    if (!isNaN(num) && num > totalDue) {
      setError(`Amount cannot exceed the total outstanding balance of ₹${totalDue.toFixed(2)}.`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const settleAmount = mode === 'full' ? totalDue : parseFloat(amountInput);

    if (isNaN(settleAmount) || settleAmount <= 0) {
      setError('Please enter a valid amount to settle.');
      return;
    }

    if (settleAmount > totalDue + 0.01) {
      setError(`Payment amount (₹${settleAmount.toFixed(2)}) cannot exceed total balance (₹${totalDue.toFixed(2)}).`);
      return;
    }

    try {
      setLoading(true);
      await api.post('/payments', {
        customerId: customer.id,
        amount: Math.min(settleAmount, totalDue),
        method: paymentMethod,
        type: 'credit_settlement'
      });

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to record credit settlement.');
    } finally {
      setLoading(false);
    }
  };

  // Preset chips for quick fill in partial mode
  const quickPresets = [500, 1000, 2000].filter(val => val < totalDue);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center border border-emerald-200 shadow-2xs">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 font-display">
                Settle Outstanding Balance
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Customer: <strong className="text-slate-800">{customer.name}</strong> • {customer.phone}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Outstanding Balance Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                Total Outstanding Udhar
              </span>
              <span className="text-2xl font-black text-rose-700 font-display mt-0.5 block">
                ₹{totalDue.toFixed(2)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-500 font-medium block">
                FIFO Settlement
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">
                Oldest visits cleared first
              </span>
            </div>
          </div>

          {/* Mode Selector: Full vs Partial */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block font-mono mb-1.5">
              Settlement Option
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => handleModeChange('full')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === 'full'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode === 'full' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                <span>Full Settlement</span>
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('partial')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === 'partial'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode === 'partial' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                <span>Partial Payment</span>
              </button>
            </div>
          </div>

          {/* Partial Amount Input */}
          {mode === 'partial' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  Amount Paying Now (₹)
                </label>
                {quickPresets.length > 0 && (
                  <div className="flex items-center gap-1">
                    {quickPresets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleAmountChange(preset.toString())}
                        className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold font-mono transition-colors cursor-pointer"
                      >
                        ₹{preset}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleAmountChange(Number.isInteger(totalDue) ? totalDue.toString() : totalDue.toFixed(2))}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold font-mono transition-colors cursor-pointer"
                    >
                      Max
                    </button>
                  </div>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  step="any"
                  min="1"
                  max={totalDue}
                  value={amountInput}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="e.g. 2000"
                  autoFocus
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 font-bold text-base font-mono outline-hidden"
                />
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-xs text-emerald-900 flex items-center justify-between">
              <span className="font-medium">Clearing 100% of outstanding balance:</span>
              <strong className="font-mono text-sm font-black text-emerald-800">
                ₹{totalDue.toFixed(2)}
              </strong>
            </div>
          )}

          {/* Dynamic Ledger Breakdown */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Total Outstanding:</span>
              <span className="font-mono font-bold text-slate-800">₹{totalDue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Paying Now:</span>
              <span className="font-mono font-bold">- ₹{validAmount.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold">
              <span className="text-slate-800">Remaining Balance:</span>
              <span
                className={`font-mono text-sm font-black ${
                  remainingDue > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                ₹{remainingDue.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block font-mono mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('Cash')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  paymentMethod === 'Cash'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Cash</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('UPI')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  paymentMethod === 'UPI'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>UPI / QR</span>
              </button>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || validAmount <= 0 || (mode === 'partial' && (!amountInput || parsedAmount > totalDue))}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <span>
                    {mode === 'full'
                      ? `Confirm Settle All (₹${totalDue.toFixed(2)})`
                      : validAmount > 0
                      ? `Confirm Settlement (₹${validAmount.toFixed(2)})`
                      : 'Enter Amount to Settle'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
