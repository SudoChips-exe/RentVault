'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { Plus, Loader2, AlertCircle, CheckCircle2, Settings } from 'lucide-react';

interface SplitConfig {
  id: string;
  name: string;
  landlordPercentage: number;
  agentPercentage: number;
  platformPercentage: number;
  status: string;
}

export default function SplitConfigsPage() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<SplitConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [landlordPercentage, setLandlordPercentage] = useState('');
  const [agentPercentage, setAgentPercentage] = useState('');
  const [platformPercentage, setPlatformPercentage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'splitConfigs'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setConfigs(snap.docs.map(d => ({ id: d.id, ...d.data() } as SplitConfig)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const validatePercentages = (): string | null => {
    const lp = parseInt(landlordPercentage);
    const ap = parseInt(agentPercentage || '0');
    const pp = parseInt(platformPercentage);
    if (isNaN(lp) || isNaN(pp)) return 'Landlord and Platform percentages are required.';
    if (lp + ap + pp !== 100) return `Percentages must sum to 100. Current sum: ${lp + ap + pp}.`;
    if (lp < 0 || ap < 0 || pp < 0) return 'Percentages cannot be negative.';
    return null;
  };

  const handleCreate = async () => {
    const validationError = validatePercentages();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await addDoc(collection(db, 'splitConfigs'), {
        name,
        landlordPercentage: parseInt(landlordPercentage),
        agentPercentage: parseInt(agentPercentage || '0'),
        platformPercentage: parseInt(platformPercentage),
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSuccess(true);
      setShowForm(false);
      setName('');
      setLandlordPercentage('');
      setAgentPercentage('');
      setPlatformPercentage('');
    } catch (err: any) {
      setError(err.message || 'Failed to create split config.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Split Configurations</h1>
          <p className="text-sm text-slate-400">Manage how escrow funds are split between landlord, agent, and platform.</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(null); setSuccess(false); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          New Config
        </button>
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
          Split configuration created successfully.
        </div>
      )}

      {showForm && (
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6 shadow-lg space-y-4">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-400" />
            New Split Configuration
          </h2>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Config Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard 80/15/5"
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Landlord (%)</label>
              <input
                type="number"
                value={landlordPercentage}
                onChange={(e) => setLandlordPercentage(e.target.value)}
                placeholder="80"
                min="0"
                max="100"
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Agent (%)</label>
              <input
                type="number"
                value={agentPercentage}
                onChange={(e) => setAgentPercentage(e.target.value)}
                placeholder="15"
                min="0"
                max="100"
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Platform (%)</label>
              <input
                type="number"
                value={platformPercentage}
                onChange={(e) => setPlatformPercentage(e.target.value)}
                placeholder="5"
                min="0"
                max="100"
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !name || !landlordPercentage || !platformPercentage}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-white font-semibold rounded-xl transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Creating...' : 'Create Config'}
          </button>
        </div>
      )}

      <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/40 text-slate-400">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Landlord</th>
                <th className="px-6 py-3 font-medium">Agent</th>
                <th className="px-6 py-3 font-medium">Platform</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {configs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No split configurations yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                configs.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-200">{c.name}</td>
                    <td className="px-6 py-4">{c.landlordPercentage}%</td>
                    <td className="px-6 py-4">{c.agentPercentage}%</td>
                    <td className="px-6 py-4">{c.platformPercentage}%</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider ${
                        c.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
