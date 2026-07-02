'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { callApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { parseFirebaseError } from '../../lib/errorHelper';
import { ShieldCheck, Loader2, CheckCircle2, XCircle, FileText, ExternalLink, AlertCircle } from 'lucide-react';

interface TenantReview {
  uid: string;
  displayName: string;
  email: string;
  verificationDocuments?: {
    idDocumentUrl?: string;
    incomeProofUrl?: string;
  };
}

export default function AdminTenantVerificationPage() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<TenantReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TenantReview | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    const q = query(
      collection(db, 'users'),
      where('verificationStatus', '==', 'pending'),
      orderBy('verificationSubmittedAt', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as TenantReview));
      setQueue(items);
      setLoading(false);

      if (items.length > 0 && !selected) {
        setSelected(items[0]);
      } else if (items.length === 0) {
        setSelected(null);
      }
    });

    return () => unsub();
  }, [user?.role, selected]);

  const handleApprove = async () => {
    if (!selected) return;
    setActionLoading(true);
    setError(null);
    try {
      await callApi('tenantVerificationApprove', { uid: selected.uid });
      setSelected(null);
    } catch (err) {
      setError(parseFirebaseError(err).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    setActionLoading(true);
    setError(null);
    try {
      await callApi('tenantVerificationReject', { uid: selected.uid, reason: rejectReason || 'Not specified' });
      setSelected(null);
      setShowRejectForm(false);
      setRejectReason('');
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
    <div className="space-y-8 max-w-5xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      <div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Tenant Verification</h1>
        <p className="text-slate-500 text-sm mt-1">Review tenant ID and income documents before they can rent.</p>
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
            <ShieldCheck className="w-8 h-8 text-brand-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Queue Empty</h2>
          <p className="text-slate-500 mt-2 text-sm">No tenant verifications currently pending review.</p>
        </div>
      ) : (
        <div className="flex gap-8 flex-1 min-h-0">
          {/* Sidebar list */}
          <div className="w-80 bg-white border border-slate-200 rounded-3xl overflow-y-auto shadow-sm">
            <div className="p-5 border-b border-slate-100 sticky top-0 bg-white/90 backdrop-blur-sm">
              <h3 className="font-bold text-slate-900 text-sm">Pending Review ({queue.length})</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {queue.map((t) => (
                <button
                  key={t.uid}
                  onClick={() => { setSelected(t); setShowRejectForm(false); }}
                  className={`w-full text-left p-5 transition-all ${selected?.uid === t.uid ? 'bg-brand-50 border-l-4 border-brand-500' : 'hover:bg-slate-50 border-l-4 border-transparent'}`}
                >
                  <p className="font-black text-slate-900">{t.displayName}</p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{t.email}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Main review panel */}
          <div className="flex-1 bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col min-h-0">
            {selected ? (
              <div className="flex flex-col h-full">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter">{selected.displayName}</h2>
                    <p className="text-sm text-slate-500 mt-1">{selected.email}</p>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <DocumentCard label="Government ID" url={selected.verificationDocuments?.idDocumentUrl} />
                  <DocumentCard label="Proof of Income" url={selected.verificationDocuments?.incomeProofUrl} />
                </div>

                {showRejectForm ? (
                  <div className="space-y-4 mt-auto">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection (shown to the tenant)"
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-sm"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowRejectForm(false)}
                        className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={actionLoading}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold transition-colors disabled:opacity-50"
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Confirm Rejection
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-4 mt-auto">
                    <button
                      onClick={() => setShowRejectForm(true)}
                      disabled={actionLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-2xl font-bold transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-5 h-5" />
                      Reject
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={actionLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-black shadow-lg shadow-brand-500/30 transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                      Approve
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 font-medium">
                Select a tenant from the queue to review.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentCard({ label, url }: { label: string; url?: string }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
      <FileText className="w-10 h-10 text-slate-300 mb-4" />
      <p className="text-slate-600 font-bold text-sm mb-4">{label}</p>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-brand-500 text-slate-900 font-bold text-xs rounded-xl transition-all shadow-sm hover:shadow-md"
        >
          View <ExternalLink className="w-3.5 h-3.5" />
        </a>
      ) : (
        <span className="text-xs text-slate-400">Not provided</span>
      )}
    </div>
  );
}
