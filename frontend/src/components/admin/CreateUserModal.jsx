import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Layers,
  HelpCircle,
  X,
} from 'lucide-react';
import api from '../../lib/axios';

export default function CreateUserModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!open) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  // Fetch departments dynamically
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((res) => res.data || []),
    enabled: open,
  });

  // Fetch potential managers based on selected role to respect hierarchy
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

  // Determine manager options based on hierarchy rules
  const managerOptions = (() => {
    if (role === 'INTERN') return [...captains, ...tls];
    if (role === 'CAPTAIN') return [...tls, ...seniorTls];
    if (role === 'TL') return seniorTls;
    return [];
  })();

  const showManagerSelection = ['INTERN', 'CAPTAIN', 'TL'].includes(role);

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: (payload) =>
      api.post('/auth/register', payload).then((res) => res.data),
    onSuccess: () => {
      setSuccessMsg('User account provisioned successfully.');
      setError('');

      // Invalidate users directory query so lists refresh
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });

      // Reset form
      setFullName('');
      setEmail('');
      setPassword('');
      setRole('');
      setDepartmentId('');
      setManagerId('');

      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1400);
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Registration failed');
      setSuccessMsg('');
    },
  });

  const handleClose = () => {
    // Clear errors and messages on close
    setError('');
    setSuccessMsg('');
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!fullName.trim()) return setError('Full Name is required');
    if (!email.trim()) return setError('Email is required');
    if (!password) return setError('Temporary Password is required');
    if (password.length < 8)
      return setError('Password must be at least 8 characters');
    if (!role) return setError('Role is required');

    const payload = {
      fullName,
      email,
      password,
      role,
      departmentId: departmentId || undefined,
      managerId: managerId || undefined,
    };

    registerMutation.mutate(payload);
  };

  if (!open) return null;

  const inputClass =
    'w-full pl-11 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30 outline-none transition text-sm';

  const selectClass =
    'w-full pl-11 pr-11 py-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30 outline-none transition text-sm appearance-none';

  const labelClass =
    'block text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2';

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-3xl max-h-[88vh] rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl animate-scale-up text-slate-900 dark:text-white overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Add New User
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Provision a secure workforce account
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="min-h-0 flex-1 flex flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            {error && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/60 text-red-700 dark:text-red-300 text-sm rounded-2xl px-4 py-3 mb-4 animate-fade-in font-medium">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-sm rounded-2xl px-4 py-3 mb-4 animate-fade-in font-medium">
                {successMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className={labelClass}>Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className={labelClass}>Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="johndoe@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Temporary Password */}
              <div>
                <label className={labelClass}>Temporary Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30 outline-none transition text-sm"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Role selection */}
              <div>
                <label className={labelClass}>User Role</label>
                <div className="relative">
                  <Layers className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <select
                    required
                    value={role}
                    onChange={(e) => {
                      setRole(e.target.value);
                      setManagerId(''); // Reset manager on role change
                    }}
                    className={selectClass}
                  >
                    <option value="">Select Role</option>
                    <option value="SENIOR_TL">Senior TL</option>
                    <option value="TL">TL</option>
                    <option value="CAPTAIN">Captain</option>
                    <option value="INTERN">Intern</option>
                  </select>
                </div>
              </div>

              {/* Department */}
              <div>
                <label className={labelClass}>Department</label>
                <div className="relative">
                  <HelpCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Select Dept</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Hierarchy Selection */}
              {showManagerSelection && (
                <div className="md:col-span-2">
                  <label className={labelClass}>Assign Manager</label>
                  <select
                    value={managerId}
                    onChange={(e) => setManagerId(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30 outline-none transition text-sm"
                  >
                    <option value="">Select Reports-To Manager</option>
                    {managerOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name || m.email} ({m.role})
                      </option>
                    ))}
                  </select>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    Ensures access permissions are mapped recursively according
                    to the hierarchy.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer buttons */}
          <div className="shrink-0 flex justify-end gap-3 px-6 py-5 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm font-bold"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:shadow-lg hover:shadow-indigo-200 dark:hover:shadow-none text-white font-extrabold transition disabled:opacity-50 text-sm"
            >
              {registerMutation.isPending ? 'Provisioning...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
