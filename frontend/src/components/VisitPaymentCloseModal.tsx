'use client';

import React, { useState } from 'react';
import { api } from '../lib/api';
import { X, CheckCircle2, AlertCircle, Banknote, QrCode } from 'lucide-react';

interface VisitPaymentCloseModalProps {
  visitId: string;
  customerName: string;
  customerId: string | number;
  customerPhone?: string;
  visitTotal: number;
  previousCreditDue?: number;
  initialMode?: 'all' | 'visit' | 'full' | 'partial';
  onClose: () => void;
  onSuccess: () => void;
  onOpenRegisterWalkin?: () => void;
}

export const VisitPaymentCloseModal: React.FC<VisitPaymentCloseModalProps> = ({
  visitId,
  customerName,
  customerId,
  customerPhone,
  visitTotal,
  previousCreditDue = 0,
  initialMode = 'visit',
  onClose,
  onSuccess,
  onOpenRegisterWalkin,
}) => {
  const creditDue = Math.max(0, previousCreditDue || 0);
  const hasCredit = creditDue > 0;
  const grandTotal = Math.round((visitTotal + creditDue) * 100) / 100;

  // Normalized mode
  const normalizedInitialMode = () => {
    if (initialMode === 'all' && hasCredit) return 'all';
    if (initialMode === 'partial') return 'partial';
    return 'visit';
  };

  const [mode, setMode] = useState<'all' | 'visit' | 'partial'>(normalizedInitialMode());
  const [amountInput, setAmountInput] = useState<string>(
    mode === 'all'
      ? grandTotal.toFixed(2)
      : mode === 'visit'
      ? visitTotal.toFixed(2)
      : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI'>('Cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isWalkIn = Boolean(customerPhone && (customerPhone.startsWith('WALK-') || customerPhone.replace(/\D/g, '').length < 10));

  const numAmount = mode === 'all'
    ? grandTotal
    : mode === 'visit'
    ? visitTotal
    : Math.max(0, parseFloat(amountInput || '0'));

  // Allocation breakdown
  const payForVisit = Math.min(numAmount, visitTotal);
  const remainingVisitBalance = Math.max(0, Math.round((visitTotal - payForVisit) * 100) / 100);
  const payForCredit = Math.max(0, Math.round((numAmount - payForVisit) * 100) / 100);
  const remainingCreditDue = Math.max(0, Math.round((creditDue - payForCredit) * 100) / 100);
  const totalRemainingDebt = Math.round((remainingVisitBalance + remainingCreditDue) * 100) / 100;

  const handleModeChange = (newMode: 'all' | 'visit' | 'partial') => {
    setMode(newMode);
    setError('');
    if (newMode === 'all') {
      setAmountInput(grandTotal.toFixed(2));
    } else if (newMode === 'visit') {
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
        setError('Please enter a valid amount paid now (or 0 if charged to account).');
        return;
      }
      if (numAmount > grandTotal) {
        setError(`Amount paid (₹${numAmount.toFixed(2)}) cannot exceed total balance (₹${grandTotal.toFixed(2)}).`);
        return;
      }
      if (isWalkIn && remainingVisitBalance > 0) {
        setError(`Credit (Udhar) cannot be extended to an unregistered walk-in customer. Settle in full via Cash or UPI, or click "Register Customer" to add their mobile number.`);
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

      let notes = 'Full payment';
      if (numAmount >= grandTotal && hasCredit) {
        notes = `Full settlement of Visit #${visitId} (₹${visitTotal.toFixed(2)}) and previous udhar (₹${creditDue.toFixed(2)})`;
      } else if (numAmount > visitTotal) {
        notes = `Visit #${visitId} paid in full (₹${visitTotal.toFixed(2)}); ₹${payForCredit.toFixed(2)} applied to past credit`;
      } else if (remainingVisitBalance > 0) {
        notes = `Partial payment (₹${numAmount.toFixed(2)}); remaining ₹${remainingVisitBalance.toFixed(2)} charged to credit account on ${todayDateStr}`;
      }

      await api.post(`/visits/${visitId}/close`, {
        paymentAmount: numAmount,
        paymentMethod: numAmount > 0 ? paymentMethod : undefined,
        notes
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
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            {hasCredit && (
              <button
                type="button"
                onClick={() => handleModeChange('all')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Clear All (₹{grandTotal.toFixed(2)})
              </button>
            )}

            <button
              type="button"
              onClick={() => handleModeChange('visit')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'visit'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {hasCredit ? `Visit Only (₹${visitTotal.toFixed(2)})` : `Full (₹${visitTotal.toFixed(2)})`}
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
              Custom
            </button>
          </div>

          {/* Mode 1: Clear All (Visit + Past Udhar) */}
          {mode === 'all' && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-600 font-mono">
                <span>This Visit Bill:</span>
                <span className="font-bold text-slate-900">₹{visitTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-600 font-mono">
                <span>Previous Udhar (Credit):</span>
                <span className="font-bold text-amber-700">₹{creditDue.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                  Total Collectible
                </span>
                <span className="text-xl font-black font-mono text-slate-900">
                  ₹{grandTotal.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 font-medium pt-1">
                ✓ Settle visit bill and wipe out entire previous balance on account.
              </p>
            </div>
          )}

          {/* Mode 2: Visit Only */}
          {mode === 'visit' && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                  Visit Bill Due
                </span>
                <span className="text-2xl font-black font-mono text-slate-900">
                  ₹{visitTotal.toFixed(2)}
                </span>
              </div>
              {hasCredit && (
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 font-mono">
                  <span>Previous Udhar Remaining:</span>
                  <span className="font-bold text-amber-700">₹{creditDue.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Mode 3: Custom / Partial */}
          {mode === 'partial' && (
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
                    max={grandTotal}
                    autoFocus
                    placeholder="0.00"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white font-mono font-bold text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                  />
                </div>
              </div>

              {/* Quick Fill Preset Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 font-medium">Quick fill:</span>
                <button
                  type="button"
                  onClick={() => setAmountInput(visitTotal.toFixed(2))}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-mono font-bold transition-colors cursor-pointer"
                >
                  Visit: ₹{visitTotal.toFixed(2)}
                </button>
                {hasCredit && (
                  <button
                    type="button"
                    onClick={() => setAmountInput(grandTotal.toFixed(2))}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-mono font-bold transition-colors cursor-pointer"
                  >
                    All: ₹{grandTotal.toFixed(2)}
                  </button>
                )}
              </div>

              {/* Ledger Breakdown */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-600">
                  <span>This Visit Bill:</span>
                  <span className="font-bold text-slate-900">₹{visitTotal.toFixed(2)}</span>
                </div>
                {hasCredit && (
                  <div className="flex justify-between text-slate-600">
                    <span>Previous Udhar:</span>
                    <span className="font-bold text-amber-700">₹{creditDue.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Paying Today:</span>
                  <span className="font-bold text-slate-900">₹{numAmount.toFixed(2)}</span>
                </div>
                
                <div className="pt-1.5 border-t border-slate-200">
                  {totalRemainingDebt === 0 ? (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Total Remaining Debt:</span>
                      <span>₹0.00 (Fully Settled)</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-rose-700 font-bold">
                      <span>Total Remaining Debt:</span>
                      <span>₹{totalRemainingDebt.toFixed(2)}</span>
                    </div>
                  )}
                  {totalRemainingDebt > 0 && (
                    <div className="text-[10px] text-slate-500 pt-0.5 flex justify-between">
                      <span>Breakdown:</span>
                      <span>
                        {remainingVisitBalance > 0 ? `₹${remainingVisitBalance.toFixed(2)} visit` : 'Visit paid'}
                        {remainingCreditDue > 0 ? ` • ₹${remainingCreditDue.toFixed(2)} past udhar` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Walk-in credit restriction note */}
              {isWalkIn && remainingVisitBalance > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>Walk-ins cannot carry balance.</span>
                  {onOpenRegisterWalkin && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenRegisterWalkin();
                      }}
                      className="font-bold text-slate-900 hover:underline cursor-pointer"
                    >
                      Add Phone →
                    </button>
                  )}
                </div>
              )}
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
              disabled={loading || (isWalkIn && remainingVisitBalance > 0)}
              title={isWalkIn && remainingVisitBalance > 0 ? 'Credit is locked for unregistered walk-in customers' : ''}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-2xs transition-all flex items-center gap-2 ${
                isWalkIn && remainingVisitBalance > 0
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-900 hover:bg-slate-800 active:scale-95 cursor-pointer'
              }`}
            >
              {loading ? (
                <span>Processing...</span>
              ) : mode === 'all' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Confirm Total Settle (₹{grandTotal.toFixed(2)})</span>
                </>
              ) : mode === 'visit' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Confirm Visit Payment (₹{visitTotal.toFixed(2)})</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    {numAmount > 0
                      ? `Pay ₹${numAmount.toFixed(2)} & Close`
                      : `Charge ₹${visitTotal.toFixed(2)} to Account & Close`}
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
