import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BriefcaseBusiness, RefreshCw, Search } from 'lucide-react';
import api from '../lib/axios';
import useAuthStore from '../store/auth';
import { ApiErrorState, PageHeader } from '../components/ui';
import CustomSelect from '../components/CustomSelect';
import { useRouteInitialLoading } from '../components/loading/RouteInitialLoading';
import HROverviewCards from '../components/hr/HROverviewCards';
import HRLifecyclePanels from '../components/hr/HRLifecyclePanels';
import HRDirectory from '../components/hr/HRDirectory';
import { HR_ISSUE_OPTIONS, HR_STATUS_OPTIONS } from '../utils/hrInsights';
export default function HR() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [issue, setIssue] = useState('');
  const [refreshMessage, setRefreshMessage] = useState('');
  const refreshMessageTimer = useRef(null);
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (status) params.set('status', status);
  if (issue) params.set('issue', issue);
  const q = useQuery({
    queryKey: ['hrDashboard', search, status, issue],
    queryFn: () => api.get(`/hr/dashboard?${params}`).then((r) => r.data),
    enabled: hydrated && !!accessToken,
    placeholderData: (p) => p,
  });
  useEffect(() => {
    return () => {
      if (refreshMessageTimer.current)
        window.clearTimeout(refreshMessageTimer.current);
    };
  }, []);
  const handleRefresh = async () => {
    if (q.isFetching) return;
    setRefreshMessage('');
    const result = await q.refetch();
    if (result.error) {
      setRefreshMessage('Refresh failed. The previous HR data is still shown.');
      return;
    }
    setRefreshMessage('HR data refreshed.');
    if (refreshMessageTimer.current)
      window.clearTimeout(refreshMessageTimer.current);
    refreshMessageTimer.current = window.setTimeout(
      () => setRefreshMessage(''),
      2500
    );
  };
  useRouteInitialLoading(!hydrated || !accessToken || q.isLoading);
  if (q.isError)
    return (
      <ApiErrorState
        error={q.error}
        title="Failed to load HR workspace"
        fallback="Unable to load workforce information."
        onRetry={q.refetch}
      />
    );
  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Workspace"
        subtitle="Workforce lifecycle, readiness, and records in one place"
        icon={<BriefcaseBusiness className="h-6 w-6" />}
        actions={
          <button
            type="button"
            onClick={handleRefresh}
            disabled={q.isFetching}
            aria-busy={q.isFetching}
            className="inline-flex min-w-36 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            <RefreshCw
              className={`h-4 w-4 ${q.isFetching ? 'animate-spin' : ''}`}
            />
            {q.isFetching ? 'Refreshing...' : 'Refresh'}
          </button>
        }
      />
      {refreshMessage && (
        <div
          role={
            refreshMessage.startsWith('Refresh failed') ? 'alert' : 'status'
          }
          className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
            refreshMessage.startsWith('Refresh failed')
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
          }`}
        >
          {refreshMessage}
        </div>
      )}
      <HROverviewCards summary={q.data?.summary} />
      <HRLifecyclePanels
        departments={q.data?.departments}
        roles={q.data?.roles}
        milestones={q.data?.milestones}
      />
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or intern code"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <CustomSelect
          value={status}
          onChange={setStatus}
          options={HR_STATUS_OPTIONS.map(([value, label]) => ({
            value,
            label,
          }))}
          className="w-full sm:w-48"
        />
        <CustomSelect
          value={issue}
          onChange={setIssue}
          options={HR_ISSUE_OPTIONS.map(([value, label]) => ({ value, label }))}
          className="w-full sm:w-56"
        />
      </div>
      <HRDirectory
        members={q.data?.directory}
        resetKey={`${search}|${status}|${issue}`}
      />
    </div>
  );
}
