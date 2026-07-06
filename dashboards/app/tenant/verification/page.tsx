'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadDocument } from '../../lib/supabase';
import { callApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { parseFirebaseError } from '../../lib/errorHelper';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X, Clock, XCircle, ShieldCheck } from 'lucide-react';

// Supabase's client doesn't expose byte-level upload progress the way
// Firebase's uploadBytesResumable did, so this is a rough two-phase
// indicator (uploading vs finalizing) rather than a real progress percentage.
async function uploadFile(file: File, path: string, onProgress: (pct: number) => void): Promise<string> {
  onProgress(10);
  const url = await uploadDocument(file, path);
  onProgress(100);
  return url;
}

export default function TenantVerificationPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [idFile, setIdFile] = useState<File | null>(null);
  const [incomeFile, setIncomeFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== 'tenant') {
    router.push('/');
    return null;
  }

  const status = success ? 'pending' : user.verificationStatus || 'unverified';

  const handleSubmit = async () => {
    if (!idFile || !incomeFile) return;
    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const idExt = idFile.name.split('.').pop();
      const incomeExt = incomeFile.name.split('.').pop();

      const idDocumentUrl = await uploadFile(
        idFile,
        `tenant-verification/${user.uid}/id-${Date.now()}.${idExt}`,
        (p) => setProgress(p * 0.5)
      );
      const incomeProofUrl = await uploadFile(
        incomeFile,
        `tenant-verification/${user.uid}/income-${Date.now()}.${incomeExt}`,
        (p) => setProgress(50 + p * 0.5)
      );

      await callApi('tenantVerificationSubmit', { idDocumentUrl, incomeProofUrl });
      setSuccess(true);
    } catch (err) {
      setError(parseFirebaseError(err).message);
    } finally {
      setUploading(false);
    }
  };

  if (status === 'approved') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-brand-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter">You&apos;re verified</h2>
          <p className="text-slate-500 mt-2 text-sm">Your identity and income documents have been approved. You&apos;re all set to rent.</p>
        </div>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-blue-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Under review</h2>
          <p className="text-slate-500 mt-2 text-sm">Your documents were submitted and are awaiting admin review. This usually takes 24-48 hours.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Get Verified</h1>
        <p className="text-slate-500 text-sm mt-1">Upload your ID and proof of income to rent through RentVault.</p>
      </div>

      {status === 'rejected' && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-bold">Your previous submission was rejected.</p>
            {user.verificationRejectionReason && <p className="mt-1 text-red-500">{user.verificationRejectionReason}</p>}
            <p className="mt-1">Please re-upload valid documents below.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-8">
        <FileUploadField
          label="Government ID"
          hint="Passport, driver's license, or national ID card"
          file={idFile}
          onChange={setIdFile}
          disabled={uploading}
        />

        <FileUploadField
          label="Proof of Income"
          hint="Recent payslip, employment letter, or bank statement"
          file={incomeFile}
          onChange={setIncomeFile}
          disabled={uploading}
        />

        <button
          onClick={handleSubmit}
          disabled={!idFile || !incomeFile || uploading}
          className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black rounded-2xl transition-all active:scale-95 shadow-lg shadow-brand-500/30 relative overflow-hidden"
        >
          {uploading ? (
            <>
              <div className="absolute left-0 top-0 bottom-0 bg-brand-400/30 transition-all duration-300" style={{ width: `${progress}%` }} />
              <Loader2 className="w-5 h-5 animate-spin relative z-10" />
              <span className="relative z-10">Uploading {Math.round(progress)}%</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Submit for Review
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function FileUploadField({
  label,
  hint,
  file,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  file: File | null;
  onChange: (f: File | null) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</label>
      <div className="border-2 border-dashed border-slate-200 hover:border-brand-500/50 rounded-3xl p-8 transition-colors text-center bg-slate-50">
        {file ? (
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 overflow-hidden">
              <FileText className="w-5 h-5 text-brand-500 flex-shrink-0" />
              <span className="text-sm text-slate-700 font-medium truncate">{file.name}</span>
            </div>
            <button onClick={() => onChange(null)} disabled={disabled} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
              <X className="w-4 h-4 text-slate-400 hover:text-red-500" />
            </button>
          </div>
        ) : (
          <label className="cursor-pointer flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-3 shadow-sm">
              <Upload className="w-6 h-6 text-slate-400" />
            </div>
            <span className="text-sm text-slate-700 font-bold">Select File</span>
            <span className="text-xs text-slate-400 mt-1">{hint}</span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => onChange(e.target.files?.[0] || null)}
            />
          </label>
        )}
      </div>
    </div>
  );
}
