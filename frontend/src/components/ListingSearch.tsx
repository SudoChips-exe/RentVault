import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { formatAmount } from '../lib/errorHelper';
import { Search, MapPin, Building2, ChevronRight, Loader2, AlertCircle } from 'lucide-react';

interface Listing {
  listingId: string;
  propertyName: string;
  address: string;
  monthlyRent: number;
  landlordUid: string;
  agentUid?: string;
  status: 'active' | 'inactive';
}

export const ListingSearch: React.FC = () => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'listings'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: Listing[] = snapshot.docs.map((d) => ({
          listingId: d.id,
          ...d.data(),
        } as Listing));
        setListings(items);
        setLoading(false);
      },
      (err) => {
        console.error('[LISTING_SEARCH] Firestore error:', err);
        setError('Unable to load listings. Please refresh.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const filtered = listings.filter((l) => {
    const term = search.toLowerCase();
    return (
      l.propertyName.toLowerCase().includes(term) ||
      l.address.toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="max-w-3xl mx-auto text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-50 mb-4">
          Available Listings
        </h1>
        <p className="text-slate-400 text-lg">
          Pay rent securely with escrow protection. Funds are held until landlord verification is approved.
        </p>
      </div>

      {/* Search bar */}
      <div className="max-w-2xl mx-auto mb-10">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by property name or address..."
            className="w-full pl-12 pr-4 py-3.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all text-sm"
          />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            <p className="text-slate-400 text-sm">Loading listings...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-red-400" />
            </div>
            <p className="text-slate-300 font-medium">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
              <Search className="w-7 h-7 text-slate-500" />
            </div>
            <p className="text-slate-300 font-medium">No listings found</p>
            <p className="text-slate-500 text-sm">
              {search ? `No results for "${search}"` : 'There are no active listings at the moment.'}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <span className="text-slate-500 text-sm">
                {filtered.length} listing{filtered.length !== 1 ? 's' : ''} available
                {search && <span className="ml-1">for "{search}"</span>}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((listing) => (
                <ListingCard key={listing.listingId} listing={listing} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const ListingCard: React.FC<{ listing: Listing }> = ({ listing }) => {
  return (
    <Link to={`/listings/${listing.listingId}`} className="block group">
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors">
        <div className="h-1 bg-brand-600" />
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-slate-400" />
            </div>
            <div className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 text-xs font-medium border border-slate-700">
              Active
            </div>
          </div>
          <h3 className="font-semibold text-slate-50 text-base mb-1.5 group-hover:text-brand-400 transition-colors line-clamp-1">
            {listing.propertyName}
          </h3>
          <div className="flex items-center gap-1.5 text-slate-500 text-sm mb-5">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="line-clamp-1">{listing.address}</span>
          </div>
          <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Monthly Rent</p>
              <p className="text-lg font-bold text-slate-50">{formatAmount(listing.monthlyRent)}</p>
            </div>
            <div className="flex items-center gap-1 text-slate-500 text-xs font-medium group-hover:text-brand-400 transition-colors">
              View Details
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
