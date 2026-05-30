'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSessions } from '@/lib/api';
import { SessionCard } from '@/components/SessionCard';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const STATUS_FILTERS = ['ALL', 'ACTIVE', 'CLOSED', 'ARCHIVED'];

export default function SessionsPage() {
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  useEffect(() => {
    const onStoreChange = () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    };
    window.addEventListener('store-changed', onStoreChange);
    return () => window.removeEventListener('store-changed', onStoreChange);
  }, [queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: ['sessions', status, page],
    queryFn: () =>
      getSessions({
        status: status === 'ALL' ? undefined : status,
        page,
        limit: 12,
      }).then((r) => r.data),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Sessions</h1>
          <p className="text-slate-500 text-sm mt-1">
            {data?.total ?? 0} total sessions
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit mb-6">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              status === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : data?.sessions?.length ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.sessions.map((session: any) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>

          {/* Pagination */}
          {data.total > 12 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {page} of {Math.ceil(data.total / 12)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(data.total / 12)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
          </svg>
          <p className="text-slate-400 text-sm">No sessions found.</p>
        </div>
      )}
    </div>
  );
}
