import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  BriefcaseBusiness,
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
  Award,
  Layers,
  Palette,
  Sparkles,
  Zap,
  ToggleRight,
  GitPullRequest,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { resolveUploadUrl } from '../lib/uploadUrl';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { UserAvatar, ConfirmationModal } from '../components/ui';
import useAuthStore from '../store/auth';
import useFeatureFlagsStore from '../store/featureFlags';
import { QUERY_KEYS } from '../constants/queryKeys';
import { ROLE_LABEL } from '../constants/roles';
import FloatingChatbot from '../components/FloatingChatbot';

const MANAGER_ROLES = ['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN'];
const ADMIN_AND_SENIOR_TL_ROLES = ['ADMIN', 'SENIOR_TL'];
const ADMIN_ONLY_ROLES = ['ADMIN'];
const DIRECTORY_ROLES = ['ADMIN', 'SENIOR_TL', 'TL'];

const nav = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    path: '/team',
    label: 'My Team',
    icon: Users,
    allowedRoles: MANAGER_ROLES,
  },
  {
    path: '/analytics',
    label: 'Analytics',
    icon: BarChart2,
    allowedRoles: ADMIN_AND_SENIOR_TL_ROLES,
    featureFlag: 'ADVANCED_ANALYTICS',
  },
  {
    path: '/hr',
    label: 'HR',
    icon: BriefcaseBusiness,
    allowedRoles: ADMIN_ONLY_ROLES,
  },
  {
    path: '/attendance',
    label: 'Attendance',
    icon: CalendarCheck,
    excludedRoles: ADMIN_ONLY_ROLES,
  },
  {
    path: '/ratings',
    label: 'Ratings',
    icon: Star,
    excludedRoles: ADMIN_ONLY_ROLES,
  },
  { path: '/tasks', label: 'Tasks', icon: Target },
  {
    path: '/meetings',
    label: 'Meetings',
    icon: Video,
    excludedRoles: ADMIN_ONLY_ROLES,
  },
  { path: '/notifications', label: 'Notifications', icon: Bell },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/sessions', label: 'Sessions', icon: Shield },
  {
    path: '/internops',
    label: 'InternOps',
    icon: Building,
    allowedRoles: ADMIN_AND_SENIOR_TL_ROLES,
  },
  {
    path: '/reports',
    label: 'Reports',
    icon: FileText,
    allowedRoles: ADMIN_AND_SENIOR_TL_ROLES,
  },
  {
    path: '/report-templates',
    label: 'Report Templates',
    icon: FileText,
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
    allowedRoles: DIRECTORY_ROLES,
  },
  {
    path: '/departments',
    label: 'Departments',
    icon: Building,
    allowedRoles: DIRECTORY_ROLES,
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
  {
    path: '/quick-generate',
    label: 'Quick Generate',
    icon: Zap,
    allowedRoles: ADMIN_ONLY_ROLES,
  },
  {
    path: '/certificates',
    label: 'Certificates',
    icon: Award,
    allowedRoles: ADMIN_ONLY_ROLES,
  },
  {
    path: '/bulk-generate',
    label: 'Bulk Generate',
    icon: Layers,
    allowedRoles: ADMIN_ONLY_ROLES,
  },
  {
    path: '/canva-templates',
    label: 'Templates & Canva',
    icon: Palette,
    allowedRoles: ADMIN_ONLY_ROLES,
    featureFlag: 'CANVA_INTEGRATION',
  },
  {
    path: '/ai-certificates',
    label: 'AI Certificates',
    icon: Sparkles,
    allowedRoles: ADMIN_ONLY_ROLES,
    featureFlag: 'AI_CERT_GENERATOR',
  },
  {
    path: '/feature-flags',
    label: 'Feature Flags',
    icon: ToggleRight,
    allowedRoles: ADMIN_ONLY_ROLES,
  },
  {
    path: '/github-sync',
    label: 'GitHub Sync',
    icon: GitPullRequest,
    allowedRoles: ADMIN_ONLY_ROLES,
    featureFlag: 'GITHUB_ISSUE_SYNC',
  },
];

const FULL_LOGO_SRC = '/UptoSkills.webp';
const MINI_LOGO_SRC = '/Uptoskills_log_fevicon.png';

function canShowNavItem(item, role, flags) {
  if (item.excludedRoles && item.excludedRoles.includes(role)) return false;
  if (!item.allowedRoles) {
    if (item.featureFlag) return flags[item.featureFlag] === true;
    return true;
  }
  if (!item.allowedRoles.includes(role)) return false;
  if (item.featureFlag) return flags[item.featureFlag] === true;
  return true;
}

