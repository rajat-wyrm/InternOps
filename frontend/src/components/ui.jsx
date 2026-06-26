import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
// Shared, reusable UI building blocks for a consistent, polished, animated look.

export function PageHeader({ title, subtitle, icon, actions }) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xl shadow-md">
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-2xl font-extrabold text-gray-800 leading-tight">
            {title}
          </h2>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function initialsOf(name, email) {
  const n = (name || email || '?').trim();
  return (
    n
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  );
}

// Shows an avatar image if `src` is given, otherwise a gradient initials circle.
export function UserAvatar({
  name,
  email,
  src,
  size = 'w-9 h-9',
  text = 'text-sm',
}) {
  if (src)
    return (
      <img
        src={src}
        alt=""
        className={`${size} rounded-full object-cover border border-white/30`}
      />
    );
  return (
    <div
      className={`${size} rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center ${text} font-bold`}
    >
      {initialsOf(name, email)}
    </div>
  );
}

export function Card({ children, className = '', hover = false }) {
  return (
    <div
      className={`bg-gray-800 border border-gray-700 rounded-2xl shadow-sm ${hover ? 'card-hover cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

const BADGE = {
  gray: 'bg-gray-900/20 text-gray-300',
  green: 'bg-green-900/20 text-green-300',
  red: 'bg-red-900/20 text-red-300',
  yellow: 'bg-amber-900/20 text-amber-300',
  blue: 'bg-blue-900/20 text-blue-300',
  indigo: 'bg-indigo-900/20 text-indigo-300',
  purple: 'bg-purple-900/20 text-purple-300',
  teal: 'bg-teal-900/20 text-teal-300',
};
export function Badge({ color = 'gray', children, className = '' }) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${BADGE[color] || BADGE.gray} ${className}`}
    >
      {children}
    </span>
  );
}

const BTN = {
  primary:
    'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-200 hover:-translate-y-0.5',
  success:
    'bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:shadow-lg hover:shadow-green-200',
  danger:
    'bg-gradient-to-r from-rose-500 to-red-600 text-white hover:shadow-lg hover:shadow-red-200',
  warning:
    'bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:shadow-lg hover:shadow-amber-200',
  outline:
    'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300',
  ghost: 'text-indigo-600 hover:bg-indigo-50',
};
export function Btn({
  variant = 'primary',
  className = '',
  children,
  ...props
}) {
  return (
    <button
      {...props}
      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-60 disabled:translate-y-0 ${BTN[variant] || BTN.primary} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input({ className = '', type, ...props }) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="relative w-full flex items-center">
      <input
        {...props}
        type={isPassword && showPassword ? 'text' : type}
        className={`border border-gray-200 rounded-xl px-3 py-2.5 w-full focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none ${
          isPassword ? 'pr-10' : ''
        } ${className}`}
      />

      {/* Renders eye button securely using built-in SVGs */}
      {isPassword && props.value && props.value.length > 0 && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 text-gray-400 hover:text-gray-600 focus:outline-none select-none flex items-center justify-center"
        >
          {showPassword ? (
            // EyeOff SVG Icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
              <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          ) : (
            // Eye SVG Icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      {...props}
      className={`border border-gray-200 rounded-xl px-3 py-2.5 w-full focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition ${className}`}
    />
  );
}
export function Select({ className = '', children, ...props }) {
  return (
    <select
      {...props}
      className={`border border-gray-200 rounded-xl px-3 py-2.5 w-full bg-white focus:ring-2 focus:ring-indigo-400 outline-none transition ${className}`}
    >
      {children}
    </select>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  gradient = 'from-indigo-500 to-purple-600',
}) {
  return (
    <Card className="p-5 card-hover overflow-hidden relative">
      <div
        className={`absolute -right-6 -top-6 w-20 h-20 rounded-full bg-gradient-to-br ${gradient} opacity-10`}
      />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-3xl font-extrabold text-gray-800">{value}</p>
          <p className="text-sm text-gray-500 mt-1">{label}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
        {icon && (
          <div
            className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center text-xl shadow-md`}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export function EmptyState({ icon = '📭', title = 'Nothing here yet', text }) {
  return (
    <Card className="p-12 text-center">
      <div className="text-5xl mb-3 animate-float inline-block">{icon}</div>
      <p className="text-gray-700 font-semibold">{title}</p>
      {text && <p className="text-gray-400 text-sm mt-1">{text}</p>}
    </Card>
  );
}

export function Spinner({ label = 'Loading...' }) {
  return (
    <div className="flex items-center gap-3 text-gray-500 py-8 justify-center">
      <span className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function Stars({ value }) {
  if (value == null) return <span className="text-gray-300">—</span>;
  const full = Math.round(value);
  return (
    <span className="text-amber-500" title={value}>
      {'★'.repeat(full)}
      <span className="text-gray-200">{'★'.repeat(5 - full)}</span>
    </span>
  );
}

// Styled table wrapper. Pass `head` (array of strings) and children rows.
export function Table({ head, children }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gradient-to-r from-slate-50 to-indigo-50 text-left text-gray-600">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="p-3 font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </Card>
  );
}

// Confirmation dialog for destructive actions (delete, deactivate, etc).
// Locks page scroll and blurs the app background while open, and cleans
// both up automatically on close or unmount.
export function ConfirmationModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    const root = document.getElementById('root');

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (root) root.classList.add('blur-sm', 'transition-all', 'duration-300');
    } else {
      document.body.style.overflow = 'unset';
      if (root)
        root.classList.remove('blur-sm', 'transition-all', 'duration-300');
    }

    return () => {
      document.body.style.overflow = 'unset';
      if (root)
        root.classList.remove('blur-sm', 'transition-all', 'duration-300');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Rendered via portal directly under <body>, as a sibling of #root —
  // not a descendant of it. This keeps the modal sharp and on top while
  // the blur effect above is applied only to #root (the app behind it).
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel}></div>
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
