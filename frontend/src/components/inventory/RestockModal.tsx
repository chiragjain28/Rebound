'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2, PackagePlus, IndianRupee, Sparkles, Check, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';

export interface InventoryItemSummary {
  id: number;
  name: string;
  category: string;
  subCategory?: string | null;
  currentStock: number;
  unit: string;
  piecesPerBox: number;
  costPrice?: number | null;
  sellingPrice?: number | null;
}

interface RestockRow {
  itemId: number;
  boxes: string;
  loose: string;
  costPerBox: string;
}

interface RestockModalProps {
  items: InventoryItemSummary[];
  preselectedItemId?: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const RestockModal: React.FC<RestockModalProps> = ({
  items,
  preselectedItemId,
  onClose,
  onSuccess,
}) => {
  const initialRow: RestockRow = {
    itemId: preselectedItemId || (items[0]?.id ?? 0),
    boxes: '1',
    loose: '0',
    costPerBox: '',
  };

  const [rows, setRows] = useState<RestockRow[]>([initialRow]);
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const itemsMap = new Map(items.map(i => [i.id, i]));

  const addRow = () => {
    setRows(prev => [
      ...prev,
      {
        itemId: items[0]?.id ?? 0,
        boxes: '1',
        loose: '0',
        costPerBox: '',
      },
    ]);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateRow = (index: number, field: keyof RestockRow, value: any) => {
    setRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Compute total added units and total cost for summary
  const totalCostEstimate = rows.reduce((acc, r) => {
    const boxesNum = parseFloat(r.boxes) || 0;
    const cost = parseFloat(r.costPerBox) || 0;
    return acc + (boxesNum * cost);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const formattedItems = rows
      .map(r => {
        const it = itemsMap.get(r.itemId);
        if (!it) return null;
        const boxes = parseFloat(r.boxes) || 0;
        const loose = parseInt(r.loose) || 0;
        const costPerBox = r.costPerBox ? parseFloat(r.costPerBox) : null;
        const totalUnits = (boxes * (it.piecesPerBox || 1)) + loose;
        if (totalUnits <= 0) return null;

        return {
          itemId: it.id,
          boxes,
          loosePieces: loose,
          costPerBox,
          totalCost: costPerBox ? boxes * costPerBox : null,
        };
      })
      .filter(Boolean);

    if (formattedItems.length === 0) {
      setError('Please add at least one item with valid quantity (boxes or loose pieces).');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/inventory/restock', {
        items: formattedItems,
        supplierName: supplierName.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit restock shipment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-display">
                Restock Shipment Entry
              </h2>
              <p className="text-xs text-slate-500">
                Add purchased boxes or loose pieces (automatic cigarette box calculation)
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Supplier & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Supplier / Wholesaler (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Metro Cash & Carry, Local Distributor"
                value={supplierName}
                onChange={e => setSupplierName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Shipment Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Weekly Club restock, bill invoice #442"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Restock Items List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Restock Items ({rows.length})
              </span>
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {rows.map((row, idx) => {
                const item = itemsMap.get(row.itemId);
                const piecesPerBox = item?.piecesPerBox || 1;
                const isCigarette = item?.category?.toLowerCase() === 'club';
                const boxesNum = parseFloat(row.boxes) || 0;
                const looseNum = parseInt(row.loose) || 0;
                const calculatedPieces = (boxesNum * piecesPerBox) + looseNum;

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition-colors flex flex-col md:flex-row md:items-center gap-3"
                  >
                    {/* Item Picker */}
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Select Item
                      </label>
                      <select
                        value={row.itemId}
                        onChange={e => updateRow(idx, 'itemId', parseInt(e.target.value))}
                        className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <optgroup label="🎱 Club Essentials & Cigarettes">
                          {items
                            .filter(i => i.category.toLowerCase() === 'club')
                            .map(i => (
                              <option key={i.id} value={i.id}>
                                {i.name} ({i.piecesPerBox > 1 ? `${i.piecesPerBox} pcs/box` : i.unit})
                              </option>
                            ))}
                        </optgroup>
                        <optgroup label="☕ Cafe Essentials & Drinks">
                          {items
                            .filter(i => i.category.toLowerCase() === 'cafe')
                            .map(i => (
                              <option key={i.id} value={i.id}>
                                {i.name} ({i.piecesPerBox > 1 ? `${i.piecesPerBox} pcs/box` : i.unit})
                              </option>
                            ))}
                        </optgroup>
                      </select>
                      {item && (
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                          <span>Current: <strong className="text-slate-800">{item.currentStock} {item.unit}</strong></span>
                          <span>•</span>
                          <span className="text-blue-600 font-semibold">
                            {piecesPerBox > 1 ? `Standard: ${piecesPerBox} pcs per box` : `Direct: 1 ${item.unit}`}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Boxes Quantity */}
                    <div className="w-28">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Boxes / Packs
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={row.boxes}
                        onChange={e => updateRow(idx, 'boxes', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                      />
                    </div>

                    {/* Loose Pieces (If applicable) */}
                    <div className="w-24">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Loose ({item?.unit || 'pcs'})
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={row.loose}
                        onChange={e => updateRow(idx, 'loose', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                      />
                    </div>

                    {/* Cost Per Box (Optional) */}
                    <div className="w-28">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Cost / Box (₹)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="₹ Cost"
                          value={row.costPerBox}
                          onChange={e => updateRow(idx, 'costPerBox', e.target.value)}
                          className="w-full px-3 py-2 text-xs font-semibold text-slate-900 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-right pr-2"
                        />
                      </div>
                    </div>

                    {/* Calculated Total Units Badge */}
                    <div className="w-36 flex flex-col justify-center items-end text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Total Added</span>
                      <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                        +{calculatedPieces} {item?.unit || 'pieces'}
                      </span>
                    </div>

                    {/* Delete Row */}
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors self-end md:self-center"
                        title="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {totalCostEstimate > 0 ? (
              <span>Estimated Purchase Value: <strong className="text-slate-900 font-bold">₹{totalCostEstimate.toLocaleString('en-IN')}</strong></span>
            ) : (
              <span>Calculates boxes to loose count automatically</span>
            )}
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{submitting ? 'Updating Inventory...' : 'Confirm Restock'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

