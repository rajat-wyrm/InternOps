import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import api from '../lib/axios';
import useAuthStore from '../store/auth';

const UPTOSKILLS_LOGO = '/UptoSkills.webp';

// Category label colours
const CATEGORY_STYLES = {
  REMINDER: 'text-indigo-200',
  NEWS: 'text-emerald-300',
  ALERT: 'text-red-300',
  GENERAL: 'text-slate-300',
};

// Notice list — owns its own loading / error / empty states
function NoticeList() {
  const {
    data: notices,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['public-notices'],
    queryFn: () => api.get('/notices/public').then((r) => r.data),
    staleTime: 1000 * 60 * 5, // cache for 5 min
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

  if (isError || !notices?.length) {
    return (
      <p className="text-xs text-white/40 italic">
        {isError ? 'Announcements unavailable.' : 'No active notices.'}
      </p>
    );
  }

  return (
    <div className="notice-scrollbar max-h-[500px] overflow-y-auto pr-2 space-y-4 divide-y divide-white/10">
      {notices.map((notice) => (
        <div key={notice.id} className="pt-4 first:pt-0">
          <p
            className={`text-xs font-extrabold uppercase tracking-wider ${CATEGORY_STYLES[notice.category] ?? CATEGORY_STYLES.GENERAL}`}
          >
            {notice.title}
          </p>
          <p className="text-sm text-white/75 mt-1 leading-relaxed">
            {notice.content}
          </p>
        </div>
      ))}
    </div>
  );
}

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

    if (loginMut.isPending) return;

    if (!email.trim() || !password)
      return setError('Email and password required');

    setError('');

    loginMut.mutate({
      email,
      password,
    });
  };

  return (
    <div className="relative h-screen w-full overflow-hidden flex flex-col lg:flex-row bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950 text-white">
      {/* Background Decor */}
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpath d='M28 66L0 50V16L28 0l28 16v34L28 66zm0 0v34M0 50l28 16M56 50L28 66M0 16l28 16M56 16L28 32' fill='none' stroke='%23ffffff' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '56px 100px',
        }}
      />
      <div className="absolute -top-28 -left-24 w-96 h-96 bg-indigo-500/25 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-24 w-[30rem] h-[30rem] bg-blue-500/20 rounded-full blur-3xl" />

      {/* Left: Auth Form */}
      <div className="relative w-full lg:w-1/2 h-full flex flex-col justify-center items-center px-6 py-5 bg-black/10">
        <div className="w-full max-w-md animate-pop-in">
          <div className="text-center mb-5">
            <div className="inline-flex items-center justify-center rounded-[2rem] bg-white/[0.055] border border-white/10 px-5 py-3 shadow-2xl backdrop-blur-xl mb-4">
              <img
                src={UPTOSKILLS_LOGO}
                alt="UptoSkills"
                className="w-[250px] h-auto object-contain"
              />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              InternOps
            </h1>
            <p className="text-white/70 text-sm mt-1">
              Workforce &amp; Intern Management Platform
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.08] backdrop-blur-xl shadow-2xl p-6 md:p-7">
            <h2 className="text-2xl font-extrabold text-white mb-6">
              Welcome back
            </h2>
            {error && (
              <div
                id="login-error"
                className="bg-red-500/15 border border-red-300/25 text-red-100 text-sm rounded-2xl px-4 py-3 mb-4"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase text-white/65 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/45" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loginMut.isPending}
                    required
                    aria-describedby={error ? "login-error" : undefined}
                    aria-invalid={!!error}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/10 border border-white/15 outline-none focus:ring-2 focus:ring-indigo-300/25 transition"
      
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-extrabold uppercase text-white/65 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/45" />
                  <input
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loginMut.isPending}
                    required
                    aria-describedby={error ? "login-error" : undefined}
                    aria-invalid={!!error}
                    className="w-full pl-12 pr-12 py-3 rounded-2xl bg-white/10 border border-white/15 outline-none focus:ring-2 focus:ring-indigo-300/25 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/45"
                  >
                    {show ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <div className="flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-xs text-white/45 hover:text-white/70 transition"
                  >
                    Forgot Password?
                  </Link>
                </div>
              </div>
              <button
                type="submit"
                disabled={loginMut.isPending}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 font-extrabold transition hover:-translate-y-0.5"
              >
                {loginMut.isPending ? 'Logging in...' : 'Log In'}
              </button>
            </form>
          </div>
          <p className="text-center text-white/45 text-xs mt-4">
            © {new Date().getFullYear()} InternOps
          </p>
        </div>
      </div>

      {/* Right: Notice Board */}
      <div className="relative hidden lg:flex w-full lg:w-1/2 h-full flex-col justify-center px-8 lg:px-12 bg-white/[0.04] border-l border-white/10">
        <div className="max-w-md mx-auto w-full space-y-5">
          <div className="inline-flex items-center gap-2 bg-indigo-400/10 text-indigo-200 border border-indigo-300/15 px-3 py-1.5 rounded-full text-xs font-extrabold uppercase">
            <span>📢 InternOps Notice Board</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white">
            Portal Announcements
          </h2>
          <div className="bg-white/[0.08] backdrop-blur-xl rounded-3xl border border-white/10 p-5 shadow-2xl">
            <NoticeList />
          </div>
        </div>
      </div>
    </div>
  );
}
