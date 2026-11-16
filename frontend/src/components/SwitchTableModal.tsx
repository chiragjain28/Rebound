'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Table, Session } from '../types';
import { X, ArrowRightLeft, Check, AlertCircle, Loader2 } from 'lucide-react';

interface SwitchTableModalProps {
  session: Session;
  onClose: () => void;
  onSuccess: () => void;
}

export const SwitchTableModal: React.FC<SwitchTableModalProps> = ({ session, onClose, onSuccess }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTables = async () => {
      try {
        setLoading(true);
        const data = await api.get('/dashboard/tables');
        setTables(data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load tables');
      } finally {
        setLoading(false);
      }
    };
    fetchTables();
  }, []);

  const currentTableId = session.tableId;
  const availableTables = tables.filter(t => t.id !== currentTableId && t.status === 'available');

  const handleSwitch = async () => {
    if (!selectedTableId) {
      setError('Please choose a target table');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await api.post(`/sessions/${session.id}/switch-table`, {
        toTableId: selectedTableId
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to switch table');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-display">Switch / Transfer Table</h3>
              <p className="text-xs text-slate-500">Seamless player transfer for {session.customerName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          
          {/* Current Table Notice */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Currently playing on:</span>
            <span className="font-bold text-slate-800">
              {session.table ? (session.table.name || `${session.table.gameType} Table ${session.table.number}`) : (session.gameType || 'Table')}
            </span>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Select Available Tables */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">Select Target Available Table:</label>
            
            {loading ? (
              <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading tables...
              </div>
            ) : availableTables.length === 0 ? (
              <div className="py-6 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
                No other available tables at this moment.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                {availableTables.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTableId(t.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedTableId === t.id
                        ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-400/30 text-blue-900'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.gameType}</span>
                      {selectedTableId === t.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                    <p className="font-bold text-sm mt-0.5">{t.name || (t.gameType === 'PS4' ? `Station ${t.number}` : `Table ${t.number}`)}</p>
                    <p className="text-[11px] text-slate-500 mt-1">₹{t.ratePerHour}/hr</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            ℹ️ <span className="font-semibold text-slate-700">Financial Note:</span> Time spent on the current table will be billed at its rate and sealed in the session ledger. The target table will start from 00:00 immediately.
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSwitch}
              disabled={submitting || !selectedTableId}
              className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
              Confirm Transfer
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
