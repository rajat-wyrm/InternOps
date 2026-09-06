import { ROLE_LABEL } from '../constants/roles';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../lib/axios';
import useAuthStore from '../store/auth';
import { QUERY_KEYS } from '../constants/queryKeys';
import { Card, StatCard, ApiErrorState } from '../components/ui';
import { useRouteInitialLoading } from '../components/loading/RouteInitialLoading';
import { getTeamRoleBreakdown } from '../utils/teamRoleBreakdown';

function attendancePct(m) {
  const total = Number(m.attendance_total);
  const present = Number(m.present_count);
  if (!Number.isFinite(total) || total <= 0) return null;
  if (!Number.isFinite(present) || present < 0) return 0;
  return Math.max(0, Math.min(100, Math.round((present / total) * 100)));
}

function QuickAction({ to, icon, label, tint, description }) {
  return (
    <Link
      to={to}
      className={`group flex items-center gap-3 p-4 rounded-2xl text-sm font-bold transition-all hover:-translate-y-0.5 hover:shadow-md ${tint}`}
    >
      <span className="w-10 h-10 rounded-2xl bg-white/70 dark:bg-slate-900/40 flex items-center justify-center text-xl shadow-sm">
        {icon}
      </span>

      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {description && (
          <span className="block text-xs font-medium opacity-70 mt-0.5 truncate">
            {description}
          </span>
        )}
      </span>
    </Link>
  );
}

