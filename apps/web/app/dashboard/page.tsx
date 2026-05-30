'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getSessions, getBrands, getStoreSummary } from '@/lib/api';
import { StatsCard } from '@/components/StatsCard';
import { SessionCard } from '@/components/SessionCard';

interface StoreSummary {
  storeId: string;
  storeName: string;
  activeSessions: number;
  totalBoxes: number;
  totalBottles: number;
}

function getUserInfo() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user_info');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    const info = getUserInfo();
    if (info) setUserRole(info.role);

    const onStoreChange = () => {
      queryClient.invalidateQueries();
    };
    window.addEventListener('store-changed', onStoreChange);
    return () => window.removeEventListener('store-changed', onStoreChange);
  }, [queryClient]);

  const { data: sessionsData } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => getSessions({ limit: 5 }).then((r) => r.data),
  });

  const { data: brandsData } = useQuery({
    queryKey: ['brands'],
    queryFn: () => getBrands().then((r) => r.data),
  });

  const { data: summaryData } = useQuery({
    queryKey: ['store-summary'],
    queryFn: () => getStoreSummary().then((r) => r.data),
    enabled: userRole === 'OWNER',
  });

  const activeSessions = sessionsData?.sessions?.filter((s: any) => s.status === 'ACTIVE').length ?? 0;
  const totalSessions = sessionsData?.total ?? 0;
  const totalBrands = brandsData?.brands?.length ?? 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Inventory audit overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Active Sessions"
          value={activeSessions}
          sub="Currently running"
          accent="bg-green-500"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" /></svg>}
        />
        <StatsCard
          title="Total Sessions"
          value={totalSessions}
          sub="All time"
          accent="bg-blue-500"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" /></svg>}
        />
        <StatsCard
          title="Product SKUs"
          value={totalBrands}
          sub="Active brands"
          accent="bg-purple-500"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>}
        />
        <StatsCard
          title="System Status"
          value="Online"
          sub="All services healthy"
          accent="bg-emerald-500"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* OWNER: Cross-store summary */}
      {userRole === 'OWNER' && summaryData?.summary && (
        <div className="mb-8">
          <h2 className="text-base font-semibold text-slate-800 mb-3">Store Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {summaryData.summary.map((store: StoreSummary) => (
              <div key={store.storeId} className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="font-semibold text-slate-800 text-sm mb-3">{store.storeName}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-green-600">{store.activeSessions}</p>
                    <p className="text-xs text-slate-500">Active</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-blue-600">{store.totalBoxes}</p>
                    <p className="text-xs text-slate-500">Boxes</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-purple-600">{store.totalBottles}</p>
                    <p className="text-xs text-slate-500">Bottles</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div>
        <h2 className="text-base font-semibold text-slate-800 mb-3">Recent Sessions</h2>
        {sessionsData?.sessions?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sessionsData.sessions.map((session: any) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <p className="text-slate-400 text-sm">No audit sessions yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
