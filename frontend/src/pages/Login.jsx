import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query'; // added useQuery
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Zap } from 'lucide-react';
import api from '../lib/axios';
import useAuthStore from '../store/auth';

// Category label colours
const CATEGORY_STYLES = {
  REMINDER: 'text-brand-orange',
  NEWS: 'text-brand-green',
  ALERT: 'text-red-400',
  GENERAL: 'text-gray-400',
};

//  Notice list — owns its own loading / error / empty states
function NoticeList() {
  const {
    data: notices,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['public-notices'],
    queryFn: () => api.get('/notices/public').then((r) => r.data),
    staleTime: 1000 * 60 * 5, // cache for 5 min — notices don't change per keystroke
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2].map((n) => (
          <div key={n} className="pt-4 first:pt-0">
            <div className="h-3 w-24 bg-white/10 rounded mb-2" />
            <div className="h-4 w-full bg-white/5 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-xs text-gray-500 italic">
        Announcements unavailable right now.
      </p>
    );
  }

  if (!notices?.length) {
    return <p className="text-xs text-gray-400 italic">No active notices.</p>;
  }

  return (
    <div className="space-y-4 divide-y divide-white/10">
      {notices.map((notice) => (
        <div key={notice.id} className="pt-4 first:pt-0">
          <p
            className={`text-xs font-semibold ${CATEGORY_STYLES[notice.category] ?? CATEGORY_STYLES.GENERAL}`}
          >
            {notice.title}
          </p>
          <p className="text-sm text-gray-200 mt-1">{notice.content}</p>
        </div>
      ))}
    </div>
  );
}

// Login page
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
    onError: (err) => {
      if (import.meta.env.DEV) {
        console.error('Login error:', err);
      }
      const message = err.response?.data?.error;
      if (message === 'Invalid credentials') {
        setError('Invalid credentials. Please check your email and password.');
      } else if (
        message ===
          'Account temporarily locked due to too many failed attempts. Please try again later.' ||
        (message && message.toLowerCase().includes('locked'))
      ) {
        setError('Account temporarily locked. Please try again later.');
      } else {
        setError('Login failed. Please try again later.');
      }
    },
  });

  const validate = () => {
    if (!email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email';
    if (!password) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validate();
    if (err) return setError(err);
    setError('');
    loginMut.mutate({ email, password });
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white">
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpath d='M28 66L0 50V16L28 0l28 16v34L28 66zm0 0v34M0 50l28 16M56 50L28 66M0 16l28 16M56 16L28 32' fill='none' stroke='%23ffffff' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '56px 100px',
        }}
      />

      {/* Left Side (Credentials Form) */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 bg-black/20 backdrop-blur-none">
        <div className="w-full max-w-md animate-pop-in">
          {/* Brand */}
          <div className="text-center mb-10 text-white">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-orange text-white shadow-lg mb-3">
              <Zap className="w-8 h-8" aria-hidden="true" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              InternOps
            </h1>
            <p className="text-gray-300 text-sm">
              Workforce &amp; Intern Management Platform
            </p>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-white/10 bg-black/25 backdrop-blur-lg shadow-2xl p-8">
            <h2 className="text-xl font-bold text-white mb-1">Welcome back</h2>
            <p className="text-gray-300 text-sm mb-6">
              Log in to your dashboard
            </p>
            {error && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-sm rounded-lg px-4 py-2.5 mb-4 animate-fade-in">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  aria-hidden="true"
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-4 rounded-lg bg-black/20 border border-white/10 text-white placeholder-gray-400 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/30 outline-none transition"
                />
              </div>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  aria-hidden="true"
                />
                <input
                  type={show ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-11 pr-12 py-4 rounded-lg bg-black/20 border border-white/10 text-white placeholder-gray-400 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/30 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                >
                  {show ? (
                    <EyeOff className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <Eye className="w-5 h-5" aria-hidden="true" />
                  )}
                </button>
              </div>
              <button
                type="submit"
                disabled={loginMut.isPending}
                className="w-full py-4 rounded-lg bg-brand-orange hover:opacity-90 text-white font-semibold transition-opacity disabled:opacity-70"
              >
                {loginMut.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Logging in...
                  </span>
                ) : (
                  'Log In'
                )}
              </button>
            </form>
            <div className="mt-5 text-center">
              <Link
                to="/forgot-password"
                className="text-gray-300 hover:text-white text-sm underline-offset-2 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <p className="text-center text-gray-400 text-xs mt-6">
            © {new Date().getFullYear()} InternOps · Secure role-based access
          </p>
        </div>
      </div>

      {/* Right Side (Notice Board) */}
      <div className="flex w-full lg:w-1/2 flex-col justify-center p-8 lg:p-12 bg-black/10 border-t lg:border-t-0 lg:border-l border-white/5">
        <div className="max-w-md mx-auto w-full space-y-6">
          <div className="inline-flex items-center gap-2 bg-brand-orange/10 text-brand-orange px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
            <span>📢 InternOps Notice Board</span>
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
              Portal Announcements
            </h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              Stay up to date with tasks, program updates, and team schedules
              here.
            </p>
          </div>
          <div className="bg-black/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="text-brand-orange">⚡</span> Latest News
            </h3>

            {/* Replaced hardcoded notices with data-driven component */}
            <NoticeList />
          </div>
        </div>
      </div>
    </div>
  );
}
