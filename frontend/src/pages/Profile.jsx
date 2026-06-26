import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Camera,
  Pencil,
  Lock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import api from '../lib/axios';
import { Card, Btn, Input, Badge, Spinner } from '../components/ui';
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
  return n
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

export default function Profile() {
  const queryClient = useQueryClient();
  const { user, setAuth } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['myProfile'],
    queryFn: () => api.get('/users/me').then((res) => res.data),
    onSuccess: (data) => {
      if (data) setFullName(data.full_name || '');
    },
  });

  const flash = (m) => {
    setMessage(m);
    setError('');
    setTimeout(() => setMessage(''), 2500);
  };

  const updateProfileMut = useMutation({
    mutationFn: (data) => api.patch('/users/me', data),
    onSuccess: (_res, vars) => {
      flash('Profile updated successfully');
      if (vars?.full_name && user)
        setAuth({ user: { ...user, fullName: vars.full_name } });
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

  if (isLoading)
    return (
      <div className="flex justify-center p-12">
        <Spinner label="Loading profile..." />
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up">
      {/* 🚀 Professional Header Block 🚀 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shadow-sm">
          <User className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
            My Profile
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage your account details and security
          </p>
        </div>
      </div>

      {/* Alert Messages */}
      {message && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl mb-5 animate-fade-in shadow-sm">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">{message}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl mb-5 animate-fade-in shadow-sm">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Hero card */}
      <Card className="p-0 overflow-hidden mb-6 border-0 shadow-md">
        <div className="h-32 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 animate-gradient-shift bg-animated-gradient" />
        <div className="px-6 pb-6 -mt-12 flex items-end gap-5 flex-wrap">
          <div className="relative group">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="avatar"
                className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-lg bg-white"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-3xl font-bold border-4 border-white shadow-lg">
                {initials(profile?.full_name, profile?.email)}
              </div>
            )}
            <label
              className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-white text-indigo-600 shadow-md border border-gray-100 flex items-center justify-center cursor-pointer hover:scale-110 hover:bg-indigo-50 transition-all"
              title="Change avatar"
            >
              <Camera className="w-4 h-4" />
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
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
          <div className="pb-1 flex-1 min-w-0">
            <h3 className="text-2xl font-extrabold text-gray-900 truncate">
              {profile?.full_name || 'Unnamed User'}
            </h3>
            <p className="text-sm font-medium text-gray-500 mb-2 truncate">
              {profile?.email}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge color={ROLE_COLOR[profile?.role] || 'gray'}>
                {profile?.role}
              </Badge>
              <Badge color={profile?.suspended ? 'red' : 'green'}>
                {profile?.suspended ? 'Suspended' : 'Active'}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Info Card */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
              <Pencil className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-gray-800">Personal Information</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                Full Name
              </label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>
            <Btn
              onClick={() => updateProfileMut.mutate({ full_name: fullName })}
              disabled={
                updateProfileMut.isPending || fullName === profile?.full_name
              }
              className="w-full sm:w-auto"
            >
              {updateProfileMut.isPending ? 'Saving...' : 'Save Changes'}
            </Btn>
          </div>
        </Card>

        {/* Security Card */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-md">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-gray-800">Security</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
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
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
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
              className="w-full sm:w-auto"
            >
              {changePasswordMut.isPending ? 'Updating...' : 'Update Password'}
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}
