import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Star,
  Target,
  Video,
  Bell,
  User,
  Shield,
  FileText,
  BarChart2,
  Download,
  Settings,
  Building,
  ClipboardList,
  Bot,
  LogOut,
  Sun,
  Moon,
  Megaphone,
} from 'lucide-react';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { UserAvatar, ConfirmationModal } from '../components/ui';
import useAuthStore from '../store/auth';
import { QUERY_KEYS } from '../constants/queryKeys';
import { ROLE_LABEL } from '../constants/roles';

const MANAGER_ROLES = ['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN'];
const ADMIN_AND_SENIOR_TL_ROLES = ['ADMIN', 'SENIOR_TL'];
const ADMIN_ONLY_ROLES = ['ADMIN'];

const nav = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    path: '/team',
    label: 'My Team',
    icon: Users,
    allowedRoles: MANAGER_ROLES,
  },
  { path: '/attendance', label: 'Attendance', icon: CalendarCheck },
  { path: '/ratings', label: 'Ratings', icon: Star },
  { path: '/tasks', label: 'Tasks', icon: Target },
  { path: '/meetings', label: 'Meetings', icon: Video },
  { path: '/notifications', label: 'Notifications', icon: Bell },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/sessions', label: 'Sessions', icon: Shield },
  {
    path: '/reports',
    label: 'Reports',
    icon: FileText,
    allowedRoles: ADMIN_AND_SENIOR_TL_ROLES,
  },
  {
    path: '/analytics',
    label: 'Analytics',
    icon: BarChart2,
    allowedRoles: ADMIN_AND_SENIOR_TL_ROLES,
  },
  {
    path: '/exports',
    label: 'Exports',
    icon: Download,
    allowedRoles: ADMIN_AND_SENIOR_TL_ROLES,
  },
  {
    path: '/notices',
    label: 'Notice Board',
    icon: Megaphone,
    allowedRoles: ADMIN_AND_SENIOR_TL_ROLES,
  },
];

const adminNav = [
  {
    path: '/admin',
    label: 'Users',
    icon: Settings,
    allowedRoles: ADMIN_ONLY_ROLES,
  },
  {
    path: '/departments',
    label: 'Departments',
    icon: Building,
    allowedRoles: ADMIN_ONLY_ROLES,
  },
  {
    path: '/audit',
    label: 'Audit Log',
    icon: ClipboardList,
    allowedRoles: ADMIN_ONLY_ROLES,
  },
  {
    path: '/assistant',
    label: 'AI Assistant',
    icon: Bot,
    allowedRoles: ADMIN_ONLY_ROLES,
  },
];

const FULL_LOGO_SRC = '/UptoSkills.webp';
const MINI_LOGO_SRC = '/Uptoskills_log_fevicon.png';

function canShowNavItem(item, role) {
  if (!item.allowedRoles) return true;
  return item.allowedRoles.includes(role);
}

