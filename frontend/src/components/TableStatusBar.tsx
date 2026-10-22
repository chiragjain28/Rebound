'use client';

import React from 'react';
import { Table } from '../types';

interface TableStatusBarProps {
  tables: Table[];
}

export const TableStatusBar: React.FC<TableStatusBarProps> = ({ tables }) => {
  const total = tables.length;
  const occupied = tables.filter((t) => t.status === 'occupied').length;
  const available = total - occupied;

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs text-center">
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Tables</p>
        <p className="text-xl font-extrabold text-slate-900 mt-0.5 font-display">{total}</p>
      </div>
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs text-center">
        <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">Occupied</p>
        <p className="text-xl font-extrabold text-rose-700 mt-0.5 font-display">{occupied}</p>
      </div>
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs text-center">
        <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Available</p>
        <p className="text-xl font-extrabold text-emerald-700 mt-0.5 font-display">{available}</p>
      </div>
    </div>
  );
};
