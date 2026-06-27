import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import useAuthStore from '../store/auth';
import { Users } from 'lucide-react';
import CustomSelect from '../components/CustomSelect';

const ROLE_LABEL = {
  SENIOR_TL: 'Senior TL',
  TL: 'TL',
  CAPTAIN: 'Captain',
  INTERN: 'Intern',
  ADMIN: 'Admin',
};

const ROLE_BADGE = {
  ADMIN:
    'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-900/60',
  SENIOR_TL:
    'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60',
  TL: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/60',
  CAPTAIN:
    'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-100 dark:border-teal-900/60',
  INTERN:
    'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 border border-slate-200 dark:border-slate-500',
};

const STATUS_OPTIONS = ['ACTIVE', 'COMPLETED', 'ON_HOLD', 'TERMINATED'];

const STATUS_BADGE = {
  ACTIVE:
    'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/60',
  COMPLETED:
    'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/60',
  ON_HOLD:
    'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/60',
  TERMINATED:
    'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-900/60',
};

// A manager may add any member ranked below themselves.
const ROLE_RANK = { ADMIN: 4, SENIOR_TL: 3, TL: 2, CAPTAIN: 1, INTERN: 0 };
const ASSIGNABLE = ['SENIOR_TL', 'TL', 'CAPTAIN', 'INTERN'];

function rolesBelow(role) {
  const r = ROLE_RANK[role] ?? 0;
  return ASSIGNABLE.filter((x) => ROLE_RANK[x] < r);
}

function attendancePct(m) {
  const total = Number(m.attendance_total) || 0;
  if (!total) return null;

  const score = Number(m.present_count) + Number(m.half_day_count) * 0.5;
  return Math.round((score / total) * 100);
}

function pctColor(p) {
  if (p === null) return 'bg-slate-300 dark:bg-slate-600';
  if (p >= 85) return 'bg-emerald-500';
  if (p >= 60) return 'bg-amber-500';
  return 'bg-rose-500';
}

