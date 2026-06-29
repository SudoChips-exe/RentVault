'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase';
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
  }, [user, defaultTx, selectedTx]);

  const handleAction = async (approved: boolean) => {
    if (!selectedTx) return;
    setActionLoading(true);
    setError(null);
    try {
      if (approved) {
        const approve = httpsCallable<{ transactionId: string }, any>(functions, 'verificationApprove');
        await approve({ transactionId: selectedTx.id });
      } else {
        const reject = httpsCallable<{ transactionId: string }, any>(functions, 'verificationReject');
        await reject({ transactionId: selectedTx.id });
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
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Verification Review</h1>
        <p className="text-sm text-slate-400">Review landlord documents to approve disbursements or trigger refunds.</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {queue.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-12 text-center shadow-lg flex-1 flex flex-col justify-center">
          <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center mx-auto mb-4">
            <BadgeCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-200">Queue Empty</h2>
          <p className="text-slate-400 mt-2 text-sm">No transactions currently pending admin review.</p>
        </div>
      ) : (
        <div className="flex gap-6 flex-1 min-h-0">
          {/* Sidebar list */}
          <div className="w-72 bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-y-auto shadow-lg">
            <div className="p-4 border-b border-slate-800/60 sticky top-0 bg-slate-900/90 backdrop-blur">
              <h3 className="font-semibold text-slate-200 text-sm">Pending Review ({queue.length})</h3>
            </div>
            <div className="divide-y divide-slate-800/60">
              {queue.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTx(t)}
                  className={`w-full text-left p-4 transition-colors ${selectedTx?.id === t.id ? 'bg-emerald-500/10 border-l-2 border-emerald-500' : 'hover:bg-slate-800/40 border-l-2 border-transparent'}`}
                >
                  <p className="font-mono text-xs text-slate-400 mb-1">{t.id}</p>
                  <p className="font-bold text-slate-200">{formatAmount(t.amount)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Main review panel */}
          <div className="flex-1 bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6 shadow-lg flex flex-col min-h-0">
            {selectedTx ? (
              <div className="flex flex-col h-full">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">Review Document</h2>
                    <p className="text-sm text-slate-400 font-mono mt-1">TX: {selectedTx.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Escrow Amount</p>
                    <p className="text-xl font-extrabold text-emerald-400">{formatAmount(selectedTx.amount)}</p>
                  </div>
                </div>

                <div className="flex-1 bg-slate-800/40 border border-slate-700/60 rounded-xl mb-6 flex flex-col items-center justify-center p-8 text-center relative">
                  <FileText className="w-16 h-16 text-slate-500 mb-4" />
                  <p className="text-slate-300 font-medium mb-4">Document uploaded by Landlord</p>
                  <a
                    href={selectedTx.verificationDocumentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-colors"
                  >
                    View Document <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                <div className="flex gap-4 mt-auto">
                  <button
                    onClick={() => handleAction(false)}
                    disabled={actionLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl font-semibold transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
                    Reject & Refund
                  </button>
                  <button
                    onClick={() => handleAction(true)}
                    disabled={actionLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/30 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Approve & Disburse
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500">
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
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>}>
      <AdminVerificationContent />
    </Suspense>
  );
}
