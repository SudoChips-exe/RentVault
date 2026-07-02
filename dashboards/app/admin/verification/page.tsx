'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { callApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { formatAmount, parseFirebaseError } from '../../lib/errorHelper';
import { BadgeCheck, Loader2, CheckCircle2, XCircle, FileText, ExternalLink, AlertCircle } from 'lucide-react';

interface TxReview {
  id: string;
  amount: number;
  verificationDocumentUrl: string;
  landlordUid: string;
}

import { Suspense } from 'react';

function AdminVerificationContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const defaultTx = searchParams.get('tx');
  
  const [queue, setQueue] = useState<TxReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<TxReview | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    const q = query(
      collection(db, 'transactions'),
      where('status', '==', 'verification_submitted'),
      orderBy('updatedAt', 'asc') // oldest first
    );

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as TxReview));
      setQueue(items);
      setLoading(false);
      
      // Auto-select
      if (defaultTx && !selectedTx) {
        const found = items.find(i => i.id === defaultTx);
        if (found) setSelectedTx(found);
      } else if (items.length > 0 && !selectedTx) {
        setSelectedTx(items[0]);
      } else if (items.length === 0) {
        setSelectedTx(null);
      }
    });

    return () => unsub();
  }, [user?.role, defaultTx]);

  const handleAction = async (approved: boolean) => {
    if (!selectedTx) return;
    setActionLoading(true);
    setError(null);
    try {
      if (approved) {
        await callApi('verificationApprove', { transactionId: selectedTx.id });
      } else {
        await callApi('verificationReject', { transactionId: selectedTx.id });
      }
      setSelectedTx(null);
    } catch (err) {
      setError(parseFirebaseError(err).message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      <div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Verification Review</h1>
        <p className="text-slate-500 text-sm mt-1">Review landlord documents to approve disbursements or trigger refunds.</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {queue.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-sm flex-1 flex flex-col justify-center">
          <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4">
            <BadgeCheck className="w-8 h-8 text-brand-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Queue Empty</h2>
          <p className="text-slate-500 mt-2 text-sm">No transactions currently pending admin review.</p>
        </div>
      ) : (
        <div className="flex gap-8 flex-1 min-h-0">
          {/* Sidebar list */}
          <div className="w-80 bg-white border border-slate-200 rounded-3xl overflow-y-auto shadow-sm">
            <div className="p-5 border-b border-slate-100 sticky top-0 bg-white/90 backdrop-blur-sm">
              <h3 className="font-bold text-slate-900 text-sm">Pending Review ({queue.length})</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {queue.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTx(t)}
                  className={`w-full text-left p-5 transition-all ${selectedTx?.id === t.id ? 'bg-brand-50 border-l-4 border-brand-500' : 'hover:bg-slate-50 border-l-4 border-transparent'}`}
                >
                  <p className="font-mono text-[10px] text-slate-400 mb-1">{t.id}</p>
                  <p className="font-black text-slate-900 text-lg">{formatAmount(t.amount)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Main review panel */}
          <div className="flex-1 bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col min-h-0">
            {selectedTx ? (
              <div className="flex flex-col h-full">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Review Document</h2>
                    <p className="text-sm text-slate-500 font-mono mt-1">TX: {selectedTx.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Escrow Amount</p>
                    <p className="text-2xl font-mono font-black text-slate-900">{formatAmount(selectedTx.amount)}</p>
                  </div>
                </div>

                <div className="flex-1 bg-slate-50 border border-slate-100 rounded-3xl mb-8 flex flex-col items-center justify-center p-12 text-center relative">
                  <FileText className="w-20 h-20 text-slate-300 mb-6" />
                  <p className="text-slate-600 font-bold mb-6">Landlord Verification Document</p>
                  <a
                    href={selectedTx.verificationDocumentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-8 py-4 bg-white border border-slate-200 hover:border-brand-500 text-slate-900 font-bold rounded-2xl transition-all shadow-sm hover:shadow-md"
                  >
                    View Document <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                <div className="flex gap-4 mt-auto">
                  <button
                    onClick={() => handleAction(false)}
                    disabled={actionLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-2xl font-bold transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
                    Reject & Refund
                  </button>
                  <button
                    onClick={() => handleAction(true)}
                    disabled={actionLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-black shadow-lg shadow-brand-500/30 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Approve & Disburse
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 font-medium">
                Select a transaction from the queue to review.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminVerification() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 text-brand-500 animate-spin" /></div>}>
      <AdminVerificationContent />
    </Suspense>
  );
}
