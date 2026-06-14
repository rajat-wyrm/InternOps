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
    <Card className="p-5">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        🎯 Create Social Task
      </h3>
      {error && <p className="text-rose-600 text-sm mb-2">{error}</p>}
      {msg && <p className="text-green-600 text-sm mb-2">{msg}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate(form);
        }}
        className="space-y-3"
      >
        <Input
          placeholder="Task title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
        <Textarea
          placeholder="Description"
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <Input
            type="datetime-local"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            required
          />
        </div>
        <Input
          type="url"
          placeholder="Task link (https://…)"
          value={form.taskLink}
          onChange={(e) => setForm({ ...form, taskLink: e.target.value })}
        />
        <Btn
          variant="primary"
          type="submit"
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? 'Creating…' : 'Create task'}
        </Btn>
      </form>
    </Card>
  );
}
