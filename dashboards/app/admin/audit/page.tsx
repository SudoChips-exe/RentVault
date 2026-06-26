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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Audit Logs</h1>
          <p className="text-sm text-slate-400">System-wide immutable record of critical actions.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden shadow-lg h-[70vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-800/60 flex items-center justify-between bg-slate-900">
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-emerald-400" />
            Action History
          </h2>
        </div>
        
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-900/40 text-slate-400 sticky top-0 z-10 backdrop-blur-xl">
              <tr>
                <th className="px-6 py-3 font-medium w-48">Timestamp</th>
                <th className="px-6 py-3 font-medium">Action</th>
                <th className="px-6 py-3 font-medium">Target ID</th>
                <th className="px-6 py-3 font-medium">Performed By</th>
                <th className="px-6 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No audit logs available.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 text-slate-400">{formatDate(l.createdAt)}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold uppercase tracking-wider">
                        {l.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{l.targetId}</td>
                    <td className="px-6 py-4 font-mono text-xs text-emerald-400">{l.performedBy}</td>
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
