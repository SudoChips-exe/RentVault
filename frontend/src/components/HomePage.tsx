import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { SignInModal } from './SignInModal';

// ─── Animated escrow ledger widget ────────────────────────────────────────────

interface DisbursementRow {
  label: string;
  pct: string;
  amount: string;
}

interface EscrowState {
  id: string;
  status: string;
  label: string;
  dotClass: string;
  statusClass: string;
  progress: number;
  disbursements: DisbursementRow[] | null;
}

const ESCROW_STATES: EscrowState[] = [
  {
    id: 'held',
    status: 'FUNDS HELD',
    label: 'Payment received. Awaiting documents.',
    dotClass: 'bg-amber-400',
    statusClass: 'text-amber-400',
    progress: 20,
    disbursements: null,
  },
  {
    id: 'submitted',
    status: 'DOCS SUBMITTED',
    label: 'Admin reviewing ownership papers.',
    dotClass: 'bg-blue-400',
    statusClass: 'text-blue-400',
    progress: 55,
    disbursements: null,
  },
  {
    id: 'verified',
    status: 'VERIFIED',
    label: 'Landlord confirmed. Splitting funds.',
    dotClass: 'bg-brand-400',
    statusClass: 'text-brand-400',
    progress: 82,
    disbursements: null,
  },
  {
    id: 'completed',
    status: 'DISBURSED',
    label: 'All transfers complete.',
    dotClass: 'bg-brand-500',
    statusClass: 'text-brand-400',
    progress: 100,
    disbursements: [
      { label: 'Landlord', pct: '70%', amount: '₦595,000' },
      { label: 'Agent', pct: '10%', amount: '₦85,000' },
      { label: 'Platform', pct: '20%', amount: '₦170,000' },
    ],
  },
];

const PENDING_ROWS = [
  { label: 'Landlord', pct: '70%' },
  { label: 'Agent', pct: '10%' },
  { label: 'Platform', pct: '20%' },
];

