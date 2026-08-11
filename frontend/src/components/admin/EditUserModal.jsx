import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HelpCircle, Layers, Mail, Pencil, User, X } from 'lucide-react';
import api from '../../lib/axios';
import CustomSelect from '../CustomSelect';

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SENIOR_TL', label: 'Senior TL' },
  { value: 'TL', label: 'TL' },
  { value: 'CAPTAIN', label: 'Captain' },
  { value: 'INTERN', label: 'Intern' },
];

export default function EditUserModal({ open, user, onClose }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!open || !user) return undefined;

    setFullName(user.full_name || '');
    setEmail(user.email || '');
    setRole(user.role || '');
    setDepartmentId(user.department_id || '');
    setManagerId(user.manager_id || '');
    setError('');
    setSuccessMsg('');
    document.body.classList.add('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [open, user]);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((res) => res.data || []),
    enabled: open,
  });

  const { data: captains = [] } = useQuery({
    queryKey: ['usersByRole', 'CAPTAIN'],
    queryFn: () =>
      api
        .get('/users?role=CAPTAIN&limit=100')
        .then((res) => res.data?.data || []),
    enabled: open && role === 'INTERN',
  });

  const { data: tls = [] } = useQuery({
    queryKey: ['usersByRole', 'TL'],
    queryFn: () =>
      api.get('/users?role=TL&limit=100').then((res) => res.data?.data || []),
    enabled: open && (role === 'INTERN' || role === 'CAPTAIN'),
  });

  const { data: seniorTls = [] } = useQuery({
    queryKey: ['usersByRole', 'SENIOR_TL'],
    queryFn: () =>
      api
        .get('/users?role=SENIOR_TL&limit=100')
        .then((res) => res.data?.data || []),
    enabled: open && (role === 'CAPTAIN' || role === 'TL'),
  });

  const managerOptions = useMemo(() => {
    let managers = [];
    if (role === 'INTERN') managers = [...captains, ...tls];
    if (role === 'CAPTAIN') managers = [...tls, ...seniorTls];
    if (role === 'TL') managers = seniorTls;

    return managers.filter((candidate) => candidate.id !== user?.id);
  }, [captains, role, seniorTls, tls, user?.id]);

  const showManagerSelection = ['INTERN', 'CAPTAIN', 'TL'].includes(role);

  const departmentOptions = [
    { value: '', label: 'No department' },
    ...departments.map((department) => ({
      value: department.id,
      label: department.name,
    })),
  ];

  const reportsToOptions = [
    { value: '', label: 'No manager' },
    ...managerOptions.map((manager) => ({
      value: manager.id,
      label: `${manager.full_name || manager.email} (${manager.role})`,
    })),
  ];

  const updateMutation = useMutation({
    mutationFn: (payload) =>
      api.patch(`/users/${user.id}`, payload).then((res) => res.data),
    onSuccess: async () => {
      setError('');
      setSuccessMsg('User account updated successfully.');
      await queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      await queryClient.invalidateQueries({ queryKey: ['usersByRole'] });

      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 900);
    },
    onError: (err) => {
      setSuccessMsg('');
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'User update failed'
      );
    },
  });

  const handleClose = () => {
    if (updateMutation.isPending) return;
    setError('');
    setSuccessMsg('');
    onClose();
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!fullName.trim()) return setError('Full Name is required');
    if (!email.trim()) return setError('Email is required');
    if (!role) return setError('Role is required');

    updateMutation.mutate({
      full_name: fullName.trim(),
      email: email.trim(),
      role,
      department_id: departmentId || null,
      manager_id: showManagerSelection ? managerId || null : null,
    });
  };

  if (!open || !user) return null;

  const inputClass =
    'w-full pl-11 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30 outline-none transition text-sm disabled:opacity-60';
  const labelClass =
    'block text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-3xl max-h-[88vh] rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl animate-scale-up text-slate-900 dark:text-white overflow-hidden flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold">Edit User</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Update account and reporting details
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={updateMutation.isPending}
            className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition disabled:opacity-50"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 flex flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {error && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/60 text-red-700 dark:text-red-300 text-sm rounded-2xl px-4 py-3 mb-4 font-medium">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-sm rounded-2xl px-4 py-3 mb-4 font-medium">
                {successMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    disabled={updateMutation.isPending}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={updateMutation.isPending}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>User Role</label>
                <div className="relative">
                  <Layers className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                  <CustomSelect
                    value={role}
                    onChange={(value) => {
                      setRole(value);
                      setManagerId('');
                    }}
                    options={ROLE_OPTIONS}
                    disabled={updateMutation.isPending}
                    className="[&>button]:pl-11"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Department</label>
                <div className="relative">
                  <HelpCircle className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                  <CustomSelect
                    value={departmentId}
                    onChange={setDepartmentId}
                    options={departmentOptions}
                    disabled={updateMutation.isPending}
                    className="[&>button]:pl-11"
                  />
                </div>
              </div>

              {showManagerSelection && (
                <div className="md:col-span-2">
                  <label className={labelClass}>Assign Manager</label>
                  <CustomSelect
                    value={managerId}
                    onChange={setManagerId}
                    options={reportsToOptions}
                    disabled={updateMutation.isPending}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    Manager choices follow the platform role hierarchy.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 flex justify-end gap-3 px-6 py-5 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={handleClose}
              disabled={updateMutation.isPending}
              className="px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm font-bold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:shadow-lg text-white font-extrabold transition disabled:opacity-50 text-sm"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
