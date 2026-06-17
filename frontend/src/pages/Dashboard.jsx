import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Link,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import api from '../lib/axios';
import { UserAvatar } from '../components/ui';
import Home from './Home';
import Team from './Team';
import Attendance from './Attendance';
import Ratings from './Ratings';
import Tasks from './Tasks';
import Meetings from './Meetings';
import Notifications from './Notifications';
import Profile from './Profile';
import Sessions from './Sessions';
import Reports from './admin/Reports';
import Analytics from './admin/Analytics';
import AdminDashboard from './admin/AdminDashboard';
import AuditLog from './admin/AuditLog';
import Exports from './admin/Exports';
import Departments from './admin/Departments';
import useAuthStore from '../store/auth';
import InternOpsAssistant from '../components/InternOpsAssistant';

const ROLE_LABEL = {
  ADMIN: 'Admin',
  SENIOR_TL: 'Senior TL',
  TL: 'Team Lead',
  CAPTAIN: 'Captain',
  INTERN: 'Intern',
};

const nav = [
  { path: '/', label: 'Dashboard', icon: '🏠' },
  { path: '/team', label: 'My Team', icon: '👥', managerOnly: true },
  { path: '/attendance', label: 'Attendance', icon: '📅' },
  { path: '/ratings', label: 'Ratings', icon: '⭐' },
  { path: '/tasks', label: 'Tasks', icon: '🎯' },
  { path: '/meetings', label: 'Meetings', icon: '📹' },
  { path: '/notifications', label: 'Notifications', icon: '🔔' },
  { path: '/profile', label: 'Profile', icon: '👤' },
  { path: '/sessions', label: 'Sessions', icon: '🔐' },
  { path: '/reports', label: 'Reports', icon: '📈', roles: ['ADMIN','SENIOR_TL'] },
];

const adminNav = [
  { path: '/admin', label: 'Admin Panel', icon: '🛡️' },
  { path: '/departments', label: 'Departments', icon: '🏢' },
  { path: '/analytics', label: 'Analytics', icon: '📊' },
  { path: '/audit', label: 'Audit Log', icon: '🧾' },
  { path: '/exports', label: 'Exports', icon: '⬇️' },
  { path: '/assistant', label: 'AI Assistant', icon: '🤖' },
];

