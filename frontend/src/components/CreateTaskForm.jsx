import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import { getApiErrorMessage } from '../utils/apiError';
import { Card, Btn, Input, Textarea } from './ui';
import CustomSelect from './CustomSelect';
import CustomDateTimePicker from './CustomDateTimePicker';

const PLATFORMS = [
  'LinkedIn',
  'Instagram',
  'Twitter',
  'Facebook',
  'YouTube',
  'Other',
];

const INITIAL_FORM = {
  title: '',
  description: '',
  targetPlatform: 'LinkedIn',
  taskLink: '',
  deadline: '',
};

export default function CreateTaskForm() {
  const queryClient = useQueryClient();

  const [form, setForm] = useState(INITIAL_FORM);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/tasks', data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tasks'],
      });

      setError('');
      setMsg('✓ Task created');

      setForm(INITIAL_FORM);

      setTimeout(() => {
        setMsg('');
      }, 2000);
    },

    onError: (err) => {
      setError(getApiErrorMessage(err, 'Failed to create task'));
    },
  });

  const platformOptions = PLATFORMS.map((platform) => ({
    value: platform,
    label: platform,
  }));

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    setError('');
    setMsg('');

    createMutation.mutate(form);
  };

  return (
    <Card className="p-6 md:p-7 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
        <div className="w-11 h-11 rounded-2xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-300 flex items-center justify-center border border-violet-100 dark:border-violet-900/60">
          <span className="text-lg font-extrabold">🎯</span>
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

      {/* Error message */}
      {error && (
        <div className="text-rose-700 dark:text-rose-300 text-sm mb-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/60 px-4 py-3 rounded-2xl font-medium">
          {error}
        </div>
      )}

      {/* Success message */}
      {msg && (
        <div className="text-emerald-700 dark:text-emerald-300 text-sm mb-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 px-4 py-3 rounded-2xl font-medium">
          {msg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Task Title */}
        <div>
          <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
            Task Title
          </label>

          <Input
            placeholder="Task title"
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            required
            disabled={createMutation.isPending}
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
            Description
          </label>

          <Textarea
            placeholder="Description"
            rows={3}
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            disabled={createMutation.isPending}
          />
        </div>

        {/* Platform + Deadline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Target Platform */}
          <div>
            <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
              Target Platform
            </label>

            <CustomSelect
              value={form.targetPlatform}
              onChange={(value) => updateField('targetPlatform', value)}
              options={platformOptions}
              placeholder="Select platform"
              disabled={createMutation.isPending}
              className="w-full"
            />
          </div>

          {/* Deadline */}
          <div>
            <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
              Deadline
            </label>

            <CustomDateTimePicker
              value={form.deadline}
              onChange={(value) => updateField('deadline', value)}
              placeholder="Select deadline"
              disabled={createMutation.isPending}
              className="w-full"
            />
          </div>
        </div>

        {/* Task Link */}
        <div>
          <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
            Task Link
          </label>

          <Input
            type="url"
            placeholder="Task link (https://...)"
            value={form.taskLink}
            onChange={(e) => updateField('taskLink', e.target.value)}
            disabled={createMutation.isPending}
          />
        </div>

        {/* Submit */}
        <Btn
          variant="primary"
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-2xl px-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:shadow-indigo-200 dark:hover:shadow-none"
        >
          {createMutation.isPending ? 'Creating...' : 'Create task'}
        </Btn>
      </form>
    </Card>
  );
}
