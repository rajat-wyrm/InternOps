import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import { PageHeader, Card, Btn, Input, Badge, Spinner } from '../components/ui';
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
      flash('Profile updated');
      if (vars?.full_name && user)
        setAuth({ user: { ...user, fullName: vars.full_name } });
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed'),
  });
  const changePasswordMut = useMutation({
    mutationFn: (data) => api.patch('/users/me/password', data),
    onSuccess: () => {
      flash('Password changed');
      setOldPassword('');
      setNewPassword('');
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed'),
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
      flash('Avatar updated');
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
    },
    onError: (err) => setError(err.response?.data?.error || 'Upload failed'),
  });

  if (isLoading) return <Spinner label="Loading profile..." />;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="My Profile"
        icon="👤"
        subtitle="Manage your account details"
      />

      {message && (
        <div className="bg-green-50 text-green-700 px-4 py-2.5 rounded-xl mb-4 animate-fade-in">
          {message}
        </div>
      )}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2.5 rounded-xl mb-4 animate-fade-in">
          {error}
        </div>
      )}

      {/* Hero card */}
      <Card className="p-0 overflow-hidden mb-5">
        <div className="h-24 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 animate-gradient-shift bg-animated-gradient" />
        <div className="px-6 pb-6 -mt-10 flex items-end gap-4 flex-wrap">
          <div className="relative">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="avatar"
                className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-2xl font-bold border-4 border-white shadow-lg">
                {initials(profile?.full_name, profile?.email)}
              </div>
            )}
            <label
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white shadow flex items-center justify-center cursor-pointer hover:scale-110 transition text-sm"
              title="Change avatar"
            >
              📷
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  e.target.files[0] && avatarMut.mutate(e.target.files[0])
                }
              />
            </label>
          </div>
          <div className="pb-1">
            <h3 className="text-lg font-bold text-gray-800">
              {profile?.full_name || 'Unnamed'}
            </h3>
            <p className="text-sm text-gray-500">{profile?.email}</p>
            <div className="flex gap-2 mt-1">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            ✏️ Update name
          </h3>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            className="mb-3"
          />
          <Btn onClick={() => updateProfileMut.mutate({ full_name: fullName })}>
            Save changes
          </Btn>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            🔑 Change password
          </h3>
          <Input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="Current password"
            className="mb-2"
          />
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8)"
            className="mb-3"
          />
          <Btn
            variant="success"
            onClick={() =>
              changePasswordMut.mutate({ oldPassword, newPassword })
            }
          >
            Update password
          </Btn>
        </Card>
      </div>
    </div>
  );
}
