'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSession, closeSession, verifySession } from '@/lib/api';
import { DiscrepancyMatrix } from '@/components/DiscrepancyMatrix';
import { cn, formatDate, statusColor } from '@/lib/utils';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import Cookies from 'js-cookie';

function SurplusNotesModal({ onConfirm, onCancel }: { onConfirm: (notes: string) => void; onCancel: () => void }) {
  const [notes, setNotes] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Surplus Detected</h3>
            <p className="text-xs text-slate-500">More bottles scanned than expected. Explain before closing.</p>
          </div>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Explain the surplus (e.g. returned bottles, counting error, new delivery not yet recorded...)"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
          rows={4}
        />
        <p className="text-xs text-slate-400 mt-1">{notes.length}/500 chars · min 5 required</p>
        <div className="flex gap-2 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => notes.trim().length >= 5 && onConfirm(notes.trim())}
            disabled={notes.trim().length < 5}
            className="flex-1 px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg font-medium transition-colors"
          >
            Close with Notes
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SessionDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const qc = useQueryClient();
  const [showSurplusModal, setShowSurplusModal] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const userRole = Cookies.get('user_role');

  const { data, isLoading } = useQuery({
    queryKey: ['session', id],
    queryFn: () => getSession(id).then((r) => r.data),
  });

  const closeMutation = useMutation({
    mutationFn: (surplusNotes?: string) => closeSession(id, surplusNotes),
    onSuccess: () => {
      setShowSurplusModal(false);
      setCloseError(null);
      qc.invalidateQueries({ queryKey: ['session', id] });
      qc.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (err: any) => {
      const data = err.response?.data;
      if (data?.hasSurplus) {
        setShowSurplusModal(true);
      } else {
        setCloseError(data?.error ?? 'Failed to close session');
      }
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifySession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session', id] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const session = data?.session;
  if (!session) return <div className="text-red-500">Session not found.</div>;

  const { summary } = session;
  const canVerify = (userRole === 'ADMIN' || userRole === 'OWNER') && session.status === 'CLOSED' && !session.verifiedBy;

  return (
    <div>
      {showSurplusModal && (
        <SurplusNotesModal
          onConfirm={(notes) => closeMutation.mutate(notes)}
          onCancel={() => setShowSurplusModal(false)}
        />
      )}

      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to sessions
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 font-mono">{session.sessionCode}</h1>
            <span className={cn('text-xs font-medium px-2 py-1 rounded-full', statusColor(session.status))}>
              {session.status}
            </span>
            {session.verifiedBy && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                Verified
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Started {formatDate(session.startedAt)} by {session.user.name} ({session.user.employeeId})
          </p>
          {session.surplusNotes && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2 max-w-lg">
              Surplus note: {session.surplusNotes}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {session.status === 'ACTIVE' && (
            <button
              onClick={() => {
                if (confirm('Close this audit session? This action cannot be undone.')) {
                  closeMutation.mutate(undefined);
                }
              }}
              disabled={closeMutation.isPending}
              className="bg-amber-500 hover:bg-amber-400 disabled:bg-slate-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {closeMutation.isPending ? 'Closing...' : 'Close Session'}
            </button>
          )}
          {canVerify && (
            <button
              onClick={() => {
                if (confirm('Mark this session as verified by you?')) {
                  verifyMutation.mutate();
                }
              }}
              disabled={verifyMutation.isPending}
              className="bg-green-600 hover:bg-green-500 disabled:bg-slate-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {verifyMutation.isPending ? 'Verifying...' : 'Verify Session'}
            </button>
          )}
        </div>
      </div>

      {closeError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
          {closeError}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Scans', value: summary.totalScans },
          { label: 'Unique Bottles', value: summary.uniqueBottles },
          { label: 'Duplicate Attempts', value: summary.duplicateAttempts },
          { label: 'Workers', value: summary.workerCount },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
            <p className="text-2xl font-bold font-mono text-slate-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Workers */}
      {summary.workers.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Active Workers</p>
          <div className="flex flex-wrap gap-2">
            {summary.workers.map((w: string) => (
              <span key={w} className="bg-blue-50 text-blue-700 text-xs font-medium font-mono px-2 py-1 rounded-md">
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Discrepancy matrix */}
      <DiscrepancyMatrix sessionId={id} />
    </div>
  );
}
