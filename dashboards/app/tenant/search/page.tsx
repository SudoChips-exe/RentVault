'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatAmount } from '../../lib/errorHelper';
import { Search, MapPin, Building2, ChevronRight, Loader2, AlertCircle } from 'lucide-react';

interface Listing {
  listingId: string;
  propertyName: string;
  address: string;
  monthlyRent: number;
  status: 'active' | 'inactive';
}

export default function TenantSearchPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [search, setSearch] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'tenant') {
      router.push('/');
      return;
    }

    const q = query(
      collection(db, 'listings'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setListings(snap.docs.map((d) => ({ listingId: d.id, ...d.data() } as Listing)));
        setDataLoading(false);
      },
      (err) => {
        console.error('[TENANT_SEARCH] Firestore error:', err);
        setError('Unable to load listings. Please refresh.');
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

  const filtered = listings.filter((l) => {
    const term = search.toLowerCase();
    return l.propertyName.toLowerCase().includes(term) || l.address.toLowerCase().includes(term);
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Browse Houses</h1>
        <p className="text-slate-500 text-sm mt-1">Find a place and pay rent securely through escrow.</p>
      </div>

      <div className="relative group max-w-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by property name or address..."
          className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all shadow-sm"
        />
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl px-6 py-16 text-center shadow-sm">
          <Search className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-bold text-slate-900">No listings found</p>
          <p className="text-sm text-slate-500 mt-1">
            {search ? `No results for "${search}"` : 'There are no active listings at the moment.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((listing) => (
            <Link key={listing.listingId} href={`/tenant/search/${listing.listingId}`} className="block group">
              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden hover:border-brand-500 transition-all duration-300 hover:shadow-xl hover:shadow-brand-500/5 group-hover:-translate-y-1 p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0 group-hover:border-brand-200 group-hover:bg-brand-50 transition-colors">
                    <Building2 className="w-6 h-6 text-slate-400 group-hover:text-brand-500 transition-colors" />
                  </div>
                  <div className="px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-bold border border-brand-100">
                    Active
                  </div>
                </div>
                <h3 className="font-black text-slate-900 text-xl mb-2 group-hover:text-brand-600 transition-colors line-clamp-1 tracking-tight">
                  {listing.propertyName}
                </h3>
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-8">
                  <MapPin className="w-4 h-4 flex-shrink-0 text-slate-400" />
                  <span className="line-clamp-1">{listing.address}</span>
                </div>
                <div className="border-t border-slate-100 pt-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Monthly Rent</p>
                    <p className="text-2xl font-mono font-bold text-slate-900">{formatAmount(listing.monthlyRent)}</p>
                  </div>
                  <div className="flex items-center gap-1 text-slate-400 text-xs font-bold group-hover:text-brand-500 transition-colors">
                    Details
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
