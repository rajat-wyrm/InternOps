import { useState, useEffect } from 'react';
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
  Trash2,
  Pencil,
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

const overdue = (d) => new Date(d) < new Date();

// 💡 Extracted TaskCard to isolate state per task item
function TaskCard({
  task,
  user,
  canVerify,
  verifyMutation,
  submitMutation,
  deleteMutation,
}) {
  const [didComment, setDidComment] = useState(false);
  const [didRepost, setDidRepost] = useState(false);
  const [didShare, setDidShare] = useState(false);
  const [showProofs, setShowProofs] = useState(false);

  // Fetch proofs only if this specific task has proofs expanded
  const { data: proofs, isLoading: isLoadingProofs } = useQuery({
    queryKey: ['proofs', task.id],
    queryFn: () => api.get(`/proofs/task/${task.id}`).then((res) => res.data),
    enabled: showProofs,
  });

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!didComment && !didRepost && !didShare) {
      alert('Please select at least one engagement action.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Only image files are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be under 5MB.');
      return;
    }

    submitMutation.mutate(
      {
        taskId: task.id,
        files: [file],
        didComment,
        didRepost,
        didShare,
      },
      {
        onSuccess: () => {
          // Reset local checkbox states on successful submission
          setDidComment(false);
          setDidRepost(false);
          setDidShare(false);
        },
      }
    );
  };

  const isSubmitting =
    submitMutation.isPending && submitMutation.variables?.taskId === task.id;

  return (
    <Card className="p-5 card-hover">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white flex items-center justify-center text-xl shrink-0">
          {PLATFORM_ICON[task.target_platform] || (
            <Target className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-800 dark:text-white">
              {task.title}
            </h3>
            {task.target_platform && (
              <Badge color="purple">{task.target_platform}</Badge>
            )}
            {task.deadline && (
              <Badge color={overdue(task.deadline) ? 'red' : 'green'}>
                {overdue(task.deadline) ? 'Overdue' : 'Active'}
              </Badge>
            )}
          </div>
          {task.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
            {task.task_link && (
              <a
                href={task.task_link}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <LinkIcon className="w-3.5 h-3.5" /> Task link
              </a>
            )}
            {task.deadline && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {new Date(task.deadline).toLocaleString('en-IN', {
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

      <div className="flex items-center gap-2 mt-4">
        {canVerify && (
          <Btn variant="outline" onClick={() => setShowProofs((prev) => !prev)}>
            {showProofs ? 'Hide proofs' : 'View proofs'}
          </Btn>
        )}

        {user?.role === 'INTERN' && (
          <div className="space-y-3">
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={didComment}
                  disabled={isSubmitting}
                  onChange={(e) => setDidComment(e.target.checked)}
                />
                Comment
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={didRepost}
                  disabled={isSubmitting}
                  onChange={(e) => setDidRepost(e.target.checked)}
                />
                Repost
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={didShare}
                  disabled={isSubmitting}
                  onChange={(e) => setDidShare(e.target.checked)}
                />
                Share
              </label>
            </div>

            <label
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-500 to-green-600 text-white cursor-pointer hover:shadow-lg transition w-max ${
                isSubmitting ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <Upload className="w-4 h-4" />
              {isSubmitting ? 'Submitting...' : 'Submit Proof'}
              <input
                type="file"
                accept="image/*"
                disabled={isSubmitting}
                onChange={handleUpload}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      {showProofs && (
        <div className="mt-4 border-t pt-4 space-y-2 animate-fade-in">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-white">
            Proof submissions
          </h4>
          {isLoadingProofs ? (
            <div className="py-2 text-xs text-gray-400 dark:text-gray-500">
              Loading proofs...
            </div>
          ) : !proofs?.length ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              No submissions yet.
            </p>
          ) : (
            proofs.map((p) => {
              const normalized = p.image_path
                ?.replace(/\\/g, '/')
                .replace(/^\/+/, '');
              const base = (import.meta.env.VITE_API_BASE_URL || '').replace(
                /\/+$/,
                ''
              );
              const src = base ? `${base}/${normalized}` : `/${normalized}`;
              const isVerifying =
                verifyMutation.isPending &&
                verifyMutation.variables?.proofId === p.id;

              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800/70 rounded-xl p-2"
                >
                  {p.image_path && (
                    <img
                      src={src}
                      alt="proof"
                      className="w-14 h-14 rounded-lg object-cover border"
                      onError={(e) => {
                        e.currentTarget.style.visibility = 'hidden';
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0 text-xs">
                    <Badge color={p.status === 'VERIFIED' ? 'green' : 'yellow'}>
                      {p.status}
                    </Badge>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {p.did_comment && <Badge color="blue">Comment</Badge>}
                      {p.did_repost && <Badge color="purple">Repost</Badge>}
                      {p.did_share && <Badge color="green">Share</Badge>}
                    </div>
                    <p className="text-gray-400 dark:text-gray-500 mt-1 truncate">
                      Intern:{' '}
                      {p.intern_name ||
                        p.intern_email ||
                        `${p.intern_id.slice(0, 8)}…`}
                    </p>
                  </div>
                  {canVerify && p.status === 'PENDING' && (
                    <Btn
                      variant="success"
                      disabled={isVerifying}
                      onClick={() =>
                        verifyMutation.mutate({
                          proofId: p.id,
                          taskId: task.id,
                        })
                      }
                    >
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />{' '}
                        {isVerifying ? 'Verifying...' : 'Verify'}
                      </span>
                    </Btn>
                  )}
                  {user?.role === 'ADMIN' && (
                    <Btn
                      variant="outline"
                      className="text-red-500 border-red-300 hover:bg-red-50"
                      onClick={() => {
                        if (
                          confirm('Delete this proof? This cannot be undone.')
                        ) {
                          deleteMutation.mutate({
                            proofId: p.id,
                            taskId: task.id,
                          });
                        }
                      }}
                    >
                      <span className="flex items-center gap-1">
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </span>
                    </Btn>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </Card>
  );
}

export default function Tasks({ isProjectView = false, roster = [] } = {}) {
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  const LIMIT = 10;
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedProofTaskId, setSelectedProofTaskId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [draftFiles, setDraftFiles] = useState({
    taskId: null,
    files: [],
    previews: [],
  });
  const [selectedTask, setSelectedTask] = useState(null);
  const [draftEngagement, setDraftEngagement] = useState({
    didComment: false,
    didRepost: false,
    didShare: false,
  });
  const [deletingProofId, setDeletingProofId] = useState(null);

  // Cleanup objectURLs to prevent memory leak (#932)
  useEffect(() => {
    return () => {
      draftFiles.previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [draftFiles.previews]);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 5000);
  };

  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [deletingTaskId, setDeletingTaskId] = useState(null);

  const canCreateTask = ['ADMIN', 'SENIOR_TL'].includes(user?.role);
  const canManageTask = ['ADMIN', 'SENIOR_TL'].includes(user?.role);
  const canVerify = ['ADMIN', 'CAPTAIN', 'TL', 'SENIOR_TL'].includes(
    user?.role
  );

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', page],
    queryFn: () =>
      api.get(`/tasks?page=${page}&limit=${LIMIT}`).then((res) => res.data),
  });

  const tasks = data?.tasks ?? [];
  const totalPages = data?.totalPages ?? 1;
  const { data: proofs, refetch: refetchProofs } = useQuery({
    queryKey: ['proofs', selectedProofTaskId],
    queryFn: () =>
      api.get(`/proofs/task/${selectedProofTaskId}`).then((res) => res.data),
    enabled: !!selectedProofTaskId,
  });

  const effectiveProofs =
    proofs && roster.length > 0
      ? proofs.filter((p) => roster.some((m) => m.id === p.intern_id))
      : proofs;

  const { data: myProofs } = useQuery({
    queryKey: ['myProofs'],
    queryFn: () => api.get('/proofs/my').then((res) => res.data),
    enabled: user?.role === 'INTERN',
  });

  const submitMutation = useMutation({
    mutationFn: async ({ taskId, files, didComment, didRepost, didShare }) => {
      const form = new FormData();
      form.append('task_id', taskId);

      files.forEach((file) => {
        form.append('image', file);
      });

      form.append('didComment', String(!!didComment));
      form.append('didRepost', String(!!didRepost));
      form.append('didShare', String(!!didShare));

      return api.post('/proofs/submit', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },

    onSuccess: (_, variables) => {
      setDraftFiles({ taskId: null, files: [], previews: [] });
      setDraftEngagement({
        didComment: false,
        didRepost: false,
        didShare: false,
      });
      refetchProofs();

      queryClient.invalidateQueries({ queryKey: ['proofs', variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ['proofs'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['myProofs'] });
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.error || 'Failed to submit proof';
      showNotification(errorMsg);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ proofId }) => {
      if (!proofId) {
        throw new Error('Cannot verify proof: proof ID is missing');
      }

      return api.patch(`/proofs/${proofId}/verify`);
    },
    onSuccess: (_, variables) => {
      showNotification('Proof verified successfully');

      queryClient.invalidateQueries({
        queryKey: ['proofs', variables.taskId],
      });
      queryClient.invalidateQueries({ queryKey: ['proofs'] });
    },
    onError: (error) => {
      const errorMsg =
        error.response?.data?.error ||
        error.message ||
        'Could not verify proof. Please try again.';

      showNotification(errorMsg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ proofId }) => {
      if (!proofId) {
        throw new Error('Cannot delete proof: proof ID is missing');
      }

      return api.delete(`/proofs/${proofId}`);
    },
    onSuccess: (_, variables) => {
      showNotification('Proof deleted successfully');

      queryClient.setQueryData(
        ['proofs', variables.taskId],
        (currentProofs) => {
          if (!Array.isArray(currentProofs)) {
            return currentProofs;
          }

          return currentProofs.filter(
            (proof) => proof.id !== variables.proofId
          );
        }
      );

      queryClient.invalidateQueries({
        queryKey: ['proofs', variables.taskId],
      });
      queryClient.invalidateQueries({ queryKey: ['proofs'] });
      queryClient.invalidateQueries({ queryKey: ['myProofs'] });
    },
    onError: (error) => {
      const errorMsg =
        error.response?.data?.error ||
        error.message ||
        'Could not delete proof. Please try again.';

      showNotification(errorMsg);
    },
    onSettled: () => {
      // Always restore the Delete button after success or failure.
      setDeletingProofId(null);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => api.patch(`/tasks/${id}`, data),
    onSuccess: () => {
      setEditingTask(null);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err) =>
      showNotification(err.response?.data?.error || 'Update failed'),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      setDeletingTaskId(null);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err) =>
      showNotification(err.response?.data?.error || 'Delete failed'),
  });

  const deleteImageMutation = useMutation({
    mutationFn: (imageId) => api.delete(`/proofs/images/${imageId}`),
    onSuccess: () => {
      showNotification('Image deleted successfully');
      refetchProofs();
    },
  });

  const handleFileSelect = (e, taskId) => {
    let files = Array.from(e.target.files);

    if (!files.length) return;

    if (files.length > 5) {
      showNotification(
        'You can only upload up to 5 images at a time. Only the first 5 images were kept.'
      );
      files = files.slice(0, 5); // Take max 5 files
    }
    const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        showNotification('Only image files are allowed.');
        return;
      }
      if (file.size > MAX_BYTES) {
        showNotification('File too large — max 5MB');
        return;
      }
    }

    const previews = files.map((f) => URL.createObjectURL(f));
    setDraftFiles({ taskId, files, previews });
  };

  return (
    <div className="animate-fade-in-up">
      {notification && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200 flex items-center justify-between shadow-sm animate-fade-in">
          <span className="font-semibold text-sm">{notification}</span>
          <button
            onClick={() => setNotification(null)}
            className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-full transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isProjectView ? (
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Project Tasks
          </h3>
          {canCreateTask && (
            <Btn onClick={() => setShowForm((s) => !s)}>
              {showForm ? 'Cancel' : 'Create Task'}
            </Btn>
          )}
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900/60 text-violet-600 dark:text-violet-300 flex items-center justify-center shadow-sm">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">
                Social Media Tasks
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Campaigns & proof verification
              </p>
            </div>
          </div>

          {canCreateTask && (
            <Btn onClick={() => setShowForm((s) => !s)}>
              {showForm ? (
                <span className="flex items-center gap-1">
                  <X className="w-4 h-4" /> Cancel
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Create task
                </span>
              )}
            </Btn>
          )}
        </div>
      )}

      {showForm && canCreateTask && (
        <div className="mb-5 animate-fade-in-up">
          <CreateTaskForm />
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-5 md:p-6 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse h-48"
            />
          ))}
        </div>
      ) : !tasks?.length ? (
        <EmptyState
          icon={<Target className="w-12 h-12 text-gray-400" />}
          title="No tasks yet"
          text={
            canCreateTask
              ? 'Create a campaign to get started.'
              : 'New tasks will appear here.'
          }
        />
      ) : (
        <>
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
                      <div className="flex items-start justify-between gap-2">
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

                        {canManageTask && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition"
                              title="Edit task"
                              onClick={() => {
                                setEditingTask(t.id);
                                setEditForm({
                                  title: t.title,
                                  description: t.description || '',
                                  targetPlatform: t.target_platform || '',
                                  taskLink: t.task_link || '',
                                  deadline: t.deadline
                                    ? new Date(t.deadline)
                                        .toISOString()
                                        .slice(0, 16)
                                    : '',
                                });
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {deletingTaskId === t.id ? (
                              <div className="flex items-center gap-1 animate-fade-in">
                                <button
                                  type="button"
                                  className="px-2 py-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                                  onClick={() => setDeletingTaskId(null)}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="px-2 py-1 text-xs rounded-xl bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-60"
                                  disabled={deleteTaskMutation.isPending}
                                  onClick={() =>
                                    deleteTaskMutation.mutate(t.id)
                                  }
                                >
                                  {deleteTaskMutation.isPending
                                    ? 'Deleting…'
                                    : 'Confirm'}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                                title="Delete task"
                                onClick={() => setDeletingTaskId(t.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
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

                  {editingTask === t.id && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3 animate-fade-in">
                      <p className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Edit Task
                      </p>
                      <input
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl px-4 py-2.5 w-full text-sm focus:ring-2 focus:ring-indigo-400/50 outline-none"
                        placeholder="Title"
                        value={editForm.title}
                        onChange={(e) =>
                          setEditForm({ ...editForm, title: e.target.value })
                        }
                      />
                      <textarea
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl px-4 py-2.5 w-full text-sm focus:ring-2 focus:ring-indigo-400/50 outline-none resize-none"
                        placeholder="Description"
                        rows={2}
                        value={editForm.description}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            description: e.target.value,
                          })
                        }
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400/50 outline-none"
                          placeholder="Platform"
                          value={editForm.targetPlatform}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              targetPlatform: e.target.value,
                            })
                          }
                        />
                        <input
                          type="datetime-local"
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400/50 outline-none"
                          value={editForm.deadline}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              deadline: e.target.value,
                            })
                          }
                        />
                      </div>
                      <input
                        type="url"
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl px-4 py-2.5 w-full text-sm focus:ring-2 focus:ring-indigo-400/50 outline-none"
                        placeholder="Task link (https://…)"
                        value={editForm.taskLink}
                        onChange={(e) =>
                          setEditForm({ ...editForm, taskLink: e.target.value })
                        }
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="px-2 py-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                          onClick={() => setEditingTask(null)}
                        >
                          Cancel
                        </button>
                        <Btn
                          variant="primary"
                          className="rounded-2xl py-1.5 text-sm"
                          disabled={updateTaskMutation.isPending}
                          onClick={() =>
                            updateTaskMutation.mutate({
                              id: t.id,
                              data: editForm,
                            })
                          }
                        >
                          {updateTaskMutation.isPending
                            ? 'Saving…'
                            : 'Save changes'}
                        </Btn>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-slate-200 dark:border-slate-700">
                    {canVerify && (
                      <Btn
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() =>
                          setSelectedProofTaskId(
                            selectedProofTaskId === t.id ? null : t.id
                          )
                        }
                      >
                        {selectedProofTaskId === t.id
                          ? 'Hide proofs'
                          : 'View proofs'}
                      </Btn>
                    )}

                    {user?.role === 'INTERN' &&
                      (myProofs?.some((p) => p.task_id === t.id) ? (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed">
                          <CheckCircle className="w-4 h-4" /> Submitted
                        </div>
                      ) : draftFiles.taskId === t.id ? (
                        <div className="flex flex-col gap-3 w-full animate-fade-in">
                          <div className="flex gap-2 overflow-x-auto pb-2">
                            {draftFiles.previews.map((src, i) => (
                              <img
                                key={i}
                                src={src}
                                alt="Preview"
                                className="w-16 h-16 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 shadow-sm"
                              />
                            ))}
                          </div>
                          <div className="flex gap-4 text-sm">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={draftEngagement.didComment}
                                disabled={submitMutation.isPending}
                                onChange={(e) =>
                                  setDraftEngagement({
                                    ...draftEngagement,
                                    didComment: e.target.checked,
                                  })
                                }
                              />
                              Comment
                            </label>

                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={draftEngagement.didRepost}
                                disabled={submitMutation.isPending}
                                onChange={(e) =>
                                  setDraftEngagement({
                                    ...draftEngagement,
                                    didRepost: e.target.checked,
                                  })
                                }
                              />
                              Repost
                            </label>

                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={draftEngagement.didShare}
                                disabled={submitMutation.isPending}
                                onChange={(e) =>
                                  setDraftEngagement({
                                    ...draftEngagement,
                                    didShare: e.target.checked,
                                  })
                                }
                              />
                              Share
                            </label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Btn
                              variant="outline"
                              className="text-sm rounded-2xl py-1.5"
                              onClick={() => {
                                setDraftFiles({
                                  taskId: null,
                                  files: [],
                                  previews: [],
                                });
                                setDraftEngagement({
                                  didComment: false,
                                  didRepost: false,
                                  didShare: false,
                                });
                              }}
                            >
                              Cancel
                            </Btn>
                            <Btn
                              variant="success"
                              className="text-sm rounded-2xl py-1.5 flex items-center gap-2"
                              onClick={() => {
                                if (
                                  !draftEngagement.didComment &&
                                  !draftEngagement.didRepost &&
                                  !draftEngagement.didShare
                                ) {
                                  showNotification(
                                    'Please select at least one engagement action.'
                                  );
                                  return;
                                }
                                submitMutation.mutate({
                                  taskId: t.id,
                                  files: draftFiles.files,
                                  didComment: draftEngagement.didComment,
                                  didRepost: draftEngagement.didRepost,
                                  didShare: draftEngagement.didShare,
                                });
                              }}
                              disabled={submitMutation.isPending}
                            >
                              {submitMutation.isPending && (
                                <span className="w-3 h-3 rounded-full border-2 border-t-white border-white/30 animate-spin" />
                              )}
                              {submitMutation.isPending
                                ? 'Submitting...'
                                : 'Confirm Upload'}
                            </Btn>
                          </div>
                        </div>
                      ) : (
                        <label className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white cursor-pointer hover:shadow-lg hover:shadow-emerald-200 dark:hover:shadow-none transition">
                          <Upload className="w-4 h-4" /> Select Proof
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => handleFileSelect(e, t.id)}
                            className="hidden"
                          />
                        </label>
                      ))}
                  </div>

                  {selectedProofTaskId === t.id && (
                    <div className="mt-5 border-t border-slate-200 dark:border-slate-700 pt-5 space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-sm font-extrabold text-slate-800 dark:text-white">
                          Proof submissions
                        </h4>

                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {effectiveProofs?.length || 0} submission
                          {effectiveProofs?.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      {!effectiveProofs?.length ? (
                        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-4">
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            No submissions yet.
                          </p>
                        </div>
                      ) : (
                        effectiveProofs.map((p) => (
                          <div
                            key={p.id}
                            className="flex flex-col md:flex-row items-start md:items-center gap-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 w-full"
                          >
                            {(() => {
                              const images =
                                p.images && p.images.length > 0
                                  ? p.images
                                  : p.image_path
                                    ? [{ image_path: p.image_path }]
                                    : [];
                              if (!images.length) return null;

                              return (
                                <div className="flex gap-2 overflow-x-auto max-w-[200px] md:max-w-[300px]">
                                  {images.map((imgObj, i) => {
                                    const imgPath = imgObj.image_path || imgObj;
                                    const normalized = imgPath
                                      .replace(/\\/g, '/')
                                      .replace(/^\/+/, '');
                                    const base = (
                                      import.meta.env.VITE_API_URL ||
                                      import.meta.env.VITE_API_BASE_URL ||
                                      ''
                                    ).replace(/\/+$/, '');
                                    const src = base
                                      ? `${base}/${normalized}`
                                      : `/${normalized}`;
                                    return (
                                      <div
                                        key={i}
                                        className="relative group shrink-0"
                                      >
                                        <img
                                          src={src}
                                          alt="proof"
                                          className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer hover:opacity-80 transition"
                                          onClick={() =>
                                            window.open(src, '_blank')
                                          }
                                          onError={(e) => {
                                            e.currentTarget.style.visibility =
                                              'hidden';
                                          }}
                                        />
                                        {user?.role === 'ADMIN' &&
                                          imgObj.id && (
                                            <button
                                              type="button"
                                              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm hover:bg-red-600"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                deleteImageMutation.mutate(
                                                  imgObj.id
                                                );
                                              }}
                                              title="Delete this image"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          )}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}

                            <div className="flex-1 min-w-[120px] w-full md:w-auto text-xs overflow-hidden">
                              <Badge
                                color={
                                  p.status === 'VERIFIED' ? 'green' : 'yellow'
                                }
                              >
                                {p.status}
                              </Badge>

                              <p className="text-slate-500 dark:text-slate-400 mt-2 truncate w-full">
                                Intern:{' '}
                                {p.intern_name ||
                                  p.intern_email ||
                                  `${p.intern_id.slice(0, 8)}…`}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto mt-2 md:mt-0 md:ml-auto">
                              {canVerify && p.status === 'PENDING' && (
                                <Btn
                                  variant="success"
                                  className="rounded-2xl"
                                  onClick={() =>
                                    verifyMutation.mutate({
                                      proofId: p.id,
                                      taskId: t.id,
                                    })
                                  }
                                  disabled={verifyMutation.isPending}
                                >
                                  <span className="flex items-center gap-1">
                                    <CheckCircle className="w-4 h-4" />
                                    {verifyMutation.isPending
                                      ? 'Verifying...'
                                      : 'Verify'}
                                  </span>
                                </Btn>
                              )}

                              {user?.role === 'ADMIN' &&
                                (deletingProofId === p.id ? (
                                  <div className="flex items-center gap-2 animate-fade-in">
                                    <Btn
                                      variant="outline"
                                      className="rounded-2xl py-1 px-3 text-xs"
                                      onClick={() => setDeletingProofId(null)}
                                    >
                                      Cancel
                                    </Btn>
                                    <Btn
                                      variant="danger"
                                      className="rounded-2xl py-1 px-3 text-xs bg-red-500 hover:bg-red-600 text-white border-transparent"
                                      onClick={() =>
                                        deleteMutation.mutate({
                                          proofId: p.id,
                                          taskId: t.id,
                                        })
                                      }
                                      disabled={deleteMutation.isPending}
                                    >
                                      {deleteMutation.isPending
                                        ? 'Deleting...'
                                        : 'Confirm'}
                                    </Btn>
                                  </div>
                                ) : (
                                  <Btn
                                    variant="outline"
                                    className="rounded-2xl text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    onClick={() => setDeletingProofId(p.id)}
                                  >
                                    <span className="flex items-center gap-1">
                                      <Trash2 className="w-4 h-4" /> Delete
                                    </span>
                                  </Btn>
                                ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <div className="flex justify-center items-center gap-4 mt-8">
            <Btn
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Btn>

            <span className="text-sm font-medium">
              Page {page} of {totalPages}
            </span>

            <Btn
              variant="outline"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}
