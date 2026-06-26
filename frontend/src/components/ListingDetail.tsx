import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { formatAmount, formatDate, parseFirebaseError } from '../lib/errorHelper';
import {
  MapPin, Building2, User, ArrowLeft, CreditCard, Loader2, AlertCircle, Shield, Clock,
  ExternalLink, CheckCircle2
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

export const ListingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, signInWithGoogle, loading: authLoading } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [landlord, setLandlord] = useState<UserBasic | null>(null);
  const [agent, setAgent] = useState<UserBasic | null>(null);
  const [listingLoading, setListingLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<{ url: string; transactionId: string } | null>(null);

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

      // Load landlord name
      try {
        const landlordDoc = await getDoc(doc(db, 'users', data.landlordUid));
        if (landlordDoc.exists()) setLandlord(landlordDoc.data() as UserBasic);
      } catch {}

      // Load agent name
      if (data.agentUid) {
        try {
          const agentDoc = await getDoc(doc(db, 'users', data.agentUid));
          if (agentDoc.exists()) setAgent(agentDoc.data() as UserBasic);
        } catch {}
      }

      setListingLoading(false);
    }, (err) => {
      console.error('[LISTING_DETAIL] Firestore error:', err);
      setError('Failed to load listing. Please try again.');
      setListingLoading(false);
    });

    return () => unsub();
  }, [id]);

  const handlePayRent = async () => {
    if (!user) {
      try {
        await signInWithGoogle();
      } catch {
        setError('Please sign in to pay rent.');
        return;
      }
      return;
    }

    if (user.role !== 'tenant') {
      setError('Only tenants can initiate a payment. Please switch your role to "Tenant".');
      return;
    }

    setCheckoutLoading(true);
    setError(null);

    try {
      const initiate = httpsCallable<{ listingId: string }, { checkoutUrl: string; transactionId: string }>(
        functions,
        'checkoutInitiate'
      );
      const result = await initiate({ listingId: id! });
      setCheckoutSuccess({ url: result.data.checkoutUrl, transactionId: result.data.transactionId });
      // Open Nomba checkout
      window.open(result.data.checkoutUrl, '_blank');
    } catch (err: any) {
      const parsed = parseFirebaseError(err);
      setError(parsed.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (listingLoading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
          <p className="text-slate-400 text-sm">Loading listing details...</p>
        </div>
      </div>
    );
  }

  if (error && !listing) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-4">
        <div className="glass-panel rounded-2xl p-8 max-w-md text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-semibold text-slate-100">Listing Unavailable</h2>
          <p className="text-slate-400 text-sm">{error}</p>
          <button onClick={() => navigate('/listings')} className="inline-flex items-center gap-2 px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-xl text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to listings
          </button>
        </div>
      </div>
    );
  }

  if (!listing) return null;

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <button
          onClick={() => navigate('/listings')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm mb-6 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          All listings
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Listing info */}
          <div className="lg:col-span-2 space-y-5">
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-brand-500 via-brand-400 to-green-400" />
              <div className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-600/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-7 h-7 text-brand-400" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-brand-400 uppercase tracking-widest">Active Listing</span>
                    <h1 className="text-2xl font-extrabold text-slate-100 mt-1">{listing.propertyName}</h1>
                    <div className="flex items-center gap-1.5 text-slate-400 text-sm mt-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {listing.address}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/40 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Monthly Rent</p>
                    <p className="text-2xl font-extrabold text-brand-400">{formatAmount(listing.monthlyRent)}</p>
                  </div>
                  <div className="bg-slate-800/40 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Listed On</p>
                    <p className="text-sm font-semibold text-slate-200">{formatDate(listing.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* People involved */}
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Property Contacts</h2>
              <div className="space-y-3">
                {landlord && (
                  <div className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-xl">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Landlord</p>
                      <p className="text-sm font-semibold text-slate-200">{landlord.displayName}</p>
                    </div>
                  </div>
                )}
                {agent && (
                  <div className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-xl">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Agent</p>
                      <p className="text-sm font-semibold text-slate-200">{agent.displayName}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Payment card */}
          <div className="space-y-4">
            <div className="glass-panel rounded-2xl p-6 sticky top-24">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-brand-400" />
                <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">Escrow Protected</span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed mb-5">
                Your payment is held securely in escrow until landlord verification is approved.
              </p>

              <div className="border-t border-slate-700/60 pt-4 mb-5">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Monthly Rent</span>
                  <span className="text-slate-200 font-semibold">{formatAmount(listing.monthlyRent)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Escrow Fee</span>
                  <span className="text-brand-400 font-semibold">Included</span>
                </div>
              </div>

              {/* Error display */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-4 text-sm text-red-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {/* Success state */}
              {checkoutSuccess ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl text-sm text-brand-300">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    Checkout opened! Complete payment in the Nomba window.
                  </div>
                  <button
                    onClick={() => window.open(checkoutSuccess.url, '_blank')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-sm text-slate-200 rounded-xl transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Reopen Checkout
                  </button>
                  <button
                    onClick={() => navigate(`/transactions/${checkoutSuccess.transactionId}`)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    <Clock className="w-4 h-4" />
                    Track Transaction
                  </button>
                </div>
              ) : (
                <button
                  onClick={handlePayRent}
                  disabled={checkoutLoading || authLoading || listing.status !== 'active'}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold rounded-xl shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50 disabled:shadow-none transition-all duration-200 active:scale-95 disabled:cursor-not-allowed"
                >
                  {checkoutLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                  ) : !user ? (
                    <><CreditCard className="w-4 h-4" /> Sign in to Pay Rent</>
                  ) : (
                    <><CreditCard className="w-4 h-4" /> Pay {formatAmount(listing.monthlyRent)}</>
                  )}
                </button>
              )}

              {!user && (
                <p className="text-center text-xs text-slate-500 mt-3">
                  You'll be asked to sign in with Google.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
