import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/axios';
import {
  PageHeader,
  Card,
  Btn,
  Input,
  EmptyState,
  Spinner,
} from '../../components/ui';

export default function Departments() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [deletingDepartmentId, setDeletingDepartmentId] = useState(null);

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r) => r.data),
  });

  const inv = () =>
    queryClient.invalidateQueries({ queryKey: ['departments'] });
  const createMut = useMutation({
    mutationFn: (n) => api.post('/departments', { name: n }),
    onSuccess: () => {
      setName('');
      setError('');
      inv();
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to create'),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/departments/${id}`),
    onSuccess: inv,
    onSettled: () => {
      setDeletingDepartmentId(null);
    },
  });

  const COLORS = [
    'from-indigo-500 to-blue-600',
    'from-emerald-500 to-green-600',
    'from-amber-400 to-orange-500',
    'from-purple-500 to-fuchsia-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-sky-600',
  ];

  return (
    <div>
      <PageHeader
        title="Departments"
        icon="🏢"
        subtitle="Organise your workforce into departments"
      />

      <Card className="p-5 mb-5">
        <h3 className="font-semibold text-gray-800 mb-3">Add department</h3>
        {error && <p className="text-rose-600 text-sm mb-2">{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) createMut.mutate(name.trim());
          }}
          className="flex gap-2 flex-wrap"
        >
          <Input
            placeholder="Department name (e.g. Social Media)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-sm"
          />
          <Btn type="submit" disabled={createMut.isPending}>
            {createMut.isPending ? 'Adding…' : '+ Add'}
          </Btn>
        </form>
      </Card>

      {isLoading ? (
        <Spinner />
      ) : departments.length === 0 ? (
        <EmptyState
          icon="🏢"
          title="No departments yet"
          text="Create your first department above."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((d, i) => (
            <Card key={d.id} className="p-5 card-hover flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${COLORS[i % COLORS.length]} text-white flex items-center justify-center text-xl shadow-md`}
              >
                🏢
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 truncate">{d.name}</p>
                <p className="text-xs text-gray-400">
                  Created{' '}
                  {d.created_at
                    ? new Date(d.created_at).toLocaleDateString()
                    : '—'}
                </p>
              </div>
              <button
                disabled={deletingDepartmentId === d.id || deleteMut.isPending}
                onClick={() => {
                  if (deleteMut.isPending || deletingDepartmentId === d.id) {
                    return;
                  }

                  if (confirm(`Delete department "${d.name}"?`)) {
                    setDeletingDepartmentId(d.id);
                    deleteMut.mutate(d.id);
                  }
                }}
                className="text-rose-500 hover:text-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete"
              >
                {deletingDepartmentId === d.id ? '⏳' : '🗑️'}
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
