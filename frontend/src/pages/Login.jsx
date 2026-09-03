import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Star,
  X,
  ExternalLink,
  Calendar,
  Link as LinkIcon,
} from 'lucide-react';
import api from '../lib/axios';
import useAuthStore from '../store/auth';
import NoticeBoard from '../components/NoticeBoard';

const UPTOSKILLS_LOGO = '/UptoSkills.webp';

// Category label colours
const CATEGORY_STYLES = {
  REMINDER: 'text-indigo-200',
  NEWS: 'text-emerald-300',
  ALERT: 'text-red-300',
  GENERAL: 'text-slate-300',
  INTERNSHIP: 'text-purple-300',
  ANNOUNCEMENT: 'text-blue-300',
  EVENT: 'text-fuchsia-300',
  IMPORTANT: 'text-rose-400',
  DEADLINE: 'text-orange-300',
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

  const [selectedNotice, setSelectedNotice] = useState(null);

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
    <>
      <div className="notice-scrollbar max-h-[500px] overflow-y-auto pr-2 space-y-4">
        {notices.map((notice) => (
          <div
            key={notice.id}
            onClick={() => setSelectedNotice(notice)}
            className="group relative p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer flex gap-4"
          >
            {notice.image_url && (
              <img
                src={notice.image_url}
                alt=""
                className="w-16 h-16 rounded-xl object-cover shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {notice.is_featured && (
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                )}
                <p
                  className={`text-xs font-extrabold uppercase tracking-wider ${CATEGORY_STYLES[notice.category] ?? CATEGORY_STYLES.GENERAL}`}
                >
                  {notice.category}
                </p>
              </div>
              <p className="text-sm font-bold text-white mb-1 truncate group-hover:text-indigo-200 transition-colors">
                {notice.title}
              </p>
              <p className="text-xs text-white/60 line-clamp-2">
                {notice.content}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-white/40">
                  {new Date(notice.created_at).toLocaleDateString()}
                </span>
                {notice.action_button_link && (
                  <span className="text-[10px] font-bold text-indigo-300 flex items-center gap-1 ml-auto">
                    View Details <ExternalLink className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header & Image */}
            <div className="relative shrink-0">
              {selectedNotice.image_url ? (
                <div className="w-full h-48 bg-slate-800 relative">
                  <img
                    src={selectedNotice.image_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
                </div>
              ) : (
                <div className="h-16 bg-slate-800/50" />
              )}
              <button
                onClick={() => setSelectedNotice(null)}
                className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto notice-scrollbar -mt-8 relative z-10">
              <div className="flex items-center gap-2 mb-3">
                {selectedNotice.is_featured && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wide">
                    <Star className="w-3 h-3 fill-amber-500" /> Featured
                  </span>
                )}
                <span
                  className={`text-[10px] font-bold px-2 py-1 rounded-full bg-slate-800 border border-slate-700 uppercase tracking-wide ${CATEGORY_STYLES[selectedNotice.category] ?? CATEGORY_STYLES.GENERAL}`}
                >
                  {selectedNotice.category}
                </span>
                <span className="text-xs text-slate-400 ml-auto flex items-center gap-1">
                  <Calendar className="w-3 h-3" />{' '}
                  {new Date(selectedNotice.created_at).toLocaleDateString()}
                </span>
              </div>

              <h2 className="text-xl font-bold text-white mb-4 leading-tight">
                {selectedNotice.title}
              </h2>

              <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {selectedNotice.content}
              </div>
            </div>

            {/* Modal Footer / Action Button */}
            {selectedNotice.action_button_link && (
              <div className="p-4 border-t border-slate-700/50 bg-slate-800/50 shrink-0 flex justify-end">
                <a
                  href={selectedNotice.action_button_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors"
                >
                  {selectedNotice.action_button_text || 'View Details'}{' '}
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const removeWhitespace = (value) => value.replace(/\s/g, '');
  const blockSpaceKey = (event) => {
    if (event.key === ' ') event.preventDefault();
  };
  const handleEmailChange = (event) => {
    setEmail(removeWhitespace(event.target.value));
  };
  const handlePasswordChange = (event) => {
    setPassword(removeWhitespace(event.target.value));
  };
  const loginMut = useMutation({
    mutationFn: (creds) =>
      api.post('/auth/login', creds).then((res) => res.data),
    onSuccess: (data) => {
      setAuth({ accessToken: data.accessToken, user: data.user });
      navigate(data.user?.mustChangePassword ? '/profile' : '/');
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
      email: email.trim().toLowerCase(),
      password,
    });
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col lg:flex-row bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950 text-white">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpath d='M28 66L0 50V16L28 0l28 16v34L28 66zm0 0v34M0 50l28 16M56 50L28 66M0 16l28 16M56 16L28 32' fill='none' stroke='%23ffffff' stroke-width='1'/%3E%3C/svg%3E")`,
            backgroundSize: '56px 100px',
          }}
        />
        <div className="absolute -top-28 -left-24 w-96 h-96 bg-indigo-500/25 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-24 w-[30rem] h-[30rem] bg-blue-500/20 rounded-full blur-3xl" />
      </div>

      {/* Left: Auth Form */}
      <div className="relative w-full lg:w-1/2 min-h-screen flex flex-col justify-center items-center overflow-y-auto bg-black/10 px-6 py-5">
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
                <label
                  htmlFor="email"
                  className="block text-xs font-extrabold uppercase text-white/65 mb-2"
                >
                  Email
                </label>

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/45" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    onKeyDown={blockSpaceKey}
                    disabled={loginMut.isPending}
                    required
                    autoComplete="email"
                    placeholder="Enter your email"
                    aria-describedby={error ? 'login-error' : undefined}
                    aria-invalid={!!error}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/10 border border-white/15 outline-none focus:ring-2 focus:ring-indigo-300/25 transition"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-extrabold uppercase text-white/65 mb-2"
                >
                  Password
                </label>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/45" />
                  <input
                    id="password"
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={handlePasswordChange}
                    onKeyDown={blockSpaceKey}
                    disabled={loginMut.isPending}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    aria-describedby={error ? 'login-error' : undefined}
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

                <div className="mt-2 flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="inline-flex py-1 text-xs text-white/55 transition hover:text-white/80"
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
      <div className="relative hidden lg:flex w-full lg:w-1/2 min-h-screen flex-col justify-center px-8 lg:px-12 bg-white/[0.04] border-l border-white/10">
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
