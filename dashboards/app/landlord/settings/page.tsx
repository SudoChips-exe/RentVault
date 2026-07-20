'use client';

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Save, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const { user, updateNombaAccount, updateMonnifyPayoutAccount } = useAuth();
  const [accountId, setAccountId] = useState(user?.nombaAccountId || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [monnifyAccountNumber, setMonnifyAccountNumber] = useState(user?.monnifyPayoutAccount?.accountNumber || '');
  const [monnifyBankCode, setMonnifyBankCode] = useState(user?.monnifyPayoutAccount?.bankCode || '');
  const [monnifyAccountName, setMonnifyAccountName] = useState(user?.monnifyPayoutAccount?.accountName || '');
  const [monnifySaving, setMonnifySaving] = useState(false);
  const [monnifyError, setMonnifyError] = useState<string | null>(null);
  const [monnifySuccess, setMonnifySuccess] = useState(false);

  const handleSave = async () => {
    if (!accountId.trim()) {
      setError('Please enter a Nomba Account ID.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateNombaAccount(accountId.trim());
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to save Nomba Account ID.');
    } finally {
      setSaving(false);
    }
  };

  const handleMonnifySave = async () => {
    if (!monnifyAccountNumber.trim() || !monnifyBankCode.trim() || !monnifyAccountName.trim()) {
      setMonnifyError('Please fill in account number, bank code, and account name.');
      return;
    }
    setMonnifySaving(true);
    setMonnifyError(null);
    setMonnifySuccess(false);
    try {
      await updateMonnifyPayoutAccount({
        accountNumber: monnifyAccountNumber.trim(),
        bankCode: monnifyBankCode.trim(),
        accountName: monnifyAccountName.trim(),
      });
      setMonnifySuccess(true);
    } catch (err: any) {
      setMonnifyError(err.message || 'Failed to save Monnify payout account.');
    } finally {
      setMonnifySaving(false);
    }
  };

    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Settings</h1>
          <p className="text-slate-500 text-sm mt-1">Configure your account for receiving escrow payouts.</p>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 p-4 bg-brand-50 border border-brand-100 rounded-2xl text-brand-700 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            Nomba Account ID saved successfully.
          </div>
        )}

        {!user?.nombaAccountId && (
          <div className="flex items-start gap-3 p-4 bg-nomba-500/10 border border-nomba-500/30 rounded-2xl text-slate-800">
            <AlertCircle className="w-5 h-5 text-nomba-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Action required — your Nomba account ID is not set</p>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Without it, your share of any disbursed rent payment cannot be sent to you. Add it now before any tenant pays rent on your listings.
              </p>
            </div>
          </div>
        )}

        {user?.nombaAccountId && (
          <div className="flex items-center gap-3 p-4 bg-brand-50 border border-brand-100 rounded-2xl text-brand-700 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            Nomba account connected — you'll receive automatic payouts on verified transactions.
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-8">
          <div className="space-y-4">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nomba Account ID</label>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your Nomba account ID is used to receive escrow payouts when a tenant&apos;s rent is verified and disbursed.
            </p>
            <input
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="Enter your Nomba Account ID"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono font-bold"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black rounded-2xl transition-all active:scale-95 shadow-lg shadow-brand-500/20"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {monnifyError && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {monnifyError}
          </div>
        )}

        {monnifySuccess && (
          <div className="flex items-start gap-3 p-4 bg-brand-50 border border-brand-100 rounded-2xl text-brand-700 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            Monnify payout account saved successfully.
          </div>
        )}

        {!user?.monnifyPayoutAccount && (
          <div className="flex items-start gap-3 p-4 bg-nomba-500/10 border border-nomba-500/30 rounded-2xl text-slate-800">
            <AlertCircle className="w-5 h-5 text-nomba-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Action required — your Monnify payout account is not set</p>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Without it, your share of any rent paid via Monnify cannot be sent to you. Add it now before any tenant pays with Monnify on your listings.
              </p>
            </div>
          </div>
        )}

        {user?.monnifyPayoutAccount && (
          <div className="flex items-center gap-3 p-4 bg-brand-50 border border-brand-100 rounded-2xl text-brand-700 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            Monnify payout account connected — you'll receive automatic payouts on verified transactions.
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-8">
          <div className="space-y-4">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monnify Payout Account</label>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your Monnify payout account is used to receive escrow payouts when a tenant&apos;s rent is paid via Monnify, verified and disbursed.
            </p>
            <input
              type="text"
              value={monnifyAccountNumber}
              onChange={(e) => setMonnifyAccountNumber(e.target.value)}
              placeholder="Account number"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono font-bold"
            />
            <input
              type="text"
              value={monnifyBankCode}
              onChange={(e) => setMonnifyBankCode(e.target.value)}
              placeholder="Bank code (e.g. 058)"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono font-bold"
            />
            <input
              type="text"
              value={monnifyAccountName}
              onChange={(e) => setMonnifyAccountName(e.target.value)}
              placeholder="Account name"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono font-bold"
            />
          </div>

          <button
            onClick={handleMonnifySave}
            disabled={monnifySaving}
            className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black rounded-2xl transition-all active:scale-95 shadow-lg shadow-brand-500/20"
          >
            {monnifySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {monnifySaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  }
