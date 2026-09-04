import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Camera,
  X,
  Pencil,
  Lock,
  CheckCircle2,
  AlertCircle,
  Mail,
  ShieldCheck,
  Building2,
  MapPin,
  CalendarDays,
  BriefcaseBusiness,
  Hash,
  MonitorSmartphone,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/axios';
import { resolveUploadUrl } from '../lib/uploadUrl';
import {
  Card,
  Btn,
  Input,
  Badge,
  Spinner,
  ApiErrorState,
  ConfirmationModal,
} from '../components/ui';
import useAuthStore from '../store/auth';
import useFeatureFlagsStore from '../store/featureFlags';

const ROLE_COLOR = {
  ADMIN: 'purple',
  SENIOR_TL: 'indigo',
  TL: 'blue',
  CAPTAIN: 'teal',
  INTERN: 'gray',
};
const ROLE_LABEL = {
  ADMIN: 'Admin',
  SENIOR_TL: 'Senior TL',
  TL: 'Team Lead',
  CAPTAIN: 'Captain',
  INTERN: 'Intern',
};
const POSITION_LABEL = {
  ADMIN: 'Administrator',
  SENIOR_TL: 'Senior Team Lead',
  TL: 'Team Lead',
  CAPTAIN: 'Captain',
  INTERN: 'Intern',
};

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

