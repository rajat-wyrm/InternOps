import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import { Card, Btn, Input, Textarea, Select } from './ui';

const PLATFORMS = [
  'LinkedIn',
  'Instagram',
  'Twitter',
  'Facebook',
  'YouTube',
  'Other',
];

export default function CreateTaskForm() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    description: '',
    targetPlatform: 'LinkedIn',
    taskLink: '',
    deadline: '',
  });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/tasks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setError('');
      setMsg('✓ Task created');
      setForm({
        title: '',
        description: '',
        targetPlatform: 'LinkedIn',
        taskLink: '',
        deadline: '',
      });
      setTimeout(() => setMsg(''), 2000);
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed'),
  });

  return (
    <Card className="p-6 md:p-7 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
        <div className="w-11 h-11 rounded-2xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-300 flex items-center justify-center border border-violet-100 dark:border-violet-900/60">
          🎯
        </div>

        <div>
          <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
            Create Social Task
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Add a campaign task and set platform, link, and deadline.
          </p>
        </div>
      </div>

      {error && (
        <div className="text-rose-700 dark:text-rose-300 text-sm mb-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/60 px-4 py-3 rounded-2xl font-medium">
          {error}
        </div>
      )}

      {msg && (
        <div className="text-emerald-700 dark:text-emerald-300 text-sm mb-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 px-4 py-3 rounded-2xl font-medium">
          {msg}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate(form);
        }}
        className="space-y-5"
      >
        <div>
          <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
            Task Title
          </label>
          <Input
            placeholder="Task title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
            Description
          </label>
          <Textarea
            placeholder="Description"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
              Target Platform
            </label>
            <Select
              value={form.targetPlatform}
              onChange={(e) =>
                setForm({ ...form, targetPlatform: e.target.value })
              }
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
              Deadline
            </label>
            <Input
              type="datetime-local"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              required
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
            Task Link
          </label>
          <Input
            type="url"
            placeholder="Task link (https://…)"
            value={form.taskLink}
            onChange={(e) => setForm({ ...form, taskLink: e.target.value })}
          />
        </div>

        <Btn
          variant="primary"
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-2xl px-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:shadow-indigo-200 dark:hover:shadow-none"
        >
          {createMutation.isPending ? 'Creating…' : 'Create task'}
        </Btn>
      </form>
    </Card>
  );
}
