'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<'form' | 'done'>('form');

  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState<{ employeeId: string; pin: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/setup/status`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ready) router.replace('/');
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) { setError('PIN must be 4–6 digits'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName: storeName.trim(), ownerName: ownerName.trim(), pin }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Setup failed'); return; }
      setCredentials(data.credentials);
      setStep('done');
    } catch {
      setError('Setup failed. Is the API running?');
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (step === 'done' && credentials) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <img src="/icon.png" alt="LiquorSafe" className="w-20 h-20 rounded-2xl mb-0 shadow-lg" />
            <h1 className="text-2xl font-bold text-white">Setup Complete!</h1>
            <p className="text-slate-400 text-sm mt-1">Save your credentials before continuing</p>
          </div>

          <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700">
            <div className="bg-amber-900/40 border border-amber-700 rounded-xl p-3 mb-5">
              <p className="text-amber-300 text-xs font-semibold">⚠ Save these credentials now</p>
              <p className="text-amber-400 text-xs mt-0.5">Your PIN is hashed — it cannot be retrieved again. Screenshot or write it down.</p>
            </div>

            <div className="space-y-3 mb-5">
              {[
                { label: 'Employee ID', value: credentials.employeeId, key: 'id' },
                { label: 'PIN', value: credentials.pin, key: 'pin' },
              ].map(({ label, value, key }) => (
                <div key={key}>
                  <p className="text-slate-400 text-xs mb-1">{label}</p>
                  <div className="flex items-center gap-2 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5">
                    <span className="flex-1 font-mono text-white text-sm tracking-widest">{value}</span>
                    <button
                      onClick={() => copyText(value, key)}
                      className="text-xs text-slate-400 hover:text-blue-400 transition-colors font-medium"
                    >
                      {copied === key ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/"
              className="block w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors text-center"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/icon.png" alt="LiquorSafe" className="w-20 h-20 rounded-2xl mb-0 shadow-lg" />
          <h1 className="text-2xl font-bold text-white">LiquorSafe Setup</h1>
          <p className="text-slate-400 text-sm mt-1">Create your owner account to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Store Name</label>
            <input
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="e.g. City Wines &amp; Spirits"
              required
              minLength={2}
              className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Your Name (Owner)</label>
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              required
              minLength={2}
              className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Set Your PIN (4–6 digits)</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••"
              inputMode="numeric"
              autoComplete="new-password"
              required
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
            disabled={loading || pin.length < 4}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
          >
            {loading
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</>
              : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-slate-500 text-xs mt-4">
          Already have an account?{' '}
          <Link href="/" className="text-slate-400 hover:text-white underline transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
