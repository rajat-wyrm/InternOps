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
      {/* Professional Header Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm">
            <Video className="w-6 h-6" />
          </div>

          <div>
            <p className="text-xs md:text-sm uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300 font-extrabold mb-1">
              Team Sync
            </p>

            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Meetings
            </h1>

            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
              Schedule and track team meetings
            </p>
          </div>
        </div>

        {canCreate && (
          <Btn
            onClick={() => setShowForm((s) => !s)}
            className="rounded-2xl px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:shadow-indigo-200 dark:hover:shadow-none"
          >
            {showForm ? (
              <span className="flex items-center gap-2">
                <X className="w-4 h-4" /> Cancel
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" /> Schedule meeting
              </span>
            )}
          </Btn>
        )}
      </div>

      {showForm && (
        <Card className="p-5 md:p-6 mb-6 animate-fade-in-up border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
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
              <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                Agenda
              </label>
              <Textarea
                placeholder="Topics to discuss..."
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
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
                <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
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
                <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
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
              <div className="pt-1">
                <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                  Attendees ({attendees.length} selected)
                </label>

                <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700">
                  {team.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => toggle(m.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        attendees.includes(m.id)
                          ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/20 ring-offset-1 dark:ring-offset-slate-900'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
                      }`}
                    >
                      {m.full_name || m.email}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-1">
              <Btn
                variant="success"
                type="submit"
                disabled={createMutation.isPending}
                className="w-full sm:w-auto rounded-2xl px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:shadow-emerald-200 dark:hover:shadow-none"
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
          icon={<Calendar className="w-12 h-12 text-blue-300" />}
          title="No meetings scheduled"
          text={
            canCreate
              ? 'Schedule your first team sync above.'
              : 'You have no upcoming meetings.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {meetings.map((m) => (
            <Card
              key={m.id}
              className="p-5 md:p-6 card-hover border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-900/60 flex items-center justify-center shrink-0">
                    <Video className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <h3 className="font-extrabold text-slate-900 dark:text-white leading-tight truncate">
                      {m.title}
                    </h3>

                    <div className="mt-2">
                      <Badge color="blue" className="font-bold">
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
                    className="text-slate-300 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-2 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete meeting"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {m.description && (
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-4 leading-relaxed bg-slate-50 dark:bg-slate-800/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                  {m.description}
                </p>
              )}

              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
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
