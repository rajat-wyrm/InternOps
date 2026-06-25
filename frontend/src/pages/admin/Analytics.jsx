import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Trophy,
  TrendingUp,
  Building2,
  Calendar,
  Filter,
} from 'lucide-react';
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
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Analytics() {
  const [deptId, setDeptId] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const { data: departments, isLoading: loadingDepts } = useQuery({
    queryKey: ['departmentsList'],
    queryFn: () => api.get('/departments').then((r) => r.data),
  });

  const isValidUuid = UUID_REGEX.test(deptId);

  const { data: deptAttendance } = useQuery({
    queryKey: ['deptAttendance', deptId, month, year],
    queryFn: () =>
      api
        .get(
          `/analytics/department-attendance?departmentId=${deptId}&month=${month}&year=${year}`
        )
        .then((r) => r.data),
    enabled: isValidUuid,
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
    <div className="animate-fade-in-up">
      {/* 🚀 Professional Header Block 🚀 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shadow-sm">
          <BarChart3 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
            Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Performance & attendance insights
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" /> Top Intern Performers
          </h3>
          {!topPerformers?.length ? (
            <p className="text-gray-400 text-sm">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {topPerformers.map((u, idx) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                >
                  <span className="flex items-center gap-3 font-medium text-gray-700">
                    <span className="text-lg w-6 text-center">
                      {MEDAL[idx] || `#${idx + 1}`}
                    </span>
                    {u.full_name || u.email}
                  </span>
                  <span className="text-amber-600 font-bold">
                    ⭐ {parseFloat(u.avg_rating).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" /> Attendance Trends
            (6 mo)
          </h3>
          {!byMonth.length ? (
            <p className="text-gray-400 text-sm">No data yet.</p>
          ) : (
            <div className="space-y-4">
              {byMonth.map(([m, s]) => {
                const total =
                  (s.PRESENT || 0) + (s.ABSENT || 0) + (s.HALF_DAY || 0);
                return (
                  <div key={m}>
                    <div className="flex justify-between text-xs font-medium text-gray-500 mb-1">
                      <span>{m}</span>
                      <span>{total} records</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
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
            </div>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-500" /> Department
          Attendance
        </h3>

        <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block flex items-center gap-1">
              <Filter className="w-3 h-3" /> Department
            </label>
            <select
              value={deptId}
              onChange={(e) => setDeptId(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              disabled={loadingDepts}
            >
              <option value="">Select Department</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name || d.id}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
              Month
            </label>
            <Input
              type="number"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <div className="w-28">
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
              Year
            </label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>
        </div>

        {!deptId ? (
          <p className="text-gray-400 text-sm italic">
            Select a department to view detailed attendance metrics.
          </p>
        ) : !deptAttendance ? (
          <Spinner />
        ) : (
          <Table head={['Name', 'Present', 'Absent', 'Half Day']}>
            {deptAttendance.map((u) => (
              <tr key={u.id} className="border-t">
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
