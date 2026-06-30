'use client';

import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatDate, parseFirebaseError } from '../../lib/errorHelper';
import { ScrollText, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  performedBy: string;
  targetId: string;
  details: string;
  createdAt: any;
}

export default function AdminAuditLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      const getLogs = httpsCallable<any, { logs: AuditLog[] }>(functions, 'adminGetAuditLogs');
      const res = await getLogs();
      setLogs(res.data.logs);
      setError(null);
    } catch (err) {
      setError(parseFirebaseError(err).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchLogs();
    }
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

    return (
      <div className="space-y-8 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Audit Logs</h1>
            <p className="text-slate-500 text-sm mt-1">System-wide immutable record of critical actions.</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-2xl transition-all shadow-sm disabled:opacity-50 active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
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
                    <td colSpan={5} className="px-6 py-24 text-center text-slate-400 font-medium">
                      No audit logs available.
                    </td>
                  </tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-500">{formatDate(l.createdAt)}</td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider border border-slate-200">
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
