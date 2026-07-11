import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Megaphone,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  EyeOff,
  Eye,
  Pencil,
  X,
  Check,
  Clock,
  AlertTriangle,
  Newspaper,
} from 'lucide-react';
import api from '../../lib/axios';
import useAuthStore from '../../store/auth';
import {
  Card,
  Btn,
  Input,
  EmptyState,
  Spinner,
  ConfirmationModal,
} from '../../components/ui';
import CustomSelect from '../../components/CustomSelect';

const CATEGORIES = ['GENERAL', 'REMINDER', 'ALERT', 'NEWS'];

const CATEGORY_STYLES = {
  GENERAL:
    'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/60',
  REMINDER:
    'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/60',
  ALERT:
    'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-900/60',
  NEWS: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/60',
};

const CATEGORY_META = {
  GENERAL: { Icon: Megaphone, color: 'text-indigo-500', label: 'General' },
  REMINDER: { Icon: Clock, color: 'text-amber-500', label: 'Reminder' },
  ALERT: { Icon: AlertTriangle, color: 'text-rose-500', label: 'Alert' },
  NEWS: { Icon: Newspaper, color: 'text-emerald-500', label: 'News' },
};

const CATEGORY_OPTIONS = CATEGORIES.map((category) => ({
  value: category,
  label: CATEGORY_META[category]?.label || category,
}));

/* ── Custom UI Components ── */
function CategoryBadge({ category }) {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.GENERAL;
  const { Icon } = meta;

  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${
        CATEGORY_STYLES[category] ?? CATEGORY_STYLES.GENERAL
      }`}
    >
      <Icon className={`w-3 h-3 ${meta.color}`} />
      {meta.label}
    </span>
  );
}

function NoticeForm({
  initial = {},
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
}) {
  const [title, setTitle] = useState(initial.title ?? '');
  const [content, setContent] = useState(initial.content ?? '');
  const [category, setCategory] = useState(initial.category ?? 'GENERAL');

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Notice title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={isPending}
      />

      <textarea
        placeholder="Notice content…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        disabled={isPending}
        className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 resize-none transition disabled:opacity-60 disabled:cursor-not-allowed"
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="w-full sm:w-64">
          <CustomSelect
            value={category}
            onChange={setCategory}
            options={CATEGORY_OPTIONS}
            placeholder="Select category"
            disabled={isPending}
            className="w-full"
          />
        </div>

        <Btn
          disabled={isPending || !title.trim() || !content.trim()}
          onClick={() =>
            onSubmit({ title: title.trim(), content: content.trim(), category })
          }
          className="rounded-2xl"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4" /> {submitLabel}
            </span>
          )}
        </Btn>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex items-center gap-1 text-sm font-bold text-rose-500 hover:text-rose-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" /> Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default function Notices() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';
  const queryClient = useQueryClient();

  const inv = () =>
    queryClient.invalidateQueries({ queryKey: ['notices-admin'] });

  const [formKey, setFormKey] = useState(0);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [noticeToDelete, setNoticeToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['notices-admin'],
    // Defensive: always resolve to an array, even if the backend ever sends
    // back an error object (e.g. { error, notices: [] }) instead of a bare
    // array — prevents "notices.map is not a function" crashes.
    queryFn: () =>
      api.get('/notices').then((r) => (Array.isArray(r.data) ? r.data : [])),
  });

  const createMut = useMutation({
    mutationFn: (body) => api.post('/notices', body),
    onSuccess: () => {
      setFormError('');
      setFormKey((k) => k + 1);
      inv();
    },
    onError: (err) =>
      setFormError(err.response?.data?.error || 'Failed to create notice'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/notices/${id}`, body),
    onSuccess: () => {
      setEditingId(null);
      inv();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/notices/${id}`),
    onSuccess: () => {
      inv();
      setNoticeToDelete(null);
    },
    onSettled: () => setDeletingId(null),
  });

  return (
    <div className="animate-fade-in-up">
      <ConfirmationModal
        open={!!noticeToDelete}
        title="Delete Notice"
        message={`Are you sure you want to permanently delete "${noticeToDelete?.title}"?`}
        onConfirm={() => {
          setDeletingId(noticeToDelete.id);
          deleteMut.mutate(noticeToDelete.id);
        }}
        onCancel={() => setNoticeToDelete(null)}
        loading={deleteMut.isPending}
        danger={true}
      />

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 rounded-lg shadow-sm border border-amber-100 dark:border-amber-900/60">
          <Megaphone className="w-6 h-6" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
            Notice Board
          </h1>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage announcements visible on the login page
          </p>
        </div>
      </div>

      <Card className="p-6 mb-6 shadow-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-amber-500" /> New Notice
        </h3>

        {formError && (
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-300 text-sm mb-4 bg-rose-50 dark:bg-rose-950/20 p-3 rounded-lg border border-rose-100 dark:border-rose-900/60">
            <AlertCircle className="w-4 h-4" /> {formError}
          </div>
        )}

        <NoticeForm
          key={formKey}
          onSubmit={(body) => createMut.mutate(body)}
          isPending={createMut.isPending}
          submitLabel="Publish Notice"
        />
      </Card>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : notices.length === 0 ? (
        <EmptyState
          icon="📭"
          title="No notices yet"
          text="Publish your first notice above — it'll appear on the login page immediately."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {notices.map((n) => (
            <Card
              key={n.id}
              className={`p-5 transition-all group border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 ${
                !n.is_active ? 'opacity-60' : ''
              }`}
            >
              {editingId === n.id ? (
                <NoticeForm
                  initial={n}
                  onSubmit={(body) => updateMut.mutate({ id: n.id, ...body })}
                  onCancel={() => setEditingId(null)}
                  isPending={updateMut.isPending}
                  submitLabel="Save Changes"
                />
              ) : (
                <div className="flex items-start gap-4">
                  <CategoryBadge category={n.category} />

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {n.title}
                    </p>

                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                      {n.content}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => setEditingId(n.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20"
                      title="Edit notice"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() =>
                        updateMut.mutate({ id: n.id, is_active: !n.is_active })
                      }
                      className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                      title={n.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {n.is_active ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>

                    {isAdmin && (
                      <button
                        disabled={deletingId === n.id}
                        onClick={() => setNoticeToDelete(n)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        title="Delete permanently"
                      >
                        {deletingId === n.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
