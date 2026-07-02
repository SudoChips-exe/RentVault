'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../lib/errorHelper';
import { ScrollText, Loader2, AlertCircle } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  performedBy: string;
  targetId: string;
  details: string;
  createdAt: any;
}

// Mirrors the action-label derivation the backend's getAuditLogs endpoint
// used to do server-side - eventType is one of a handful of generic
// buckets, so surface the more specific status/action from metadata when
// available instead of showing e.g. "transaction_status_change" for every row.
function deriveAction(eventType: string, metadata: Record<string, any> | undefined): string {
  const meta = metadata || {};
  if (eventType === 'transaction_status_change' && meta.newStatus) return meta.newStatus;
  if (eventType === 'verification_action' && meta.action) return meta.action;
  return eventType;
}

export default function AdminAuditLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'admin') return;

    const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(100));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLogs(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              action: deriveAction(data.eventType, data.metadata),
              performedBy: data.actor,
              targetId: data.transactionId || '-',
              details: data.description,
              createdAt: data.timestamp,
            };
          })
        );
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('[AUDIT_LOG] Firestore error:', err);
        setError('Failed to load audit logs. Please try again.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const getActionStyle = (action: string) => {
    if (action.includes('checkout') || action.includes('payment')) return 'bg-blue-50 text-blue-700 border-blue-100';
    if (action.includes('held') || action.includes('escrow')) return 'bg-amber-50 text-amber-700 border-amber-100';
    if (action.includes('approved') || action.includes('verified') || action.includes('disburs')) return 'bg-brand-50 text-brand-700 border-brand-100';
    if (action.includes('refund') || action.includes('reject') || action.includes('timeout')) return 'bg-orange-50 text-orange-700 border-orange-100';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

    return (
      <div className="space-y-8 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Audit Logs</h1>
            <p className="text-slate-500 text-sm mt-1">System-wide immutable record of critical actions, updated live.</p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm h-[70vh] flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-brand-500" />
              Action History
            </h2>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] w-48">Timestamp</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Action</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Target ID</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Performed By</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-24 text-center">
                      <ScrollText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                      <p className="font-bold text-slate-500">No audit events yet</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Events appear here as transactions move through the escrow lifecycle.
                      </p>
                    </td>
                  </tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-500">{formatDate(l.createdAt)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getActionStyle(l.action)}`}>
                          {l.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{l.targetId}</td>
                      <td className="px-6 py-4 font-mono text-xs text-brand-600 font-bold">{l.performedBy}</td>
                      <td className="px-6 py-4 whitespace-normal text-xs text-slate-500 max-w-md">{l.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
