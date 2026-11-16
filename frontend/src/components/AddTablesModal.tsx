'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Trash2, Plus, Download, AlertCircle, Info, CheckCircle2, Pencil, Check, DollarSign } from 'lucide-react';
import { api } from '../lib/api';

interface TableItem {
  id: number;
  number: number;
  name?: string | null;
  gameType: string;
  ratePerHour?: number | null;
  status?: string;
}

interface AddTablesModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AddTablesModal: React.FC<AddTablesModalProps> = ({ onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'manage' | 'manual' | 'bulk'>('manage');
  
  // Existing tables from DB
  const [existingTables, setExistingTables] = useState<TableItem[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);

  // Manual Entry State
  const [number, setNumber] = useState('');
  const [gameType, setGameType] = useState('Pool');
  const [tableName, setTableName] = useState('');
  const [ratePerHour, setRatePerHour] = useState('160');
  const [manualLoading, setManualLoading] = useState(false);
  
  // Inline Edit State for existing tables
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Bulk Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const getDefaultRate = (type: string) => {
    if (type === 'MidSnooker') return '220';
    if (type === 'PS4') return '80';
    return '160';
  };

  // Helper to compute next available table number for a given game type
  const getNextNumberForGameType = (type: string, tablesList: TableItem[] = existingTables) => {
    const matching = tablesList.filter(t => t.gameType.toLowerCase() === type.toLowerCase());
    if (matching.length === 0) return '1';
    const maxNum = Math.max(...matching.map(t => t.number), 0);
    return String(maxNum + 1);
  };

  // Fetch existing tables on mount
  useEffect(() => {
    let isMounted = true;
    async function loadTables() {
      try {
        setLoadingTables(true);
        const data = await api.get('/tables');
        if (isMounted && Array.isArray(data)) {
          setExistingTables(data);
          const nextNum = getNextNumberForGameType('Pool', data);
          setNumber(nextNum);
          setRatePerHour(getDefaultRate('Pool'));
        }
      } catch (err) {
        console.error('Failed to load existing tables:', err);
      } finally {
        if (isMounted) setLoadingTables(false);
      }
    }
    loadTables();
    return () => { isMounted = false; };
  }, []);

  // When gameType changes, auto-suggest the next available number & default rate
  const handleGameTypeChange = (newType: string) => {
    setGameType(newType);
    setError('');
    const nextNum = getNextNumberForGameType(newType, existingTables);
    setNumber(nextNum);
    setRatePerHour(getDefaultRate(newType));
  };

  // Real-time conflict checking
  const parsedNum = parseInt(number);
  const isDuplicate = !isNaN(parsedNum) && existingTables.some(
    t => t.gameType.toLowerCase() === gameType.toLowerCase() && t.number === parsedNum
  );
  const nextAvailableNum = getNextNumberForGameType(gameType, existingTables);

  const handleStartEdit = (t: TableItem) => {
    if (t.status === 'occupied') {
      setError(`Cannot edit "${t.name || `${t.gameType} Table ${t.number}`}" while a game is actively running on it.`);
      return;
    }
    setEditingId(t.id);
    const defaultLabel = t.gameType === 'PS4' ? `Station ${t.number}` : `Table ${t.number}`;
    setEditName(t.name || defaultLabel);
    setEditRate(t.ratePerHour ? String(t.ratePerHour) : getDefaultRate(t.gameType));
    setError('');
    setSuccessMsg('');
  };

  const handleSaveEdit = async (tableId: number) => {
    if (!editName.trim()) {
      setError('Table name cannot be empty');
      return;
    }
    const parsedRate = parseFloat(editRate);
    if (isNaN(parsedRate) || parsedRate < 0) {
      setError('Please enter a valid price/hourly rate (₹)');
      return;
    }

    setEditLoading(true);
    setError('');
    try {
      const updated = await api.patch(`/tables/${tableId}`, {
        name: editName.trim(),
        ratePerHour: parsedRate
      });
      setExistingTables(prev => prev.map(x => x.id === tableId ? { ...x, ...updated } : x));
      setEditingId(null);
      setSuccessMsg('Table updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to update table');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteExistingTable = async (t: TableItem) => {
    const displayName = t.name || `${t.gameType} Table ${t.number}`;
    if (!confirm(`Delete "${displayName}" permanently from the database?`)) return;
    try {
      await api.delete(`/tables/${t.id}`);
      setExistingTables(prev => prev.filter(x => x.id !== t.id));
      setSuccessMsg(`Deleted "${displayName}" successfully.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to delete table');
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!number.trim() || isNaN(parsedNum) || parsedNum <= 0) {
      setError('Please enter a valid positive table number (e.g. 1, 2, 3)');
      return;
    }

    const parsedRate = parseFloat(ratePerHour);
    if (isNaN(parsedRate) || parsedRate < 0) {
      setError('Please enter a valid price / hourly rate (₹)');
      return;
    }

    if (isDuplicate) {
      setError(`${gameType} Table ${parsedNum} already exists in your lounge! Please choose Table ${nextAvailableNum}.`);
      return;
    }

    setManualLoading(true);
    setError('');

    try {
      const newTable = await api.post('/tables', {
        number: parsedNum,
        gameType,
        name: tableName.trim() || undefined,
        ratePerHour: parsedRate
      });
      setExistingTables(prev => [...prev, newTable]);
      setTableName('');
      setSuccessMsg(`Added ${gameType} #${parsedNum} successfully!`);
      setTimeout(() => setSuccessMsg(''), 3000);
      setActiveTab('manage');
      onSuccess();
    } catch (err: any) {
      const msg = err.message || 'Failed to add table';
      if (msg.includes('Unique constraint') || msg.includes('P2002')) {
        setError(`${gameType} Table ${parsedNum} already exists! Next available number is Table ${nextAvailableNum}.`);
      } else {
        setError(msg);
      }
    } finally {
      setManualLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setError('');
    }
  };

  const parseCSV = (text: string) => {
    const rows = text.split('\n').map(l => l.trim()).filter(l => l).map(l => l.split(','));
    if (rows.length < 2) throw new Error("CSV must contain headers and at least one row.");
    
    const headers = rows[0].map(h => h.trim().toLowerCase());
    const numberIdx = headers.findIndex(h => h.includes('number'));
    const gameTypeIdx = headers.findIndex(h => h.includes('gametype'));
    const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('rate'));
    const nameIdx = headers.findIndex(h => h.includes('name'));

    if (numberIdx === -1 || gameTypeIdx === -1) {
      throw new Error("CSV must contain 'Number' and 'GameType' columns.");
    }

    const tables = [];
    for (let i = 1; i < rows.length; i++) {
      const parts = rows[i].map(p => p.trim());
      if (parts[numberIdx] && parts[gameTypeIdx]) {
        tables.push({
          number: parseInt(parts[numberIdx]),
          gameType: parts[gameTypeIdx],
          name: nameIdx !== -1 && parts[nameIdx] ? parts[nameIdx] : undefined,
          ratePerHour: priceIdx !== -1 && !isNaN(parseFloat(parts[priceIdx])) ? parseFloat(parts[priceIdx]) : undefined
        });
      }
    }
    return tables;
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
        const tables = parseCSV(text);
        
        await api.post('/tables/bulk', { tables });
        onSuccess();
        onClose();
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
    const csvContent = "Number,GameType,Name,RatePerHour\n1,Pool,VIP Pool 1,160\n2,Pool,Pool Table 2,160\n1,MidSnooker,Snooker Royal,220";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "tables_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight font-display">Manage Tables & Rates</h2>
            <p className="text-xs text-slate-500 mt-0.5">Edit hourly prices, customize names, or add/delete lounge tables</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 bg-white p-1.5 rounded-lg transition-colors border border-slate-200 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-4 pb-1 shrink-0">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => { setActiveTab('manage'); setError(''); }}
              className={`flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                activeTab === 'manage' ? 'bg-white text-slate-900 border border-slate-200 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Tables & Prices ({existingTables.length})
            </button>
            <button
              onClick={() => { setActiveTab('manual'); setError(''); }}
              className={`flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                activeTab === 'manual' ? 'bg-white text-slate-900 border border-slate-200 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              + Add Table
            </button>
            <button
              onClick={() => { setActiveTab('bulk'); setError(''); }}
              className={`flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                activeTab === 'bulk' ? 'bg-white text-slate-900 border border-slate-200 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Bulk CSV
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="bg-rose-50 text-rose-800 text-xs font-medium p-3 rounded-xl border border-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 text-emerald-800 text-xs font-medium p-3 rounded-xl border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: MANAGE TABLES & EDIT PRICES */}
          {activeTab === 'manage' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1 border-b border-slate-100">
                <span className="font-bold uppercase tracking-wider text-[10px] font-mono">Current Lounge Tables</span>
                <span className="text-[11px] font-medium">Click pencil to edit price or name</span>
              </div>

              {loadingTables ? (
                <div className="p-8 text-center text-slate-400 text-xs">Loading lounge stations...</div>
              ) : existingTables.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
                  No tables created yet. Click "+ Add Table" above to add your first station.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {existingTables.map((t) => {
                    const isEditing = editingId === t.id;
                    const defaultRate = getDefaultRate(t.gameType);
                    const currentRate = t.ratePerHour ?? defaultRate;
                    const defaultLabel = t.gameType === 'PS4' ? `Station ${t.number}` : `Table ${t.number}`;
                    const displayName = t.name || defaultLabel;

                    if (isEditing) {
                      return (
                        <div key={t.id} className="p-3.5 bg-slate-50 rounded-xl border-2 border-slate-400 shadow-xs space-y-3 animate-in fade-in">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 font-mono">
                              Editing {t.gameType} #{t.number}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">ID: {t.id}</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-1">
                                Table Name / Label
                              </label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                                placeholder="e.g. VIP Pool"
                                autoFocus
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-1">
                                Price / Rate (₹/hr)
                              </label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-mono">₹</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="10"
                                  value={editRate}
                                  onChange={(e) => setEditRate(e.target.value)}
                                  className="w-full pl-6 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                                  placeholder="e.g. 160"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-600 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={editLoading || !editName.trim()}
                              onClick={() => handleSaveEdit(t.id)}
                              className="px-3.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{editLoading ? 'Saving...' : 'Save Changes'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={t.id}
                        className="p-3 bg-white hover:bg-slate-50/80 rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                            #{t.number}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-extrabold text-sm text-slate-900 font-display">
                                {displayName}
                              </h4>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                                {t.gameType}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 font-mono font-bold mt-0.5 flex items-center gap-1">
                              <span className="text-emerald-700">₹{currentRate}/hr</span>
                              {t.ratePerHour && (
                                <span className="text-[10px] text-emerald-800 bg-emerald-50 px-1 rounded border border-emerald-200 font-sans font-semibold">
                                  Custom Rate
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {t.status !== 'occupied' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(t)}
                                title="Edit table name and price"
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteExistingTable(t)}
                                title="Delete table from database"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 font-mono tracking-wider uppercase">
                              In Play (Locked)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ADD SINGLE TABLE WITH CUSTOM RATE */}
          {activeTab === 'manual' ? (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider font-mono">Game Type</label>
                <select
                  value={gameType}
                  onChange={(e) => handleGameTypeChange(e.target.value)}
                  className="block w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 text-sm font-medium transition-colors"
                >
                  <option value="Pool">Pool</option>
                  <option value="MidSnooker">MidSnooker</option>
                  <option value="PS4">PS4 Station</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider font-mono">
                      Table Number
                    </label>
                    {!isDuplicate && (
                      <span className="text-[10px] text-emerald-700 font-bold font-mono">
                        ✓ Auto #{number}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    required
                    min="1"
                    value={number}
                    onChange={(e) => {
                      setNumber(e.target.value);
                      setError('');
                    }}
                    className={`block w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono font-medium transition-colors ${
                      isDuplicate 
                        ? 'border-rose-300 bg-rose-50/50 text-rose-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500' 
                        : 'border-slate-200 bg-white text-slate-900 focus:border-slate-500 focus:ring-1 focus:ring-slate-500'
                    }`}
                    placeholder="e.g. 2"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider font-mono">
                    Hourly Price (₹/hr)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm font-mono text-slate-400">₹</span>
                    <input
                      type="number"
                      required
                      min="0"
                      step="10"
                      value={ratePerHour}
                      onChange={(e) => setRatePerHour(e.target.value)}
                      className="block w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 text-sm font-mono font-bold"
                      placeholder="160"
                    />
                  </div>
                </div>
              </div>

              {isDuplicate && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start justify-between gap-2 text-xs">
                  <div className="text-rose-800">
                    <span className="font-bold">{gameType} Table {parsedNum}</span> already exists!
                  </div>
                  <button
                    type="button"
                    onClick={() => setNumber(nextAvailableNum)}
                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold font-mono shrink-0 transition-colors cursor-pointer"
                  >
                    Use #{nextAvailableNum} →
                  </button>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider font-mono">
                  Custom Name / Label (Optional)
                </label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className="block w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 text-sm font-medium"
                  placeholder="e.g. VIP 1, Star Corner, or leave empty"
                />
                <p className="text-[10px] text-slate-400 mt-1 font-mono">
                  If empty, defaults to {gameType === 'PS4' ? `Station ${number || 1}` : `Table ${number || 1}`}
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={manualLoading || isDuplicate || !number.trim()}
                  className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {manualLoading ? 'Adding...' : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add {gameType} Table {number ? `#${number}` : ''} at ₹{ratePerHour}/hr
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : activeTab === 'bulk' ? (
            <div className="space-y-4">
              <div 
                className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:border-slate-400 hover:bg-slate-50 transition-all cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="bg-slate-100 border border-slate-200 p-3 rounded-2xl shadow-xs mb-2">
                  <Upload className="h-5 w-5 text-slate-600" />
                </div>
                <p className="text-xs font-bold text-slate-900">
                  {selectedFile ? selectedFile.name : 'Click to select CSV file'}
                </p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">.csv files only</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".csv" 
                  className="hidden" 
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest font-mono">CSV Format</p>
                  <button 
                    onClick={downloadTemplate}
                    className="text-[10px] font-bold bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded hover:bg-slate-100 transition-colors flex items-center shadow-2xs"
                  >
                    <Download className="h-3 w-3 mr-1" /> Template
                  </button>
                </div>
                <p className="text-slate-600 font-mono text-[11px]">
                  Headers: <b>Number, GameType, Name, RatePerHour</b>
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleBulkSubmit}
                  disabled={bulkLoading || !selectedFile}
                  className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 shadow-xs disabled:opacity-50 transition-all cursor-pointer"
                >
                  {bulkLoading ? 'Uploading...' : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Tables
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
