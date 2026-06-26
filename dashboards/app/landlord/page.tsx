'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { formatAmount, formatDate, getStatusLabel } from '../lib/errorHelper';
import { Wallet, Clock, CheckCircle2, TrendingUp, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Transaction {
  id: string;
  amount: number;
  status: string;
  createdAt: any;
  listingId: string;
}

export default function LandlordDashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'transactions'),
      where('landlordUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  const pendingCount = transactions.filter(t => t.status === 'funds_held').length;
  const completedCount = transactions.filter(t => t.status === 'completed').length;
  const totalEarned = transactions
    .filter(t => t.status === 'completed')
    .reduce((acc, t) => acc + t.amount, 0); // Simplified calculation

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Overview</h1>
        <p className="text-sm text-slate-400">Track your property transactions and payouts.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-2 text-emerald-400">
            <div className="p-2 bg-emerald-500/10 rounded-lg"><Wallet className="w-5 h-5" /></div>
            <span className="font-semibold text-sm">Total Disbursed</span>
          </div>
          <p className="text-3xl font-extrabold text-slate-100">{formatAmount(totalEarned)}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-2 text-blue-400">
            <div className="p-2 bg-blue-500/10 rounded-lg"><Clock className="w-5 h-5" /></div>
            <span className="font-semibold text-sm">Action Required</span>
          </div>
          <p className="text-3xl font-extrabold text-slate-100">{pendingCount}</p>
          <p className="text-xs text-slate-500 mt-1">Transactions waiting for verification</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-2 text-purple-400">
            <div className="p-2 bg-purple-500/10 rounded-lg"><CheckCircle2 className="w-5 h-5" /></div>
            <span className="font-semibold text-sm">Completed</span>
          </div>
          <p className="text-3xl font-extrabold text-slate-100">{completedCount}</p>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden shadow-lg">
        <div className="px-6 py-4 border-b border-slate-800/60 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Recent Transactions
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-900/40 text-slate-400">
              <tr>
                <th className="px-6 py-3 font-medium">Transaction ID</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium text-right">Amount</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                transactions.slice(0, 5).map((t) => {
                  const statusInfo = getStatusLabel(t.status);
                  return (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs">{t.id}</td>
                      <td className="px-6 py-4">{formatDate(t.createdAt)}</td>
                      <td className="px-6 py-4 text-right font-medium text-slate-200">{formatAmount(t.amount)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusInfo.bg} ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {t.status === 'funds_held' ? (
                          <Link href="/landlord/verification" className="text-emerald-400 hover:text-emerald-300 font-medium text-xs">
                            Upload Docs &rarr;
                          </Link>
                        ) : (
                          <span className="text-slate-600 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
