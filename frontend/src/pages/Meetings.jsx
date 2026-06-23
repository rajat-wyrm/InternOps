import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Video, X, Plus, Calendar, Clock, Trash2 } from 'lucide-react';
import api from '../lib/axios';
import useAuthStore from '../store/auth';
import {
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
    <div className="animate-fade-in-up">
      {/* 🚀 Professional Header Block 🚀 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg shadow-sm">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
              Meetings
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Schedule and track team meetings
            </p>
          </div>
        </div>

        {canCreate && (
          <Btn onClick={() => setShowForm((s) => !s)}>
            {showForm ? (
              <span className="flex items-center gap-1.5">
                <X className="w-4 h-4" /> Cancel
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Schedule meeting
              </span>
            )}
          </Btn>
        )}
      </div>

      {showForm && (
        <Card className="p-5 mb-6 animate-fade-in-up border-blue-100 shadow-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                Title
              </label>
              <Input
                placeholder="E.g., Weekly Sync"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                Agenda
              </label>
              <Textarea
                placeholder="Topics to discuss..."
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                  Date
                </label>
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
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                  Start Time
                </label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) =>
                    setForm({ ...form, startTime: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                  End Time
                </label>
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
              <div className="pt-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                  Attendees ({attendees.length} selected)
                </label>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-xl border border-gray-100">
                  {team.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => toggle(m.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        attendees.includes(m.id)
                          ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/20 ring-offset-1'
                          : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      {m.full_name || m.email}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="pt-2">
              <Btn
                variant="success"
                type="submit"
                disabled={createMutation.isPending}
                className="w-full sm:w-auto"
              >
                {createMutation.isPending ? 'Creating...' : 'Create meeting'}
              </Btn>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : !meetings?.length ? (
        <EmptyState
          icon={<Calendar className="w-12 h-12 text-blue-200" />}
          title="No meetings scheduled"
          text={
            canCreate
              ? 'Schedule your first team sync above.'
              : 'You have no upcoming meetings.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {meetings.map((m) => (
            <Card
              key={m.id}
              className="p-5 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 leading-tight">
                      {m.title}
                    </h3>
                    <div className="mt-1">
                      <Badge color="blue" className="font-medium">
                        {new Date(m.meeting_date).toLocaleDateString(
                          undefined,
                          {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          }
                        )}
                      </Badge>
                    </div>
                  </div>
                </div>
                {m.created_by === user?.id && (
                  <button
                    onClick={() => deleteMutation.mutate(m.id)}
                    className="text-gray-300 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete meeting"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {m.description && (
                <p className="text-sm text-gray-600 mt-4 leading-relaxed bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                  {m.description}
                </p>
              )}

              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mt-4 pt-4 border-t border-gray-50">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                {m.start_time || 'TBD'}
                {m.end_time ? ` – ${m.end_time}` : ''}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
