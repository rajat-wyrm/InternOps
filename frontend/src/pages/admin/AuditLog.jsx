import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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

  if (isLoading) return <Spinner label="Loading audit logs..." />;

  return (
    <div>
      <PageHeader
        title="Audit Log"
        icon="🧾"
        subtitle="Immutable trail of sensitive actions"
      />
      <Table head={['Time', 'Actor', 'Action', 'Resource', 'Details']}>
        {logs?.map((log) => (
          <tr
            key={log.id}
            className="border-t hover:bg-indigo-50/40 transition"
          >
            <td className="p-3 text-xs text-gray-500 whitespace-nowrap">
              {new Date(log.created_at).toLocaleString()}
            </td>
            <td className="p-3 text-xs font-mono text-gray-600">
              {log.user_id ? log.user_id.substring(0, 8) + '…' : 'system'}
            </td>
            <td className="p-3">
              <Badge color={actionColor(log.action)}>{log.action}</Badge>
            </td>
            <td className="p-3 text-xs text-gray-600">
              {log.resource_type}
              {log.resource_id ? `/${log.resource_id.substring(0, 8)}…` : ''}
            </td>
            <td className="p-3 text-xs text-gray-400 max-w-xs truncate">
              {log.details ? JSON.stringify(log.details) : '—'}
            </td>
          </tr>
        ))}
      </Table>
      <div className="flex items-center justify-center gap-4 mt-6">
        <button
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium shadow-sm hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          ← Prev
        </button>
        <div className="px-4 py-2 rounded-lg bg-indigo-50 border border-indigo-100 text-sm font-medium text-indigo-700">
          Page {page} of {totalPages || 1}
        </div>
        <button
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium shadow-sm hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
