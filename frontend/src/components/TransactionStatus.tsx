import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { formatAmount, formatDate, formatCountdown, getStatusLabel } from '../lib/errorHelper';
import {
  ArrowLeft, Clock, CheckCircle2, AlertCircle, Loader2, RefreshCw,
  TrendingUp, RotateCcw, Building2, User, BadgeCheck, DollarSign, Wifi, WifiOff,
  AlertTriangle
} from 'lucide-react';

interface Transaction {
  transactionId: string;
  listingId: string;
  tenantUid: string;
  landlordUid: string;
  agentUid?: string;
  amount: number;
  status: string;
  splitConfigSnapshot: {
    landlordPercentage: number;
    agentPercentage: number;
    platformPercentage: number;
  };
  verificationDeadline?: any;
  verificationDocumentUrl?: string;
  createdAt?: any;
  updatedAt?: any;
}

interface Disbursement {
  id: string;
  recipientType: 'landlord' | 'agent' | 'platform';
  amount: number;
  status: 'transfer_pending' | 'disbursed' | 'transfer_failed' | 'transfer_initiation_failed';
  nombaTransferReference?: string;
}

const STATUS_STEPS = [
  { key: 'pending_payment', label: 'Payment Initiated', icon: Clock },
  { key: 'funds_held', label: 'Funds in Escrow', icon: Building2 },
  { key: 'verification_submitted', label: 'Verification Submitted', icon: BadgeCheck },
  { key: 'verified', label: 'Verified', icon: CheckCircle2 },
  { key: 'completed', label: 'Disbursed', icon: DollarSign },
];

const REFUND_STEPS = [
  { key: 'refund_initiated', label: 'Refund Initiated' },
  { key: 'refunded', label: 'Refund Complete' },
];

const getStepIndex = (status: string) => STATUS_STEPS.findIndex((s) => s.key === status);

