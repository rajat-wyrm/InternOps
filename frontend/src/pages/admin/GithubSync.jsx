import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GitPullRequest as Github,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Copy,
  Settings,
  Activity,
  List,
  BarChart3,
  Shield,
  Globe,
  Terminal,
  ChevronDown,
  ChevronUp,
  Trash2,
  ExternalLink,
  Server,
  Zap,
  Wifi,
  WifiOff,
  BugPlay,
  Gauge,
  HardDrive,
  RotateCcw,
  TrendingUp,
  PieChart as PieChartIcon,
  Calendar,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import api from '../../lib/axios';
import { Card, Btn, Badge, Spinner } from '../../components/ui';

const WEBHOOK_URL = `${window.location.origin}/api/v1/github/webhook`;

function CopyableField({ label, value, mono }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <code
          className={`flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm ${mono ? 'font-mono' : ''} text-gray-800 dark:text-gray-200 truncate`}
        >
          {value}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(value);
          }}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-gray-400"
        >
          {copied ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function StatusCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center`}
          style={{
            backgroundColor: `var(--${color}-50, #f0fdf4)`,
            color: `var(--${color}-600, #16a34a)`,
          }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-xl font-bold text-gray-800 dark:text-white">
            {value}
          </p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function LogCard({ log }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor =
    log.status === 'success'
      ? 'green'
      : log.status === 'failed'
        ? 'red'
        : log.status === 'skipped'
          ? 'yellow'
          : 'gray';
  const StatusIcon =
    log.status === 'success'
      ? CheckCircle
      : log.status === 'failed'
        ? XCircle
        : AlertTriangle;
  return (
    <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
      <div
        className="flex items-start justify-between gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <StatusIcon className={`w-4 h-4 shrink-0 text-${statusColor}-500`} />
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate">
              {log.event_type}.{log.action}
            </p>
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {log.message}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {log.github_issue_number && (
            <Badge color="purple">#{log.github_issue_number}</Badge>
          )}
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {new Date(log.created_at).toLocaleString()}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
          {log.github_repo && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Repo:</span> {log.github_repo}
            </p>
          )}
          {log.task_id && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Task ID:</span>{' '}
              <code className="text-indigo-600">{log.task_id}</code>
            </p>
          )}
          {log.triggered_by && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Triggered by:</span>{' '}
              {log.triggered_by}
            </p>
          )}
          {log.details && Object.keys(log.details).length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Details:</p>
              <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded-lg overflow-x-auto text-gray-600">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SetupGuide() {
  const [showGuide, setShowGuide] = useState(true);
  if (!showGuide) {
    return (
      <button
        onClick={() => setShowGuide(true)}
        className="flex items-center gap-2 text-sm text-indigo-600 hover:underline mb-4"
      >
        <Terminal className="w-4 h-4" /> Show setup guide
      </button>
    );
  }
  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border border-indigo-100 dark:border-indigo-900/60 mb-6">
      <div className="flex items-start justify-between mb-4">
        <h3 className="font-bold text-indigo-800 dark:text-indigo-200 text-lg flex items-center gap-2">
          <Terminal className="w-5 h-5" /> GitHub Webhook Setup Guide
        </h3>
        <button
          onClick={() => setShowGuide(false)}
          className="text-indigo-400 hover:text-indigo-600 text-sm"
        >
          Hide
        </button>
      </div>
      <ol className="space-y-3 text-sm text-indigo-900 dark:text-indigo-200">
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
            1
          </span>
          <div>
            <p className="font-semibold">
              Go to your GitHub repo → Settings → Webhooks
            </p>
            <p className="text-indigo-700 dark:text-indigo-300 text-xs mt-0.5">
              https://github.com/your-repo/settings/hooks
            </p>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
            2
          </span>
          <div>
            <p className="font-semibold">
              Click "Add webhook" → Set Payload URL:
            </p>
            <code className="block mt-1 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg text-xs font-mono border border-indigo-200">
              {WEBHOOK_URL}
            </code>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
            3
          </span>
          <div>
            <p className="font-semibold">
              Content type:{' '}
              <code className="font-mono bg-white dark:bg-gray-800 px-2 py-0.5 rounded text-xs">
                application/json
              </code>
            </p>
            <p className="text-indigo-700 dark:text-indigo-300 text-xs mt-0.5">
              Secret: use{' '}
              <code className="font-mono bg-white dark:bg-gray-800 px-1 rounded">
                GITHUB_WEBHOOK_SECRET
              </code>
            </p>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
            4
          </span>
          <div>
            <p className="font-semibold">
              Events: "Let me select individual" → check <strong>Issues</strong>
            </p>
            <p className="text-indigo-700 dark:text-indigo-300 text-xs mt-0.5">
              Active: ✅ — Click "Add webhook"
            </p>
          </div>
        </li>
      </ol>
    </div>
  );
}

