import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import api from '../../lib/axios';
import { Table, Badge, Spinner } from '../../components/ui';

function actionColor(a = '') {
  if (a.includes('DELETE') || a.includes('SUSPEND')) return 'red';
  if (a.includes('CREATE') || a.includes('LOGIN')) return 'green';
  if (a.includes('UPDATE') || a.includes('RATING') || a.includes('ATTENDANCE'))
    return 'blue';
  return 'gray';
}

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'SUSPEND', label: 'Suspend' },
];

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [action, setAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const limit = 50;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['auditLogs', page, search, action, startDate, endDate],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', limit);
      if (search) params.set('search', search);
      if (action) params.set('action', action);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      return api.get(`/audit?${params.toString()}`).then((res) => res.data);
    },
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  const logs = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  function applySearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  function resetFilters() {
    setSearchInput('');
    setSearch('');
    setAction('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  }

  return (
    <div className="animate-fade-in-up">
      {/* Professional Header Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shadow-sm">
            <ScrollText className="w-6 h-6" />
          </div>

          <div>
            <p className="text-xs md:text-sm uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300 font-extrabold mb-1">
              Security Trail
            </p>

            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Audit Log
            </h1>

            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
              Immutable trail of sensitive system actions
            </p>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-end gap-3 mb-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
            Search by name or email
          </label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              placeholder="e.g. jane@example.com"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
            Action type
          </label>
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {ACTION_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
            From
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
            To
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          onClick={applySearch}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition"
        >
          Apply
        </button>

        <button
          onClick={resetFilters}
          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          Reset
        </button>
      </div>

      {isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <h3 className="text-lg font-semibold text-red-700">
            Failed to load audit logs
          </h3>

          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none overflow-hidden">
          <Table head={['Time', 'Actor', 'Action', 'Resource', 'Details']}>
            {logs?.map((log, index) => (
              <tr
                key={log.id}
                className={`transition-colors border-b border-slate-100 dark:border-slate-700 last:border-b-0 ${
                  index % 2 === 0
                    ? 'bg-white dark:bg-slate-900'
                    : 'bg-slate-50/50 dark:bg-slate-800/35'
                } hover:bg-indigo-50/50 dark:hover:bg-slate-800`}
              >
                <td className="p-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium">
                  {new Date(log.created_at).toLocaleString()}
                </td>

                <td className="p-4 text-xs font-mono text-slate-600 dark:text-slate-300 max-w-[240px] truncate">
                  {log.actor_email
                    ? `${log.actor_name || ''} (${log.actor_email})`
                    : log.user_id
                      ? log.user_id.substring(0, 8) + '…'
                      : 'system'}
                </td>

                <td className="p-4">
                  <Badge color={actionColor(log.action)}>{log.action}</Badge>
                </td>

                <td className="p-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  {log.resource_type}
                  {log.resource_id
                    ? `/${log.resource_id.substring(0, 8)}…`
                    : ''}
                </td>

                <td className="p-4 text-xs text-slate-500 dark:text-slate-400 max-w-[240px] truncate">
                  {log.details ? JSON.stringify(log.details) : '—'}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {/* Modernized Pagination */}
      <div className="flex items-center justify-center gap-2 mt-8">
        <button
          className="flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>

        <div className="px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-sm font-extrabold border border-indigo-100 dark:border-indigo-900/60">
          Page {page} of {totalPages || 1}
        </div>

        <button
          className="flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
