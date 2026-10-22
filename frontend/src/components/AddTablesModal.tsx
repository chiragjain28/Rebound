'use client';

import React, { useState, useRef } from 'react';
import { X, Upload, Plus, Download } from 'lucide-react';
import { api } from '../lib/api';

interface AddTablesModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AddTablesModal: React.FC<AddTablesModalProps> = ({ onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'bulk'>('manual');
  
  // Manual Entry State
  const [number, setNumber] = useState('');
  const [gameType, setGameType] = useState('Pool');
  const [manualLoading, setManualLoading] = useState(false);
  
  // Bulk Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [error, setError] = useState('');

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!number.trim()) {
      setError('Table number is required');
      return;
    }

    setManualLoading(true);
    setError('');

    try {
      await api.post('/tables', {
        number: parseInt(number),
        gameType
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to add table');
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

    if (numberIdx === -1 || gameTypeIdx === -1) {
      throw new Error("CSV must contain 'Number' and 'GameType' columns.");
    }

    const tables = [];
    for (let i = 1; i < rows.length; i++) {
      const parts = rows[i].map(p => p.trim());
      if (parts[numberIdx] && parts[gameTypeIdx]) {
        tables.push({
          number: parseInt(parts[numberIdx]),
          gameType: parts[gameTypeIdx]
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
    const csvContent = "Number,GameType\n1,Pool\n2,Pool\n3,MidSnooker";
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
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-sm shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Add Tables</h2>
            <p className="text-xs text-slate-500 mt-0.5">Configure your lounge billiard tables</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 bg-white p-1.5 rounded-lg transition-colors border border-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {/* Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6 border border-slate-200">
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all duration-200 ${activeTab === 'manual' ? 'bg-white text-slate-900 border border-slate-200 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Single Table
            </button>
            <button
              onClick={() => setActiveTab('bulk')}
              className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all duration-200 ${activeTab === 'bulk' ? 'bg-white text-slate-900 border border-slate-200 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Bulk Upload
            </button>
          </div>

          {error && (
            <div className="mb-6 bg-rose-50 text-rose-800 text-xs font-medium p-3 rounded-xl border border-rose-200 flex items-start gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'manual' ? (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider font-mono">Table Number</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="block w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 text-sm font-mono font-medium transition-colors"
                  placeholder="e.g. 5"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider font-mono">Game Type</label>
                <select
                  value={gameType}
                  onChange={(e) => setGameType(e.target.value)}
                  className="block w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 text-sm font-medium transition-colors"
                >
                  <option value="Pool">Pool</option>
                  <option value="MidSnooker">MidSnooker</option>
                </select>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={manualLoading}
                  className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 shadow-xs disabled:opacity-50 transition-all"
                >
                  {manualLoading ? 'Adding...' : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Table
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
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
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest font-mono">Format</p>
                  <button 
                    onClick={downloadTemplate}
                    className="text-[10px] font-bold bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors flex items-center shadow-xs"
                  >
                    <Download className="h-3 w-3 mr-1" /> Template
                  </button>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-mono">
                  Your CSV must contain exact headers: <b>Number, GameType</b>.
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
                      Upload Tables
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

