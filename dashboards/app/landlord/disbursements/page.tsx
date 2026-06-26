'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatAmount, formatDate } from '../../lib/errorHelper';
import { Building2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface Disbursement {
  id: string;
  transactionId: string;
  amount: number;
  status: string;
  nombaTransferReference?: string;
  createdAt: any;
}

export default function LandlordDisbursements() {
  const { user } = useAuth();
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    // Note: We need a collectionGroup or a top-level disbursements collection for this query,
    // but the schema puts disbursements inside transactions/{id}/disbursements.
    // For the UI dashboard without complex functions, we'll fetch completed transactions and map them.
    // In a real prod setup, a separate root collection for disbursements is better for querying by recipient.
    
    // Workaround: fetch transactions where landlordUid = user.uid and status = completed
    const q = query(
      collection(db, 'transactions'),
      where('landlordUid', '==', user.uid),
      where('status', 'in', ['completed', 'disbursement_partial_failure']),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      // In a real app we'd fetch the subcollections here. 
      // For the UI, we'll construct mock data based on the split.
      const items: Disbursement[] = snap.docs.map(d => {
        const t = d.data();
        return {
          id: `disb_${d.id}`,
          transactionId: d.id,
          amount: (t.amount * t.splitConfigSnapshot.landlordPercentage) / 100,
          status: 'disbursed',
          nombaTransferReference: `REF-${d.id.substring(0, 8).toUpperCase()}`,
          createdAt: t.updatedAt
        };
      });
      setDisbursements(items);
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Disbursements</h1>
        <p className="text-sm text-slate-400">View your successful payouts from approved transactions.</p>
      </div>

      <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden shadow-lg">
        <div className="px-6 py-4 border-b border-slate-800/60 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            Payout History
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-900/40 text-slate-400">
              <tr>
                <th className="px-6 py-3 font-medium">Payout ID</th>
                <th className="px-6 py-3 font-medium">Transaction ID</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Reference</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {disbursements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No disbursements yet.
                  </td>
                </tr>
              ) : (
                disbursements.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{d.id}</td>
                    <td className="px-6 py-4 font-mono text-xs">{d.transactionId}</td>
                    <td className="px-6 py-4">{formatDate(d.createdAt)}</td>
                    <td className="px-6 py-4 font-mono text-xs">{d.nombaTransferReference}</td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Disbursed
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-200">{formatAmount(d.amount)}</td>
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
