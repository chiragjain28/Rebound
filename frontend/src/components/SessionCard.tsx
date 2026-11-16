'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Session } from '../types';
import { PlayCircle, Clock, Eye, Gamepad2, Coffee, CheckCircle2, User, Phone, AlertCircle, Sparkles, Plus } from 'lucide-react';
import { AddOrderModal } from './AddOrderModal';

interface SessionCardProps {
  session: Session;
  onOrderAdded?: () => void;
  onAddItemsClick?: (sessionId: string) => void;
}

const GAME_LABELS: Record<string, string> = {
  'Pool': 'Pool',
  'MidSnooker': 'Mid Snooker',
  'PS4': 'PS4',
  'None': 'No Game',
};

const GAME_RATES: Record<string, number> = {
  'Pool': 160,
  'MidSnooker': 220,
  'PS4': 80,
  'None': 0,
};

export const SessionCard: React.FC<SessionCardProps> = ({ session, onOrderAdded, onAddItemsClick }) => {
  const [sessionElapsed, setSessionElapsed] = useState('');
  const [activePlayElapsed, setActivePlayElapsed] = useState('');
  const [liveGameCost, setLiveGameCost] = useState(0);
  const [showAddOrder, setShowAddOrder] = useState(false);

  // Find active table play (if any)
  const activePlay = session.tablePlays?.find((tp) => !tp.endTime);
  const isTableActive = !!activePlay;

  useEffect(() => {
    const tick = () => {
      // 1. Calculate overall session duration
      const sessionStart = new Date(session.startTime).getTime();
      const sessionEnd = session.endTime ? new Date(session.endTime).getTime() : Date.now();
      const sessionDiff = Math.max(0, sessionEnd - sessionStart);
      const sh = Math.floor(sessionDiff / 3600000);
      const sm = Math.floor((sessionDiff % 3600000) / 60000);
      const ss = Math.floor((sessionDiff % 60000) / 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      setSessionElapsed(`${pad(sh)}:${pad(sm)}:${pad(ss)}`);

      // 2. Calculate active table play duration & live cost
      if (activePlay) {
        const playStart = new Date(activePlay.startTime).getTime();
        const playDiff = Math.max(0, Date.now() - playStart);
        const ph = Math.floor(playDiff / 3600000);
        const pm = Math.floor((playDiff % 3600000) / 60000);
        const ps = Math.floor((playDiff % 60000) / 1000);
        setActivePlayElapsed(`${pad(ph)}:${pad(pm)}:${pad(ps)}`);

        // Calculate live active play cost
        const rate = GAME_RATES[activePlay.gameType] || 0;
        const hours = playDiff / 3600000;
        const cost = activePlay.gameType === 'PS4'
          ? rate * activePlay.playerCount * hours
          : rate * hours;
        setLiveGameCost(Math.round(cost));
      } else {
        setActivePlayElapsed('');
        setLiveGameCost(0);
      }
    };

    tick();
    if (session.endTime) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session, activePlay]);

  // Calculate billing totals
  const ordersTotal = session.orders?.reduce((sum, o) => sum + o.quantity * o.price, 0) || 0;
  const completedPlaysTotal = session.tablePlays?.filter((tp) => tp.endTime).reduce((sum, tp) => sum + tp.cost, 0) || 0;
  const grossBill = ordersTotal + completedPlaysTotal + (session.customAmount || 0) + (session.priorUdhar || 0);
  const paymentsTotal = session.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const netDue = Math.max(0, grossBill - paymentsTotal);
  const advanceCredit = Math.max(0, paymentsTotal - grossBill);
  const remainingPriorUdhar = Math.min(session.priorUdhar || 0, netDue);

  const ordersCount = session.orders?.reduce((sum, o) => sum + o.quantity, 0) || 0;
  const isInClub = session.status === 'active';

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between h-full space-y-4">
      
      {/* Top Header */}
      <div className="space-y-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Live Status Badge */}
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wider ${
              isInClub ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              <span className={`w-2 h-2 rounded-full mr-1.5 ${isInClub ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {isInClub ? 'IN LOUNGE' : 'CLOSED'}
            </span>

            {/* Table Badge */}
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
              isTableActive ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              {isTableActive
                ? `${GAME_LABELS[activePlay.gameType] || activePlay.gameType}`
                : 'No Active Table'
              }
            </span>
          </div>

          <div className="flex items-center text-xs font-mono font-bold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            <Clock className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
            <span>{sessionElapsed}</span>
          </div>
        </div>

        {/* Customer Name & Phone */}
        <div className="flex flex-col">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 font-display tracking-tight">
            <User className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="truncate">{session.customerName}</span>
          </h3>
          {session.customerPhone && (
            <p className="text-xs font-mono font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5 ml-6">
              <Phone className="h-3 w-3 text-slate-400 shrink-0" />
              <span>{session.customerPhone}</span>
            </p>
          )}
        </div>

        {/* Prior Outstanding Credit Alert */}
        {remainingPriorUdhar > 0 ? (
          <div className="text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>Prior Credit: ₹{remainingPriorUdhar}</span>
          </div>
        ) : null}

        {/* Active Game Table Box */}
        {activePlay && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center text-xs text-slate-700">
            <div>
              <p className="font-extrabold flex items-center gap-1.5 text-slate-900">
                <Gamepad2 className="h-4 w-4 text-slate-500" />
                {GAME_LABELS[activePlay.gameType] || activePlay.gameType}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono font-extrabold text-slate-900 text-sm">{activePlayElapsed}</p>
            </div>
          </div>
        )}
      </div>

      {/* Middle Billing Bar */}
      <div className="pt-3 flex justify-between items-end border-t border-slate-100">
        <div className="space-y-0.5">
          {advanceCredit > 0 ? (
            <>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider font-mono">
                Advance Balance
              </span>
              <div className="text-2xl font-black text-emerald-700 tracking-tight font-display">
                ₹{advanceCredit.toFixed(2)}
              </div>
              <p className="text-[10px] text-slate-500 font-mono">
                Bill ₹{grossBill.toFixed(0)} · Adv ₹{paymentsTotal.toFixed(0)}
              </p>
            </>
          ) : paymentsTotal > 0 ? (
            <>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                Payable Due
              </span>
              <div className="text-2xl font-black text-slate-900 tracking-tight font-display">
                ₹{netDue.toFixed(2)}
              </div>
              <p className="text-[10px] text-emerald-700 font-mono">
                Paid: ₹{paymentsTotal.toFixed(0)} of ₹{grossBill.toFixed(0)}
              </p>
            </>
          ) : (
            <>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                Current Bill
              </span>
              <div className="text-2xl font-black text-slate-900 tracking-tight font-display">
                ₹{grossBill.toFixed(2)}
              </div>
            </>
          )}
        </div>

        <div className="text-right text-xs text-slate-500 font-medium space-y-1">
          <p className="flex items-center gap-1 justify-end font-semibold text-slate-700">
            <Coffee className="h-3.5 w-3.5 text-slate-400" />
            <span>{ordersCount} items ordered</span>
          </p>
          <p className="text-[10px] text-slate-400 font-mono">Staff: {session.staffUsername}</p>
        </div>
      </div>

      {/* Action Buttons: View Live Session + Quick Add Items Plus Button */}
      <div className="pt-1 flex items-center gap-2">
        <Link
          href={`/sessions/${session.id}`}
          className={`inline-flex justify-center items-center px-3 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all duration-200 custom-button shadow-xs truncate ${
            isInClub ? 'flex-[3]' : 'w-full'
          }`}
        >
          <Eye className="h-4 w-4 mr-2 shrink-0" />
          <span className="truncate">View Live Session</span>
        </Link>

        {isInClub && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onAddItemsClick) {
                onAddItemsClick(session.id);
              } else {
                setShowAddOrder(true);
              }
            }}
            title="Add Items / Place Order"
            className="flex-1 inline-flex justify-center items-center py-2.5 px-3 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 shadow-xs transition-all duration-200 custom-button cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Add Items Popup Modal */}
      {showAddOrder && (
        <AddOrderModal
          sessionId={session.id}
          onClose={() => setShowAddOrder(false)}
          onSuccess={() => {
            setShowAddOrder(false);
            if (onOrderAdded) {
              onOrderAdded();
            }
          }}
        />
      )}
    </div>
  );
};
