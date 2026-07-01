'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import {
  Wallet,
  Clock,
  Home,
  FileText,
  ShieldCheck,
  ChevronRight,
  CreditCard,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { formatAmount, formatDate, parseFirebaseError } from '../lib/errorHelper';

interface TenantTransaction {
  id: string;
  transactionReference: string;
  amount: number;
  status: string;
  createdAt: any;
  listingId: string;
  landlordUid: string;
  propertyAddress: string;
  landlordEmail: string;
}

const VERIFICATION_LABELS: Record<string, { label: string; sub: string; color: string }> = {
  approved: { label: 'Verified', sub: 'Your lease is fully secured', color: 'text-emerald-600' },
  pending: { label: 'Pending Review', sub: 'Documents submitted, awaiting review', color: 'text-blue-600' },
  rejected: { label: 'Rejected', sub: 'Resubmit your documents', color: 'text-red-600' },
  unverified: { label: 'Unverified', sub: 'Get verified to pay rent', color: 'text-slate-500' },
};

const RECEIPT_ELIGIBLE_STATUSES = new Set([
  'funds_held',
  'verification_submitted',
  'verified',
  'disbursement_pending',
  'completed',
  'disbursement_partial_failure',
]);

export default function TenantDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<TenantTransaction[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

    const unsub = onSnapshot(q, async (snap) => {
      const listingCache = new Map<string, string>();
      const landlordEmailCache = new Map<string, string>();
      const items = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          let propertyAddress = listingCache.get(data.listingId);
          if (!propertyAddress) {
            const listingSnap = await getDoc(doc(db, 'listings', data.listingId));
            propertyAddress = listingSnap.exists() ? listingSnap.data().address : 'Unknown property';
            listingCache.set(data.listingId, propertyAddress!);
          }
          let landlordEmail = landlordEmailCache.get(data.landlordUid);
          if (!landlordEmail) {
            const landlordSnap = await getDoc(doc(db, 'users', data.landlordUid));
            landlordEmail = landlordSnap.exists() ? landlordSnap.data().email : '';
            landlordEmailCache.set(data.landlordUid, landlordEmail!);
          }
          return {
            id: d.id,
            transactionReference: data.transactionReference,
            amount: data.amount,
            status: data.status,
            createdAt: data.createdAt,
            listingId: data.listingId,
            landlordUid: data.landlordUid,
            propertyAddress,
            landlordEmail,
          } as TenantTransaction;
        })
      );
      setTransactions(items);
      setDataLoading(false);
    }, (err) => {
      console.error('[TENANT_DASHBOARD] Firestore error:', err);
      setDataLoading(false);
    });

    return () => unsub();
  }, [user, authLoading, router]);

  const escrowBalance = transactions
    .filter((t) => t.status === 'funds_held')
    .reduce((sum, t) => sum + t.amount, 0);
  const pendingCount = transactions.filter((t) => t.status === 'pending_payment').length;
  const hasActiveRental = transactions.some((t) => RECEIPT_ELIGIBLE_STATUSES.has(t.status));
  const verification = VERIFICATION_LABELS[user?.verificationStatus || 'unverified'];

  const handleContactLandlord = () => {
    setActionError(null);
    const latest = transactions[0];
    if (!latest || !latest.landlordEmail) {
      setActionError('No landlord on file yet - pay rent on a listing first.');
      return;
    }
    window.location.href = `mailto:${latest.landlordEmail}?subject=${encodeURIComponent(`RentVault - ${latest.propertyAddress}`)}`;
  };

  const handleDownloadReceipt = async () => {
    setActionError(null);
    const latest = transactions.find((t) => RECEIPT_ELIGIBLE_STATUSES.has(t.status));
    if (!latest) {
      setActionError('No completed payment to generate a receipt for yet.');
      return;
    }

    setReceiptLoading(true);
    // Open synchronously on click so the browser still treats it as a
    // direct user gesture, then fill in the real URL once it's ready.
    const popup = window.open('', '_blank');
    try {
      const generate = httpsCallable<{ transactionId: string }, { url: string }>(functions, 'generateReceipt');
      const result = await generate({ transactionId: latest.id });
      if (popup) {
        popup.location.href = result.data.url;
      } else {
        window.open(result.data.url, '_blank');
      }
    } catch (err) {
      popup?.close();
      setActionError(parseFirebaseError(err).message);
    } finally {
      setReceiptLoading(false);
    }
  };

  if (authLoading || dataLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <div className="animate-spin w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Welcome, {user?.displayName?.split(' ')[0]}</h1>
            <p className="text-slate-500 text-sm mt-1">Here is your rent escrow and payment overview.</p>
          </div>
          <Link
            href="/tenant/search"
            className="flex items-center gap-2 px-6 py-3 bg-nomba-500 hover:bg-nomba-600 text-slate-950 font-bold rounded-2xl shadow-lg shadow-nomba-500/30 transition-all active:scale-95"
          >
            <CreditCard className="w-4 h-4" />
            Make Next Payment
          </Link>
        </div>

        {/* Top Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Wallet className="w-16 h-16 text-brand-500" />
            </div>
            <div className="flex items-center gap-3 mb-4 text-nomba-600">
              <div className="p-2 bg-nomba-50 rounded-xl"><Wallet className="w-5 h-5" /></div>
              <span className="font-bold text-sm">Current Escrow Balance</span>
            </div>
            <p className="text-3xl font-mono font-black text-slate-900">{formatAmount(escrowBalance)}</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">Available for disbursement</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Clock className="w-16 h-16 text-blue-500" />
            </div>
            <div className="flex items-center gap-3 mb-4 text-blue-600">
              <div className="p-2 bg-blue-50 rounded-xl"><Clock className="w-5 h-5" /></div>
              <span className="font-bold text-sm">Pending Payments</span>
            </div>
            <p className="text-3xl font-black text-slate-900">{pendingCount}</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">{pendingCount === 0 ? 'Nothing outstanding' : 'Awaiting payment'}</p>
          </div>

          <Link href="/tenant/verification" className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden group hover:border-brand-500 transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <ShieldCheck className="w-16 h-16 text-emerald-500" />
            </div>
            <div className={`flex items-center gap-3 mb-4 ${verification.color}`}>
              <div className="p-2 bg-emerald-50 rounded-xl"><ShieldCheck className="w-5 h-5" /></div>
              <span className="font-bold text-sm">Account Status</span>
            </div>
            <p className="text-3xl font-black text-slate-900">{verification.label}</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">{verification.sub}</p>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Transaction Table */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-500" />
                Payment History
              </h2>
              <Link href="/tenant/payments" className="text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors">View All</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Transaction ID</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Property</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Amount</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-slate-400 font-medium">
                        No payments yet.
                      </td>
                    </tr>
                  ) : transactions.slice(0, 5).map((t) => {
                    const isCompleted = t.status === 'completed';
                    const isPending = t.status === 'pending_payment';
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{t.transactionReference}</td>
                        <td className="px-6 py-4 font-medium text-slate-900">{t.propertyAddress}</td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">{formatAmount(t.amount)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${
                            isCompleted ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            isPending ? 'bg-orange-50 text-orange-600 border-orange-100' :
                            'bg-blue-50 text-blue-600 border-blue-100'
                          }`}>
                            {t.status.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-500">{formatDate(t.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Action Center */}
          <div className="space-y-6">
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 text-white shadow-xl">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-400" />
                Secure Your Rent
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-6">
                Paying your rent through RentVault ensures your funds are held in escrow and only released upon verified occupancy.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-slate-900 rounded-2xl border border-slate-800">
                  <div className={`w-2 h-2 rounded-full ${hasActiveRental ? 'bg-nomba-500 shadow-sm shadow-nomba-500/50' : 'bg-slate-600'}`} />
                  <span className={`text-xs font-medium ${hasActiveRental ? 'text-slate-300' : 'text-slate-500'}`}>
                    {hasActiveRental ? 'Active rental on file' : 'No active rental yet'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-4">Quick Support</h3>

              {actionError && (
                <div className="flex items-start gap-2 p-3 mb-3 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-600">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  {actionError}
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={handleContactLandlord}
                  disabled={transactions.length === 0}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm"><Home className="w-4 h-4 text-slate-600" /></div>
                    <span className="text-xs font-bold text-slate-700">Contact Landlord</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={handleDownloadReceipt}
                  disabled={receiptLoading || !transactions.some((t) => RECEIPT_ELIGIBLE_STATUSES.has(t.status))}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      {receiptLoading ? <Loader2 className="w-4 h-4 text-slate-600 animate-spin" /> : <FileText className="w-4 h-4 text-slate-600" />}
                    </div>
                    <span className="text-xs font-bold text-slate-700">{receiptLoading ? 'Generating...' : 'Download Receipt'}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
