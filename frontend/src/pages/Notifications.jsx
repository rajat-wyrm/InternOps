import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import { PageHeader, Card, Btn, EmptyState, Spinner } from '../components/ui';

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString();
}

export default function Notifications() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', page],
    queryFn: () =>
      api.get(`/notifications?page=${page}&limit=20`).then((res) => res.data),
    refetchInterval: 30000,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  const markReadMut = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: invalidate,
  });
  const markAllReadMut = useMutation({
    mutationFn: () => api.post('/notifications/read-all', {}),
    onSuccess: invalidate,
  });
  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/notifications/${id}`),
    onSuccess: invalidate,
  });

  const items = data?.data || [];
  const unread = items.filter((n) => !n.read).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        icon="🔔"
        subtitle={unread ? `${unread} unread` : 'You are all caught up'}
        actions={
          <Btn variant="outline" onClick={() => markAllReadMut.mutate()}>
            ✓ Mark all read
          </Btn>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState
          icon="🔕"
          title="No notifications"
          text="New activity will show up here."
        />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <Card
              key={n.id}
              className={`p-4 flex items-start gap-3 transition ${n.read ? '' : 'ring-1 ring-indigo-200 bg-indigo-50/40'}`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${n.read ? 'bg-gray-100' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'}`}
              >
                🔔
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-800">{n.message}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {timeAgo(n.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!n.read && (
                  <button
                    onClick={() => markReadMut.mutate(n.id)}
                    className="text-indigo-600 text-xs font-medium hover:underline"
                  >
                    Mark read
                  </button>
                )}
                <button
                  onClick={() => deleteMut.mutate(n.id)}
                  className="text-rose-500 hover:text-rose-700 text-sm"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {data && data.total > data.limit && (
        <div className="flex items-center justify-center gap-3 mt-5">
          <Btn
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Prev
          </Btn>
          <span className="text-sm text-gray-500">
            Page {data.page} of {Math.ceil(data.total / data.limit)}
          </span>
          <Btn
            variant="outline"
            onClick={() => setPage((p) => p + 1)}
            disabled={page * data.limit >= data.total}
          >
            Next →
          </Btn>
        </div>
      )}
    </div>
  );
}
