import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../lib/axios';
import { Table, Badge, Spinner } from '../../components/ui';

function actionColor(a = '') {
  if (a.includes('DELETE') || a.includes('SUSPEND')) return 'red';
  if (a.includes('CREATE') || a.includes('LOGIN')) return 'green';
  if (a.includes('UPDATE') || a.includes('RATING') || a.includes('ATTENDANCE'))
    return 'blue';
  return 'gray';
}

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['auditLogs', page],
    queryFn: () =>
      api.get(`/audit?page=${page}&limit=${limit}`).then((res) => res.data),
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  const logs = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

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

      {isLoading ? (
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
