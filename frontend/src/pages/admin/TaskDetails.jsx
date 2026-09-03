import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Target,
  Briefcase,
  Camera,
  MessageCircle,
  ThumbsUp,
  PlaySquare,
  Clock,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Link as LinkIcon,
  Users,
  Building2,
  Filter,
  Search,
  ExternalLink,
  Eye,
  Sparkles,
  X,
  GitPullRequest as GithubIcon,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';
import api from '../../lib/axios';
import useAuthStore from '../../store/auth';
import {
  Card,
  Btn,
  Badge,
  Spinner,
  EmptyState,
  ApiErrorState,
} from '../../components/ui';
import CustomSelect from '../../components/CustomSelect';

const PLATFORM_ICON = {
  LinkedIn: <Briefcase className="w-5 h-5" />,
  Instagram: <Camera className="w-5 h-5" />,
  Twitter: <MessageCircle className="w-5 h-5" />,
  Facebook: <ThumbsUp className="w-5 h-5" />,
  YouTube: <PlaySquare className="w-5 h-5" />,
};

const overdue = (d) => d && new Date(d) < new Date();

function initials(name, email) {
  const n = (name || email || '?').trim();
  return (
    n
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  );
}

export default function TaskDetails() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeProofIntern, setActiveProofIntern] = useState(null);
  const [notification, setNotification] = useState(null);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 5000);
  };

  const {
    data: analyticsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['taskAnalytics', taskId],
    queryFn: () =>
      api.get(`/tasks/${taskId}/analytics`).then((res) => res.data),
    enabled: !!taskId,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((res) => res.data),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ proofId }) => api.patch(`/proofs/${proofId}/verify`),
    onSuccess: () => {
      showNotification('Proof verified successfully!');
      queryClient.invalidateQueries({ queryKey: ['taskAnalytics', taskId] });
      queryClient.invalidateQueries({ queryKey: ['proofs'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (activeProofIntern) {
        setActiveProofIntern((prev) =>
          prev ? { ...prev, proof_status: 'VERIFIED' } : null
        );
      }
    },
    onError: (err) => {
      showNotification(
        err.response?.data?.error || err.message || 'Failed to verify proof'
      );
    },
  });

  const task = analyticsData?.task;
  const summary = analyticsData?.summary;
  const departmentStats = analyticsData?.departmentStats || [];
  const interns = analyticsData?.interns || [];

  const isTaskOverdue = task?.deadline && overdue(task.deadline);

  const departmentOptions = useMemo(() => {
    return [
      { value: '', label: 'All Departments' },
      ...departments.map((d) => ({
        value: d.id,
        label: d.name,
      })),
    ];
  }, [departments]);

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'VERIFIED', label: 'Verified / Completed' },
    { value: 'PENDING', label: 'Pending Verification' },
    { value: 'OVERDUE', label: 'Overdue / Missed' },
    { value: 'NOT_SUBMITTED', label: 'Not Submitted (Active)' },
  ];

  const filteredInterns = useMemo(() => {
    return interns.filter((intern) => {
      // Department filter
      if (selectedDeptId && intern.department_id !== selectedDeptId) {
        return false;
      }

      // Status filter
      if (selectedStatus) {
        if (
          selectedStatus === 'VERIFIED' &&
          intern.proof_status !== 'VERIFIED'
        ) {
          return false;
        }
        if (selectedStatus === 'PENDING' && intern.proof_status !== 'PENDING') {
          return false;
        }
        if (
          selectedStatus === 'OVERDUE' &&
          (intern.proof_status || !isTaskOverdue)
        ) {
          return false;
        }
        if (
          selectedStatus === 'NOT_SUBMITTED' &&
          (intern.proof_status || isTaskOverdue)
        ) {
          return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (intern.full_name || '').toLowerCase();
        const email = (intern.email || '').toLowerCase();
        const position = (intern.position || '').toLowerCase();
        const dept = (intern.department_name || '').toLowerCase();
        if (
          !name.includes(q) &&
          !email.includes(q) &&
          !position.includes(q) &&
          !dept.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [interns, selectedDeptId, selectedStatus, searchQuery, isTaskOverdue]);

  const filteredDepartmentStats = useMemo(() => {
    if (!selectedDeptId) return departmentStats;
    return departmentStats.filter((d) => d.department_id === selectedDeptId);
  }, [departmentStats, selectedDeptId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Spinner />
        <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Loading task details & analytics...
        </p>
      </div>
    );
  }

  if (isError || !task) {
    return (
      <div className="animate-fade-in-up">
        <Btn
          variant="outline"
          onClick={() => navigate('/tasks')}
          className="mb-5 inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Tasks
        </Btn>
        <ApiErrorState
          error={error}
          title="Task not found or failed to load"
          fallback="Unable to load analytics for this task."
          onRetry={refetch}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-7 pb-10">
      {/* Top Notification Toast */}
      {notification && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200 flex items-center justify-between shadow-sm animate-fade-in">
          <span className="font-semibold text-sm">{notification}</span>
          <button
            onClick={() => setNotification(null)}
            className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-full transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Back Button & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Btn
          variant="outline"
          onClick={() => navigate('/tasks')}
          className="inline-flex items-center gap-2 w-fit rounded-2xl"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Tasks
        </Btn>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            Task Analytics & Details
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            Admin View
          </span>
        </div>
      </div>

      {/* Task Information Hero Card */}
      <Card className="p-6 md:p-8 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex items-start gap-4 flex-1">
            <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-violet-500 via-indigo-600 to-blue-600 text-white flex items-center justify-center text-2xl shrink-0 shadow-lg shadow-indigo-200/50 dark:shadow-none">
              {PLATFORM_ICON[task.target_platform] || (
                <Target className="w-7 h-7" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap mb-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {task.title}
                </h1>

                {task.target_platform && (
                  <Badge color="purple">{task.target_platform}</Badge>
                )}

                {task.deadline && (
                  <Badge color={isTaskOverdue ? 'red' : 'green'}>
                    {isTaskOverdue ? 'Overdue' : 'Active'}
                  </Badge>
                )}

                {task.source === 'github' && (
                  <a
                    href={task.github_issue_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-900 text-white dark:bg-gray-700 dark:text-gray-100 hover:bg-gray-700 transition"
                  >
                    <GithubIcon className="w-3.5 h-3.5" />
                    {task.github_issue_number
                      ? `Issue #${task.github_issue_number}`
                      : 'GitHub'}
                  </a>
                )}
              </div>

              {task.description && (
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mt-2 max-w-4xl">
                  {task.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-5 mt-5 text-xs text-slate-500 dark:text-slate-400">
                {task.task_link && (
                  <a
                    href={task.task_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400 hover:underline bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/60"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open Campaign Link
                  </a>
                )}

                {task.deadline && (
                  <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Deadline:{' '}
                    <strong className="text-slate-700 dark:text-slate-200">
                      {new Date(task.deadline).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'Asia/Kolkata',
                      })}{' '}
                      IST
                    </strong>
                  </span>
                )}

                {task.created_at && (
                  <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    Created:{' '}
                    <strong className="text-slate-700 dark:text-slate-200">
                      {new Date(task.created_at).toLocaleDateString()}
                    </strong>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Overall Completion Metric Cards */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            Overall Completion Metrics
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total Target Interns */}
          <Card className="p-5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Target Interns
              </span>
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
              {summary?.total_interns || 0}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Eligible for this task
            </p>
          </Card>

          {/* Overall Completion Rate */}
          <Card className="p-5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Completion Rate
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-2">
              {summary?.completion_rate || 0}%
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-indigo-600 dark:bg-indigo-400 h-full transition-all duration-500"
                style={{ width: `${summary?.completion_rate || 0}%` }}
              />
            </div>
          </Card>

          {/* Verified / Completed */}
          <Card className="p-5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Verified
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
              {summary?.verified_count || 0}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Confirmed completed
            </p>
          </Card>

          {/* Pending Verification */}
          <Card className="p-5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Pending
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">
              {summary?.pending_count || 0}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Awaiting review
            </p>
          </Card>

          {/* Not Submitted / Overdue */}
          <Card className="p-5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                {isTaskOverdue ? 'Overdue / Missed' : 'Not Submitted'}
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 flex items-center justify-center">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-2">
              {summary?.not_submitted_count || 0}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isTaskOverdue ? 'Deadline passed' : 'Yet to submit'}
            </p>
          </Card>
        </div>
      </div>

      {/* Department-wise Completion Breakdown Section */}
      <Card className="p-6 md:p-7 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
        <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/60">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
                Department-wise Completion Analytics
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Progress and submission breakdown by department.
              </p>
            </div>
          </div>
        </div>

        {!filteredDepartmentStats.length ? (
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-6 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No department data available.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDepartmentStats.map((dept) => {
              const rate = dept.completion_rate || 0;
              const total = dept.total_interns || 0;

              return (
                <div
                  key={dept.department_id || 'unassigned'}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 flex flex-col justify-between transition hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                          {dept.department_name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {total} intern{total === 1 ? '' : 's'} assigned
                        </p>
                      </div>

                      <span
                        className={`text-sm font-extrabold px-2.5 py-1 rounded-xl ${
                          rate >= 75
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : rate >= 40
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {rate}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-4">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  </div>

                  {/* Sub-counts */}
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200 dark:border-slate-700 text-center">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Verified
                      </span>
                      <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                        {dept.verified_count || 0}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Pending
                      </span>
                      <p className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                        {dept.pending_count || 0}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Pending Sub.
                      </span>
                      <p className="text-sm font-extrabold text-slate-600 dark:text-slate-300">
                        {dept.not_submitted_count || 0}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Intern Completion Roster & Filter Controls */}
      <Card className="p-6 md:p-7 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
              Intern Task Submissions
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Track completion status and view proofs submitted by individual
              interns.
            </p>
          </div>

          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Showing {filteredInterns.length} of {interns.length} intern
            {interns.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap gap-3 items-center mb-6 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              placeholder="Search by intern name, email, or domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <div className="w-full sm:w-56">
            <CustomSelect
              value={selectedDeptId}
              onChange={setSelectedDeptId}
              options={departmentOptions}
              placeholder="Filter by Department"
              className="w-full"
            />
          </div>

          <div className="w-full sm:w-56">
            <CustomSelect
              value={selectedStatus}
              onChange={setSelectedStatus}
              options={statusOptions}
              placeholder="Filter by Status"
              className="w-full"
            />
          </div>
        </div>

        {/* Intern Roster Table */}
        {!filteredInterns.length ? (
          <EmptyState
            icon={<Users className="w-12 h-12 text-slate-400" />}
            title="No interns found"
            text={
              searchQuery || selectedDeptId || selectedStatus
                ? 'No interns match the selected filters.'
                : 'No target interns found for this task.'
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950 text-left text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-5 py-3.5 font-extrabold">Intern</th>
                  <th className="px-5 py-3.5 font-extrabold">Department</th>
                  <th className="px-5 py-3.5 font-extrabold">Domain / Role</th>
                  <th className="px-5 py-3.5 font-extrabold">Status</th>
                  <th className="px-5 py-3.5 font-extrabold">Submitted Date</th>
                  <th className="px-5 py-3.5 font-extrabold text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredInterns.map((intern, idx) => {
                  const hasProof = !!intern.proof_id;
                  const isVerified = intern.proof_status === 'VERIFIED';
                  const isPending = intern.proof_status === 'PENDING';
                  const isOverdueState = !hasProof && isTaskOverdue;

                  return (
                    <tr
                      key={intern.id}
                      className={`transition-colors ${
                        idx % 2 === 0
                          ? 'bg-white dark:bg-slate-900'
                          : 'bg-slate-50/50 dark:bg-slate-800/30'
                      } hover:bg-indigo-50/50 dark:hover:bg-slate-800/80`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-xs font-extrabold border border-indigo-100 dark:border-indigo-900/60">
                            {initials(intern.full_name, intern.email)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-extrabold text-slate-900 dark:text-white truncate">
                              {intern.full_name || '—'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {intern.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-300">
                        {intern.department_name || 'Unassigned'}
                      </td>

                      <td className="px-5 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {intern.position || 'Intern'}
                      </td>

                      <td className="px-5 py-4">
                        {isVerified ? (
                          <Badge color="green">Verified / Completed</Badge>
                        ) : isPending ? (
                          <Badge color="yellow">Pending Review</Badge>
                        ) : isOverdueState ? (
                          <Badge color="red">Overdue</Badge>
                        ) : (
                          <Badge color="gray">Not Submitted</Badge>
                        )}
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {intern.submitted_at
                          ? new Date(intern.submitted_at).toLocaleString(
                              'en-IN',
                              {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                                timeZone: 'Asia/Kolkata',
                              }
                            )
                          : '—'}
                      </td>

                      <td className="px-5 py-4 text-right">
                        {hasProof ? (
                          <button
                            type="button"
                            onClick={() => setActiveProofIntern(intern)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Proof
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            No proof
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Proof Inspection Modal */}
      {activeProofIntern && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setActiveProofIntern(null)}
              className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-extrabold">
                {initials(activeProofIntern.full_name, activeProofIntern.email)}
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                  {activeProofIntern.full_name || activeProofIntern.email}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activeProofIntern.department_name} ·{' '}
                  {activeProofIntern.position || 'Intern'}
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Status and Actions */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">
                    Status:
                  </span>
                  <Badge
                    color={
                      activeProofIntern.proof_status === 'VERIFIED'
                        ? 'green'
                        : 'yellow'
                    }
                  >
                    {activeProofIntern.proof_status || 'PENDING'}
                  </Badge>
                </div>

                {activeProofIntern.proof_status === 'PENDING' && (
                  <Btn
                    variant="success"
                    className="rounded-2xl py-1.5 text-xs"
                    disabled={verifyMutation.isPending}
                    onClick={() =>
                      verifyMutation.mutate({
                        proofId: activeProofIntern.proof_id,
                      })
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" />
                      {verifyMutation.isPending
                        ? 'Verifying...'
                        : 'Verify Proof'}
                    </span>
                  </Btn>
                )}
              </div>

              {/* Engagement Badges */}
              <div>
                <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                  Reported Engagement Actions
                </label>
                <div className="flex flex-wrap gap-2">
                  {activeProofIntern.did_comment && (
                    <Badge color="blue">✓ Commented</Badge>
                  )}
                  {activeProofIntern.did_repost && (
                    <Badge color="purple">✓ Reposted</Badge>
                  )}
                  {activeProofIntern.did_share && (
                    <Badge color="green">✓ Shared</Badge>
                  )}
                  {!activeProofIntern.did_comment &&
                    !activeProofIntern.did_repost &&
                    !activeProofIntern.did_share && (
                      <span className="text-xs text-slate-400">
                        No specific social action flags checked.
                      </span>
                    )}
                </div>
              </div>

              {/* Uploaded Proof Images */}
              <div>
                <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                  Submitted Proof Images (
                  {activeProofIntern.images?.length || 0})
                </label>

                {!activeProofIntern.images?.length ? (
                  <p className="text-xs text-slate-400 italic">
                    No image files attached.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {activeProofIntern.images.map((imgObj, i) => {
                      const imgPath = imgObj.image_path || imgObj;
                      const normalized = imgPath
                        .replace(/\\/g, '/')
                        .replace(/^\/+/, '');
                      const base = (
                        import.meta.env.VITE_API_URL ||
                        import.meta.env.VITE_API_BASE_URL ||
                        ''
                      ).replace(/\/+$/, '');
                      const src = base
                        ? `${base}/${normalized}`
                        : `/${normalized}`;

                      return (
                        <div
                          key={i}
                          className="relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        >
                          <img
                            src={src}
                            alt={`Proof ${i + 1}`}
                            className="w-full h-36 object-cover cursor-pointer hover:opacity-90 transition"
                            onClick={() => window.open(src, '_blank')}
                            onError={(e) => {
                              e.currentTarget.style.visibility = 'hidden';
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => window.open(src, '_blank')}
                            className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-black/60 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition"
                          >
                            Open Full
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                <Btn
                  variant="outline"
                  onClick={() => setActiveProofIntern(null)}
                  className="rounded-2xl"
                >
                  Close
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
