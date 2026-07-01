'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { formatAmount, formatDate, getStatusLabel, parseFirebaseError } from '../lib/errorHelper';
import { LayoutDashboard, Loader2, RefreshCw, AlertCircle, Search } from 'lucide-react';
import Link from 'next/link';

interface Transaction {
  id: string;
  listingId: string;
  tenantUid: string;
  landlordUid: string;
  amount: number;
  status: string;
  createdAt: any;
  updatedAt: any;
}

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  const fetchTransactions = useCallback(async () => {
    try {
      const getTxs = httpsCallable<any, { transactions: Transaction[] }>(functions, 'getAllTransactions');
      const res = await getTxs();
      setTransactions(res.data.transactions);
      setError(null);
    } catch (err) {
      setError(parseFirebaseError(err).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') {
      router.push('/');
      return;
    }
    fetchTransactions();
  }, [user, authLoading, fetchTransactions, router]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.status === filter);

    return (
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">All Transactions</h1>
            <p className="text-slate-500 text-sm mt-1">System-wide view of all rent payments and escrows.</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-2xl transition-all shadow-sm disabled:opacity-50 active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col h-[75vh]">
          <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search transaction ID..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-9 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full sm:w-56 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            >
              <option value="all">All Statuses</option>
              <option value="pending_payment">Pending Payment</option>
              <option value="funds_held">Funds Held</option>
              <option value="verification_submitted">Review Pending</option>
              <option value="completed">Completed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Transaction ID</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Created</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Updated</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Amount</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-24 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="w-8 h-8 text-slate-300" />
                        <p className="text-slate-400 font-medium">No transactions match the criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => {
                    const statusInfo = getStatusLabel(t.status);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{t.id}</td>
                        <td className="px-6 py-4">{formatDate(t.createdAt)}</td>
                        <td className="px-6 py-4">{formatDate(t.updatedAt)}</td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">{formatAmount(t.amount)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${statusInfo.bg} ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-3">
                          {t.status === 'verification_submitted' && (
                            <Link href={`/admin/verification?tx=${t.id}`} className="text-brand-600 hover:text-brand-700 font-bold text-xs underline underline-offset-4">
                              Review &rarr;
                            </Link>
                          )}
                          {(t.status === 'verification_timeout' || t.status === 'verification_rejected') && (
                            <Link href={`/admin/refunds?tx=${t.id}`} className="text-orange-600 hover:text-orange-700 font-bold text-xs underline underline-offset-4">
                              Issue Refund &rarr;
                            </Link>
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
