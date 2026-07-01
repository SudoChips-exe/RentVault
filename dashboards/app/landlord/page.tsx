'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { formatAmount, formatDate, getStatusLabel } from '../lib/errorHelper';
import { Wallet, Clock, CheckCircle2, TrendingUp, Loader2, ChevronRight, Home, BadgeCheck } from 'lucide-react';
import Link from 'next/link';

interface Transaction {
  id: string;
  amount: number;
  status: string;
  createdAt: any;
  listingId: string;
}

export default function LandlordDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

    useEffect(() => {
      if (authLoading) return;
      if (!user || (user.role !== 'landlord' && user.role !== 'agent')) {
        router.push('/');
        return;
      }

    const q = query(
      collection(db, 'transactions'),
      where('landlordUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      setDataLoading(false);
    });

    return () => unsub();
  }, [user, authLoading, router]);

  if (authLoading || dataLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  const pendingCount = transactions.filter(t => t.status === 'funds_held').length;
  const completedCount = transactions.filter(t => t.status === 'completed').length;
  const totalEarned = transactions
    .filter(t => t.status === 'completed')
    .reduce((acc, t) => acc + t.amount, 0); // Simplified calculation

    return (
      <div className="space-y-8 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div>
          <h1 className="text-4xl font-black text-slate-100 tracking-tighter">Overview</h1>
          <p className="text-slate-400 text-sm mt-1">Track your property transactions and payouts.</p>
        </div>
 
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4 text-nomba-500">
              <div className="p-2 bg-nomba-500/10 rounded-xl"><Wallet className="w-5 h-5" /></div>
              <span className="font-bold text-sm">Total Disbursed</span>
            </div>
            <p className="text-3xl font-mono font-black text-slate-100">{formatAmount(totalEarned)}</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4 text-blue-400">
              <div className="p-2 bg-blue-400/10 rounded-xl"><Clock className="w-5 h-5" /></div>
              <span className="font-bold text-sm">Action Required</span>
            </div>
            <p className="text-3xl font-black text-slate-100">{pendingCount}</p>
            <p className="text-xs text-slate-500 mt-1 font-medium">Transactions waiting for verification</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4 text-emerald-400">
              <div className="p-2 bg-emerald-400/10 rounded-xl"><CheckCircle2 className="w-5 h-5" /></div>
              <span className="font-bold text-sm">Completed</span>
            </div>
            <p className="text-3xl font-black text-slate-100">{completedCount}</p>
          </div>
        </div>
 
        {/* Recent Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-sm backdrop-blur-sm">
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-500" />
                Recent Transactions
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-800/50 text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Transaction ID</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Date</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Amount</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-slate-500 font-medium">
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    transactions.slice(0, 5).map((t) => {
                      const statusInfo = getStatusLabel(t.status);
                      return (
                        <tr key={t.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs text-slate-500">{t.id}</td>
                          <td className="px-6 py-4">{formatDate(t.createdAt)}</td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-slate-100">{formatAmount(t.amount)}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${statusInfo.bg} ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {t.status === 'funds_held' ? (
                              <Link href="/landlord/verification" className="text-brand-400 hover:text-brand-300 font-bold text-xs underline underline-offset-4">
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
 
          {/* Quick Actions */}
          <div className="space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-sm backdrop-blur-sm">
              <h3 className="text-lg font-bold text-slate-100 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link 
                  href="/landlord/listings" 
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-500/10 rounded-lg"><Home className="w-4 h-4 text-brand-500" /></div>
                    <span className="text-xs font-bold text-slate-300">Manage Listings</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link 
                  href="/landlord/disbursements" 
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-nomba-500/10 rounded-lg"><Wallet className="w-4 h-4 text-nomba-500" /></div>
                    <span className="text-xs font-bold text-slate-300">Payout History</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link 
                  href="/landlord/verification" 
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg"><BadgeCheck className="w-4 h-4 text-blue-500" /></div>
                    <span className="text-xs font-bold text-slate-300">Verify Account</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
 
            <div className="bg-brand-500 rounded-3xl p-6 text-white shadow-xl shadow-brand-500/20">
              <h3 className="text-lg font-bold mb-2">Pro Tip</h3>
              <p className="text-brand-100 text-xs leading-relaxed">
                Complete your verification to enable automatic disbursements and faster payouts.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