function ManagerHome({ user }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);

  const {
    data: team = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEYS.TEAM_MEMBERS,
    queryFn: () => api.get('/team/members').then((res) => res.data),
    enabled: hydrated && !!accessToken,
  });

  useRouteInitialLoading(!hydrated || !accessToken || isLoading);

  if (isError) {
    return (
      <ApiErrorState
        error={error}
        title="Failed to load dashboard data"
        fallback="Unable to load your team dashboard. Please try again."
        onRetry={refetch}
      />
    );
  }

  const active = team.filter(
    (m) => !m.suspended && (m.internship_status || 'ACTIVE') === 'ACTIVE'
  ).length;
  const seniorTlCount = team.filter(
    (member) => member.role === 'SENIOR_TL'
  ).length;

  const tlCount = team.filter((member) => member.role === 'TL').length;

  const captainCount = team.filter(
    (member) => member.role === 'CAPTAIN'
  ).length;

  const internCount = team.filter((member) => member.role === 'INTERN').length;
  const isAdmin = user?.role === 'ADMIN';
  const memberBreakdown = getTeamRoleBreakdown(user?.role, team);
  const pcts = team
    .map(attendancePct)
    .filter((percentage) => Number.isFinite(percentage));
  const averageAttendance = pcts.length
    ? Math.round(
        pcts.reduce((sum, percentage) => sum + percentage, 0) / pcts.length
      )
    : null;
  const avgAtt = Number.isFinite(averageAttendance) ? averageAttendance : null;

  const ratings = team
    .map((m) => m.avg_rating)
    .filter((r) => r != null)
    .map(Number);

  const avgRating = ratings.length
    ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
    : '—';

  const lowAttendance = team.filter((m) => {
    const p = attendancePct(m);
    return p !== null && p < 60;
  });

  return (
    <div className="text-slate-900 dark:text-white">
      {/* Welcome Header */}
      <div className="mb-7">
        <p className="text-xs md:text-sm uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300 font-extrabold mb-2">
          {ROLE_LABEL[user?.role]} Dashboard
        </p>

        <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Welcome, {user?.full_name || user?.email}
        </h1>

        <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-2 max-w-2xl">
          Here is a quick overview of your team activity, performance, and
          pending actions.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={isAdmin ? 'Total team members' : 'Team members'}
          value={team.length}
          sub={
            memberBreakdown.length ? (
              <span className="block leading-5">
                {memberBreakdown.map((row, rowIndex) => (
                  <span
                    key={row.map(({ role }) => role).join('-')}
                    className={rowIndex > 0 ? 'block' : 'block'}
                  >
                    {row.map(({ role, count, label }, itemIndex) => (
                      <span
                        key={role}
                        className="inline-block whitespace-nowrap"
                      >
                        {itemIndex > 0 && (
                          <span className="mx-2 font-extrabold text-indigo-400 dark:text-indigo-300">
                            •
                          </span>
                        )}
                        {count} {label}
                      </span>
                    ))}
                  </span>
                ))}
              </span>
            ) : (
              'No team members'
            )
          }
          icon="👥"
          gradient="from-indigo-500 to-blue-600"
        />

        <StatCard
          label="Active"
          value={active}
          icon="✅"
          gradient="from-emerald-400 to-teal-500"
        />

        <StatCard
          label="Avg attendance"
          value={avgAtt === null ? '—' : `${avgAtt}%`}
          icon="📅"
          gradient="from-sky-400 to-blue-500"
        />

        <StatCard
          label="Avg rating"
          value={avgRating}
          sub="out of 10"
          icon="⭐"
          gradient="from-amber-400 to-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Needs Attention */}
        <Card className="p-6 md:p-7 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
          <div className="flex items-start justify-between gap-4 mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
                Needs attention
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Members with attendance below the expected range.
              </p>
            </div>

            <Link
              to="/analytics"
              className="text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:underline shrink-0"
            >
              View analytics →
            </Link>
          </div>

          {lowAttendance.length === 0 ? (
            <div className="rounded-3xl border border-emerald-100 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-center py-8 px-4">
              <p className="text-slate-800 dark:text-white font-extrabold">
                Everything looks good
              </p>

              <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                Everyone is above 60% attendance.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {lowAttendance.slice(0, 5).map((m) => (
                <div
                  key={m.id}
                  className="flex justify-between items-center text-sm bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/60 rounded-2xl px-4 py-3"
                >
                  <span className="text-slate-700 dark:text-slate-200 font-semibold truncate">
                    {m.full_name || m.email}
                  </span>

                  <span className="text-rose-600 dark:text-rose-300 font-extrabold shrink-0">
                    {attendancePct(m)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card className="p-6 md:p-7 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
          <div className="mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-extrabold text-xl text-slate-900 dark:text-white flex items-center gap-2">
              ⚡ Quick actions
            </h3>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Jump into common team management tasks.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QuickAction
              to="/team"
              icon="👥"
              label="Manage team"
              description="View members"
              tint="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60"
            />

            <QuickAction
              to="/attendance"
              icon="📅"
              label="Mark attendance"
              description="Daily records"
              tint="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/60"
            />

            <QuickAction
              to="/ratings"
              icon="⭐"
              label="Rate members"
              description="Performance"
              tint="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/60"
            />

            <QuickAction
              to="/tasks"
              icon="🎯"
              label="Social tasks"
              description="Track tasks"
              tint="bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-900/60"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
function ManagementHome({ user }) {
  const {
    data: analytics,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['managementHome', user?.id],
    queryFn: async () => {
      const [overviewResult, trendsResult] = await Promise.all([
        api.get('/analytics/overview').then((r) => r.data),
        api.get('/analytics/attendance-trends?months=6').then((r) => r.data),
      ]);

      return {
        overview: overviewResult?.users || [],
        trends: Array.isArray(trendsResult) ? trendsResult : [],
      };
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <p className="text-slate-600 dark:text-slate-300">
        Loading management dashboard...
      </p>
    );
  }

  if (isError) {
    return (
      <ApiErrorState
        error={error}
        title="Failed to load management dashboard"
        fallback="Unable to load management analytics. Please try again."
        onRetry={refetch}
      />
    );
  }

  const overview = analytics?.overview || [];
  const trends = analytics?.trends || [];

  const getCount = (role) =>
    Number(overview.find((item) => item.role === role)?.count || 0);

  const totalUsers = overview.reduce(
    (sum, item) => sum + Number(item.count || 0),
    0
  );

  const interns = getCount('INTERN');
  const captains = getCount('CAPTAIN');
  const tls = getCount('TL');
  const seniorTls = getCount('SENIOR_TL');
  const hr = getCount('HR');

  const present = trends
    .filter((item) => item.status === 'PRESENT')
    .reduce((sum, item) => sum + Number(item.count || 0), 0);

  const absent = trends
    .filter((item) => item.status === 'ABSENT')
    .reduce((sum, item) => sum + Number(item.count || 0), 0);

  const halfDay = trends
    .filter((item) => item.status === 'HALF_DAY')
    .reduce((sum, item) => sum + Number(item.count || 0), 0);

  const attendanceTotal = present + absent + halfDay;

  const attendanceRate =
    attendanceTotal > 0 ? Math.round((present / attendanceTotal) * 100) : null;

  const latestMonths = [...new Set(trends.map((item) => item.month))].slice(-6);

  return (
    <div className="animate-fade-in-up text-slate-900 dark:text-white">
      {/* Welcome Header */}
      <div className="mb-7">
        <p className="text-xs md:text-sm uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300 font-extrabold mb-2">
          Management Dashboard
        </p>

        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
          Welcome, {user?.full_name || user?.email}
        </h1>

        <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-2 max-w-2xl">
          Monitor workforce activity, attendance, and organizational trends from
          one place.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total users"
          value={totalUsers}
          sub="active workforce"
          icon="👥"
          gradient="from-indigo-500 to-blue-600"
        />

        <StatCard
          label="Interns"
          value={interns}
          sub={`${captains} Captains • ${tls} TLs`}
          icon="🎓"
          gradient="from-violet-400 to-purple-500"
        />

        <StatCard
          label="Attendance rate"
          value={attendanceRate === null ? '—' : `${attendanceRate}%`}
          sub="last 6 months"
          icon="📊"
          gradient="from-emerald-400 to-teal-500"
        />

        <StatCard
          label="HR / Senior TL"
          value={hr + seniorTls}
          sub={`${hr} HR • ${seniorTls} Senior TL`}
          icon="🏢"
          gradient="from-amber-400 to-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Workforce Overview */}
        <Card className="p-6 md:p-7 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
          <div className="mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-extrabold text-xl">Workforce overview</h3>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Current workforce distribution by role.
            </p>
          </div>

          <div className="space-y-3">
            {[
              ['HR', hr],
              ['Senior TL', seniorTls],
              ['TL', tls],
              ['Captain', captains],
              ['Intern', interns],
            ].map(([label, count]) => (
              <div
                key={label}
                className="flex justify-between items-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-4 py-3"
              >
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {label}
                </span>

                <span className="font-extrabold text-slate-900 dark:text-white">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Attendance Monitoring */}
        <Card className="p-6 md:p-7 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
          <div className="mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-extrabold text-xl">Attendance monitoring</h3>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Attendance activity across the last six months.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 p-4">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                Present
              </p>
              <p className="text-2xl font-extrabold mt-1">{present}</p>
            </div>

            <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 p-4">
              <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
                Absent
              </p>
              <p className="text-2xl font-extrabold mt-1">{absent}</p>
            </div>

            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 p-4">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                Half day
              </p>
              <p className="text-2xl font-extrabold mt-1">{halfDay}</p>
            </div>
          </div>

          {latestMonths.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-center py-8 px-4">
              <p className="font-extrabold">No attendance data yet</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Attendance trends will appear here once records are available.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {latestMonths.map((month) => {
                const monthRows = trends.filter((item) => item.month === month);

                const monthPresent = monthRows
                  .filter((item) => item.status === 'PRESENT')
                  .reduce((sum, item) => sum + Number(item.count || 0), 0);

                const monthTotal = monthRows.reduce(
                  (sum, item) => sum + Number(item.count || 0),
                  0
                );

                const rate =
                  monthTotal > 0
                    ? Math.round((monthPresent / monthTotal) * 100)
                    : 0;

                return (
                  <div
                    key={month}
                    className="flex justify-between items-center rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3"
                  >
                    <span className="font-semibold">{month}</span>
                    <span className="font-extrabold">{rate}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mt-6 p-6 md:p-7 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
        <div className="mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-extrabold text-xl">⚡ Quick actions</h3>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Access management reporting and monitoring tools.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickAction
            to="/analytics"
            icon="📊"
            label="Analytics"
            description="Workforce trends"
            tint="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60"
          />

          <QuickAction
            to="/reports"
            icon="📋"
            label="Reports"
            description="Management reports"
            tint="bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-900/60"
          />

          <QuickAction
            to="/attendance"
            icon="📅"
            label="Attendance"
            description="Monitor attendance"
            tint="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/60"
          />
        </div>
      </Card>
    </div>
  );
}
function InternHome({ user }) {
  const now = new Date();
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);

  const {
    data: stats,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['internHome', user?.id],
    queryFn: async () => {
      const [attResult, ratingsResult] = await Promise.allSettled([
        api
          .get(
            `/attendance/${user.id}/stats?month=${
              now.getMonth() + 1
            }&year=${now.getFullYear()}`
          )
          .then((r) => r.data),
        api.get(`/ratings/${user.id}`).then((r) => r.data),
      ]);

      const att = attResult.status === 'fulfilled' ? attResult.value : null;
      const attError =
        attResult.status === 'rejected' ? attResult.reason : null;

      const ratings =
        ratingsResult.status === 'fulfilled' ? ratingsResult.value : null;
      const ratingsError =
        ratingsResult.status === 'rejected' ? ratingsResult.reason : null;

      return { att, attError, ratings, ratingsError };
    },
    enabled: hydrated && !!accessToken && !!user,
  });

  useRouteInitialLoading(!hydrated || !accessToken || isLoading);

  if (isError) {
    return (
      <ApiErrorState
        error={error}
        title="Failed to load dashboard data"
        fallback="Unable to load your dashboard. Please try again."
        onRetry={refetch}
      />
    );
  }

  const att = stats?.att;
  const attError = stats?.attError;
  const ratings = stats?.ratings;
  const attData = Array.isArray(att) ? att : [];
  const ratingsData = Array.isArray(ratings) ? ratings : [];

  const avg = ratingsData.length
    ? (
        ratingsData.reduce((a, r) => a + r.score, 0) / ratingsData.length
      ).toFixed(1)
    : '—';

  const present = att
    ? attData.find((s) => s.status === 'PRESENT')?.count || 0
    : '—';

  return (
    <div className="text-slate-900 dark:text-white">
      {/* Welcome Header */}
      <div className="mb-7">
        <p className="text-xs md:text-sm uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300 font-extrabold mb-2">
          Intern Dashboard
        </p>

        <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Welcome, {user?.full_name || user?.email}
        </h1>

        <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-2 max-w-2xl">
          Track your attendance, ratings, and important shortcuts from one
          place.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Present this month"
          value={present}
          sub="days"
          icon="📅"
          gradient="from-emerald-400 to-teal-500"
        />

        <StatCard
          label="My avg rating"
          value={ratings !== null ? avg : '—'}
          sub="out of 10"
          icon="⭐"
          gradient="from-amber-400 to-orange-500"
        />

        <StatCard
          label="Total ratings"
          value={ratings !== null ? ratingsData.length : '—'}
          icon="📊"
          gradient="from-indigo-500 to-blue-600"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Attendance Summary */}
        <Card className="p-6 md:p-7 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
          <div className="mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-extrabold text-xl text-slate-900 dark:text-white flex items-center gap-2">
              📅 This month's attendance
            </h3>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Attendance status records for the current month.
            </p>
          </div>

          {attError ? (
            <ApiErrorState
              error={attError}
              title="Failed to load attendance records"
              fallback="Unable to load attendance records. Please try again."
            />
          ) : attData.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-center py-8 px-4">
              <p className="text-slate-800 dark:text-white font-extrabold">
                No records yet
              </p>

              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Attendance records will appear here once available.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {attData.map((s) => (
                <div
                  key={s.status}
                  className="flex justify-between items-center text-sm py-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70"
                >
                  <span className="text-slate-600 dark:text-slate-300 font-semibold">
                    {s.status}
                  </span>

                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {s.count} days
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card className="p-6 md:p-7 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
          <div className="mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-extrabold text-xl text-slate-900 dark:text-white flex items-center gap-2">
              ⚡ Quick actions
            </h3>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Quickly access your daily InternOps tools.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QuickAction
              to="/tasks"
              icon="🎯"
              label="My tasks"
              description="View assignments"
              tint="bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-900/60"
            />

            <QuickAction
              to="/attendance"
              icon="📅"
              label="My attendance"
              description="Track presence"
              tint="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/60"
            />

            <QuickAction
              to="/ratings"
              icon="⭐"
              label="My ratings"
              description="Performance"
              tint="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/60"
            />

            <QuickAction
              to="/profile"
              icon="👤"
              label="My profile"
              description="Account details"
              tint="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);

  const {
    data: me,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEYS.USER_PROFILE,
    queryFn: () => api.get('/users/me').then((r) => r.data),
    enabled: hydrated && !!accessToken,
  });

  if (isError && !user) {
    return (
      <ApiErrorState
        error={error}
        title="Failed to load profile"
        fallback="Unable to load your profile. Please try again."
        onRetry={refetch}
      />
    );
  }

  const u = {
    ...user,
    ...me,
    full_name: me?.full_name || user?.full_name || user?.fullName,
  };

  const role = user?.role;

  if (role === 'MANAGEMENT') {
    return <ManagementHome user={u} />;
  }

  const isManager = ['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN'].includes(role);

  return isManager ? <ManagerHome user={u} /> : <InternHome user={u} />;
}
