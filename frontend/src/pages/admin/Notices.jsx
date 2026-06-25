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

const CATEGORIES = ['GENERAL', 'REMINDER', 'ALERT', 'NEWS'];

const CATEGORY_STYLES = {
  GENERAL: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  REMINDER: 'bg-amber-50  text-amber-700  border-amber-100',
  ALERT: 'bg-rose-50   text-rose-700   border-rose-100',
  NEWS: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const CATEGORY_META = {
  GENERAL: { Icon: Megaphone, color: 'text-indigo-500', label: 'General' },
  REMINDER: { Icon: Clock, color: 'text-amber-500', label: 'Reminder' },
  ALERT: { Icon: AlertTriangle, color: 'text-rose-500', label: 'Alert' },
  NEWS: { Icon: Newspaper, color: 'text-emerald-500', label: 'News' },
};

/* ── Custom UI Components ── */
function CategoryBadge({ category }) {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.GENERAL;
  const { Icon } = meta;
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${CATEGORY_STYLES[category] ?? CATEGORY_STYLES.GENERAL}`}
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
      />
      <textarea
        placeholder="Notice content…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
      />
      <div className="flex items-center gap-3">
        {/* ── Category dropdown — browser-native open/close, zero JS needed ── */}
        <details className="relative w-64 group">
          <summary className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full justify-between bg-white list-none cursor-pointer">
            <CategoryBadge category={category} />
            <span className="text-gray-400 text-xs transition-transform group-open:rotate-180">
              ▼
            </span>
          </summary>
          <div className="absolute z-50 mt-1 w-64 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {CATEGORIES.map((c) => (
              <div
                key={c}
                onClick={() => {
                  setCategory(c);
                  document
                    .querySelector('details[open]')
                    ?.removeAttribute('open');
                }}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-50 text-sm"
              >
                <CategoryBadge category={c} />
              </div>
            ))}
          </div>
        </details>

        <Btn
          disabled={isPending || !title.trim() || !content.trim()}
          onClick={() =>
            onSubmit({ title: title.trim(), content: content.trim(), category })
          }
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
            className="flex items-center gap-1 text-sm text-rose-400 hover:text-rose-600 transition-colors"
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
  const [deletingId, setDeletingId] = useState(null);
  const [noticeToDelete, setNoticeToDelete] = useState(null);

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['notices-admin'],
    queryFn: () => api.get('/notices').then((r) => r.data),
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
        isOpen={!!noticeToDelete}
        title="Delete Notice"
        message={`Are you sure you want to permanently delete "${noticeToDelete?.title}"?`}
        onConfirm={() => deleteMut.mutate(noticeToDelete.id)}
        onCancel={() => setNoticeToDelete(null)}
      />

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-amber-100 text-amber-600 rounded-lg shadow-sm">
          <Megaphone className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
            Notice Board
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage announcements visible on the login page
          </p>
        </div>
      </div>

      <Card className="p-6 mb-6 border-amber-100 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-amber-500" /> New Notice
        </h3>
        {formError && (
          <div className="flex items-center gap-2 text-rose-600 text-sm mb-4 bg-rose-50 p-3 rounded-lg border border-rose-100">
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
          icon={<Megaphone className="w-12 h-12 text-gray-300" />}
          title="No notices yet"
          text="Publish your first notice above — it'll appear on the login page immediately."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {notices.map((n) => (
            <Card
              key={n.id}
              className={`p-5 transition-all group ${!n.is_active ? 'opacity-60' : ''}`}
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
                    <p className="font-bold text-gray-900">{n.title}</p>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {n.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => setEditingId(n.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        updateMut.mutate({ id: n.id, is_active: !n.is_active })
                      }
                      className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50"
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
                        className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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
