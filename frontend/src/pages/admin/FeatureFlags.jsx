import { useState, useCallback } from 'react';
import {
  ToggleLeft,
  ToggleRight,
  Zap,
  ZapOff,
  RefreshCw,
  ShieldCheck,
  Users,
  BarChart2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/axios';
import useFeatureFlagsStore from '../../store/featureFlags';

// ─── Role badge colours ───────────────────────────────────────────────────────
const ROLE_COLORS = {
  ADMIN: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  SENIOR_TL:
    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  TL: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  CAPTAIN:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  INTERN: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const ALL_ROLES = ['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN', 'INTERN'];

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({ flag, onClose, onSave, saving }) {
  const [enabled, setEnabled] = useState(flag.enabled);
  const [rolloutPct, setRolloutPct] = useState(flag.rollout_pct ?? 100);
  const [allowedRoles, setAllowedRoles] = useState(flag.allowed_roles ?? []);
  const [description, setDescription] = useState(flag.description ?? '');

  const toggleRole = (role) =>
    setAllowedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );

  const handleSave = () =>
    onSave({
      enabled,
      rolloutPct: Number(rolloutPct),
      allowedRoles: allowedRoles.length > 0 ? allowedRoles : null,
      description,
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-fade-in-up">
        {/* Header gradient stripe */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

        <div className="p-6 sm:p-8">
          {/* Title */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-indigo-600 dark:text-indigo-400 font-extrabold mb-1">
                Edit Flag
              </p>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight font-mono">
                {flag.key}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {/* Enabled toggle */}
          <div className="mb-5">
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
              Status
            </label>
            <button
              onClick={() => setEnabled((v) => !v)}
              className={`flex items-center gap-3 px-5 py-3 rounded-2xl font-bold text-sm transition-all border ${
                enabled
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              {enabled ? (
                <ToggleRight className="w-5 h-5" />
              ) : (
                <ToggleLeft className="w-5 h-5" />
              )}
              {enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Rollout % */}
          <div className="mb-5">
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
              Rollout Percentage — {rolloutPct}%
            </label>
            <div className="relative">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={rolloutPct}
                onChange={(e) => setRolloutPct(e.target.value)}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Role allowlist */}
          <div className="mb-5">
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
              Allowed Roles{' '}
              <span className="font-normal normal-case text-slate-400">
                (empty = all roles)
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((role) => (
                <button
                  key={role}
                  onClick={() => toggleRole(role)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    allowedRoles.includes(role)
                      ? `${ROLE_COLORS[role]} border-current`
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 opacity-50'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="mb-7">
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Flag Card ────────────────────────────────────────────────────────────────
function FlagCard({ flag, onEdit, onKillSwitch, onEnable, toggling }) {
  const [expanded, setExpanded] = useState(false);

  const roles = flag.allowed_roles ?? [];
  const isOn = flag.enabled;

  return (
    <div
      className={`group relative rounded-3xl border transition-all duration-200 overflow-hidden ${
        isOn
          ? 'border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-slate-900 shadow-[0_8px_24px_rgba(16,185,129,0.06)]'
          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 shadow-none'
      }`}
    >
      {/* Left accent bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-3xl transition-colors ${
          isOn
            ? 'bg-gradient-to-b from-emerald-400 to-teal-500'
            : 'bg-slate-300 dark:bg-slate-600'
        }`}
      />

      <div className="pl-5 pr-5 pt-5 pb-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-sm font-extrabold text-slate-800 dark:text-white tracking-tight">
                {flag.key}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  isOn
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {isOn ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                {isOn ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
              {flag.description || '—'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isOn ? (
              <button
                id={`kill-${flag.key}`}
                onClick={() => onKillSwitch(flag.key)}
                disabled={toggling === flag.key}
                title="Kill-switch (disable immediately)"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition disabled:opacity-50"
              >
                {toggling === flag.key ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ZapOff className="w-3.5 h-3.5" />
                )}
                Kill
              </button>
            ) : (
              <button
                id={`enable-${flag.key}`}
                onClick={() => onEnable(flag.key)}
                disabled={toggling === flag.key}
                title="Enable flag"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition disabled:opacity-50"
              >
                {toggling === flag.key ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                Enable
              </button>
            )}

            <button
              id={`edit-${flag.key}`}
              onClick={() => onEdit(flag)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition"
            >
              Edit
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <BarChart2 className="w-3 h-3" />
            {flag.rollout_pct ?? 100}% rollout
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {roles.length > 0 ? `${roles.length} role(s)` : 'All roles'}
          </span>
          {flag.updated_at && (
            <span className="ml-auto">
              Updated {new Date(flag.updated_at).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            {roles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {roles.map((r) => (
                  <span
                    key={r}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${ROLE_COLORS[r] || 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">
              Default: {flag.defaultEnabled ? 'enabled' : 'disabled'}
            </p>
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
        >
          {expanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
          {expanded ? 'Hide' : 'Details'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FeatureFlags() {
  const qc = useQueryClient();
  const refreshStore = useFeatureFlagsStore((s) => s.refresh);
  const [editTarget, setEditTarget] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Fetch all definitions (admin view)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['feature-flags-definitions'],
    queryFn: () =>
      api.get('/feature-flags/definitions').then((r) => r.data.flags),
    staleTime: 10_000,
  });

  const flags = data ?? [];
  const enabledCount = flags.filter((f) => f.enabled).length;

  // ── Mutations
  const updateMutation = useMutation({
    mutationFn: ({ key, body }) => api.put(`/feature-flags/${key}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feature-flags-definitions'] });
      refreshStore();
      setEditTarget(null);
      showToast('Flag updated successfully.');
    },
    onError: () => showToast('Update failed. Please try again.', 'error'),
  });

  const disableMutation = useMutation({
    mutationFn: (key) => api.post(`/feature-flags/${key}/disable`),
    onSuccess: (_, key) => {
      qc.invalidateQueries({ queryKey: ['feature-flags-definitions'] });
      refreshStore();
      setToggling(null);
      showToast(`"${key}" disabled (kill-switch applied).`);
    },
    onError: () => {
      setToggling(null);
      showToast('Kill-switch failed. Please try again.', 'error');
    },
  });

  const enableMutation = useMutation({
    mutationFn: (key) => api.post(`/feature-flags/${key}/enable`),
    onSuccess: (_, key) => {
      qc.invalidateQueries({ queryKey: ['feature-flags-definitions'] });
      refreshStore();
      setToggling(null);
      showToast(`"${key}" enabled.`);
    },
    onError: () => {
      setToggling(null);
      showToast('Enable failed. Please try again.', 'error');
    },
  });

  const handleKillSwitch = (key) => {
    setToggling(key);
    disableMutation.mutate(key);
  };

  const handleEnable = (key) => {
    setToggling(key);
    enableMutation.mutate(key);
  };

  const handleSave = (updates) => {
    updateMutation.mutate({ key: editTarget.key, body: updates });
  };

  return (
    <div className="animate-fade-in-up">
      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-bold transition-all duration-300 ${
            toast.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              : 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          )}
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs md:text-sm uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300 font-extrabold mb-1">
              Deployment Control
            </p>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Feature Flags
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Toggle features without redeploy — kill-switch any flag instantly
            </p>
          </div>
        </div>

        <button
          id="refresh-flags"
          onClick={() => {
            refetch();
            refreshStore();
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          {
            label: 'Total Flags',
            value: flags.length,
            icon: ShieldCheck,
            color: 'indigo',
          },
          {
            label: 'Enabled',
            value: enabledCount,
            icon: ToggleRight,
            color: 'emerald',
          },
          {
            label: 'Disabled',
            value: flags.length - enabledCount,
            icon: ToggleLeft,
            color: 'rose',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className={`rounded-3xl border p-5 bg-white dark:bg-slate-900 border-${color}-100 dark:border-${color}-900/40 shadow-[0_4px_16px_rgba(0,0,0,0.04)]`}
          >
            <div
              className={`w-10 h-10 rounded-2xl bg-${color}-50 dark:bg-${color}-900/20 text-${color}-600 dark:text-${color}-400 flex items-center justify-center mb-3`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {value}
            </div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Flags grid ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Loading feature flags…
          </p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertTriangle className="w-8 h-8 text-rose-400" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Failed to load flags.
          </p>
          <button
            onClick={() => refetch()}
            className="text-indigo-600 dark:text-indigo-400 text-sm font-bold underline"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {flags.map((flag) => (
            <FlagCard
              key={flag.key}
              flag={flag}
              onEdit={setEditTarget}
              onKillSwitch={handleKillSwitch}
              onEnable={handleEnable}
              toggling={toggling}
            />
          ))}
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editTarget && (
        <EditModal
          flag={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={handleSave}
          saving={updateMutation.isPending}
        />
      )}
    </div>
  );
}
