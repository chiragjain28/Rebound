'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { 
  LogOut, 
  User, 
  Settings, 
  PlusCircle, 
  Grid, 
  Users, 
  Sparkles, 
  BarChart3, 
  ChevronDown
} from 'lucide-react';
import { AddItemsModal } from './AddItemsModal';
import { AddTablesModal } from './AddTablesModal';
import { CustomerManagerModal } from './CustomerManagerModal';
import { QuickSaleModal } from './QuickSaleModal';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [showSettings, setShowSettings] = useState(false);
  const [showAddItems, setShowAddItems] = useState(false);
  const [showAddTables, setShowAddTables] = useState(false);
  const [showCustomers, setShowCustomers] = useState(false);
  const [showQuickSale, setShowQuickSale] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { label: 'Floor Plan', href: '/dashboard', icon: '🎱' },
    { label: 'Customers & Credit', href: '/customers', icon: '👥' },
    { label: 'Business Analytics', href: '/analytics', icon: '📊' },
  ];

  return (
    <>
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Executive Brand Logo */}
            <div className="flex items-center gap-6">
              <div 
                className="flex-shrink-0 flex items-center gap-3 cursor-pointer group" 
                onClick={() => router.push('/dashboard')}
              >
                <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                  <span className="text-base">🎱</span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-extrabold tracking-tight text-slate-900 font-display uppercase">
                      Rebound
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      ERP
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold tracking-wider text-slate-500 block -mt-0.5 font-mono uppercase">
                    Lounge & Cafe POS
                  </span>
                </div>
              </div>

              {/* Primary Navigation Links (Desktop) */}
              <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-slate-200">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname?.startsWith(link.href));
                  return (
                    <button
                      key={link.href}
                      onClick={() => router.push(link.href)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-slate-100 text-slate-900 shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <span>{link.icon}</span>
                      <span>{link.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Right Action Controls */}
            <div className="flex items-center space-x-3">
              
              {/* Quick POS Sale Button */}
              <button
                onClick={() => setShowQuickSale(true)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Quick POS Sale</span>
              </button>

              {/* Logged-in Staff Info */}
              {user && (
                <div className="hidden lg:flex items-center text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700">
                  <User className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                  <span>Staff: <strong className="text-slate-900">{user.name}</strong></span>
                </div>
              )}
              
              {/* Settings Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 rounded-xl border transition-all duration-200 ${
                    showSettings 
                      ? 'bg-slate-100 border-slate-300 text-slate-900' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300'
                  }`}
                  title="Settings & Admin Menu"
                >
                  <Settings className={`h-4.5 w-4.5 transition-transform duration-300 ${showSettings ? 'rotate-90 text-slate-900' : ''}`} />
                </button>
                
                {showSettings && (
                  <div className="absolute right-0 mt-2.5 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 transform origin-top-right transition-all animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-2 border-b border-slate-100 mb-1">
                      <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-mono">STAFF OPERATOR</p>
                      <p className="text-xs font-bold text-slate-900 truncate">{user?.name || 'Administrator'}</p>
                    </div>

                    {/* Mobile Navigation Links */}
                    <div className="md:hidden border-b border-slate-100 pb-1 mb-1">
                      {navLinks.map((link) => (
                        <button
                          key={link.href}
                          onClick={() => {
                            router.push(link.href);
                            setShowSettings(false);
                          }}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <span>{link.icon}</span>
                          <span>{link.label}</span>
                        </button>
                      ))}
                    </div>

                    <button 
                      onClick={() => { setShowAddItems(true); setShowSettings(false); }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center transition-all group"
                    >
                      <div className="p-1 rounded-md bg-slate-100 text-slate-600 mr-2.5 group-hover:bg-slate-200 transition-colors">
                        <PlusCircle className="h-3.5 w-3.5" />
                      </div>
                      Add / Edit Menu Items
                    </button>
                    
                    <button 
                      onClick={() => { setShowAddTables(true); setShowSettings(false); }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center transition-all group"
                    >
                      <div className="p-1 rounded-md bg-slate-100 text-slate-600 mr-2.5 group-hover:bg-slate-200 transition-colors">
                        <Grid className="h-3.5 w-3.5" />
                      </div>
                      Add / Edit Billiard Tables
                    </button>

                    <button 
                      onClick={() => { setShowCustomers(true); setShowSettings(false); }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center transition-all group"
                    >
                      <div className="p-1 rounded-md bg-slate-100 text-slate-600 mr-2.5 group-hover:bg-slate-200 transition-colors">
                        <Users className="h-3.5 w-3.5" />
                      </div>
                      Customer Directory Quick View
                    </button>

                    <div className="h-px bg-slate-100 my-1 mx-3" />

                    <button 
                      onClick={logout}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center transition-all group"
                    >
                      <div className="p-1 rounded-md bg-rose-50 text-rose-600 mr-2.5 group-hover:bg-rose-100 transition-colors">
                        <LogOut className="h-3.5 w-3.5" />
                      </div>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Modals triggered from Navbar */}
      {showQuickSale && (
        <QuickSaleModal 
          onClose={() => setShowQuickSale(false)}
          onSuccess={() => {
            if (pathname === '/dashboard') {
              window.location.reload();
            }
          }}
        />
      )}

      {showAddItems && (
        <AddItemsModal 
          onClose={() => setShowAddItems(false)} 
          onSuccess={() => {
            setShowAddItems(false);
            window.location.reload();
          }} 
        />
      )}

      {showAddTables && (
        <AddTablesModal 
          onClose={() => setShowAddTables(false)} 
          onSuccess={() => {
            setShowAddTables(false);
            window.location.reload();
          }} 
        />
      )}

      {showCustomers && (
        <CustomerManagerModal 
          onClose={() => setShowCustomers(false)} 
        />
      )}
    </>
  );
};
