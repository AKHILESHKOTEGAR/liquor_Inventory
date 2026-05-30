import { cn } from '@/lib/utils';

interface Props {
  title: string;
  value: string | number;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  accent?: string;
}

export function StatsCard({ title, value, sub, icon, accent = 'bg-blue-500' }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0', accent)}>
          {icon}
        </div>
      </div>
    </div>
  );
}
