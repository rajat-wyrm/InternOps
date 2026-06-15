import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import useAuthStore from '../store/auth';
import {
  PageHeader,
  Card,
  Btn,
  Input,
  Textarea,
  EmptyState,
  Spinner,
  Badge,
} from '../components/ui';

export default function Meetings() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    meetingDate: '',
    startTime: '',
    endTime: '',
  });
  const [attendees, setAttendees] = useState([]);

  const canCreate = ['ADMIN', 'SENIOR_TL', 'TL'].includes(user?.role);

  const { data: meetings, isLoading } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => api.get('/meetings').then((res) => res.data),
  });
  const { data: team = [] } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => api.get('/team/members').then((res) => res.data),
    enabled: canCreate,
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/meetings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      setShowForm(false);
      setForm({
        title: '',
        description: '',
        meetingDate: '',
        startTime: '',
        endTime: '',
      });
      setAttendees([]);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/meetings/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetings'] }),
  });

  const toggle = (id) =>
    setAttendees((a) =>
      a.includes(id) ? a.filter((x) => x !== id) : [...a, id]
    );
  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({ ...form, attendeeIds: attendees });
  };

  return (
    <div>
      <PageHeader
        title="Meetings"
        icon="📹"
        subtitle="Schedule and track team meetings"
        actions={
          canCreate && (
            <Btn onClick={() => setShowForm((s) => !s)}>
              {showForm ? '✕ Cancel' : '+ Schedule meeting'}
            </Btn>
          )
        }
      />

      {showForm && (
        <Card className="p-5 mb-5 animate-fade-in-up">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              placeholder="Meeting title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <Textarea
              placeholder="Description / agenda"
              rows={2}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500">Date</label>
                <Input
                  type="date"
                  value={form.meetingDate}
                  onChange={(e) =>
                    setForm({ ...form, meetingDate: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Start</label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) =>
                    setForm({ ...form, startTime: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">End</label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) =>
                    setForm({ ...form, endTime: e.target.value })
                  }
                />
              </div>
            </div>
            {team.length > 0 && (
              <div>
                <label className="text-xs text-gray-500">
                  Attendees ({attendees.length} selected)
                </label>
                <div className="flex flex-wrap gap-2 mt-1 max-h-32 overflow-auto p-1">
                  {team.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => toggle(m.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${attendees.includes(m.id) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {m.full_name || m.email}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Btn
              variant="success"
              type="submit"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create meeting'}
            </Btn>
          </form>
        </Card>
      )}

      {isLoading ? (
        <Spinner />
      ) : !meetings?.length ? (
        <EmptyState icon="📅" title="No meetings scheduled" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {meetings.map((m) => (
            <Card key={m.id} className="p-5 card-hover">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xl">
                    📹
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{m.title}</h3>
                    <Badge color="blue">
                      {new Date(m.meeting_date).toLocaleDateString()}
                    </Badge>
                  </div>
                </div>
                {m.created_by === user?.id && (
                  <button
                    onClick={() => deleteMutation.mutate(m.id)}
                    className="text-rose-500 hover:text-rose-700"
                    title="Delete"
                  >
                    🗑️
                  </button>
                )}
              </div>
              {m.description && (
                <p className="text-sm text-gray-600 mt-3">{m.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                🕒 {m.start_time || '—'}
                {m.end_time ? ` – ${m.end_time}` : ''}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
