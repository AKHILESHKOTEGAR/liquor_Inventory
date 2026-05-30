'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSessions, getSessionsCalendar } from '@/lib/api';
import { SessionCard } from '@/components/SessionCard';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const STATUS_FILTERS = ['ALL', 'ACTIVE', 'CLOSED', 'ARCHIVED'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toLocalDate(dateStr: string) {
  // Parse YYYY-MM-DD as local date (not UTC)
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ── Mini Calendar ──────────────────────────────────────────────────────
function CalendarView({
  calendarMonth,
  setCalendarMonth,
  calData,
  calLoading,
  selectedDate,
  setSelectedDate,
}: {
  calendarMonth: string;
  setCalendarMonth: (m: string) => void;
  calData: any;
  calLoading: boolean;
  selectedDate: string | null;
  setSelectedDate: (d: string | null) => void;
}) {
  const [year, month] = calendarMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay });

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1);
    setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    const d = new Date(year, month, 1);
    setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    setSelectedDate(null);
  };

  const days_data = calData?.days ?? {};

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
        <button onClick={prevMonth} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-slate-800">
          {MONTH_NAMES[month - 1]} {year}
        </h3>
        <button onClick={nextMonth} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-slate-400 py-2">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className={`grid grid-cols-7 ${calLoading ? 'opacity-50' : ''}`}>
        {blanks.map((_, i) => <div key={`b${i}`} className="h-12" />)}
        {days.map((day) => {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const info = days_data[dateStr];
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const hasSession = !!info;
          const hasActive = info?.statuses?.includes('ACTIVE');

          return (
            <button
              key={day}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              className={cn(
                'h-12 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors relative',
                isSelected
                  ? 'bg-blue-600 text-white'
                  : isToday
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : hasSession
                  ? 'hover:bg-slate-50 text-slate-800 cursor-pointer'
                  : 'text-slate-400 cursor-default'
              )}
            >
              <span className={cn('font-medium', isSelected ? 'text-white' : isToday ? 'text-blue-700' : '')}>{day}</span>
              {hasSession && (
                <div className="flex gap-0.5">
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    isSelected ? 'bg-white' : hasActive ? 'bg-emerald-500' : 'bg-blue-400'
                  )} />
                  {info.sessionCount > 1 && (
                    <span className={cn('w-1.5 h-1.5 rounded-full', isSelected ? 'bg-white/60' : 'bg-slate-300')} />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-3 border-t border-slate-100 bg-slate-50">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-slate-500">Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-xs text-slate-500">Closed</span>
        </div>
        {selectedDate && (
          <button
            onClick={() => setSelectedDate(null)}
            className="ml-auto text-xs text-blue-600 hover:underline"
          >
            Clear date
          </button>
        )}
      </div>

      {/* Selected date summary */}
      {selectedDate && days_data[selectedDate] && (
        <div className="px-4 py-3 border-t border-slate-100 bg-blue-50">
          <p className="text-xs font-semibold text-blue-800 mb-1">
            {toLocalDate(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <p className="text-xs text-blue-700">
            {days_data[selectedDate].sessionCount} session{days_data[selectedDate].sessionCount !== 1 ? 's' : ''}
            · {days_data[selectedDate].totalScans} scans
          </p>
          <p className="text-xs text-blue-600 mt-0.5">
            {days_data[selectedDate].workers.join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────
export default function SessionsPage() {
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const queryClient = useQueryClient();

  const today = new Date();
  const [calendarMonth, setCalendarMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  );

  useEffect(() => {
    const onStoreChange = () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    };
    window.addEventListener('store-changed', onStoreChange);
    return () => window.removeEventListener('store-changed', onStoreChange);
  }, [queryClient]);

  // When a calendar date is selected, use it as dateFrom+dateTo
  const effectiveDateFrom = selectedDate ?? dateFrom;
  const effectiveDateTo = selectedDate ?? dateTo;

  const { data, isLoading } = useQuery({
    queryKey: ['sessions', status, page, effectiveDateFrom, effectiveDateTo],
    queryFn: () =>
      getSessions({
        status: status === 'ALL' ? undefined : status,
        page,
        limit: 12,
        dateFrom: effectiveDateFrom || undefined,
        dateTo: effectiveDateTo || undefined,
      }).then((r) => r.data),
  });

  const { data: calData, isLoading: calLoading } = useQuery({
    queryKey: ['calendar', calendarMonth],
    queryFn: () => getSessionsCalendar(calendarMonth).then((r) => r.data),
    enabled: showCalendar,
  });

  const clearDates = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedDate(null);
  };

  const hasDateFilter = !!(effectiveDateFrom || effectiveDateTo);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Sessions</h1>
          <p className="text-slate-500 text-sm mt-1">
            {data?.total ?? 0} {hasDateFilter ? 'matching' : 'total'} sessions
          </p>
        </div>
        {/* Calendar toggle */}
        <button
          onClick={() => setShowCalendar((v) => !v)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors shadow-sm',
            showCalendar
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          )}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Calendar View
        </button>
      </div>

      <div className={cn('gap-6', showCalendar ? 'flex items-start' : '')}>
        {/* Calendar sidebar */}
        {showCalendar && (
          <div className="w-72 flex-shrink-0">
            <CalendarView
              calendarMonth={calendarMonth}
              setCalendarMonth={setCalendarMonth}
              calData={calData}
              calLoading={calLoading}
              selectedDate={selectedDate}
              setSelectedDate={(d) => {
                setSelectedDate(d);
                setDateFrom('');
                setDateTo('');
                setPage(1);
              }}
            />
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {/* Status tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
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

            {/* Date range picker (only when calendar not open) */}
            {!showCalendar && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1); setSelectedDate(null); }}
                    className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <span className="text-slate-400 text-xs">to</span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); setSelectedDate(null); }}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {hasDateFilter && (
                  <button onClick={clearDates} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1.5 hover:bg-red-50 rounded-lg transition-colors">
                    Clear
                  </button>
                )}
              </div>
            )}

            {/* Active date filter badge (calendar mode) */}
            {showCalendar && selectedDate && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs text-blue-700 font-medium">
                  {toLocalDate(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <button onClick={clearDates} className="text-blue-400 hover:text-blue-700 ml-1">×</button>
              </div>
            )}
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
              <p className="text-slate-400 text-sm">
                {hasDateFilter ? 'No sessions on this date.' : 'No sessions found.'}
              </p>
              {hasDateFilter && (
                <button onClick={clearDates} className="mt-2 text-blue-600 text-xs hover:underline">
                  Clear date filter
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