export const TransactionStatus: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const [retries, setRetries] = useState(0);
  const [countdown, setCountdown] = useState<{ text: string; urgent: boolean } | null>(null);

  // Real-time countdown timer
  useEffect(() => {
    if (!tx?.verificationDeadline) return;
    const tick = () => setCountdown(formatCountdown(tx.verificationDeadline));
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [tx?.verificationDeadline]);

  // Load disbursements directly from the transaction document's map field
  // (backend writes them as tx.disbursements = { landlord: {...}, agent: {...}, platform: {...} })

  useEffect(() => {
    if (!id) return;
    let retryCount = 0;
    const maxRetries = 5;
    let retryTimer: ReturnType<typeof setTimeout>;

    const subscribe = () => {
      const unsub = onSnapshot(
        doc(db, 'transactions', id),
        (snap) => {
          setConnectionLost(false);
          retryCount = 0;
          if (!snap.exists()) {
            setError('Transaction not found.');
            setLoading(false);
            return;
          }
          const data = { transactionId: snap.id, ...snap.data() } as Transaction;
          setTx(data);
          setLoading(false);

          // Derive disbursements from the map field on the transaction doc (live, via onSnapshot)
          if ((data as any).disbursements) {
            const list = Object.entries((data as any).disbursements).map(
              ([recipientType, d]: [string, any]) => ({
                id: recipientType,
                recipientType: recipientType as Disbursement['recipientType'],
                ...d,
              })
            );
            setDisbursements(list);
          } else {
            setDisbursements([]);
          }
        },
        (err) => {
          console.error('[TX_STATUS] Firestore error:', err);
          retryCount++;
          setRetries(retryCount);
          if (retryCount >= maxRetries) {
            setConnectionLost(true);
            setLoading(false);
          } else {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
            retryTimer = setTimeout(() => subscribe(), delay);
          }
        }
      );
      return unsub;
    };

    const unsub = subscribe();
    return () => {
      unsub();
      clearTimeout(retryTimer);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
          <p className="text-slate-400 text-sm">Loading transaction...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-4">
        <div className="glass-panel rounded-2xl p-8 max-w-md text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <p className="text-slate-300 font-medium">{error}</p>
          <button onClick={() => navigate('/listings')} className="inline-flex items-center gap-2 px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-xl text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Browse Listings
          </button>
        </div>
      </div>
    );
  }

  if (!tx) return null;

  const statusInfo = getStatusLabel(tx.status);
  const stepIndex = getStepIndex(tx.status);
  const isRefundFlow = ['refund_initiated', 'refunded', 'refund_failed', 'verification_rejected', 'verification_timeout'].includes(tx.status);
  const isFailureState = ['disbursement_partial_failure', 'refund_failed'].includes(tx.status);

    return (
      <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => navigate('/listings')} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-sm mb-8 transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Browse Listings
          </button>

        {/* Connection indicator */}
        {connectionLost && (
          <div className="flex items-center gap-2 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl mb-5 text-orange-300 text-sm">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span>Connection lost. Live updates paused. Retried {retries} times.</span>
            <button onClick={() => window.location.reload()} className="ml-auto text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        )}
        {!connectionLost && retries > 0 && (
          <div className="flex items-center gap-2 p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl mb-5 text-brand-300 text-xs">
            <Wifi className="w-3.5 h-3.5" />
            Reconnected. Live updates active.
          </div>
        )}

        {/* Critical failure banners (non-dismissible) */}
        {isFailureState && (
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl mb-5">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 font-semibold text-sm mb-1">
                {tx.status === 'disbursement_partial_failure' ? 'Some disbursements failed' : 'Refund failed'}
              </p>
              <p className="text-red-400/80 text-xs">
                Please contact support with Transaction ID: <span className="font-mono font-semibold">{tx.transactionId}</span>
              </p>
            </div>
          </div>
        )}

        {/* Status header */}
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden mb-8 shadow-sm">
          <div className={`h-2 ${isRefundFlow ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-brand-500 to-brand-400'}`} />
          <div className="p-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Transaction ID</p>
                <p className="font-mono text-sm text-slate-600 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg inline-block">{tx.transactionId}</p>
              </div>
              <div className={`px-4 py-2 rounded-2xl text-sm font-bold ${statusInfo.bg} ${statusInfo.color} flex-shrink-0 shadow-sm`}>
                {statusInfo.label}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Amount</p>
                <p className="font-mono font-black text-slate-900 text-lg">{formatAmount(tx.amount)}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Paid</p>
                <p className="text-sm font-bold text-slate-700">{formatDate(tx.createdAt)}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Updated</p>
                <p className="text-sm font-bold text-slate-700">{formatDate(tx.updatedAt)}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Split</p>
                <p className="text-xs font-bold text-slate-600">
                  {tx.splitConfigSnapshot?.landlordPercentage}% / {tx.splitConfigSnapshot?.agentPercentage}% / {tx.splitConfigSnapshot?.platformPercentage}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress stepper */}
        {!isRefundFlow && (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 mb-8 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-8">Payment Progress</h2>
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-100" />
              {STATUS_STEPS.map((step, i) => {
                const Icon = step.icon;
                const done = i < stepIndex;
                const active = i === stepIndex;
                return (
                  <div key={step.key} className={`relative flex items-start gap-4 pb-8 last:pb-0`}>
                    <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all ${done ? 'bg-brand-500 border-brand-500' : active ? 'bg-white border-brand-500 shadow-sm' : 'bg-white border-slate-200'}`}>
                      {done ? <CheckCircle2 className="w-5 h-5 text-white" /> : <Icon className={`w-4 h-4 ${active ? 'text-brand-500' : 'text-slate-300'}`} />}
                    </div>
                    <div className="pt-2">
                      <p className={`text-sm font-bold ${done || active ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</p>
                      {active && tx.status === 'funds_held' && countdown && (
                        <div className={`flex items-center gap-1.5 mt-1 text-xs font-bold ${countdown.urgent ? 'text-orange-500' : 'text-brand-500'}`}>
                          <Clock className="w-3 h-3" />
                          {countdown.text} for verification
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Refund flow */}
        {isRefundFlow && (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 mb-8 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <RotateCcw className="w-5 h-5 text-orange-500" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Refund Status</h2>
            </div>
            <div className="space-y-3">
              {REFUND_STEPS.map((step, i) => {
                const refundStepIdx = ['refund_initiated', 'refunded'].indexOf(tx.status);
                const done = i <= refundStepIdx;
                return (
                  <div key={step.key} className={`flex items-center gap-3 p-4 rounded-2xl ${done ? 'bg-orange-50 border border-orange-100' : 'bg-slate-50 border border-slate-100'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${done ? 'bg-orange-500' : 'bg-slate-300'}`}>
                      {done ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <div className="w-2 h-2 rounded-full bg-slate-400" />}
                    </div>
                    <span className={`text-sm font-bold ${done ? 'text-orange-700' : 'text-slate-500'}`}>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Disbursements breakdown */}
        {disbursements.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-brand-500" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Disbursement Breakdown</h2>
            </div>
            <div className="space-y-4">
              {disbursements.map((d) => {
                const statusColor = d.status === 'disbursed' ? 'text-brand-600' : d.status.includes('failed') ? 'text-red-600' : 'text-yellow-600';
                const statusIcon = d.status === 'disbursed' ? CheckCircle2 : d.status.includes('failed') ? AlertCircle : Loader2;
                const StatusIcon = statusIcon;
                return (
                  <div key={d.id} className={`flex items-center justify-between p-5 rounded-2xl ${d.status.includes('failed') ? 'bg-red-50 border border-red-100' : 'bg-slate-50 border border-slate-100'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${d.recipientType === 'landlord' ? 'bg-purple-100' : d.recipientType === 'agent' ? 'bg-orange-100' : 'bg-blue-100'}`}>
                        <User className={`w-5 h-5 ${d.recipientType === 'landlord' ? 'text-purple-600' : d.recipientType === 'agent' ? 'text-orange-600' : 'text-blue-600'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 capitalize">{d.recipientType}</p>
                        {d.nombaTransferReference && <p className="text-xs text-slate-400 font-mono">{d.nombaTransferReference}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-black text-slate-900 text-lg">{formatAmount(d.amount)}</p>
                      <div className={`flex items-center gap-1 text-xs font-bold ${statusColor} justify-end`}>
                        <StatusIcon className={`w-3 h-3 ${d.status === 'transfer_pending' ? 'animate-spin' : ''}`} />
                        {d.status.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
