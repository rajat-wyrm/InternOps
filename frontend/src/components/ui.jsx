// Shared, reusable UI building blocks for a consistent, polished, animated look.

export function PageHeader({ title, subtitle, icon, actions }) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-11 h-11 text-white flex items-center justify-center text-xl">
            {' '}
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
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${hover ? 'card-hover cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

const BADGE = {
  gray: 'bg-gray-100 text-gray-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  yellow: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  purple: 'bg-purple-100 text-purple-700',
  teal: 'bg-teal-100 text-teal-700',
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

export function Input({ className = '', ...props }) {
  return (
    <input
      {...props}
      className={`border border-gray-200 rounded-xl px-3 py-2.5 w-full focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition ${className}`}
    />
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
