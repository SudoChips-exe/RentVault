'use client';

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Save, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const { user, updateNombaAccount } = useAuth();
  const [accountId, setAccountId] = useState(user?.nombaAccountId || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-400">Configure your account for receiving escrow payouts.</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          Nomba Account ID saved successfully.
        </div>
      )}

      <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6 shadow-lg space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Nomba Account ID</label>
          <p className="text-xs text-slate-500 mb-3">
            Your Nomba account ID is used to receive escrow payouts when a tenant&apos;s rent is verified and disbursed.
          </p>
          <input
            type="text"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="Enter your Nomba Account ID"
            className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-white font-semibold rounded-xl transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
