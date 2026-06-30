import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, LogOut, User, ChevronDown, Settings, Home } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useHeaderTheme } from '../contexts/HeaderThemeContext';
import { SignInModal } from './SignInModal';

const ROLES = ['tenant', 'landlord', 'agent', 'admin'] as const;

export const Navbar: React.FC = () => {
  const { user, firebaseUser, logout, switchRole, loading } = useAuth();
  const { theme } = useHeaderTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [signInModalOpen, setSignInModalOpen] = useState(false);

  const isLight = theme === 'light';

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 border-b ${
      isLight 
        ? 'bg-white/80 backdrop-blur-md border-slate-200 text-slate-900' 
        : 'bg-slate-950/80 backdrop-blur-md border-slate-800 text-slate-50'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-slate-900 group-hover:bg-brand-500 transition-colors duration-300 flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className={`font-black text-sm leading-none tracking-tight ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>
                RentVault
              </span>
              <span className="text-[10px] font-bold text-brand-500 uppercase tracking-widest leading-none mt-0.5">
                Secure Escrow
              </span>
            </div>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-8">
            <Link 
              to="/listings" 
              className={`text-sm font-semibold transition-colors flex items-center gap-2 ${
                isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-50'
              }`}
            >
              <Home className="w-4 h-4" />
              Browse Listings
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {loading ? (
              <div className={`w-20 h-8 rounded-lg animate-pulse ${isLight ? 'bg-slate-100' : 'bg-slate-900'}`} />
            ) : user ? (
              <div className="flex items-center gap-3">
                {/* Role switcher */}
                <div className="relative">
                  <button
                    onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                      isLight 
                        ? 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200' 
                        : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Settings className="w-3 h-3" />
                    {user.role}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {roleMenuOpen && (
                    <div className={`absolute right-0 top-12 w-40 rounded-xl shadow-2xl border py-1 z-50 ${
                      isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                    }`}>
                      <p className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        Switch Role
                      </p>
                      {ROLES.map((r) => (
                        <button
                          key={r}
                          onClick={async () => { await switchRole(r); setRoleMenuOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors capitalize font-medium ${
                            isLight 
                              ? `hover:bg-slate-50 ${user.role === r ? 'text-brand-500' : 'text-slate-600'}` 
                              : `hover:bg-slate-800 ${user.role === r ? 'text-brand-400' : 'text-slate-300'}`
                          }`}
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
                    className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full transition-all ${
                      isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-900'
                    }`}
                  >
                    {firebaseUser?.photoURL ? (
                      <img src={firebaseUser.photoURL} alt="" className="w-7 h-7 rounded-full border border-slate-200" />
                    ) : (
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>
                        <User className={`w-4 h-4 ${isLight ? 'text-slate-500' : 'text-slate-400'}`} />
                      </div>
                    )}
                    <span className={`text-sm font-semibold hidden sm:block max-w-[120px] truncate ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                      {user.displayName}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
                  </button>
                  {menuOpen && (
                    <div className={`absolute right-0 top-12 w-56 rounded-xl shadow-2xl border py-2 z-50 ${
                      isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                    }`}>
                      <div className={`px-4 py-3 border-b mb-1 ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                        <p className={`text-sm font-bold truncate ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>{user.displayName}</p>
                        <p className={`text-xs truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{user.email}</p>
                      </div>
                      <button
                        onClick={() => { logout(); setMenuOpen(false); }}
                        className={`w-full text-left flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                          isLight ? 'text-red-500 hover:bg-red-50' : 'text-red-400 hover:bg-slate-800'
                        }`}
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
                className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${
                  isLight 
                    ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-md' 
                    : 'bg-white text-slate-900 hover:bg-slate-100'
                }`}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>

      {(menuOpen || roleMenuOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setMenuOpen(false); setRoleMenuOpen(false); }}
        />
      )}

      <SignInModal 
        isOpen={signInModalOpen} 
        onClose={() => setSignInModalOpen(false)} 
      />
    </nav>
  );
};
