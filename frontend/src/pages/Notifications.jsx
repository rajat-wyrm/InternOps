import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import api from '../lib/axios';
import { Card, Btn, EmptyState, Spinner } from '../components/ui';

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
    refetchIntervalInBackground: false,
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
    <div className="animate-fade-in-up">
      {/* 🚀 Professional Header Block 🚀 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shadow-sm relative">
            <Bell className="w-6 h-6" />
            {unread > 0 && (
              <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full -translate-y-1/3 translate-x-1/3"></span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
              Notifications
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {unread ? (
                <span className="font-medium text-indigo-600">
                  {unread} unread activity updates
                </span>
              ) : (
                'You are all caught up'
              )}
            </p>
          </div>
        </div>

        {items.length > 0 && (
          <Btn
            variant="outline"
            onClick={() => markAllReadMut.mutate()}
            disabled={markAllReadMut.isPending || unread === 0}
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {markAllReadMut.isPending ? 'Marking...' : 'Mark all read'}
            </span>
          </Btn>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BellOff className="w-12 h-12 text-gray-300" />}
          title="No notifications"
          text="New activity, mentions, and updates will show up here."
        />
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <Card
              key={n.id}
              className={`p-4 flex items-start gap-4 transition-all duration-300 ${
                n.read
                  ? 'bg-white hover:border-gray-200 hover:shadow-sm'
                  : 'bg-indigo-50/50 border-indigo-100 shadow-sm'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                  n.read
                    ? 'bg-gray-100 text-gray-400'
                    : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                }`}
              >
                <Bell className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0 pt-0.5">
                <p
                  className={`text-sm ${n.read ? 'text-gray-700' : 'text-gray-900 font-medium'}`}
                >
                  {n.message}
                </p>
                <p className="text-xs text-gray-400 mt-1 font-medium flex items-center gap-1.5">
                  {timeAgo(n.created_at)}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0 pt-1">
                {!n.read && (
                  <button
                    onClick={() => markReadMut.mutate(n.id)}
                    className="text-indigo-600 text-xs font-semibold hover:text-indigo-800 transition-colors flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Mark read
                  </button>
                )}
                <button
                  onClick={() => deleteMut.mutate(n.id)}
                  className="text-gray-400 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-all"
                  title="Delete notification"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {data && data.total > data.limit && (
        <div className="flex items-center justify-center gap-4 mt-8 pt-4 border-t border-gray-100">
          <Btn
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <span className="flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Prev
            </span>
          </Btn>
          <span className="text-sm font-medium text-gray-500">
            Page {data.page} of {Math.ceil(data.total / data.limit)}
          </span>
          <Btn
            variant="outline"
            onClick={() => setPage((p) => p + 1)}
            disabled={page * data.limit >= data.total}
          >
            <span className="flex items-center gap-1">
              Next <ChevronRight className="w-4 h-4" />
            </span>
          </Btn>
        </div>
      )}
    </div>
  );
}