function initials(u) {
  const n = (u?.fullName || u?.email || '?').trim();
  return n
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

export default function Dashboard() {
  const loc = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const role = user?.role;
  const isAdmin = role === 'ADMIN';
  const isManager = ['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN'].includes(role);

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar') === 'collapsed'
  );
  const [dark, setDark] = useState(
    () => localStorage.getItem('theme') === 'dark'
  );

  // Live profile so name + avatar update everywhere right after editing.
  const { data: me } = useQuery({
    queryKey: ['myProfile'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
  });
  const displayName = me?.full_name || user?.fullName || user?.email;
  const avatarUrl = me?.avatar_url || null;

  useEffect(() => {
    localStorage.setItem('sidebar', collapsed ? 'collapsed' : 'open');
  }, [collapsed]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const visibleNav = nav.filter((n) => {
  if (n.managerOnly && !isManager) return false;
  if (n.roles && !n.roles.includes(role)) return false;
  return true;
  });

  const allItems = [...visibleNav, ...(isAdmin ? adminNav : [])];
  const current = allItems.find((n) => n.path === loc.pathname) || {
    label: 'Dashboard',
    icon: '🏠',
  };

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const NavLink = ({ n }) => {
    const active = loc.pathname === n.path;
    return (
      <Link
        to={n.path}
        title={collapsed ? n.label : undefined}
        className={`group flex items-center gap-3 rounded-xl text-sm font-medium transition-all
          ${collapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5'}
          ${active ? 'bg-white text-indigo-700 shadow-lg shadow-indigo-900/20' : 'text-indigo-100 hover:bg-white/10 hover:translate-x-1'}`}
      >
        <span className="text-lg">{n.icon}</span>
        {!collapsed && <span className="whitespace-nowrap">{n.label}</span>}
        {!collapsed && active && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600" />
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-indigo-50/50">
      {/* Sidebar */}
      <aside
        className={`${collapsed ? 'w-20' : 'w-64'} shrink-0 bg-gradient-to-b from-indigo-700 via-indigo-800 to-purple-900 text-white flex flex-col transition-all duration-300 ease-in-out`}
      >
        <div
          className={`p-5 flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}
        >
          <div className="w-10 h-10 rounded-xl bg-white/20 glass flex items-center justify-center text-xl shrink-0">
            ⚡
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h2 className="text-lg font-extrabold leading-none whitespace-nowrap">
                InternOps
              </h2>
              <p className="text-[10px] text-indigo-200 mt-0.5 whitespace-nowrap">
                Workforce Platform
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 space-y-1">
          {visibleNav.map((n) => (
            <NavLink key={n.path} n={n} />
          ))}
          {isAdmin && (
            <>
              {!collapsed && (
                <p className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider text-indigo-300">
                  Admin
                </p>
              )}
              {collapsed && (
                <div className="my-2 mx-3 border-t border-white/10" />
              )}
              {adminNav.map((n) => (
                <NavLink key={n.path} n={n} />
              ))}
            </>
          )}
        </nav>

        {/* User card */}
        <div className="p-3">
          <div
            className={`glass rounded-2xl border border-white/10 flex items-center ${collapsed ? 'justify-center p-2' : 'gap-3 p-3'}`}
          >
            <UserAvatar
              name={displayName}
              email={user?.email}
              src={avatarUrl}
            />
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  <p className="text-[10px] text-indigo-200">
                    {ROLE_LABEL[role] || role}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="text-indigo-200 hover:text-white hover:scale-110 transition"
                >
                  ⏻
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white/80 backdrop-blur border-b border-gray-100 flex items-center justify-between px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCollapsed((c) => !c)}
              title="Toggle sidebar"
              className="w-9 h-9 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 flex items-center justify-center text-gray-600 transition"
            >
              {collapsed ? '»' : '«'}
            </button>
            <span className="text-xl">{current.icon}</span>
            <h1 className="text-lg font-bold text-gray-800">{current.label}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDark((d) => !d)}
              title={dark ? 'Light mode' : 'Dark mode'}
              className="w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 flex items-center justify-center transition text-lg"
            >
              {dark ? '☀️' : '🌙'}
            </button>
            <Link
              to="/notifications"
              className="w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 flex items-center justify-center transition"
            >
              🔔
            </Link>
            <Link
              to="/profile"
              className="rounded-full hover:scale-105 transition"
              title={displayName}
            >
              <UserAvatar
                name={displayName}
                email={user?.email}
                src={avatarUrl}
                text="text-xs"
              />
            </Link>
          </div>
        </header>

        {/* Content */}
        <main
          key={loc.pathname}
          className="flex-1 overflow-auto animate-fade-in-up"
        >
          <Routes>
            <Route
              index
              element={
                <div className="p-6">
                  <Home />
                </div>
              }
            />
            {isManager && <Route path="team" element={<Team />} />}
            <Route path="attendance" element={<Attendance />} />
            <Route path="ratings" element={<Ratings />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="meetings" element={<Meetings />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile" element={<Profile />} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="reports" element={<Reports />} />
            <Route path="assistant" element={<InternOpsAssistant />} />
            {isAdmin && (
              <>
                <Route path="admin" element={<AdminDashboard />} />
                <Route path="departments" element={<Departments />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="audit" element={<AuditLog />} />
                <Route path="exports" element={<Exports />} />
              </>
            )}
          </Routes>
        </main>
      </div>
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fade-in">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full mx-4 border border-gray-100 animate-scale-up">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl mb-4">
                🚪
              </div>
              <h3 className="text-lg font-bold text-gray-950 mb-2">
                Confirm Logout
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to log out?
              </p>

              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    logout();
                    navigate('/login');
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white text-sm font-semibold shadow-lg shadow-red-200 transition active:scale-95"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
