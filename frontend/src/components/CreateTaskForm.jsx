import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
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
  const { data: teamMembers } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => api.get('/team/members').then((res) => res.data),
  });
  const interns = teamMembers?.filter((m) => m.role === 'INTERN') || [];

  const [form, setForm] = useState({
    title: '',
    description: '',
    targetPlatform: 'LinkedIn',
    taskLink: '',
    deadline: '',
    userIds: [],
  });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { userIds, ...taskData } = data;
      const res = await api.post('/tasks', taskData);
      const task = res.data;
      if (userIds && userIds.length > 0) {
        await api.post(`/tasks/${task.id}/assign`, { userIds });
      }
      return task;
    },
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
        userIds: [],
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

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-gray-700">
            Assign to Interns (Optional)
          </label>
          <div className="max-h-40 overflow-y-auto border rounded p-2 bg-white space-y-1">
            {interns.length === 0 ? (
              <p className="text-xs text-gray-500">
                No interns found in your team.
              </p>
            ) : (
              interns.map((intern) => (
                <label
                  key={intern.id}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={form.userIds.includes(intern.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setForm({
                          ...form,
                          userIds: [...form.userIds, intern.id],
                        });
                      } else {
                        setForm({
                          ...form,
                          userIds: form.userIds.filter(
                            (id) => id !== intern.id
                          ),
                        });
                      }
                    }}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  {intern.full_name || intern.email}
                </label>
              ))
            )}
          </div>
        </div>
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
