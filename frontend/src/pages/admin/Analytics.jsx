import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Trophy, TrendingUp, Building2, Filter } from 'lucide-react';
import api from '../../lib/axios';
import { Card, Input, Table, Badge, Spinner } from '../../components/ui';
import CustomSelect from '../../components/CustomSelect';

const MEDAL = ['🥇', '🥈', '🥉'];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Analytics() {
  const [deptId, setDeptId] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const { data: departments = [], isLoading: loadingDepts } = useQuery({
    queryKey: ['departmentsList'],
    queryFn: () => api.get('/departments').then((r) => r.data),
  });

  const departmentOptions = [
    { value: '', label: 'Select Department' },
    ...departments.map((d) => ({
      value: d.id,
      label: d.name || d.id,
    })),
  ];

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
              Insights
            </p>

            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Analytics
            </h1>

            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
              Performance and attendance insights
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Performers */}
        <Card className="p-6 md:p-7 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 flex items-center justify-center border border-amber-100 dark:border-amber-900/60">
              <Trophy className="w-5 h-5" />
            </div>

            <div>
              <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
                Top Intern Performers
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Highest rated interns based on recent performance.
              </p>
            </div>
          </div>

          {!topPerformers?.length ? (
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                No data yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {topPerformers.map((u, idx) => {
                const rating = Number(u.avg_rating || 0);

                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl"
                  >
                    <span className="flex items-center gap-3 font-bold text-slate-700 dark:text-slate-200 min-w-0">
                      <span className="text-lg w-7 text-center shrink-0">
                        {MEDAL[idx] || `#${idx + 1}`}
                      </span>

                      <span className="truncate">{u.full_name || u.email}</span>
                    </span>

                    <span className="text-amber-600 dark:text-amber-300 font-extrabold shrink-0">
                      ⭐ {rating.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Attendance Trends */}
        <Card className="p-6 md:p-7 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/60">
              <TrendingUp className="w-5 h-5" />
            </div>

            <div>
              <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
                Attendance Trends
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Attendance breakdown across the last 6 months.
              </p>
            </div>
          </div>

          {!byMonth.length ? (
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                No data yet.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {byMonth.map(([m, s]) => {
                const total =
                  (s.PRESENT || 0) + (s.ABSENT || 0) + (s.HALF_DAY || 0);
                const safeTotal = total || 1;

                return (
                  <div key={m}>
                    <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                      <span>{m}</span>
                      <span>
                        {total} record{total === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex border border-slate-200 dark:border-slate-700">
                      <div
                        className="bg-emerald-500"
                        title={`Present: ${s.PRESENT || 0}`}
                        style={{
                          width: `${((s.PRESENT || 0) / safeTotal) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-amber-400"
                        title={`Half Day: ${s.HALF_DAY || 0}`}
                        style={{
                          width: `${((s.HALF_DAY || 0) / safeTotal) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-red-500"
                        title={`Absent: ${s.ABSENT || 0}`}
                        style={{
                          width: `${((s.ABSENT || 0) / safeTotal) * 100}%`,
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>Present: {s.PRESENT || 0}</span>
                      <span>Half day: {s.HALF_DAY || 0}</span>
                      <span>Absent: {s.ABSENT || 0}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Department Attendance */}
      <Card className="p-6 md:p-7 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/60">
            <Building2 className="w-5 h-5" />
          </div>

          <div>
            <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
              Department Attendance
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              View detailed attendance metrics by department.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-800/70 rounded-3xl border border-slate-200 dark:border-slate-700">
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Department
            </label>

            <CustomSelect
              value={deptId}
              onChange={setDeptId}
              options={departmentOptions}
              placeholder="Select Department"
              disabled={loadingDepts}
              className="w-full"
            />
          </div>

          <div className="w-28">
            <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase mb-2 block">
              Month
            </label>

            <Input
              type="number"
              min="1"
              max="12"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>

          <div className="w-32">
            <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase mb-2 block">
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
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-slate-500 dark:text-slate-400 text-sm italic">
              Select a department to view detailed attendance metrics.
            </p>
          </div>
        ) : !deptAttendance ? (
          <Spinner />
        ) : (
          <Table head={['Name', 'Present', 'Absent', 'Half Day']}>
            {deptAttendance.map((u, index) => (
              <tr
                key={u.id}
                className={`border-b border-slate-100 dark:border-slate-700 last:border-b-0 ${
                  index % 2 === 0
                    ? 'bg-white dark:bg-slate-900'
                    : 'bg-slate-50/50 dark:bg-slate-800/35'
                }`}
              >
                <td className="p-3 font-bold text-slate-700 dark:text-slate-200">
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
