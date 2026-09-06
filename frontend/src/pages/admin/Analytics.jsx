import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import useAuthStore from '../../store/auth';
import api from '../../lib/axios';
import { Badge, Card } from '../../components/ui';
import CustomSelect from '../../components/CustomSelect';
import AnalyticsWorkspace from '../../components/analytics/AnalyticsWorkspace';

const MEDAL = ['🥇', '🥈', '🥉'];
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const RANGE_OPTIONS = [
  { value: '3', label: 'Last 3 months' },
  { value: '6', label: 'Last 6 months' },
  { value: '12', label: 'Last 12 months' },
];
const monthOptionsFor = (year) =>
  MONTHS.slice(
    0,
    Number(year) === new Date().getFullYear() ? new Date().getMonth() + 1 : 12
  ).map((label, index) => ({ value: String(index + 1), label }));
const yearOptions = () =>
  Array.from({ length: new Date().getFullYear() - 1999 }, (_, index) =>
    String(new Date().getFullYear() - index)
  ).map((value) => ({ value, label: value }));
const monthLabel = (value) => {
  const [year, month] = value.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
};

function InlineError({ message, retry }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <p className="text-sm font-bold text-red-600 dark:text-red-400">
        {message}
      </p>
      <button
        type="button"
        onClick={retry}
        className="mt-3 rounded-xl border border-red-200 px-3 py-2 text-sm font-bold dark:border-red-800"
      >
        Retry
      </button>
    </div>
  );
}
function AttendancePlaceholder() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
      <div className="grid grid-cols-4 gap-4 bg-slate-100 p-4 dark:bg-slate-800">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700"
          />
        ))}
      </div>
      {Array.from({ length: 5 }, (_, row) => (
        <div
          key={row}
          className="grid grid-cols-4 gap-4 border-t border-slate-200 p-4 dark:border-slate-700"
        >
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-5 animate-pulse rounded bg-slate-200 dark:bg-slate-700"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const [departmentId, setDepartmentId] = useState('');
  const [rangeMonths, setRangeMonths] = useState('6');
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const validDepartment = UUID_REGEX.test(departmentId);
  const monthOptions = monthOptionsFor(year);
  useEffect(() => {
    if (!monthOptions.some((item) => item.value === month))
      setMonth(monthOptions.at(-1)?.value || '1');
  }, [month, monthOptions]);
  const rangeParams = useMemo(() => {
    const to = new Date();
    const from = new Date(to);
    from.setMonth(from.getMonth() - (Number(rangeMonths) - 1));
    from.setDate(1);
    const params = new URLSearchParams({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
    if (validDepartment) params.set('departmentId', departmentId);
    return params;
  }, [departmentId, rangeMonths, validDepartment]);
  const enabled = hydrated && Boolean(accessToken);
  const departmentsQuery = useQuery({
    queryKey: ['departmentsList'],
    queryFn: () =>
      api
        .get('/departments', { _suppressGlobalError: true })
        .then((response) => response.data),
    staleTime: 300000,
    enabled,
  });
  const departmentOptions = [
    { value: '', label: 'All departments' },
    ...(departmentsQuery.data || []).map((department) => ({
      value: department.id,
      label: department.name || department.id,
    })),
  ];
  const workspaceQuery = useQuery({
    queryKey: ['analyticsWorkspace', departmentId, rangeMonths],
    queryFn: () =>
      api
        .get(`/analytics/workspace?${rangeParams}`, {
          _suppressGlobalError: true,
        })
        .then((response) => response.data),
    enabled,
    retry: 1,
  });
  const performersQuery = useQuery({
    queryKey: ['topPerformers', departmentId, rangeMonths],
    queryFn: () => {
      const params = new URLSearchParams({
        role: 'INTERN',
        limit: '5',
        from: rangeParams.get('from'),
        to: rangeParams.get('to'),
      });
      if (validDepartment) params.set('departmentId', departmentId);
      return api
        .get(`/analytics/top-performers?${params}`, {
          _suppressGlobalError: true,
        })
        .then((response) => response.data);
    },
    enabled,
    retry: 1,
  });
  const trendsQuery = useQuery({
    queryKey: ['attendanceTrends', departmentId, rangeMonths],
    queryFn: () => {
      const params = new URLSearchParams({ months: rangeMonths });
      if (validDepartment) params.set('departmentId', departmentId);
      return api
        .get(`/analytics/attendance-trends?${params}`, {
          _suppressGlobalError: true,
        })
        .then((response) => response.data);
    },
    enabled,
    retry: 1,
  });
  const attendanceQuery = useQuery({
    queryKey: ['deptAttendance', departmentId, month, year],
    queryFn: () =>
      api
        .get(
          `/analytics/department-attendance?departmentId=${departmentId}&month=${month}&year=${year}`,
          { _suppressGlobalError: true }
        )
        .then((response) => response.data),
    enabled: enabled && validDepartment,
    placeholderData: (previous) => previous,
    retry: 1,
  });
  const lowAttendance = (attendanceQuery.data || []).filter((member) => {
    const present = Number(member.present || 0);
    const total =
      present + Number(member.absent || 0) + Number(member.half_day || 0);
    return total > 0 && Math.round((present / total) * 100) < 60;
  });
  const trends = Object.entries(
    (trendsQuery.data || []).reduce((result, row) => {
      result[row.month] ||= {};
      result[row.month][row.status] = row.count;
      return result;
    }, {})
  );
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div>
          <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300">
            Insights
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Organization and department performance insights
          </p>
        </div>
      </div>
      <Card className="relative flex flex-wrap items-end gap-4 p-4">
        <div className="min-w-[260px] flex-1">
          <label className="mb-2 block text-xs font-extrabold uppercase text-slate-500">
            Department scope
          </label>
          <CustomSelect
            value={departmentId}
            onChange={setDepartmentId}
            options={departmentOptions}
            disabled={departmentsQuery.isLoading}
            className="w-full"
          />
        </div>
        <div className="w-full sm:w-48">
          <label className="mb-2 block text-xs font-extrabold uppercase text-slate-500">
            Date range
          </label>
          <CustomSelect
            value={rangeMonths}
            onChange={setRangeMonths}
            options={RANGE_OPTIONS}
            className="w-full"
          />
        </div>
        {workspaceQuery.isFetching && workspaceQuery.data && (
          <span
            title="Updating analytics"
            aria-label="Updating analytics"
            className="absolute right-4 top-4 h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"
          />
        )}
      </Card>
      {workspaceQuery.isError ? (
        <InlineError
          message="Analytics summary could not be loaded."
          retry={workspaceQuery.refetch}
        />
      ) : workspaceQuery.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Card
              key={i}
              className="h-28 animate-pulse bg-slate-100 dark:bg-slate-800"
            />
          ))}
        </div>
      ) : (
        <div
          className={
            workspaceQuery.isFetching
              ? 'pointer-events-none opacity-60 transition-opacity'
              : undefined
          }
        >
          <AnalyticsWorkspace
            data={workspaceQuery.data}
            section="summary"
            departmentSelected={validDepartment}
          />
        </div>
      )}
      <div className="grid gap-6 lg:h-[520px] lg:grid-cols-2">
        <Card className="flex min-h-0 flex-col p-6">
          <div className="mb-5 flex shrink-0 items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-700">
            <Trophy className="h-11 w-11 rounded-2xl bg-amber-50 p-3 text-amber-600 dark:bg-amber-950/40" />
            <div>
              <h2 className="text-xl font-extrabold">Top Intern Performers</h2>
              <p className="text-sm text-slate-500">
                Highest rated interns in the selected scope.
              </p>
            </div>
          </div>
          {performersQuery.isError ? (
            <InlineError
              message="Top performers could not be loaded."
              retry={performersQuery.refetch}
            />
          ) : performersQuery.isPending ? (
            <AttendancePlaceholder />
          ) : !performersQuery.data?.length ? (
            <p className="rounded-2xl border p-4 text-sm text-slate-500 dark:border-slate-700">
              No performer data in this scope.
            </p>
          ) : (
            <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
              {performersQuery.data.map((user, index) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 dark:border-slate-700"
                >
                  <b className="truncate">
                    {MEDAL[index] || `#${index + 1}`}{' '}
                    {user.full_name || 'Unnamed member'}
                  </b>
                  <b className="text-amber-500">
                    {Number(user.avg_rating || 0).toFixed(2)} / 10
                  </b>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="flex min-h-0 flex-col p-6">
          <div className="mb-5 flex shrink-0 items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-700">
            <TrendingUp className="h-11 w-11 rounded-2xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-950/40" />
            <div>
              <h2 className="text-xl font-extrabold">Attendance Trends</h2>
              <p className="text-sm text-slate-500">
                Attendance across the selected date range and department.
              </p>
            </div>
          </div>
          {trendsQuery.isError ? (
            <InlineError
              message="Attendance trends could not be loaded."
              retry={trendsQuery.refetch}
            />
          ) : trendsQuery.isPending ? (
            <AttendancePlaceholder />
          ) : !trends.length ? (
            <p className="rounded-2xl border p-4 text-sm text-slate-500 dark:border-slate-700">
              No attendance trend data in this scope.
            </p>
          ) : (
            <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
              {trends.slice(-Number(rangeMonths)).map(([period, statuses]) => {
                const present = Number(statuses.PRESENT || 0);
                const halfDay = Number(statuses.HALF_DAY || 0);
                const absent = Number(statuses.ABSENT || 0);
                const total = present + halfDay + absent;
                return (
                  <div key={period}>
                    <div className="mb-2 flex justify-between text-xs font-bold text-slate-500">
                      <span>{monthLabel(period)}</span>
                      <span>{total} records</span>
                    </div>
                    <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="bg-emerald-500"
                        style={{
                          width: `${total ? (present / total) * 100 : 0}%`,
                        }}
                      />
                      <div
                        className="bg-amber-400"
                        style={{
                          width: `${total ? (halfDay / total) * 100 : 0}%`,
                        }}
                      />
                      <div
                        className="bg-red-500"
                        style={{
                          width: `${total ? (absent / total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Present: {present} · Half day: {halfDay} · Absent:{' '}
                      {absent}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
      <AnalyticsWorkspace
        data={workspaceQuery.data}
        section="distributions"
        departmentSelected={validDepartment}
      />
      <AnalyticsWorkspace
        data={workspaceQuery.data}
        section="comparison"
        departmentSelected={validDepartment}
      />
      {validDepartment && lowAttendance.length > 0 && (
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <AlertTriangle className="h-10 w-10 rounded-xl bg-rose-50 p-2 text-rose-600 dark:bg-rose-950/40" />
            <div>
              <h2 className="text-xl font-extrabold">Needs Attention</h2>
              <p className="text-sm text-slate-500">
                Members below 60% attendance for the selected month.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {lowAttendance.slice(0, 8).map((member) => {
              const present = Number(member.present || 0);
              const total =
                present +
                Number(member.absent || 0) +
                Number(member.half_day || 0);
              return (
                <div
                  key={member.id}
                  className="flex justify-between rounded-2xl border border-rose-200 p-4 dark:border-rose-900"
                >
                  <b>{member.full_name || 'Unnamed member'}</b>
                  <b className="text-rose-500">
                    {total ? Math.round((present / total) * 100) : 0}%
                  </b>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      <Card className="p-6">
        <div className="mb-5 flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-700">
          <Building2 className="h-11 w-11 rounded-2xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950/40" />
          <div>
            <h2 className="text-xl font-extrabold">Department Attendance</h2>
            <p className="text-sm text-slate-500">
              {validDepartment
                ? `Member attendance for ${departmentOptions.find((item) => item.value === departmentId)?.label || 'the selected department'} in ${MONTHS[Number(month) - 1]} ${year}.`
                : 'Select a specific department to enable member-level monthly attendance.'}
            </p>
          </div>
          {attendanceQuery.isFetching && attendanceQuery.data && (
            <span className="ml-auto text-xs font-bold text-indigo-500">
              Refreshing...
            </span>
          )}
        </div>
        {validDepartment && (
          <div className="mb-6 flex flex-wrap gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
            <div className="w-full sm:w-48">
              <label className="mb-2 block text-xs font-extrabold uppercase text-slate-500">
                Month
              </label>
              <CustomSelect
                value={month}
                onChange={setMonth}
                options={monthOptions}
                className="w-full"
              />
            </div>
            <div className="w-full sm:w-40">
              <label className="mb-2 block text-xs font-extrabold uppercase text-slate-500">
                Year
              </label>
              <CustomSelect
                value={year}
                onChange={setYear}
                options={yearOptions()}
                className="w-full"
              />
            </div>
          </div>
        )}
        {!validDepartment ? (
          <p className="rounded-2xl border border-slate-200 p-4 text-sm italic text-slate-500 dark:border-slate-700">
            Select one global department to view member attendance.
          </p>
        ) : attendanceQuery.isError ? (
          <InlineError
            message="Department attendance could not be loaded."
            retry={attendanceQuery.refetch}
          />
        ) : attendanceQuery.isPending ? (
          <AttendancePlaceholder />
        ) : !attendanceQuery.data?.length ? (
          <p className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700">
            No attendance records for this department and month.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="border-b-2 border-slate-200 bg-slate-100 text-left dark:border-indigo-500/20 dark:bg-indigo-950/40">
                <tr>
                  {['Name', 'Present', 'Absent', 'Half Day'].map((label) => (
                    <th key={label} className="p-4 font-extrabold">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {attendanceQuery.data.map((user, index) => (
                  <tr
                    key={user.id}
                    className={
                      index % 2 ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''
                    }
                  >
                    <td className="p-4 font-bold">
                      {user.full_name || 'Unnamed member'}
                    </td>
                    <td className="p-4">
                      <Badge color="green">{user.present}</Badge>
                    </td>
                    <td className="p-4">
                      <Badge color="red">{user.absent}</Badge>
                    </td>
                    <td className="p-4">
                      <Badge color="yellow">{user.half_day}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <AnalyticsWorkspace
        data={workspaceQuery.data}
        section="operations"
        departmentSelected={validDepartment}
      />
    </div>
  );
}
