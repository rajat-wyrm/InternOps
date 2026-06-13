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
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
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

    if (!token) {
      setError('Reset token is missing or invalid');
      return;
    }

    resetMut.mutate({ token, newPassword });
  };
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-animated-gradient bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 animate-gradient-shift p-4">
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/20 rounded-full blur-3xl animate-float-slow" />
      <div className="absolute -bottom-32 -right-20 w-[28rem] h-[28rem] bg-fuchsia-400/30 rounded-full blur-3xl animate-float" />

      <div className="relative w-full max-w-md animate-pop-in">
        <div className="text-center mb-6 text-white">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 glass shadow-lg mb-3 text-3xl animate-float">
            🔐
          </div>
          <h1 className="text-3xl font-extrabold">Reset Password</h1>
          <p className="text-white/80 text-sm">Choose a new password</p>
        </div>

        <div className="glass rounded-3xl border border-white/20 shadow-2xl p-8">
          {message && (
            <div className="bg-green-500/20 border border-green-300/40 text-green-50 text-sm rounded-xl px-4 py-2.5 mb-4">
              {message}
            </div>
          )}
          {error && (
            <div className="bg-red-500/20 border border-red-300/40 text-red-50 text-sm rounded-xl px-4 py-2.5 mb-4">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="hidden" value={token} readOnly />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60">
                🔒
              </span>
              <input
                type="password"
                placeholder="New password (min 8)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/15 border border-white/25 text-white placeholder-white/50 focus:bg-white/25 focus:ring-2 focus:ring-white/60 outline-none transition"
              />
            </div>
            <button
              type="submit"
              disabled={resetMut.isPending}
              className="w-full py-3 rounded-xl bg-white text-indigo-700 font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition disabled:opacity-70"
            >
              {resetMut.isPending ? 'Resetting...' : 'Reset password →'}
            </button>
          </form>
          <div className="mt-5 text-center">
            <Link
              to="/login"
              className="text-white/80 hover:text-white text-sm hover:underline"
            >
              ← Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