function initials(m) {
  const n = (m.full_name || m.email || '?').trim();

  return n
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

function Stars({ value }) {
  if (value == null || value === '') {
    return <span className="text-slate-400 dark:text-slate-500">—</span>;
  }

  const raw = Number(value);

  if (Number.isNaN(raw)) {
    return <span className="text-slate-400 dark:text-slate-500">—</span>;
  }

  // Ratings are stored out of 10. Convert to 5-star visual safely.
  const safeRaw = Math.max(0, Math.min(10, raw));
  const normalized = safeRaw / 2;
  const full = Math.max(0, Math.min(5, Math.round(normalized)));
  const empty = Math.max(0, 5 - full);

  return (
    <span
      title={`${safeRaw.toFixed(1).replace(/\.0$/, '')}/10`}
      className="inline-flex items-center gap-2"
    >
      <span className="inline-flex items-center gap-0.5 text-amber-500">
        <span>{'★'.repeat(full)}</span>
        <span className="text-slate-300 dark:text-slate-700">
          {'★'.repeat(empty)}
        </span>
      </span>

      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
        {safeRaw.toFixed(1).replace(/\.0$/, '')}/10
      </span>
    </span>
  );
}

const EDIT_FIELDS = [
  { key: 'full_name', label: 'Full name' },
  { key: 'phone', label: 'Phone' },
  { key: 'location', label: 'City / Location' },
  { key: 'college', label: 'College' },
  { key: 'course', label: 'Course' },
  { key: 'year_of_study', label: 'Year of study' },
  { key: 'position', label: 'Position / Designation' },
  { key: 'joining_date', label: 'Joining date', type: 'date' },
  { key: 'internship_status', label: 'Status', type: 'select' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

function StatCard({ label, value, sub }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] dark:shadow-none">
      <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 opacity-10 dark:opacity-20" />

      <div className="relative z-10">
        <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {value}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
          {label}
        </p>
        {sub && (
          <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function Avatar({ m, size = 'w-10 h-10' }) {
  return m.avatar_url ? (
    <img
      src={m.avatar_url}
      alt=""
      className={`${size} rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm`}
    />
  ) : (
    <div
      className={`${size} rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-500 to-violet-600 text-white flex items-center justify-center text-sm font-extrabold shadow-sm`}
    >
      {initials(m)}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

function AddMemberModal({ onClose }) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const allowedRoles = rolesBelow(user?.role);

  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: allowedRoles[0] || 'INTERN',
    department_id: '',
    phone: '',
    college: '',
    course: '',
    year_of_study: '',
    position: '',
    joining_date: '',
    location: '',
  });

  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () =>
      api
        .get('/departments')
        .then((r) => r.data)
        .catch(() => []),
  });

  const createMut = useMutation({
    mutationFn: (payload) => api.post('/team/members', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
      onClose();
    },
    onError: (err) =>
      setError(err.response?.data?.error || 'Failed to add member'),
  });

  const submit = (e) => {
    e.preventDefault();

    const payload = Object.fromEntries(
      Object.entries(form).filter(([, v]) => v !== '')
    );

    createMut.mutate(payload);
  };

  const addRoleOptions = allowedRoles.map((r) => ({
    value: r,
    label: ROLE_LABEL[r] || r,
  }));

  const departmentOptions = [
    { value: '', label: '—' },
    ...departments.map((d) => ({
      value: d.id,
      label: d.name,
    })),
  ];

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[86vh] rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div>
            <h3 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white">
              Add Team Member
            </h3>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Create a new team account and assign role details.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-2xl leading-none shrink-0"
            title="Close"
          >
            &times;
          </button>
        </div>

        <form onSubmit={submit} className="min-h-0 flex-1 flex flex-col">
          {/* Scrollable body */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            {error && (
              <p className="text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/60 px-4 py-3 rounded-2xl text-sm font-medium mb-5">
                {error}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full name">
                <input
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3 w-full rounded-2xl focus:ring-2 focus:ring-indigo-400/50 outline-none"
                  value={form.full_name}
                  onChange={(e) =>
                    setForm({ ...form, full_name: e.target.value })
                  }
                />
              </Field>

              <Field label="Role *">
                <CustomSelect
                  value={form.role}
                  onChange={(value) => setForm({ ...form, role: value })}
                  options={addRoleOptions}
                  placeholder="Select role"
                  className="w-full"
                />
              </Field>

              <Field label="Email *">
                <input
                  type="email"
                  required
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3 w-full rounded-2xl focus:ring-2 focus:ring-indigo-400/50 outline-none"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>

              <Field label="Temp password * (min 8)">
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    minLength={8}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3 w-full rounded-2xl pr-12 focus:ring-2 focus:ring-indigo-400/50 outline-none"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                  />

                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"
                  >
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </Field>

              <Field label="Department">
                <CustomSelect
                  value={form.department_id}
                  onChange={(value) =>
                    setForm({ ...form, department_id: value })
                  }
                  options={departmentOptions}
                  placeholder="Select department"
                  className="w-full"
                />
              </Field>

              <Field label="Phone">
                <input
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3 w-full rounded-2xl focus:ring-2 focus:ring-indigo-400/50 outline-none"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>

              <Field label="College">
                <input
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3 w-full rounded-2xl focus:ring-2 focus:ring-indigo-400/50 outline-none"
                  value={form.college}
                  onChange={(e) =>
                    setForm({ ...form, college: e.target.value })
                  }
                />
              </Field>

              <Field label="Course">
                <input
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3 w-full rounded-2xl focus:ring-2 focus:ring-indigo-400/50 outline-none"
                  value={form.course}
                  onChange={(e) => setForm({ ...form, course: e.target.value })}
                />
              </Field>

              <Field label="Position">
                <input
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3 w-full rounded-2xl focus:ring-2 focus:ring-indigo-400/50 outline-none"
                  value={form.position}
                  onChange={(e) =>
                    setForm({ ...form, position: e.target.value })
                  }
                />
              </Field>

              <Field label="Joining date">
                <input
                  type="date"
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3 w-full rounded-2xl focus:ring-2 focus:ring-indigo-400/50 outline-none"
                  value={form.joining_date}
                  onChange={(e) =>
                    setForm({ ...form, joining_date: e.target.value })
                  }
                />
              </Field>

              <Field label="Location">
                <input
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3 w-full rounded-2xl focus:ring-2 focus:ring-indigo-400/50 outline-none"
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                />
              </Field>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 flex gap-3 px-6 py-5 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <button
              type="submit"
              disabled={createMut.isPending}
              className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:shadow-lg hover:shadow-indigo-200 dark:hover:shadow-none text-white px-4 py-3 rounded-2xl flex-1 font-bold transition-all disabled:opacity-60"
            >
              {createMut.isPending ? 'Adding...' : 'Add member'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function HistorySection({ memberId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['memberHistory', memberId],
    queryFn: () =>
      api.get(`/team/members/${memberId}/history`).then((r) => r.data),
  });

  if (isLoading) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Loading history...
      </p>
    );
  }

  const att = data?.attendance || [];
  const rat = data?.ratings || [];

  return (
    <div className="space-y-5">
      <div>
        <h5 className="font-bold text-sm mb-3 text-slate-900 dark:text-white">
          Recent attendance
        </h5>

        {att.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            No records.
          </p>
        ) : (
          <div className="space-y-1 max-h-40 overflow-auto">
            {att.map((a) => (
              <div
                key={a.id}
                className="flex justify-between text-xs border-b border-slate-100 dark:border-slate-700 py-2"
              >
                <span className="text-slate-600 dark:text-slate-300">
                  {new Date(a.date).toLocaleDateString()}
                </span>

                <span
                  className={
                    a.status === 'PRESENT'
                      ? 'text-emerald-600 dark:text-emerald-300'
                      : a.status === 'ABSENT'
                        ? 'text-red-600 dark:text-red-300'
                        : 'text-amber-600 dark:text-amber-300'
                  }
                >
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h5 className="font-bold text-sm mb-3 text-slate-900 dark:text-white">
          Rating history
        </h5>

        {rat.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            No ratings.
          </p>
        ) : (
          <div className="space-y-1 max-h-40 overflow-auto">
            {rat.map((r) => (
              <div
                key={r.id}
                className="text-xs border-b border-slate-100 dark:border-slate-700 py-2"
              >
                <div className="flex justify-between">
                  <Stars value={r.score} />
                  <span className="text-slate-400 dark:text-slate-500">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>

                {r.remarks && (
                  <p className="text-slate-500 dark:text-slate-400 mt-1">
                    {r.remarks}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <dt className="text-slate-500 dark:text-slate-400 shrink-0">{label}</dt>
      <dd className="text-slate-800 dark:text-slate-100 text-right break-words">
        {value || <span className="text-slate-300 dark:text-slate-600">—</span>}
      </dd>
    </div>
  );
}

function MemberDetail({ memberId, onClose }) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [form, setForm] = useState(null);
  const [edit, setEdit] = useState(false);
  const [tab, setTab] = useState('details');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newManager, setNewManager] = useState('');

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => api.get('/team/members').then((res) => res.data),
  });

  const { data: member, isLoading } = useQuery({
    queryKey: ['teamMember', memberId],
    queryFn: () => api.get(`/team/members/${memberId}`).then((res) => res.data),
    onSuccess: (data) => {
      setForm({
        full_name: data.full_name || '',
        phone: data.phone || '',
        location: data.location || '',
        college: data.college || '',
        course: data.course || '',
        year_of_study: data.year_of_study || '',
        position: data.position || '',
        joining_date: data.joining_date ? data.joining_date.slice(0, 10) : '',
        internship_status: data.internship_status || 'ACTIVE',
        notes: data.notes || '',
      });
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['teamMember', memberId] });
    queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
  };

  const saveMut = useMutation({
    mutationFn: (data) => api.patch(`/team/members/${memberId}`, data),
    onSuccess: () => {
      setMessage('Saved successfully');
      setError('');
      setEdit(false);
      invalidate();
      setTimeout(() => setMessage(''), 2500);
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Save failed');
      setMessage('');
    },
  });

  const statusMut = useMutation({
    mutationFn: (suspended) =>
      api.patch(`/team/members/${memberId}/status`, { suspended }),
    onSuccess: () => {
      invalidate();
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed'),
  });

  const roleMut = useMutation({
    mutationFn: (role) => api.patch(`/team/members/${memberId}/role`, { role }),
    onSuccess: () => {
      setMessage('Role updated');
      setError('');
      invalidate();
      setTimeout(() => setMessage(''), 2500);
    },
    onError: (err) =>
      setError(err.response?.data?.error || 'Failed to change role'),
  });

  const managerMut = useMutation({
    mutationFn: (manager_id) =>
      api.patch(`/team/members/${memberId}/manager`, { manager_id }),
    onSuccess: () => {
      setMessage('Manager reassigned');
      setError('');
      invalidate();
      setTimeout(() => setMessage(''), 2500);
    },
    onError: (err) =>
      setError(err.response?.data?.error || 'Failed to reassign manager'),
  });

  const pct = member ? attendancePct(member) : null;

  const editStatusOptions = STATUS_OPTIONS.map((s) => ({
    value: s,
    label: s,
  }));

  const manageRoleOptions = rolesBelow(user?.role).map((r) => ({
    value: r,
    label: ROLE_LABEL[r] || r,
  }));

  const managerOptions = [
    { value: user?.id || '', label: 'Me' },
    ...teamMembers
      .filter(
        (t) =>
          t.id !== member?.id && ROLE_RANK[t.role] > ROLE_RANK[member?.role]
      )
      .map((t) => ({
        value: t.id,
        label: `${t.full_name || t.email} (${ROLE_LABEL[t.role] || t.role})`,
      })),
  ];

  return (
    <div
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex justify-end z-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-50 dark:bg-slate-950 h-full overflow-auto shadow-2xl border-l border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading || !form ? (
          <div className="p-6 text-slate-600 dark:text-slate-300">
            Loading member...
          </div>
        ) : (
          <>
            <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 text-white p-6">
              <button
                onClick={onClose}
                className="float-right text-white/80 hover:text-white text-2xl leading-none"
              >
                &times;
              </button>

              <div className="flex items-center gap-4">
                <Avatar m={member} size="w-16 h-16" />

                <div>
                  <h3 className="text-lg font-extrabold">
                    {member.full_name || member.email}
                  </h3>

                  <p className="text-white/80 text-sm">{member.email}</p>

                  <span
                    className={`inline-flex mt-2 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      ROLE_BADGE[member.role] || 'bg-white/20 text-white'
                    }`}
                  >
                    {ROLE_LABEL[member.role] || member.role}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <p className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {pct === null ? '—' : `${pct}%`}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Attendance
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <p className="text-base font-extrabold">
                    <Stars value={member.avg_rating} />
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {member.rating_count} ratings
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <p className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {member.verified_tasks}/{member.total_tasks}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tasks done
                  </p>
                </div>
              </div>

              {message && (
                <p className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 px-3 py-2 rounded-2xl text-sm">
                  {message}
                </p>
              )}

              {error && (
                <p className="text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/60 px-3 py-2 rounded-2xl text-sm">
                  {error}
                </p>
              )}

              {/* Tabs */}
              <div className="flex gap-2 text-sm">
                <button
                  onClick={() => setTab('details')}
                  className={`px-4 py-2 rounded-2xl font-bold transition ${
                    tab === 'details'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  Details
                </button>

                <button
                  onClick={() => setTab('history')}
                  className={`px-4 py-2 rounded-2xl font-bold transition ${
                    tab === 'history'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  History
                </button>
              </div>

              {tab === 'history' ? (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
                  <HistorySection memberId={memberId} />
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-extrabold text-slate-900 dark:text-white">
                      Details
                    </h4>

                    {!edit && (
                      <button
                        onClick={() => setEdit(true)}
                        className="text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {!edit ? (
                    <dl className="space-y-1 text-sm">
                      <Row label="Reports to" value={member.manager_name} />
                      <Row label="Department" value={member.department_name} />
                      <Row label="Phone" value={member.phone} />
                      <Row label="Location" value={member.location} />
                      <Row label="College" value={member.college} />
                      <Row label="Course" value={member.course} />
                      <Row label="Year" value={member.year_of_study} />
                      <Row label="Position" value={member.position} />
                      <Row
                        label="Joining date"
                        value={
                          member.joining_date
                            ? new Date(member.joining_date).toLocaleDateString()
                            : null
                        }
                      />
                      <Row
                        label="Status"
                        value={
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              STATUS_BADGE[member.internship_status] ||
                              STATUS_BADGE.ACTIVE
                            }`}
                          >
                            {member.internship_status || 'ACTIVE'}
                          </span>
                        }
                      />
                      <Row
                        label="Account"
                        value={
                          member.suspended ? (
                            <span className="text-red-600 dark:text-red-300">
                              Suspended
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-300">
                              Active
                            </span>
                          )
                        }
                      />
                      <Row label="Notes" value={member.notes} />
                    </dl>
                  ) : (
                    <div className="space-y-3">
                      {EDIT_FIELDS.map((f) => (
                        <Field key={f.key} label={f.label}>
                          {f.type === 'textarea' ? (
                            <textarea
                              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3 w-full rounded-2xl"
                              rows={3}
                              value={form[f.key]}
                              onChange={(e) =>
                                setForm({ ...form, [f.key]: e.target.value })
                              }
                            />
                          ) : f.type === 'select' ? (
                            <CustomSelect
                              value={form[f.key]}
                              onChange={(value) =>
                                setForm({ ...form, [f.key]: value })
                              }
                              options={editStatusOptions}
                              placeholder="Select status"
                              className="w-full"
                            />
                          ) : (
                            <input
                              type={f.type || 'text'}
                              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3 w-full rounded-2xl"
                              value={form[f.key]}
                              onChange={(e) =>
                                setForm({ ...form, [f.key]: e.target.value })
                              }
                            />
                          )}
                        </Field>
                      ))}

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => saveMut.mutate(form)}
                          disabled={saveMut.isPending}
                          className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-4 py-2 rounded-2xl flex-1 font-bold disabled:opacity-60"
                        >
                          {saveMut.isPending ? 'Saving...' : 'Save'}
                        </button>

                        <button
                          onClick={() => setEdit(false)}
                          className="px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Hierarchical management: role + manager (managers only) */}
              {rolesBelow(user?.role).length > 0 && member.id !== user?.id && (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-4">
                  <h4 className="font-extrabold text-slate-900 dark:text-white">
                    Manage
                  </h4>

                  <Field label="Role">
                    <div className="flex gap-2">
                      <CustomSelect
                        value={newRole || member.role}
                        onChange={setNewRole}
                        options={manageRoleOptions}
                        placeholder="Select role"
                        className="flex-1"
                      />

                      <button
                        onClick={() => roleMut.mutate(newRole || member.role)}
                        disabled={
                          roleMut.isPending ||
                          (newRole || member.role) === member.role
                        }
                        className="px-3 py-2 rounded-2xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50"
                      >
                        Change
                      </button>
                    </div>
                  </Field>

                  <Field label="Reports to">
                    <div className="flex gap-2">
                      <CustomSelect
                        value={newManager || member.manager_id || ''}
                        onChange={setNewManager}
                        options={managerOptions}
                        placeholder="Select manager"
                        className="flex-1"
                      />

                      <button
                        onClick={() =>
                          managerMut.mutate(
                            newManager || member.manager_id || user?.id
                          )
                        }
                        disabled={
                          managerMut.isPending ||
                          (newManager || member.manager_id) ===
                            member.manager_id
                        }
                        className="px-3 py-2 rounded-2xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50"
                      >
                        Reassign
                      </button>
                    </div>
                  </Field>
                </div>
              )}

              {/* Suspend / activate */}
              <button
                onClick={() => statusMut.mutate(!member.suspended)}
                disabled={statusMut.isPending}
                className={`w-full px-4 py-3 rounded-2xl text-white font-bold ${
                  member.suspended
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {member.suspended ? 'Reactivate account' : 'Suspend account'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PendingProofsPanel({ onMember }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);
  const [error, setError] = useState('');

  const { data: proofs = [], isLoading } = useQuery({
    queryKey: ['teamPendingProofs'],
    queryFn: () => api.get('/team/pending-proofs').then((r) => r.data),
  });

  const verifyMut = useMutation({
    mutationFn: (id) => api.patch(`/proofs/${id}/verify`),
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['teamPendingProofs'] });
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
    },
    onError: (err) =>
      setError(err.response?.data?.error || 'Failed to verify proof'),
  });

  if (!isLoading && proofs.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-amber-100 dark:border-amber-900/60 mb-5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <span className="font-extrabold text-slate-800 dark:text-white">
          🕓 Proofs awaiting verification
          {proofs.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
              {proofs.length}
            </span>
          )}
        </span>

        <span className="text-slate-400 dark:text-slate-500 text-sm">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {error && (
            <p className="text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-2xl mb-2">
              {error}
            </p>
          )}

          {isLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Loading...
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-80 overflow-auto">
              {proofs.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <button
                      onClick={() => onMember(p.intern_id)}
                      className="font-bold text-slate-800 dark:text-white hover:underline truncate text-left"
                    >
                      {p.intern_name || p.intern_email}
                    </button>

                    <div className="text-slate-500 dark:text-slate-400 text-xs truncate">
                      {p.task_title || 'Task'} ·{' '}
                      {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <button
                    onClick={() => verifyMut.mutate(p.id)}
                    disabled={verifyMut.isPending}
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-60"
                  >
                    Verify
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Team() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [view, setView] = useState('table');
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);

  const { user } = useAuthStore();
  const canAdd = rolesBelow(user?.role).length > 0;

  const {
    data: members = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => api.get('/team/members').then((res) => res.data),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return members.filter((m) => {
      if (roleFilter && m.role !== roleFilter) return false;

      if (!q) return true;

      return [m.full_name, m.email, m.college, m.position].some((v) =>
        (v || '').toLowerCase().includes(q)
      );
    });
  }, [members, search, roleFilter]);

  const roles = useMemo(
    () => [...new Set(members.map((m) => m.role))],
    [members]
  );

  const roleFilterOptions = useMemo(
    () => [
      { value: '', label: 'All roles' },
      ...roles.map((r) => ({
        value: r,
        label: ROLE_LABEL[r] || r,
      })),
    ],
    [roles]
  );

  const stats = useMemo(() => {
    const active = members.filter(
      (m) => !m.suspended && (m.internship_status || 'ACTIVE') === 'ACTIVE'
    ).length;

    const pcts = members.map(attendancePct).filter((p) => p !== null);

    const avgAtt = pcts.length
      ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
      : null;

    const ratings = members
      .map((m) => m.avg_rating)
      .filter((r) => r != null)
      .map(Number);

    const avgRating = ratings.length
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : null;

    const pendingProofs = members.reduce(
      (sum, m) => sum + (Number(m.pending_proofs) || 0),
      0
    );

    return { active, avgAtt, avgRating, pendingProofs };
  }, [members]);

  const exportCsv = async () => {
    const res = await api.get('/team/members/export', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');

    a.href = url;
    a.download = 'team-members.csv';
    a.click();

    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <p className="text-slate-600 dark:text-slate-300">Loading team...</p>
    );
  }

  if (error) {
    return (
      <p className="text-red-600 dark:text-red-300">
        {error.response?.data?.error || 'Failed to load team'}
      </p>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        {/* Left Side: Title and Icon */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shadow-sm">
            <Users className="w-6 h-6" />
          </div>

          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              My Team
            </h1>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
              Manage your team members and view their status
            </p>
          </div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
          >
            ⬇ Export CSV
          </button>

          {canAdd && (
            <button
              onClick={() => setAdding(true)}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-sm font-bold hover:shadow-lg hover:shadow-indigo-200 dark:hover:shadow-none transition-all shadow-sm"
            >
              + Add Member
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total members" value={members.length} />
        <StatCard label="Active" value={stats.active} />
        <StatCard
          label="Avg attendance"
          value={stats.avgAtt === null ? '—' : `${stats.avgAtt}%`}
        />
        <StatCard
          label="Avg rating"
          value={stats.avgRating ?? '—'}
          sub="out of 10"
        />
        <StatCard
          label="Proofs to verify"
          value={stats.pendingProofs}
          sub="awaiting review"
        />
      </div>

      {stats.pendingProofs > 0 && <PendingProofsPanel onMember={setSelected} />}

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[240px]">
          <input
            className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white pl-11 pr-4 py-3 rounded-2xl w-full focus:ring-2 focus:ring-indigo-400/50 outline-none shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
            placeholder="Search name, email, college, position..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
        </div>

        <CustomSelect
          value={roleFilter}
          onChange={setRoleFilter}
          options={roleFilterOptions}
          placeholder="All roles"
          className="w-full sm:w-44"
        />

        <div className="flex rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
          <button
            onClick={() => setView('table')}
            className={`px-4 py-3 text-sm font-bold transition ${
              view === 'table'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Table
          </button>

          <button
            onClick={() => setView('cards')}
            className={`px-4 py-3 text-sm font-bold transition ${
              view === 'cards'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Cards
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-10 text-center text-slate-500 dark:text-slate-400">
          {members.length === 0
            ? 'You have no team members yet. Click “Add Member” to get started.'
            : 'No members match your search.'}
        </div>
      ) : view === 'table' ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 text-left text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-4 font-extrabold">Member</th>
                <th className="p-4 font-extrabold">Role</th>
                <th className="p-4 font-extrabold">Department</th>
                <th className="p-4 font-extrabold">Phone</th>
                <th className="p-4 font-extrabold w-40">Attendance</th>
                <th className="p-4 font-extrabold">Rating</th>
                <th className="p-4 font-extrabold">Tasks</th>
                <th className="p-4 font-extrabold">Pending</th>
                <th className="p-4 font-extrabold">Status</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((m, index) => {
                const pct = attendancePct(m);

                return (
                  <tr
                    key={m.id}
                    className={`border-b border-slate-100 dark:border-slate-700 last:border-b-0 cursor-pointer transition ${
                      index % 2 === 0
                        ? 'bg-white dark:bg-slate-900'
                        : 'bg-slate-50/50 dark:bg-slate-800/35'
                    } hover:bg-indigo-50/50 dark:hover:bg-slate-800`}
                    onClick={() => setSelected(m.id)}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar m={m} />

                        <div>
                          <div className="font-extrabold text-slate-900 dark:text-white">
                            {m.full_name || '—'}
                          </div>

                          <div className="text-slate-500 dark:text-slate-400 text-xs">
                            {m.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          ROLE_BADGE[m.role] || ROLE_BADGE.INTERN
                        }`}
                      >
                        {ROLE_LABEL[m.role] || m.role}
                      </span>
                    </td>

                    <td className="p-4 text-slate-700 dark:text-slate-300">
                      {m.department_name || '—'}
                    </td>

                    <td className="p-4 text-slate-700 dark:text-slate-300">
                      {m.phone || '—'}
                    </td>

                    <td className="p-4">
                      {pct === null ? (
                        <span className="text-slate-400 dark:text-slate-500">
                          No data
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${pctColor(pct)}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs w-9 text-right text-slate-600 dark:text-slate-300">
                            {pct}%
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="p-4">
                      <Stars value={m.avg_rating} />
                    </td>

                    <td className="p-4 text-slate-700 dark:text-slate-300">
                      {m.verified_tasks}/{m.total_tasks}
                    </td>

                    <td className="p-4">
                      {Number(m.pending_proofs) > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/60">
                          {m.pending_proofs} to verify
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">
                          —
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      {m.suspended ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-900/60">
                          Suspended
                        </span>
                      ) : (
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            STATUS_BADGE[m.internship_status] ||
                            STATUS_BADGE.ACTIVE
                          }`}
                        >
                          {m.internship_status || 'ACTIVE'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => {
            const pct = attendancePct(m);

            return (
              <div
                key={m.id}
                onClick={() => setSelected(m.id)}
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Avatar m={m} size="w-12 h-12" />

                  <div className="min-w-0">
                    <div className="font-extrabold text-slate-900 dark:text-white truncate">
                      {m.full_name || m.email}
                    </div>

                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        ROLE_BADGE[m.role] || ROLE_BADGE.INTERN
                      }`}
                    >
                      {ROLE_LABEL[m.role] || m.role}
                    </span>
                  </div>
                </div>

                <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1 mb-4">
                  <p>📞 {m.phone || '—'}</p>
                  <p>🎓 {m.college || '—'}</p>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-3">
                  <span>
                    Att:{' '}
                    <b className="text-slate-800 dark:text-white">
                      {pct === null ? '—' : `${pct}%`}
                    </b>
                  </span>

                  <span>
                    <Stars value={m.avg_rating} />
                  </span>

                  <span>
                    Tasks:{' '}
                    <b className="text-slate-800 dark:text-white">
                      {m.verified_tasks}/{m.total_tasks}
                    </b>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <MemberDetail memberId={selected} onClose={() => setSelected(null)} />
      )}

      {adding && <AddMemberModal onClose={() => setAdding(false)} />}
    </div>
  );
}
``;
