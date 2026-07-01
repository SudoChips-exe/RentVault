import React from 'react';
import { Building2, Home, X, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}
 
export const SignInModal: React.FC<SignInModalProps> = ({ isOpen, onClose }) => {
  const { signingIn } = useAuth();

  if (!isOpen) return null;

  const handleTenantSignIn = () => {
    // Redirect to the Next.js dashboard portal, where the tenant dashboard
    // (escrow balance, payments, properties) lives and Tenant Auth is handled.
    const dashboardUrl = import.meta.env.VITE_DASHBOARD_URL || 'http://localhost:3000';
    window.location.href = `${dashboardUrl}/tenant`;
  };

  const handleLandlordSignIn = () => {
    // Redirect to Next.js dashboard portal where Landlord Auth is handled
    const dashboardUrl = import.meta.env.VITE_DASHBOARD_URL || 'http://localhost:3000';
    window.location.href = dashboardUrl;
  };
 
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" 
        onClick={onClose} 
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-8 sm:p-12 overflow-hidden transform transition-all">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-500 text-white mb-6 shadow-xl shadow-brand-500/20">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-3 leading-none">Welcome to RentVault</h2>
          <p className="text-slate-500 text-sm leading-relaxed max-w-[280px] mx-auto">
            The gold standard for secure rentals. <br />
            Choose your account type to continue.
          </p>
        </div>

        <div className="space-y-4">
            <button
              onClick={handleTenantSignIn}
              disabled={signingIn}
              className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-white hover:bg-slate-50 border border-slate-200 hover:border-brand-500 rounded-2xl transition-all group text-left shadow-sm hover:shadow-md disabled:opacity-70"
            >
              {signingIn ? (
                <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
              ) : (
                <>
                  <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:border-brand-500 group-hover:text-brand-500 transition-colors text-slate-400">
                    <Home className="w-6 h-6" />
                  </div>
                  <div className="ml-4 flex-grow">
                    <h3 className="text-slate-900 font-bold mb-0.5">Continue as Tenant</h3>
                    <p className="text-slate-500 text-xs">Browse listings and pay rent securely</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-5 h-5 text-brand-500" />
                  </div>
                </>
              )}
            </button>

            <button 
              onClick={handleLandlordSignIn}
              disabled={signingIn}
              className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-white hover:bg-slate-50 border border-slate-200 hover:border-nomba-500 rounded-2xl transition-all group text-left shadow-sm hover:shadow-md disabled:opacity-70"
            >
              {signingIn ? (
                <Loader2 className="w-5 h-5 animate-spin text-nomba-500" />
              ) : (
                <>
                  <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:border-nomba-500 group-hover:text-nomba-600 transition-colors text-slate-400">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className="ml-4 flex-grow">
                    <h3 className="text-slate-900 font-bold mb-0.5">Continue as Landlord</h3>
                    <p className="text-slate-500 text-xs">Manage properties and view payouts</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-5 h-5 text-nomba-600" />
                  </div>
                </>
              )}
            </button>
        </div>

        <div className="mt-10 pt-8 border-t border-slate-100 text-center">
          <p className="text-slate-400 text-xs">
            Secure authentication powered by <span className="font-bold text-slate-600">Google</span>
          </p>
        </div>
      </div>
    </div>
  );
};

