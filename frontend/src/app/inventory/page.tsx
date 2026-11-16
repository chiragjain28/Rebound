'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { 
  Boxes, 
  Search, 
  Plus, 
  PackagePlus, 
  SlidersHorizontal, 
  History, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Flame, 
  Coffee, 
  ArrowLeft, 
  RefreshCw,
  Sparkles,
  IndianRupee,
  Layers,
  ChevronRight,
  Filter
} from 'lucide-react';
import { RestockModal, InventoryItemSummary } from '../../components/inventory/RestockModal';
import { AdjustStockModal } from '../../components/inventory/AdjustStockModal';
import { ItemHistoryModal } from '../../components/inventory/ItemHistoryModal';
import { AddCustomItemModal } from '../../components/inventory/AddCustomItemModal';

interface InventoryItem extends InventoryItemSummary {
  minStockAlert: number;
  boxesCount: number;
  looseCount: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  isActive: boolean;
  menuItem?: {
    id: number;
    name: string;
    price: number;
    category: string;
  } | null;
}

interface InventoryStats {
  totalItems: number;
  cafeItemsCount: number;
  clubItemsCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValuation: number;
  cigarettes: {
    totalLoose: number;
    totalBoxes: number;
    brandsCount: number;
  };
}

export default function InventoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [activeCategory, setActiveCategory] = useState<'All' | 'Cafe' | 'Club'>('Club');
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low_stock' | 'out_of_stock'>('all');

  // Modals state
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [preselectedRestockId, setPreselectedRestockId] = useState<number | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [itemsData, statsData] = await Promise.all([
        api.get('/inventory'),
        api.get('/inventory/stats')
      ]);
      setItems(Array.isArray(itemsData) ? itemsData : []);
      setStats(statsData || null);
    } catch (err: any) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSyncMenu = async () => {
    try {
      setSyncing(true);
      await api.post('/inventory/sync-menu', {});
      await loadData();
    } catch (err) {
      console.error('Failed to sync menu with inventory:', err);
    } finally {
      setSyncing(false);
    }
  };

  // Filter items based on Category, Sub-category, Status and Search
  const filteredItems = items.filter(item => {
    // Category Filter
    if (activeCategory !== 'All' && item.category.toLowerCase() !== activeCategory.toLowerCase()) {
      return false;
    }

    // Sub-Category Filter
    if (subCategoryFilter !== 'all') {
      if ((item.subCategory || '').toLowerCase() !== subCategoryFilter.toLowerCase()) {
        return false;
      }
    }

    // Status Filter
    if (statusFilter === 'low_stock' && !item.isLowStock) return false;
    if (statusFilter === 'out_of_stock' && !item.isOutOfStock) return false;

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = item.name.toLowerCase().includes(q);
      const matchSub = (item.subCategory || '').toLowerCase().includes(q);
      if (!matchName && !matchSub) return false;
    }

    return true;
  });

  // Unique subcategories for active category
  const availableSubCategories = Array.from(
    new Set(
      items
        .filter(i => activeCategory === 'All' || i.category.toLowerCase() === activeCategory.toLowerCase())
        .map(i => i.subCategory)
        .filter(Boolean) as string[]
    )
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 shadow-2xs sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
              title="Back to Floor Plan"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                Inventory &amp; Stock Management
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Live ERP Stock
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Track cafe supplies, cigarette boxes, club essentials &amp; auto-deduct POS orders
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleSyncMenu}
              disabled={syncing}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
              title="Sync newly added menu items into inventory"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-blue-600' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">Sync Menu</span>
            </button>

            <button
              onClick={() => setShowAddCustomModal(true)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-slate-500" />
              <span>Add Item</span>
            </button>

            <button
              onClick={() => {
                setPreselectedRestockId(null);
                setShowRestockModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md"
            >
              <PackagePlus className="w-4 h-4" />
              <span>+ Restock Shipment</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">

        {/* Top KPI Summary Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Cigarettes & Club Stock */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                🎱 Club Cigarettes
              </span>
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <Flame className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 font-display">
                  {stats?.cigarettes?.totalLoose || 0}
                </span>
                <span className="text-xs text-slate-500 font-semibold">loose sticks</span>
              </div>
              <p className="text-xs text-indigo-600 font-bold mt-1">
                ≈ {stats?.cigarettes?.totalBoxes || 0} full boxes ({stats?.cigarettes?.brandsCount || 0} brands)
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Standard 10/box (Connect, Social, Shift: 20/box)
              </p>
            </div>
          </div>

          {/* Card 2: Cafe Supplies */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                ☕ Cafe &amp; Drinks
              </span>
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                <Coffee className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 font-display">
                  {stats?.cafeItemsCount || 0}
                </span>
                <span className="text-xs text-slate-500 font-semibold">tracked items</span>
              </div>
              <p className="text-xs text-slate-600 font-semibold mt-1">
                Cold drinks, snacks &amp; kitchen essentials
              </p>
            </div>
          </div>

          {/* Card 3: Low Stock Alerts */}
          <div 
            onClick={() => setStatusFilter(prev => prev === 'low_stock' ? 'all' : 'low_stock')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
              statusFilter === 'low_stock'
                ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/20 shadow-sm'
                : 'bg-white border-slate-200/80 shadow-2xs hover:border-amber-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                ⚠️ Stock Alerts
              </span>
              <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <AlertTriangle className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-black font-display ${stats?.lowStockCount ? 'text-amber-600' : 'text-slate-900'}`}>
                  {stats?.lowStockCount || 0}
                </span>
                <span className="text-xs text-slate-500 font-semibold">low stock items</span>
              </div>
              <p className="text-xs text-amber-700 font-semibold mt-1">
                {stats?.outOfStockCount || 0} items completely out of stock
              </p>
            </div>
          </div>

          {/* Card 4: Inventory Valuation */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Stock Valuation
              </span>
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <IndianRupee className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 font-display">
                  ₹{(stats?.totalValuation || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-xs text-emerald-700 font-semibold mt-1">
                Estimated floor retail valuation
              </p>
            </div>
          </div>
        </div>

        {/* Primary Category Selector & Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Two Primary Categories (User Requirement: Cafe & Club) */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start">
              {[
                { id: 'Club', label: '🎱 Club Inventory', count: stats?.clubItemsCount },
                { id: 'Cafe', label: '☕ Cafe Inventory', count: stats?.cafeItemsCount },
                { id: 'All', label: 'All Items', count: stats?.totalItems }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id as any);
                    setSubCategoryFilter('all');
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeCategory === cat.id
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{cat.label}</span>
                  {cat.count !== undefined && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      activeCategory === cat.id ? 'bg-slate-100 text-slate-700' : 'bg-slate-200/60 text-slate-500'
                    }`}>
                      {cat.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search items by name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600 font-bold"
                >
                  CLEAR
                </button>
              )}
            </div>
          </div>

          {/* Subcategory Pills & Status Quick Toggles */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Subcategory:
            </span>

            <button
              onClick={() => setSubCategoryFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                subCategoryFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>

            {availableSubCategories.map(sub => (
              <button
                key={sub}
                onClick={() => setSubCategoryFilter(sub)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  subCategoryFilter === sub
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {sub}
              </button>
            ))}

            <div className="h-4 w-[1px] bg-slate-200 mx-2" />

            {/* Quick Low Stock Toggle */}
            <button
              onClick={() => setStatusFilter(prev => prev === 'low_stock' ? 'all' : 'low_stock')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                statusFilter === 'low_stock'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Low Stock Alerts</span>
            </button>
          </div>
        </div>

        {/* Inventory Items Listing */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
            <p className="text-sm font-semibold text-slate-600">Loading stock inventory...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            <Boxes className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-bold text-slate-700">No inventory items matched your filter.</p>
            <p className="text-xs text-slate-400 mt-1">
              Try clearing filters or search query, or click "+ Restock Shipment" to add stock.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Subcategory</th>
                    <th className="py-3 px-4 text-center">Current Stock</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Retail Price</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredItems.map(item => {
                    const isCigarette = item.subCategory?.toLowerCase() === 'cigarettes';
                    const hasBoxConfig = item.piecesPerBox > 1;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Name */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            {item.name}
                            {hasBoxConfig && (
                              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                {item.piecesPerBox} / box
                              </span>
                            )}
                          </div>
                          {item.menuItem && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              Linked to POS Menu
                            </span>
                          )}
                        </td>

                        {/* Category */}
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              item.category.toLowerCase() === 'club'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                : 'bg-blue-50 text-blue-700 border border-blue-100'
                            }`}
                          >
                            {item.category.toLowerCase() === 'club' ? '🎱 Club' : '☕ Cafe'}
                          </span>
                        </td>

                        {/* SubCategory */}
                        <td className="py-3 px-3">
                          <span className="text-slate-600 font-semibold">
                            {item.subCategory || 'General'}
                          </span>
                        </td>

                        {/* Current Stock with Box Breakdown */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-sm font-black text-slate-900 font-display">
                              {item.currentStock} {item.unit}
                            </span>
                            {hasBoxConfig && (
                              <span className="text-[11px] font-semibold text-slate-500 font-mono">
                                {item.boxesCount} boxes + {item.looseCount} loose
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-3 text-center">
                          {item.isOutOfStock ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3" /> Out of Stock
                            </span>
                          ) : item.isLowStock ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3 h-3" /> Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> In Stock
                            </span>
                          )}
                        </td>

                        {/* Retail Selling Price */}
                        <td className="py-3 px-3 text-right font-bold text-slate-800">
                          {item.sellingPrice ? `₹${item.sellingPrice}` : '—'}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Quick Restock */}
                            <button
                              onClick={() => {
                                setPreselectedRestockId(item.id);
                                setShowRestockModal(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] transition-colors"
                              title="Restock this item"
                            >
                              + Restock
                            </button>

                            {/* Adjust Physical Count */}
                            <button
                              onClick={() => setAdjustingItem(item)}
                              className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                              title="Adjust actual physical count"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>

                            {/* View Audit Trail */}
                            <button
                              onClick={() => setHistoryItem(item)}
                              className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                              title="View restock and sales history"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Restock Shipment Modal */}
      {showRestockModal && (
        <RestockModal
          items={items}
          preselectedItemId={preselectedRestockId}
          onClose={() => {
            setShowRestockModal(false);
            setPreselectedRestockId(null);
          }}
          onSuccess={loadData}
        />
      )}

      {/* Adjust Stock Modal */}
      {adjustingItem && (
        <AdjustStockModal
          item={adjustingItem}
          onClose={() => setAdjustingItem(null)}
          onSuccess={loadData}
        />
      )}

      {/* Item History Modal */}
      {historyItem && (
        <ItemHistoryModal
          item={historyItem}
          onClose={() => setHistoryItem(null)}
        />
      )}

      {/* Add Custom Item Modal */}
      {showAddCustomModal && (
        <AddCustomItemModal
          defaultCategory={activeCategory === 'All' ? 'Club' : activeCategory}
          onClose={() => setShowAddCustomModal(false)}
          onSuccess={loadData}
        />
      )}

    </div>
  );
}

