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
      const refund = httpsCallable<{ transactionId: string }, any>(functions, 'manualRefund');
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
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Manual Refunds</h1>
        <p className="text-slate-500 text-sm mt-1">Process refunds for rejected or timed-out verifications.</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-orange-500" />
            Refund Queue
          </h2>
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
            {queue.length} Pending
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Transaction ID</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Amount</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Reason</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Last Updated</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {queue.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-slate-400 font-medium">
                    No pending refunds.
                  </td>
                </tr>
              ) : (
                queue.map((t) => (
                  <tr key={t.id} className={`hover:bg-slate-50 transition-colors ${defaultTx === t.id ? 'bg-brand-50/50' : ''}`}>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{t.id}</td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">{formatAmount(t.amount)}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-100 text-[10px] font-bold uppercase tracking-wider">
                        {t.status.replace('verification_', '')}
                      </span>
                    </td>
                    <td className="px-6 py-4">{formatDate(t.updatedAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRefund(t.id)}
                        disabled={actionLoading === t.id}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-orange-500 hover:text-orange-600 text-slate-700 font-bold rounded-xl transition-all disabled:opacity-50 active:scale-95 shadow-sm"
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
