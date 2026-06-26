'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatAmount, parseFirebaseError, formatDate } from '../../lib/errorHelper';
import { RotateCcw, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface RefundableTx {
  id: string;
  amount: number;
  status: string;
  tenantUid: string;
  updatedAt: any;
}

import { Suspense } from 'react';

function AdminRefundsContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const defaultTx = searchParams.get('tx');

  const [queue, setQueue] = useState<RefundableTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    // Transactions needing manual refund initiation (e.g. timeout or rejection)
    const q = query(
      collection(db, 'transactions'),
      where('status', 'in', ['verification_rejected', 'verification_timeout']),
      orderBy('updatedAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setQueue(snap.docs.map(d => ({ id: d.id, ...d.data() } as RefundableTx)));
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  const handleRefund = async (id: string) => {
    setActionLoading(id);
    setError(null);
    try {
      const refund = httpsCallable<{ transactionId: string }, any>(functions, 'adminProcessRefund');
      await refund({ transactionId: id });
    } catch (err) {
      setError(parseFirebaseError(err).message);
    } finally {
      setActionLoading(null);
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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Manual Refunds</h1>
        <p className="text-sm text-slate-400">Process refunds for rejected or timed-out verifications.</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden shadow-lg">
        <div className="px-6 py-4 border-b border-slate-800/60 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-orange-400" />
            Refund Queue
          </h2>
          <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium">
            {queue.length} Pending
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-900/40 text-slate-400">
              <tr>
                <th className="px-6 py-3 font-medium">Transaction ID</th>
                <th className="px-6 py-3 font-medium">Amount</th>
                <th className="px-6 py-3 font-medium">Reason</th>
                <th className="px-6 py-3 font-medium">Last Updated</th>
                <th className="px-6 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {queue.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No pending refunds.
                  </td>
                </tr>
              ) : (
                queue.map((t) => (
                  <tr key={t.id} className={`hover:bg-slate-800/40 transition-colors ${defaultTx === t.id ? 'bg-slate-800/60' : ''}`}>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{t.id}</td>
                    <td className="px-6 py-4 font-bold text-slate-200">{formatAmount(t.amount)}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-semibold uppercase tracking-wider">
                        {t.status.replace('verification_', '')}
                      </span>
                    </td>
                    <td className="px-6 py-4">{formatDate(t.updatedAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRefund(t.id)}
                        disabled={actionLoading === t.id}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-slate-100 font-medium rounded-xl transition-colors disabled:opacity-50"
                      >
                        {actionLoading === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Process Refund
                      </button>
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

export default function AdminRefunds() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>}>
      <AdminRefundsContent />
    </Suspense>
  );
}
