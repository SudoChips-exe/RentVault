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
    if (user.role !== 'landlord' && user.role !== 'agent' && user.role !== 'admin') {
      window.location.href = '/';
      return;
    }
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
      <div className="space-y-8 max-w-6xl mx-auto">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Overview</h1>
          <p className="text-slate-500 text-sm mt-1">Track your property transactions and payouts.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4 text-brand-600">
              <div className="p-2 bg-brand-50 rounded-xl"><Wallet className="w-5 h-5" /></div>
              <span className="font-bold text-sm">Total Disbursed</span>
            </div>
            <p className="text-3xl font-mono font-black text-slate-900">{formatAmount(totalEarned)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4 text-blue-600">
              <div className="p-2 bg-blue-50 rounded-xl"><Clock className="w-5 h-5" /></div>
              <span className="font-bold text-sm">Action Required</span>
            </div>
            <p className="text-3xl font-black text-slate-900">{pendingCount}</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">Transactions waiting for verification</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4 text-purple-600">
              <div className="p-2 bg-purple-50 rounded-xl"><CheckCircle2 className="w-5 h-5" /></div>
              <span className="font-bold text-sm">Completed</span>
            </div>
            <p className="text-3xl font-black text-slate-900">{completedCount}</p>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-500" />
              Recent Transactions
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Transaction ID</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Date</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Amount</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-slate-400 font-medium">
                      No transactions found.
                    </td>
                  </tr>
                ) : (
                  transactions.slice(0, 5).map((t) => {
                    const statusInfo = getStatusLabel(t.status);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{t.id}</td>
                        <td className="px-6 py-4">{formatDate(t.createdAt)}</td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">{formatAmount(t.amount)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${statusInfo.bg} ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {t.status === 'funds_held' ? (
                            <Link href="/landlord/verification" className="text-brand-600 hover:text-brand-700 font-bold text-xs underline underline-offset-4">
                              Upload Docs &rarr;
                            </Link>
                          ) : (
                            <span className="text-slate-300 text-xs">-</span>
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
