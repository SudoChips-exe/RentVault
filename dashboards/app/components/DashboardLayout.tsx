'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2, LayoutDashboard, BadgeCheck, RotateCcw, ScrollText,
  LogOut, User, Settings, Menu, X, Shield, Home, SlidersHorizontal, Wallet, Search, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const roleColors: Record<string, string> = {
  tenant: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  landlord: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
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

const TENANT_NAV = [
  { href: '/tenant', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/tenant/search', icon: Search, label: 'Browse Houses' },
  { href: '/tenant/payments', icon: Wallet, label: 'My Payments' },
  { href: '/tenant/properties', icon: Home, label: 'My Properties' },
  { href: '/tenant/verification', icon: ShieldCheck, label: 'Verification' },
  { href: '/tenant/settings', icon: Settings, label: 'Settings' },
];

const ADMIN_NAV = [
  { href: '/admin', icon: LayoutDashboard, label: 'All Transactions' },
  { href: '/admin/verification', icon: BadgeCheck, label: 'Verification Review' },
  { href: '/admin/tenant-verification', icon: ShieldCheck, label: 'Tenant Verification' },
  { href: '/admin/refunds', icon: RotateCcw, label: 'Manual Refunds' },
  { href: '/admin/split-configs', icon: SlidersHorizontal, label: 'Split Configs' },
  { href: '/admin/audit', icon: ScrollText, label: 'Audit Logs' },
];

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, firebaseUser, logout } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isTenant = user?.role === 'tenant';
  const isLandlord = user?.role === 'landlord' || user?.role === 'agent';

  // Don't assume a role (e.g. defaulting to landlord) while the profile is
  // still loading - that flashes the wrong portal name/nav on every refresh.
  let navLinks: typeof LANDLORD_NAV = [];
  let portalName = 'RentVault';

  if (isAdmin) {
    navLinks = ADMIN_NAV;
    portalName = 'Admin Portal';
  } else if (isTenant) {
    navLinks = TENANT_NAV;
    portalName = 'Tenant Portal';
  } else if (isLandlord) {
    navLinks = LANDLORD_NAV;
    portalName = 'Landlord Portal';
  }

  const currentNavItem = navLinks.find(link => pathname === link.href || pathname.startsWith(link.href + '/'));
  const pageTitle = currentNavItem?.label ?? (isAdmin ? 'Admin Dashboard' : isTenant ? 'Tenant Dashboard' : 'Landlord Dashboard');

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
      <div className={`min-h-screen flex ${
        isAdmin ? 'bg-slate-100 text-slate-900' : 
        isTenant ? 'bg-slate-50 text-slate-900' : 
        isLandlord ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}>
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-slate-950 border-r transition-transform duration-300 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0 lg:static lg:flex ${
            isAdmin ? 'border-slate-300' : 
            isTenant ? 'border-slate-200' : 
            'border-slate-800'
          }`}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-800/50">
            <div className="w-10 h-10 rounded-2xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-black text-slate-100 text-lg leading-none tracking-tighter">RentVault</span>
              <span className="block text-[10px] text-brand-400 font-bold uppercase tracking-widest mt-1">
                {portalName}
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
              {isAdmin ? 'Admin' : isTenant ? 'Tenant' : isLandlord ? 'Management' : ''}
            </p>
            {navLinks.map((link) => (
              <NavLink key={link.href} {...link} />
            ))}
          </nav>

        {/* User profile at bottom */}
        {user && (
          <div className="px-4 pb-6 border-t border-slate-800/50 pt-6 space-y-3">
            {/* Role badge (permanent, non-switchable) */}
            <div className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl text-xs font-bold border ${roleColors[user.role]}`}>
              <Settings className="w-3.5 h-3.5" />
              {user.role}
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
           <header className={`h-14 flex items-center gap-4 px-4 sm:px-6 border-b sticky top-0 z-20 transition-colors ${
             isAdmin ? 'bg-white border-slate-200' : 
             isTenant ? 'bg-white border-slate-200' : 
             isLandlord ? 'bg-slate-900/50 border-slate-800 backdrop-blur-md' : 'bg-white border-slate-200'
           }`}>
             <button
               onClick={() => setSidebarOpen(true)}
               className={`lg:hidden transition-colors ${
                 isAdmin || isTenant ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-slate-100'
               }`}
             >
               <Menu className="w-5 h-5" />
             </button>
             <div className={`flex items-center gap-2 text-sm font-medium transition-colors ${
               isAdmin || isTenant ? 'text-slate-500' : 'text-slate-400'
             }`}>
               <Shield className="w-4 h-4 text-brand-500" />
               <span className={isAdmin || isTenant ? 'text-slate-400' : 'text-slate-500'}>{isAdmin ? 'Admin' : isTenant ? 'Tenant' : 'Landlord'}</span>
               <span className={isAdmin || isTenant ? 'text-slate-300' : 'text-slate-600'}>/</span>
               <span className={`font-bold ${isAdmin || isTenant ? 'text-slate-700' : 'text-slate-200'}`}>{pageTitle}</span>
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
