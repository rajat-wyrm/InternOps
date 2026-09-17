import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiErrorMessage } from '../../lib/apiError';
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
  Sparkles,
  Wand2,
  CalendarClock,
  Link2,
  Star,
  Link as LinkIcon,
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
import { useRouteInitialLoading } from '../../components/loading/RouteInitialLoading';

const CATEGORIES = [
  'GENERAL',
  'REMINDER',
  'ALERT',
  'NEWS',
  'IMPORTANT',
  'ANNOUNCEMENT',
  'EVENT',
  'INTERNSHIP',
];

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
  IMPORTANT: {
    Icon: AlertTriangle,
    color: 'text-rose-500',
    label: 'Important',
  },
  ANNOUNCEMENT: {
    Icon: Megaphone,
    color: 'text-violet-500',
    label: 'Announcement',
  },
  EVENT: { Icon: CalendarClock, color: 'text-cyan-500', label: 'Event' },
  INTERNSHIP: {
    Icon: Sparkles,
    color: 'text-emerald-500',
    label: 'Internship',
  },
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

  const [suggestion, setSuggestion] = useState(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [suggestionError, setSuggestionError] = useState('');
  const [uploadError, setUploadError] = useState('');

  const suggestionSummary = useMemo(
    () =>
      [
        suggestion?.summary,
        suggestion?.deadline && suggestion.deadline !== 'Not specified'
          ? `Deadline: ${suggestion.deadline}`
          : null,
        suggestion?.eligibility && suggestion.eligibility !== 'Not specified'
          ? `Eligibility: ${suggestion.eligibility}`
          : null,
        suggestion?.action ? `Action: ${suggestion.action}` : null,
      ].filter(Boolean),
    [suggestion]
  );

  const handleSuggest = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      setSuggestionError('Add notice content before generating suggestions.');
      return;
    }

    setSuggestionError('');
    setIsSuggesting(true);

    try {
      const { data } = await api.post('/notices/ai-suggest', {
        content: trimmed,
      });
      setSuggestion(data);
      if (data?.title) setTitle(data.title);
      if (data?.category) setCategory(data.category);
      if (data?.improvedContent) setContent(data.improvedContent);
    } catch (error) {
      setSuggestionError(
        error?.response?.data?.error ||
          'AI suggestion failed. Please review and edit manually.'
      );
    } finally {
      setIsSuggesting(false);
    }
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    if (suggestion.title) setTitle(suggestion.title);
    if (suggestion.category) setCategory(suggestion.category);
    if (suggestion.improvedContent) setContent(suggestion.improvedContent);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <Input
            placeholder="Notice title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isPending}
            className="dark:!border-slate-700 dark:!bg-slate-800/70"
          />
        </div>

        <button
          type="button"
          onClick={handleSuggest}
          disabled={isPending || isSuggesting || !content.trim()}
          className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200"
        >
          {isSuggesting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Wand2 className="w-3.5 h-3.5" />
          )}
          AI Suggest
        </button>
      </div>

      <div className="flex items-center gap-4">
        {image_url && (
          <img
            src={image_url}
            alt="Notice Preview"
            className="h-16 w-32 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
          />
        )}
      </div>

      <textarea
        placeholder="Notice content…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        disabled={isPending}
        className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700/80 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 resize-none transition disabled:opacity-60 disabled:cursor-not-allowed"
      />

      {suggestionError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200">
          <AlertCircle className="w-3.5 h-3.5" />
          {suggestionError}
        </div>
      )}

      {suggestion && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900/60 dark:bg-indigo-950/20">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700 dark:text-indigo-200">
              <Sparkles className="w-3.5 h-3.5" /> AI Suggestion
            </div>
            <button
              type="button"
              onClick={applySuggestion}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 dark:text-indigo-200 dark:hover:text-indigo-100"
            >
              Apply all
            </button>
          </div>

          <div className="space-y-2 text-xs text-slate-700 dark:text-slate-200">
            {suggestionSummary.map((item) => (
              <div key={item} className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                <span>{item}</span>
              </div>
            ))}

            {suggestion.link && (
              <div className="flex items-start gap-2 break-all text-sky-700 dark:text-sky-300">
                <Link2 className="mt-0.5 h-3.5 w-3.5" />
                <span>{suggestion.link}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <Input
            placeholder="Action Button Text (e.g. Apply Now)"
            value={action_button_text}
            onChange={(e) => setActionButtonText(e.target.value)}
            disabled={isPending}
            className="h-[52px] min-w-0 rounded-2xl text-sm dark:!border-slate-700 dark:!bg-slate-800/70"
          />
        </div>
        <div className="relative min-w-0">
          <LinkIcon className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="url"
            placeholder="Action Button Link (https://...)"
            value={action_button_link}
            onChange={(e) => setActionButtonLink(e.target.value)}
            disabled={isPending}
            className="h-[52px] w-full min-w-0 rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-700/80 dark:text-slate-200 dark:placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="ml-1 mt-1 flex items-center gap-2">
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
          Mark as Featured <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
        </label>
      </div>

      <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="h-[52px] w-full sm:w-72">
          <CustomSelect
            value={category}
            onChange={setCategory}
            options={CATEGORY_OPTIONS}
            placeholder="Select category"
            disabled={isPending}
            className="h-[52px] w-full dark:!border-slate-700 dark:!bg-slate-800/70"
          />
        </div>

        <Btn
          disabled={
            isPending || isUploading || !title.trim() || !content.trim()
          }
          onClick={() => {
            const payload = {
              title: title.trim(),
              content: content.trim(),
              category,
              is_featured,
            };
            const imageUrl = image_url.trim();
            const actionButtonText = action_button_text.trim();
            const actionButtonLink = action_button_link.trim();
            if (imageUrl) payload.image_url = imageUrl;
            if (actionButtonText) payload.action_button_text = actionButtonText;
            if (actionButtonLink) payload.action_button_link = actionButtonLink;
            onSubmit(payload);
          }}
          className="h-[52px] min-w-[180px] rounded-2xl px-5"
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
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
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
    refetch,
  } = useQuery({
    queryKey: ['notices-admin', page],
    queryFn: () =>
      api
        .get(`/notices?page=${page}&limit=10`)
        .then((r) => r.data || { notices: [], count: 0 }),
  });

  useRouteInitialLoading(isLoading && !noticesData);

  const notices = Array.isArray(noticesData)
    ? noticesData
    : noticesData?.notices || [];
  const totalNotices = noticesData?.count || notices.length || 0;

  const createMut = useMutation({
    mutationFn: (body) => api.post('/notices', body),
    onSuccess: () => {
      setFormError('');
      setFormKey((k) => k + 1);
      inv();
    },
    onError: (err) =>
      setFormError(getApiErrorMessage(err, 'Failed to create notice')),
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
    <div className="mx-auto max-w-7xl">
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

      <div className="mb-7 flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-amber-100 text-amber-600 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          <Megaphone className="w-6 h-6" />
        </div>

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Notice Board
          </h1>

          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Manage announcements visible on the login page
          </p>
        </div>
      </div>

      <Card className="mb-6 border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-6">
        <h3 className="mb-4 flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-white">
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
              className={`group border border-slate-200 bg-white p-4 transition-all dark:border-slate-700 dark:bg-slate-900 md:p-5 ${
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
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
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

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {n.title}
                      </p>

                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                        {n.content}
                      </p>
                    </div>
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
          <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
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