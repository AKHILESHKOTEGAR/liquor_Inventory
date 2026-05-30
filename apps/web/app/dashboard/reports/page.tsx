'use client';

import { useState } from 'react';
import { downloadMonthlyReport } from '@/lib/api';

export default function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  const handleDownload = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await downloadMonthlyReport(year, month);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `collection-${monthNames[month - 1]}-${year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      if (e.response?.data) {
        try {
          const text = await e.response.data.text?.();
          const parsed = JSON.parse(text ?? '{}');
          setError(parsed.error ?? 'Download failed');
        } catch {
          setError('Download failed');
        }
      } else {
        setError('Download failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full border border-slate-200 text-slate-900 text-sm rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-500 text-sm mt-0.5">Generate monthly collection reports for the store owner</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 max-w-md">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-slate-900 font-semibold text-sm">Monthly Collection PDF</p>
            <p className="text-slate-500 text-xs">Brand-wise counts + worker activity</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-slate-600 text-xs font-medium mb-1.5">Month</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={inputCls}>
              {monthNames.map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 text-xs font-medium mb-1.5">Year</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputCls}>
              {years.map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-red-600 text-xs bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            onClick={handleDownload}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download {monthNames[month - 1]} {year}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 max-w-md">
        <p className="text-slate-500 text-xs font-semibold mb-3 uppercase tracking-wider">Report includes</p>
        <ul className="space-y-2">
          {[
            'Brand-wise bottle count for the month',
            'All audit sessions in the period',
            'Worker activity — sessions & scans per staff',
            'Store and period summary header',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
              <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