export default function Profile() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const fetchFlags = useFeatureFlagsStore((s) => s.fetchFlags);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [showRemoveAvatarModal, setShowRemoveAvatarModal] = useState(false);
  const {
    data: profile,
    isLoading,
    isError,
    error: profileError,
    refetch,
  } = useQuery({
    queryKey: ['myProfile'],
    queryFn: () => api.get('/users/me').then((res) => res.data),
  });

  useEffect(() => {
    if (!profile) return;
    const nameParts = (profile.full_name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    setFirstName(nameParts.shift() || '');
    setLastName(nameParts.join(' '));
  }, [profile]);

  const flash = (m) => {
    setMessage(m);
    setError('');
    setTimeout(() => setMessage(''), 2500);
  };
  const handleLastNameChange = (event) => {
    const value = event.target.value;
    setLastName(
      value.trim().toLowerCase() === (profile?.email || '').trim().toLowerCase()
        ? ''
        : value
    );
  };
  const combinedName = [firstName.trim(), lastName.trim()]
    .filter(Boolean)
    .join(' ');
  const validateProfile = () => {
    if (combinedName.length < 3 || combinedName.length > 100) {
      setNameError('Name must be between 3 and 100 characters.');
      return false;
    }
    const nameRegex = /^[\p{L}\p{M}\s'-]+$/u;
    if (!nameRegex.test(combinedName)) {
      setNameError('Name contains invalid characters.');
      return false;
    }
    setNameError('');
    return true;
  };
  const updateProfileMut = useMutation({
    mutationFn: (data) => api.patch('/users/me', data),
    onSuccess: (_res, vars) => {
      flash('Profile updated successfully');

      if (vars?.full_name && user) {
        setAuth({ user: { ...user, full_name: vars.full_name } });
      }

      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
    },
    onError: (err) =>
      setError(err.response?.data?.error || 'Failed to update profile'),
  });

  const changePasswordMut = useMutation({
    mutationFn: (data) => api.patch('/users/me/password', data),
    onSuccess: async () => {
      flash('Password changed successfully');
      if (user?.mustChangePassword) {
        setAuth({ user: { ...user, mustChangePassword: false } });
        await fetchFlags();
      }
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err) =>
      setError(err.response?.data?.error || 'Failed to change password'),
  });

  const avatarMut = useMutation({
    mutationFn: (file) => {
      const form = new FormData();
      form.append('file', file);

      return api.post('/uploads/avatar', form);
    },
    onSuccess: (res) => {
      flash('Avatar updated successfully');
      const newAvatarUrl = res.data?.avatar_url;
      if (user && newAvatarUrl) {
        setAuth({
          user: {
            ...user,
            avatar_url: newAvatarUrl,
          },
        });
      }
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err) =>
      setError(err.response?.data?.error || 'Avatar upload failed'),
  });
  const removeAvatarMut = useMutation({
    mutationFn: () => api.delete('/uploads/avatar'),
    onSuccess: () => {
      setShowRemoveAvatarModal(false);
      flash('Avatar removed successfully');

      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });

      if (user) {
        setAuth({
          user: {
            ...user,
            avatar_url: null,
          },
        });
      }
    },
    onError: (err) => {
      setShowRemoveAvatarModal(false);
      setError(err.response?.data?.error || 'Failed to remove avatar');
    },
  });

  const passwordChecks = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword),
    notObvious: !['12345678', 'password', 'password123'].includes(
      newPassword.toLowerCase()
    ),
  };
  const isStrongPassword = Object.values(passwordChecks).every(Boolean);
  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;
  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner label="Loading profile..." />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-7xl animate-fade-in-up">
        <div className="mb-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shadow-sm">
            <User className="w-6 h-6" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              My Profile
            </h1>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
              Manage your account details and security
            </p>
          </div>
        </div>

        <ApiErrorState
          error={profileError}
          title="Failed to load profile"
          fallback="Unable to load your profile. Please try again."
          onRetry={refetch}
        />
      </div>
    );
  }

  const displayName = profile?.full_name || 'Unnamed User';
  const displayEmail = profile?.email || '';
  const formatDate = (value) => {
    if (!value) return 'Not provided';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'Not provided'
      : date.toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
  };
  const isAdmin = profile?.role === 'ADMIN';
  const profileAvatarUrl = resolveUploadUrl(
    profile?.avatar_url || (isAdmin ? '/admin-default-avatar.svg' : null)
  );
  const scopeLabel = isAdmin ? 'Access scope' : 'Department';
  const accessScope = isAdmin
    ? 'Platform-wide'
    : profile?.department_name || 'No department';
  const positionLabel =
    POSITION_LABEL[profile?.role] || profile?.position || 'Not added';
  const accountDetails = [
    { label: scopeLabel, value: accessScope, icon: Building2 },
    ...(!isAdmin
      ? [
          {
            label: 'Intern Code',
            value: profile?.intern_code || 'Not provided',
            icon: Hash,
          },
        ]
      : []),
    { label: 'Position', value: positionLabel, icon: BriefcaseBusiness },
    ...(profile?.location
      ? [{ label: 'Location', value: profile.location, icon: MapPin }]
      : []),
    {
      label: 'Member since',
      value: formatDate(profile?.joining_date || profile?.created_at),
      icon: CalendarDays,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl animate-fade-in-up">
      {/* Professional Header Block */}
      <div className="mb-5 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shadow-sm">
          <User className="w-6 h-6" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            My Profile
          </h1>
          <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
            Manage your account details and security
          </p>
        </div>
      </div>

      {/* Alert Messages */}
      {user?.mustChangePassword && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <Lock className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="font-extrabold">Password change required</div>
            <div className="text-sm">
              Your current password is the temporary Intern Code. Change it
              below before using InternOps.
            </div>
          </div>
        </div>
      )}
      {message && (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-200 px-4 py-3 rounded-2xl mb-5 animate-fade-in shadow-sm">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">{message}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-200 px-4 py-3 rounded-2xl mb-5 animate-fade-in shadow-sm">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Compact Profile Summary */}
      <Card className="mb-5 border border-slate-200 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:shadow-none md:p-5">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
            <div className="w-32 shrink-0">
              <div className="relative mx-auto w-fit">
                {profileAvatarUrl ? (
                  <img
                    src={profileAvatarUrl}
                    alt="avatar"
                    className="h-24 w-24 rounded-3xl border-4 border-white bg-white object-cover shadow-xl dark:border-slate-900 dark:bg-slate-900"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-white bg-gradient-to-br from-indigo-500 via-blue-500 to-violet-600 text-3xl font-extrabold text-white shadow-xl dark:border-slate-900">
                    {initials(profile?.full_name, profile?.email)}
                  </div>
                )}
                {profile?.avatar_url && (
                  <button
                    type="button"
                    onClick={() => setShowRemoveAvatarModal(true)}
                    disabled={avatarMut.isPending || removeAvatarMut.isPending}
                    title="Remove profile image"
                    aria-label="Remove profile image"
                    className={`absolute -top-2 -right-2 z-10 flex h-8 w-8 items-center justify-center rounded-2xl border border-slate-200 bg-white text-rose-500 shadow-lg transition-all hover:scale-105 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/50 dark:border-slate-700 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 ${
                      avatarMut.isPending || removeAvatarMut.isPending
                        ? 'cursor-not-allowed opacity-60'
                        : 'cursor-pointer'
                    }`}
                  >
                    {removeAvatarMut.isPending ? (
                      <span className="text-[10px] font-semibold">...</span>
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </button>
                )}
                <label
                  className={`absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-indigo-600 shadow-lg transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-300 ${
                    avatarMut.isPending
                      ? 'cursor-not-allowed opacity-60'
                      : 'cursor-pointer hover:scale-105 hover:bg-indigo-50 dark:hover:bg-slate-700'
                  }`}
                  title={avatarMut.isPending ? 'Uploading...' : 'Change avatar'}
                >
                  {avatarMut.isPending ? (
                    <span className="text-[10px] font-semibold">...</span>
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  <input
                    disabled={avatarMut.isPending}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                    className="hidden"
                    onChange={(event) => {
                      if (avatarMut.isPending) return;
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (!file.type.startsWith('image/')) {
                        setError('Please select an image file.');
                        event.target.value = '';
                        return;
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        setError('Avatar must be 5MB or smaller.');
                        event.target.value = '';
                        return;
                      }
                      setError('');
                      avatarMut.mutate(file);
                      event.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
                  {displayName}
                </h2>
                <Badge color={ROLE_COLOR[profile?.role] || 'gray'}>
                  {ROLE_LABEL[profile?.role] || profile?.role}
                </Badge>
                <Badge color={profile?.suspended ? 'red' : 'green'}>
                  {profile?.suspended ? 'Suspended' : 'Active'}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Mail className="h-4 w-4 shrink-0" />
                <p className="truncate text-sm font-medium md:text-base">
                  {displayEmail}
                </p>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                Manage personal details, account information, and sign-in
                security from one place.
              </p>
            </div>
          </div>
          <div
            className={`grid shrink-0 grid-cols-1 gap-2 ${
              accountDetails.length >= 4
                ? 'sm:grid-cols-2 xl:w-[500px]'
                : 'sm:grid-cols-3 xl:w-[500px]'
            }`}
          >
            {accountDetails.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-300" />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {label}
                  </p>
                  <p
                    className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100"
                    title={value}
                  >
                    {value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex h-full flex-col gap-5">
          <Card className="border border-slate-200 p-5 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:shadow-none md:p-6">
            <div className="mb-4 flex items-center gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                <Pencil className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Personal Information
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Update your display name
                </p>
              </div>
            </div>
            <form
              className="space-y-4"
              autoComplete="off"
              onSubmit={(event) => event.preventDefault()}
            >
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    First Name
                  </label>
                  <Input
                    name="profileFirstName"
                    autoComplete="off"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Last Name
                  </label>
                  <Input
                    name="profileLastName"
                    autoComplete="off"
                    value={lastName}
                    onChange={handleLastNameChange}
                    placeholder="Enter last name (optional)"
                  />
                </div>
              </div>
              {nameError && <p className="text-sm text-red-500">{nameError}</p>}
              <Btn
                onClick={() => {
                  if (!validateProfile()) return;
                  updateProfileMut.mutate({ full_name: combinedName });
                }}
                disabled={
                  updateProfileMut.isPending ||
                  combinedName === (profile?.full_name || '').trim()
                }
                className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 px-6 sm:w-auto"
              >
                {updateProfileMut.isPending ? 'Saving...' : 'Save Changes'}
              </Btn>
            </form>
          </Card>
          <Card
            className={`${
              confirmPassword.length > 0 && !passwordsMatch ? '' : 'mt-auto'
            } border border-slate-200 p-5 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:shadow-none md:p-6`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
                  <MonitorSmartphone className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    Active Sessions
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Review and revoke signed-in devices
                  </p>
                </div>
              </div>
              <Link
                to="/sessions"
                className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
              >
                Review <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Card>
        </div>
        <Card className="border border-slate-200 p-5 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:shadow-none md:p-6">
          <div className="mb-4 flex items-center gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Password & Security
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Use a unique password for this account
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Current Password
              </label>
              <Input
                type="password"
                name="current-password"
                autoComplete="section-security current-password"
                value={oldPassword}
                onChange={(event) => setOldPassword(event.target.value)}
                placeholder="Enter current password"
                minLength={8}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  New Password
                </label>
                <Input
                  type="password"
                  name="new-password"
                  autoComplete="section-security new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Create a strong password"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  name="confirm-new-password"
                  autoComplete="section-security new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter new password"
                  aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p
                    className="mt-2 text-sm font-medium text-rose-500"
                    aria-live="polite"
                  >
                    Passwords do not match.
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/60 sm:grid-cols-2">
              {[
                ['length', '8 or more characters'],
                ['uppercase', 'One uppercase letter'],
                ['lowercase', 'One lowercase letter'],
                ['number', 'One number'],
                ['special', 'One special character'],
                ['notObvious', 'Not an obvious password'],
              ].map(([key, label]) => (
                <div
                  key={key}
                  className={`flex items-center gap-2 ${passwordChecks[key] ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <Btn
              variant="success"
              onClick={() =>
                changePasswordMut.mutate({ oldPassword, newPassword })
              }
              disabled={
                changePasswordMut.isPending ||
                !oldPassword ||
                !isStrongPassword ||
                !passwordsMatch
              }
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 px-6 sm:w-auto"
            >
              {changePasswordMut.isPending ? 'Updating...' : 'Update Password'}
            </Btn>
          </div>
        </Card>
        <ConfirmationModal
          open={showRemoveAvatarModal}
          title="Remove Profile Image?"
          message="Are you sure you want to remove your profile image?"
          confirmText="Remove Image"
          cancelText="Cancel"
          loading={removeAvatarMut.isPending}
          danger
          onConfirm={() => removeAvatarMut.mutate()}
          onCancel={() => setShowRemoveAvatarModal(false)}
        />
      </div>
    </div>
  );
}
