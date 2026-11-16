'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Plus, Download, Search, Edit3, Check, RefreshCw, Tag, AlertCircle, Trash2 } from 'lucide-react';
import { api } from '../lib/api';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
}

interface AddItemsModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AddItemsModal: React.FC<AddItemsModalProps> = ({ onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'manage' | 'bulk'>('manual');
  
  // Manual Entry State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Cafe');
  const [manualLoading, setManualLoading] = useState(false);
  
  // Search & Edit Inventory State
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [hasEdited, setHasEdited] = useState(false);

  // Bulk Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch menu items when modal mounts or when switching to 'manage' tab
  const fetchMenuItems = async () => {
    try {
      setLoadingItems(true);
      setError('');
      const items = await api.get('/menu');
      if (Array.isArray(items)) {
        setMenuItems(items);
      }
    } catch (err: any) {
      console.error('Failed to load menu items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    fetchMenuItems();
  }, []);

  useEffect(() => {
    if (activeTab === 'manage' && menuItems.length === 0) {
      fetchMenuItems();
    }
  }, [activeTab]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price || !category.trim()) {
      setError('All fields are required');
      return;
    }

    setManualLoading(true);
    setError('');

    try {
      await api.post('/menu', {
        name: name.trim(),
        price: parseFloat(price),
        category: category.trim()
      });
      setHasEdited(true);
      setName('');
      setPrice('');
      setSuccessMsg(`"${name.trim()}" added to menu`);
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchMenuItems();
    } catch (err: any) {
      setError(err.message || 'Failed to add item');
    } finally {
      setManualLoading(false);
    }
  };

  // Start editing an item
  const handleStartEdit = (item: MenuItem) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditPrice(item.price.toString());
    setEditCategory(item.category);
    setError('');
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditName('');
    setEditPrice('');
    setEditCategory('');
  };

  // Save edited item
  const handleSaveEdit = async (itemId: number) => {
    if (!editName.trim()) {
      setError('Item name is required');
      return;
    }
    const numPrice = parseFloat(editPrice);
    if (isNaN(numPrice) || numPrice < 0) {
      setError('Please enter a valid price');
      return;
    }

    try {
      setSavingEdit(true);
      setError('');
      const updated = await api.put(`/menu/${itemId}`, {
        name: editName.trim(),
        price: numPrice,
        category: editCategory.trim()
      });

      setMenuItems((prev) =>
        prev.map((item) => (item.id === itemId ? updated : item))
      );
      setEditingItemId(null);
      setHasEdited(true);
      setSuccessMsg(`"${updated.name}" updated successfully!`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update item');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete an item
  const handleDeleteItem = async (item: MenuItem) => {
    try {
      setDeletingItemId(item.id);
      setError('');
      await api.delete(`/menu/${item.id}`);
      setMenuItems((prev) => prev.filter((i) => i.id !== item.id));
      setConfirmDeleteId(null);
      if (editingItemId === item.id) {
        setEditingItemId(null);
      }
      setHasEdited(true);
      setSuccessMsg(`"${item.name}" deleted from menu.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete item');
    } finally {
      setDeletingItemId(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setError('');
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l);
    if (lines.length < 2) throw new Error('CSV must contain headers and at least one item row.');

    const headers = lines[0].toLowerCase().split(',');
    const nameIdx = headers.findIndex((h) => h.includes('name'));
    const priceIdx = headers.findIndex((h) => h.includes('price'));
    const categoryIdx = headers.findIndex((h) => h.includes('category'));

    if (nameIdx === -1 || priceIdx === -1 || categoryIdx === -1) {
      throw new Error("CSV must contain 'Name', 'Price', and 'Category' columns.");
    }

    const items = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length >= 3) {
        items.push({
          name: parts[nameIdx],
          price: parseFloat(parts[priceIdx]),
          category: parts[categoryIdx]
        });
      }
    }
    return items;
  };

  const handleBulkSubmit = async () => {
    if (!selectedFile) {
      setError('Please select a CSV file first');
      return;
    }

    setBulkLoading(true);
    setError('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const items = parseCSV(text);

        await api.post('/menu/bulk', { items });
        setHasEdited(true);
        onSuccess();
      } catch (err: any) {
        setError(err.message || 'Failed to process CSV file');
        setBulkLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
      setBulkLoading(false);
    };
    reader.readAsText(selectedFile);
  };

  const downloadTemplate = () => {
    const csvContent = 'data:text/csv;charset=utf-8,Name,Price,Category\nMarlboro Advance,20,Cigarettes\nRed Bull,120,Cold Drinks\nFrench Fries,100,Cafe';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'items_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter items for "Search & Edit" tab
  const filteredItems = menuItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleClose = () => {
    if (hasEdited) {
      onSuccess();
    } else {
      onClose();
    }
  };

  const getCategoryBadgeClass = (cat: string) => {
    switch (cat) {
      case 'Cigarettes':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Cold Drinks':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Cafe':
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Menu & Inventory
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Add new items or edit names and pricing
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 bg-white p-1.5 rounded-lg transition-colors border border-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* 3 Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
            <button
              onClick={() => { setActiveTab('manual'); setError(''); }}
              className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all duration-200 ${
                activeTab === 'manual'
                  ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              + Single Item
            </button>
            <button
              onClick={() => { setActiveTab('manage'); setError(''); }}
              className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${
                activeTab === 'manage'
                  ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Search className="h-3 w-3" />
              Search & Edit ({menuItems.length})
            </button>
            <button
              onClick={() => { setActiveTab('bulk'); setError(''); }}
              className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all duration-200 ${
                activeTab === 'bulk'
                  ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Bulk CSV
            </button>
          </div>

          {/* Success Banner */}
          {successMsg && (
            <div className="bg-emerald-50 text-emerald-800 text-xs font-medium p-3 rounded-xl border border-emerald-200 flex items-center gap-2 animate-in fade-in">
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="bg-rose-50 text-rose-800 text-xs font-medium p-3 rounded-xl border border-rose-200 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: ADD SINGLE ITEM */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider font-mono">
                  Item Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 text-sm font-medium transition-all"
                  placeholder="e.g. Red Bull"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider font-mono">
                    Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="block w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 text-sm font-mono font-medium transition-all"
                    placeholder="120"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider font-mono">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="block w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 text-sm font-medium transition-all cursor-pointer"
                  >
                    <option value="Cafe">Cafe</option>
                    <option value="Cold Drinks">Cold Drinks</option>
                    <option value="Cigarettes">Cigarettes</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={manualLoading}
                  className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 shadow-xs disabled:opacity-50 transition-all"
                >
                  {manualLoading ? 'Adding...' : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item to Menu
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: SEARCH & EDIT MENU ITEMS */}
          {activeTab === 'manage' && (
            <div className="space-y-4">
              {/* Search Bar + Refresh */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by item name..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-medium"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={fetchMenuItems}
                  disabled={loadingItems}
                  title="Refresh items"
                  className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors shadow-xs"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingItems ? 'animate-spin text-slate-400' : ''}`} />
                </button>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1.5">
                {['All', 'Cafe', 'Cold Drinks', 'Cigarettes'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold uppercase font-mono tracking-wider transition-all ${
                      selectedCategory === cat
                        ? 'bg-slate-900 text-white border border-slate-900 shadow-xs'
                        : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
                <span className="text-[10px] text-slate-500 font-mono self-center ml-auto">
                  {filteredItems.length} of {menuItems.length} items
                </span>
              </div>

              {/* Items List */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {loadingItems ? (
                  <div className="text-center py-8 text-xs font-medium text-slate-400">
                    Loading menu items...
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                    No items found matching &quot;{searchQuery}&quot;.
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-3 transition-all ${
                        confirmDeleteId === item.id
                          ? 'bg-rose-50/50 border-rose-300 shadow-xs'
                          : editingItemId === item.id
                          ? 'bg-slate-50 border-slate-300 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {confirmDeleteId === item.id ? (
                        /* Delete Confirmation Prompt */
                        <div className="flex items-center justify-between gap-3 animate-in fade-in">
                          <div className="flex items-center gap-2 min-w-0">
                            <Trash2 className="h-4 w-4 text-rose-600 shrink-0" />
                            <p className="text-xs text-rose-900 font-semibold truncate">
                              Delete <b>&quot;{item.name}&quot;</b> from menu?
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={deletingItemId === item.id}
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item)}
                              disabled={deletingItemId === item.id}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {deletingItemId === item.id ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                          </div>
                        </div>
                      ) : editingItemId === item.id ? (
                        /* Inline Edit Form */
                        <div className="space-y-3">
                          <div className="text-[10px] font-mono text-slate-700 font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <Edit3 className="h-3.5 w-3.5" />
                            Editing Item #{item.id}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="sm:col-span-2">
                              <label className="block text-[9px] font-mono uppercase text-slate-500 mb-1">Name</label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-xs font-medium focus:border-slate-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-mono uppercase text-slate-500 mb-1">Price (₹)</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-xs font-mono font-medium focus:border-slate-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-1">
                            <select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium focus:border-slate-500 focus:outline-none cursor-pointer"
                            >
                              <option value="Cafe">Cafe</option>
                              <option value="Cold Drinks">Cold Drinks</option>
                              <option value="Cigarettes">Cigarettes</option>
                            </select>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(item.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer mr-1"
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                disabled={savingEdit}
                                className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(item.id)}
                                disabled={savingEdit}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                              >
                                {savingEdit ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Normal Item Row */
                        <div className="flex justify-between items-center gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-medium text-slate-900 text-xs truncate">
                              {item.name}
                            </span>
                            <span
                              className={`text-[9px] font-mono px-2 py-0.5 rounded-md border uppercase font-bold shrink-0 ${getCategoryBadgeClass(
                                item.category
                              )}`}
                            >
                              {item.category}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono font-bold text-slate-900 text-sm">
                              ₹{item.price.toFixed(2)}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDeleteId(null);
                                  handleStartEdit(item);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold transition-all shadow-xs cursor-pointer"
                              >
                                <Edit3 className="h-3 w-3" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(item.id)}
                                title={`Delete ${item.name}`}
                                className="inline-flex items-center justify-center p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-lg transition-all shadow-xs cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: BULK UPLOAD CSV */}
          {activeTab === 'bulk' && (
            <div className="space-y-5">
              <div
                className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:border-slate-400 hover:bg-slate-50 transition-all cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="bg-slate-100 border border-slate-200 p-3 rounded-2xl shadow-xs mb-3">
                  <Upload className="h-6 w-6 text-slate-600" />
                </div>
                <p className="text-xs font-bold text-slate-900">
                  {selectedFile ? selectedFile.name : 'Click to select CSV file'}
                </p>
                <p className="text-[10px] text-slate-400 font-mono mt-1">.csv files only</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv"
                  className="hidden"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest font-mono">
                    Format Requirements
                  </p>
                  <button
                    onClick={downloadTemplate}
                    className="text-[10px] font-bold bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors flex items-center shadow-xs"
                  >
                    <Download className="h-3 w-3 mr-1" /> Template
                  </button>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-mono">
                  Your CSV must contain exact headers: <b>Name, Price, Category</b>.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleBulkSubmit}
                  disabled={bulkLoading || !selectedFile}
                  className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 shadow-xs disabled:opacity-50 transition-all"
                >
                  {bulkLoading ? 'Uploading...' : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Items
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
