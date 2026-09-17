import { useQuery } from '@tanstack/react-query';
import { GitPullRequest } from 'lucide-react';
import api from '../../lib/axios';
import { Card, Badge, Spinner } from '../ui';

export default function GithubSyncWidget() {
  const { data: status, isLoading } = useQuery({
    queryKey: ['github-sync-status'],
    queryFn: () => api.get('/github/status').then((r) => r.data),
    refetchInterval: 60000,
  });

  const { data: counts } = useQuery({
    queryKey: ['github-sync-counts'],
    queryFn: () => api.get('/github/stats/count').then((r) => r.data),
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card className="p-5">
        <div className="flex items-center justify-center h-20">
          <Spinner label="Loading..." />
        </div>
      </Card>
    );
  }

  if (!status?.configured) {
    return (
      <a href="/github-sync" className="block">
        <Card className="p-5 hover:shadow-md transition cursor-pointer group">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 flex items-center justify-center group-hover:bg-gray-900 group-hover:text-white transition">
              <GitPullRequest className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-white text-sm">
                GitHub Sync
              </h3>
              <p className="text-xs text-gray-400">Not configured</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Configure in Admin → GitHub Sync
          </p>
        </Card>
      </a>
    );
  }

  return (
    <a href="/github-sync" className="block">
      <Card className="p-5 hover:shadow-md transition cursor-pointer group">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-900 text-white dark:bg-gray-700 flex items-center justify-center group-hover:bg-indigo-600 transition">
              <GitPullRequest className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-white text-sm">
                GitHub Sync
              </h3>
              <p className="text-xs text-gray-400">{status.repo}</p>
            </div>
          </div>
          <Badge color={status.configured ? 'green' : 'yellow'}>
            {status.configured ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-bold text-gray-800 dark:text-white">
              {counts?.totalGithubTasks ?? status.totalSynced ?? 0}
            </p>
            <p className="text-xs text-gray-400">Issues</p>
          </div>
          <div>
            <p className="text-lg font-bold text-green-600">
              {status.successfulEvents ?? 0}
            </p>
            <p className="text-xs text-gray-400">Success</p>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-800 dark:text-white">
              {counts?.totalAllTasks
                ? Math.round(
                    (counts.totalGithubTasks / counts.totalAllTasks) * 100
                  )
                : 0}
              %
            </p>
            <p className="text-xs text-gray-400">of Tasks</p>
          </div>
        </div>
        {status.lastSyncAt && (
          <p className="text-xs text-gray-400 mt-3 text-center">
            Last sync: {new Date(status.lastSyncAt).toLocaleString()}
          </p>
        )}
      </Card>
    </a>
  );
}
