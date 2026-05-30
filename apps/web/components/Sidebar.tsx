'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { logout } from '@/lib/api';
import { cn } from '@/lib/utils';

interface UserInfo {
  id: string;
  name: string;
  employeeId: string;
  role: string;
  storeId: string | null;
  ownedStores: { id: string; name: string }[];
}

const nav = [
  {
    label: 'Overview',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    label: 'Audit Sessions',
    href: '/dashboard/sessions',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    label: 'Discrepancy',
    href: '/dashboard/discrepancy',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: 'Workers',
    href: '/dashboard/workers',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Stores',
    href: '/dashboard/stores',
    ownerOnly: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    label: 'Reports',
    href: '/dashboard/reports',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
];

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-amber-500',
  ADMIN: 'bg-blue-500',
  STAFF: 'bg-slate-500',
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user_info');
      if (raw) {
        const info = JSON.parse(raw) as UserInfo;
        setUser(info);
        const saved = localStorage.getItem('selected_store_id');
        if (info.role === 'OWNER') {
          if (saved && info.ownedStores.some((s) => s.id === saved)) {
            setSelectedStoreId(saved);
          } else {
            setSelectedStoreId('');
          }
        }
      }
    } catch {}
  }, []);

  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
    if (storeId) {
      localStorage.setItem('selected_store_id', storeId);
    } else {
      localStorage.removeItem('selected_store_id');
    }
    window.dispatchEvent(new Event('store-changed'));
  };

  const handleLogout = async () => {
    await logout();
    Cookies.remove('auth_token');
    Cookies.remove('user_role');
    localStorage.removeItem('user_info');
    localStorage.removeItem('selected_store_id');
    router.push('/');
  };

  const currentStoreName = user?.role === 'OWNER'
    ? (selectedStoreId
        ? user.ownedStores.find((s) => s.id === selectedStoreId)?.name ?? 'All Stores'
        : 'All Stores')
    : null;

  return (
    <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col min-h-screen fixed left-0 top-0">
      {/* Brand */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm">LiquorSafe</p>
            <p className="text-slate-500 text-xs">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      {user && (
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">{user.name.split(' ')[0]}</p>
              <p className="text-slate-500 text-xs">{user.employeeId}</p>
            </div>
          </div>
          <span className={cn('inline-block text-xs font-semibold text-white px-2 py-0.5 rounded-full', ROLE_COLORS[user.role] ?? 'bg-slate-500')}>
            {user.role}
          </span>
        </div>
      )}

      {/* OWNER: Store Selector */}
      {user?.role === 'OWNER' && user.ownedStores.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-800">
          <p className="text-slate-500 text-xs mb-1.5">Store</p>
          <select
            value={selectedStoreId}
            onChange={(e) => handleStoreChange(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Stores</option>
            {user.ownedStores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {currentStoreName && (
            <p className="text-slate-500 text-xs mt-1 truncate">Viewing: {currentStoreName}</p>
          )}
        </div>
      )}

      {/* ADMIN: Show store name */}
      {user?.role === 'ADMIN' && (
        <div className="px-4 py-3 border-b border-slate-800">
          <p className="text-slate-500 text-xs mb-0.5">Store</p>
          <p className="text-slate-300 text-xs font-medium truncate">
            {user.ownedStores?.[0]?.name ?? 'Assigned Store'}
          </p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {nav.filter((item) => !(item as any).ownerOnly || user?.role === 'OWNER').map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
