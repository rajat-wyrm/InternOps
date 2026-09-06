import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file) =>
  fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
const app = read('src/App.jsx');
const skeleton = read('src/components/loading/RouteRefreshSkeleton.jsx');
const login = read('src/pages/Login.jsx');
const guard = read('src/components/RoleGuard.jsx');

describe('refresh loading and route preservation contract', () => {
  it('uses the full branded loader only when no cached user exists', () => {
    expect(app).toContain('if (!hydrated && !useAuthStore.getState().user)');
    expect(app).not.toContain('if (!hydrated && useAuthStore.getState().user)');
    expect(app).not.toContain(
      'DashboardLayout content={<RouteRefreshSkeleton />}'
    );
    expect(app).toContain('return user ? children : null;');
    expect(app).toContain('Loading InternOps');
  });

  it('shows a content-only skeleton and delayed slow-loading message', () => {
    expect(app).not.toContain('<aside className="hidden w-64');
    expect(skeleton).toContain('min-h-[calc(100vh-7rem)]');
    expect(skeleton).toContain('Loading page...');
    expect(skeleton).toContain('This is taking longer than usual...');
    expect(skeleton).toContain('window.setTimeout');
  });

  it('does not render a separate top progress line', () => {
    expect(skeleton).not.toContain('fixed inset-x-0 top-0 z-[100] h-1');
  });

  it('centralizes initial loading for Dashboard, Team, HR, and Profile', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const coordinator = read('src/components/loading/RouteInitialLoading.jsx');
    const pages = [
      read('src/pages/Home.jsx'),
      read('src/pages/Team.jsx'),
      read('src/pages/HR.jsx'),
      read('src/pages/Profile.jsx'),
    ];
    expect(layout).toContain('COORDINATED_LOADING_ROUTES');
    expect(layout).toContain(
      '<RouteInitialLoading animate={shouldAnimateRoute}>'
    );
    expect(coordinator).toContain(
      '{loading ? <RouteRefreshSkeleton /> : null}'
    );
    expect(coordinator).toContain(
      '<Suspense fallback={null}>{children}</Suspense>'
    );
    for (const page of pages) {
      expect(page).toContain('useRouteInitialLoading');
      expect(page).not.toContain('return <RouteRefreshSkeleton />');
    }
  });
  it('covers nested department and role-specific refresh structures', () => {
    expect(skeleton).toContain("'project-detail'");
    expect(skeleton).toContain("'department-projects'");
    expect(skeleton).toContain("'department-attendance'");
    expect(skeleton).toContain("'department-ratings'");
    expect(skeleton).toContain("'department-tasks'");
    expect(skeleton).toMatch(/role\s*===\s*'INTERN'/);
  });
  it('keeps Dashboard skeleton static and uses shared navigation-only motion', () => {
    const dashboard = read('src/pages/Dashboard.jsx');
    const layout = read('src/layouts/DashboardLayout.jsx');
    expect(app).toContain("import Dashboard from './pages/Dashboard';");
    expect(dashboard).toContain('return <Home />;');
    expect(dashboard).not.toContain('animate-fade-in-up');
    expect(layout).toContain('shouldAnimateRoute ?');
    expect(layout).toContain(
      'const shouldAnimateRoute = animatedRoutePath === loc.pathname'
    );
    expect(layout).toContain('setAnimatedRoutePath(loc.pathname)');
    expect(layout).not.toContain("loc.pathname !== '/dashboard'");
  });
  it('keeps Dashboard data loading under the single coordinator skeleton', () => {
    const home = read('src/pages/Home.jsx');
    expect(home.split('useRouteInitialLoading(')).toHaveLength(3);
    expect(home).not.toContain('return <RouteRefreshSkeleton />');
    expect(home).not.toContain('Loading dashboard...');
  });
  it('uses the route skeleton for first-time lazy page loading', () => {
    expect(app).toContain('function PageLoader()');
    expect(app).toContain('return <RouteRefreshSkeleton />;');
    expect(skeleton).toMatch(/return\s+'task-detail'/);
    expect(skeleton).toMatch(/kind\s*===\s*'meetings'/);
    expect(skeleton).toMatch(/kind\s*===\s*'analytics'/);
  });

  it('does not await feature flags before authentication hydration', () => {
    expect(app).toContain('Promise.resolve(fetchFlags())');
    expect(app).not.toContain('await fetchFlags()');
    expect(app).toContain('.finally(() =>');
    expect(app).toContain('setHydrated();');
  });

  it('preserves requested private and role-protected routes for login', () => {
    expect(app).toContain('state={{ from: location }}');
    expect(guard).toContain('state={{ from: location }}');
    expect(guard).toContain('to="/dashboard"');
  });

  it('returns a normal login to the original safe route', () => {
    expect(login).toContain('location.state?.from?.pathname');
    expect(login).toContain("requestedPath.startsWith('/')");
    expect(login).toContain("!requestedPath.startsWith('//')");
    expect(login).toContain(
      "data.user?.mustChangePassword ? '/profile' : safeDestination"
    );
  });

  it('keeps the single boot refresh promise and one Profile route', () => {
    expect(app).toContain('let bootRefreshPromise = null');
    expect(app).toContain('refreshSession()');
    expect(app).not.toContain("api.post('/auth/refresh'");
    expect(app.match(/path="profile"/g)).toHaveLength(1);
  });
  it('keeps Profile hidden behind the centralized skeleton until ready', () => {
    const profile = read('src/pages/Profile.jsx');
    expect(profile).toContain('useRouteInitialLoading(');
    expect(profile).not.toContain('return <RouteRefreshSkeleton />');
    expect(skeleton).toContain('function ProfileSkeleton()');
  });
  it('keeps the public Login route out of the dashboard skeleton fallback', () => {
    expect(app).toContain("import Login from './pages/Login';");
    expect(app).not.toMatch(/const\s+Login\s*=\s*lazy/);
    expect(app).toContain('path="/login" element={<Login />}');
    expect(app).toContain('function PublicLazyPage({ children })');
    expect(app).toContain(
      'return <Suspense fallback={<PageLoader />}>{children}</Suspense>;'
    );
  });
  it('matches the real Dashboard hierarchy and card-specific loading shapes', () => {
    const home = read('src/pages/Home.jsx');
    expect(skeleton).toContain('function DashboardHeading()');
    expect(skeleton).toContain('function DashboardStatSkeleton({ variant })');
    expect(skeleton).toContain('function AttentionRows({ intern })');
    expect(skeleton).toContain('function QuickActionsSkeleton()');
    expect(skeleton).toContain("variant === 'team'");
    expect(skeleton).toContain("variant === 'rating'");
    expect(skeleton).toContain('md:grid-cols-4');
    expect(skeleton).toContain('md:grid-cols-3');
    expect(skeleton).toContain('min-h-[48px]');
    expect(skeleton).toContain('min-h-[102px]');
    expect(home).toContain('grid grid-cols-2 md:grid-cols-4 gap-4 mb-6');
    expect(home).toContain('grid grid-cols-1 sm:grid-cols-2 gap-3');
    expect(home).toContain('lowAttendance.slice(0, 5)');
  });
  it('mirrors the shared StatCard dimensions in the Dashboard skeleton', () => {
    const ui = read('src/components/ui.jsx');
    expect(ui).toContain('p-6 card-hover relative min-h-[150px]');
    expect(ui).toContain('absolute -right-8 -top-8 w-28 h-28');
    expect(ui).toContain('className="pt-6"');
    expect(ui).toContain('w-14 h-14 rounded-2xl');
    expect(skeleton).toContain('min-h-[220px] p-6');
    expect(skeleton).toContain('absolute -right-8 -top-8 h-28 w-28');
    expect(skeleton).toContain('min-w-0 flex-1 pt-6');
    expect(skeleton).toContain('h-14 w-14 shrink-0 rounded-2xl');
    expect(skeleton).not.toContain('min-h-[150px] p-6');
    expect(skeleton).not.toContain('min-h-[192px]');
    expect(skeleton).not.toContain('md:min-h-[210px]');
    expect(skeleton).not.toContain('pt-12 md:pt-14');
    expect(skeleton).toContain('min-h-[48px]');
    expect(skeleton).toContain('min-h-[102px]');
  });
  it('matches the Team header, filters, cards, and layered table context', () => {
    const team = read('src/pages/Team.jsx');
    expect(skeleton).toContain('function TeamHeaderSkeleton()');
    expect(skeleton).toContain('function TeamStatSkeleton({ variant })');
    expect(skeleton).toContain('function TeamTableSkeleton()');
    expect(skeleton).toContain(
      "const teamColumns = '260px 8% 9% 10% 10% 11% 12% 7% 150px 10%'"
    );
    expect(skeleton).toContain('min-h-[190px] p-5');
    expect(skeleton).toContain('min-h-[150px]');
    expect(skeleton).toContain('dark:bg-[#172033]');
    expect(skeleton).toContain('dark:bg-[#1e293b]');
    expect(skeleton).toContain('min-w-[1360px]');
    expect(team).toContain('grid grid-cols-2 md:grid-cols-5 gap-4 mb-6');
    expect(team).toContain('w-[260px] min-w-[260px]');
    expect(team).toContain('dark:bg-[#172033]');
  });
  it('provides the full HR workspace and exact route skeleton', () => {
    const hr = read('src/pages/HR.jsx');
    expect(app).toContain("const HR = lazy(() => import('./pages/HR'))");
    expect(app).toContain("allowedRoles={['ADMIN', 'HR']}");
    expect(skeleton).toContain('function HRSkeleton()');
    expect(skeleton).toContain("kind === 'hr'");
    expect(hr).toContain('api.get(`/hr/dashboard?${params}`)');
    expect(hr).toContain('<HROverviewCards');
    expect(hr).toContain('<HRDirectory');
    expect(hr).toContain("q.isFetching ? 'Refreshing...' : 'Refresh'");
    expect(hr).toContain("q.isFetching ? 'animate-spin' : ''");
    expect(hr).toContain('disabled={q.isFetching}');
    expect(skeleton).toContain('function HRStatSkeleton({ index })');
    expect(skeleton).toContain(
      'function HRBreakdownSkeleton({ milestones = false })'
    );
    expect(skeleton).toContain('p-6 min-h-[174px]');
    expect(skeleton).toContain(
      'grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3'
    );
  });
  it('sorts and paginates the HR directory before rendering rows', () => {
    const hr = read('src/pages/HR.jsx');
    const directory = read('src/components/hr/HRDirectory.jsx');
    expect(directory).toContain('const PAGE_SIZE = 10');
    expect(directory).toContain('SENIOR_TL: 0');
    expect(directory).toContain('TL: 1');
    expect(directory).toContain('CAPTAIN: 2');
    expect(directory).toContain('INTERN: 3');
    expect(directory).toContain('const visibleMembers = sortedMembers.slice');
    expect(directory).toContain('Previous');
    expect(directory).toContain('Page {currentPage} of {totalPages}');
    expect(directory).toContain('Next');
    expect(hr).toContain('resetKey={`${search}|${status}|${issue}`}');
  });
  it('provides the expanded scoped Analytics workspace and exact skeleton', () => {
    const analytics = read('src/pages/admin/Analytics.jsx');
    const workspace = read('src/components/analytics/AnalyticsWorkspace.jsx');
    expect(analytics).toContain('/analytics/workspace?${rangeParams}');
    expect(analytics).toContain('Last 12 months');
    expect(analytics).toContain('section="summary"');
    expect(analytics).toContain('section="distributions"');
    expect(analytics).toContain('section="comparison"');
    expect(analytics).toContain('section="operations"');
    expect(workspace).toContain('Department Comparison');
    expect(workspace).toContain('Task and proof performance');
    expect(workspace).toContain('Lifecycle movement');
    expect(skeleton).toContain('function Analytics()');
    expect(skeleton).toContain('xl:grid-cols-4');
  });
  it('accepts date-only Analytics ranges without UTC conversion', () => {
    const routes = read('../backend/src/modules/analytics/routes.js');
    expect(routes).toContain('.regex(/^\\d{4}-\\d{2}-\\d{2}$/');
    expect(routes).toContain('parsed.toISOString().slice(0, 10) === value');
    expect(routes).toContain('from: parsed.data.from');
    expect(routes).toContain('to: parsed.data.to');
    expect(routes).not.toContain('from: z.coerce.date()');
    expect(routes).not.toContain('parsed.data.from.toISOString()');
  });
  it('unifies Analytics scope, loading, and exact skeleton structure', () => {
    const analytics = read('src/pages/admin/Analytics.jsx');
    const workspace = read('src/components/analytics/AnalyticsWorkspace.jsx');
    expect(analytics.match(/Department scope/g)).toHaveLength(1);
    expect(analytics).toContain(
      "queryKey: ['topPerformers', departmentId, rangeMonths]"
    );
    expect(analytics).toContain(
      "queryKey: ['attendanceTrends', departmentId, rangeMonths]"
    );
    expect(analytics).toContain('placeholderData: (previous) => previous');
    expect(analytics).toContain('AttendancePlaceholder');
    expect(workspace).toContain('Rating records by score');
    expect(skeleton).toContain('lg:h-[520px]');
  });
  it('polishes Analytics semantics, scope refresh, and attendance drill-down', () => {
    const analytics = read('src/pages/admin/Analytics.jsx');
    const workspace = read('src/components/analytics/AnalyticsWorkspace.jsx');
    const repository = read('../backend/src/modules/analytics/repository.js');
    expect(analytics).not.toContain('Refreshing scope...');
    expect(analytics).toContain('aria-label="Updating analytics"');
    expect(analytics).toContain('section="summary"');
    expect(analytics).toContain('section="comparison"');
    expect(analytics).toContain("from: rangeParams.get('from')");
    expect(analytics).toContain('trends.slice(-Number(rangeMonths))');
    expect(workspace).toContain("'No data'");
    expect(workspace).toContain('Selected Department Summary');
    expect(workspace).toContain('No task or proof activity');
    expect(repository).toContain("'9-10'");
    expect(repository).toContain('GREATEST($1::int - 1, 0)');
    expect(skeleton).toContain('lg:h-[520px]');
  });
  it('uses one authenticated loading owner and navigation-only shared page motion', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const dashboard = read('src/pages/Dashboard.jsx');
    const tailwind = read('tailwind.config.js');
    expect(layout).toContain('<Suspense fallback={<RouteRefreshSkeleton />}>');
    expect(layout).toContain('shouldAnimateRoute ?');
    expect(layout).toContain(
      'const shouldAnimateRoute = animatedRoutePath === loc.pathname'
    );
    expect(layout).toContain('setAnimatedRoutePath(loc.pathname)');
    expect(layout).not.toContain("loc.pathname !== '/dashboard'");
    expect(dashboard).toContain('return <Home />;');
    expect(dashboard).not.toContain('animate-fade-in-up');
    expect(tailwind).toContain("'fade-in-up': 'fadeInUp .5s ease both'");
  });
  it('keeps exactly one mounted skeleton through hydration, lazy import, and data loading', () => {
    const coordinator = read('src/components/loading/RouteInitialLoading.jsx');
    expect(coordinator).toContain('const loading = !hydrated || pageLoading');
    expect(coordinator).toContain(
      '{loading ? <RouteRefreshSkeleton /> : null}'
    );
    expect(coordinator).toContain("loading ? 'hidden'");
    expect(coordinator).toContain('reportLoading(Boolean(loading))');
  });
});
