import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Camera,
  Pencil,
  Lock,
  CheckCircle2,
  AlertCircle,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import api from '../lib/axios';
import {
  Card,
  Btn,
  Input,
  Badge,
  Spinner,
  ApiErrorState,
} from '../components/ui';
import useAuthStore from '../store/auth';

const ROLE_COLOR = {
  ADMIN: 'purple',
  SENIOR_TL: 'indigo',
  TL: 'blue',
  CAPTAIN: 'teal',
  INTERN: 'gray',
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

  const [full_name, setfull_name] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
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
    if (profile) setfull_name(profile.full_name || '');
  }, [profile]);

  const flash = (m) => {
    setMessage(m);
    setError('');
    setTimeout(() => setMessage(''), 2500);
  };
  const validateProfile = () => {
    const name = full_name.trim();
    if (!/^[A-Za-z ]+$/.test(name)) {
      setNameError('Name can only contain letters and spaces.');
      return false;
    }
    if (name.length < 3) {
      setNameError('Name must be at least 3 characters.');
      return false;
    }

    if (name.length > 50) {
      setNameError('Name must not exceed 50 characters.');
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
    onSuccess: () => {
      flash('Password changed successfully');
      setOldPassword('');
      setNewPassword('');
    },
    onError: (err) =>
      setError(err.response?.data?.error || 'Failed to change password'),
  });

  const avatarMut = useMutation({
    mutationFn: (file) => {
      const form = new FormData();
      form.append('file', file);

      return api.post('/uploads/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      flash('Avatar updated successfully');
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
    },
    onError: (err) =>
      setError(err.response?.data?.error || 'Avatar upload failed'),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner label="Loading profile..." />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-6xl mx-auto animate-fade-in-up">
        <div className="mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shadow-sm">
            <User className="w-6 h-6" />
          </div>

          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
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

  return (
    <div className="max-w-6xl mx-auto animate-fade-in-up">
      {/* Professional Header Block */}
      <div className="mb-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shadow-sm">
          <User className="w-6 h-6" />
        </div>

        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            My Profile
          </h1>
          <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
            Manage your account details and security
          </p>
        </div>
      </div>

      {/* Alert Messages */}
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

      {/* Hero Card */}
      <Card className="mb-7 overflow-hidden border border-slate-200 dark:border-slate-700 shadow-[0_18px_45px_rgba(79,70,229,0.12)] dark:shadow-none">
        <div className="relative">
          {/* Gradient Name Block */}
          <div className="relative min-h-[150px] bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 px-7 md:px-9 py-7 flex items-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_36%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.14),transparent_42%)]" />

            <div className="relative z-10">
              <p className="text-xs md:text-sm uppercase tracking-[0.22em] text-white/70 font-bold mb-2">
                Profile Overview
              </p>

              <h3 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-sm">
                {displayName}
              </h3>
            </div>
          </div>

          {/* Profile Details Block */}
          <div className="bg-white dark:bg-slate-900 px-7 md:px-9 py-6">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
              <div className="flex flex-col md:flex-row md:items-center gap-5">
                {/* Avatar */}
                <div className="relative shrink-0">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="avatar"
                      className="w-24 h-24 md:w-28 md:h-28 rounded-3xl object-cover border-4 border-white dark:border-slate-900 shadow-xl bg-white dark:bg-slate-900"
                    />
                  ) : (
                    <div className="w-24 h-24 md:w-28 md:h-28 rounded-3xl bg-gradient-to-br from-indigo-500 via-blue-500 to-violet-600 text-white flex items-center justify-center text-4xl font-extrabold border-4 border-white dark:border-slate-900 shadow-xl">
                      {initials(profile?.full_name, profile?.email)}
                    </div>
                  )}

                  <label
                    className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-all ${
                      avatarMut.isPending
                        ? 'opacity-60 cursor-not-allowed'
                        : 'cursor-pointer hover:scale-105 hover:bg-indigo-50 dark:hover:bg-slate-700'
                    }`}
                    title={
                      avatarMut.isPending ? 'Uploading...' : 'Change avatar'
                    }
                  >
                    {avatarMut.isPending ? (
                      <span className="text-[10px] font-semibold">...</span>
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                    <input
                      disabled={avatarMut.isPending}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        if (avatarMut.isPending) return;
                        const file = e.target.files?.[0];

                        if (!file) return;

                        if (!file.type.startsWith('image/')) {
                          setError('Please select an image file.');
                          e.target.value = '';
                          return;
                        }

                        if (file.size > 5 * 1024 * 1024) {
                          setError('Avatar must be 5MB or smaller.');
                          e.target.value = '';
                          return;
                        }

                        setError('');
                        avatarMut.mutate(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                {/* Email and Badges */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Mail className="w-4 h-4 shrink-0" />
                    <p className="text-sm md:text-base font-medium truncate">
                      {displayEmail}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <Badge color={ROLE_COLOR[profile?.role] || 'gray'}>
                      {profile?.role}
                    </Badge>

                    <Badge color={profile?.suspended ? 'red' : 'green'}>
                      {profile?.suspended ? 'Suspended' : 'Active'}
                    </Badge>
                  </div>

                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 max-w-xl">
                    Keep profile information accurate and update your password
                    regularly for better account protection.
                  </p>
                </div>
              </div>

              {/* Account Status */}
              <div className="w-full xl:w-auto">
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Account status
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {profile?.suspended ? 'Suspended' : 'Active'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Personal Info Card */}
        <Card className="p-6 md:p-7 min-h-[300px] border border-slate-200 dark:border-slate-700 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 flex items-center justify-center">
              <Pencil className="w-5 h-5" />
            </div>

            <div>
              <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
                Personal Information
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Update your display name and profile details
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                Full Name
              </label>

              <Input
                value={full_name}
                onChange={(e) => setfull_name(e.target.value)}
                placeholder="Enter your full name"
              />
              {nameError && (
                <p className="text-sm text-red-500 mt-1">{nameError}</p>
              )}
            </div>

            <Btn
              onClick={() => {
                if (!validateProfile()) return;

                updateProfileMut.mutate({
                  full_name: full_name.trim(),
                });
              }}
              disabled={
                updateProfileMut.isPending || full_name === profile?.full_name
              }
              className="w-full sm:w-auto px-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:shadow-indigo-200 dark:hover:shadow-none"
            >
              {updateProfileMut.isPending ? 'Saving...' : 'Save Changes'}
            </Btn>
          </div>
        </Card>

        {/* Security Card */}
        <Card className="p-6 md:p-7 min-h-[300px] border border-slate-200 dark:border-slate-700 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>

            <div>
              <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
                Security
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Change your password securely
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                Current Password
              </label>

              <Input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                New Password
              </label>

              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
              />
            </div>

            <Btn
              variant="success"
              onClick={() =>
                changePasswordMut.mutate({ oldPassword, newPassword })
              }
              disabled={
                changePasswordMut.isPending ||
                !oldPassword ||
                newPassword.length < 8
              }
              className="w-full sm:w-auto px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:shadow-emerald-200 dark:hover:shadow-none"
            >
              {changePasswordMut.isPending ? 'Updating...' : 'Update Password'}
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}
