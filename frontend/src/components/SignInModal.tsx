import React from 'react';
import { Building2, Home, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SignInModal: React.FC<SignInModalProps> = ({ isOpen, onClose }) => {
  const { signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleTenantSignIn = async () => {
    try {
      await signInWithGoogle();
      onClose();
      navigate('/listings');
    } catch {
      // Error is handled by AuthContext
    }
  };

  const handleLandlordSignIn = () => {
    // Redirect to Next.js dashboard portal where Landlord Auth is handled
    window.location.href = 'http://localhost:3000';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 overflow-hidden transform transition-all">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-50 mb-2">Welcome to RentVault</h2>
          <p className="text-slate-400 text-sm">Choose how you want to continue to securely sign in with Google.</p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={handleTenantSignIn}
            className="w-full flex items-center p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-brand-500/50 rounded-xl transition-all group text-left"
          >
            <div className="w-12 h-12 bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-brand-500/10 group-hover:border-brand-500/30 transition-colors">
              <Home className="w-6 h-6 text-slate-400 group-hover:text-brand-400 transition-colors" />
            </div>
            <div className="ml-4 flex-grow">
              <h3 className="text-slate-50 font-semibold mb-0.5">Continue as Tenant</h3>
              <p className="text-slate-400 text-xs">Browse listings and pay rent securely</p>
            </div>
          </button>

          <button 
            onClick={handleLandlordSignIn}
            className="w-full flex items-center p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/50 rounded-xl transition-all group text-left"
          >
            <div className="w-12 h-12 bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/10 group-hover:border-blue-500/30 transition-colors">
              <Building2 className="w-6 h-6 text-slate-400 group-hover:text-blue-400 transition-colors" />
            </div>
            <div className="ml-4 flex-grow">
              <h3 className="text-slate-50 font-semibold mb-0.5">Continue as Landlord</h3>
              <p className="text-slate-400 text-xs">Manage properties and view payouts</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
