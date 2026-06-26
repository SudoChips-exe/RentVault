import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, LogOut, User, ChevronDown, Settings, Home, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ROLES = ['tenant', 'landlord', 'agent', 'admin'] as const;

const roleColors: Record<string, string> = {
  tenant: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  landlord: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  agent: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  admin: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

export const Navbar: React.FC = () => {
  const { user, firebaseUser, signInWithGoogle, logout, switchRole, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      navigate('/listings');
    } catch {
      // sign in failure handled by context
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-slate-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/30 group-hover:shadow-brand-500/50 transition-shadow">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-slate-100 text-sm leading-none">Rent Split</span>
              <span className="block text-xs text-brand-400 font-medium leading-none">Escrow</span>
            </div>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-1">
            <Link to="/listings" className="px-3 py-1.5 text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-800/60 rounded-lg transition-colors flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5" />
              Browse Listings
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="w-20 h-8 bg-slate-700/50 rounded-lg animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-2">
                {/* Demo role switcher */}
                <div className="relative">
                  <button
                    onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors ${roleColors[user.role]}`}
                  >
                    <Settings className="w-3 h-3" />
                    {user.role}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {roleMenuOpen && (
                    <div className="absolute right-0 top-8 w-40 glass-panel rounded-xl shadow-xl border border-slate-700 py-1 z-50">
                      <p className="px-3 py-1 text-xs text-slate-500 font-medium uppercase tracking-wider">Switch Role</p>
                      {ROLES.map((r) => (
                        <button
                          key={r}
                          onClick={async () => { await switchRole(r); setRoleMenuOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-700/60 transition-colors capitalize font-medium ${user.role === r ? 'text-brand-400' : 'text-slate-300'}`}
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
                    className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-800/60 transition-colors group"
                  >
                    {firebaseUser?.photoURL ? (
                      <img src={firebaseUser.photoURL} alt="" className="w-7 h-7 rounded-full ring-2 ring-brand-500/40" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-slate-200 hidden sm:block max-w-[120px] truncate">
                      {user.displayName}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-10 w-52 glass-panel rounded-xl shadow-xl border border-slate-700 py-2 z-50">
                      <div className="px-4 py-2 border-b border-slate-700/60 mb-1">
                        <p className="text-sm font-semibold text-slate-200 truncate">{user.displayName}</p>
                        <p className="text-xs text-slate-400 truncate">{user.email}</p>
                      </div>
                      <button
                        onClick={() => { logout(); setMenuOpen(false); }}
                        className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50 transition-all duration-200 active:scale-95"
              >
                Sign in with Google
                <ArrowRight className="w-3.5 h-3.5" />
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
    </nav>
  );
};
