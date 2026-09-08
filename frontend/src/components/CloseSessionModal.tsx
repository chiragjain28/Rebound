'use client';

import React, { useState, useEffect } from 'react';
import { Session } from '../types';
import { api } from '../lib/api';
import { X, CheckSquare, AlertTriangle } from 'lucide-react';

const GAME_RATES: Record<string, number> = {
  'Pool': 160,
  'MidSnooker': 220,
  'PS4': 80,
  'None': 0,
};

const GAME_LABELS: Record<string, string> = {
  'Pool': 'Pool',
  'MidSnooker': 'Mid Snooker',
  'PS4': 'PS4',
  'None': 'No Game',
};

interface CloseSessionModalProps {
  session: Session;
  onClose: () => void;
  onSuccess: (session: any) => void;
}

export const CloseSessionModal: React.FC<CloseSessionModalProps> = ({
  session,
  onClose,
  onSuccess,
}) => {
  const [customAmount, setCustomAmount] = useState('0');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [userEditedAmount, setUserEditedAmount] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewGameCost, setPreviewGameCost] = useState(0);
  const [elapsedStr, setElapsedStr] = useState('');

  const completedCost = session.tablePlays?.filter((tp) => tp.endTime).reduce((s, tp) => s + tp.cost, 0) || 0;
  const activePlay = session.tablePlays?.find((tp) => !tp.endTime);
  const priorUdharTotal = session.priorUdhar || 0;

  useEffect(() => {
    const calculate = () => {
      // 1. Session Duration
      const start = new Date(session.startTime).getTime();
      const now = new Date().getTime();
      const elapsedMs = now - start;
      const h = Math.floor(elapsedMs / 3600000);
      const m = Math.floor((elapsedMs % 3600000) / 60000);
      setElapsedStr(h > 0 ? `${h}h ${m}m` : `${m}m`);

      // 2. Active Play live cost
      let activeCost = 0;
      if (activePlay) {
        const playStart = new Date(activePlay.startTime).getTime();
        const playElapsedMs = now - playStart;
        const playElapsedHours = playElapsedMs / 3600000;
        const rate = GAME_RATES[activePlay.gameType] || 0;
        if (activePlay.gameType === 'PS4') {
          activeCost = rate * activePlay.playerCount * playElapsedHours;
        } else {
          activeCost = rate * playElapsedHours;
        }
      }

      setPreviewGameCost(completedCost + Math.round(activeCost));
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [session, completedCost, activePlay]);

  const menuCost = session.orders?.reduce((sum, o) => sum + o.quantity * o.price, 0) || 0;
  const parsedCustom = parseFloat(customAmount) || 0;
  const currentSessionTotal = Math.max(0, menuCost + previewGameCost + parsedCustom);
  const totalBill = currentSessionTotal + priorUdharTotal;

  const advancePaid = session.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const netDueAfterAdvance = totalBill - advancePaid;
  const refundAmount = Math.max(0, advancePaid - totalBill);

  // Sync amountPaid with remaining net due unless edited by user
  useEffect(() => {
    if (!userEditedAmount) {
      const defaultToCollect = Math.max(0, netDueAfterAdvance);
      setAmountPaid(defaultToCollect.toString());
    }
  }, [netDueAfterAdvance, userEditedAmount]);

  const parsedAmountPaid = parseFloat(amountPaid) >= 0 ? parseFloat(amountPaid) : Math.max(0, netDueAfterAdvance);
  const totalSettlingPayment = advancePaid + parsedAmountPaid;
  const remainingUdhar = Math.max(0, totalBill - totalSettlingPayment);

  const priorUdharsToSettle = priorUdharTotal > 0 && totalSettlingPayment >= priorUdharTotal;
  const todayUnpaid = Math.max(0, currentSessionTotal - (priorUdharsToSettle ? (totalSettlingPayment - priorUdharTotal) : totalSettlingPayment));
  const remainingOldUdhar = priorUdharsToSettle ? 0 : priorUdharTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post(`/sessions/${session.id}/close`, {
        customAmount: parsedCustom,
        amountPaid: parsedAmountPaid,
        paymentMethod
      });
      onSuccess(data);
    } catch (err: any) {
      setError(err.message || 'Failed to close session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-[#111827] rounded-3xl border border-slate-800 w-full max-w-md shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden p-6 space-y-5">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-extrabold text-white font-display uppercase tracking-wide">Close Session & Bill</h2>
            <p className="text-xs text-cyan-400 font-semibold mt-0.5">{session.customerName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-950/60 text-rose-300 text-xs font-bold p-3 rounded-xl border border-rose-500/40">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Custom Adjustment */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-300 uppercase tracking-widest mb-1 font-mono">
              Custom Adjustment (₹)
            </label>
            <input
              type="number"
              step="0.01"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="block w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-mono font-semibold"
            />
            <p className="text-[10px] text-slate-500 mt-1 font-mono">
              Positive (+) = extra charge &nbsp;·&nbsp; Negative (−) = discount
            </p>
          </div>

          {/* Payment Section */}
          <div className="border-t border-slate-800 pt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-300 uppercase tracking-widest mb-1 font-mono">
                Additional Payment (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={amountPaid}
                onChange={(e) => {
                  setAmountPaid(e.target.value);
                  setUserEditedAmount(true);
                }}
                className="block w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-mono font-extrabold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-300 uppercase tracking-widest mb-1 font-mono">
                Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="block w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-semibold"
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
              </select>
            </div>
          </div>

          {/* Bill Preview */}
          <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Café Orders Total:</span>
              <span className="font-mono font-semibold text-slate-200">₹{menuCost.toFixed(2)}</span>
            </div>
            
            {(completedCost > 0 || activePlay) && (
              <div className="flex justify-between text-slate-400">
                <span>
                  Table Play Cost
                  {activePlay ? ' (inc. live play)' : ''}:
                </span>
                <span className="font-mono font-semibold text-slate-200">₹{previewGameCost}</span>
              </div>
            )}

            {parsedCustom !== 0 && (
              <div className={`flex justify-between font-semibold ${parsedCustom < 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                <span>{parsedCustom < 0 ? 'Discount:' : 'Extra Charge:'}</span>
                <span className="font-mono">
                  {parsedCustom < 0 ? '−' : '+'}₹{Math.abs(parsedCustom).toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-slate-200 font-bold">
              <span>This Session Total:</span>
              <span className="font-mono">₹{currentSessionTotal.toFixed(2)}</span>
            </div>

            {priorUdharTotal > 0 && (
              <div className="flex justify-between text-rose-400 font-bold">
                <span>Prior Unpaid Udhar:</span>
                <span className="font-mono">+₹{priorUdharTotal.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-extrabold text-white border-t border-slate-800 pt-1.5">
              <span>Grand Total Payable:</span>
              <span className="font-mono text-cyan-400 glow-text-cyan">₹{totalBill.toFixed(2)}</span>
            </div>

            {advancePaid > 0 && (
              <div className="flex justify-between text-xs font-bold text-emerald-400 border-t border-slate-800/80 pt-1.5">
                <span>Advance Payments Received:</span>
                <span className="font-mono">−₹{advancePaid.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Refund / Change Return Banner */}
          {refundAmount > 0 && (
            <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs p-3.5 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <div className="flex items-center justify-between">
                <span className="font-extrabold uppercase tracking-wider text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                  <span>💰</span> Return Change to Customer:
                </span>
                <span className="text-base font-extrabold font-mono text-emerald-300 glow-text-emerald">
                  ₹{refundAmount.toFixed(2)}
                </span>
              </div>
              <p className="text-[10px] text-emerald-400/80 mt-1 font-mono">
                Advance received (₹{advancePaid.toFixed(2)}) exceeds final bill (₹{totalBill.toFixed(2)}). Hand ₹{refundAmount.toFixed(2)} cash back to customer.
              </p>
            </div>
          )}

          {/* Auto Udhar Warning */}
          {remainingUdhar > 0 && (
            <div className="bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs p-3 rounded-xl flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold uppercase tracking-wider text-[10px] font-mono">Udhar Alert</p>
                {todayUnpaid > 0 && (
                  <p className="mt-0.5">
                    ₹{todayUnpaid.toFixed(2)} will be logged as today's unpaid outstanding.
                  </p>
                )}
                {remainingOldUdhar > 0 && (
                  <p className="mt-0.5">
                    ₹{remainingOldUdhar.toFixed(2)} will remain as old outstanding in the ledger.
                  </p>
                )}
                <p className="mt-1 font-bold text-white font-mono">
                  Total customer outstanding will be: ₹{remainingUdhar.toFixed(2)}
                </p>
              </div>
            </div>
          )}

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
              className="inline-flex justify-center items-center px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-xs font-extrabold uppercase tracking-wider rounded-xl text-white shadow-[0_0_15px_rgba(244,63,94,0.3)] disabled:opacity-50 transition-all custom-button"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4 mr-1.5" />
                  Close & Process Bill
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
