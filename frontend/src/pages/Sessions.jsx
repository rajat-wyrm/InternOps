import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Shield } from 'lucide-react';
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
    <div>
      <PageHeader
        title="Active Sessions"
        icon={
          <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
            <Shield className="w-6 h-6" />
          </div>
        }
        subtitle="Devices currently signed in to your account"
        actions={
          <Btn
            variant="danger"
            disabled={confirming}
            onClick={() => setConfirming((c) => !c)}
          >
            Revoke all sessions
          </Btn>
        }
      />

      {confirming && (
        <Card className="p-4 mb-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-800 mb-3">
            This will sign you out of <strong>every</strong> device, including
            this one. You will be redirected to the login page.
          </p>
          <div className="flex gap-2">
            <Btn
              variant="danger"
              onClick={() => {
                setConfirming(false);
                revokeAllMut.mutate();
              }}
            >
              Yes, revoke all
            </Btn>
            <Btn variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Btn>
          </div>
        </Card>
      )}

      {isLoading ? (
        <Spinner />
      ) : !sessions?.length ? (
        <EmptyState icon="💻" title="No active sessions" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sessions.map((s) => (
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
                <p className="text-xs text-gray-400">
                  Expires {new Date(s.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <Btn
                variant="outline"
                onClick={() => revokeMut.mutate(s.sessionId)}
              >
                Revoke
              </Btn>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
