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
  const { data: logs, isLoading } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => api.get('/audit').then((res) => res.data),
    refetchInterval: 60000,
  });

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
    </div>
  );
}
