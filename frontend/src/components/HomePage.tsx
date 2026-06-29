import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Building2, Shield, Zap, BarChart3, ArrowRight, ChevronRight, Lock, Star
} from 'lucide-react';
import { SignInModal } from './SignInModal';

const FEATURES = [
  {
    icon: Shield,
    title: 'Escrow Protection',
    desc: 'Funds are held securely in escrow until landlord verification is approved by an admin.',
  },
  {
    icon: Zap,
    title: 'Instant Split Transfers',
    desc: 'Upon approval, rent is automatically split and disbursed to landlord, agent, and platform.',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Tracking',
    desc: 'Track your payment status live, from escrow to disbursement, with Firestore listeners.',
  },
  {
    icon: Lock,
    title: 'Automatic Refunds',
    desc: 'If verification fails or times out, your full payment is automatically refunded.',
  },
];

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [signInModalOpen, setSignInModalOpen] = useState(false);

  const handleCTA = () => {
    if (user) {
      navigate('/listings');
    } else {
      setSignInModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium uppercase tracking-widest mb-10">
            <Star className="w-3.5 h-3.5 text-brand-500" />
            Powered by Nomba Payment API
          </div>

          <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black text-slate-50 tracking-tight leading-[1.05] mb-8">
            Pay Rent. Trust Escrow.
            <br />
            <span className="text-brand-500">Get Peace of Mind.</span>
          </h1>

          <p className="text-slate-400 text-xl leading-relaxed max-w-2xl mx-auto mb-12">
            RentVault protects tenants and landlords with automated escrow holding,
            verification-based disbursements, and instant refunds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleCTA}
              className="flex items-center gap-2 px-8 py-4 bg-white text-slate-900 hover:bg-slate-100 text-base font-bold rounded-lg transition-colors"
            >
              {user ? 'Browse Listings' : 'Get Started'}
              <ArrowRight className="w-5 h-5" />
            </button>
            <Link
              to="/listings"
              className="flex items-center gap-2 px-8 py-4 bg-slate-900 hover:bg-slate-800 text-slate-200 text-base font-medium rounded-lg border border-slate-800 transition-colors"
            >
              <Building2 className="w-5 h-5" />
              Browse Without Sign-In
            </Link>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-50 mb-4">Everything you need</h2>
            <p className="text-slate-400 text-lg">A complete rent payment ecosystem, built on trust and transparency.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 hover:bg-slate-900 transition-colors">
                  <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center mb-6">
                    <Icon className="w-6 h-6 text-brand-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-50 mb-3">{f.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-900">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-50 mb-4">How it works</h2>
            <p className="text-slate-400 text-lg">Simple, transparent, and secure in 5 steps.</p>
          </div>
          <div className="space-y-6">
            {[
              { n: '01', title: 'Find a Listing', desc: 'Browse verified active property listings, no account needed.' },
              { n: '02', title: 'Pay via Nomba Checkout', desc: 'Sign in and complete secure payment via Nomba checkout gateway.' },
              { n: '03', title: 'Funds Held in Escrow', desc: 'Your payment is held safely while landlord submits verification documents.' },
              { n: '04', title: 'Admin Verification', desc: 'Admin reviews uploaded documents and approves or rejects the listing.' },
              { n: '05', title: 'Automatic Disbursement', desc: 'On approval: rent is split and transferred. On rejection: full refund to you.' },
            ].map((step) => (
              <div key={step.n} className="flex gap-6 items-start">
                <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0">
                  <span className="text-slate-300 font-bold text-lg">{step.n}</span>
                </div>
                <div className="pt-3">
                  <h3 className="text-lg font-semibold text-slate-50 mb-2">{step.title}</h3>
                  <p className="text-slate-400">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-900">
        <div className="max-w-4xl mx-auto">
          <div className="bg-brand-600 rounded-2xl p-10 sm:p-16 text-center">
            <h2 className="text-4xl font-bold text-white mb-4">Ready to pay rent securely?</h2>
            <p className="text-brand-100 text-lg mb-10">Join the platform trusted to keep both tenants and landlords protected.</p>
            <button onClick={handleCTA} className="inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-slate-100 text-brand-700 font-bold rounded-lg transition-colors">
              Get Started
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Sign In Modal */}
      <SignInModal 
        isOpen={signInModalOpen} 
        onClose={() => setSignInModalOpen(false)} 
      />
    </div>
  );
};
