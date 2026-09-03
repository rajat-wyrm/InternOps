import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Users,
  UserRound,
  X,
  Building2,
  UserCog,
} from 'lucide-react';
import api from '../../lib/axios';
import useAuthStore from '../../store/auth';
import ManageTlModal from '../../components/admin/ManageTlModal';
import {
  PageHeader,
  Card,
  Badge,
  Spinner,
  ApiErrorState,
  Btn,
  Input,
} from '../../components/ui';

const STRONG_PASSWORD =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const WEAK_PASSWORD_MESSAGE =
  'Password is too weak. Use at least 8 characters with uppercase, lowercase, number, and special character.';

export default function ProjectsPage() {
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = currentUser?.role === 'ADMIN';
  const canOpenHierarchyCard = (team) =>
    isAdmin ||
    currentUser?.role === 'SENIOR_TL' ||
    team.lead_id === currentUser?.id ||
    (currentUser?.role === 'TL' && team.role === 'CAPTAIN');
  const navigate = useNavigate();
  const { deptId } = useParams();
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManageTlOpen, setIsManageTlOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    role: 'SENIOR_TL',
    password: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r) => r.data),
  });

  const {
    data: teams = [],
    isLoading,
    error: teamsError,
    refetch,
  } = useQuery({
    queryKey: ['departmentTeams', deptId],
    queryFn: () => api.get(`/departments/${deptId}/teams`).then((r) => r.data),
    enabled: !!deptId,
  });

  const createSeniorTlMutation = useMutation({
    mutationFn: (data) =>
      api.post('/team/members', data, { _suppressGlobalError: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departmentTeams', deptId] });
      setSuccess('Senior TL created successfully!');
      setForm({
        fullName: '',
        email: '',
        role: 'SENIOR_TL',
        password: '',
      });
      setTimeout(() => {
        setSuccess('');
        setIsModalOpen(false);
      }, 1500);
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to create Senior TL');
    },
  });

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!STRONG_PASSWORD.test(form.password)) {
      setError(WEAK_PASSWORD_MESSAGE);
      return;
    }
    createSeniorTlMutation.mutate({
      full_name: form.fullName,
      email: form.email.trim().toLowerCase(),
      role: form.role,
      password: form.password,
      department_id: deptId,
    });
  };

  const department = departments.find((item) => item.id === deptId);
  const hasSeniorTl = teams.some((team) => team.role === 'SENIOR_TL');
  const canReplaceSeniorTl =
    hasSeniorTl && (isAdmin || currentUser?.role === 'SENIOR_TL');

  return (
    <div className="animate-fade-in-up">
      <div className="mb-5">
        {isAdmin && (
          <Btn
            variant="outline"
            onClick={() => navigate('/departments')}
            className="mb-4"
          >
            <span className="inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Departments
            </span>
          </Btn>
        )}

        <PageHeader
          title={
            department?.name ? `${department.name} Department` : 'Department'
          }
          subtitle="Review the department hierarchy, roster, attendance, and ratings."
          icon={<Building2 className="w-6 h-6" />}
          actions={
            <div className="flex items-center gap-3">
              {!isLoading && !teamsError && canReplaceSeniorTl && (
                <Btn
                  variant="outline"
                  onClick={() => setIsManageTlOpen(true)}
                  className="rounded-2xl font-extrabold whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-2">
                    <UserCog className="w-4 h-4 shrink-0" />
                    <span>Replace Senior TL</span>
                  </span>
                </Btn>
              )}
              {isAdmin && !isLoading && !teamsError && !hasSeniorTl && (
                <Btn
                  onClick={() => {
                    setForm({
                      fullName: '',
                      email: '',
                      role: 'SENIOR_TL',
                      password: '',
                    });
                    setError('');
                    setSuccess('');
                    setIsModalOpen(true);
                  }}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold rounded-2xl"
                >
                  Create Senior TL
                </Btn>
              )}
            </div>
          }
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : teamsError ? (
        <ApiErrorState
          error={teamsError}
          title="Failed to load department projects"
          fallback="Unable to load project leads for this department."
          onRetry={refetch}
        />
      ) : teams.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            No project leads found in this department.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {teams.map((team) => {
            const canOpen = canOpenHierarchyCard(team);
            return (
              <Card
                key={team.lead_id}
                hover={canOpen}
                onClick={
                  canOpen
                    ? () =>
                        navigate(
                          `/departments/${deptId}/projects/${team.lead_id}`
                        )
                    : undefined
                }
                aria-disabled={!canOpen}
                className={`group border border-slate-200 bg-white p-5 shadow-[0_14px_35px_rgba(15,23,42,0.06)] transition-colors duration-200 dark:border-slate-700/80 dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 dark:shadow-[0_12px_28px_rgba(0,0,0,0.20)] ${
                  canOpen
                    ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500/50'
                    : 'cursor-default'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
                        <UserRound className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                          {team.lead_name || 'Unnamed Lead'}
                        </p>
                        <Badge
                          color={
                            team.role === 'CAPTAIN'
                              ? 'teal'
                              : team.role === 'TL'
                                ? 'indigo'
                                : 'purple'
                          }
                          className="mt-1"
                        >
                          {team.role.replaceAll('_', ' ')}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-5 flex min-h-[82px] flex-col justify-start gap-3 border-t border-slate-200 pt-4 dark:border-slate-700/70">
                      <p className="text-sm font-extrabold leading-none text-slate-700 dark:text-slate-100">
                        {team.member_count}{' '}
                        {team.role === 'SENIOR_TL'
                          ? 'visible members'
                          : 'assigned members'}
                      </p>

                      <div className="flex min-h-7 flex-wrap items-start gap-2">
                        {team.role === 'SENIOR_TL' && (
                          <>
                            <span className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-extrabold text-violet-700 shadow-sm dark:border-violet-500/40 dark:bg-violet-500/20 dark:text-violet-100">
                              {team.tl_count || 0} TL
                            </span>

                            <span className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-extrabold text-teal-700 shadow-sm dark:border-teal-500/40 dark:bg-teal-500/20 dark:text-teal-100">
                              {team.captain_count || 0}{' '}
                              {team.captain_count === 1
                                ? 'Captain'
                                : 'Captains'}
                            </span>

                            <span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-extrabold text-blue-700 shadow-sm dark:border-blue-500/40 dark:bg-blue-500/20 dark:text-blue-100">
                              {team.intern_count || 0}{' '}
                              {team.intern_count === 1 ? 'Intern' : 'Interns'}
                            </span>
                          </>
                        )}

                        {team.role === 'TL' && (
                          <>
                            <span className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-extrabold text-teal-700 shadow-sm dark:border-teal-500/40 dark:bg-teal-500/20 dark:text-teal-100">
                              {team.captain_count || 0}{' '}
                              {team.captain_count === 1
                                ? 'Captain'
                                : 'Captains'}
                            </span>

                            <span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-extrabold text-blue-700 shadow-sm dark:border-blue-500/40 dark:bg-blue-500/20 dark:text-blue-100">
                              {team.intern_count || 0}{' '}
                              {team.intern_count === 1 ? 'Intern' : 'Interns'}
                            </span>
                          </>
                        )}

                        {team.role === 'CAPTAIN' && (
                          <span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-extrabold text-blue-700 shadow-sm dark:border-blue-500/40 dark:bg-blue-500/20 dark:text-blue-100">
                            {team.intern_count || 0}{' '}
                            {team.intern_count === 1 ? 'Intern' : 'Interns'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Users className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition-colors" />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {isManageTlOpen && department && (
        <ManageTlModal
          department={department}
          onClose={() => setIsManageTlOpen(false)}
          onCompleted={async () => {
            setIsManageTlOpen(false);
            await Promise.all([
              queryClient.invalidateQueries({
                queryKey: ['departmentTeams', deptId],
              }),
              queryClient.invalidateQueries({
                queryKey: ['departmentSeniorTlCandidates', deptId],
              }),
              queryClient.invalidateQueries({ queryKey: ['teamMembers'] }),
            ]);
          }}
        />
      )}

      {/* Create Senior TL Modal */}
      {isModalOpen &&
        createPortal(
          <div className="internops-modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <div className="internops-modal-panel w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-6 relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-4">
                Create Senior TL
              </h3>
              {error && (
                <div className="text-rose-700 dark:text-rose-300 text-sm mb-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/60 px-4 py-2.5 rounded-2xl">
                  {error}
                </div>
              )}
              {success && (
                <div className="text-emerald-700 dark:text-emerald-300 text-sm mb-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 px-4 py-2.5 rounded-2xl font-bold">
                  {success}
                </div>
              )}
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                    Full Name
                  </label>
                  <Input
                    placeholder="E.g., Priya Sharma"
                    name="new-senior-tl-full-name"
                    autoComplete="off"
                    value={form.fullName}
                    onChange={(e) =>
                      setForm({ ...form, fullName: e.target.value })
                    }
                    required
                    disabled={createSeniorTlMutation.isPending}
                  />
                </div>
                <div>
                  <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                    Email
                  </label>
                  <Input
                    type="email"
                    name="new-senior-tl-email"
                    autoComplete="off"
                    placeholder="E.g., senior.tl@internops.com"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    required
                    disabled={createSeniorTlMutation.isPending}
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                    Temporary Password
                  </label>
                  <Input
                    type="password"
                    name="new-senior-tl-password"
                    autoComplete="new-password"
                    placeholder="Set a temporary password"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    required
                    minLength={8}
                    disabled={createSeniorTlMutation.isPending}
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Use 8 or more characters with uppercase, lowercase, number,
                    and special character.
                  </p>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Btn
                    variant="outline"
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={createSeniorTlMutation.isPending}
                  >
                    Cancel
                  </Btn>
                  <Btn
                    variant="primary"
                    type="submit"
                    disabled={createSeniorTlMutation.isPending}
                  >
                    {createSeniorTlMutation.isPending
                      ? 'Creating Senior TL...'
                      : 'Create Senior TL'}
                  </Btn>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
