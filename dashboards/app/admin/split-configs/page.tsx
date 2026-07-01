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
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  const sum = (parseInt(landlordPercentage) || 0) + (parseInt(agentPercentage) || 0) + (parseInt(platformPercentage) || 0);
  const sumValid = sum === 100;

    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Split Configurations</h1>
            <p className="text-slate-500 text-sm mt-1">Manage how escrow funds are split between landlord, agent, and platform.</p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setError(null); setSuccess(false); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-brand-500/20 active:scale-95 text-sm"
          >
            <Plus className="w-4 h-4" />
            New Config
          </button>
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
            Split configuration created successfully.
          </div>
        )}

        {showForm && (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
              <Settings className="w-5 h-5 text-brand-500" />
              New Split Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Config Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Standard 80/15/5"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                />
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Landlord (%)</label>
                  <input
                    type="number"
                    value={landlordPercentage}
                    onChange={(e) => setLandlordPercentage(e.target.value)}
                    placeholder="80"
                    min="0"
                    max="100"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Agent (%)</label>
                  <input
                    type="number"
                    value={agentPercentage}
                    onChange={(e) => setAgentPercentage(e.target.value)}
                    placeholder="15"
                    min="0"
                    max="100"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Platform (%)</label>
                  <input
                    type="number"
                    value={platformPercentage}
                    onChange={(e) => setPlatformPercentage(e.target.value)}
                    placeholder="5"
                    min="0"
                    max="100"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-colors ${
              sumValid
                ? 'bg-brand-50 border border-brand-100 text-brand-700'
                : 'bg-slate-50 border border-slate-200 text-slate-500'
            }`}>
              {sumValid
                ? <CheckCircle2 className="w-4 h-4" />
                : <AlertCircle className="w-4 h-4" />
              }
              <span>Total: <span className="font-mono">{sum}%</span> {sumValid ? '— ready to save' : '— must equal 100%'}</span>
            </div>

            <button
              onClick={handleCreate}
              disabled={saving || !name || !landlordPercentage || !platformPercentage}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black rounded-2xl transition-all active:scale-95 shadow-lg shadow-brand-500/20"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Creating...' : 'Create Config'}
            </button>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Name</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Landlord</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Agent</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Platform</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {configs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No split configurations yet. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  configs.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">{c.name}</td>
                      <td className="px-6 py-4 font-mono font-semibold">{c.landlordPercentage}%</td>
                      <td className="px-6 py-4 font-mono font-semibold">{c.agentPercentage}%</td>
                      <td className="px-6 py-4 font-mono font-semibold">{c.platformPercentage}%</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          c.status === 'active'
                            ? 'bg-brand-50 text-brand-600 border border-brand-100'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
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