export default function DashboardLayout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const role = user?.role;
  const SIDEBAR_KEY = `sidebar_scroll_${window.location.pathname}`;
  const sidebarNavRef = useRef(null);

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar') === 'collapsed'
  );
  const [dark, setDark] = useState(
    () => localStorage.getItem('theme') === 'dark'
  );
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const { data: me } = useQuery({
    queryKey: QUERY_KEYS.USER_PROFILE,
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

  const visibleNav = nav.filter((item) => canShowNavItem(item, role));
  const visibleAdminNav = adminNav.filter((item) => canShowNavItem(item, role));

  const allItems = [...visibleNav, ...visibleAdminNav];

  const current = allItems.find((n) => n.path === loc.pathname) || {
    label: 'Dashboard',
  };

  useEffect(() => {
    const savedScroll = Number(sessionStorage.getItem(SIDEBAR_KEY) || 0);

    requestAnimationFrame(() => {
      if (sidebarNavRef.current) {
        sidebarNavRef.current.scrollTop = savedScroll;
      }
    });
  }, [loc.pathname]);

  const saveSidebarScroll = () => {
    if (sidebarNavRef.current) {
      sessionStorage.setItem(
        SIDEBAR_KEY,
        String(sidebarNavRef.current.scrollTop)
      );
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const NavLink = ({ n }) => {
    const active = loc.pathname === n.path;
    const Icon = n.icon;

    return (
      <Link
        to={n.path}
        title={collapsed ? n.label : undefined}
        onClick={saveSidebarScroll}
        className={`group relative flex items-center gap-3 rounded-2xl text-sm font-bold transition-all duration-200
          ${collapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5'}
          ${
            active
              ? 'bg-white text-indigo-700 shadow-lg shadow-indigo-950/20'
              : 'text-indigo-100/90 hover:bg-white/10 hover:text-white hover:translate-x-1'
          }`}
      >
        <Icon className="w-5 h-5 shrink-0" strokeWidth={active ? 2.5 : 2} />
        {!collapsed && <span className="whitespace-nowrap">{n.label}</span>}
        {!collapsed && active && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600" />
        )}
        {collapsed && active && (
          <span className="absolute right-1.5 w-1.5 h-6 rounded-full bg-white/80" />
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/60 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 text-slate-900 dark:text-white">
      <aside
        className={`${
          collapsed ? 'w-20' : 'w-64'
        } shrink-0 bg-gradient-to-b from-indigo-700 via-indigo-800 to-violet-950 text-white flex flex-col transition-all duration-300 ease-in-out shadow-2xl shadow-indigo-950/20`}
      >
        <div
          className={`p-5 flex items-center ${collapsed ? 'justify-center' : 'justify-start'}`}
        >
          {collapsed ? (
            <div className="w-12 h-12 rounded-2xl bg-white p-2 border border-white/20 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-950/20 overflow-hidden">
              <img
                src={MINI_LOGO_SRC}
                alt="UptoSkills"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-full rounded-3xl bg-white p-3 shadow-xl shadow-indigo-950/20 border border-white/20 overflow-hidden">
              <img
                src={FULL_LOGO_SRC}
                alt="UptoSkills"
                className="w-full h-auto object-contain"
              />
            </div>
          )}
        </div>

        <nav
          ref={sidebarNavRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-3 space-y-1.5 pb-6"
        >
          {visibleNav.map((n) => (
            <NavLink key={n.path} n={n} />
          ))}
          {visibleAdminNav.length > 0 && (
            <>
              {!collapsed && (
                <p className="px-3 pt-5 pb-1.5 text-[11px] uppercase tracking-[0.18em] text-indigo-300/90 font-extrabold">
                  Admin
                </p>
              )}
              {collapsed && (
                <div className="my-3 mx-3 border-t border-white/10" />
              )}
              {visibleAdminNav.map((n) => (
                <NavLink key={n.path} n={n} />
              ))}
            </>
          )}
        </nav>

        <div className="p-3 shrink-0">
          <div
            className={`rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl flex items-center shadow-lg shadow-indigo-950/20 ${collapsed ? 'justify-center p-2.5' : 'gap-3 p-3'}`}
          >
            <UserAvatar
              name={displayName}
              email={user?.email}
              src={avatarUrl}
              text="text-xs"
            />
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold truncate">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-indigo-200 truncate">
                    {ROLE_LABEL[role] || role}
                  </p>
                </div>
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  title="Logout"
                  className="w-9 h-9 rounded-2xl text-indigo-200 hover:text-white hover:bg-white/10 flex items-center justify-center transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-sm dark:shadow-none">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="w-10 h-10 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition font-extrabold"
            >
              {collapsed ? '»' : '«'}
            </button>
            <div className="hidden sm:block">
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                Current page
              </p>
              <p className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                {current.label}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDark((d) => !d)}
              className="w-10 h-10 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition text-slate-600 dark:text-slate-300"
            >
              {dark ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
            <Link
              to="/notifications"
              onClick={saveSidebarScroll}
              className="w-10 h-10 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition"
            >
              <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </Link>
            <Link
              to="/profile"
              onClick={saveSidebarScroll}
              className="rounded-full hover:scale-105 transition"
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
        <main className="flex-1 overflow-auto p-5 sm:p-6">
          <Outlet />
        </main>
      </div>

      <ConfirmationModal
        open={showLogoutConfirm}
        title="Confirm Logout"
        message="Are you sure you want to log out?"
        confirmText="Logout"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
        danger={true}
      />
    </div>
  );
}