const NavLink = memo(({ n, active, collapsed, onLinkClick }) => {
  const Icon = n.icon;

  return (
    <Link
      to={n.path}
      title={collapsed ? n.label : undefined}
      aria-label={n.label}
      onClick={onLinkClick}
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
});
NavLink.displayName = 'NavLink';

export default function DashboardLayout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken || user?.mustChangePassword) return undefined;

    const socket = connectSocket(accessToken);

    const handleNotificationReceived = (payload) => {
      if (typeof payload?.unreadCount === 'number') {
        queryClient.setQueryData(['notifications', 'unread-count'], {
          unread: payload.unreadCount,
        });
      }

      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'notifications' &&
          query.queryKey[1] !== 'unread-count',
      });
    };

    socket?.on('notification-received', handleNotificationReceived);

    return () => {
      socket?.off('notification-received', handleNotificationReceived);
      disconnectSocket();
    };
  }, [accessToken, queryClient, user?.mustChangePassword]);

  const role = user?.role;
  const flags = useFeatureFlagsStore((s) => s.flags);
  const SIDEBAR_KEY = 'sidebar_scroll';
  const sidebarNavRef = useRef(null);

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar') === 'collapsed'
  );
  const [dark, setDark] = useState(
    () => localStorage.getItem('theme') === 'dark'
  );
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: me } = useQuery({
    queryKey: QUERY_KEYS.USER_PROFILE,
    queryFn: () => api.get('/users/me').then((r) => r.data),
  });
  const isDepartmentScopedRole = ['SENIOR_TL', 'TL'].includes(role);
  const { data: scopedDepartments = [] } = useQuery({
    queryKey: ['departments', 'sidebar', role],
    queryFn: () => api.get('/departments').then((r) => r.data || []),
    enabled: isDepartmentScopedRole && !user?.mustChangePassword,
  });
  const assignedDepartment = scopedDepartments[0] || null;
  const departmentLabelStorageKey = user?.id
    ? `sidebar-department-label:${user.id}`
    : null;
  const storedDepartmentLabel = departmentLabelStorageKey
    ? localStorage.getItem(departmentLabelStorageKey)
    : null;

  useEffect(() => {
    if (departmentLabelStorageKey && assignedDepartment?.name) {
      localStorage.setItem(
        departmentLabelStorageKey,
        `${assignedDepartment.name} Department`
      );
    }
  }, [assignedDepartment?.name, departmentLabelStorageKey]);

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get('/notifications/unread-count').then((r) => r.data),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    enabled: !!user && !user?.mustChangePassword,
  });

  const unreadCount = unreadData?.unread || 0;

  const displayName = me?.full_name || user?.fullName || user?.email;
  const avatarUrl = resolveUploadUrl(
    me?.avatar_url || (role === 'ADMIN' ? '/admin-default-avatar.svg' : null)
  );

  useEffect(() => {
    localStorage.setItem('sidebar', collapsed ? 'collapsed' : 'open');
  }, [collapsed]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const visibleNav = useMemo(
    () => nav.filter((item) => canShowNavItem(item, role, flags)),
    [role, flags]
  );

  const visibleAdminNav = useMemo(
    () =>
      adminNav
        .filter((item) => canShowNavItem(item, role, flags))
        .map((item) => {
          if (item.path !== '/departments' || !isDepartmentScopedRole) {
            return item;
          }

          return {
            ...item,
            path: assignedDepartment?.id
              ? `/departments/${assignedDepartment.id}/projects`
              : '/departments',
            label: assignedDepartment?.name
              ? `${assignedDepartment.name} Department`
              : storedDepartmentLabel || 'Department',
          };
        }),
    [
      assignedDepartment,
      flags,
      isDepartmentScopedRole,
      role,
      storedDepartmentLabel,
    ]
  );

  const allItems = [...visibleNav, ...visibleAdminNav];

  const isProjectDetailRoute = /^\/departments\/[^/]+\/projects\/[^/]+$/.test(
    loc.pathname
  );
  const departmentProjectsMatch = loc.pathname.match(
    /^\/departments\/([^/]+)\/projects$/
  );
  const current = (() => {
    if (isProjectDetailRoute) return { label: 'Project Detail' };

    if (departmentProjectsMatch) {
      return {
        label:
          allItems.find(
            (item) =>
              item.path ===
              `/departments/${departmentProjectsMatch[1]}/projects`
          )?.label || 'Department',
      };
    }

    const nestedDepartmentPageMatch = loc.pathname.match(
      /^\/admin\/departments\/[^/]+\/(attendance|ratings|tasks)$/
    );

    if (nestedDepartmentPageMatch) {
      return {
        label:
          nestedDepartmentPageMatch[1].charAt(0).toUpperCase() +
          nestedDepartmentPageMatch[1].slice(1),
      };
    }

    return (
      allItems.find(
        (n) =>
          n.path === loc.pathname ||
          (n.path !== '/' && loc.pathname.startsWith(`${n.path}/`))
      ) || { label: 'Dashboard' }
    );
  })();

  useEffect(() => {
    const savedScroll = Number(sessionStorage.getItem(SIDEBAR_KEY) || 0);

    requestAnimationFrame(() => {
      if (sidebarNavRef.current) {
        sidebarNavRef.current.scrollTop = savedScroll;
      }
    });
  }, [loc.pathname]);

  const saveSidebarScroll = useCallback(() => {
    if (sidebarNavRef.current) {
      sessionStorage.setItem(
        SIDEBAR_KEY,
        String(sidebarNavRef.current.scrollTop)
      );
    }
    setMobileOpen(false);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/60 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 text-slate-900 dark:text-white">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          bg-gradient-to-b from-indigo-700 via-indigo-800 to-violet-950
          text-white shadow-2xl shadow-indigo-950/20
          transition-all duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0 md:inset-auto md:z-auto
          ${collapsed ? 'w-20' : 'w-64'}
          shrink-0
        `}
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
            <NavLink
              key={n.path}
              n={n}
              active={loc.pathname === n.path}
              collapsed={collapsed}
              onLinkClick={saveSidebarScroll}
            />
          ))}
          {visibleAdminNav.length > 0 && (
            <>
              {!collapsed && (
                <p className="px-3 pt-5 pb-1.5 text-[11px] uppercase tracking-[0.18em] text-indigo-300/90 font-extrabold">
                  {role === 'ADMIN' ? 'ADMIN' : 'MANAGEMENT'}
                </p>
              )}
              {collapsed && (
                <div className="my-3 mx-3 border-t border-white/10" />
              )}
              {visibleAdminNav.map((n) => {
                const isDeptNav =
                  n.path === '/departments' ||
                  /^\/departments\/[^/]+\/projects$/.test(n.path);
                const deptMatch = loc.pathname.match(
                  /\/(?:admin\/)?departments\/([^/]+)/
                );
                const activeDeptId = deptMatch ? deptMatch[1] : null;

                return (
                  <div key={n.path} className="space-y-1">
                    <NavLink
                      n={n}
                      active={
                        loc.pathname === n.path ||
                        (isDeptNav &&
                          /^\/(?:admin\/)?departments\/[^/]+/.test(
                            loc.pathname
                          ))
                      }
                      collapsed={collapsed}
                      onLinkClick={saveSidebarScroll}
                    />
                    {isDeptNav && activeDeptId && (
                      <div
                        className={`space-y-1 ${collapsed ? 'pl-0' : 'pl-4'} animate-fade-in`}
                      >
                        <Link
                          to={`/admin/departments/${activeDeptId}/attendance`}
                          className={`flex items-center gap-2 rounded-xl text-xs font-bold transition-all py-2 ${
                            collapsed ? 'justify-center px-0' : 'px-3'
                          } ${
                            loc.pathname.includes('/attendance')
                              ? 'bg-white/20 text-white shadow-sm'
                              : 'text-indigo-200/80 hover:bg-white/10 hover:text-white'
                          }`}
                          title="Department Attendance"
                          onClick={saveSidebarScroll}
                        >
                          <CalendarCheck className="w-4 h-4 shrink-0" />
                          {!collapsed && <span>Attendance</span>}
                        </Link>

                        <Link
                          to={`/admin/departments/${activeDeptId}/ratings`}
                          className={`flex items-center gap-2 rounded-xl text-xs font-bold transition-all py-2 ${
                            collapsed ? 'justify-center px-0' : 'px-3'
                          } ${
                            loc.pathname.includes('/ratings')
                              ? 'bg-white/20 text-white shadow-sm'
                              : 'text-indigo-200/80 hover:bg-white/10 hover:text-white'
                          }`}
                          title="Department Ratings"
                          onClick={saveSidebarScroll}
                        >
                          <Star className="w-4 h-4 shrink-0" />
                          {!collapsed && <span>Ratings</span>}
                        </Link>

                        <Link
                          to={`/admin/departments/${activeDeptId}/tasks`}
                          className={`flex items-center gap-2 rounded-xl text-xs font-bold transition-all py-2 ${
                            collapsed ? 'justify-center px-0' : 'px-3'
                          } ${
                            loc.pathname.includes('/tasks')
                              ? 'bg-white/20 text-white shadow-sm'
                              : 'text-indigo-200/80 hover:bg-white/10 hover:text-white'
                          }`}
                          title="Department Tasks"
                          onClick={saveSidebarScroll}
                        >
                          <Target className="w-4 h-4 shrink-0" />
                          {!collapsed && <span>Tasks</span>}
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
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
        {/* Mobile close button */}
        <button
          className="absolute top-4 right-4 md:hidden w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
          onClick={() => setMobileOpen(false)}
          aria-label="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-sm dark:shadow-none">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              className="md:hidden w-10 h-10 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition"
              onClick={() => setMobileOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* Desktop collapse toggle */}
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="hidden md:flex w-10 h-10 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 items-center justify-center text-slate-600 dark:text-slate-300 transition font-extrabold"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <PanelLeftOpen className="w-5 h-5" />
              ) : (
                <PanelLeftClose className="w-5 h-5" />
              )}
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
              aria-label={
                unreadCount > 0
                  ? `Notifications (${unreadCount} unread)`
                  : 'Notifications'
              }
              title="Notifications"
              className="w-10 h-10 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition"
            >
              <div className="relative">
                <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center text-[9px] font-extrabold text-white bg-red-500 rounded-full border border-white dark:border-slate-900 select-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
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
      {loc.pathname !== '/profile' && <FloatingChatbot />}
    </div>
  );
}
