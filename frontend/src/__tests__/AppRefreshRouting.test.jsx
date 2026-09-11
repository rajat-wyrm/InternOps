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
  it('does not show the dashboard skeleton while public auth pages load', () => {
    const app = read('src/App.jsx');
    expect(app).toContain(
      'return <Suspense fallback={null}>{children}</Suspense>'
    );
  });

  it('handles startup rate limiting without reporting a service outage', () => {
    expect(app).toContain('status === 429');
    expect(app).toContain("err.response?.headers?.['retry-after']");
    expect(app).toContain(
      'Too many requests. Please retry in ${retryAfter} seconds.'
    );
    expect(app).toContain(
      'const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);'
    );
    expect(app).toContain('disabled={retryAfterSeconds > 0}');
    expect(app).toContain(
      "retryAfterSeconds > 0 ? `Retry in ${retryAfterSeconds}s` : 'Retry'"
    );
  });
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

  it('centralizes initial loading for User Directory, Departments, Dashboard, Team, HR, Profile, Tasks, Notifications, Sessions, and InternOps, plus AI Performance Review, Reports, Report Templates, Exports, and Notice Board', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const coordinator = read('src/components/loading/RouteInitialLoading.jsx');
    const pages = [
      read('src/pages/admin/AdminDashboard.jsx'),
      read('src/pages/admin/AuditLog.jsx'),
      read('src/pages/admin/Departments.jsx'),
      read('src/pages/admin/ProjectsPage.jsx'),
      read('src/pages/admin/ProjectDetailPage.jsx'),
      read('src/pages/Home.jsx'),
      read('src/pages/Team.jsx'),
      read('src/pages/HR.jsx'),
      read('src/pages/Profile.jsx'),
      read('src/pages/Tasks.jsx'),
      read('src/pages/Notifications.jsx'),
      read('src/pages/Sessions.jsx'),
      read('src/pages/InternOps.jsx'),
      read('src/pages/PerformanceIntelligence.jsx'),
      read('src/pages/admin/Reports.jsx'),
      read('src/pages/admin/ReportTemplates.jsx'),
      read('src/pages/admin/Exports.jsx'),
      read('src/pages/admin/Notices.jsx'),
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
  it('keeps Audit Log behind the centralized skeleton until initial records resolve', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const audit = read('src/pages/admin/AuditLog.jsx');
    expect(layout).toContain("'/audit'");
    expect(audit).toContain('useRouteInitialLoading(auditInitialLoading)');
    expect(audit).toContain('isLoading && !data');
    expect(audit).not.toContain('<Spinner />');
    expect(audit).toContain('!auditInitialLoading && !isError && (');
    expect(skeleton).toContain("kind === 'audit'");
    expect(skeleton).toContain('function AuditLogSkeleton()');

    expect(skeleton).toContain('<AuditLogSkeleton />');

    expect(skeleton).toContain("const columns = '17fr 23fr 20fr 16fr 24fr'");
  });

  it('uses the dedicated Assistant workspace skeleton for lazy loading', () => {
    expect(skeleton).toContain('function AssistantSkeleton()');
    expect(skeleton).toContain("kind === 'assistant'");
    expect(skeleton).toContain('<AssistantSkeleton />');
    expect(skeleton).toContain('bg-gradient-to-r from-indigo-600');
    expect(skeleton).toContain('grid shrink-0 grid-cols-3');
    expect(skeleton).toContain('hidden w-[330px]');
  });

  it('uses the dedicated Quick Generate skeleton and resets main scroll on navigation', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    expect(skeleton).toContain('function QuickGenerateSkeleton()');
    expect(skeleton).toContain("kind === 'quick-generate'");
    expect(skeleton).toContain('<QuickGenerateSkeleton />');
    expect(skeleton).toContain('lg:grid-cols-5');
    expect(skeleton).toContain('lg:col-span-3');
    expect(skeleton).toContain('lg:col-span-2');
    expect(skeleton).toContain('mb-6 flex items-center gap-4');
    expect(skeleton).toContain('h-10 w-[460px]');
    expect(skeleton).toContain('pt-[37px] pb-8');
    expect(skeleton).toContain('h-[294px] p-6');
    expect(skeleton).toContain('h-[180px] flex-col');
    expect(layout).toContain('const mainContentRef = useRef(null);');
    expect(layout).toContain('mainContentRef.current.scrollTo({');
    expect(layout).toContain('top: 0');
    expect(layout).toContain('<main ref={mainContentRef}');
  });

  it('avoids duplicate page motion and keeps Assistant chat scrolling internal', () => {
    const assistant = read('src/components/InternOpsAssistant.jsx');
    const quickGenerate = read('src/pages/admin/QuickGenerate.jsx');
    expect(quickGenerate).not.toContain('<div className="animate-fade-in-up">');
    expect(assistant).not.toContain(
      '<div className="animate-fade-in-up h-[calc(100vh-6.5rem)]'
    );
    expect(assistant).toContain('const chatScrollRef = useRef(null);');
    expect(assistant).toContain(
      'if (messages.length <= 1 && !isTyping) return;'
    );
    expect(assistant).toContain('chatScrollRef.current.scrollTo({');
    expect(assistant).toContain('top: chatScrollRef.current.scrollHeight');
    expect(assistant).toContain('ref={chatScrollRef}');
    expect(assistant).toContain(
      'className="min-h-0 flex-1 overflow-y-auto px-4 md:px-6 py-5"'
    );
    expect(assistant).not.toContain('messagesEndRef');
    expect(assistant).not.toContain('.scrollIntoView(');
  });

  it('keeps Quick Generate behind the route skeleton until templates resolve', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const quickGenerate = read('src/pages/admin/QuickGenerate.jsx');
    expect(layout).toContain("'/quick-generate'");
    expect(quickGenerate).toContain(
      'useRouteInitialLoading(quickGenerateInitialLoading)'
    );
    expect(quickGenerate).toContain('templatesLoading && !templatesData');
    expect(quickGenerate).not.toContain('<Spinner /> Loading templates...');
    expect(quickGenerate).not.toContain('Badge, Spinner');
    expect(quickGenerate).toContain('<CustomSelect');
  });

  it('coordinates Certificates loading and matches its exact table workspace', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const certificates = read('src/pages/admin/Certificates.jsx');
    expect(skeleton).toContain('function CertificatesSkeleton()');
    expect(skeleton).toContain("const columns = '24% 32% 13% 12% 12% 7%'");
    expect(skeleton).toContain('h-10 w-52 rounded-xl');
    expect(skeleton).toContain('w-[330px] max-w-[70vw]');
    expect(skeleton).toContain('flex flex-wrap items-center gap-3 sm:-mt-8');
    expect(skeleton).toContain('h-[38px] w-[135px]');
    expect(skeleton).toContain('-mt-1 mb-6 p-4');
    expect(skeleton).toContain('overflow-x-auto');
    expect(skeleton).toContain('min-w-[900px]');
    expect(skeleton).toContain('h-[38px] w-[184px]');
    expect(skeleton).toContain('h-[46px] items-center gap-3');
    expect(skeleton).toContain('h-[52px] items-center border-b');
    expect(skeleton).toContain('h-[68px] items-center');
    expect(skeleton).toContain('h-9 w-9 shrink-0 rounded-full');
    expect(skeleton).toContain('mt-1 h-4 w-40');
    expect(skeleton).toContain('ml-auto flex items-center gap-2');
    expect(skeleton).toContain("kind === 'certificates'");
    expect(skeleton).toContain('<CertificatesSkeleton />');
    expect(layout).toContain("'/certificates'");
    expect(certificates).toContain(
      'useRouteInitialLoading(certificatesInitialLoading)'
    );
    expect(certificates).toContain('isLoading && !certsData');
    expect(certificates).not.toContain(
      '<Spinner label="Loading certificates..." />'
    );
    expect(certificates).not.toContain('className="animate-fade-in-up"');
  });

  it('coordinates Bulk Generate loading and matches its compact workflow skeleton', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const bulkGenerate = read('src/pages/admin/BulkGenerate.jsx');
    expect(skeleton).toContain('function BulkGenerateSkeleton()');
    expect(skeleton).toContain("kind === 'bulk-generate'");
    expect(skeleton).toContain('<BulkGenerateSkeleton />');
    expect(skeleton).toContain('max-w-6xl px-4 pb-8 pt-4 sm:pt-[28px]');
    expect(skeleton).toContain('h-9 w-9 shrink-0 rounded-full sm:h-10 sm:w-10');
    expect(skeleton).toContain('mx-2 h-1 w-12 rounded-full sm:w-[84px]');
    expect(skeleton).toContain('h-[51px] w-full rounded-xl');
    expect(skeleton).toContain('mt-[5px] p-5 sm:px-6 sm:pt-[29px] sm:pb-6');
    expect(skeleton).not.toContain('h-[336px]');
    expect(skeleton).toContain('mt-4 h-[42px] w-[135px]');
    expect(layout).toContain("'/bulk-generate'");
    expect(bulkGenerate).toContain(
      'useRouteInitialLoading(bulkGenerateInitialLoading)'
    );
    expect(bulkGenerate).toContain('templatesLoading && !templatesData');
    expect(bulkGenerate).not.toContain('<span>Loading templates...</span>');
    expect(bulkGenerate).not.toContain('min-h-screen');
    expect(bulkGenerate).toContain('max-w-6xl mx-auto px-4 pb-8 pt-4 sm:pt-6');
    expect(bulkGenerate).toContain(
      'mb-6 flex items-center justify-center sm:mb-7'
    );
    expect(bulkGenerate).toContain('w-12 sm:w-20 h-1 mx-2');
    expect(bulkGenerate).toContain('dark:bg-slate-800');
  });

  it('coordinates Templates and Canva loading and matches its compact empty workspace', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const canvaTemplates = read('src/pages/admin/CanvaTemplates.jsx');
    expect(skeleton).toContain('function CanvaTemplatesSkeleton()');
    expect(skeleton).toContain("kind === 'canva-templates'");
    expect(skeleton).toContain('<CanvaTemplatesSkeleton />');
    expect(skeleton).toContain('mx-auto mt-[28px] max-w-7xl space-y-5');
    expect(skeleton).toContain('h-10 w-[320px] max-w-[68vw]');
    expect(skeleton).toContain('sm:px-6 sm:py-[20px]');
    expect(skeleton).toContain('h-7 w-40 rounded-lg');
    expect(skeleton).toContain('w-[390px] max-w-[62vw]');
    expect(skeleton).toContain('pb-6 pt-10 text-center');
    expect(skeleton).toContain('w-[360px] max-w-[80%]');
    expect(skeleton).toContain("kind !== 'canva-templates'");
    expect(skeleton).toContain('h-7 w-[130px] rounded-full');
    expect(skeleton).toContain('h-[42px] w-[190px]');
    expect(skeleton).toContain('h-[42px] w-[235px]');
    expect(skeleton).toContain('min-h-[232px] flex-col items-center');
    expect(layout).toContain("'/canva-templates'");
    expect(canvaTemplates).toContain(
      'useRouteInitialLoading(canvaTemplatesInitialLoading)'
    );
    expect(canvaTemplates).toContain('statusLoading && !canvaStatusResp');
    expect(canvaTemplates).toContain('templatesLoading && !templatesResp');
    expect(canvaTemplates).not.toContain(
      'min-h-screen bg-gray-50 dark:bg-gray-900 p-6'
    );
    expect(canvaTemplates).not.toContain('statusLoading ?');
    expect(skeleton).toContain('min-h-[232px]');
    expect(canvaTemplates).toContain('flex flex-col gap-3 sm:flex-row');
  });

  it('coordinates GitHub Sync loading and responsive overview', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const githubSync = read('src/pages/admin/GithubSync.jsx');
    expect(layout).toContain("'/github-sync'");
    expect(githubSync).toContain(
      'useRouteInitialLoading(githubSyncInitialLoading)'
    );
    expect(githubSync).toContain(
      '(statusLoading && !status) || (countsLoading && !counts)'
    );
    expect(githubSync).toContain('setCopied(true)');
    expect(githubSync).toContain(
      'window.setTimeout(() => setCopied(false), 1600)'
    );
    expect(githubSync).toContain('LOG_STATUS_CLASSES');
    expect(githubSync).not.toContain('text-${statusColor}-500');
    expect(githubSync).toContain(
      'flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl'
    );
    expect(githubSync).toContain('flex shrink-0 items-center gap-2');
    expect(githubSync).toContain('grid grid-cols-1 gap-2 sm:grid-cols-3');
    expect(
      githubSync.match(
        /inline-flex items-center justify-center gap-2 whitespace-nowrap/g
      )
    ).toHaveLength(7);
    expect(githubSync).toContain('STATUS_CARD_TONES');
    expect(githubSync).toContain(
      'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100'
    );
    expect(githubSync).toContain('dark:bg-indigo-950/60 dark:text-indigo-300');
    expect(githubSync).toContain(
      'dark:bg-emerald-950/60 dark:text-emerald-300'
    );
    expect(githubSync).toContain('dark:bg-violet-950/60 dark:text-violet-300');
    expect(githubSync).not.toContain('var(--${color}-50, #f0fdf4)');
    expect(githubSync).toContain('isError: issuesError');
    expect(githubSync).toContain('error: issuesRequestError');
    expect(githubSync).toContain('refetch: refetchIssues');
    expect(githubSync).toContain('_suppressGlobalError: true');
    expect(githubSync).toContain('retry: false');
    expect(githubSync).toContain('Could not load synced issues');
    expect(githubSync).toContain('onClick={() => refetchIssues()}');
    expect(githubSync).toContain(
      'renders a single-request error state for Synced Issues'
    );
    expect(skeleton).toContain(
      'h-11 w-11 shrink-0 rounded-xl bg-slate-300/80 dark:bg-slate-600/80'
    );
    expect(skeleton).not.toContain('dark:bg-violet-700/70');
    expect(skeleton).toContain('function GithubSyncSkeleton()');
    expect(skeleton).toContain("kind === 'github-sync'");
    expect(skeleton).toContain('<GithubSyncSkeleton />');
    const githubSyncSkeleton = skeleton.slice(
      skeleton.indexOf('function GithubSyncSkeleton()'),
      skeleton.indexOf('function FeatureFlagsSkeleton()')
    );
    expect(githubSyncSkeleton).toContain('grid-cols-1');
    expect(githubSyncSkeleton).toContain('sm:grid-cols-3');
    expect(githubSyncSkeleton).toContain('lg:flex');
    expect(githubSyncSkeleton).toContain('lg:w-[138px]');
    expect(githubSyncSkeleton).toContain('lg:w-[110px]');
    expect(githubSyncSkeleton).toContain('lg:w-[124px]');
    expect(skeleton).toContain(
      'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'
    );
    expect(skeleton).toContain(
      'mb-6 flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl'
    );
    expect(skeleton).toContain('h-[112px] p-5');
    expect(skeleton).toContain('flex h-full items-center gap-3');
    expect(skeleton).toContain("'w-[120px]'");
    expect(skeleton).toContain("'w-[117px]'");
    expect(skeleton).toContain("'w-[135px]'");
    expect(skeleton).toContain("'w-[150px]'");
    expect(skeleton).toContain("'w-[143px]'");
    expect(skeleton).toContain('mt-2 h-7 w-24 rounded-lg');
    expect(skeleton).toContain('mt-1 h-4 w-32 max-w-full rounded-md');
    expect(skeleton).toContain('h-[97px] p-5');
    expect(skeleton).toContain('flex h-full flex-col justify-center');
    expect(skeleton).toContain('h-[173px] p-5');
  });
  it('coordinates Feature Flags loading and matches its deployment-control workspace', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const featureFlags = read('src/pages/admin/FeatureFlags.jsx');
    expect(skeleton).toContain('function FeatureFlagsSkeleton()');
    expect(skeleton).toContain("kind === 'feature-flags'");
    expect(skeleton).toContain('<FeatureFlagsSkeleton />');
    expect(skeleton).toContain("['blue', 'green', 'rose'].map");
    expect(skeleton).toContain('h-[155px] rounded-3xl');
    expect(skeleton).toContain('mb-9 flex flex-col justify-between gap-4');
    expect(skeleton).toContain('h-11 w-[230px] max-w-[60vw]');
    expect(skeleton).toContain('mt-1 h-[42px] w-[110px]');
    expect(skeleton).toContain('mt-3 h-4 w-16 rounded-md');
    expect(skeleton).toContain('w-[410px] max-w-[72vw]');
    expect(skeleton).toContain('mb-[34px] grid grid-cols-3 gap-4');
    expect(skeleton).toContain('h-8 w-8 rounded-lg');
    expect(skeleton).toContain('mt-3 h-4 w-full max-w-28 rounded-md');
    expect(skeleton).toContain(
      'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'
    );
    expect(skeleton).toContain(
      'const cards = [true, true, false, true, true, false, false]'
    );
    expect(skeleton).toContain(
      'min-h-[214px] overflow-hidden p-5 xl:min-h-[158px]'
    );
    expect(skeleton).toContain("enabled ? 'bg-emerald-400' : 'bg-slate-500'");
    expect(skeleton).toContain('h-[38px] w-[86px]');
    expect(skeleton).toContain(
      'flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between'
    );
    expect(skeleton).toContain(
      'mt-3 grid grid-cols-2 items-center gap-x-3 gap-y-2 xl:grid-cols-[auto_auto_1fr]'
    );
    expect(skeleton).toContain(
      'col-span-2 h-4 w-28 justify-self-end rounded-md xl:col-span-1'
    );
    expect(skeleton).toContain('h-5 w-24 rounded-md');
    expect(skeleton).toContain('h-6 w-12 shrink-0 rounded-full');
    expect(skeleton).toContain(
      'flex shrink-0 flex-wrap items-center gap-2 xl:justify-end'
    );
    expect(skeleton).toContain('mt-3 h-4 w-full max-w-[145px] rounded-md');
    expect(layout).toContain("'/feature-flags'");
    expect(featureFlags).toContain(
      'useRouteInitialLoading(featureFlagsInitialLoading)'
    );
    expect(featureFlags).toContain(
      'const featureFlagsInitialLoading = isLoading && !data;'
    );
    expect(featureFlags).not.toContain('Loading feature flags');
    expect(featureFlags).not.toContain('isLoading ? (');
    expect(featureFlags).toContain('isError ? (');
    expect(featureFlags).toContain('Failed to load flags.');
    expect(featureFlags).toContain('Retry');
    expect(featureFlags).toContain('fixed top-[4.25rem] right-4 z-[100]');
    expect(featureFlags).toContain('sm:right-6 sm:max-w-md');
    expect(featureFlags).toContain('min-w-0 break-words');
    expect(featureFlags).toContain('px-5 py-3 text-sm');
    expect(featureFlags).toContain("backgroundColor: toast.type === 'error'");
    expect(featureFlags).toContain('bg-emerald-50 dark:bg-emerald-950');
    expect(featureFlags).toContain('bg-rose-50 dark:bg-rose-950');
    expect(featureFlags).toContain(
      'mb-3 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between'
    );
    expect(featureFlags).toContain('min-w-0 break-all font-mono');
    expect(featureFlags).toContain(
      'flex shrink-0 flex-wrap items-center gap-2 xl:justify-end'
    );
    expect(featureFlags).toContain(
      'grid grid-cols-2 items-center gap-x-3 gap-y-2 text-xs'
    );
    expect(featureFlags).toContain(
      'col-span-2 justify-self-end whitespace-nowrap text-right xl:col-span-1'
    );
    expect(skeleton).toContain('else body = <Generic />;');
  });
  it('matches the AI Certificates toolbar, form, and independent Results workspace', () => {
    const aiCertificates = read('src/pages/admin/AICertificates.jsx');
    expect(skeleton).toContain('function AICertificatesSkeleton()');
    expect(skeleton).toContain("kind === 'ai-certificates'");
    expect(skeleton).toContain('<AICertificatesSkeleton />');
    expect(skeleton).toContain("'w-[121px]'");
    expect(skeleton).toContain("'w-[149px]'");
    expect(skeleton.match(/'w-\[149px\]'/g)).toHaveLength(3);
    expect(skeleton).toContain("'w-[96px]'");
    expect(skeleton).toContain('h-[33px] ${width} rounded-lg');
    expect(skeleton).toContain('h-10 w-[415px] max-w-[68vw]');
    expect(skeleton).toContain('w-[510px] max-w-[72vw]');
    expect(skeleton).toContain('className="sm:hidden"');
    expect(skeleton).toContain('h-9 w-[235px] rounded-xl');
    expect(skeleton).toContain('mt-2 h-9 w-[170px] rounded-xl');
    expect(skeleton).toContain('mt-3 h-4 w-[285px] rounded-md');
    expect(skeleton).toContain('mt-2 h-4 w-[155px] rounded-md');
    expect(skeleton).toContain('className="hidden sm:block"');
    expect(skeleton).toContain('mb-7 flex flex-wrap gap-x-2 gap-y-3');
    expect(skeleton).toContain(
      'grid grid-cols-1 items-start gap-6 lg:grid-cols-5'
    );
    expect(skeleton).toContain('mb-5 h-7 w-24 rounded-lg');
    expect(skeleton).toContain('mb-1.5 h-4 ${width}');
    expect(skeleton).toContain('h-[44px] w-full rounded-xl');
    expect(skeleton).toContain('h-[84px] w-full rounded-xl');
    expect(skeleton).toContain('h-[46px] w-full rounded-xl');
    expect(skeleton).toContain('min-h-[414px] p-6');
    expect(skeleton).toContain('h-7 w-16 rounded-lg');
    expect(skeleton).toContain('min-h-[285px] translate-y-[40px]');
    expect(aiCertificates).not.toContain('className="animate-fade-in-up"');
    expect(aiCertificates).toContain('flex flex-wrap gap-x-2 gap-y-3');
    expect(aiCertificates).toContain('whitespace-nowrap');
    expect(aiCertificates).toContain(
      'grid grid-cols-1 items-start gap-6 lg:grid-cols-5'
    );
    expect(aiCertificates).toContain('min-h-[414px] p-6');
    expect(aiCertificates).toContain('min-h-[315px]');
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
    const layout = read('src/layouts/DashboardLayout.jsx');
    const coordinator = read('src/components/loading/RouteInitialLoading.jsx');
    expect(layout).toContain('<Suspense fallback={<RouteRefreshSkeleton />}>');
    expect(coordinator).toContain(
      '{loading ? <RouteRefreshSkeleton /> : null}'
    );
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
    expect(skeleton).toContain('function ProfileSkeleton({ role })');
  });
  it('keeps the public Login route out of the dashboard skeleton fallback', () => {
    expect(app).toContain("import Login from './pages/Login';");
    expect(app).not.toMatch(/const\s+Login\s*=\s*lazy/);
    expect(app).toContain('path="/login" element={<Login />}');
    expect(app).toContain('function PublicLazyPage({ children })');
    expect(app).toContain(
      'return <Suspense fallback={null}>{children}</Suspense>;'
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

  it('keeps the exact Tasks skeleton until initial task data resolves', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const tasks = read('src/pages/Tasks.jsx');

    expect(layout).toContain("'/tasks'");
    expect(tasks).toContain(
      "import { useRouteInitialLoading } from '../components/loading/RouteInitialLoading';"
    );
    expect(tasks).toContain('useRouteInitialLoading(');
    expect(tasks).toContain('isLoading ||');
    expect(tasks).toContain('!tasks ||');
    expect(tasks).toContain('isLoading: departmentsLoading');
    expect(tasks).toContain('isFetchedAfterMount,');
    expect(tasks).toContain('const departmentTasksInitialLoading =');
    expect(tasks).toContain(
      'isAdmin && departmentsLoading && !activeDepartment'
    );
    expect(tasks).toContain(
      'const hasCachedTasks = Array.isArray(tasks) && tasks.length > 0;'
    );
    expect(tasks).toContain('!hasCachedTasks && !isFetchedAfterMount');
    expect(tasks).not.toContain('isFetching && (!tasks || tasks.length === 0)');
    expect(tasks).toContain('departmentTasksInitialLoading)');
    expect(tasks).toContain('if (departmentTasksInitialLoading) return null;');
    const tasksGuardIndex = tasks.indexOf(
      'if (departmentTasksInitialLoading) return null;'
    );
    const tasksHandlerIndex = tasks.indexOf('const handleFileSelect');
    const tasksMainReturnIndex = tasks.indexOf('return (', tasksHandlerIndex);
    expect(tasksHandlerIndex).toBeLessThan(tasksGuardIndex);
    expect(tasksGuardIndex).toBeLessThan(tasksMainReturnIndex);
    expect(tasks).toContain('enabled: hydrated && !!accessToken');
    expect(tasks).not.toContain('animate-pulse h-48');
    expect(tasks).not.toContain('{isLoading ? (');

    expect(skeleton).toContain('function Tasks({ department = false })');
    expect(skeleton).toContain('Array.from({ length: 2 }');
    expect(skeleton).toContain('h-[216px] self-start p-5 md:p-6');
    expect(skeleton).toContain('h-11 w-36 rounded-2xl');
    expect(skeleton).toContain('h-12 w-12 shrink-0 rounded-2xl');
    expect(skeleton).toContain('h-6 w-20 rounded-full');
    expect(skeleton).toContain('h-6 w-16 rounded-full');
    expect(skeleton).toContain('h-5 w-5 rounded-md');
    expect(skeleton).toContain('border-t border-slate-200 pt-4');
    expect(skeleton).toContain('h-10 w-40 rounded-2xl');
    expect(skeleton).toContain('h-10 w-32 rounded-2xl');

    expect(tasks).toContain('grid grid-cols-1 xl:grid-cols-2 gap-5');
    expect(tasks).toContain('p-5 md:p-6 card-hover');
    expect(tasks).toContain('w-12 h-12 rounded-2xl');
    expect(tasks).toContain('mt-5 pt-4 border-t');
    expect(tasks).toContain('Details & Analytics');
    expect(tasks).toContain('View proofs');
  });

  it('keeps the Notifications skeleton until notification data resolves', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const notifications = read('src/pages/Notifications.jsx');

    expect(layout).toContain("'/notifications'");
    expect(notifications).toContain('useRouteInitialLoading(');
    expect(notifications).toContain('enabled: hydrated && !!accessToken');
    expect(notifications).not.toContain('<Spinner />');
    expect(skeleton).toContain('function NotificationsSkeleton()');
    expect(skeleton).toContain('min-h-[145px] p-5');
    expect(skeleton).toContain('h-11 w-11 shrink-0 rounded-2xl');
    expect(skeleton).toContain('space-y-3');
    expect(skeleton).toContain('h-5 w-24 rounded-md');
    expect(skeleton).toContain('h-8 w-8 rounded-xl');
  });

  it('matches Profile account details to the authenticated role', () => {
    const profile = read('src/pages/Profile.jsx');

    expect(skeleton).toContain('function ProfileSkeleton({ role })');
    expect(skeleton).toContain("role === 'ADMIN' ? 3");
    expect(skeleton).toContain("role === 'SENIOR_TL' ? 5 : 4");
    expect(skeleton).toContain('accountDetailCount === 3');
    expect(skeleton).toContain("'sm:grid-cols-3 xl:w-[500px]'");
    expect(skeleton).toContain("'sm:grid-cols-2 xl:w-[500px]'");
    expect(skeleton).toContain('<ProfileSkeleton role={role} />');
    expect(skeleton).toContain('mx-auto h-24 w-24 rounded-3xl');
    expect(skeleton).toContain('lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]');

    expect(profile).toContain('sm:grid-cols-3 xl:w-[500px]');
    expect(profile).toContain('sm:grid-cols-2 xl:w-[500px]');
    expect(profile).toContain('h-24 w-24 rounded-3xl');
    expect(profile).toContain('lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]');
  });

  it('keeps the Sessions skeleton until session data resolves', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const sessions = read('src/pages/Sessions.jsx');

    expect(layout).toContain("'/sessions'");
    expect(sessions).toContain('useRouteInitialLoading(');
    expect(sessions).toContain('enabled: hydrated && !!accessToken');
    expect(sessions).not.toContain('<Spinner />');
    expect(skeleton).toContain('function SessionsSkeleton()');
    expect(skeleton).toContain('grid grid-cols-1 gap-3 md:grid-cols-2');
    expect(skeleton).toContain('h-11 w-11 shrink-0 rounded-xl');
    expect(skeleton).toContain('h-[90px] px-4 py-3');
    expect(skeleton).toContain('h-[36px] w-[82px]');
    expect(skeleton).toContain('h-[42px] w-[166px]');
  });

  it('coordinates InternOps loading and aligns the performance table', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const internops = read('src/pages/InternOps.jsx');

    expect(layout).toContain("'/internops'");
    expect(internops).toContain('useRouteInitialLoading(');
    expect(internops).not.toContain(
      '<Spinner label="Loading intern records..." />'
    );
    expect(internops).not.toContain('bg-slate-55');
    expect(internops).toContain('bg-slate-50/80');
    expect(internops).toContain('<colgroup>');
    expect(internops).toContain('justify-center gap-1.5 font-bold');
    expect(skeleton).toContain("const columns = '31% 25% 19% 20% 5%'");
    expect(skeleton).toContain('function InternOpsSkeleton()');
  });
  it('coordinates AI Performance Review loading and project theming', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const page = read('src/pages/PerformanceIntelligence.jsx');
    expect(layout).toContain("'/performance-intelligence'");
    expect(layout).toContain('min-w-0 flex-1 truncate whitespace-nowrap');
    expect(layout).toContain('h-1.5 w-1.5 shrink-0');
    expect(page).toContain('useRouteInitialLoading(loading && !review)');
    expect(page).not.toContain('Analyzing intern performance signals...');
    expect(page).toContain('bg-white');
    expect(page).toContain('dark:bg-slate-950');
    expect(skeleton).toContain('function PerformanceIntelligenceSkeleton()');
    expect(skeleton).toContain("kind === 'performance-intelligence'");
    expect(skeleton).toContain('md:grid-cols-4');
  });

  it('coordinates Report Templates loading and exact overview skeleton', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const templates = read('src/pages/admin/ReportTemplates.jsx');
    expect(layout).toContain("'/report-templates'");
    expect(templates).toContain('useRouteInitialLoading(');
    expect(templates).toContain('templatesQuery.isLoading');
    expect(templates.match(/<Spinner \/>/g)).toHaveLength(1);
    expect(skeleton).toContain('function TemplatesSkeleton()');
    expect(skeleton).toContain('h-[37px] w-[140px]');
    expect(skeleton).toContain('h-[38px] w-[154px]');
    expect(skeleton).toContain('grid grid-cols-1 gap-5 xl:grid-cols-2');
    expect(skeleton).toContain('actionWidths.map');
  });

  it('coordinates Exports loading and exact export workspace skeleton', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const exportsPage = read('src/pages/admin/Exports.jsx');
    expect(layout).toContain("'/exports'");
    expect(exportsPage).toContain('useRouteInitialLoading(departmentsLoading)');
    expect(exportsPage).toContain('setDepartmentsLoading(false)');
    expect(exportsPage).not.toContain('<div className="animate-fade-in-up">');
    expect(skeleton).toContain('function ExportsSkeleton()');
    expect(skeleton).toContain("kind === 'exports'");
    expect(skeleton).toContain('grid grid-cols-1 gap-4 md:grid-cols-2');
    expect(skeleton).toContain(
      'grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3'
    );
    expect(skeleton).toContain('min-h-[260px]');
  });

  it('coordinates exact department Attendance and Ratings loading without initial circles', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const attendance = read('src/pages/Attendance.jsx');
    const ratings = read('src/pages/Ratings.jsx');
    expect(layout).toContain('/^\\/admin\\/departments\\/[^/]+\\/attendance$/');
    expect(layout).toContain('/^\\/admin\\/departments\\/[^/]+\\/ratings$/');
    expect(layout).toContain('/^\\/admin\\/departments\\/[^/]+\\/tasks$/');
    expect(attendance).toContain('departmentAttendanceInitialLoading');
    expect(attendance).toContain(
      'useRouteInitialLoading(departmentAttendanceInitialLoading)'
    );
    expect(ratings).toContain('departmentRatingsInitialLoading');
    expect(ratings).toContain(
      'useRouteInitialLoading(departmentRatingsInitialLoading)'
    );
    expect(skeleton).toContain('function DepartmentContextSkeleton()');
    expect(skeleton).toContain('function DepartmentAttendanceSkeleton()');
    expect(skeleton).toContain('function DepartmentRatingsSkeleton()');
    expect(skeleton).toContain("kind === 'department-attendance'");
    expect(skeleton).toContain("kind === 'department-ratings'");
    expect(skeleton).toContain('dark:bg-slate-800/35');
  });
  it('keeps the exact Project Detail skeleton until hierarchy and attendance data are ready', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const detail = read('src/pages/admin/ProjectDetailPage.jsx');
    const attendance = read('src/pages/Attendance.jsx');
    expect(layout).toContain('/^\\/departments\\/[^/]+\\/projects\\/[^/]+$/');
    expect(detail).toContain('useRouteInitialLoading(isLoading)');
    expect(detail).not.toContain(') : isLoading ? (');
    expect(detail).not.toContain('<Spinner />');
    expect(detail).toContain(' · roster, attendance, and ratings');
    expect(attendance).toContain(
      'useRouteInitialLoading(isProjectView && isLoading && !data)'
    );
    expect(attendance).toContain('!departmentAttendanceInitialLoading && (');
    expect(skeleton).toContain('function ProjectDetailSkeleton()');
    expect(skeleton).toContain("kind === 'project-detail'");
    expect(skeleton).toContain('h-[40px] w-[190px] rounded-2xl');
    expect(skeleton).toContain('grid w-full grid-cols-1 gap-3 md:grid-cols-3');
    expect(skeleton).toContain(
      'border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40'
    );
    expect(skeleton).toContain(
      'border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 md:p-6'
    );
    expect(skeleton).toContain(
      'border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
    );
    expect(skeleton).toContain('dark:bg-slate-800/35');
    expect(skeleton).toContain('h-[51px] w-full rounded-2xl sm:max-w-[430px]');
  });
  it('keeps the department hierarchy skeleton mounted until projects data is ready', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const projects = read('src/pages/admin/ProjectsPage.jsx');
    expect(layout).toContain('COORDINATED_LOADING_ROUTE_PATTERNS');
    expect(layout).toContain('/^\\/departments\\/[^/]+\\/projects$/');
    expect(projects).toContain('useRouteInitialLoading(');
    expect(projects).toContain(
      'isLoading || (departmentsLoading && departments.length === 0)'
    );
    expect(projects).not.toContain('{isLoading ? (');
    expect(projects).not.toContain('<Spinner />');
    expect(skeleton).toContain('function DepartmentProjectsSkeleton()');
    expect(skeleton).toContain("kind === 'department-projects'");
    expect(skeleton).toContain('h-[40px] w-[197px] rounded-2xl');
    expect(skeleton).toContain('h-[194px]');
    expect(skeleton).toContain('h-11 w-11 shrink-0 rounded-2xl');
    expect(skeleton).toContain('dark:!bg-slate-800');
    expect(skeleton).toContain('Array.from({ length: 3 }');
  });
  it('coordinates Departments loading and matches the department-card workspace', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const departments = read('src/pages/admin/Departments.jsx');
    expect(layout).toContain("'/departments'");
    expect(departments).toContain(
      'useRouteInitialLoading(isLoading && isAdmin && departments.length === 0)'
    );
    expect(departments).not.toContain(') : isLoading ? (');
    expect(skeleton).toContain('function DepartmentsSkeleton()');
    expect(skeleton).toContain("kind === 'departments'");
    expect(skeleton).toContain(
      'grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3'
    );
    expect(skeleton).toContain('Array.from({ length: 3 }');
    expect(skeleton).toContain('h-[190px]');
    expect(skeleton).toContain('h-7 w-[144px] rounded-xl');
  });
  it('coordinates User Directory loading and matches its exact workspace skeleton', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const users = read('src/pages/admin/AdminDashboard.jsx');
    expect(layout).toContain("'/admin'");
    expect(users).toContain('useRouteInitialLoading(isLoading && !data)');
    expect(users).not.toContain('{isLoading ? (');
    expect(skeleton).toContain('function AdminUsersSkeleton()');
    expect(skeleton).toContain("kind === 'admin'");
    expect(skeleton).toContain("const columns = '42% 15% 20% 13% 10%'");
    expect(skeleton).toContain('h-[51px] min-w-[240px] flex-1 rounded-2xl');
    expect(skeleton).toContain('min-h-[88px]');
    expect(skeleton).toContain('Array.from({ length: 6 }');
  });
  it('coordinates Notice Board loading, validation, and exact form skeleton', () => {
    const layout = read('src/layouts/DashboardLayout.jsx');
    const notices = read('src/pages/admin/Notices.jsx');
    const routes = read('../backend/src/modules/notices/routes.js');
    const repository = read('../backend/src/modules/notices/repository.js');
    expect(layout).toContain("'/notices'");
    expect(notices).toContain(
      'useRouteInitialLoading(isLoading && !noticesData)'
    );
    expect(notices).toContain('if (imageUrl) payload.image_url = imageUrl');
    expect(notices).not.toContain('image_url: image_url || null');
    expect(routes).not.toContain('.nullable()');
    expect(repository).toContain('createdBy,');
    expect(skeleton).toContain('function NoticesSkeleton()');
    expect(skeleton).toContain("kind === 'notices'");
    expect(skeleton).toContain('h-[96px] w-full rounded-2xl');
  });
});
