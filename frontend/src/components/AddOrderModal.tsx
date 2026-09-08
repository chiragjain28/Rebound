'use client';

import React, { useState, useEffect } from 'react';
import { MenuItem } from '../types';
import { api } from '../lib/api';
import { X, Plus, Minus, Trash2, ShoppingBag, Search } from 'lucide-react';

interface AddOrderModalProps {
  sessionId: string;
  onClose: () => void;
  onSuccess: (order: any) => void;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

export const AddOrderModal: React.FC<AddOrderModalProps> = ({
  sessionId,
  onClose,
  onSuccess
}) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [category, setCategory] = useState('Cafe');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const data = await api.get('/menu');
        setMenuItems(data);
      } catch (err: any) {
        console.error('Failed to fetch menu items:', err.message);
      }
    };
    fetchMenu();
  }, []);

  const filteredItems = menuItems.filter(
    (item) => item.category === category && item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUpdateQty = (menuItem: MenuItem, qty: number) => {
    if (qty <= 0) {
      setCart(cart.filter((ci) => ci.menuItem.id !== menuItem.id));
    } else {
      const exists = cart.find((ci) => ci.menuItem.id === menuItem.id);
      if (exists) {
        setCart(
          cart.map((ci) =>
            ci.menuItem.id === menuItem.id ? { ...ci, quantity: qty } : ci
          )
        );
      } else {
        setCart([...cart, { menuItem, quantity: qty }]);
      }
    }
  };

  const grandTotal = cart.reduce((sum, ci) => sum + ci.quantity * ci.menuItem.price, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      setError('Please add at least one item to place an order');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/orders', {
        sessionId,
        items: cart.map((ci) => ({
          menuItemId: ci.menuItem.id.toString(),
          quantity: ci.quantity
        }))
      });
      onSuccess(data);
    } catch (err: any) {
      setError(err.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-[#111827] rounded-3xl border border-slate-800 w-full max-w-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden p-6 flex flex-col h-[560px] space-y-5">
        
        {/* Header */}
        <div className="flex justify-between items-center shrink-0 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-extrabold text-white font-display uppercase tracking-wide">Add Café Order</h2>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">Select items and adjust quantities to add to bill</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-950/60 text-rose-300 text-xs font-bold p-3 rounded-xl border border-rose-500/40 shrink-0">
            {error}
          </div>
        )}

        {/* Split Columns Layout */}
        <div className="flex-1 flex gap-6 min-h-0">
          
          {/* Left Column: Menu Item Selector */}
          <div className="flex-1 flex flex-col space-y-4">
            
            {/* Category Selector Tabs */}
            <div className="flex rounded-xl border border-slate-800 p-1 bg-slate-900 shrink-0">
              {['Cafe', 'Cold Drinks', 'Cigarettes'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`flex-1 text-center py-2 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all ${
                    category === cat
                      ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(0,242,254,0.4)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Bar */}
            <div className="relative shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400" />
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 bg-slate-900 text-white placeholder-slate-500"
              />
            </div>

            {/* Menu Items List */}
            <div className="flex-1 overflow-y-auto min-h-0 border border-slate-800 rounded-2xl divide-y divide-slate-800 bg-slate-900/60">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs font-semibold">
                  No items in this category.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const cartItem = cart.find((ci) => ci.menuItem.id === item.id);
                  return (
                    <div key={item.id} className="flex justify-between items-center p-3 hover:bg-slate-800/60 transition-colors">
                      <div>
                        <p className="font-extrabold text-white text-sm">{item.name}</p>
                        <p className="text-xs text-cyan-400 font-mono font-bold mt-0.5">₹{item.price.toFixed(2)}</p>
                      </div>

                      {/* Add / Qty Control */}
                      {cartItem ? (
                        <div className="flex items-center gap-2 border border-slate-800 rounded-xl p-1 bg-slate-900">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item, cartItem.quantity - 1)}
                            className="p-1 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-6 text-center text-xs font-mono font-bold text-cyan-400">
                            {cartItem.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item, cartItem.quantity + 1)}
                            className="p-1 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item, 1)}
                          className="bg-slate-900 border border-slate-700 hover:border-cyan-400 hover:text-cyan-300 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-all"
                        >
                          <Plus className="h-3 w-3 text-cyan-400" />
                          Add
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Order Cart Summary */}
          <div className="w-64 border border-slate-800 rounded-2xl bg-slate-900/90 p-4 flex flex-col min-h-0">
            <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 shrink-0 font-mono">
              Selected Items ({cart.length})
            </h3>

            {/* Scrollable list of cart items */}
            <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
              {cart.length === 0 ? (
                <div className="text-center py-20 text-slate-500 text-xs font-semibold">
                  No items added to order.
                </div>
              ) : (
                cart.map((ci) => (
                  <div key={ci.menuItem.id} className="flex justify-between items-center p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-xs shadow-sm">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="font-bold text-white truncate">{ci.menuItem.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{ci.quantity} × ₹{ci.menuItem.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-cyan-400">
                        ₹{(ci.quantity * ci.menuItem.price).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(ci.menuItem, 0)}
                        className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total Amount & Place Order button */}
            <div className="border-t border-slate-800 pt-3 mt-3 space-y-3 shrink-0">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>Grand Total:</span>
                <span className="text-sm font-mono font-extrabold text-cyan-400 glow-text-cyan">₹{grandTotal.toFixed(2)}</span>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || cart.length === 0}
                className="w-full inline-flex justify-center items-center px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-xs font-extrabold uppercase tracking-wider rounded-xl text-white shadow-[0_0_15px_rgba(0,242,254,0.3)] disabled:opacity-50 transition-all custom-button"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4 mr-1.5" />
                    Place Order
                  </>
                )}
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};
