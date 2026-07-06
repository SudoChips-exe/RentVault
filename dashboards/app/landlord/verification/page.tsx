'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { uploadDocument } from '../../lib/supabase';
import { db } from '../../lib/firebase';
import { callApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { formatAmount, parseFirebaseError, formatCountdown } from '../../lib/errorHelper';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';

interface PendingTx {
  id: string;
  amount: number;
  verificationDeadline: any;
  listingId: string;
}

export default function VerificationPage() {
  const { user } = useAuth();
  const [pendingTx, setPendingTx] = useState<PendingTx[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedTx, setSelectedTx] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'transactions'),
      where('landlordUid', '==', user.uid),
      where('status', '==', 'funds_held'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setPendingTx(snap.docs.map(d => ({ id: d.id, ...d.data() } as PendingTx)));
      setLoading(false);
      if (snap.docs.length > 0 && !selectedTx) {
        setSelectedTx(snap.docs[0].id);
      }
    });

    return () => unsub();
  }, [user, selectedTx]);

  const handleUpload = async () => {
    if (!file || !selectedTx) return;
    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      // 1. Upload to Storage
      const ext = file.name.split('.').pop();
      setProgress(10);
      const downloadUrl = await uploadDocument(file, `verifications/${selectedTx}_${Date.now()}.${ext}`);
      setProgress(100);

      try {
        await callApi('verificationSubmit', { transactionId: selectedTx, documentUrl: downloadUrl });
        setSuccess(true);
        setFile(null);
        setProgress(0);
        setSelectedTx('');
      } catch (fnErr) {
        const parsed = parseFirebaseError(fnErr);
        setError(parsed.message);
      } finally {
        setUploading(false);
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError('Failed to upload file to storage.');
      setUploading(false);
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
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Submit Verification</h1>
          <p className="text-slate-500 text-sm mt-1">Upload property documents to claim escrowed funds.</p>
        </div>

        {pendingTx.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-brand-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">You're all caught up!</h2>
            <p className="text-slate-500 mt-2 text-sm">There are no pending transactions requiring verification at this time.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-8">
            
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-start gap-3 p-4 bg-brand-50 border border-brand-100 rounded-2xl text-brand-700 text-sm font-medium">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                Verification submitted successfully. An admin will review it shortly.
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Transaction</label>
              <select
                value={selectedTx}
                onChange={(e) => setSelectedTx(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium"
              >
                <option value="" disabled>Select a pending transaction...</option>
                {pendingTx.map(t => {
                  const cd = formatCountdown(t.verificationDeadline);
                  return (
                    <option key={t.id} value={t.id}>
                      {t.id} - {formatAmount(t.amount)} ({cd.text})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Upload Document</label>
              <div className="border-2 border-dashed border-slate-200 hover:border-brand-500/50 rounded-3xl p-10 transition-colors text-center bg-slate-50">
                {file ? (
                  <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileText className="w-5 h-5 text-brand-500 flex-shrink-0" />
                      <span className="text-sm text-slate-700 font-medium truncate">{file.name}</span>
                    </div>
                    <button onClick={() => setFile(null)} disabled={uploading} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                      <X className="w-4 h-4 text-slate-400 hover:text-red-500" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-3 shadow-sm">
                      <Upload className="w-6 h-6 text-slate-400" />
                    </div>
                    <span className="text-sm text-slate-700 font-bold">Select File</span>
                    <span className="text-xs text-slate-400 mt-1">PDF, JPG, PNG up to 5MB</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </label>
                )}
              </div>
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || !selectedTx || uploading}
              className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black rounded-2xl transition-all active:scale-95 shadow-lg shadow-brand-500/30 relative overflow-hidden"
            >
              {uploading ? (
                <>
                  <div className="absolute left-0 top-0 bottom-0 bg-brand-400/30 transition-all duration-300" style={{ width: `${progress}%` }} />
                  <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                  <span className="relative z-10">Uploading {Math.round(progress)}%</span>
                </>
              ) : (
                'Submit Verification'
              )}
            </button>
          </div>
        )}
      </div>
    );
  }
