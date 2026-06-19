import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Zap } from 'lucide-react';
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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-brand-dark via-gray-900 to-brand-dark p-4">
      <div className="relative w-full max-w-md animate-pop-in">
        {/* Brand */}
        <div className="text-center mb-6 text-white">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-orange text-white shadow-lg mb-3">
            <Zap className="w-8 h-8" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">InternOps</h1>
          <p className="text-gray-300 text-sm">
            Workforce &amp; Intern Management Platform
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-700 bg-gray-800 shadow-2xl p-8">
          <h2 className="text-xl font-bold text-white mb-1">Welcome back</h2>
          <p className="text-gray-400 text-sm mb-6">
            Sign in to your dashboard
          </p>

          {error && (
            <div className="bg-error/10 border border-error/40 text-error text-sm rounded-lg px-4 py-2.5 mb-4 animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
                aria-hidden="true"
              />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/30 outline-none transition"
              />
            </div>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
                aria-hidden="true"
              />
              <input
                type={show ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-11 pr-12 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/30 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
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
              className="w-full py-3 rounded-lg bg-brand-orange hover:opacity-90 text-white font-semibold transition-opacity disabled:opacity-70"
            >
              {loginMut.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link
              to="/forgot-password"
              className="text-gray-400 hover:text-white text-sm underline-offset-2 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          © {new Date().getFullYear()} InternOps · Secure role-based access
        </p>
      </div>
    </div>
  );
}
