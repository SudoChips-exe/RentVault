'use client';

import { useState, useEffect } from 'react';
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
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  const fetchTransactions = async () => {
    try {
      const getTxs = httpsCallable<any, { transactions: Transaction[] }>(functions, 'adminListTransactions');
      const res = await getTxs();
      setTransactions(res.data.transactions);
      setError(null);
    } catch (err) {
      setError(parseFirebaseError(err).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin') {
      window.location.href = '/';
      return;
    }
    if (user?.role === 'admin') {
      fetchTransactions();
    }
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.status === filter);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">All Transactions</h1>
          <p className="text-sm text-slate-400">System-wide view of all rent payments and escrows.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden shadow-lg flex flex-col h-[70vh]">
        <div className="px-6 py-4 border-b border-slate-800/60 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search ID..."
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full sm:w-48 bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
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
            <thead className="bg-slate-900/40 text-slate-400 sticky top-0 z-10 backdrop-blur-xl">
              <tr>
                <th className="px-6 py-3 font-medium">Transaction ID</th>
                <th className="px-6 py-3 font-medium">Created</th>
                <th className="px-6 py-3 font-medium">Updated</th>
                <th className="px-6 py-3 font-medium text-right">Amount</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No transactions match the criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const statusInfo = getStatusLabel(t.status);
                  return (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs">{t.id}</td>
                      <td className="px-6 py-4">{formatDate(t.createdAt)}</td>
                      <td className="px-6 py-4">{formatDate(t.updatedAt)}</td>
                      <td className="px-6 py-4 text-right font-medium text-slate-200">{formatAmount(t.amount)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusInfo.bg} ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-3">
                        {t.status === 'verification_submitted' && (
                          <Link href={`/admin/verification?tx=${t.id}`} className="text-emerald-400 hover:text-emerald-300 font-medium text-xs">
                            Review &rarr;
                          </Link>
                        )}
                        {(t.status === 'verification_timeout' || t.status === 'verification_rejected') && (
                          <Link href={`/admin/refunds?tx=${t.id}`} className="text-orange-400 hover:text-orange-300 font-medium text-xs">
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
