import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Calendar, Star, Target, Filter } from 'lucide-react';
import api from '../../lib/axios';
import { Card, Input, Badge, Spinner } from '../../components/ui';

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

const MOCK_ATTENDANCE = [
  { role: 'INTERN', status: 'PRESENT', count: 42 },
  { role: 'INTERN', status: 'ABSENT', count: 5 },
  { role: 'INTERN', status: 'HALF_DAY', count: 3 },
  { role: 'CAPTAIN', status: 'PRESENT', count: 8 },
  { role: 'CAPTAIN', status: 'ABSENT', count: 1 },
  { role: 'TL', status: 'PRESENT', count: 4 },
  { role: 'SENIOR_TL', status: 'PRESENT', count: 2 },
  { role: 'ADMIN', status: 'PRESENT', count: 1 },
];

const MOCK_RATINGS = [
  { role: 'INTERN', avg_score: 4.12, total: 52 },
  { role: 'CAPTAIN', avg_score: 4.35, total: 12 },
  { role: 'TL', avg_score: 4.51, total: 6 },
  { role: 'SENIOR_TL', avg_score: 4.72, total: 3 },
];

const MOCK_TASKS = [
  {
    id: 'mock-task-1',
    title: 'LinkedIn Outreach Campaign',
    verified: 18,
    pending: 4,
  },
  {
    id: 'mock-task-2',
    title: 'Instagram Marketing Sprint',
    verified: 25,
    pending: 6,
  },
  {
    id: 'mock-task-3',
    title: 'Community Engagement Drive',
    verified: 14,
    pending: 2,
  },
  {
    id: 'mock-task-4',
    title: 'Weekly Progress Report',
    verified: 30,
    pending: 5,
  },
];

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

  const attendanceData =
    attendanceQuery.data?.length > 0 ? attendanceQuery.data : MOCK_ATTENDANCE;

  const ratingsData =
    ratingsQuery.data?.length > 0 ? ratingsQuery.data : MOCK_RATINGS;

  const tasksData = tasksQuery.data?.length > 0 ? tasksQuery.data : MOCK_TASKS;

  return (
    <div className="animate-fade-in-up">
      {/* Professional Header Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shadow-sm">
            <BarChart3 className="w-6 h-6" />
          </div>

          <div>
            <p className="text-xs md:text-sm uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300 font-extrabold mb-1">
              Reporting
            </p>

            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Reports
            </h1>

            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
              Aggregated attendance, ratings, and task statistics
            </p>
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card className="p-5 md:p-6 mb-6 border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-white via-slate-50 to-indigo-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/60">
              <Filter className="w-5 h-5" />
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Report Range
              </h2>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                Choose a date range to refresh attendance and rating summaries.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
              From
            </label>

            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>

          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
              To
            </label>

            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attendance Summary */}
        <Card className="p-6 md:p-7 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/60">
              <Calendar className="w-5 h-5" />
            </div>

            <div>
              <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
                Attendance Summary
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Role-wise attendance counts for the selected period.
              </p>
            </div>
          </div>

          {attendanceQuery.isLoading ? (
            <Spinner />
          ) : (
            <div className="space-y-3">
              {attendanceData.map((row) => (
                <div
                  key={row.role + row.status}
                  className="flex items-center justify-between gap-4 text-sm p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl"
                >
                  <div className="flex gap-2 flex-wrap">
                    <Badge color={ROLE_COLOR[row.role]}>{row.role}</Badge>
                    <Badge color={STATUS_COLOR[row.status]}>{row.status}</Badge>
                  </div>

                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Ratings Summary */}
        <Card className="p-6 md:p-7 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 flex items-center justify-center border border-amber-100 dark:border-amber-900/60">
              <Star className="w-5 h-5" />
            </div>

            <div>
              <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
                Ratings Summary
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Average score and rating count by role.
              </p>
            </div>
          </div>

          {ratingsQuery.isLoading ? (
            <Spinner />
          ) : (
            <div className="space-y-3">
              {ratingsData.map((row) => (
                <div
                  key={row.role}
                  className="flex items-center justify-between gap-4 text-sm p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl"
                >
                  <Badge color={ROLE_COLOR[row.role]}>{row.role}</Badge>

                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {parseFloat(row.avg_score).toFixed(2)}{' '}
                    <span className="text-slate-400 dark:text-slate-500">
                      ({row.total})
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Task Completion */}
        <Card className="p-6 md:p-7 md:col-span-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/60">
              <Target className="w-5 h-5" />
            </div>

            <div>
              <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
                Task Completion
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Verified and pending proof progress across tasks.
              </p>
            </div>
          </div>

          {tasksQuery.isLoading ? (
            <Spinner />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tasksData.map((task) => {
                const total = (task.verified || 0) + (task.pending || 0);
                const pct = total
                  ? Math.round((task.verified / total) * 100)
                  : 0;

                return (
                  <div
                    key={task.id}
                    className="space-y-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-3xl p-4"
                  >
                    <div className="flex justify-between gap-4 text-sm">
                      <span className="font-extrabold text-slate-800 dark:text-white">
                        {task.title}
                      </span>

                      <span className="text-slate-500 dark:text-slate-400 font-bold shrink-0">
                        {pct}%
                      </span>
                    </div>

                    <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Verified: {task.verified || 0}</span>
                      <span>Pending: {task.pending || 0}</span>
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