const EscrowLedger: React.FC = () => {
  const [stateIndex, setStateIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const current = ESCROW_STATES[stateIndex];

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setStateIndex((i) => (i + 1) % ESCROW_STATES.length);
        setVisible(true);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full max-w-sm mx-auto lg:mx-0">
      {/* Ambient glow behind card */}
      <div className="absolute -inset-8 bg-brand-500/8 rounded-3xl blur-3xl pointer-events-none" />

      {/* Terminal card */}
      <div className="relative bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
        {/* Mac-style header bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/70 border-b border-slate-700/50">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-brand-500/60" />
          <span className="ml-2 text-xs font-mono text-slate-600 tracking-wide">rentvault · escrow</span>
        </div>

        <div className="p-6">
          {/* Transaction metadata */}
          <div className="flex items-center justify-between mb-5">
            <span className="text-xs font-mono text-slate-600 uppercase tracking-widest">Transaction</span>
            <span className="text-xs font-mono text-slate-600">RV-2025-0847</span>
          </div>

          {/* Amount — IBM Plex Mono, prominent */}
          <div className="mb-1">
            <span className="text-4xl font-mono font-bold text-slate-50 tracking-tight">₦850,000</span>
          </div>
          <div className="text-xs font-mono text-slate-600 mb-6 tracking-wide">1 YEAR · LEKKI PHASE 1</div>

          {/* Live status indicator */}
          <div
            className="flex items-center gap-2.5 mb-4 transition-opacity duration-300"
            style={{ opacity: visible ? 1 : 0 }}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${current.dotClass}`} />
            <span className={`text-sm font-mono font-bold ${current.statusClass}`}>
              {current.status}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-0.5 bg-slate-800 rounded-full mb-3 overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-700 ease-in-out"
              style={{ width: `${current.progress}%` }}
            />
          </div>

          {/* Status message */}
          <p
            className="text-xs font-mono text-slate-500 mb-6 transition-opacity duration-300"
            style={{ opacity: visible ? 1 : 0 }}
          >
            {current.label}
          </p>

          {/* Disbursement rows */}
          <div className="border-t border-slate-800 pt-4 space-y-2.5">
            {current.disbursements
              ? current.disbursements.map((d) => (
                  <div key={d.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-brand-500 flex-shrink-0" />
                      <span className="text-xs font-mono text-slate-400">{d.label}</span>
                      <span className="text-xs font-mono text-slate-600">{d.pct}</span>
                    </div>
                    <span className="text-xs font-mono font-semibold text-brand-400">{d.amount}</span>
                  </div>
                ))
              : PENDING_ROWS.map((r) => (
                  <div key={r.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                      </span>
                      <span className="text-xs font-mono text-slate-600">{r.label}</span>
                      <span className="text-xs font-mono text-slate-700">{r.pct}</span>
                    </div>
                    <span className="text-xs font-mono text-slate-700">─── pending</span>
                  </div>
                ))}
          </div>
        </div>
      </div>

      {/* State dots */}
      <div className="flex items-center justify-center gap-1.5 mt-5">
        {ESCROW_STATES.map((_, i) => (
          <span
            key={i}
            className={`w-1 h-1 rounded-full transition-all duration-300 ${
              i === stateIndex ? 'bg-brand-500 w-4' : 'bg-slate-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

// ─── How it works — three editorial columns ───────────────────────────────────

const HOW_IT_WORKS = [
  {
    num: '01',
    title: 'Escrow',
    body: 'Your payment sits in Nomba\'s secure layer — not in the landlord\'s account — until an admin gives the green light.',
  },
  {
    num: '02',
    title: 'Verify',
    body: 'Landlord or agent submits ownership documents. An admin reviews independently. No docs approved = no access to your funds.',
  },
  {
    num: '03',
    title: 'Disburse',
    body: 'Approval fires automatic transfers — landlord, agent, and platform each receive exactly their agreed percentage, instantly.',
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [signInModalOpen, setSignInModalOpen] = useState(false);

  const handleCTA = () => {
    if (user) navigate('/listings');
    else setSignInModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950">

       {/* ── Hero ─────────────────────────────────────────────────────────────── */}
       <section className="relative min-h-[calc(100vh-64px)] flex items-center px-4 sm:px-6 lg:px-8 pt-16 overflow-hidden">
         {/* Professional subtle depth: Radial gradient focus */}
         <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.05)_0%,transparent_70%)]" />
         {/* Fade grid to black at bottom */}
         <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto w-full py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">

            {/* Left: headline + CTAs */}
            <div>
               {/* Eyebrow */}
               <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-8">
                 <span className="w-1 h-1 rounded-full bg-brand-500" />
                 Powered by Nomba 
               </div>

               {/* Headline */}
               <h1 className="text-6xl sm:text-7xl lg:text-[6rem] font-black text-slate-50 leading-[1.0] tracking-tighter mb-6">
                 Rent paid.<br />
                 <span className="text-brand-500">No fraud.</span><br />
                 Guaranteed.
               </h1>

              <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-md">
                Your rent payment is securely held in escrow not sent directly to the landlord until their ownership documents are verified. Fake agents can't access your money, and if verification fails, you receive a full refund of every kobo.

              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleCTA}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-sm rounded-lg transition-colors"
                >
                  {user ? 'Browse Listings' : 'Find a Listing'}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <Link
                  to="/listings"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-transparent border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 font-medium text-sm rounded-lg transition-colors"
                >
                  Browse without signing in
                </Link>
              </div>
            </div>

            {/* Right: animated escrow ledger */}
            <div className="flex justify-center lg:justify-end">
              <EscrowLedger />
            </div>

          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="border-t border-slate-900 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-mono text-slate-600 uppercase tracking-widest text-center mb-12">
            How the protection works
          </p>

          {/* Three editorial columns separated by hairline dividers */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.num} className="px-0 md:px-10 py-10 md:py-0 first:pl-0 last:pr-0">
                <span className="text-xs font-mono text-slate-700 block mb-4">{item.num}</span>
                <h3 className="text-2xl font-black text-slate-50 mb-3">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Minimal CTA ──────────────────────────────────────────────────────── */}
      <section className="border-t border-slate-900 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg mx-auto text-center">
          <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-5">
            Ready to move?
          </p>
          <h2 className="text-4xl font-black text-slate-50 mb-3">
            Find your next home safely.
          </h2>
          <p className="text-slate-400 text-base mb-10">
            Browse listings. Pay with escrow protection. Move in with confidence.
          </p>
          <button
            onClick={handleCTA}
            className="inline-flex items-center gap-2 px-8 py-4 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-sm rounded-lg transition-colors"
          >
            {user ? 'Browse Listings' : 'Get Started'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Sign In Modal */}
      <SignInModal isOpen={signInModalOpen} onClose={() => setSignInModalOpen(false)} />
    </div>
  );
};
