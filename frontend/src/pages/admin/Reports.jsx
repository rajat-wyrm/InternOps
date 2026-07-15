import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/axios';
import { PageHeader, Card, Badge, Spinner } from '../../components/ui';
import CustomDatePicker from '../../components/CustomDatePicker';

const ROLE_COLOR = {
  ADMIN: 'purple',
  SENIOR_TL: 'indigo',
  TL: 'blue',
  CAPTAIN: 'teal',
  INTERN: 'gray',
};

const STATUS_COLOR = {
  PRESENT: 'green',
  ABSENT: 'red',
  HALF_DAY: 'yellow',
};

export default function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const attendanceQuery = useQuery({
    queryKey: ['reportAttendance', from, to],
    queryFn: () =>
      api
        .get(`/reports/attendance-summary?from=${from}&to=${to}`)
        .then((r) => r.data),
    enabled: !!from && !!to,
  });

  const ratingsQuery = useQuery({
    queryKey: ['reportRatings', from, to],
    queryFn: () =>
      api
        .get(`/reports/ratings-summary?from=${from}&to=${to}`)
        .then((r) => r.data),
    enabled: !!from && !!to,
  });

  const tasksQuery = useQuery({
    queryKey: ['reportTasks'],
    queryFn: () => api.get('/reports/task-completion').then((r) => r.data),
  });

  const attendanceData = attendanceQuery.data || [];
  const ratingsData = ratingsQuery.data || [];
  const tasksData = tasksQuery.data || [];

  return (
    <div>
      <PageHeader
        title="Reports"
        icon="📈"
        subtitle="Aggregated attendance, ratings & task stats"
      />

      <Card className="p-4 mb-5 flex gap-4 items-end flex-wrap">
        <div className="w-full sm:w-56">
          <label className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2 block">
            From
          </label>

          <CustomDatePicker
            value={from}
            onChange={setFrom}
            max={today}
            placeholder="Select from date"
            className="w-full"
          />
        </div>

        <div className="w-full sm:w-56">
          <label className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2 block">
            To
          </label>

          <CustomDatePicker
            value={to}
            onChange={setTo}
            max={today}
            placeholder="Select to date"
            className="w-full"
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            📅 Attendance Summary
          </h3>

          {attendanceQuery.isLoading ? (
            <Spinner />
          ) : !attendanceData?.length ? (
            <p className="text-gray-400 dark:text-slate-500 text-sm">
              No data for selected period.
            </p>
          ) : (
            <div className="space-y-2">
              {attendanceData.map((row) => (
                <div
                  key={row.role + row.status}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Badge color={ROLE_COLOR[row.role] || 'gray'}>
                      {row.role}
                    </Badge>

                    <Badge color={STATUS_COLOR[row.status] || 'gray'}>
                      {row.status}
                    </Badge>
                  </span>

                  <span className="font-bold text-gray-800 dark:text-white">
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            ⭐ Ratings Summary
          </h3>

          {ratingsQuery.isLoading ? (
            <Spinner />
          ) : !ratingsData?.length ? (
            <p className="text-gray-400 dark:text-slate-500 text-sm">
              No data for selected period.
            </p>
          ) : (
            <div className="space-y-2">
              {ratingsData.map((row) => (
                <div
                  key={row.role}
                  className="flex items-center justify-between text-sm"
                >
                  <Badge color={ROLE_COLOR[row.role] || 'gray'}>
                    {row.role}
                  </Badge>

                  <span className="text-gray-700 dark:text-slate-300">
                    ⭐ {parseFloat(row.avg_score).toFixed(2)}{' '}
                    <span className="text-gray-400 dark:text-slate-500">
                      ({row.total})
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 md:col-span-2">
          <h3 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            🎯 Task Completion
          </h3>

          {tasksQuery.isLoading ? (
            <Spinner />
          ) : !tasksData?.length ? (
            <p className="text-gray-400 dark:text-slate-500 text-sm">
              No tasks.
            </p>
          ) : (
            <div className="space-y-3">
              {tasksData.map((task) => {
                const total = (task.verified || 0) + (task.pending || 0);
                const pct = total
                  ? Math.round((task.verified / total) * 100)
                  : 0;

                return (
                  <div key={task.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 dark:text-slate-300">
                        {task.title}
                      </span>

                      <span className="text-gray-500 dark:text-slate-400">
                        {task.verified}/{total} verified
                      </span>
                    </div>

                    <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-green-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
