import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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

  return (
    <div>
      <PageHeader
        title="Reports"
        icon="📈"
        subtitle="Aggregated attendance, ratings & task stats"
      />

      <Card className="p-4 mb-5 flex gap-4 items-end flex-wrap">
        <div>
          <label className="text-xs text-gray-500">From</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">To</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            📅 Attendance Summary
          </h3>
          {attendanceQuery.isLoading ? (
            <Spinner />
          ) : !attendanceQuery.data?.length ? (
            <p className="text-gray-400 text-sm">
              No data for selected period.
            </p>
          ) : (
            <div className="space-y-2">
              {attendanceQuery.data.map((row) => (
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
                  <span className="font-bold text-gray-800">{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            ⭐ Ratings Summary
          </h3>
          {ratingsQuery.isLoading ? (
            <Spinner />
          ) : !ratingsQuery.data?.length ? (
            <p className="text-gray-400 text-sm">
              No data for selected period.
            </p>
          ) : (
            <div className="space-y-2">
              {ratingsQuery.data.map((row) => (
                <div
                  key={row.role}
                  className="flex items-center justify-between text-sm"
                >
                  <Badge color={ROLE_COLOR[row.role] || 'gray'}>
                    {row.role}
                  </Badge>
                  <span className="text-gray-700">
                    ⭐ {parseFloat(row.avg_score).toFixed(2)}{' '}
                    <span className="text-gray-400">({row.total})</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 md:col-span-2">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            🎯 Task Completion
          </h3>
          {tasksQuery.isLoading ? (
            <Spinner />
          ) : !tasksQuery.data?.length ? (
            <p className="text-gray-400 text-sm">No tasks.</p>
          ) : (
            <div className="space-y-3">
              {tasksQuery.data.map((task) => {
                const total = (task.verified || 0) + (task.pending || 0);
                const pct = total
                  ? Math.round((task.verified / total) * 100)
                  : 0;
                return (
                  <div key={task.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">
                        {task.title}
                      </span>
                      <span className="text-gray-500">
                        {task.verified}/{total} verified
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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
