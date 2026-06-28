import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Target,
  Briefcase,
  Camera,
  MessageCircle,
  ThumbsUp,
  PlaySquare,
  Upload,
  CheckCircle,
  Link as LinkIcon,
  Clock,
  Plus,
  X,
} from 'lucide-react';
import api from '../lib/axios';
import useAuthStore from '../store/auth';
import CreateTaskForm from '../components/CreateTaskForm';
import { Card, Btn, Badge, EmptyState, Spinner } from '../components/ui';

const PLATFORM_ICON = {
  LinkedIn: <Briefcase className="w-5 h-5" />,
  Instagram: <Camera className="w-5 h-5" />,
  Twitter: <MessageCircle className="w-5 h-5" />,
  Facebook: <ThumbsUp className="w-5 h-5" />,
  YouTube: <PlaySquare className="w-5 h-5" />,
};

export default function Tasks() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const canCreateTask = ['ADMIN', 'SENIOR_TL'].includes(user?.role);
  const canVerify = ['ADMIN', 'CAPTAIN', 'TL', 'SENIOR_TL'].includes(
    user?.role
  );

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.get('/tasks').then((res) => res.data),
  });

  const { data: proofs, refetch: refetchProofs } = useQuery({
    queryKey: ['proofs', selectedTask],
    queryFn: () =>
      api.get(`/proofs/task/${selectedTask}`).then((res) => res.data),
    enabled: !!selectedTask,
  });

  const submitMutation = useMutation({
    mutationFn: ({ taskId, file }) => {
      const form = new FormData();
      form.append('task_id', taskId);
      form.append('image', file);

      return api.post('/proofs/submit', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      refetchProofs();
      queryClient.invalidateQueries({ queryKey: ['proofs'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (proofId) => api.patch(`/proofs/${proofId}/verify`),
    onSuccess: () => refetchProofs(),
  });

  const handleUpload = (e, taskId) => {
    const file = e.target.files[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Only image files are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be under 5MB.');
      return;
    }

    submitMutation.mutate({ taskId, file });
  };

  const overdue = (d) => new Date(d) < new Date();

  return (
    <div className="animate-fade-in-up">
      {/* Professional Header Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900/60 text-violet-600 dark:text-violet-300 flex items-center justify-center shadow-sm">
            <Target className="w-6 h-6" />
          </div>

          <div>
            <p className="text-xs md:text-sm uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300 font-extrabold mb-1">
              Campaign Tasks
            </p>

            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Social Media Tasks
            </h1>

            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
              Manage campaigns, submissions, and proof verification.
            </p>
          </div>
        </div>

        {canCreateTask && (
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
                <Plus className="w-4 h-4" /> Create task
              </span>
            )}
          </Btn>
        )}
      </div>

      {/* Create Task Form */}
      {showForm && canCreateTask && (
        <div className="mb-6 animate-fade-in-up">
          <Card className="p-5 md:p-6 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
            <CreateTaskForm />
          </Card>
        </div>
      )}

      {isLoading ? (
        <Spinner />
      ) : !tasks?.length ? (
        <EmptyState
          icon={<Target className="w-12 h-12 text-slate-400" />}
          title="No tasks yet"
          text={
            canCreateTask
              ? 'Create a campaign to get started.'
              : 'New tasks will appear here.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {tasks.map((t) => {
            const isOverdue = t.deadline && overdue(t.deadline);

            return (
              <Card
                key={t.id}
                className="p-5 md:p-6 card-hover border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-600 text-white flex items-center justify-center text-xl shrink-0 shadow-md">
                    {PLATFORM_ICON[t.target_platform] || (
                      <Target className="w-5 h-5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                        {t.title}
                      </h3>

                      {t.target_platform && (
                        <Badge color="purple">{t.target_platform}</Badge>
                      )}

                      {t.deadline && (
                        <Badge color={isOverdue ? 'red' : 'green'}>
                          {isOverdue ? 'Overdue' : 'Active'}
                        </Badge>
                      )}
                    </div>

                    {t.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                        {t.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-slate-500 dark:text-slate-400">
                      {t.task_link && (
                        <a
                          href={t.task_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <LinkIcon className="w-3.5 h-3.5" /> Task link
                        </a>
                      )}

                      {t.deadline && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(t.deadline).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                            timeZone: 'Asia/Kolkata',
                          })}{' '}
                          IST
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-slate-200 dark:border-slate-700">
                  {canVerify && (
                    <Btn
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() =>
                        setSelectedTask(selectedTask === t.id ? null : t.id)
                      }
                    >
                      {selectedTask === t.id ? 'Hide proofs' : 'View proofs'}
                    </Btn>
                  )}

                  {user?.role === 'INTERN' && (
                    <label className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white cursor-pointer hover:shadow-lg hover:shadow-emerald-200 dark:hover:shadow-none transition">
                      <Upload className="w-4 h-4" /> Submit Proof
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleUpload(e, t.id)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {selectedTask === t.id && (
                  <div className="mt-5 border-t border-slate-200 dark:border-slate-700 pt-5 space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-extrabold text-slate-800 dark:text-white">
                        Proof submissions
                      </h4>

                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {proofs?.length || 0} submission
                        {proofs?.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {!proofs?.length ? (
                      <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          No submissions yet.
                        </p>
                      </div>
                    ) : (
                      proofs.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-3"
                        >
                          {p.image_path &&
                            (() => {
                              const normalized = p.image_path
                                .replace(/\\/g, '/')
                                .replace(/^\/+/, '');
                              const base = (
                                import.meta.env.VITE_API_BASE_URL || ''
                              ).replace(/\/+$/, '');
                              const src = base
                                ? `${base}/${normalized}`
                                : `/${normalized}`;

                              return (
                                <img
                                  src={src}
                                  alt="proof"
                                  className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                  onError={(e) => {
                                    e.currentTarget.style.visibility = 'hidden';
                                  }}
                                />
                              );
                            })()}

                          <div className="flex-1 min-w-0 text-xs">
                            <Badge
                              color={
                                p.status === 'VERIFIED' ? 'green' : 'yellow'
                              }
                            >
                              {p.status}
                            </Badge>

                            <p className="text-slate-500 dark:text-slate-400 mt-2 truncate">
                              Intern:{' '}
                              {p.intern_name ||
                                p.intern_email ||
                                `${p.intern_id.slice(0, 8)}…`}
                            </p>
                          </div>

                          {canVerify && p.status === 'PENDING' && (
                            <Btn
                              variant="success"
                              className="rounded-2xl"
                              onClick={() => verifyMutation.mutate(p.id)}
                            >
                              <span className="flex items-center gap-1">
                                <CheckCircle className="w-4 h-4" /> Verify
                              </span>
                            </Btn>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
