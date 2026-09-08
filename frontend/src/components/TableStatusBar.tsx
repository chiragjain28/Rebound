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
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div className="bg-white p-4 rounded-xl border border-[#e8e8e8] shadow-sm text-center">
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Tables</p>
        <p className="text-2xl font-bold text-[#1a1a2e] mt-1">{total}</p>
      </div>
      <div className="bg-white p-4 rounded-xl border border-[#e8e8e8] shadow-sm text-center">
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Occupied</p>
        <p className="text-2xl font-bold text-red-600 mt-1">{occupied}</p>
      </div>
      <div className="bg-white p-4 rounded-xl border border-[#e8e8e8] shadow-sm text-center">
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Available</p>
        <p className="text-2xl font-bold text-green-600 mt-1">{available}</p>
      </div>
    </div>
  );
};