export default function GithubSync() {
  const queryClient = useQueryClient();
  const [showGuide, setShowGuide] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    repo: '',
    webhookSecret: '',
    githubToken: '',
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [cleanupDays, setCleanupDays] = useState(90);

  const {
    data: status,
    isLoading: statusLoading,
    isError: statusError,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['github-sync-status'],
    queryFn: () => api.get('/github/status').then((r) => r.data),
  });

  const { data: orchestratorStatus } = useQuery({
    queryKey: ['github-orchestrator'],
    queryFn: () => api.get('/github/orchestrator').then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: rateLimit } = useQuery({
    queryKey: ['github-rate-limit'],
    queryFn: () => api.get('/github/rate-limit').then((r) => r.data),
    refetchInterval: 60000,
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['github-sync-logs'],
    queryFn: () => api.get('/github/logs?limit=50').then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: counts } = useQuery({
    queryKey: ['github-sync-counts'],
    queryFn: () => api.get('/github/stats/count').then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: issues, isLoading: issuesLoading } = useQuery({
    queryKey: ['github-synced-issues'],
    queryFn: () => api.get('/github/issues?limit=20').then((r) => r.data),
    enabled: activeTab === 'issues',
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['github-sync-analytics', analyticsDays],
    queryFn: () =>
      api
        .get(`/github/stats/analytics?days=${analyticsDays}`)
        .then((r) => r.data),
    enabled: activeTab === 'analytics',
    refetchInterval: 60000,
  });

  const { data: settingsData } = useQuery({
    queryKey: ['github-sync-settings'],
    queryFn: () => api.get('/github/settings').then((r) => r.data),
  });

  const syncMutation = useMutation({
    mutationFn: (repo) => api.post('/github/sync', { repo }),
    onSuccess: (res) => {
      setSyncResult({ type: 'success', message: res.data.message });
      setTimeout(() => {
        refetchStatus();
        setSyncResult(null);
      }, 2000);
    },
    onError: (err) => {
      setSyncResult({
        type: 'error',
        message: err.response?.data?.error || 'Sync failed',
      });
      setTimeout(() => setSyncResult(null), 5000);
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => api.post('/github/retry'),
    onSuccess: () =>
      setSyncResult({ type: 'success', message: 'Retry triggered' }),
    onError: (err) =>
      setSyncResult({
        type: 'error',
        message: err.response?.data?.error || 'Retry failed',
      }),
  });

  const registerWebhookMutation = useMutation({
    mutationFn: () => api.post('/github/webhook/register'),
    onSuccess: (res) => {
      setSyncResult({
        type: 'success',
        message: res.data.alreadyExists
          ? 'Webhook already registered'
          : 'Webhook registered!',
      });
      setTimeout(() => setSyncResult(null), 3000);
    },
    onError: (err) => {
      setSyncResult({
        type: 'error',
        message: err.response?.data?.error || 'Registration failed',
      });
      setTimeout(() => setSyncResult(null), 5000);
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: (days) =>
      api.delete('/github/logs/cleanup', { params: { days } }),
    onSuccess: (res) => {
      setSyncResult({
        type: 'success',
        message: `Cleaned ${res.data.deletedCount} old logs`,
      });
      queryClient.invalidateQueries({ queryKey: ['github-sync-logs'] });
      setTimeout(() => setSyncResult(null), 3000);
    },
    onError: (err) => {
      setSyncResult({
        type: 'error',
        message: err.response?.data?.error || 'Cleanup failed',
      });
      setTimeout(() => setSyncResult(null), 5000);
    },
  });

  const settingsMutation = useMutation({
    mutationFn: (data) => api.put('/github/settings', data),
    onSuccess: () => {
      setSettingsOpen(false);
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ['github-sync-settings'] });
    },
    onError: (err) =>
      alert(err.response?.data?.error || 'Failed to update settings'),
  });

  const handleSaveSettings = (e) => {
    e.preventDefault();
    const data = {};
    if (settingsForm.repo) data.repo = settingsForm.repo;
    if (settingsForm.webhookSecret)
      data.webhookSecret = settingsForm.webhookSecret;
    if (settingsForm.githubToken) data.githubToken = settingsForm.githubToken;
    settingsMutation.mutate(data);
  };

  const openSettings = () => {
    setSettingsForm({
      repo: settingsData?.repo || '',
      webhookSecret: '',
      githubToken: '',
    });
    setSettingsOpen(true);
  };

  const getStatusBadge = () => {
    if (statusLoading) return <Badge color="gray">Checking...</Badge>;
    if (statusError) return <Badge color="red">Connection Error</Badge>;
    if (status?.configured) return <Badge color="green">Connected</Badge>;
    return <Badge color="yellow">Not Configured</Badge>;
  };

  const [analyticsDays, setAnalyticsDays] = useState(30);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'logs', label: 'Activity Log', icon: List },
    { id: 'issues', label: 'Synced Issues', icon: Github },
    { id: 'health', label: 'Orchestrator', icon: Server },
  ];

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gray-900 text-white flex items-center justify-center shadow-sm">
            <Github className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">
                GitHub Issue Sync
              </h1>
              {getStatusBadge()}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Auto-create tasks from GitHub issues — webhook + periodic sync +
              retry
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Btn variant="secondary" onClick={() => setShowGuide(!showGuide)}>
            <Terminal className="w-4 h-4" />{' '}
            {showGuide ? 'Hide Guide' : 'Setup Guide'}
          </Btn>
          <Btn variant="secondary" onClick={openSettings}>
            <Settings className="w-4 h-4" /> Settings
          </Btn>
          <Btn
            onClick={() => syncMutation.mutate(status?.repo || '')}
            disabled={syncMutation.isPending}
          >
            <RefreshCw
              className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`}
            />
            {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
          </Btn>
        </div>
      </div>

      {syncResult && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 ${syncResult.type === 'success' ? 'bg-green-50 dark:bg-green-950/30 border-green-200 text-green-800' : 'bg-red-50 dark:bg-red-950/30 border-red-200 text-red-800'}`}
        >
          {syncResult.type === 'success' ? (
            <CheckCircle className="w-5 h-5 shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 shrink-0" />
          )}
          <span className="font-medium text-sm">{syncResult.message}</span>
        </div>
      )}

      {showGuide && <SetupGuide />}

      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="w-full max-w-lg mx-4 p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                Sync Settings
              </h2>
              <button
                onClick={() => setSettingsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Repository
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                  placeholder="owner/repo"
                  value={settingsForm.repo}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, repo: e.target.value })
                  }
                />
                <p className="text-xs text-gray-400 mt-1">
                  e.g. rajat-wyrm/InternOps
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Webhook Secret
                </label>
                <input
                  type="password"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                  placeholder="Leave empty to keep current"
                  value={settingsForm.webhookSecret}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      webhookSecret: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  GitHub Token
                </label>
                <input
                  type="password"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                  placeholder="For initial sync of all issues"
                  value={settingsForm.githubToken}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      githubToken: e.target.value,
                    })
                  }
                />
                <p className="text-xs text-gray-400 mt-1">
                  Personal Access Token with issues:read permission
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <Btn type="submit" disabled={settingsMutation.isPending}>
                  {settingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl bg-gray-100 dark:bg-gray-800 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${activeTab === tab.id ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: Overview */}
      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatusCard
              icon={Github}
              label="Repository"
              value={status?.repo || 'Not set'}
              color="gray"
              sub={status?.webhookSecretConfigured ? 'Secret ✅' : 'Secret ❌'}
            />
            <StatusCard
              icon={CheckCircle}
              label="Issues Synced"
              value={counts?.totalGithubTasks ?? status?.totalSynced ?? 0}
              color="indigo"
              sub={`${counts?.totalAllTasks ?? 0} total tasks (${counts?.githubPercentage ?? 0}%)`}
            />
            <StatusCard
              icon={Activity}
              label="Events"
              value={`${status?.successfulEvents ?? 0} OK`}
              color="green"
              sub={`${status?.failedEvents ?? 0} failed · ${status?.skippedEvents ?? 0} skipped`}
            />
            <StatusCard
              icon={Clock}
              label="Last Sync"
              value={
                status?.lastSyncAt
                  ? new Date(status.lastSyncAt).toLocaleDateString()
                  : 'Never'
              }
              color="purple"
              sub={
                status?.lastSyncAt
                  ? new Date(status.lastSyncAt).toLocaleTimeString()
                  : ''
              }
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Btn
              variant="secondary"
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
            >
              <RotateCcw
                className={`w-4 h-4 ${retryMutation.isPending ? 'animate-spin' : ''}`}
              />{' '}
              Retry Failed
            </Btn>
            <Btn
              variant="secondary"
              onClick={() => registerWebhookMutation.mutate()}
              disabled={registerWebhookMutation.isPending}
            >
              <Zap className="w-4 h-4" /> Auto-Register Webhook
            </Btn>
            <Btn
              variant="secondary"
              onClick={() => cleanupMutation.mutate(cleanupDays)}
              disabled={cleanupMutation.isPending}
            >
              <Trash2 className="w-4 h-4" /> Clean Logs ({cleanupDays}d)
            </Btn>
          </div>

          {counts && counts.totalGithubTasks > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="p-5">
                <h3 className="font-semibold text-gray-700 text-sm mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4" /> By Repository
                </h3>
                <div className="space-y-2">
                  {counts.byRepo.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-600">
                        {r.github_repo || 'Unknown'}
                      </span>
                      <Badge color="indigo">{r.count}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-5">
                <h3 className="font-semibold text-gray-700 text-sm mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> By Platform
                </h3>
                <div className="space-y-2">
                  {counts.byPlatform.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-600">
                        {p.target_platform || 'Unspecified'}
                      </span>
                      <Badge color="purple">{p.count}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          <Card className="p-5 space-y-3">
            <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
              <Shield className="w-4 h-4" /> Webhook Configuration
            </h3>
            <CopyableField label="Webhook URL" value={WEBHOOK_URL} mono />
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span
                className={`inline-block w-2 h-2 rounded-full ${status?.webhookSecretConfigured ? 'bg-green-500' : 'bg-red-500'}`}
              />
              Secret:{' '}
              {status?.webhookSecretConfigured
                ? 'Configured'
                : 'Not configured'}
              <span className="mx-1">·</span>
              <span
                className={`inline-block w-2 h-2 rounded-full ${status?.githubTokenConfigured ? 'bg-green-500' : 'bg-yellow-500'}`}
              />
              Token: {status?.githubTokenConfigured ? 'Configured' : 'Optional'}
            </div>
          </Card>
        </>
      )}

      {/* TAB: Activity Log */}
      {activeTab === 'logs' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <List className="w-5 h-5" /> Sync Activity Log
            </h2>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="w-16 px-2 py-1 rounded-lg border border-gray-300 text-xs"
                value={cleanupDays}
                onChange={(e) => setCleanupDays(e.target.value)}
                min={1}
                max={365}
              />
              <Btn
                variant="secondary"
                size="sm"
                onClick={() => cleanupMutation.mutate(cleanupDays)}
                disabled={cleanupMutation.isPending}
              >
                <Trash2 className="w-3 h-3" /> Clean
              </Btn>
              <span className="text-xs text-gray-400">Auto-refresh 15s</span>
            </div>
          </div>
          {logsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner label="Loading logs..." />
            </div>
          ) : !logs?.length ? (
            <Card className="p-8 text-center">
              <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No sync events yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Webhook events appear here once GitHub sends them
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <LogCard key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: Synced Issues */}
      {activeTab === 'issues' && (
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Github className="w-5 h-5" /> Synced Issues
          </h2>
          {issuesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner label="Loading..." />
            </div>
          ) : !issues?.tasks?.length ? (
            <Card className="p-8 text-center">
              <p className="text-gray-500">No issues synced yet</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {issues.tasks.map((task) => (
                <Card
                  key={task.id}
                  className="p-4 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge color="purple">#{task.github_issue_number}</Badge>
                      <p className="font-semibold text-sm text-gray-800 truncate">
                        {task.title}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {task.github_repo} ·{' '}
                      {new Date(task.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {task.github_issue_url && (
                      <a
                        href={task.github_issue_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    {task.last_synced_at && (
                      <span className="text-xs text-gray-400">
                        {new Date(task.last_synced_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: Analytics */}
      {activeTab === 'analytics' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" /> Sync Analytics
            </h2>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <select
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700"
                value={analyticsDays}
                onChange={(e) => setAnalyticsDays(Number(e.target.value))}
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <span className="text-xs text-gray-400">Auto-refresh 60s</span>
            </div>
          </div>

          {analyticsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner label="Loading analytics..." />
            </div>
          ) : !analytics ? (
            <Card className="p-8 text-center">
              <p className="text-gray-500">No analytics data available</p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatusCard
                  icon={BarChart3}
                  label="Total Events ({analyticsDays}d)"
                  value={analytics.syncRate?.total ?? 0}
                  color="indigo"
                />
                <StatusCard
                  icon={CheckCircle}
                  label="Successful"
                  value={analytics.syncRate?.successful ?? 0}
                  color="green"
                  sub={`${analytics.syncRate?.success_rate ?? 0}% rate`}
                />
                <StatusCard
                  icon={TrendingUp}
                  label="Repos Active"
                  value={analytics.topRepos?.length ?? 0}
                  color="purple"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Card className="p-5">
                  <h3 className="font-semibold text-gray-700 text-sm mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Daily Sync Events
                  </h3>
                  {analytics.dailyCounts?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart
                        data={analytics.dailyCounts.map((d) => ({
                          ...d,
                          date: new Date(d.date).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                          }),
                        }))}
                      >
                        <defs>
                          <linearGradient
                            id="colorCount"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#6366f1"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#6366f1"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          stroke="#9ca3af"
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11 }}
                          stroke="#9ca3af"
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: '1px solid #e5e7eb',
                            fontSize: 13,
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="#6366f1"
                          fill="url(#colorCount)"
                          strokeWidth={2}
                          name="Events"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                      No daily data yet
                    </div>
                  )}
                </Card>

                <Card className="p-5">
                  <h3 className="font-semibold text-gray-700 text-sm mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> Top Repositories
                  </h3>
                  {analytics.topRepos?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={analytics.topRepos.map((r) => ({
                          ...r,
                          repo: (r.github_repo || 'Unknown').split('/').pop(),
                        }))}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11 }}
                          stroke="#9ca3af"
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="repo"
                          tick={{ fontSize: 11 }}
                          stroke="#9ca3af"
                          width={120}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: '1px solid #e5e7eb',
                            fontSize: 13,
                          }}
                        />
                        <Bar
                          dataKey="count"
                          fill="#8884d8"
                          radius={[0, 6, 6, 0]}
                          name="Issues"
                        >
                          {analytics.topRepos.map((_, i) => (
                            <Cell
                              key={i}
                              fill={
                                [
                                  '#6366f1',
                                  '#8b5cf6',
                                  '#a855f7',
                                  '#d946ef',
                                  '#ec4899',
                                  '#f43f5e',
                                  '#f97316',
                                  '#eab308',
                                  '#22c55e',
                                  '#06b6d4',
                                ][i % 10]
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                      No repo data yet
                    </div>
                  )}
                </Card>

                <Card className="p-5">
                  <h3 className="font-semibold text-gray-700 text-sm mb-4 flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4" /> Event Type Distribution
                  </h3>
                  {analytics.eventDistribution?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={analytics.eventDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="count"
                          nameKey="event_type"
                          label={({ event_type, count }) =>
                            `${event_type}: ${count}`
                          }
                        >
                          {analytics.eventDistribution.map((_, i) => (
                            <Cell
                              key={i}
                              fill={
                                [
                                  '#6366f1',
                                  '#8b5cf6',
                                  '#a855f7',
                                  '#d946ef',
                                  '#ec4899',
                                  '#f43f5e',
                                ][i % 6]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: '1px solid #e5e7eb',
                            fontSize: 13,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                      No event data yet
                    </div>
                  )}
                </Card>

                <Card className="p-5">
                  <h3 className="font-semibold text-gray-700 text-sm mb-4 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Status Distribution
                  </h3>
                  {analytics.statusDistribution?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={analytics.statusDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="count"
                          nameKey="status"
                          label={({ status, count }) => `${status}: ${count}`}
                        >
                          {analytics.statusDistribution.map((_, i) => (
                            <Cell
                              key={i}
                              fill={
                                ['#22c55e', '#ef4444', '#eab308', '#6b7280'][
                                  i % 4
                                ]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: '1px solid #e5e7eb',
                            fontSize: 13,
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                      No status data yet
                    </div>
                  )}
                </Card>
              </div>

              <Card className="p-5">
                <h3 className="font-semibold text-gray-700 text-sm mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Raw Analytics Data
                </h3>
                <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto text-gray-600 max-h-48">
                  {JSON.stringify(analytics, null, 2)}
                </pre>
              </Card>
            </>
          )}
        </div>
      )}

      {/* TAB: Orchestrator Health */}
      {activeTab === 'health' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Server className="w-5 h-5" /> Orchestrator Status
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatusCard
              icon={Server}
              label="Feature Flag"
              value={orchestratorStatus?.enabled ? 'Enabled' : 'Disabled'}
              color={orchestratorStatus?.enabled ? 'green' : 'red'}
            />
            <StatusCard
              icon={HardDrive}
              label="Pending Retries"
              value={orchestratorStatus?.pendingRetries ?? 0}
              color="purple"
              sub={orchestratorStatus?.isRetrying ? 'Retrying...' : 'Idle'}
            />
            <StatusCard
              icon={Wifi}
              label="Periodic Sync"
              value={
                orchestratorStatus?.periodicSyncIntervalMs
                  ? `${orchestratorStatus.periodicSyncIntervalMs / 60000}min`
                  : 'N/A'
              }
              color="indigo"
              sub={orchestratorStatus?.isSyncing ? 'Syncing...' : 'Idle'}
            />
          </div>

          {rateLimit && (
            <Card className="p-5">
              <h3 className="font-semibold text-gray-700 text-sm mb-3 flex items-center gap-2">
                <Gauge className="w-4 h-4" /> GitHub API Rate Limit
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-indigo-500 h-3 rounded-full transition-all"
                      style={{
                        width: `${(rateLimit.remaining / Math.max(rateLimit.limit, 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="text-sm font-bold text-gray-700 whitespace-nowrap">
                  {rateLimit.remaining} / {rateLimit.limit}
                </div>
              </div>
              {rateLimit.reset && (
                <p className="text-xs text-gray-400 mt-2">
                  Resets at: {new Date(rateLimit.reset).toLocaleString()}
                </p>
              )}
              {rateLimit.error && (
                <p className="text-xs text-red-400 mt-2">
                  Rate limit check failed: {rateLimit.error}
                </p>
              )}
            </Card>
          )}

          <Card className="p-5">
            <h3 className="font-semibold text-gray-700 text-sm mb-3 flex items-center gap-2">
              <BugPlay className="w-4 h-4" /> Orchestrator Details
            </h3>
            <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto text-gray-600">
              {JSON.stringify(orchestratorStatus, null, 2)}
            </pre>
          </Card>

          <div className="flex gap-2">
            <Btn
              variant="secondary"
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
            >
              <RotateCcw
                className={`w-4 h-4 ${retryMutation.isPending ? 'animate-spin' : ''}`}
              />{' '}
              Trigger Retry
            </Btn>
            <Btn
              variant="secondary"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: ['github-orchestrator'],
                })
              }
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
