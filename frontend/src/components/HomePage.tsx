import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useHeaderTheme } from '../contexts/HeaderThemeContext';
import { ArrowRight, CheckCircle2, ShieldCheck, Zap, Scale, Eye, HelpCircle, X } from 'lucide-react';
import { SignInModal } from './SignInModal';

// ─── Refined Product Demo Widget ──────────────────────────────────────────────

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
    statusClass: 'text-amber-600',
    progress: 20,
    disbursements: null,
  },
  {
    id: 'submitted',
    status: 'DOCS SUBMITTED',
    label: 'Admin reviewing ownership papers.',
    dotClass: 'bg-blue-400',
    statusClass: 'text-blue-600',
    progress: 55,
    disbursements: null,
  },
  {
    id: 'verified',
    status: 'VERIFIED',
    label: 'Landlord confirmed. Splitting funds.',
    dotClass: 'bg-brand-400',
    statusClass: 'text-brand-600',
    progress: 82,
    disbursements: null,
  },
  {
    id: 'completed',
    status: 'DISBURSED',
    label: 'All transfers complete.',
    dotClass: 'bg-brand-500',
    statusClass: 'text-brand-600',
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
    <div className="relative w-full max-w-sm mx-auto lg:mx-0 group">
      <div className="absolute -inset-4 bg-gradient-to-tr from-brand-500/20 to-nomba-500/20 rounded-[2.5rem] blur-2xl pointer-events-none group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl shadow-slate-200/50">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-300" />
            <span className="w-2 h-2 rounded-full bg-slate-300" />
            <span className="w-2 h-2 rounded-full bg-slate-300" />
          </div>
          <span className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">Secure Vault · RV-0847</span>
        </div>

        <div className="p-8">
          <div className="mb-8">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-widest block mb-1">Current Transaction</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-slate-900 tracking-tight">₦850,000</span>
              <span className="text-xs font-medium text-slate-500">/ year</span>
            </div>
            <div className="text-xs font-medium text-slate-400 mt-1">Lekki Phase 1, Lagos</div>
          </div>

          <div
            className="flex items-center gap-3 mb-6 transition-all duration-300"
            style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(4px)' }}
          >
            <span className={`w-2 h-2 rounded-full ${current.dotClass} animate-pulse`} />
            <span className={`text-xs font-bold uppercase tracking-widest ${current.statusClass}`}>
              {current.status}
            </span>
          </div>

          <div className="h-1.5 bg-slate-100 rounded-full mb-4 overflow-hidden">
            <div
              className="h-full bg-slate-900 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${current.progress}%` }}
            />
          </div>

          <p
            className="text-sm text-slate-500 mb-8 transition-all duration-300"
            style={{ opacity: visible ? 1 : 0 }}
          >
            {current.label}
          </p>

          <div className="space-y-3">
            {current.disbursements
              ? current.disbursements.map((d) => (
                  <div key={d.label} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-brand-500" />
                      <span className="text-sm font-medium text-slate-700">{d.label}</span>
                      <span className="text-xs font-mono text-slate-400">{d.pct}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{d.amount}</span>
                  </div>
                ))
              : PENDING_ROWS.map((r) => (
                  <div key={r.label} className="flex items-center justify-between p-3 rounded-xl border border-dashed border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200" />
                      <span className="text-sm font-medium text-slate-400">{r.label}</span>
                      <span className="text-xs font-mono text-slate-300">{r.pct}</span>
                    </div>
                    <span className="text-xs font-medium text-slate-300">Pending</span>
                  </div>
                ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 mt-6">
        {ESCROW_STATES.map((_, i) => (
          <span
            key={i}
            className={`h-1 rounded-full transition-all duration-500 ${
              i === stateIndex ? 'bg-slate-900 w-6' : 'bg-slate-200 w-2'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

const HOW_IT_WORKS = [
  {
    num: '01',
    title: 'Secure Escrow',
    body: 'Your payment is held in a regulated vault powered by Nomba. Funds are never sent directly to the landlord until ownership is verified.',
  },
  {
    num: '02',
    title: 'Independent Audit',
    body: 'Our admins review legal titles and ownership papers. No approval means no access to funds, ensuring total protection.',
  },
  {
    num: '03',
    title: 'Precision Payout',
    body: 'Once verified, the agreed split is executed automatically. Landlords, agents, and the platform receive their exact share instantly.',
  },
];

const FAQS = [
  {
    q: 'What happens if the landlord is not verified?',
    a: 'If our administrative audit fails to verify the legal ownership of the property, the escrow contract is voided and 100% of your funds are returned to your account immediately.',
  },
  {
    q: 'How long does the verification process take?',
    a: 'On average, ownership verification takes 48-72 hours. We work directly with government registries to ensure the data is authentic.',
  },
  {
    q: 'Is my money safe with RentVault?',
    a: 'Yes. We partner with Nomba to provide enterprise-grade financial rails. Your funds are held in regulated accounts, not in any individual\'s personal account.',
  },
  {
    q: 'Can I change the disbursement percentages?',
    a: 'The percentages are agreed upon at the time of the listing creation. Any changes must be digitally signed by both the tenant and the landlord through the platform.',
  },
];

const COMPARISON = [
  {
    feature: 'Payment Security',
    traditional: 'Direct Transfer to Agent/Landlord',
    rentvault: 'Regulated Nomba Escrow Vault',
    isWinning: true,
  },
  {
    feature: 'Ownership Proof',
    traditional: 'Trusting provided documents',
    rentvault: 'Independent Administrative Audit',
    isWinning: true,
  },
  {
    feature: 'Refund Guarantee',
    traditional: 'Depends on landlord\'s goodwill',
    rentvault: 'Automatic Contract Voiding',
    isWinning: true,
  },
  {
    feature: 'Payout Precision',
    traditional: 'Manual bank transfers',
    rentvault: 'Programmatic Automated Split',
    isWinning: true,
  },
];

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const { setTheme } = useHeaderTheme();
  const navigate = useNavigate();
  const [signInModalOpen, setSignInModalOpen] = useState(false);

  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const theme = entry.target.getAttribute('data-theme') as 'light' | 'dark';
            setTheme(theme || 'light');
          }
        });
      },
      { threshold: 0.3 }
    );

    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [setTheme]);

  const handleCTA = () => {
    if (user) navigate('/listings');
    else setSignInModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero (Light) ─────────────────────────────────────────────────────────────── */}
      <section 
        ref={(el) => { sectionRefs.current['hero'] = el; }}
        data-theme="light"
        className="relative min-h-screen flex items-center px-4 sm:px-6 lg:px-8 pt-16 overflow-hidden"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl opacity-50" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-nomba-500/10 rounded-full blur-3xl opacity-50" />
        </div>

        <div className="relative max-w-7xl mx-auto w-full py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-nomba-500 text-slate-950 text-[10px] font-bold uppercase tracking-wider mb-8 shadow-sm">
                <span className="w-1 h-1 rounded-full bg-slate-900" />
                Powered by Nomba 
              </div>
               <h1 className="text-6xl sm:text-7xl lg:text-[7.5rem] font-black text-slate-900 leading-[0.9] tracking-tighter mb-8">
                 Rent paid.<br />
                 <span className="text-brand-500">No fraud.</span><br />
                 Guaranteed.
               </h1>
              <p className="text-slate-600 text-xl leading-relaxed mb-12 max-w-lg">
                The gold standard for secure rentals in Nigeria. We protect your 
                payments with enterprise-grade escrow, ensuring you only pay 
                when the property is verified.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleCTA}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-base rounded-xl transition-all transform hover:scale-105 shadow-xl shadow-slate-200"
                >
                  {user ? 'Browse Listings' : 'Find a Listing'}
                  <ArrowRight className="w-5 h-5" />
                </button>
                <Link
                  to="/listings"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 font-medium text-base rounded-xl transition-all"
                >
                  Browse without signing in
                </Link>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <EscrowLedger />
            </div>
          </div>
        </div>
      </section>

      {/* ── Value Prop (Dark) ─────────────────────────────────────────────────────── */}
      <section 
        ref={(el) => { sectionRefs.current['value'] = el; }}
        data-theme="dark"
        className="bg-slate-950 py-32 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div className="relative">
              <div className="absolute -top-20 -left-20 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl" />
              <h2 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-8 relative">
                Banking the trust <br />
                <span className="text-brand-500">missing in rentals.</span>
              </h2>
              <p className="text-slate-400 text-xl leading-relaxed mb-12 relative">
                Rental fraud is an epidemic. Ghost agents and fake listings cost tenants millions. 
                We've built a financial fortress. By partnering with Nomba, we ensure that funds 
                stay in a secure vault until ownership is proven.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">Instant Refund</h4>
                    <p className="text-slate-400 text-sm">Verification fails? Money returns to you instantly.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-nomba-500/10 border border-nomba-500/20 flex items-center justify-center text-nomba-500">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">Nomba Secured</h4>
                    <p className="text-slate-400 text-sm">Funds held in regulated, industry-standard escrow.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 lg:p-12 backdrop-blur-sm">
              <div className="space-y-10">
                <div className="flex items-start gap-6">
                  <span className="text-nomba-500 font-black text-3xl font-mono">01</span>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Secure Deposit</h3>
                    <p className="text-slate-400 leading-relaxed">Deposit your rent into a dedicated vault. Your funds are temporarily locked and fully protected.</p>
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <span className="text-nomba-500 font-black text-3xl font-mono">02</span>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Strict Audit</h3>
                    <p className="text-slate-400 leading-relaxed">Our team manually verifies the property's legal title and the landlord's identity. No shortcuts.</p>
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <span className="text-nomba-500 font-black text-3xl font-mono">03</span>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Precision Payout</h3>
                    <p className="text-slate-400 leading-relaxed">Upon verification, the split is executed automatically. No manual requests, no delays.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it Works (Light) ─────────────────────────────────────────────────────── */}
      <section 
        ref={(el) => { sectionRefs.current['how'] = el; }}
        data-theme="light"
        className="bg-white py-32 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-6xl mx-auto">
            <div className="text-center mb-20">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-nomba-500 text-slate-950 text-xs font-bold uppercase tracking-widest mb-4 shadow-sm">
                <span className="w-1 h-1 rounded-full bg-slate-900" />
                The Protocol
              </div>
              <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">How the protection works</h2>
            </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.num} className="relative p-8 rounded-3xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-xl transition-all duration-300 group">
                <span className="text-sm font-mono font-bold text-slate-300 block mb-6 group-hover:text-brand-500 transition-colors">{item.num}</span>
                <h3 className="text-2xl font-black text-slate-900 mb-4">{item.title}</h3>
                <p className="text-slate-600 text-base leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Competitor Analysis (Dark) ─────────────────────────────────────────────────────── */}
      <section 
        ref={(el) => { sectionRefs.current['compare'] = el; }}
        data-theme="dark"
        className="bg-slate-950 py-32 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">
              The Truth Table
            </div>
            <h2 className="text-4xl lg:text-6xl font-black text-white tracking-tight">
              Stop gambling with <br />
              <span className="text-nomba-500">your hard-earned money.</span>
            </h2>
          </div>

          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-brand-500/20 via-nomba-500/20 to-brand-500/20 rounded-[2rem] blur-xl opacity-50" />
            
            <div className="relative bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800">
                    <th className="px-6 py-8 text-slate-400 font-bold uppercase tracking-widest text-xs">Feature</th>
                    <th className="px-6 py-8 text-slate-500 font-bold uppercase tracking-widest text-xs text-center">The Traditional Way</th>
                    <th className="px-6 py-8 text-nomba-500 font-black uppercase tracking-widest text-xs text-center bg-nomba-500/5">RentVault</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {COMPARISON.map((item, i) => (
                    <tr key={i} className="group hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-6 text-slate-300 font-bold text-base">{item.feature}</td>
                      <td className="px-6 py-6 text-slate-500 text-sm text-center leading-relaxed">
                        {item.traditional}
                      </td>
                      <td className="px-6 py-6 text-white text-sm text-center font-bold bg-nomba-500/5 relative">
                        {item.rentvault}
                        <div className="absolute top-2 right-2">
                          <CheckCircle2 className="w-4 h-4 text-nomba-500" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-950 border-t border-slate-800">
                    <td className="px-6 py-8 text-slate-400 font-bold uppercase tracking-widest text-xs">Verdict</td>
                    <td className="px-6 py-8 text-red-400 font-black text-center uppercase tracking-widest text-xs">High Risk</td>
                    <td className="px-6 py-8 text-nomba-500 font-black text-center uppercase tracking-widest text-xs bg-nomba-500/10">Enterprise Secure</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust & Infrastructure (Dark) ─────────────────────────────────────────── */}
      <section 
        ref={(el) => { sectionRefs.current['infra'] = el; }}
        data-theme="dark"
        className="bg-slate-950 py-32 px-4 sm:px-6 lg:px-8 overflow-hidden"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-24 items-center">
            <div className="lg:w-1/2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-8">
                Infrastructure
              </div>
              <h2 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-8">
                Built on Nomba's <br />
                <span className="text-nomba-500">enterprise rails.</span>
              </h2>
              <p className="text-slate-400 text-xl leading-relaxed mb-12">
                We don't just "promise" security. We leverage Nomba's proven financial 
                infrastructure to handle every transaction. Your funds are held 
                in regulated accounts, ensuring absolute safety.
              </p>
              <div className="p-8 bg-slate-900 border-l-4 border-nomba-500 rounded-r-2xl shadow-2xl">
                <p className="text-slate-300 text-lg italic font-medium leading-relaxed">
                  "By integrating RentVault with our payment layers, we're bringing 
                  unprecedented transparency to the Nigerian rental market."
                </p>
                <p className="text-slate-500 text-sm mt-6 font-bold">— Nomba Engineering</p>
              </div>
            </div>
            <div className="lg:w-1/2 grid grid-cols-2 gap-6">
              <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-nomba-500/30 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-nomba-500 mb-6">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-white mb-2">Encrypted</h4>
                  <p className="text-slate-400 text-sm">Bank-grade AES-256 encryption for all data.</p>
                </div>
              </div>
              <div className="p-8 rounded-3xl bg-brand-500 flex flex-col justify-between text-slate-950">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white mb-6">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold mb-2">Instant</h4>
                  <p className="text-slate-900/80 text-sm">Automated disbursement upon approval.</p>
                </div>
              </div>
              <div className="p-8 rounded-3xl bg-brand-500 flex flex-col justify-between text-slate-950">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white mb-6">
                  <Scale className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold mb-2">Fair</h4>
                  <p className="text-slate-900/80 text-sm">Agreed percentages are immutable.</p>
                </div>
              </div>
              <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-nomba-500/30 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-nomba-500 mb-6">
                  <Eye className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-white mb-2">Verified</h4>
                  <p className="text-slate-400 text-sm">Manual human review for every property.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ (Light) ─────────────────────────────────────────────────────────── */}
      <section 
        ref={(el) => { sectionRefs.current['faq'] = el; }}
        data-theme="light"
        className="bg-white py-32 px-4 sm:px-6 lg:px-8 border-t border-slate-100"
      >
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-4">
              <HelpCircle className="w-3 h-3" />
              Frequently Asked Questions
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Got questions? We have answers.</h2>
          </div>
          <div className="space-y-6">
            {FAQS.map((faq, i) => (
              <div key={i} className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-lg transition-all duration-300">
                <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                  {faq.q}
                </h3>
                <p className="text-slate-600 leading-relaxed pl-4 border-l-2 border-slate-200">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA (Light) ──────────────────────────────────────────────────────── */}
      <section 
        ref={(el) => { sectionRefs.current['cta'] = el; }}
        data-theme="light"
        className="bg-white py-32 px-4 sm:px-6 lg:px-8 border-t border-slate-100"
      >
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-8">
            Start Today
          </div>
          <h2 className="text-5xl lg:text-7xl font-black text-slate-900 mb-8 tracking-tighter">
            Find your next home <br />
            without the anxiety.
          </h2>
          <p className="text-slate-600 text-xl mb-12 max-w-xl mx-auto leading-relaxed">
            Join thousands of tenants who move in with confidence. Secure your future home with RentVault.
          </p>
          <button
            onClick={handleCTA}
            className="inline-flex items-center gap-3 px-12 py-6 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xl rounded-2xl transition-all transform hover:scale-105 shadow-2xl shadow-slate-300"
          >
            {user ? 'Browse Listings' : 'Start Searching'}
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </section>

      <SignInModal isOpen={signInModalOpen} onClose={() => setSignInModalOpen(false)} />
    </div>
  );
};
