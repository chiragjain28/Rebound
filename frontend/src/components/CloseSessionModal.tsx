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
  const remainingOldUdhar = Math.max(0, priorUdharTotal - totalSettlingPayment);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post(`/sessions/${session.id}/close`, {
        customAmount: parsedCustom,
        amountPaid: parsedAmountPaid,
        paymentMethod
      });
      onSuccess(res);
    } catch (err: any) {
      setError(err.message || 'Failed to close session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-4">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 font-display">Close Session & Settle Bill</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{session.customerName} • {elapsedStr} in lounge</p>
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
          
          {/* Custom Adjustment */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Custom Adjustment / Discount (₹)
            </label>
            <input
              type="number"
              step="0.01"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs font-mono font-bold"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Positive (+) = extra charge &nbsp;·&nbsp; Negative (−) = discount
            </p>
          </div>

          {/* Payment Section */}
          <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Amount to Collect (₹)
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
                className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs font-mono font-extrabold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs font-semibold"
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
              </select>
            </div>
          </div>

          {/* Bill Preview Card */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Café Orders Total:</span>
              <span className="font-mono font-bold text-slate-800">₹{menuCost.toFixed(2)}</span>
            </div>
            
            {(completedCost > 0 || activePlay) && (
              <div className="flex justify-between text-slate-600">
                <span>Table Play Total{activePlay ? ' (inc. live)' : ''}:</span>
                <span className="font-mono font-bold text-slate-800">₹{previewGameCost}</span>
              </div>
            )}

            {parsedCustom !== 0 && (
              <div className={`flex justify-between font-bold ${parsedCustom < 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                <span>{parsedCustom < 0 ? 'Discount Applied:' : 'Extra Charge Added:'}</span>
                <span className="font-mono">
                  {parsedCustom < 0 ? '−' : '+'}₹{Math.abs(parsedCustom).toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-slate-900 font-bold pt-1 border-t border-slate-200">
              <span>This Session Total:</span>
              <span className="font-mono">₹{currentSessionTotal.toFixed(2)}</span>
            </div>

            {priorUdharTotal > 0 && (
              <div className="flex justify-between text-rose-700 font-bold">
                <span>Prior Outstanding Credit:</span>
                <span className="font-mono">+₹{priorUdharTotal.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-1.5">
              <span>Grand Total Payable:</span>
              <span className="font-mono">₹{totalBill.toFixed(2)}</span>
            </div>

            {advancePaid > 0 && (
              <div className="flex justify-between text-xs font-bold text-emerald-700 border-t border-slate-200 pt-1">
                <span>Advance Payments Received:</span>
                <span className="font-mono">−₹{advancePaid.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Refund / Change Return Banner */}
          {refundAmount > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1">
                  <span>💰</span> Return Change to Customer:
                </span>
                <span className="text-base font-extrabold font-mono text-emerald-800">
                  ₹{refundAmount.toFixed(2)}
                </span>
              </div>
              <p className="text-[10px] text-emerald-700 mt-1">
                Advance received (₹{advancePaid.toFixed(2)}) exceeds final bill (₹{totalBill.toFixed(2)}). Hand ₹{refundAmount.toFixed(2)} cash back.
              </p>
            </div>
          )}

          {/* Outstanding Balance Notice */}
          {remainingUdhar > 0 && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Outstanding Credit Notice</p>
                {todayUnpaid > 0 && (
                  <p className="mt-0.5">₹{todayUnpaid.toFixed(2)} will be logged as today&apos;s unpaid outstanding.</p>
                )}
                {remainingOldUdhar > 0 && (
                  <p className="mt-0.5">₹{remainingOldUdhar.toFixed(2)} remains as old outstanding.</p>
                )}
                <p className="mt-1 font-bold font-mono">
                  Total outstanding: ₹{remainingUdhar.toFixed(2)}
                </p>
              </div>
            </div>
          )}

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
              className="inline-flex justify-center items-center px-5 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-bold rounded-xl text-white shadow-sm disabled:opacity-50 transition-all"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4 mr-1.5" />
                  Close & Settle Bill
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
