import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
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
  const [deletingId, setDeletingId] = useState(null);

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
    onError: (err) =>
      setError(err.response?.data?.error || 'Failed to create department'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/departments/${id}`),
    onSuccess: inv,
    onSettled: () => setDeletingId(null),
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
    <div className="animate-fade-in-up">
      {/* 🚀 Professional Header Block 🚀 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shadow-sm">
          <Building2 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
            Departments
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Organize your workforce into structural units
          </p>
        </div>
      </div>

      <Card className="p-6 mb-6 border-indigo-100 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4">Add New Department</h3>
        {error && (
          <div className="flex items-center gap-2 text-rose-600 text-sm mb-4 bg-rose-50 p-3 rounded-lg border border-rose-100">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) createMut.mutate(name.trim());
          }}
          className="flex gap-3 flex-wrap"
        >
          <Input
            placeholder="E.g., Social Media Marketing"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-xs"
          />
          <Btn type="submit" disabled={createMut.isPending}>
            {createMut.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Department
              </span>
            )}
          </Btn>
        </form>
      </Card>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : departments.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-12 h-12 text-gray-300" />}
          title="No departments yet"
          text="Create your first department above to get started."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((d, i) => (
            <Card
              key={d.id}
              className="p-5 hover:shadow-md transition-shadow group flex items-center gap-4"
            >
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${COLORS[i % COLORS.length]} text-white flex items-center justify-center shadow-md shrink-0`}
              >
                <Building2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">{d.name}</p>
                <p className="text-xs text-gray-400 font-medium">
                  Created{' '}
                  {d.created_at
                    ? new Date(d.created_at).toLocaleDateString()
                    : '—'}
                </p>
              </div>
              <button
                disabled={deletingId === d.id || deleteMut.isPending}
                onClick={() => {
                  if (confirm(`Delete department "${d.name}"?`)) {
                    setDeletingId(d.id);
                    deleteMut.mutate(d.id);
                  }
                }}
                className="text-gray-300 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="Delete department"
              >
                {deletingId === d.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
