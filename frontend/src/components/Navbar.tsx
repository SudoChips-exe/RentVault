import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, LogOut, User, ChevronDown, Settings, Home } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { SignInModal } from './SignInModal';

const ROLES = ['tenant', 'landlord', 'agent', 'admin'] as const;

export const Navbar: React.FC = () => {
  const { user, firebaseUser, logout, switchRole, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [signInModalOpen, setSignInModalOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-slate-50 text-sm leading-none block mb-0.5">RentVault</span>
              <span className="text-xs text-brand-400 font-medium leading-none block">Escrow</span>
            </div>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/listings" className="text-sm font-medium text-slate-400 hover:text-slate-50 transition-colors flex items-center gap-2">
              <Home className="w-4 h-4" />
              Browse Listings
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {loading ? (
              <div className="w-20 h-8 bg-slate-900 rounded-lg animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-3">
                {/* Role switcher */}
                <div className="relative">
                  <button
                    onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 uppercase tracking-wide hover:bg-slate-800 transition-colors"
                  >
                    <Settings className="w-3 h-3" />
                    {user.role}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {roleMenuOpen && (
                    <div className="absolute right-0 top-10 w-40 bg-slate-900 rounded-lg shadow-xl border border-slate-800 py-1 z-50">
                      <p className="px-3 py-2 text-xs text-slate-500 font-medium uppercase tracking-wider">Switch Role</p>
                      {ROLES.map((r) => (
                        <button
                          key={r}
                          onClick={async () => { await switchRole(r); setRoleMenuOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-800 transition-colors capitalize font-medium ${user.role === r ? 'text-brand-400' : 'text-slate-300'}`}
                        >
                          {user.role === r ? '✓ ' : ''}{r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* User menu */}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-900 transition-colors"
                  >
                    {firebaseUser?.photoURL ? (
                      <img src={firebaseUser.photoURL} alt="" className="w-7 h-7 rounded-full" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
                        <User className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-slate-200 hidden sm:block max-w-[120px] truncate">
                      {user.displayName}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-10 w-56 bg-slate-900 rounded-lg shadow-xl border border-slate-800 py-2 z-50">
                      <div className="px-4 py-3 border-b border-slate-800 mb-1">
                        <p className="text-sm font-medium text-slate-50 truncate">{user.displayName}</p>
                        <p className="text-xs text-slate-400 truncate">{user.email}</p>
                      </div>
                      <button
                        onClick={() => { logout(); setMenuOpen(false); }}
                        className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-slate-800 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setSignInModalOpen(true)}
                className="px-5 py-2 bg-white hover:bg-slate-100 text-slate-900 text-sm font-semibold rounded-lg transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Close menus when clicking outside */}
      {(menuOpen || roleMenuOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setMenuOpen(false); setRoleMenuOpen(false); }}
        />
      )}

      {/* Sign In Modal */}
      <SignInModal 
        isOpen={signInModalOpen} 
        onClose={() => setSignInModalOpen(false)} 
      />
    </nav>
  );
};
