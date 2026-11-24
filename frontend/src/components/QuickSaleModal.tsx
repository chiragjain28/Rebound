'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { MenuItem } from '../types';
import { 
  X, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle, 
  Send, 
  Coffee, 
  Flame, 
  DollarSign, 
  User, 
  Phone, 
  CreditCard,
  Receipt,
  Loader2,
  Sparkles
} from 'lucide-react';

interface QuickSaleModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

interface CartItem {
  menuItemId: number;
  name: string;
  category: string;
  price: number;
  quantity: number;
}

const EditableQuantityControl = ({
  quantity,
  onChange,
}: {
  quantity: number;
  onChange: (qty: number) => void;
}) => {
  const [localVal, setLocalVal] = useState<string>(String(quantity));

  useEffect(() => {
    setLocalVal(String(quantity));
  }, [quantity]);

  const commitValue = (valStr: string) => {
    const parsed = parseInt(valStr, 10);
    if (isNaN(parsed) || parsed <= 0) {
      onChange(0);
    } else {
      onChange(parsed);
      setLocalVal(String(parsed));
    }
  };

  return (
    <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50 shadow-2xs">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, quantity - 1))}
        className="p-1 hover:bg-slate-200 text-slate-700 rounded transition-colors cursor-pointer"
        title="Decrease quantity"
      >
        <Minus className="h-3 w-3" />
      </button>

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={localVal}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const val = e.target.value;
          if (val === '' || /^\d+$/.test(val)) {
            setLocalVal(val);
            if (val !== '') {
              const num = parseInt(val, 10);
              if (!isNaN(num) && num > 0) {
                onChange(num);
              }
            }
          }
        }}
        onBlur={() => {
          commitValue(localVal);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
        className="w-10 py-0.5 text-center text-xs font-mono font-black text-slate-900 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
      />

      <button
        type="button"
        onClick={() => onChange(quantity + 1)}
        className="p-1 hover:bg-slate-200 text-slate-700 rounded transition-colors cursor-pointer"
        title="Increase quantity"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
};

export const QuickSaleModal: React.FC<QuickSaleModalProps> = ({ onClose, onSuccess }) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchItem, setSearchItem] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Customer details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);

  // Billing & Payment
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card'>('Cash');
  const [customAmount, setCustomAmount] = useState<string>('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [completedSale, setCompletedSale] = useState<any | null>(null);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [whatsappSent, setWhatsappSent] = useState(false);

  // Load menu items
  useEffect(() => {
    const loadMenu = async () => {
      try {
        const data = await api.get('/menu');
        setMenuItems(data);
        const cats = Array.from(new Set(data.map((m: MenuItem) => m.category || 'General'))) as string[];
        setCategories(['All', ...cats]);
      } catch (err: any) {
        console.error('Failed to load menu:', err);
      }
    };
    loadMenu();
  }, []);

  // Customer search typeahead
  useEffect(() => {
    const query = customerPhone.trim() || customerName.trim();
    if (!query || query.length < 2) {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const handler = setTimeout(async () => {
      try {
        setIsSearchingCustomer(true);
        const res = await api.get(`/customers/search?q=${encodeURIComponent(query)}`);
        setCustomerSuggestions(res || []);
        setShowSuggestions((res || []).length > 0);
      } catch (err) {
        console.error('Customer search error:', err);
      } finally {
        setIsSearchingCustomer(false);
      }
    }, 200);

    return () => clearTimeout(handler);
  }, [customerPhone, customerName]);

  const handleSelectCustomer = (c: { name: string; phone: string }) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    setShowSuggestions(false);
  };

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.menuItemId === item.id);
      if (existing) {
        return prev.map(i => i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        menuItemId: item.id,
        name: item.name,
        category: item.category || 'General',
        price: item.price,
        quantity: 1
      }];
    });
  };

  const updateQuantity = (menuItemId: number, delta: number) => {
    setCart(prev => {
      return prev.map(i => {
        if (i.menuItemId === menuItemId) {
          const newQty = i.quantity + delta;
          return newQty > 0 ? { ...i, quantity: newQty } : null;
        }
        return i;
      }).filter(Boolean) as CartItem[];
    });
  };

  const setExactQuantity = (menuItemId: number, qty: number) => {
    setCart(prev => {
      if (qty <= 0) {
        return prev.filter(i => i.menuItemId !== menuItemId);
      }
      return prev.map(i => i.menuItemId === menuItemId ? { ...i, quantity: qty } : i);
    });
  };

  const removeFromCart = (menuItemId: number) => {
    setCart(prev => prev.filter(i => i.menuItemId !== menuItemId));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const parsedAdjustment = parseFloat(customAmount) || 0;
  const grandTotal = Math.max(0, subtotal + parsedAdjustment);

  const filteredMenuItems = menuItems.filter(item => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchItem.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleSubmitSale = async () => {
    if (cart.length === 0) {
      setError('Please add at least one item to cart');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const payload = {
        customerName: customerName.trim() || 'Walk-in Guest',
        customerPhone: customerPhone.trim() || null,
        items: cart.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
        paymentMethod,
        customAmount: parsedAdjustment
      };

      const result = await api.post('/sessions/quick-sale', payload);
      setCompletedSale(result);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to complete quick sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!completedSale || !customerPhone) return;
    try {
      setSendingWhatsapp(true);
      await api.post(`/sessions/${completedSale.id}/send-whatsapp`, {});
      setWhatsappSent(true);
    } catch (err: any) {
      alert(err.message || 'Failed to send WhatsApp receipt');
    } finally {
      setSendingWhatsapp(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-display flex items-center gap-2">
                Instant Counter POS Sale
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100/70 text-emerald-800 border border-emerald-200">
                  Walk-in Quick Checkout
                </span>
              </h2>
              <p className="text-xs text-slate-500">Sell snacks, drinks, cigarettes & cafe items directly without creating a pool table</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Completed Sale View */}
        {completedSale ? (() => {
          const totalAmount = Number(completedSale.totalBill ?? completedSale.visitTotal ?? grandTotal) || 0;
          const custName = completedSale.customerName || completedSale.customer?.name || customerName || 'Walk-in Guest';
          const rawPhone = completedSale.customerPhone || completedSale.customer?.phone || customerPhone || '';
          const hasPhone = Boolean(rawPhone && !rawPhone.startsWith('QUICK-') && !rawPhone.startsWith('WALK-') && rawPhone.replace(/\D/g, '').length >= 10);

          return (
            <div className="p-8 flex flex-col items-center justify-center text-center space-y-6 overflow-y-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <CheckCircle className="w-9 h-9" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 font-display">Sale Completed Successfully!</h3>
                <p className="text-sm text-slate-500 mt-1 font-mono">
                  Ticket <span className="font-semibold text-slate-700">{completedSale.id}</span> • ₹{totalAmount.toFixed(2)} Paid via {paymentMethod}
                </p>
              </div>

              {/* Receipt Summary Box */}
              <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-xl p-5 text-left space-y-3 font-mono">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-sans">Customer</span>
                  <span className="text-xs font-bold text-slate-900 font-sans">
                    {custName} {hasPhone ? `(${rawPhone})` : ''}
                  </span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto font-sans">
                  {completedSale.orders?.map((o: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-xs text-slate-700">
                      <span>{o.menuItem?.name || 'Item'} × {o.quantity}</span>
                      <span className="font-semibold font-mono">₹{((o.price || 0) * (o.quantity || 1)).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
                  <span>Total Collected</span>
                  <span className="text-emerald-600">₹{totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 justify-center">
                {hasPhone && (
                  <button
                    onClick={handleSendWhatsApp}
                    disabled={sendingWhatsapp || whatsappSent}
                    className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                      whatsappSent
                        ? 'bg-emerald-600 text-white cursor-default'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm'
                    }`}
                  >
                    {sendingWhatsapp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {whatsappSent ? 'Receipt Sent via WhatsApp' : `Send WhatsApp to ${rawPhone}`}
                  </button>
                )}
                <button
                  onClick={() => {
                    setCompletedSale(null);
                    setCart([]);
                    setCustomerName('');
                    setCustomerPhone('');
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm cursor-pointer"
                >
                  + Start Another Sale
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Done / Close
                </button>
              </div>
            </div>
          );
        })() : (
          /* Normal POS View */
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
            
            {/* Left 7 Cols: Menu Catalog */}
            <div className="lg:col-span-7 p-5 flex flex-col border-r border-slate-200 overflow-y-auto">
              
              {/* Category Pills & Item Search */}
              <div className="space-y-3 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search snacks, drinks, cigarettes, cold coffee..."
                    value={searchItem}
                    onChange={(e) => setSearchItem(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  />
                  {searchItem && (
                    <button 
                      onClick={() => setSearchItem('')}
                      className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Categories Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                        selectedCategory === cat
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items Grid */}
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2.5 overflow-y-auto pr-1">
                {filteredMenuItems.map((item) => {
                  const inCart = cart.find(c => c.menuItemId === item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between select-none ${
                        inCart
                          ? 'bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-300/40'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{item.category}</span>
                          {inCart && (
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center">
                              {inCart.quantity}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-2 mt-1">{item.name}</h4>
                      </div>
                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-xs font-extrabold text-slate-900">₹{item.price}</span>
                        <button
                          type="button"
                          className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {filteredMenuItems.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                    No menu items found in this category
                  </div>
                )}
              </div>
            </div>

            {/* Right 5 Cols: Cart & Customer Checkout */}
            <div className="lg:col-span-5 p-5 bg-slate-50/50 flex flex-col justify-between overflow-y-auto">
              
              <div className="space-y-4">
                {/* Customer Information (Optional / Typeahead) */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" /> Customer Information
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">Optional for walk-ins</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 relative">
                    {/* Phone Input with Autocomplete */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Phone Number"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>

                    {/* Name Input */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Name (e.g. Tony)"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>

                    {/* Dropdown Suggestions */}
                    {showSuggestions && customerSuggestions.length > 0 && (
                      <div className="absolute top-10 left-0 right-0 z-20 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden py-1">
                        <div className="px-3 py-1 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase">
                          Existing Customers
                        </div>
                        {customerSuggestions.map((c) => (
                          <div
                            key={c.id || c.phone}
                            onClick={() => handleSelectCustomer(c)}
                            className="px-3 py-2 hover:bg-slate-100 cursor-pointer flex justify-between items-center text-xs"
                          >
                            <span className="font-semibold text-slate-800">{c.name}</span>
                            <span className="font-mono text-slate-500">{c.phone}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Cart Items List */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">Order Items ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
                    {cart.length > 0 && (
                      <button
                        onClick={() => setCart([])}
                        className="text-[11px] text-rose-500 hover:text-rose-700 font-semibold flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>

                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                    {cart.map((item) => (
                      <div key={item.menuItemId} className="p-3 flex items-center justify-between text-xs">
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-slate-800 truncate">{item.name}</p>
                          <p className="text-[11px] text-slate-400">₹{item.price} each</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <EditableQuantityControl
                            quantity={item.quantity}
                            onChange={(qty) => setExactQuantity(item.menuItemId, qty)}
                          />
                          <span className="font-extrabold text-slate-900 w-12 text-right">
                            ₹{(item.price * item.quantity).toFixed(0)}
                          </span>
                        </div>
                      </div>
                    ))}
                    {cart.length === 0 && (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        Cart is empty. Tap items on the left to add.
                      </div>
                    )}
                  </div>
                </div>

                {/* Discounts / Adjustments */}
                <div className="flex items-center justify-between text-xs bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-600 font-medium">Custom Adjustment / Discount (₹)</span>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="0"
                    className="w-24 text-right px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                {/* Payment Method Switch */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Cash', 'UPI', 'Card'] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                          paymentMethod === method
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {method === 'Cash' && <DollarSign className="w-3.5 h-3.5" />}
                        {method === 'UPI' && <Receipt className="w-3.5 h-3.5" />}
                        {method === 'Card' && <CreditCard className="w-3.5 h-3.5" />}
                        {method}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Checkout Action */}
              <div className="pt-4 border-t border-slate-200 mt-4 space-y-3">
                {error && (
                  <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2 rounded-lg border border-rose-200">
                    {error}
                  </p>
                )}

                <div className="flex justify-between items-baseline">
                  <div>
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Payable</span>
                    <p className="text-[11px] text-slate-400">Immediate Settlement</p>
                  </div>
                  <div className="text-2xl font-black text-slate-900 font-display">
                    ₹{grandTotal.toFixed(2)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSubmitSale}
                  disabled={isSubmitting || cart.length === 0}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Processing Sale...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" /> Collect ₹{grandTotal.toFixed(0)} ({paymentMethod}) & Close
                    </>
                  )}
                </button>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};
