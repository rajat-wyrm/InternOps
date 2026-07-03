import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../lib/axios';
import useAuthStore from '../store/auth';
import { QUERY_KEYS } from '../constants/queryKeys';
import { Card, StatCard } from '../components/ui';

const ROLE_LABEL = {
  ADMIN: 'Admin',
  SENIOR_TL: 'Senior TL',
  TL: 'TL',
  CAPTAIN: 'Captain',
  INTERN: 'Intern',
};

function attendancePct(m) {
  const total = Number(m.attendance_total) || 0;
  if (!total) return null;

  const score = Number(m.present_count) + Number(m.half_day_count) * 0.5;
  return Math.round((score / total) * 100);
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
  const {
    data: team = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: QUERY_KEYS.TEAM_MEMBERS,
    queryFn: () => api.get('/team/members').then((res) => res.data),
  });

  if (isLoading) {
    return (
      <p className="text-slate-600 dark:text-slate-300">Loading dashboard...</p>
    );
  }

  if (isError) {
    return (
      <p className="text-red-500 dark:text-red-400">
        Failed to load dashboard data.
      </p>
    );
  }

  const active = team.filter(
    (m) => !m.suspended && (m.internship_status || 'ACTIVE') === 'ACTIVE'
  ).length;

  const pcts = team.map(attendancePct).filter((p) => p !== null);

  const avgAtt = pcts.length
    ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
    : null;

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
    <div className="animate-fade-in-up text-slate-900 dark:text-white">
      {/* Welcome Header */}
      <div className="mb-7">
        <p className="text-xs md:text-sm uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300 font-extrabold mb-2">
          {ROLE_LABEL[user?.role]} Dashboard
        </p>

        <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Welcome, {user?.fullName || user?.email}
        </h1>

        <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-2 max-w-2xl">
          Here is a quick overview of your team activity, performance, and
          pending actions.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Team members"
          value={team.length}
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
              to="/team"
              className="text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:underline shrink-0"
            >
              View team →
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

function InternHome({ user }) {
  const now = new Date();

  const {
    data: stats,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['internHome', user?.id],
    queryFn: async () => {
      const [att, ratings] = await Promise.all([
        api
          .get(
            `/attendance/${user.id}/stats?month=${
              now.getMonth() + 1
            }&year=${now.getFullYear()}`
          )
          .then((r) => r.data),
        api.get(`/ratings/${user.id}`).then((r) => r.data),
      ]);

      return { att, ratings };
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <p className="text-slate-600 dark:text-slate-300">Loading dashboard...</p>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-200 p-4 rounded-2xl border border-red-200 dark:border-red-900/60">
        Failed to load your dashboard data. Please refresh or contact your
        manager.
      </div>
    );
  }

  const att = stats?.att || [];
  const ratings = stats?.ratings || [];

  const avg = ratings.length
    ? (ratings.reduce((a, r) => a + r.score, 0) / ratings.length).toFixed(1)
    : '—';

  const present = att.find((s) => s.status === 'PRESENT')?.count || 0;

  return (
    <div className="animate-fade-in-up text-slate-900 dark:text-white">
      {/* Welcome Header */}
      <div className="mb-7">
        <p className="text-xs md:text-sm uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300 font-extrabold mb-2">
          Intern Dashboard
        </p>

        <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Welcome, {user?.fullName || user?.email}
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
          value={avg}
          sub="out of 10"
          icon="⭐"
          gradient="from-amber-400 to-orange-500"
        />

        <StatCard
          label="Total ratings"
          value={ratings.length}
          icon="📊"
          gradient="from-indigo-500 to-blue-600"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Attendance Summary */}
        <Card className="p-6 md:p-7 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
          <div className="mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-extrabold text-xl text-slate-900 dark:text-white flex items-center gap-2">
              📅 This month&apos;s attendance
            </h3>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Attendance status records for the current month.
            </p>
          </div>

          {att.length === 0 ? (
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
              {att.map((s) => (
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

  const { data: me } = useQuery({
    queryKey: QUERY_KEYS.USER_PROFILE,
    queryFn: () => api.get('/users/me').then((r) => r.data),
  });

  const u = { ...user, fullName: me?.full_name || user?.fullName };

  const isManager = ['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN'].includes(
    user?.role
  );

  return isManager ? <ManagerHome user={u} /> : <InternHome user={u} />;
}
