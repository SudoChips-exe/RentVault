'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatAmount } from '../../lib/errorHelper';
import { uploadDocument } from '../../lib/supabase';
import { Plus, Loader2, AlertCircle, CheckCircle2, Home, MapPin, DollarSign, ImagePlus } from 'lucide-react';

interface Listing {
  id: string;
  propertyName: string;
  address: string;
  monthlyRent: number;
  status: string;
  photoUrls?: string[];
}

async function uploadListingPhotos(listingId: string, files: File[]): Promise<string[]> {
  const uploads = files.map((file, i) =>
    uploadDocument(file, `listing-photos/${listingId}/${Date.now()}-${i}-${file.name}`)
  );
  return Promise.all(uploads);
}

interface SplitConfig {
  id: string;
  name: string;
  status: string;
}

export default function ListingsPage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [splitConfigs, setSplitConfigs] = useState<SplitConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [propertyName, setPropertyName] = useState('');
  const [address, setAddress] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [agentUid, setAgentUid] = useState('');
  const [splitConfigId, setSplitConfigId] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [photoUploadingId, setPhotoUploadingId] = useState<string | null>(null);
  const addPhotosInputRef = useRef<HTMLInputElement>(null);
  const [addPhotosTargetId, setAddPhotosTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'listings'),
      where('landlordUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setListings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Listing)));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'splitConfigs'), where('status', '==', 'active'));
    const unsub = onSnapshot(q, (snap) => {
      setSplitConfigs(snap.docs.map(d => ({ id: d.id, ...d.data() } as SplitConfig)));
    });
    return () => unsub();
  }, []);

  const handleCreate = async () => {
    if (!user || !propertyName.trim() || !address.trim() || !monthlyRent || !splitConfigId) {
      setError('All required fields must be filled.');
      return;
    }
    const rentKobo = Math.round(parseFloat(monthlyRent) * 100);
    if (isNaN(rentKobo) || rentKobo <= 0) {
      setError('Monthly rent must be a positive number.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const listingRef = await addDoc(collection(db, 'listings'), {
        propertyName: propertyName.trim(),
        address: address.trim(),
        monthlyRent: rentKobo,
        landlordUid: user.uid,
        agentUid: agentUid.trim() || null,
        splitConfigId,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (photoFiles.length > 0) {
        // Photos are uploaded to Supabase Storage keyed by the listing's own
        // Firestore ID, so the doc must exist first - this is a best-effort
        // follow-up update, not part of the listing's core creation.
        try {
          const photoUrls = await uploadListingPhotos(listingRef.id, photoFiles);
          await updateDoc(listingRef, { photoUrls, updatedAt: serverTimestamp() });
        } catch (photoErr: any) {
          setError(`Listing created, but photo upload failed: ${photoErr.message || 'unknown error'}`);
        }
      }

      setSuccess(true);
      setShowForm(false);
      setPropertyName('');
      setAddress('');
      setMonthlyRent('');
      setAgentUid('');
      setSplitConfigId('');
      setPhotoFiles([]);
    } catch (err: any) {
      setError(err.message || 'Failed to create listing.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPhotos = async (listingId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPhotoUploadingId(listingId);
    setError(null);
    try {
      const newUrls = await uploadListingPhotos(listingId, Array.from(files));
      const existing = listings.find((l) => l.id === listingId)?.photoUrls || [];
      await updateDoc(doc(db, 'listings', listingId), {
        photoUrls: [...existing, ...newUrls],
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to upload photos.');
    } finally {
      setPhotoUploadingId(null);
      setAddPhotosTargetId(null);
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
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">My Listings</h1>
            <p className="text-slate-500 text-sm mt-1">Manage your rental properties for rent collection.</p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setError(null); setSuccess(false); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-brand-500/20 active:scale-95 text-sm"
          >
            <Plus className="w-4 h-4" />
            New Listing
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 p-4 bg-brand-50 border border-brand-100 rounded-2xl text-brand-700 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            Listing created successfully. Tenants can now find and pay rent on this property.
          </div>
        )}

        {showForm && (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
              <Home className="w-5 h-5 text-brand-500" />
              New Listing
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Property Name *</label>
                <input
                  type="text"
                  value={propertyName}
                  onChange={(e) => setPropertyName(e.target.value)}
                  placeholder="e.g. Sunshine Apartments Unit 4"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Address *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 123 Main Street, Lagos"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Monthly Rent (NGN) *</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value)}
                    placeholder="e.g. 500000"
                    min="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Split Config *</label>
                <select
                  value={splitConfigId}
                  onChange={(e) => setSplitConfigId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium"
                >
                  <option value="">Select a split config...</option>
                  {splitConfigs.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Agent UID (optional)</label>
                <input
                  type="text"
                  value={agentUid}
                  onChange={(e) => setAgentUid(e.target.value)}
                  placeholder="Firebase UID of the agent handling this property"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Photos (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setPhotoFiles(e.target.files ? Array.from(e.target.files) : [])}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100"
                />
                {photoFiles.length > 0 && (
                  <p className="text-xs text-slate-500 mt-1.5">{photoFiles.length} photo{photoFiles.length !== 1 ? 's' : ''} selected</p>
                )}
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={saving || !propertyName || !address || !monthlyRent || !splitConfigId}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black rounded-2xl transition-all active:scale-95 shadow-lg shadow-brand-500/20"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Creating...' : 'Create Listing'}
            </button>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-1 divide-y divide-slate-100">
            {listings.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <Home className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-bold text-slate-900">No listings yet</p>
                <p className="text-sm text-slate-500 mt-1">Create your first listing to start collecting rent.</p>
              </div>
            ) : (
              listings.map((l) => (
                <div key={l.id} className="px-6 py-5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      {l.photoUrls?.[0] ? (
                        <img
                          src={l.photoUrls[0]}
                          alt={l.propertyName}
                          className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-slate-200"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                          <Home className="w-6 h-6 text-slate-300" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900">{l.propertyName}</h3>
                        <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{l.address}</span>
                        </p>
                        <button
                          onClick={() => { setAddPhotosTargetId(l.id); addPhotosInputRef.current?.click(); }}
                          disabled={photoUploadingId === l.id}
                          className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700 mt-1.5 disabled:opacity-50"
                        >
                          {photoUploadingId === l.id ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</>
                          ) : (
                            <><ImagePlus className="w-3 h-3" /> {l.photoUrls?.length ? `Add more photos (${l.photoUrls.length})` : 'Add photos'}</>
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono font-black text-slate-900">{formatAmount(l.monthlyRent)}<span className="text-xs text-slate-400 font-normal">/mo</span></p>
                      <span className={`inline-block mt-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        l.status === 'active'
                          ? 'bg-brand-50 text-brand-600 border-brand-100'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {l.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <input
          ref={addPhotosInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (addPhotosTargetId) handleAddPhotos(addPhotosTargetId, e.target.files);
            e.target.value = '';
          }}
        />
      </div>
    );
  }
