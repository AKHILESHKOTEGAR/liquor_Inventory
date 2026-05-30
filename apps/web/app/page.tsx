'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '@/lib/api';
import Cookies from 'js-cookie';

export default function LoginPage() {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const id = employeeId.trim().toUpperCase();

    if (!/^EMP-\d{4}$/.test(id)) {
      setError('Employee ID must be in format EMP-0001');
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setError('PIN must be 4–6 digits');
      return;
    }

    setLoading(true);
    try {
      const res = await login(id, pin);
      const { token, user } = res.data;

      if (user.role === 'STAFF') {
        setError('Staff access is mobile-only. Please use the LiquorSafe mobile app.');
        return;
      }

      Cookies.set('auth_token', token, { expires: 1 });
      Cookies.set('user_role', user.role, { expires: 1 });
      localStorage.setItem('user_info', JSON.stringify({
        id: user.id,
        name: user.name,
        employeeId: user.employeeId,
        role: user.role,
        storeId: user.storeId ?? null,
        ownedStores: user.ownedStores ?? [],
      }));
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/icon.png" alt="LiquorSafe" className="w-20 h-20 rounded-2xl mb-0 shadow-lg" />
          <h1 className="text-2xl font-bold text-white">LiquorSafe</h1>
          <p className="text-slate-400 text-sm mt-1">Admin Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Employee ID
              </label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                placeholder="EMP-0001"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                4-Digit PIN
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••"
                inputMode="numeric"
                autoComplete="current-password"
                className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent tracking-widest"
              />
              <p className="text-xs text-slate-500 mt-1">{pin.length}/6 digits</p>
            </div>

            {error && (
              <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </form>

        <p className="text-center text-slate-500 text-xs mt-4">
          First time?{' '}
          <Link href="/setup" className="text-slate-400 hover:text-white underline transition-colors">
            Set up your account
          </Link>
        </p>
      </div>
    </div>
  );
}
