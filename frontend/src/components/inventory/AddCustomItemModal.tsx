'use client';

import React, { useState } from 'react';
import { X, Plus, AlertCircle, Check } from 'lucide-react';
import { api } from '../../lib/api';

interface AddCustomItemModalProps {
  onClose: () => void;
  onSuccess: () => void;
  defaultCategory?: 'Cafe' | 'Club';
}

export const AddCustomItemModal: React.FC<AddCustomItemModalProps> = ({
  onClose,
  onSuccess,
  defaultCategory = 'Club',
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'Cafe' | 'Club'>(defaultCategory);
  const [unit, setUnit] = useState('pieces');
  const [piecesPerBox, setPiecesPerBox] = useState('10');
  const [currentStock, setCurrentStock] = useState('0');
  const [minStockAlert, setMinStockAlert] = useState('10');
  const [sellingPrice, setSellingPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Item name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await api.post('/inventory', {
        name: name.trim(),
        category,
        unit: unit.trim() || 'pieces',
        piecesPerBox: parseInt(piecesPerBox) || 1,
        currentStock: parseInt(currentStock) || 0,
        minStockAlert: parseInt(minStockAlert) || 10,
        sellingPrice: sellingPrice ? parseFloat(sellingPrice) : undefined,
        costPrice: costPrice ? parseFloat(costPrice) : undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <h2 className="text-base font-bold text-slate-900 font-display">
              Add New Inventory Item
            </h2>
            <p className="text-xs text-slate-500">
              Create a stock trackable item in Cafe or Club category
            </p>
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
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Primary Category Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              Primary Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCategory('Club');
                  setPiecesPerBox('10');
                }}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  category === 'Club'
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="text-sm font-bold text-slate-900">🎱 Club</div>
                <div className="text-[11px] text-slate-500">Cigarettes, gaming gear, cue chalk, tips</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCategory('Cafe');
                  setPiecesPerBox('1');
                }}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  category === 'Cafe'
                    ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="text-sm font-bold text-slate-900">☕ Cafe</div>
                <div className="text-[11px] text-slate-500">Beverages, packaged food, raw ingredients</div>
              </button>
            </div>
          </div>

          {/* Item Name */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
              Item Name
            </label>
            <input
              type="text"
              placeholder={category === 'Club' ? 'e.g. Marlboro Advance, Pioneer Chalk' : 'e.g. Red Bull Can, Amul Milk'}
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold text-slate-900 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Unit of Measure */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
              Unit of Measure
            </label>
            <input
              type="text"
              value={unit}
              onChange={e => setUnit(e.target.value)}
              placeholder="pieces, cans, packets"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Pieces Per Box (Crucial for Cigarettes!) & Min Alert */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                Pieces per Box / Pack
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={piecesPerBox}
                onChange={e => setPiecesPerBox(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold text-slate-900 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                {category === 'Club' ? 'Standard is 10 (Connect/Social: 20)' : 'Standard is 1 or pack size'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                Low Stock Alert (pieces)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={minStockAlert}
                onChange={e => setMinStockAlert(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Initial Stock & Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                Opening Stock ({unit})
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={currentStock}
                onChange={e => setCurrentStock(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                Retail Selling Price (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="₹ Retail"
                value={sellingPrice}
                onChange={e => setSellingPrice(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Creating...' : 'Create Item'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

