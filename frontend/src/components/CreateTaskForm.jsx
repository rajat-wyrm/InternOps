import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import { Card, Input, Textarea, Select, Btn } from './ui';

const PLATFORMS = ['LinkedIn', 'Twitter', 'Instagram', 'Facebook'];

export default function CreateTaskForm({ task, onClose }) {
  // Safely reads properties using optional chaining to keep the Edit view from crashing
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    targetPlatform: task?.target_platform || task?.targetPlatform || 'LinkedIn',
    tasklink: task?.task_link || task?.tasklink || '',
    deadline: task?.deadline
      ? new Date(task.deadline).toISOString().substring(0, 16)
      : '',
  });

  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const taskMutation = useMutation({
    mutationFn: (formValues) => {
      const payload = {
        title: formValues.title,
        description: formValues.description,
        task_link: formValues.tasklink,
        deadline: formValues.deadline,
        target_platform: formValues.targetPlatform,
      };

      if (task && task.id) {
        return api.put(`/tasks/${task.id}`, payload).then((res) => res.data);
      }
      return api.post('/tasks', payload).then((res) => res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks']);
      setError('');
      setMsg(
        task ? '✓ Task updated successfully' : '✓ Task created successfully'
      );

      setTimeout(() => {
        if (onClose) onClose();
      }, 1000);
    },
    onError: (err) => {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Operation failed'
      );
    },
  });

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        {task ? 'Edit Social Task' : 'Create Social Task'}
      </h3>
      {error && <p className="text-rose-600 text-sm mb-2">{error}</p>}
      {msg && <p className="text-green-600 text-sm mb-2">{msg}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          taskMutation.mutate(form);
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
          placeholder="Task link (https://...)"
          value={form.tasklink}
          onChange={(e) => setForm({ ...form, tasklink: e.target.value })}
        />
        <Btn variant="primary" type="submit" disabled={taskMutation.isPending}>
          {taskMutation.isPending ? 'Saving...' : 'Save task'}
        </Btn>
      </form>
    </Card>
  );
}
