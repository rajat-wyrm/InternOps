import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import useAuthStore from '../store/auth';

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  const loginMut = useMutation({
    mutationFn: (creds) =>
      api.post('/auth/login', creds).then((res) => res.data),
    onSuccess: (data) => {
      setAuth({ accessToken: data.accessToken, user: data.user });
      navigate('/');
    },
    onError: (err) => setError(err.response?.data?.error || 'Login failed'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    loginMut.mutate({ email, password });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-animated-gradient bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 animate-gradient-shift p-4">
      {/* Floating decorative blobs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/20 rounded-full blur-3xl animate-float-slow" />
      <div className="absolute -bottom-32 -right-20 w-[28rem] h-[28rem] bg-fuchsia-400/30 rounded-full blur-3xl animate-float" />
      <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-indigo-300/20 rounded-full blur-3xl animate-float-slow" />

      <div className="relative w-full max-w-md animate-pop-in">
        {/* Brand */}
        <div className="text-center mb-6 text-white">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 glass shadow-lg mb-3 text-3xl animate-float">
            ⚡
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">InternOps</h1>
          <p className="text-white/80 text-sm">
            Workforce &amp; Intern Management Platform
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-3xl border border-white/20 shadow-2xl p-8">
          <h2 className="text-xl font-bold text-white mb-1">Welcome back 👋</h2>
          <p className="text-white/70 text-sm mb-6">
            Sign in to your dashboard
          </p>

          {error && (
            <div className="bg-red-500/20 border border-red-300/40 text-red-50 text-sm rounded-xl px-4 py-2.5 mb-4 animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60">
                ✉️
              </span>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/15 border border-white/25 text-white placeholder-white/50 focus:bg-white/25 focus:ring-2 focus:ring-white/60 outline-none transition"
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60">
                🔒
              </span>
              <input
                type={show ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-12 py-3 rounded-xl bg-white/15 border border-white/25 text-white placeholder-white/50 focus:bg-white/25 focus:ring-2 focus:ring-white/60 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-sm"
              >
                {show ? '🙈' : '👁️'}
              </button>
            </div>

            <button
              type="submit"
              disabled={loginMut.isPending}
              className="w-full py-3 rounded-xl bg-white text-indigo-700 font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition disabled:opacity-70 disabled:scale-100"
            >
              {loginMut.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-700 rounded-full animate-spin" />{' '}
                  Signing in...
                </span>
              ) : (
                'Sign In →'
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link
              to="/forgot-password"
              className="text-white/80 hover:text-white text-sm underline-offset-2 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <p className="text-center text-white/60 text-xs mt-6">
          © {new Date().getFullYear()} InternOps · Secure role-based access
        </p>
      </div>
    </div>
  );
}
