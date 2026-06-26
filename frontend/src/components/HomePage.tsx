import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Building2, Shield, Zap, BarChart3, ArrowRight, ChevronRight, Lock, Star
} from 'lucide-react';

const FEATURES = [
  {
    icon: Shield,
    title: 'Escrow Protection',
    desc: 'Funds are held securely in escrow until landlord verification is approved by an admin.',
    color: 'from-brand-500/20 to-brand-600/10 border-brand-500/20',
    iconColor: 'text-brand-400',
  },
  {
    icon: Zap,
    title: 'Instant Split Transfers',
    desc: 'Upon approval, rent is automatically split and disbursed to landlord, agent, and platform.',
    color: 'from-purple-500/20 to-purple-600/10 border-purple-500/20',
    iconColor: 'text-purple-400',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Tracking',
    desc: 'Track your payment status live, from escrow to disbursement, with Firestore listeners.',
    color: 'from-blue-500/20 to-blue-600/10 border-blue-500/20',
    iconColor: 'text-blue-400',
  },
  {
    icon: Lock,
    title: 'Automatic Refunds',
    desc: 'If verification fails or times out, your full payment is automatically refunded.',
    color: 'from-orange-500/20 to-orange-600/10 border-orange-500/20',
    iconColor: 'text-orange-400',
  },
];

export const HomePage: React.FC = () => {
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleCTA = async () => {
    if (user) {
      navigate('/listings');
    } else {
      try {
        await signInWithGoogle();
        navigate('/listings');
      } catch {}
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-brand-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold uppercase tracking-widest mb-8">
            <Star className="w-3.5 h-3.5" />
            Powered by Nomba Payment API
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-slate-100 leading-tight mb-6">
            Pay Rent.{' '}
            <span className="bg-gradient-to-r from-brand-400 via-brand-300 to-green-300 bg-clip-text text-transparent">
              Trust Escrow.
            </span>
            <br /> Get Peace of Mind.
          </h1>

          <p className="text-slate-400 text-xl leading-relaxed max-w-2xl mx-auto mb-10">
            Rent Split Escrow protects tenants and landlords with automated escrow holding,
            verification-based disbursements, and instant refunds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleCTA}
              className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white text-base font-bold rounded-2xl shadow-xl shadow-brand-500/30 hover:shadow-brand-500/50 transition-all duration-200 active:scale-95"
            >
              {user ? 'Browse Listings' : 'Get Started — It\'s Free'}
              <ArrowRight className="w-5 h-5" />
            </button>
            <Link
              to="/listings"
              className="flex items-center gap-2 px-8 py-4 bg-slate-800/60 hover:bg-slate-700/60 text-slate-200 text-base font-semibold rounded-2xl border border-slate-700/60 hover:border-slate-600 transition-all duration-200"
            >
              <Building2 className="w-5 h-5" />
              Browse Without Sign-In
            </Link>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-slate-100 mb-3">Everything you need</h2>
            <p className="text-slate-400">A complete rent payment ecosystem, built on trust and transparency.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="glass-panel glass-panel-hover rounded-2xl p-6">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} border flex items-center justify-center mb-4`}>
                    <Icon className={`w-6 h-6 ${f.iconColor}`} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-100 mb-2">{f.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-slate-100 mb-3">How it works</h2>
            <p className="text-slate-400">Simple, transparent, and secure in 5 steps.</p>
          </div>
          <div className="space-y-4">
            {[
              { n: '01', title: 'Find a Listing', desc: 'Browse verified active property listings, no account needed.' },
              { n: '02', title: 'Pay via Nomba Checkout', desc: 'Sign in and complete secure payment via Nomba checkout gateway.' },
              { n: '03', title: 'Funds Held in Escrow', desc: 'Your payment is held safely while landlord submits verification documents.' },
              { n: '04', title: 'Admin Verification', desc: 'Admin reviews uploaded documents and approves or rejects the listing.' },
              { n: '05', title: 'Automatic Disbursement', desc: 'On approval: rent is split and transferred. On rejection: full refund to you.' },
            ].map((step) => (
              <div key={step.n} className="flex gap-5 items-start group">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-600/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0 group-hover:border-brand-500/40 transition-colors">
                  <span className="text-brand-400 font-black text-sm">{step.n}</span>
                </div>
                <div className="pt-2.5">
                  <h3 className="text-base font-bold text-slate-100 mb-1">{step.title}</h3>
                  <p className="text-slate-400 text-sm">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="glass-panel rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-blue-500/5 pointer-events-none" />
            <h2 className="text-3xl font-extrabold text-slate-100 mb-3 relative">Ready to pay rent securely?</h2>
            <p className="text-slate-400 mb-8 relative">Join the platform trusted to keep both tenants and landlords protected.</p>
            <Link to="/listings" className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white font-bold rounded-2xl shadow-lg shadow-brand-500/30 transition-all duration-200 active:scale-95 relative">
              Explore Listings
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
