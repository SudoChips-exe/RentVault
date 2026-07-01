'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatAmount, formatDate } from '../../lib/errorHelper';
import { Loader2, AlertCircle, FileText } from 'lucide-react';

interface Transaction {
  id: string;
  transactionReference: string;
  listingId: string;
  amount: number;
  status: string;
  createdAt: any;
}

export default function TenantPaymentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'tenant') {
      router.push('/');
      return;
    }
    const q = query(
      collection(db, 'transactions'),
      where('tenantUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)));
        setDataLoading(false);
      },
      (err) => {
        console.error('[TENANT_PAYMENTS] Firestore error:', err);
        setError('Unable to load payment history. Please refresh.');
        setDataLoading(false);
      }
    );
    return () => unsub();
  }, [user, authLoading, router]);

  if (authLoading || dataLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">My Payments</h1>
        <p className="text-slate-500 text-sm mt-1">Full history of your rent escrow transactions.</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        {transactions.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="font-bold text-slate-900">No payments yet</p>
            <p className="text-sm text-slate-500 mt-1">Your rent payments will appear here once you pay for a listing.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Reference</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Amount</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{t.transactionReference}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">{formatAmount(t.amount)}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold border bg-blue-50 text-blue-600 border-blue-100">
                        {t.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
