import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/axios';
import {
  PageHeader,
  Card,
  Input,
  Table,
  Badge,
  Spinner,
} from '../../components/ui';

const MEDAL = ['🥇', '🥈', '🥉'];

// ✅ RFC4122 UUID Regular Expression validator string
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Analytics() {
  const [deptId, setDeptId] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  // ✅ 1. Populate a dynamic dropdown menu by pulling down real system departments
  const { data: departments, isLoading: loadingDepts } = useQuery({
    queryKey: ['departmentsList'],
    queryFn: () => api.get('/departments').then((r) => r.data),
  });

  // ✅ 2. Execute query ONLY when deptId matches a real formatted UUID
  const isValidUuid = UUID_REGEX.test(deptId);

  const { data: deptAttendance } = useQuery({
    queryKey: ['deptAttendance', deptId, month, year],
    queryFn: () =>
      api
        .get(
          `/analytics/department-attendance?departmentId=${deptId}&month=${month}&year=${year}`
        )
        .then((r) => r.data),
    enabled: isValidUuid, // ✅ No more keystroke firing! Only executes on a legitimate UUID selection
  });

  const { data: topPerformers } = useQuery({
    queryKey: ['topPerformers'],
    queryFn: () =>
      api
        .get('/analytics/top-performers?role=INTERN&limit=5')
        .then((r) => r.data),
  });
  const { data: trends } = useQuery({
    queryKey: ['attendanceTrends'],
    queryFn: () =>
      api.get('/analytics/attendance-trends?months=6').then((r) => r.data),
  });

  const byMonth = trends
    ? Object.entries(
        trends.reduce((acc, row) => {
          acc[row.month] = acc[row.month] || {};
          acc[row.month][row.status] = row.count;
          return acc;
        }, {})
      )
    : [];
  const maxTrend = Math.max(
    1,
    ...byMonth.map(
      ([, s]) => (s.PRESENT || 0) + (s.ABSENT || 0) + (s.HALF_DAY || 0)
    )
  );

  return (
    <div>
      <PageHeader
        title="Analytics"
        icon="📊"
        subtitle="Performance & attendance insights"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <Card className="p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            🏆 Top Intern Performers
          </h3>
          {!topPerformers?.length ? (
            <p className="text-gray-400 text-sm">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {topPerformers.map((u, idx) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-transparent rounded-xl p-2"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg w-6 text-center">
                      {MEDAL[idx] || `#${idx + 1}`}
                    </span>
                    <span className="font-medium text-gray-700">
                      {u.full_name || u.email}
                    </span>
                  </span>
                  <span className="text-amber-600 font-bold">
                    ⭐ {parseFloat(u.avg_rating).toFixed(2)}{' '}
                    <span className="text-gray-400 text-xs font-normal">
                      ({u.total_ratings})
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            📈 Attendance Trends (6 mo)
          </h3>
          {!byMonth.length ? (
            <p className="text-gray-400 text-sm">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {byMonth.map(([m, s]) => {
                const total =
                  (s.PRESENT || 0) + (s.ABSENT || 0) + (s.HALF_DAY || 0);
                return (
                  <div key={m}>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{m}</span>
                      <span>{total} records</span>
                    </div>
                    <div
                      className="flex h-3 rounded-full overflow-hidden bg-gray-100"
                      style={{
                        width: `${Math.max(8, (total / maxTrend) * 100)}%`,
                      }}
                    >
                      <div
                        className="bg-green-500"
                        style={{
                          width: `${((s.PRESENT || 0) / total) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-amber-400"
                        style={{
                          width: `${((s.HALF_DAY || 0) / total) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-red-500"
                        style={{ width: `${((s.ABSENT || 0) / total) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-3 text-xs text-gray-500 pt-1">
                <span>🟢 Present</span>
                <span>🟡 Half-day</span>
                <span>🔴 Absent</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          🏢 Department Attendance
        </h3>
        <div className="flex gap-2 flex-wrap mb-3">
          {/* ✅ Swapped out plain input text field for an explicit, secure dropdown list selection */}
          <select
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            className="flex h-10 w-full max-w-xs rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-gray-700"
            disabled={loadingDepts}
          >
            <option value="">-- Select Department --</option>
            {departments?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name || d.id}
              </option>
            ))}
          </select>

          <Input
            type="number"
            placeholder="Month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-24"
          />
          <Input
            type="number"
            placeholder="Year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-28"
          />
        </div>

        {!deptId ? (
          <p className="text-gray-400 text-sm">
            Select a department from the menu above to view attendance metrics.
          </p>
        ) : !isValidUuid ? (
          <p className="text-red-500 text-sm">
            A valid structural identifier selection is required.
          </p>
        ) : !deptAttendance ? (
          <Spinner />
        ) : (
          <Table head={['Name', 'Present', 'Absent', 'Half Day']}>
            {deptAttendance.map((u) => (
              <tr key={u.id} className="border-t hover:bg-indigo-50/40">
                <td className="p-3 font-medium text-gray-700">
                  {u.full_name || u.email}
                </td>
                <td className="p-3">
                  <Badge color="green">{u.present}</Badge>
                </td>
                <td className="p-3">
                  <Badge color="red">{u.absent}</Badge>
                </td>
                <td className="p-3">
                  <Badge color="yellow">{u.half_day}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
