import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../lib/axios';

export default function ResetPassword() {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('token');

    if (!resetToken) {
      return;
    }

    setToken(resetToken);

    window.history.replaceState(null, document.title, window.location.pathname);
  }, []);

  const resetMut = useMutation({
    mutationFn: (data) => api.post('/auth/reset-password', data),
    onSuccess: (res) => {
      setMessage(res.data.message);
      setError('');
    },
    onError: (err) => setError(err.response?.data?.error || 'Reset failed'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (resetMut.isPending) return;

    if (!token) {
      setError('Reset token is missing or invalid');
      return;
    }

    setError('');
    setMessage('');

    resetMut.mutate({
      token,
      newPassword,
    });
  };
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-animated-gradient bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950 animate-gradient-shift p-4">
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl animate-float-slow" />
      <div className="absolute -bottom-32 -right-20 w-[28rem] h-[28rem] bg-blue-400/20 rounded-full blur-3xl animate-float" />
      <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md animate-pop-in">
        <div className="text-center mb-7 text-white">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-white/15 border border-white/20 glass shadow-2xl mb-4 text-3xl animate-float">
            🔐
          </div>

          <p className="text-xs uppercase tracking-[0.22em] text-indigo-200 font-extrabold mb-2">
            Account Security
          </p>

          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Reset Password
          </h1>

          <p className="text-white/70 text-sm mt-2">
            Choose a new secure password for your account.
          </p>
        </div>

        <div className="glass rounded-3xl border border-white/20 shadow-2xl p-7 md:p-8">
          {message && (
            <div className="bg-emerald-500/15 border border-emerald-300/30 text-emerald-50 text-sm rounded-2xl px-4 py-3 mb-4 font-medium">
              {message}
            </div>
          )}

          {error && (
            <div className="bg-red-500/15 border border-red-300/30 text-red-50 text-sm rounded-2xl px-4 py-3 mb-4 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="hidden" value={token} readOnly />

            <div>
              <label
                htmlFor="newPassword"
                className="block text-xs font-extrabold uppercase tracking-wider text-white/70 mb-2"
              >
                New Password
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/55">
                  🔒
                </span>

                <input
                  id="newPassword"
                  type="password"
                  placeholder="New password (min 8)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/12 border border-white/20 text-white placeholder-white/45 focus:bg-white/18 focus:border-white/50 focus:ring-2 focus:ring-white/25 outline-none transition shadow-inner"
                />
              </div>

              <p className="text-xs text-white/50 mt-2">
                Use at least 8 characters for better account security.
              </p>
            </div>

            <button
              type="submit"
              disabled={resetMut.isPending}
              className="w-full py-3.5 rounded-2xl bg-white text-indigo-700 font-extrabold shadow-xl hover:shadow-2xl hover:scale-[1.01] active:scale-95 transition disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {resetMut.isPending ? 'Resetting...' : 'Reset password →'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-white/75 hover:text-white text-sm font-semibold hover:underline"
            >
              ← Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
