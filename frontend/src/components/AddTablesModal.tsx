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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-[#111827] rounded-3xl border border-slate-800 w-full max-w-sm shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div>
            <h2 className="text-lg font-extrabold text-white font-display uppercase tracking-wide">Add Tables</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Configure your lounge billiard tables</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-800 p-1.5 rounded-full transition-colors border border-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {/* Tabs */}
          <div className="flex bg-slate-900 p-1 rounded-xl mb-6 border border-slate-800">
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 py-2 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all duration-200 ${activeTab === 'manual' ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(0,242,254,0.4)]' : 'text-slate-400 hover:text-white'}`}
            >
              Single Table
            </button>
            <button
              onClick={() => setActiveTab('bulk')}
              className={`flex-1 py-2 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all duration-200 ${activeTab === 'bulk' ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]' : 'text-slate-400 hover:text-white'}`}
            >
              Bulk Upload
            </button>
          </div>

          {error && (
            <div className="mb-6 bg-rose-950/60 text-rose-300 text-xs font-bold p-3 rounded-xl border border-rose-500/40 flex items-start gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'manual' ? (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-300 mb-1.5 uppercase tracking-widest font-mono">Table Number</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="block w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-mono font-semibold transition-all"
                  placeholder="e.g. 5"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-300 mb-1.5 uppercase tracking-widest font-mono">Game Type</label>
                <select
                  value={gameType}
                  onChange={(e) => setGameType(e.target.value)}
                  className="block w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-semibold transition-all"
                >
                  <option value="Pool">Pool</option>
                  <option value="MidSnooker">MidSnooker</option>
                </select>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={manualLoading}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl text-xs font-extrabold uppercase tracking-wider text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-[0_0_15px_rgba(0,242,254,0.3)] disabled:opacity-50 transition-all custom-button"
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
                className="border-2 border-dashed border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:border-cyan-500/50 hover:bg-slate-900/50 transition-all cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-sm mb-3">
                  <Upload className="h-6 w-6 text-cyan-400" />
                </div>
                <p className="text-xs font-bold text-white">
                  {selectedFile ? selectedFile.name : 'Click to select CSV file'}
                </p>
                <p className="text-[10px] text-slate-500 font-mono mt-1">.csv files only</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".csv" 
                  className="hidden" 
                />
              </div>

              <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-extrabold text-cyan-400 uppercase tracking-widest font-mono">Format</p>
                  <button 
                    onClick={downloadTemplate}
                    className="text-[10px] font-bold bg-slate-900 border border-cyan-500/40 text-cyan-300 px-2 py-1 rounded-lg hover:bg-cyan-500 hover:text-black transition-colors flex items-center"
                  >
                    <Download className="h-3 w-3 mr-1" /> Template
                  </button>
                </div>
                <p className="text-xs text-cyan-200/80 leading-relaxed font-mono">
                  Your CSV must contain exact headers: <b>Number, GameType</b>.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleBulkSubmit}
                  disabled={bulkLoading || !selectedFile}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl text-xs font-extrabold uppercase tracking-wider text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-[0_0_15px_rgba(168,85,247,0.3)] disabled:opacity-50 transition-all custom-button"
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

