'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2, LayoutDashboard, BadgeCheck, RotateCcw, ScrollText,
  LogOut, ChevronDown, User, Settings, Menu, X, Shield
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
  { href: '/landlord/verification', icon: BadgeCheck, label: 'Verification Upload' },
  { href: '/landlord/disbursements', icon: Building2, label: 'Disbursements' },
];

const ADMIN_NAV = [
  { href: '/admin', icon: LayoutDashboard, label: 'All Transactions' },
  { href: '/admin/verification', icon: BadgeCheck, label: 'Verification Review' },
  { href: '/admin/refunds', icon: RotateCcw, label: 'Manual Refunds' },
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
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
          active
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
      >
        <Icon className="w-4 h-4" />
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-slate-900/95 border-r border-slate-800/60 backdrop-blur-xl transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:flex`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800/60">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-slate-100 text-sm leading-none">Rent Split</span>
            <span className="block text-xs text-emerald-400 font-medium">
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
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 py-1 text-xs text-slate-600 font-semibold uppercase tracking-widest mb-2">
            {isAdmin ? 'Admin' : 'Dashboard'}
          </p>
          {navLinks.map((link) => (
            <NavLink key={link.href} {...link} />
          ))}
        </nav>

        {/* User profile at bottom */}
        {user && (
          <div className="px-3 pb-4 border-t border-slate-800/60 pt-3 space-y-2">
            {/* Role switcher */}
            <div className="relative">
              <button
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${roleColors[user.role]}`}
              >
                <Settings className="w-3.5 h-3.5" />
                {user.role}
                <ChevronDown className="w-3 h-3 ml-auto" />
              </button>
              {roleMenuOpen && (
                <div className="absolute bottom-full left-0 w-full mb-1 bg-slate-800 border border-slate-700 rounded-xl py-1 z-50 shadow-xl">
                  <p className="px-3 py-1 text-xs text-slate-500 uppercase tracking-wider font-medium">Switch Role</p>
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      onClick={async () => { await switchRole(r); setRoleMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs capitalize font-medium hover:bg-slate-700 transition-colors ${user.role === r ? 'text-emerald-400' : 'text-slate-300'}`}
                    >
                      {user.role === r ? '✓ ' : ''}{r}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* User info */}
            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-800/40 rounded-xl">
              {firebaseUser?.photoURL ? (
                <img src={firebaseUser.photoURL} alt="" className="w-8 h-8 rounded-full ring-2 ring-emerald-500/40" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{user.displayName}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
              <button onClick={logout} className="text-slate-500 hover:text-red-400 transition-colors">
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
        <header className="h-14 flex items-center gap-4 px-4 sm:px-6 border-b border-slate-800/60 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-400 hover:text-slate-200"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>{isAdmin ? 'Admin Dashboard' : 'Landlord Dashboard'}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {user && (
              <span className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${roleColors[user.role]}`}>
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
