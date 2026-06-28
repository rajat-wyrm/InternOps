import { useEffect } from 'react';
import { createPortal } from 'react-dom';
// Shared, reusable UI building blocks for a consistent, polished, animated look.

export function PageHeader({ title, subtitle, icon, actions }) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-4 mb-7">
      <div className="flex items-center gap-4">
        {icon && (
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-slate-800 dark:to-slate-900 border border-indigo-100 dark:border-slate-700 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-xl shadow-sm">
            {icon}
          </div>
        )}

        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white leading-tight tracking-tight">
            {title}
          </h2>

          {subtitle && (
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
              {subtitle}
            </p>
          )}
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
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`${size} rounded-full object-cover border border-white/70 dark:border-slate-700 shadow-sm`}
      />
    );
  }

  return (
    <div
      className={`${size} rounded-full bg-gradient-to-br from-indigo-500 via-blue-500 to-violet-600 text-white flex items-center justify-center ${text} font-bold shadow-md`}
    >
      {initialsOf(name, email)}
    </div>
  );
}

export function Card({ children, className = '', hover = false }) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.06)] dark:shadow-none text-slate-900 dark:text-white ${
        hover ? 'card-hover cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

const BADGE = {
  gray: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
  green:
    'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/60',
  red: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-900/60',
  yellow:
    'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/60',
  blue: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900/60',
  indigo:
    'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60',
  purple:
    'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-900/60',
  teal: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-100 dark:border-teal-900/60',
};

export function Badge({ color = 'gray', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
        BADGE[color] || BADGE.gray
      } ${className}`}
    >
      {children}
    </span>
  );
}

const BTN = {
  primary:
    'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:shadow-lg hover:shadow-indigo-200 dark:hover:shadow-indigo-950 hover:-translate-y-0.5',
  success:
    'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-lg hover:shadow-emerald-200 dark:hover:shadow-emerald-950 hover:-translate-y-0.5',
  danger:
    'bg-gradient-to-r from-rose-500 to-red-600 text-white hover:shadow-lg hover:shadow-red-200 dark:hover:shadow-red-950 hover:-translate-y-0.5',
  warning:
    'bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:shadow-lg hover:shadow-amber-200 dark:hover:shadow-amber-950 hover:-translate-y-0.5',
  outline:
    'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 shadow-sm',
  ghost:
    'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40',
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
      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed ${
        BTN[variant] || BTN.primary
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Input({ className = '', ...props }) {
  return (
    <input
      {...props}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-2xl px-4 py-3 w-full focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400 outline-none transition shadow-sm ${className}`}
    />
  );
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      {...props}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-2xl px-4 py-3 w-full focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400 outline-none transition shadow-sm ${className}`}
    />
  );
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      {...props}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl px-4 py-3 w-full focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400 outline-none transition shadow-sm ${className}`}
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
  gradient = 'from-indigo-500 to-blue-600',
}) {
  return (
    <Card className="p-6 card-hover relative min-h-[150px] bg-gradient-to-br from-white via-slate-50 to-indigo-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      <div
        className={`absolute -right-8 -top-8 w-28 h-28 rounded-full bg-gradient-to-br ${gradient} opacity-15 dark:opacity-20`}
      />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="pt-6">
          <p className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {value}
          </p>

          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            {label}
          </p>

          {sub && (
            <p className="text-xs text-slate-500 dark:text-slate-500">{sub}</p>
          )}
        </div>

        {icon && (
          <div
            className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center text-2xl shadow-lg shadow-slate-300/40 dark:shadow-none`}
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
    <Card className="p-12 text-center bg-gradient-to-br from-white via-slate-50 to-indigo-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      <div className="text-5xl mb-3 animate-float inline-block">{icon}</div>

      <p className="text-slate-800 dark:text-white font-semibold">{title}</p>

      {text && (
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {text}
        </p>
      )}
    </Card>
  );
}

export function Spinner({ label = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400 py-8">
      <span className="relative inline-flex">
        <span className="w-8 h-8 rounded-full border-[3px] border-slate-200 dark:border-slate-700 border-t-indigo-600 dark:border-t-indigo-300 animate-spin" />
        <span className="absolute inset-1 rounded-full border border-indigo-100 dark:border-indigo-900/60" />
      </span>

      {label && (
        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </span>
      )}
    </div>
  );
}

export function Stars({ value }) {
  if (value == null) {
    return <span className="text-slate-300 dark:text-slate-600">—</span>;
  }

  const full = Math.round(value);

  return (
    <span className="text-amber-500" title={value}>
      {'★'.repeat(full)}
      <span className="text-slate-200 dark:text-slate-700">
        {'★'.repeat(5 - full)}
      </span>
    </span>
  );
}

// Styled table wrapper. Pass `head` (array of strings) and children rows.
export function Table({ head, children }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-950 text-left text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="p-3 font-bold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {children}
        </tbody>
      </table>
    </Card>
  );
}

export function ConfirmationModal({
  open,
  title = 'Confirm action',
  message = 'Are you sure you want to continue?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  onClose,
  loading = false,
  danger = true,
}) {
  // Handle body scroll locking and background blurring
  useEffect(() => {
    const root = document.getElementById('root');

    if (open) {
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
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    if (loading) return;
    if (onCancel) onCancel();
    else if (onClose) onClose();
  };

  const finalConfirmText = confirmLabel || confirmText;
  const finalCancelText = cancelLabel || cancelText;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            {message}
          </p>
        </div>

        <div className="flex justify-end gap-3 p-5 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm font-bold disabled:opacity-60"
          >
            {finalCancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-3 rounded-2xl text-white text-sm font-extrabold transition disabled:opacity-60 ${
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:shadow-lg hover:shadow-indigo-200'
            }`}
          >
            {loading ? 'Please wait...' : finalConfirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
