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
      {/* Professional Header Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shadow-sm">
            <Bell className="w-6 h-6" />

            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 w-3 h-3 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full" />
            )}
          </div>

          <div>
            <p className="text-xs md:text-sm uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300 font-extrabold mb-1">
              Activity Center
            </p>

            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Notifications
            </h1>

            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
              {unread ? (
                <span className="font-bold text-indigo-600 dark:text-indigo-300">
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
            className="rounded-2xl px-5 py-2.5"
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
          icon={
            <BellOff className="w-12 h-12 text-slate-300 dark:text-slate-600" />
          }
          title="No notifications"
          text="New activity, mentions, and updates will show up here."
        />
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <Card
              key={n.id}
              className={`p-5 flex items-start gap-4 transition-all duration-300 border ${
                n.read
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:shadow-[0_12px_30px_rgba(15,23,42,0.06)] dark:hover:shadow-none'
                  : 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900/60 shadow-sm'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                  n.read
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'
                    : 'bg-gradient-to-br from-indigo-500 via-blue-500 to-violet-600 text-white'
                }`}
              >
                <Bell className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0 pt-0.5">
                <p
                  className={`text-sm leading-relaxed ${
                    n.read
                      ? 'text-slate-700 dark:text-slate-300'
                      : 'text-slate-900 dark:text-white font-bold'
                  }`}
                >
                  {n.message}
                </p>

                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium flex items-center gap-1.5">
                  {timeAgo(n.created_at)}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 pt-1">
                {!n.read && (
                  <button
                    onClick={() => markReadMut.mutate(n.id)}
                    disabled={markReadMut.isPending}
                    className="text-indigo-600 dark:text-indigo-300 text-xs font-extrabold hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors flex items-center gap-1 disabled:opacity-60"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Mark read
                  </button>
                )}

                <button
                  onClick={() => deleteMut.mutate(n.id)}
                  disabled={deleteMut.isPending}
                  className="text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-2 rounded-xl transition-all disabled:opacity-60"
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
        <div className="flex items-center justify-center gap-4 mt-8 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Btn
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-2xl"
          >
            <span className="flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Prev
            </span>
          </Btn>

          <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
            Page {data.page} of {Math.ceil(data.total / data.limit)}
          </span>

          <Btn
            variant="outline"
            onClick={() => setPage((p) => p + 1)}
            disabled={page * data.limit >= data.total}
            className="rounded-2xl"
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
