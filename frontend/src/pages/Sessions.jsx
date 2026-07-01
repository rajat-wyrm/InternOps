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
  const [revokingId, setRevokingId] = useState(null);

  const revokeMut = useMutation({
    mutationFn: (sessionId) => api.delete(`/sessions/me/${sessionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onSettled: () => {
      setRevokingId(null);
    },
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sessions.map((s) => {
            const expiryDate = new Date(s.expiresAt);
            const isValidExpiry = s.expiresAt && !isNaN(expiryDate.getTime());

            return (
              <Card
                key={s.sessionId}
                className="p-4 flex items-center gap-3 card-hover"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 text-white flex items-center justify-center text-xl">
                  💻
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm">Session</p>
                  <p className="text-xs text-gray-500">
                    Started{' '}
                    {s.createdAt === 'N/A'
                      ? 'N/A'
                      : new Date(s.createdAt).toLocaleString()}
                  </p>
                  {isValidExpiry ? (
                    <p className="text-xs text-gray-400">
                      Expires: {expiryDate.toLocaleDateString()}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">Expires: N/A</p>
                  )}
                </div>
                <Btn
                  variant="outline"
                  onClick={() => revokeMut.mutate(s.sessionId)}
                >
                  Revoke
                </Btn>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
