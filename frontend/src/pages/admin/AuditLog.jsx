import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../lib/axios';
import { PageHeader, Table, Badge, Spinner } from '../../components/ui';

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
      {/* 🚀 Professional Header Block 🚀 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shadow-sm">
          <ScrollText className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
            Audit Log
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Immutable trail of sensitive system actions
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : (
        <Table head={['Time', 'Actor', 'Action', 'Resource', 'Details']}>
          {logs?.map((log) => (
            <tr
              key={log.id}
              className="border-t hover:bg-indigo-50/30 transition"
            >
              <td className="p-4 text-xs text-gray-500 whitespace-nowrap">
                {new Date(log.created_at).toLocaleString()}
              </td>
              <td className="p-4 text-xs font-mono text-gray-600">
                {log.actor_email
                  ? `${log.actor_name || ''} (${log.actor_email})`
                  : log.user_id
                    ? log.user_id.substring(0, 8) + '…'
                    : 'system'}
              </td>
              <td className="p-4">
                <Badge color={actionColor(log.action)}>{log.action}</Badge>
              </td>
              <td className="p-4 text-xs text-gray-600">
                {log.resource_type}
                {log.resource_id ? `/${log.resource_id.substring(0, 8)}…` : ''}
              </td>
              <td className="p-4 text-xs text-gray-400 max-w-[200px] truncate">
                {log.details ? JSON.stringify(log.details) : '—'}
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* Modernized Pagination */}
      <div className="flex items-center justify-center gap-2 mt-8">
        <button
          className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition"
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>

        <div className="px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-bold border border-indigo-100">
          Page {page} of {totalPages || 1}
        </div>

        <button
          className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
