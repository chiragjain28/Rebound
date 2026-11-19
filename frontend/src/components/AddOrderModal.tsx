'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MenuItem } from '../types';
import { api } from '../lib/api';
import { X, Plus, Minus, Trash2, ShoppingBag, Search } from 'lucide-react';

interface AddOrderModalProps {
  sessionId?: string;
  customerId?: number | string;
  onClose: () => void;
  onSuccess: (order: any) => void;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  'Cafe': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', label: 'Café' },
  'Cold Drinks': { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', label: 'Cold Drink' },
  'Cigarettes': { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200', label: 'Cigarette' },
};

export const AddOrderModal: React.FC<AddOrderModalProps> = ({
  sessionId,
  customerId,
  onClose,
  onSuccess
}) => {
  const [mounted, setMounted] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingMenu, setFetchingMenu] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        setFetchingMenu(true);
        const data = await api.get('/menu');
        if (Array.isArray(data)) {
          setMenuItems(data);
        }
      } catch (err: any) {
        console.error('Failed to fetch menu items:', err.message);
        setError(err.message || 'Failed to load menu items');
      } finally {
        setFetchingMenu(false);
      }
    };
    fetchMenu();
  }, []);

  const isSearching = searchQuery.trim().length > 0;

  const matchesSearch = (item: MenuItem, query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;

    const itemName = item.name.toLowerCase();
    const itemCat = item.category.toLowerCase();

    if (itemName.includes(q) || itemCat.includes(q)) return true;

    const isCigaretteQuery = /^(cig|cigg|ciger|cigarr|cigerette|cigerrette|cigertte|cigratte|smoke)/i.test(q);
    if (isCigaretteQuery && itemCat === 'cigarettes') return true;

    return false;
  };

  const filteredItems = menuItems.filter((item) => {
    if (isSearching) {
      return matchesSearch(item, searchQuery);
    }
    if (category === 'All') return true;
    return item.category === category;
  });

  const handleUpdateQty = (item: MenuItem, newQty: number) => {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((ci) => ci.menuItem.id !== item.id));
    } else {
      setCart((prev) => {
        const existing = prev.find((ci) => ci.menuItem.id === item.id);
        if (existing) {
          return prev.map((ci) => ci.menuItem.id === item.id ? { ...ci, quantity: newQty } : ci);
        }
        return [...prev, { menuItem: item, quantity: newQty }];
      });
    }
  };

  const grandTotal = cart.reduce((sum, ci) => sum + (ci.quantity * ci.menuItem.price), 0);

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
        sessionId: sessionId || undefined,
        customerId: customerId || undefined,
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

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl shadow-2xl p-6 flex flex-col h-[600px] max-h-[90vh] space-y-4">
        
        {/* Header */}
        <div className="flex justify-between items-center shrink-0 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 font-display">Add Items & Place Orders</h2>
            <p className="text-xs text-slate-500 mt-0.5">Search items across categories or pick tabs</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-700 text-xs font-semibold p-3 rounded-xl border border-rose-200 shrink-0">
            {error}
          </div>
        )}

        {/* Split Columns Layout */}
        <div className="flex-1 flex gap-5 min-h-0">
          
          {/* Left Column: Menu Item Selector */}
          <div className="flex-1 min-w-0 flex flex-col space-y-3">
            
            {/* Universal Search Bar */}
            <div className="relative shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder="Search any item (e.g. Red Bull, Cold Coffee, Marlboro)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-900 bg-slate-50 text-slate-900 placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Category Selector Tabs */}
            <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl border border-slate-200 bg-slate-100 shrink-0">
              {['All', 'Cafe', 'Cold Drinks', 'Cigarettes'].map((cat) => {
                const count = cat === 'All'
                  ? menuItems.length
                  : menuItems.filter((i) => i.category === cat).length;
                const isSelected = !isSearching ? category === cat : category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategory(cat);
                      setSearchQuery('');
                    }}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-1 text-xs font-bold rounded-lg transition-all min-w-0 ${
                      isSelected && !isSearching
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="truncate">{cat}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md font-bold shrink-0 ${
                        isSelected && !isSearching
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Menu Items List */}
            <div className="flex-1 overflow-y-auto min-h-0 border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
              {fetchingMenu ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400 text-xs">
                  <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
                  <span>Loading menu items...</span>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs">
                  {isSearching ? `No items matching "${searchQuery}"` : 'No items in this category.'}
                </div>
              ) : (
                filteredItems.map((item) => {
                  const cartItem = cart.find((ci) => ci.menuItem.id === item.id);
                  const style = CATEGORY_STYLES[item.category] || { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', label: item.category };

                  return (
                    <div key={item.id} className="flex justify-between items-center p-3 hover:bg-slate-50 transition-colors">
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-slate-900 text-xs truncate">{item.name}</p>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-md border font-mono ${style.bg} ${style.text} ${style.border}`}>
                            {style.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-mono font-bold mt-0.5">₹{item.price.toFixed(2)}</p>
                      </div>

                      {/* Add / Qty Control */}
                      <div className="shrink-0">
                        {cartItem ? (
                          <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg p-1 bg-slate-50">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item, cartItem.quantity - 1)}
                              className="p-1 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-5 text-center text-xs font-mono font-bold text-slate-900">
                              {cartItem.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item, cartItem.quantity + 1)}
                              className="p-1 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item, 1)}
                            className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                          >
                            <Plus className="h-3 w-3 text-slate-500" />
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Order Cart Summary */}
          <div className="w-72 md:w-80 shrink-0 border border-slate-200 rounded-2xl bg-slate-50/70 p-4 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Selected Items ({cart.length})
              </h3>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Scrollable list of cart items */}
            <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
              {cart.length === 0 ? (
                <div className="text-center py-20 text-slate-400 text-xs">
                  No items added to order yet.
                </div>
              ) : (
                cart.map((ci) => (
                  <div key={ci.menuItem.id} className="flex justify-between items-center p-2.5 bg-white rounded-xl border border-slate-200 text-xs shadow-xs">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="font-bold text-slate-900 truncate">{ci.menuItem.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{ci.quantity} × ₹{ci.menuItem.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-slate-900">
                        ₹{(ci.quantity * ci.menuItem.price).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(ci.menuItem, 0)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total Amount & Place Order button */}
            <div className="border-t border-slate-200 pt-3.5 mt-auto space-y-3 shrink-0">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>Order Total:</span>
                <span className="text-base font-mono font-black text-slate-900">
                  ₹{grandTotal.toFixed(2)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || cart.length === 0}
                className="w-full inline-flex justify-center items-center px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-xs font-bold uppercase tracking-wider rounded-xl text-white shadow-sm disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4 mr-2 shrink-0" />
                    Place Order
                  </>
                )}
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>,
    document.body
  );
};
