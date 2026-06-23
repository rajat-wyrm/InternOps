import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Calendar, Users, Star, Target } from 'lucide-react';
import api from '../../lib/axios';
import { PageHeader, Card, Input, Badge, Spinner } from '../../components/ui';

const ROLE_COLOR = {
  ADMIN: 'purple',
  SENIOR_TL: 'indigo',
  TL: 'blue',
  CAPTAIN: 'teal',
  INTERN: 'gray',
};
const STATUS_COLOR = { PRESENT: 'green', ABSENT: 'red', HALF_DAY: 'yellow' };

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
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shadow-sm">
          <BarChart3 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
            Reports
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Aggregated attendance, ratings & task stats
          </p>
        </div>
      </div>

      <Card className="p-4 mb-6 flex flex-wrap gap-4 items-end border-indigo-100 shadow-sm">
        <div className="flex-1 min-w-[150px]">
          <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
            From
          </label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
            To
          </label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-500" /> Attendance Summary
          </h3>
          {attendanceQuery.isLoading ? (
            <Spinner />
          ) : (
            <div className="space-y-3">
              {attendanceData.map((row) => (
                <div
                  key={row.role + row.status}
                  className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded-lg"
                >
                  <div className="flex gap-2">
                    <Badge color={ROLE_COLOR[row.role]}>{row.role}</Badge>
                    <Badge color={STATUS_COLOR[row.status]}>{row.status}</Badge>
                  </div>
                  <span className="font-bold text-gray-800">{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" /> Ratings Summary
          </h3>
          {ratingsQuery.isLoading ? (
            <Spinner />
          ) : (
            <div className="space-y-3">
              {ratingsData.map((row) => (
                <div
                  key={row.role}
                  className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded-lg"
                >
                  <Badge color={ROLE_COLOR[row.role]}>{row.role}</Badge>
                  <span className="font-medium text-gray-700">
                    {parseFloat(row.avg_score).toFixed(2)}{' '}
                    <span className="text-gray-400">({row.total})</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 md:col-span-2">
          <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-500" /> Task Completion
          </h3>
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
                  <div key={task.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-gray-700">
                        {task.title}
                      </span>
                      <span className="text-gray-500">{pct}%</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500"
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
