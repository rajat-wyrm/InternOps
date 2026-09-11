import { lazy } from 'react';
import { useRoutes } from 'react-router-dom';
import RoleGuard from './components/RoleGuard';

const Tasks = lazy(() => import('./pages/Tasks'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Ratings = lazy(() => import('./pages/Ratings'));

const HR = lazy(() => import('./pages/HR'));
const InternOps = lazy(() => import('./pages/InternOps'));
const Reports = lazy(() => import('./pages/admin/Reports'));
const ReportTemplates = lazy(() => import('./pages/admin/ReportTemplates'));
const Analytics = lazy(() => import('./pages/admin/Analytics'));
const Exports = lazy(() => import('./pages/admin/Exports'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const Departments = lazy(() => import('./pages/admin/Departments'));
const AuditLog = lazy(() => import('./pages/admin/AuditLog'));
const Notices = lazy(() => import('./pages/admin/Notices'));
const Certificates = lazy(() => import('./pages/admin/Certificates'));
const BulkGenerate = lazy(() => import('./pages/admin/BulkGenerate'));
const CanvaTemplates = lazy(() => import('./pages/admin/CanvaTemplates'));
const CanvaCallback = lazy(() => import('./pages/admin/CanvaCallback'));
const AICertificates = lazy(() => import('./pages/admin/AICertificates'));
const QuickGenerate = lazy(() => import('./pages/admin/QuickGenerate'));
const FeatureFlags = lazy(() => import('./pages/admin/FeatureFlags'));
const GithubSync = lazy(() => import('./pages/admin/GithubSync'));
const ProjectsPage = lazy(() => import('./pages/admin/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./pages/admin/ProjectDetailPage'));
const TaskDetails = lazy(() => import('./pages/admin/TaskDetails'));

export default function PrivilegedRoutes() {
  return useRoutes([
    {
      path: '/tasks/:taskId',
      element: (
        <RoleGuard allowedRoles={['ADMIN', 'SENIOR_TL']}>
          <TaskDetails />
        </RoleGuard>
      ),
    },

    {
      path: '/admin/tasks/:taskId',
      element: (
        <RoleGuard allowedRoles={['ADMIN', 'SENIOR_TL']}>
          <TaskDetails />
        </RoleGuard>
      ),
    },

    {
      path: '/hr',
      element: (
        <RoleGuard allowedRoles={['ADMIN', 'HR']}>
          <HR />
        </RoleGuard>
      ),
    },

    {
      path: '/internops',
      element: (
        <RoleGuard allowedRoles={['ADMIN', 'SENIOR_TL']}>
          <InternOps />
        </RoleGuard>
      ),
    },

    {
      path: '/reports',
      element: (
        <RoleGuard allowedRoles={['ADMIN', 'SENIOR_TL']}>
          <Reports />
        </RoleGuard>
      ),
    },

    {
      path: '/report-templates',
      element: (
        <RoleGuard allowedRoles={['ADMIN', 'SENIOR_TL']}>
          <ReportTemplates />
        </RoleGuard>
      ),
    },

    {
      path: '/notices',
      element: (
        <RoleGuard allowedRoles={['ADMIN', 'SENIOR_TL']}>
          <Notices />
        </RoleGuard>
      ),
    },

    {
      path: '/analytics',
      element: (
        <RoleGuard allowedRoles={['ADMIN', 'SENIOR_TL']}>
          <Analytics />
        </RoleGuard>
      ),
    },

    {
      path: '/exports',
      element: (
        <RoleGuard allowedRoles={['ADMIN', 'SENIOR_TL']}>
          <Exports />
        </RoleGuard>
      ),
    },

    {
      path: '/admin',
      element: (
        <RoleGuard allowedRoles={['ADMIN', 'SENIOR_TL', 'TL']}>
          <AdminDashboard />
        </RoleGuard>
      ),
    },

    {
      path: '/departments',
      element: (
        <RoleGuard allowedRoles={['ADMIN', 'SENIOR_TL', 'TL']}>
          <Departments />
        </RoleGuard>
      ),
    },

    {
      path: '/admin/departments',
      element: (
        <RoleGuard allowedRoles={['ADMIN', 'SENIOR_TL', 'TL']}>
          <Departments />
        </RoleGuard>
      ),
    },

    {
      path: '/departments/:deptId/projects',
      element: (
        <RoleGuard allowedRoles={['ADMIN', 'SENIOR_TL', 'TL']}>
          <ProjectsPage />
        </RoleGuard>
      ),
    },

    {
      path: '/departments/:deptId/projects/:leadId',
      element: (
        <RoleGuard allowedRoles={['ADMIN', 'SENIOR_TL', 'TL']}>
          <ProjectDetailPage />
        </RoleGuard>
      ),
    },

    {
      path: '/admin/departments/:deptId/attendance',
      element: (
        <RoleGuard allowedRoles={['ADMIN', 'SENIOR_TL', 'TL']}>
          <Attendance />
        </RoleGuard>
      ),
    },

    {
      path: '/admin/departments/:deptId/ratings',
      element: (
        <RoleGuard allowedRoles={['ADMIN', 'SENIOR_TL', 'TL']}>
          <Ratings />
        </RoleGuard>
      ),
    },

    {
      path: '/admin/departments/:deptId/tasks',
      element: (
        <RoleGuard allowedRoles={['ADMIN', 'SENIOR_TL', 'TL']}>
          <Tasks />
        </RoleGuard>
      ),
    },

    {
      path: '/audit',
      element: (
        <RoleGuard allowedRoles={['ADMIN']}>
          <AuditLog />
        </RoleGuard>
      ),
    },

    {
      path: '/quick-generate',
      element: (
        <RoleGuard allowedRoles={['ADMIN']}>
          <QuickGenerate />
        </RoleGuard>
      ),
    },

    {
      path: '/certificates',
      element: (
        <RoleGuard allowedRoles={['ADMIN']}>
          <Certificates />
        </RoleGuard>
      ),
    },

    {
      path: '/bulk-generate',
      element: (
        <RoleGuard allowedRoles={['ADMIN']}>
          <BulkGenerate />
        </RoleGuard>
      ),
    },

    {
      path: '/canva-templates',
      element: (
        <RoleGuard allowedRoles={['ADMIN']}>
          <CanvaTemplates />
        </RoleGuard>
      ),
    },

    {
      path: '/canva-templates/callback',
      element: (
        <RoleGuard allowedRoles={['ADMIN']}>
          <CanvaCallback />
        </RoleGuard>
      ),
    },

    {
      path: '/ai-certificates',
      element: (
        <RoleGuard allowedRoles={['ADMIN']}>
          <AICertificates />
        </RoleGuard>
      ),
    },

    {
      path: '/feature-flags',
      element: (
        <RoleGuard allowedRoles={['ADMIN']}>
          <FeatureFlags />
        </RoleGuard>
      ),
    },

    {
      path: '/github-sync',
      element: (
        <RoleGuard allowedRoles={['ADMIN']}>
          <GithubSync />
        </RoleGuard>
      ),
    },
  ]);
}
