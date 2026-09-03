import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CalendarCheck,
  Star,
  Target,
  UserCog,
} from 'lucide-react';
import api from '../../lib/axios';
import useAuthStore from '../../store/auth';
import ManageTlModal from '../../components/admin/ManageTlModal';
import DeleteDepartmentModal from '../../components/admin/DeleteDepartmentModal';
import {
  Card,
  Btn,
  Input,
  EmptyState,
  Spinner,
  PageHeader,
} from '../../components/ui';

export default function Departments() {
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = currentUser?.role === 'ADMIN';
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [deletingDepartment, setDeletingDepartment] = useState(null);
  const [deleteStage, setDeleteStage] = useState('confirm');
  const [assignedUserCount, setAssignedUserCount] = useState(0);
  const [deleteError, setDeleteError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [managingDepartment, setManagingDepartment] = useState(null);

  const {
    data: departments = [],
    isLoading,
    isError,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r) => r.data),
  });

  useEffect(() => {
    if (isAdmin || isLoading || isError) return;

    const assignedDepartment = departments[0];
    if (assignedDepartment?.id) {
      navigate(`/departments/${assignedDepartment.id}/projects`, {
        replace: true,
      });
    }
  }, [departments, isAdmin, isError, isLoading, navigate]);

  const inv = () =>
    queryClient.invalidateQueries({ queryKey: ['departments'] });

  const createMut = useMutation({
    mutationFn: (n) => api.post('/departments', { name: n }),
    onSuccess: (res) => {
      setName('');
      setError('');
      setShowAddForm(false);
      inv();
      const newDept = res.data?.department ?? res.data;
      if (newDept?.id) {
        navigate(`/departments/${newDept.id}/projects`);
      }
    },
    onError: (err) =>
      setError(err.response?.data?.error || 'Failed to create department'),
  });

  const deleteMut = useMutation({
    mutationFn: ({ id, confirmation }) =>
      api.delete(`/departments/${id}`, {
        data: confirmation ? { confirmation } : {},
        _suppressGlobalError: true,
      }),
    onMutate: ({ id }) => {
      setDeletingId(id);
      setDeleteError('');
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['departments'] }),
        queryClient.invalidateQueries({ queryKey: ['adminUsers'] }),
        queryClient.invalidateQueries({ queryKey: ['teamMembers'] }),
        queryClient.invalidateQueries({ queryKey: ['departmentTeams'] }),
      ]);
      setDeletingDepartment(null);
      setDeleteStage('confirm');
      setAssignedUserCount(0);
      setDeleteError('');
    },
    onError: (requestError) => {
      const response = requestError.response?.data;
      if (response?.code === 'DEPARTMENT_HAS_ASSIGNED_USERS') {
        setAssignedUserCount(response.userCount || 0);
        setDeleteStage('assigned');
        return;
      }
      setDeleteError(response?.error || 'Failed to delete department');
    },
    onSettled: () => setDeletingId(null),
  });

  const COLORS = [
    'from-indigo-500 to-blue-600',
    'from-emerald-500 to-teal-600',
    'from-amber-400 to-orange-500',
    'from-violet-500 to-purple-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-sky-600',
  ];

  if (!isAdmin && !isError) {
    return (
      <div className="flex justify-center p-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      {/* Professional Header Block */}
      <PageHeader
        title="Departments"
        subtitle="Organize your workforce into structural units"
        icon={<Building2 className="w-6 h-6" />}
        actions={
          isAdmin ? (
            <Btn
              onClick={() => {
                setError('');
                setName('');
                setShowAddForm(!showAddForm);
              }}
              className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-extrabold rounded-2xl"
            >
              {showAddForm ? 'Cancel' : 'Add Department'}
            </Btn>
          ) : null
        }
      />

      {isAdmin && showAddForm && (
        <Card className="p-6 md:p-7 mb-6 border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-white via-slate-50 to-indigo-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none animate-fade-in-up">
          <div className="flex items-center gap-4 mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/60 shrink-0">
              <Plus className="w-5 h-5" />
            </div>

            <div>
              <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
                Add New Department
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Create a department to group users and reports.
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 text-sm mb-4 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-2xl border border-rose-100 dark:border-rose-900/60">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) createMut.mutate(name.trim());
            }}
            className="flex gap-3 flex-wrap"
          >
            <Input
              placeholder="E.g., Social Media Marketing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-md"
            />

            <Btn
              type="submit"
              disabled={createMut.isPending}
              className="rounded-2xl px-5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:shadow-indigo-200 dark:hover:shadow-none"
            >
              {createMut.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Department
                </span>
              )}
            </Btn>
          </form>
        </Card>
      )}
      {isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <h3 className="text-lg font-semibold text-red-700">
            Failed to load departments
          </h3>

          <Btn className="mt-4" onClick={() => refetch()}>
            Retry
          </Btn>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : departments.length === 0 ? (
        <EmptyState
          icon={
            <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600" />
          }
          title="No departments yet"
          text="Create your first department above to get started."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {departments.map((d, i) => (
            <Card
              key={d.id}
              hover
              onClick={() => navigate(`/departments/${d.id}/projects`)}
              className="p-5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none group"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${
                    COLORS[i % COLORS.length]
                  } text-white flex items-center justify-center shadow-sm shrink-0`}
                >
                  <Building2 className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                    {d.name}
                  </p>

                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
                    Created{' '}
                    {d.created_at
                      ? new Date(d.created_at).toLocaleDateString()
                      : '—'}
                  </p>
                </div>

                {isAdmin && (
                  <button
                    disabled={deletingId === d.id || deleteMut.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteError('');
                      setAssignedUserCount(0);
                      setDeleteStage('confirm');
                      setDeletingDepartment(d);
                    }}
                    className="text-slate-300 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-2 rounded-xl transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete department"
                  >
                    {deletingId === d.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>

              {/* Department Sub-sections for Admin Hierarchy */}
              <div
                className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap"
                onClick={(e) => e.stopPropagation()}
              >
                <Link
                  to={`/admin/departments/${d.id}/attendance`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 transition-shadow duration-200 ease-out hover:bg-emerald-200 dark:hover:bg-white/10 hover:ring-1 hover:ring-emerald-400/40"
                  title="View & manage attendance for this department"
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  Attendance
                </Link>

                <Link
                  to={`/admin/departments/${d.id}/ratings`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 transition-shadow duration-200 ease-out hover:bg-amber-200 dark:hover:bg-white/10 hover:ring-1 hover:ring-amber-400/40 "
                  title="View ratings for this department"
                >
                  <Star className="w-3.5 h-3.5" />
                  Ratings
                </Link>

                <Link
                  to={`/admin/departments/${d.id}/tasks`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 transition-shadow duration-200 ease-out hover:bg-indigo-200 dark:hover:bg-white/10 hover:ring-1 hover:ring-indigo-400/40 "
                  title="View tasks for this department"
                >
                  <Target className="w-3.5 h-3.5" />
                  Tasks
                </Link>
                <button
                  type="button"
                  onClick={() => setManagingDepartment(d)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 transition-shadow duration-200 ease-out hover:ring-1 hover:ring-violet-400/40 "
                  title="Replace this department's Senior TL safely"
                >
                  <UserCog className="w-3.5 h-3.5" />
                  Manage Senior TL
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {deletingDepartment && (
        <DeleteDepartmentModal
          department={deletingDepartment}
          stage={deleteStage}
          userCount={assignedUserCount}
          error={deleteError}
          pending={deleteMut.isPending}
          onClose={() => {
            if (!deleteMut.isPending) {
              setDeletingDepartment(null);
              setDeleteStage('confirm');
              setDeleteError('');
            }
          }}
          onDelete={(confirmation) =>
            deleteMut.mutate({ id: deletingDepartment.id, confirmation })
          }
          onContinue={() => {
            setDeleteError('');
            setDeleteStage('remove');
          }}
          onViewUsers={() =>
            navigate(`/admin?departmentId=${deletingDepartment.id}`)
          }
        />
      )}
      {managingDepartment && (
        <ManageTlModal
          department={managingDepartment}
          onClose={() => setManagingDepartment(null)}
          onCompleted={async () => {
            setManagingDepartment(null);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['departments'] }),
              queryClient.invalidateQueries({ queryKey: ['departmentTeams'] }),
              queryClient.invalidateQueries({
                queryKey: ['departmentSeniorTlCandidates'],
              }),
              queryClient.invalidateQueries({ queryKey: ['teamMembers'] }),
            ]);
          }}
        />
      )}
    </div>
  );
}
