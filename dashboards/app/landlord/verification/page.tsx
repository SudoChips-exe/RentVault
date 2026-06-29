'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../../lib/firebase';
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
      const storageRef = ref(storage, `verifications/${selectedTx}_${Date.now()}.${ext}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(p);
        },
        (err) => {
          console.error('Upload failed:', err);
          setError('Failed to upload file to storage.');
          setUploading(false);
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          
          // 2. Call Function
          const submitVerification = httpsCallable<{ transactionId: string, documentUrl: string }, any>(
            functions,
            'verificationSubmit'
          );
          
          try {
            await submitVerification({ transactionId: selectedTx, documentUrl: downloadUrl });
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
        }
      );
    } catch (err: any) {
      setError('An unexpected error occurred.');
      setUploading(false);
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
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Submit Verification</h1>
        <p className="text-sm text-slate-400">Upload property documents to claim escrowed funds.</p>
      </div>

      {pendingTx.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-12 text-center shadow-lg">
          <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-200">You're all caught up!</h2>
          <p className="text-slate-400 mt-2 text-sm">There are no pending transactions requiring verification at this time.</p>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6 shadow-lg space-y-6">
          
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              Verification submitted successfully. An admin will review it shortly.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Select Transaction</label>
            <select
              value={selectedTx}
              onChange={(e) => setSelectedTx(e.target.value)}
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
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

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Upload Document</label>
            <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-xl p-8 transition-colors text-center bg-slate-800/30">
              {file ? (
                <div className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-slate-700">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span className="text-sm text-slate-300 truncate">{file.name}</span>
                  </div>
                  <button onClick={() => setFile(null)} disabled={uploading} className="p-1 hover:bg-slate-700 rounded-md">
                    <X className="w-4 h-4 text-slate-400 hover:text-red-400" />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center">
                  <Upload className="w-8 h-8 text-slate-500 mb-3" />
                  <span className="text-sm text-slate-300 font-medium bg-slate-800 px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors">Select File</span>
                  <span className="text-xs text-slate-500 mt-2">PDF, JPG, PNG up to 5MB</span>
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
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-white font-semibold rounded-xl transition-colors relative overflow-hidden"
          >
            {uploading ? (
              <>
                <div className="absolute left-0 top-0 bottom-0 bg-emerald-400/30" style={{ width: `${progress}%` }} />
                <Loader2 className="w-4 h-4 animate-spin relative z-10" />
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
