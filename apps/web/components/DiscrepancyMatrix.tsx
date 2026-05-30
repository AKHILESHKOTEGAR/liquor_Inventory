'use client';

import { useQuery } from '@tanstack/react-query';
import { getDiscrepancy, exportPdf } from '@/lib/api';
import { cn, formatCurrency, downloadBlob } from '@/lib/utils';
import { useState } from 'react';

interface MatrixRow {
  brandId: string;
  brandName: string;
  size: string;
  expected: number;
  actual: number;
  variance: number;
  financialImpact: string;
  status: 'MATCH' | 'SHORTAGE' | 'SURPLUS';
}

interface Props {
  sessionId: string;
}

export function DiscrepancyMatrix({ sessionId }: Props) {
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['discrepancy', sessionId],
    queryFn: () => getDiscrepancy(sessionId).then((r) => r.data),
    enabled: !!sessionId,
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportPdf(sessionId);
      downloadBlob(res.data, `audit-${sessionId}.pdf`);
    } catch {
      alert('PDF export failed. Check server logs.');
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm mt-3">Loading discrepancy data...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-8 text-center">
        <p className="text-red-500 text-sm">Failed to load discrepancy matrix.</p>
      </div>
    );
  }

  const matrix: MatrixRow[] = data.matrix;
  const totalImpact = matrix.reduce((s, r) => s + parseFloat(r.financialImpact), 0);
  const shortages = matrix.filter((r) => r.variance < 0);
  const surpluses = matrix.filter((r) => r.variance > 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div>
          <h3 className="font-semibold text-slate-900">Discrepancy Matrix</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {shortages.length} shortage{shortages.length !== 1 ? 's' : ''} &middot; {surpluses.length} surplus &middot; Total impact: {formatCurrency(totalImpact)}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {exporting ? 'Exporting...' : 'Export PDF'}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Brand</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Expected</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actual</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Variance</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Financial Impact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {matrix.map((row) => (
              <tr
                key={row.brandId}
                className={cn(
                  'transition-colors hover:bg-slate-50',
                  row.variance < 0 && 'bg-red-50/60 hover:bg-red-50'
                )}
              >
                <td className="px-5 py-3">
                  <div>
                    <p className="font-medium text-slate-900">{row.brandName}</p>
                    <p className="text-xs text-slate-400">{row.size.replace('ML_', '')}ml</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-slate-700 font-mono">{row.expected}</td>
                <td className="px-4 py-3 text-right text-slate-700 font-mono">{row.actual}</td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={cn(
                      'inline-block font-mono font-semibold',
                      row.variance < 0 && 'text-red-600',
                      row.variance > 0 && 'text-green-600',
                      row.variance === 0 && 'text-slate-400'
                    )}
                  >
                    {row.variance > 0 ? '+' : ''}{row.variance}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <span className={cn('font-mono', parseFloat(row.financialImpact) > 0 ? 'text-red-600 font-semibold' : 'text-slate-400')}>
                    {formatCurrency(parseFloat(row.financialImpact))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 border-t-2 border-slate-200">
              <td colSpan={4} className="px-5 py-3 text-sm font-semibold text-slate-700">
                Total Financial Impact
              </td>
              <td className="px-5 py-3 text-right text-slate-900 font-mono font-bold">
                {formatCurrency(totalImpact)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
