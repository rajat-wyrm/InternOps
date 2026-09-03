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
  Upload,
  Link as LinkIcon,
  Star,
  Briefcase,
  CalendarDays,
  FileWarning,
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

const CATEGORIES = [
  'GENERAL',
  'REMINDER',
  'ALERT',
  'NEWS',
  'INTERNSHIP',
  'ANNOUNCEMENT',
  'EVENT',
  'IMPORTANT',
  'DEADLINE',
];

const CATEGORY_STYLES = {
  GENERAL:
    'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/60',
  REMINDER:
    'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/60',
  ALERT:
    'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-900/60',
  NEWS: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/60',
  INTERNSHIP:
    'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-900/60',
  ANNOUNCEMENT:
    'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900/60',
  EVENT:
    'bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-100 dark:border-fuchsia-900/60',
  IMPORTANT:
    'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-100 dark:border-red-900/60',
  DEADLINE:
    'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-900/60',
};

const CATEGORY_META = {
  GENERAL: { Icon: Megaphone, color: 'text-indigo-500', label: 'General' },
  REMINDER: { Icon: Clock, color: 'text-amber-500', label: 'Reminder' },
  ALERT: { Icon: AlertTriangle, color: 'text-rose-500', label: 'Alert' },
  NEWS: { Icon: Newspaper, color: 'text-emerald-500', label: 'News' },
  INTERNSHIP: {
    Icon: Briefcase,
    color: 'text-purple-500',
    label: 'Internship',
  },
  ANNOUNCEMENT: {
    Icon: Megaphone,
    color: 'text-blue-500',
    label: 'Announcement',
  },
  EVENT: { Icon: CalendarDays, color: 'text-fuchsia-500', label: 'Event' },
  IMPORTANT: { Icon: FileWarning, color: 'text-red-500', label: 'Important' },
  DEADLINE: { Icon: Clock, color: 'text-orange-500', label: 'Deadline' },
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
  const [image_url, setImageUrl] = useState(initial.image_url ?? '');
  const [action_button_text, setActionButtonText] = useState(
    initial.action_button_text ?? ''
  );
  const [action_button_link, setActionButtonLink] = useState(
    initial.action_button_link ?? ''
  );
  const [is_featured, setIsFeatured] = useState(initial.is_featured ?? false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    setUploadError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/uploads/notice-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImageUrl(res.data.image_url);
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {uploadError && (
        <div className="text-sm text-red-500 p-2 bg-red-50 rounded-lg">
          {uploadError}
        </div>
      )}

      <div className="flex items-center gap-4">
        {image_url && (
          <img
            src={image_url}
            alt="Notice Preview"
            className="h-16 w-32 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
          />
        )}
        <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 text-slate-500" />
          )}
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {image_url ? 'Change Image' : 'Upload Image (Optional)'}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
            disabled={isPending || isUploading}
          />
        </label>
        {image_url && (
          <button
            type="button"
            onClick={() => setImageUrl('')}
            className="text-rose-500 text-sm hover:underline"
          >
            Remove
          </button>
        )}
      </div>

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

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Action Button Text (e.g. Apply Now)"
          value={action_button_text}
          onChange={(e) => setActionButtonText(e.target.value)}
          disabled={isPending}
          className="flex-1"
        />
        <div className="flex-1 relative">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="url"
            placeholder="Action Button Link (https://...)"
            value={action_button_link}
            onChange={(e) => setActionButtonLink(e.target.value)}
            disabled={isPending}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-4 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-400/50 transition disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-1 mb-2">
        <input
          type="checkbox"
          id="is_featured"
          checked={is_featured}
          onChange={(e) => setIsFeatured(e.target.checked)}
          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
        />
        <label
          htmlFor="is_featured"
          className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1"
        >
          Mark as Featured{' '}
          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
        </label>
      </div>

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
          disabled={
            isPending || isUploading || !title.trim() || !content.trim()
          }
          onClick={() =>
            onSubmit({
              title: title.trim(),
              content: content.trim(),
              category,
              image_url: image_url || null,
              action_button_text: action_button_text || null,
              action_button_link: action_button_link || null,
              is_featured,
            })
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
  const [page, setPage] = useState(1);

  const {
    data: noticesData,
    isLoading,
    isError,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['notices-admin', page],
    queryFn: () =>
      api
        .get(`/notices?page=${page}&limit=10`)
        .then((r) => r.data || { notices: [], count: 0 }),
  });

  const notices = Array.isArray(noticesData)
    ? noticesData
    : noticesData?.data || [];
  // Backend se humein list mil rahi hai, toh array length se total items calculate kar lete hain
  const totalNotices = noticesData?.total || notices.length || 0;

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
      setFormError('');
      inv();
    },

    onError: (err) => {
      setFormError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Failed to update notice'
      );
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/notices/${id}`),

    onSuccess: () => {
      setFormError('');
      inv();
      setNoticeToDelete(null);
    },

    onError: (err) => {
      setFormError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Failed to delete notice'
      );
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

      {isError ? (
        <Card className="p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-red-600">
              Failed to load notices
            </h3>

            <Btn className="mt-4" onClick={() => refetch()}>
              Retry
            </Btn>
          </div>
        </Card>
      ) : isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"
            />
          ))}
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
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  {n.image_url && (
                    <img
                      src={n.image_url}
                      alt={n.title}
                      className="w-full sm:w-32 h-32 sm:h-20 object-cover rounded-xl shrink-0 border border-slate-200 dark:border-slate-700"
                    />
                  )}
                  <div className="flex-1 min-w-0 flex flex-col gap-1 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoryBadge category={n.category} />
                      {n.is_featured && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 uppercase tracking-wide">
                          <Star className="w-3 h-3 fill-amber-500" /> Featured
                        </span>
                      )}
                    </div>

                    <p className="font-bold text-slate-900 dark:text-white text-lg mt-1">
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

          {/* Pagination Buttons */}
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              className="px-4 py-2 text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Page {page} of {Math.max(1, Math.ceil(totalNotices / 10))}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={notices.length < 10}
              className="px-4 py-2 text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
