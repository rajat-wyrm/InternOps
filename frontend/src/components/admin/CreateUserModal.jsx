import { useState } from 'react';
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
import useAuthStore from '../../store/auth';

export default function CreateUserModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'ADMIN';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('');
  const [departmentId, setDepartmentId] = useState(
    !isAdmin && currentUser?.department_id ? currentUser.department_id : ''
  );
  const [managerId, setManagerId] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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
      setDepartmentId(
        !isAdmin && currentUser?.department_id ? currentUser.department_id : ''
      );
      setManagerId('');
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 2000);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl animate-scale-up text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center text-lg">
              👤
            </div>
            <div>
              <h2 className="text-lg font-bold">Add New User</h2>
              <p className="text-xs text-gray-400">
                Provision a secure workforce account
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="bg-error/10 border border-error/40 text-error text-sm rounded-lg px-4 py-2.5 animate-fade-in">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="bg-success/10 border border-success/40 text-brand-green text-sm rounded-lg px-4 py-2.5 animate-fade-in">
              {successMsg}
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                required
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 outline-none transition text-sm"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="email"
                required
                placeholder="johndoe@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 outline-none transition text-sm"
              />
            </div>
          </div>

          {/* Temporary Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Temporary Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 outline-none transition text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <Eye className="w-5 h-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Role selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                User Role
              </label>
              <div className="relative">
                <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <select
                  required
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    setManagerId(''); // Reset manager on role change
                  }}
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 outline-none transition text-sm appearance-none"
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
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Department
              </label>
              <div className="relative">
                <HelpCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 outline-none transition text-sm appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
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
          </div>

          {/* Dynamic Hierarchy Selection */}
          {showManagerSelection && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Assign Manager
              </label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 outline-none transition text-sm"
              >
                <option value="">Select Reports-To Manager</option>
                {managerOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name || m.email} ({m.role})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-gray-400 mt-1">
                Ensures access permissions are mapped recursively according to
                the hierarchy.
              </p>
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800 mt-6">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg border border-gray-700 text-white hover:bg-gray-800 transition text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="px-5 py-2 rounded-lg bg-brand-green hover:opacity-90 text-slate-950 font-bold transition disabled:opacity-50 text-sm"
            >
              {registerMutation.isPending ? 'Provisioning...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
