'use client';

import { useQuery } from '@tanstack/react-query';
import { getSessions } from '@/lib/api';
import { DiscrepancyMatrix } from '@/components/DiscrepancyMatrix';
import { useState } from 'react';

export default function DiscrepancyPage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  const { data } = useQuery({
    queryKey: ['sessions-closed'],
    queryFn: () => getSessions({ status: 'CLOSED', limit: 50 }).then((r) => r.data),
  });

  const sessions = data?.sessions ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Discrepancy Analysis</h1>
        <p className="text-slate-500 text-sm mt-1">Select a closed session to view the reconciliation matrix</p>
      </div>

      {/* Session selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 mb-2">Audit Session</label>
        <select
          value={selectedSessionId}
          onChange={(e) => setSelectedSessionId(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">— Select a session —</option>
          {sessions.map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.sessionCode} — {new Date(s.startedAt).toLocaleDateString('en-IN')} ({s._count.scanLogs} scans)
            </option>
          ))}
        </select>
      </div>

      {selectedSessionId ? (
        <DiscrepancyMatrix sessionId={selectedSessionId} />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-slate-400 text-sm">Select a session above to see discrepancy data.</p>
        </div>
      )}
    </div>
  );
}
