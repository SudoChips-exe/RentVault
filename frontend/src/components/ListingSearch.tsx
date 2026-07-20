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
  photoUrls?: string[];
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
      <div className="min-h-screen pb-16">
        {/* Hero Section */}
        <div className="bg-slate-950 pt-32 pb-20 px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-5xl sm:text-6xl font-black text-slate-50 tracking-tighter mb-6 leading-tight">
              Available Listings
            </h1>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Pay rent securely with escrow protection. Funds are held until landlord verification is approved.
            </p>
          </div>
        </div>

        {/* Search & Results Section */}
        <div className="bg-white px-4 sm:px-6 lg:px-8 -mt-10">
          <div className="max-w-7xl mx-auto">
            {/* Search bar as a floating card */}
            <div className="max-w-2xl mx-auto mb-16">
              <div className="relative group">
                <div className="absolute inset-0 bg-brand-500/20 blur-xl rounded-3xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by property name or address..."
                    className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-base shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
                <p className="text-slate-500 font-medium">Loading listings...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-slate-900 font-bold text-lg">{error}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <Search className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-900 font-bold text-lg">No listings found</p>
                <p className="text-slate-500 text-sm">
                  {search ? `No results for "${search}"` : 'There are no active listings at the moment.'}
                </p>
              </div>
            ) : (
              <>
                <div className="mb-8 flex items-center justify-between">
                  <span className="text-slate-500 font-medium">
                    {filtered.length} listing{filtered.length !== 1 ? 's' : ''} available
                    {search && <span className="ml-1">for "{search}"</span>}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filtered.map((listing) => (
                    <ListingCard key={listing.listingId} listing={listing} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
};

const ListingCard: React.FC<{ listing: Listing }> = ({ listing }) => {
    return (
      <Link to={`/listings/${listing.listingId}`} className="block group">
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden hover:border-brand-500 transition-all duration-300 hover:shadow-xl hover:shadow-brand-500/5 group-hover:-translate-y-1">
          {listing.photoUrls?.[0] && (
            <div className="aspect-video w-full overflow-hidden bg-slate-100">
              <img
                src={listing.photoUrls[0]}
                alt={listing.propertyName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          )}
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              {!listing.photoUrls?.[0] && (
                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0 group-hover:border-brand-200 group-hover:bg-brand-50 transition-colors">
                  <Building2 className="w-6 h-6 text-slate-400 group-hover:text-brand-500 transition-colors" />
                </div>
              )}
              <div className="px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-bold border border-brand-100 ml-auto">
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
        </div>
      </Link>
    );
  };
