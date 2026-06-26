import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import api from '../../lib/axios';
import { Card, Btn, Input, EmptyState, Spinner } from '../../components/ui';

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
    'from-emerald-500 to-teal-600',
    'from-amber-400 to-orange-500',
    'from-violet-500 to-purple-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-sky-600',
  ];

  return (
    <div className="animate-fade-in-up">
      {/* Professional Header Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shadow-sm">
            <Building2 className="w-6 h-6" />
          </div>

          <div>
            <p className="text-xs md:text-sm uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300 font-extrabold mb-1">
              Organization
            </p>

            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Departments
            </h1>

            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
              Organize your workforce into structural units
            </p>
          </div>
        </div>
      </div>

      <Card className="p-6 md:p-7 mb-6 border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-white via-slate-50 to-indigo-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
        <div className="flex items-center gap-4 mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/60 shrink-0">
            <Plus className="w-5 h-5" />
          </div>

          <div>
            <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
              Add New Department
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Create a department to group users and reports.
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 text-sm mb-4 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-2xl border border-rose-100 dark:border-rose-900/60">
            <AlertCircle className="w-4 h-4" />
            {error}
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
            className="max-w-md"
          />

          <Btn
            type="submit"
            disabled={createMut.isPending}
            className="rounded-2xl px-5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:shadow-indigo-200 dark:hover:shadow-none"
          >
            {createMut.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Department
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
          icon={
            <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600" />
          }
          title="No departments yet"
          text="Create your first department above to get started."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {departments.map((d, i) => (
            <Card
              key={d.id}
              className="p-5 card-hover border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none group"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${
                    COLORS[i % COLORS.length]
                  } text-white flex items-center justify-center shadow-sm shrink-0`}
                >
                  <Building2 className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                    {d.name}
                  </p>

                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
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
                  className="text-slate-300 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-2 rounded-xl transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete department"
                >
                  {deletingId === d.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
