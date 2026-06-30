'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './context/AuthContext';
import { Building2, Loader2, ArrowRight } from 'lucide-react';

export default function Home() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'admin') {
        router.push('/admin');
      } else if (user.role === 'landlord' || user.role === 'agent') {
        router.push('/landlord');
      } else {
        // User is a tenant - they shouldn't be in the dashboard
        // We could redirect them to the public site or show a message
        console.warn('User has tenant role and cannot access dashboard');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 max-w-md w-full text-center relative z-10 shadow-2xl shadow-slate-200/50">
          <div className="w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-500/30">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          
          <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tighter">Welcome Back</h1>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">
            Sign in to access the RentVault landlord and admin dashboard.
          </p>

           <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-black rounded-2xl shadow-lg shadow-brand-500/30 transition-all duration-200 active:scale-95 hover:scale-[1.02]"
            >
             Sign in with Google
             <ArrowRight className="w-4 h-4" />
           </button>
           
           <div className="mt-6 pt-6 border-t border-slate-100 text-xs text-slate-400">
             Secure authentication powered by Firebase
           </div>
        </div>
      </div>
    );
  }

  // Fallback while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
    </div>
  );
}
