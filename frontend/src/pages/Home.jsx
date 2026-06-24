import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../lib/axios';
import useAuthStore from '../store/auth';
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

function QuickAction({ to, icon, label, tint }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5 hover:shadow-md ${tint}`}
    >
      <span className="text-lg">{icon}</span>
      {label}
    </Link>
  );
}

function ManagerHome({ user }) {
  const {
    data: team = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => api.get('/team/members').then((res) => res.data),
  });

  if (isLoading) return <p className="text-gray-300">Loading dashboard...</p>;

  if (isError) {
    return <p className="text-red-400">Failed to load dashboard data.</p>;
  }

  if (isLoading) return <p className="text-gray-500">Loading dashboard...</p>;

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
    <div className="min-h-screen bg-white-900 text-white p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-white">
          Welcome, {user?.fullName || user?.email} 👋
        </h1>
        <p className="text-gray-300">
          {ROLE_LABEL[user?.role]} dashboard · here's your team at a glance
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Team members"
          value={team.length}
          icon="👥"
          gradient="from-indigo-400 to-blue-500"
        />
        <StatCard
          label="Active"
          value={active}
          icon="✅"
          gradient="from-emerald-400 to-green-500"
        />
        <StatCard
          label="Avg attendance"
          value={avgAtt === null ? '—' : `${avgAtt}%`}
          icon="📅"
          gradient="from-sky-400 to-cyan-500"
        />
        <StatCard
          label="Avg rating"
          value={avgRating}
          sub="out of 5"
          icon="⭐"
          gradient="from-amber-400 to-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white flex items-center gap-2">
              ⚠️ Needs attention
            </h3>
            <Link
              to="/team"
              className="text-indigo-600 text-sm font-medium hover:underline"
            >
              View team →
            </Link>
          </div>
          {lowAttendance.length === 0 ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-2 animate-float inline-block">🎉</div>
              <p className="text-gray-300 text-sm">
                Everyone is above 60% attendance.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowAttendance.slice(0, 5).map((m) => (
                <div
                  key={m.id}
                  className="flex justify-between items-center text-sm bg-rose-900/20 rounded-lg px-3 py-2"
                >
                  <span className="text-gray-200">
                    {m.full_name || m.email}
                  </span>
                  <span className="text-rose-600 font-semibold">
                    {attendancePct(m)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            ⚡ Quick actions
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <QuickAction
              to="/team"
              icon="👥"
              label="Manage team"
              tint="bg-indigo-900/20 text-indigo-300 border border-indigo-900/30"
            />
            <QuickAction
              to="/attendance"
              icon="📅"
              label="Mark attendance"
              tint="bg-emerald-900/20 text-emerald-300 border border-emerald-900/30"
            />
            <QuickAction
              to="/ratings"
              icon="⭐"
              label="Rate members"
              tint="bg-amber-900/20 text-amber-300 border border-amber-900/30"
            />
            <QuickAction
              to="/tasks"
              icon="🎯"
              label="Social tasks"
              tint="bg-purple-900/20 text-purple-300 border border-purple-900/30"
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
            `/attendance/${user.id}/stats?month=${now.getMonth() + 1}&year=${now.getFullYear()}`
          )
          .then((r) => r.data),
        api.get(`/ratings/${user.id}`).then((r) => r.data),
      ]);
      return { att, ratings };
    },
    enabled: !!user,
  });

  if (isLoading) return <p className="text-gray-500">Loading dashboard...</p>;

  if (isError) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-xl">
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
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-white">
          Welcome, {user?.fullName || user?.email} 👋
        </h1>
        <p className="text-gray-300">Intern dashboard</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Present this month"
          value={present}
          sub="days"
          icon="📅"
          gradient="from-emerald-400 to-green-500"
        />
        <StatCard
          label="My avg rating"
          value={avg}
          sub="out of 5"
          icon="⭐"
          gradient="from-amber-400 to-orange-500"
        />
        <StatCard
          label="Total ratings"
          value={ratings.length}
          icon="📊"
          gradient="from-indigo-400 to-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            📅 This month's attendance
          </h3>
          {att.length === 0 ? (
            <p className="text-gray-300 text-sm">No records yet.</p>
          ) : (
            att.map((s) => (
              <div
                key={s.status}
                className="flex justify-between text-sm py-1.5 border-b border-gray-50 last:border-0"
              >
                <span className="text-gray-300">{s.status}</span>
                <span className="font-semibold text-white">{s.count} days</span>
              </div>
            ))
          )}
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            ⚡ Quick actions
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <QuickAction
              to="/tasks"
              icon="🎯"
              label="My tasks"
              tint="bg-purple-900/20 text-purple-300 border border-purple-900/30"
            />
            <QuickAction
              to="/attendance"
              icon="📅"
              label="My attendance"
              tint="bg-emerald-900/20 text-emerald-300 border border-emerald-900/30"
            />
            <QuickAction
              to="/ratings"
              icon="⭐"
              label="My ratings"
              tint="bg-amber-900/20 text-amber-300 border border-amber-900/30"
            />
            <QuickAction
              to="/profile"
              icon="👤"
              label="My profile"
              tint="bg-indigo-900/20 text-indigo-300 border border-indigo-900/30"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuthStore();
  const { data: me } = useQuery({
    queryKey: ['myProfile'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
  });
  const u = { ...user, fullName: me?.full_name || user?.fullName };
  const isManager = ['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN'].includes(
    user?.role
  );
  return isManager ? <ManagerHome user={u} /> : <InternHome user={u} />;
}
