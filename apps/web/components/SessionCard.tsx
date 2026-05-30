import Link from 'next/link';
import { cn, formatDate, statusColor } from '@/lib/utils';

interface Props {
  session: {
    id: string;
    sessionCode: string;
    status: string;
    startedAt: string;
    closedAt?: string | null;
    user: { employeeId: string; name: string };
    _count: { scanLogs: number };
  };
}

export function SessionCard({ session }: Props) {
  return (
    <Link
      href={`/dashboard/sessions/${session.id}`}
      className="block bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', statusColor(session.status))}>
              {session.status}
            </span>
            <span className="text-xs text-slate-400 font-mono">{session.sessionCode}</span>
          </div>
          <p className="text-slate-600 text-xs mt-1">
            Started by {session.user.name} ({session.user.employeeId})
          </p>
          <p className="text-slate-400 text-xs mt-0.5">{formatDate(session.startedAt)}</p>
        </div>
        <div className="text-right flex-shrink-0 ml-4">
          <p className="text-2xl font-bold font-mono text-slate-900">{session._count.scanLogs}</p>
          <p className="text-xs text-slate-400">scans</p>
        </div>
      </div>

      {session.closedAt && (
        <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
          Closed: {formatDate(session.closedAt)}
        </p>
      )}
    </Link>
  );
}
