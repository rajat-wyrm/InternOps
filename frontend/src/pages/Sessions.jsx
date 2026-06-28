import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Shield,
  Monitor,
  AlertTriangle,
  Clock,
  CalendarClock,
} from 'lucide-react';
import api from '../lib/axios';
import { PageHeader, Card, Btn, EmptyState, Spinner } from '../components/ui';

export default function Sessions() {
  const queryClient = useQueryClient();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions/me').then((res) => res.data),
  });

  const [confirming, setConfirming] = useState(false);

  const revokeMut = useMutation({
    mutationFn: (sessionId) => api.delete(`/sessions/me/${sessionId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });

  const revokeAllMut = useMutation({
    mutationFn: () => api.post('/sessions/me/revoke-all', {}),
    onSuccess: () => {
      window.location.href = '/login';
    },
  });

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Active Sessions"
        icon={
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shadow-sm">
            <Shield className="w-6 h-6" />
          </div>
        }
        subtitle="Review and manage devices currently signed in to your account"
        actions={
          <Btn
            variant="danger"
            disabled={confirming}
            onClick={() => setConfirming((c) => !c)}
            className="rounded-2xl px-5 py-2.5"
          >
            Revoke all sessions
          </Btn>
        }
      />

      {/* Revoke all confirmation */}
      {confirming && (
        <Card className="p-5 mb-6 border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div className="flex-1">
              <h3 className="font-extrabold text-red-900 dark:text-red-100">
                Revoke all sessions?
              </h3>

              <p className="text-sm text-red-800 dark:text-red-200 mt-1 mb-4">
                This will sign you out of <strong>every</strong> device,
                including this one. You will be redirected to the login page.
              </p>

              <div className="flex flex-wrap gap-2">
                <Btn
                  variant="danger"
                  onClick={() => {
                    setConfirming(false);
                    revokeAllMut.mutate();
                  }}
                  disabled={revokeAllMut.isPending}
                  className="rounded-2xl"
                >
                  {revokeAllMut.isPending ? 'Revoking...' : 'Yes, revoke all'}
                </Btn>

                <Btn
                  variant="outline"
                  onClick={() => setConfirming(false)}
                  className="rounded-2xl"
                >
                  Cancel
                </Btn>
              </div>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <Spinner />
      ) : !sessions?.length ? (
        <EmptyState
          icon="💻"
          title="No active sessions"
          text="Signed-in devices will appear here."
        />
      ) : (
        <>
          {/* Sessions Summary */}
          <Card className="p-5 md:p-6 mb-6 border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-white via-slate-50 to-indigo-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/60">
                  <Monitor className="w-6 h-6" />
                </div>

                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    Session overview
                  </h2>

                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {sessions.length} active session
                    {sessions.length === 1 ? '' : 's'} found for your account.
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 w-fit">
                <Shield className="w-3.5 h-3.5" />
                Protected access
              </div>
            </div>
          </Card>

          {/* Session Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.map((s) => (
              <Card
                key={s.sessionId}
                className="p-5 md:p-6 card-hover border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-500 to-violet-600 text-white flex items-center justify-center text-xl shadow-md shrink-0">
                    <Monitor className="w-6 h-6" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-extrabold text-slate-900 dark:text-white text-base">
                          Active session
                        </p>

                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-all">
                          ID: {s.sessionId}
                        </p>
                      </div>

                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/60 shrink-0">
                        Active
                      </span>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Clock className="w-4 h-4 shrink-0" />
                        <span>
                          Started{' '}
                          {s.createdAt === 'N/A'
                            ? 'N/A'
                            : new Date(s.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <CalendarClock className="w-4 h-4 shrink-0" />
                        <span>
                          Expires{' '}
                          {s.expiresAt
                            ? new Date(s.expiresAt).toLocaleDateString()
                            : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                      <Btn
                        variant="outline"
                        disabled={revokeMut.isPending}
                        onClick={() => revokeMut.mutate(s.sessionId)}
                        className="rounded-2xl"
                      >
                        {revokeMut.isPending ? 'Revoking...' : 'Revoke'}
                      </Btn>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
