'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../lib/firebase';
import { useAuth } from '../../../context/AuthContext';
import { formatAmount, formatDate, parseFirebaseError } from '../../../lib/errorHelper';
import {
  MapPin, Building2, User, ArrowLeft, CreditCard, Loader2, AlertCircle, Shield, Clock,
  ExternalLink, CheckCircle2, ShieldCheck
} from 'lucide-react';

interface Listing {
  listingId: string;
  propertyName: string;
  address: string;
  monthlyRent: number;
  landlordUid: string;
  agentUid?: string;
  status: 'active' | 'inactive';
  createdAt?: any;
}

interface UserBasic {
  displayName: string;
  email: string;
}

export default function TenantListingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [landlord, setLandlord] = useState<UserBasic | null>(null);
  const [agent, setAgent] = useState<UserBasic | null>(null);
  const [listingLoading, setListingLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<{ url: string; transactionId: string } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'tenant') {
      router.push('/');
      return;
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!id) return;

    const unsub = onSnapshot(doc(db, 'listings', id), async (snap) => {
      if (!snap.exists()) {
        setError('Listing not found.');
        setListingLoading(false);
        return;
      }

      const data = { listingId: snap.id, ...snap.data() } as Listing;
      setListing(data);

      try {
        const landlordDoc = await getDoc(doc(db, 'users', data.landlordUid));
        if (landlordDoc.exists()) setLandlord(landlordDoc.data() as UserBasic);
      } catch {}

      if (data.agentUid) {
        try {
          const agentDoc = await getDoc(doc(db, 'users', data.agentUid));
          if (agentDoc.exists()) setAgent(agentDoc.data() as UserBasic);
        } catch {}
      }

      setListingLoading(false);
    }, (err) => {
      console.error('[TENANT_LISTING_DETAIL] Firestore error:', err);
      setError('Failed to load listing. Please try again.');
      setListingLoading(false);
    });

    return () => unsub();
  }, [id]);

  const handlePayRent = async () => {
    setCheckoutLoading(true);
    setError(null);

    // Open the popup synchronously on the click, before any await, so
    // browsers still count it as a direct user gesture. We fill in the
    // real URL once checkoutInitiate resolves - fixes the popup-blocker
    // issue that hits when window.open() runs after an async call.
    const popup = window.open('', '_blank');

    try {
      const initiate = httpsCallable<{ listingId: string }, { checkoutUrl: string; transactionId: string }>(
        functions,
        'checkoutInitiate'
      );
      const result = await initiate({ listingId: id! });
      setCheckoutSuccess({ url: result.data.checkoutUrl, transactionId: result.data.transactionId });
      if (popup) {
        popup.location.href = result.data.checkoutUrl;
      } else {
        window.open(result.data.checkoutUrl, '_blank');
      }
    } catch (err: any) {
      popup?.close();
      setError(parseFirebaseError(err).message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const isVerified = user?.verificationStatus === 'approved';

  if (authLoading || listingLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (error && !listing) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 space-y-4">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Listing Unavailable</h2>
        <p className="text-slate-500 text-sm">{error}</p>
        <Link href="/tenant/search" className="inline-flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to search
        </Link>
      </div>
    );
  }

  if (!listing) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Link
        href="/tenant/search"
        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-sm transition-colors group w-fit"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        All listings
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Listing info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="h-2 bg-brand-500" />
            <div className="p-8">
              <div className="flex items-start gap-6 mb-8">
                <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-8 h-8 text-brand-500" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">Active Listing</span>
                  <h1 className="text-4xl font-black text-slate-900 mt-1 tracking-tighter leading-none">{listing.propertyName}</h1>
                  <div className="flex items-center gap-1.5 text-slate-500 text-sm mt-2">
                    <MapPin className="w-4 h-4" />
                    {listing.address}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Monthly Rent</p>
                  <p className="text-3xl font-mono font-black text-slate-900">{formatAmount(listing.monthlyRent)}</p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Listed On</p>
                  <p className="text-lg font-semibold text-slate-700 mt-1">{formatDate(listing.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6">Property Contacts</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {landlord && (
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Landlord</p>
                    <p className="text-sm font-bold text-slate-900">{landlord.displayName}</p>
                  </div>
                </div>
              )}
              {agent && (
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Agent</p>
                    <p className="text-sm font-bold text-slate-900">{agent.displayName}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Payment card */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl shadow-slate-200/50 sticky top-6">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-brand-500" />
              <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">Escrow Protected</span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed mb-6">
              Your payment is held securely in escrow until landlord verification is approved.
            </p>

            <div className="border-t border-slate-100 pt-5 mb-6">
              <div className="flex justify-between text-sm mb-3">
                <span className="text-slate-500">Monthly Rent</span>
                <span className="text-slate-900 font-mono font-bold">{formatAmount(listing.monthlyRent)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Escrow Fee</span>
                <span className="text-brand-600 font-bold">Included</span>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-100 rounded-2xl mb-6 text-sm text-red-600">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {checkoutSuccess ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-4 bg-brand-50 border border-brand-100 rounded-2xl text-sm text-brand-700">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  Checkout opened! Complete payment in the Nomba window.
                </div>
                <button
                  onClick={() => window.open(checkoutSuccess.url, '_blank')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-700 rounded-2xl transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Reopen Checkout
                </button>
                <Link
                  href="/tenant/payments"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold rounded-2xl transition-colors shadow-lg shadow-brand-500/20"
                >
                  <Clock className="w-4 h-4" />
                  Track Payment
                </Link>
              </div>
            ) : !isVerified ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-4 bg-blue-50 border border-blue-100 rounded-2xl text-sm text-blue-700">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  Get verified before paying rent - ID and income proof review takes 24-48h.
                </div>
                <Link
                  href="/tenant/verification"
                  className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl transition-all active:scale-95 text-lg"
                >
                  <ShieldCheck className="w-5 h-5" />
                  Get Verified
                </Link>
              </div>
            ) : (
              <button
                onClick={handlePayRent}
                disabled={checkoutLoading || listing.status !== 'active'}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black rounded-2xl shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50 disabled:shadow-none transition-all duration-200 active:scale-95 disabled:cursor-not-allowed text-lg"
              >
                {checkoutLoading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                ) : (
                  <><CreditCard className="w-5 h-5" /> Pay {formatAmount(listing.monthlyRent)}</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
