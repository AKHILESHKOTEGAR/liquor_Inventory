'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { Sidebar } from '@/components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const role = Cookies.get('user_role');
    const token = Cookies.get('auth_token');
    if (!token || !role) {
      router.replace('/');
      return;
    }
    if (role === 'STAFF') {
      Cookies.remove('auth_token');
      Cookies.remove('user_role');
      router.replace('/');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-60 min-h-screen">
        <div className="max-w-7xl mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}
