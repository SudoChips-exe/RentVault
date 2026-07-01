'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatAmount } from '../../lib/errorHelper';
import { Loader2, AlertCircle, Home, MapPin } from 'lucide-react';

interface Listing {
  id: string;
  propertyName: string;
  address: string;
  monthlyRent: number;
  status: string;
}

export default function TenantPropertiesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'tenant') {
      router.push('/');
      return;
    }
    const q = query(collection(db, 'transactions'), where('tenantUid', '==', user.uid));

    const unsub = onSnapshot(
      q,
      async (snap) => {
        try {
          const listingIds = Array.from(new Set(snap.docs.map((d) => d.data().listingId as string)));
          const fetched = await Promise.all(
            listingIds.map(async (listingId) => {
              const listingSnap = await getDoc(doc(db, 'listings', listingId));
              return listingSnap.exists() ? ({ id: listingSnap.id, ...listingSnap.data() } as Listing) : null;
            })
          );
          setListings(fetched.filter((l): l is Listing => l !== null));
          setDataLoading(false);
        } catch (err) {
          console.error('[TENANT_PROPERTIES] Failed to resolve listings:', err);
          setError('Unable to load your properties. Please refresh.');
          setDataLoading(false);
        }
      },
      (err) => {
        console.error('[TENANT_PROPERTIES] Firestore error:', err);
        setError('Unable to load your properties. Please refresh.');
        setDataLoading(false);
      }
    );
    return () => unsub();
  }, [user, authLoading, router]);

  if (authLoading || dataLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">My Properties</h1>
        <p className="text-slate-500 text-sm mt-1">Properties you have paid rent on through RentVault.</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {listings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl px-6 py-16 text-center shadow-sm">
          <Home className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-bold text-slate-900">No properties yet</p>
          <p className="text-sm text-slate-500 mt-1">Properties you pay rent for will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {listings.map((l) => (
            <div key={l.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <Home className="w-6 h-6 text-slate-400" />
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  l.status === 'active'
                    ? 'bg-brand-50 text-brand-600 border-brand-100'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  {l.status}
                </span>
              </div>
              <h3 className="font-black text-slate-900 text-xl mb-2 tracking-tight">{l.propertyName}</h3>
              <p className="flex items-center gap-2 text-slate-500 text-sm mb-6">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                {l.address}
              </p>
              <div className="border-t border-slate-100 pt-4">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Monthly Rent</p>
                <p className="text-2xl font-mono font-bold text-slate-900">{formatAmount(l.monthlyRent)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
