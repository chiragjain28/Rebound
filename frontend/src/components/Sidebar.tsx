'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import {
  LogOut,
  User,
  PlusCircle,
  Grid,
  Users,
  CreditCard,
  BarChart3,
  SlidersHorizontal,
  BookOpen,
  Boxes,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from 'lucide-react';
import { AddItemsModal } from './AddItemsModal';
import { AddTablesModal } from './AddTablesModal';
import { CustomerManagerModal } from './CustomerManagerModal';
import { QuickSaleModal } from './QuickSaleModal';

const SIDEBAR_STORAGE_KEY = 'rebound_sidebar_collapsed';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [showAddItems, setShowAddItems] = useState(false);
  const [showAddTables, setShowAddTables] = useState(false);
  const [showCustomers, setShowCustomers] = useState(false);
  const [showQuickSale, setShowQuickSale] = useState(false);

  // Restore saved collapse preference safely on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved === 'true') {
        setCollapsed(true);
      }
    } catch {
      // Ignore storage read errors
    }
  }, []);

  // Auto-close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage write errors
      }
      return next;
    });
  };

  const navLinks = [
    {
      label: 'Floor Plan',
      href: '/dashboard',
      Icon: Grid,
      isActive: pathname === '/dashboard',
    },
    {
      label: 'Customers',
      href: '/customers',
      Icon: Users,
      isActive: pathname?.startsWith('/customers') ?? false,
    },
    {
      label: 'Credits',
      href: '/credits',
      Icon: CreditCard,
      isActive: (pathname?.startsWith('/credits') || pathname?.startsWith('/ledger')) ?? false,
    },
    {
      label: 'Business Analytics',
      href: '/analytics',
      Icon: BarChart3,
      isActive: pathname?.startsWith('/analytics') ?? false,
    },
    {
      label: 'Inventory',
      href: '/inventory',
      Icon: Boxes,
      isActive: pathname?.startsWith('/inventory') ?? false,
    },
  ];

  const setupItems = [
    {
      label: 'Menu & Inventory',
      Icon: PlusCircle,
      isActive: false,
      onClick: () => {
        setShowAddItems(true);
        setMobileOpen(false);
      },
    },
    {
      label: 'Tables & Prices',
      Icon: SlidersHorizontal,
      isActive: false,
      onClick: () => {
        setShowAddTables(true);
        setMobileOpen(false);
      },
    },
    {
      label: 'Customer Quick View',
      Icon: BookOpen,
      isActive: false,
      onClick: () => {
        setShowCustomers(true);
        setMobileOpen(false);
      },
    },
  ];

  const renderNavContent = (isCompact: boolean, isMobileDrawer = false) => (
    <>
      {/* Header / Brand Logo + Collapse Toggle */}
      <div
        className={`border-b border-slate-100 shrink-0 ${
          isCompact ? 'px-3 py-4 flex flex-col items-center gap-3' : 'px-4 py-4 flex items-center justify-between gap-2'
        }`}
      >
        <div
          className="flex items-center gap-3 cursor-pointer group min-w-0"
          onClick={() => {
            router.push('/dashboard');
            if (isMobileDrawer) setMobileOpen(false);
          }}
          title="Rebound ERP — Floor Plan"
        >
          <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform shrink-0">
            <span className="text-sm font-black font-display tracking-tight text-white">R</span>
          </div>
          {!isCompact && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold tracking-tight text-slate-900 font-display uppercase truncate">
                  Rebound
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 leading-none">
                  ERP
                </span>
              </div>
              <span className="text-[10px] font-semibold tracking-wider text-slate-500 block font-mono uppercase truncate">
                Lounge &amp; Cafe POS
              </span>
            </div>
          )}
        </div>

        {isMobileDrawer ? (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleCollapsed}
            className={`p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer ${
              isCompact ? 'w-9 h-8 flex items-center justify-center' : ''
            }`}
            title={isCompact ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCompact ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCompact ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Operations Section */}
        <div>
          {!isCompact ? (
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2 font-mono">
              Operations
            </p>
          ) : (
            <div className="sr-only">Operations</div>
          )}
          <nav className="space-y-1">
            {navLinks.map((link) => {
              const Icon = link.Icon;
              return (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => {
                    router.push(link.href);
                    if (isMobileDrawer) setMobileOpen(false);
                  }}
                  title={isCompact ? link.label : undefined}
                  className={`w-full flex items-center rounded-xl text-xs font-bold transition-all cursor-pointer group ${
                    isCompact ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
                  } ${
                    link.isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      link.isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'
                    }`}
                  />
                  {!isCompact && <span className="truncate">{link.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Setup & Records Section */}
        <div>
          {!isCompact ? (
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2 font-mono">
              Management &amp; Setup
            </p>
          ) : (
            <div className="h-px bg-slate-100 mx-2 mb-3" />
          )}
          <nav className="space-y-1">
            {setupItems.map((item) => {
              const Icon = item.Icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  title={isCompact ? item.label : undefined}
                  className={`w-full flex items-center rounded-xl text-xs font-bold transition-all cursor-pointer group ${
                    isCompact ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
                  } ${
                    item.isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      item.isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'
                    }`}
                  />
                  {!isCompact && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Pinned Staff & Sign Out Footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/60 space-y-2 shrink-0">
        {user && (
          isCompact ? (
            <div
              className="w-10 h-10 mx-auto rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm"
              title={`Staff: ${user.name}`}
            >
              <User className="w-4 h-4" />
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 flex items-center gap-2.5 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono leading-tight">
                  Staff Operator
                </p>
                <p className="text-xs font-bold text-slate-900 truncate">
                  {user.name}
                </p>
              </div>
            </div>
          )
        )}

        <button
          type="button"
          onClick={logout}
          title={isCompact ? 'Sign Out' : undefined}
          className={`w-full flex items-center rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer ${
            isCompact ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2.5'
          }`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!isCompact && <span>Sign Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sticky Collapsible Sidebar */}
      <aside
        className={`hidden md:flex flex-col sticky top-0 self-start h-screen bg-white border-r border-slate-200 shrink-0 z-40 transition-all duration-200 ease-in-out select-none ${
          collapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        {renderNavContent(collapsed, false)}
      </aside>

      {/* Mobile Compact Header Bar */}
      <header className="md:hidden sticky top-0 z-40 h-14 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => router.push('/dashboard')}
          >
            <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-white">
              <span className="text-xs font-black font-display">R</span>
            </div>
            <span className="text-sm font-extrabold tracking-tight text-slate-900 font-display uppercase">
              Rebound <span className="text-[10px] font-bold text-slate-500">ERP</span>
            </span>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700">
            <User className="w-3 h-3 text-slate-500" />
            <span className="max-w-[90px] truncate font-bold text-slate-900">{user.name}</span>
          </div>
        )}
      </header>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] bg-white h-full shadow-2xl border-r border-slate-200 flex flex-col">
            {renderNavContent(false, true)}
          </aside>
        </div>
      )}

      {/* Modals triggered from Sidebar */}
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
