'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2, LayoutDashboard, BadgeCheck, RotateCcw, ScrollText,
  LogOut, ChevronDown, User, Settings, Menu, X, Shield, Home, SlidersHorizontal
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ROLES = ['tenant', 'landlord', 'agent', 'admin'] as const;

const roleColors: Record<string, string> = {
  tenant: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  landlord: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  agent: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  admin: 'text-red-400 bg-red-400/10 border-red-400/20',
};

const LANDLORD_NAV = [
  { href: '/landlord', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/landlord/listings', icon: Home, label: 'My Listings' },
  { href: '/landlord/verification', icon: BadgeCheck, label: 'Verification Upload' },
  { href: '/landlord/disbursements', icon: Building2, label: 'Disbursements' },
  { href: '/landlord/settings', icon: Settings, label: 'Settings' },
];

const ADMIN_NAV = [
  { href: '/admin', icon: LayoutDashboard, label: 'All Transactions' },
  { href: '/admin/verification', icon: BadgeCheck, label: 'Verification Review' },
  { href: '/admin/refunds', icon: RotateCcw, label: 'Manual Refunds' },
  { href: '/admin/split-configs', icon: SlidersHorizontal, label: 'Split Configs' },
  { href: '/admin/audit', icon: ScrollText, label: 'Audit Logs' },
];

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, firebaseUser, logout, switchRole } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isAdmin = user?.role === 'admin';
  const navLinks = isAdmin ? ADMIN_NAV : LANDLORD_NAV;

  const NavLink = ({ href, icon: Icon, label }: { href: string; icon: React.FC<any>; label: string }) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-bold transition-all duration-150 ${
          active
            ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
      >
        <Icon className="w-4 h-4" />
        {label}
      </Link>
    );
  };

    return (
      <div className="min-h-screen bg-slate-50 flex">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-slate-950 border-r border-slate-200 transition-transform duration-300 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0 lg:static lg:flex`}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-800/50">
            <div className="w-10 h-10 rounded-2xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-black text-slate-100 text-lg leading-none tracking-tighter">RentVault</span>
              <span className="block text-[10px] text-brand-400 font-bold uppercase tracking-widest mt-1">
                {isAdmin ? 'Admin Portal' : 'Landlord Portal'}
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto lg:hidden text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav links */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            <p className="px-3 py-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">
              {isAdmin ? 'Admin' : 'Management'}
            </p>
            {navLinks.map((link) => (
              <NavLink key={link.href} {...link} />
            ))}
          </nav>

        {/* User profile at bottom */}
        {user && (
          <div className="px-4 pb-6 border-t border-slate-800/50 pt-6 space-y-3">
            {/* Role switcher */}
            <div className="relative">
              <button
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl text-xs font-bold border transition-colors ${roleColors[user.role]}`}
              >
                <Settings className="w-3.5 h-3.5" />
                {user.role}
                <ChevronDown className="w-3 h-3 ml-auto" />
              </button>
              {roleMenuOpen && (
                <div className="absolute bottom-full left-0 w-full mb-2 bg-slate-900 border border-slate-800 rounded-2xl py-2 z-50 shadow-2xl">
                  <p className="px-3 py-2 text-[10px] text-slate-500 uppercase tracking-widest font-bold">Switch Role</p>
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      onClick={async () => { await switchRole(r); setRoleMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs capitalize font-bold hover:bg-slate-800 transition-colors ${user.role === r ? 'text-brand-400' : 'text-slate-300'}`}
                    >
                      {user.role === r ? '✓ ' : ''}{r}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* User info */}
            <div className="flex items-center gap-3 px-3 py-3 bg-slate-900 border border-slate-800 rounded-2xl">
              {firebaseUser?.photoURL ? (
                <img src={firebaseUser.photoURL} alt="" className="w-9 h-9 rounded-full ring-2 ring-brand-500/40" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-100 truncate">{user.displayName}</p>
                <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
              </div>
              <button onClick={logout} className="text-slate-500 hover:text-red-400 transition-colors p-1">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="h-14 flex items-center gap-4 px-4 sm:px-6 border-b border-slate-200 bg-white sticky top-0 z-20">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-500 hover:text-slate-900"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
              <Shield className="w-4 h-4 text-brand-500" />
              <span>{isAdmin ? 'Admin Dashboard' : 'Landlord Dashboard'}</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {user && (
                <span className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${roleColors[user.role]}`}>
                  {user.role}
                </span>
              )}
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
            {children}
          </main>
      </div>
    </div>
  );
};
