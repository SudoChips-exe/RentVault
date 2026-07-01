'use client';

import { useAuth } from '../../context/AuthContext';
import { User, Mail, ShieldCheck, Lock } from 'lucide-react';

export default function TenantSettingsPage() {
  const { user, firebaseUser } = useAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Your RentVault account details.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          {firebaseUser?.photoURL ? (
            <img src={firebaseUser.photoURL} alt="" className="w-14 h-14 rounded-full border border-slate-200" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-brand-500 flex items-center justify-center">
              <User className="w-7 h-7 text-white" />
            </div>
          )}
          <div>
            <p className="font-black text-slate-900 text-lg">{user?.displayName}</p>
            <p className="text-slate-500 text-sm flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              {user?.email}
            </p>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Account Type</label>
          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
            <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-blue-700 capitalize">{user?.role}</p>
              <p className="text-xs text-blue-600/80 mt-0.5">Your account type is set once at sign-up and cannot be changed.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 text-xs font-medium">
        <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
        For security, RentVault permanently locks each account to a single role (tenant, landlord, agent, or admin). Contact support if this was set up in error.
      </div>
    </div>
  );
}
