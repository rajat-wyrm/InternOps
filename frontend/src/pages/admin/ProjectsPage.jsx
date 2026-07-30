import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { ArrowLeft, Users, UserRound, X } from 'lucide-react';
import api from '../../lib/axios';
import {
  PageHeader,
  Card,
  Badge,
  Spinner,
  ApiErrorState,
  Btn,
  Input,
} from '../../components/ui';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { deptId } = useParams();
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const addProjectMutation = useMutation({
    mutationFn: (data) => api.post('/team/members', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departmentTeams', deptId] });
      setSuccess('✓ Project added successfully!');
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
      setError(err.response?.data?.error || 'Failed to add project');
    },
  });

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    addProjectMutation.mutate({
      full_name: form.fullName,
      email: form.email,
      role: form.role,
      password: form.password,
      department_id: deptId,
    });
  };

  const department = departments.find((item) => item.id === deptId);

  return (
    <div className="animate-fade-in-up">
      <div className="mb-5">
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

        <PageHeader
          title={
            department?.name
              ? `${department.name} Projects`
              : 'Department Projects'
          }
          subtitle="Pick a project lead to inspect the roster, attendance, and ratings."
          icon="🏢"
          actions={
            <Btn
              onClick={() => {
                setError('');
                setSuccess('');
                setIsModalOpen(true);
              }}
              className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-extrabold rounded-2xl"
            >
              Add Project
            </Btn>
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
          {teams.map((team) => (
            <Card
              key={team.lead_id}
              hover
              onClick={() =>
                navigate(`/departments/${deptId}/projects/${team.lead_id}`)
              }
              className="p-5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none group"
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
                        {team.role}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {team.member_count} direct report
                    {team.member_count === 1 ? '' : 's'}
                  </p>
                </div>

                <Users className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition-colors" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Project Modal */}
      {isModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-6 relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-4">
                Add New Project
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
                    Project Name / Lead Full Name
                  </label>
                  <Input
                    placeholder="E.g., AI Tutor"
                    value={form.fullName}
                    onChange={(e) =>
                      setForm({ ...form, fullName: e.target.value })
                    }
                    required
                    disabled={addProjectMutation.isPending}
                  />
                </div>
                <div>
                  <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                    Lead Email
                  </label>
                  <Input
                    type="email"
                    placeholder="E.g., lead@internops.com"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    required
                    disabled={addProjectMutation.isPending}
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                    Lead Password (Min 8 characters)
                  </label>
                  <Input
                    type="password"
                    placeholder="Set password for account"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    required
                    minLength={8}
                    disabled={addProjectMutation.isPending}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Btn
                    variant="outline"
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={addProjectMutation.isPending}
                  >
                    Cancel
                  </Btn>
                  <Btn
                    variant="primary"
                    type="submit"
                    disabled={addProjectMutation.isPending}
                  >
                    {addProjectMutation.isPending ? 'Adding...' : 'Add Project'}
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
