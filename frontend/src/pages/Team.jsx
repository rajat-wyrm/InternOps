import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import { resolveUploadUrl } from '../lib/uploadUrl';
import useAuthStore from '../store/auth';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import CustomSelect from '../components/CustomSelect';
import CustomDatePicker from '../components/CustomDatePicker';
import { ApiErrorState } from '../components/ui';
import { getTeamRoleBreakdown } from '../utils/teamRoleBreakdown';

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

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
const DISPLAY_ROLE_ORDER = {
  ADMIN: 0,
  SENIOR_TL: 1,
  TL: 2,
  CAPTAIN: 3,
  INTERN: 4,
};
const ASSIGNABLE = ['SENIOR_TL', 'TL', 'CAPTAIN', 'INTERN'];

function rolesBelow(role) {
  const r = ROLE_RANK[role] ?? 0;
  return ASSIGNABLE.filter((x) => ROLE_RANK[x] < r);
}

function attendancePct(m) {
  const total = Number(m.attendance_total);
  const present = Number(m.present_count);
  if (!Number.isFinite(total) || total <= 0) return null;
  if (!Number.isFinite(present)) return null;

  return Math.round((present / total) * 100);
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
      className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-0.5"
    >
      <span className="inline-flex shrink-0 items-center gap-0.5 text-amber-500">
        <span>{'★'.repeat(full)}</span>
        <span className="text-slate-300 dark:text-slate-700">
          {'★'.repeat(empty)}
        </span>
      </span>

      <span className="shrink-0 whitespace-nowrap text-xs font-bold text-slate-500 dark:text-slate-400">
        {safeRaw.toFixed(1).replace(/\.0$/, '')}/10
      </span>
    </span>
  );
}

const RATING_OPTIONS = [
  { value: '', label: 'All Ratings' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
  { value: '7', label: '7' },
  { value: '8', label: '8' },
  { value: '9', label: '9' },
  { value: '10', label: '10' },
];

const ELIGIBILITY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'ELIGIBLE', label: '🟢 Eligible' },
  { value: 'NOT_ELIGIBLE', label: '🔴 Not Eligible' },
];

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

function RatingWithBadge({ value }) {
  if (value == null || value === '') {
    return <span className="text-slate-400 dark:text-slate-500">—</span>;
  }

  const raw = Number(value);
  if (Number.isNaN(raw)) {
    return <span className="text-slate-400 dark:text-slate-500">—</span>;
  }

  const roundedRating = Math.round(raw);
  const isNotEligible = roundedRating >= 1 && roundedRating <= 4;
  const isEligible = roundedRating >= 5;

  return (
    <div className="flex items-center gap-2">
      <span className="font-extrabold text-slate-900 dark:text-white text-sm">
        {roundedRating}
      </span>
      {isNotEligible && (
        <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-900/60 whitespace-nowrap">
          🔴 Not Eligible
        </span>
      )}
      {isEligible && (
        <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/60 whitespace-nowrap">
          🟢 Eligible
        </span>
      )}
    </div>
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
    <div className="relative min-h-[190px] overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] dark:shadow-none">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-indigo-500/10 dark:bg-indigo-400/15" />

      <div className="relative z-10 flex h-full min-h-[150px] w-full flex-col justify-center">
        <div className="shrink-0">
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {value}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {label}
          </p>
        </div>
        <div className="mt-0.5 min-h-[42px]">
          {sub && (
            <div className="text-xs text-slate-500 dark:text-slate-500">
              {sub}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ m, size = 'w-10 h-10' }) {
  return m.avatar_url ? (
    <img
      src={resolveUploadUrl(m.avatar_url)}
      alt=""
      className={`${size} rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm`}
    />
  ) : (
    <div
      className={`${size} relative isolate shrink-0 overflow-hidden rounded-2xl border border-indigo-400/35 bg-slate-900 text-white shadow-[0_7px_18px_rgba(15,23,42,0.28)] ring-1 ring-indigo-300/20 dark:border-indigo-400/30 dark:bg-slate-800`}
    >
      <span className="absolute -right-3 -top-3 h-8 w-8 rounded-full bg-indigo-500/70 blur-[1px]" />
      <span className="absolute -bottom-4 -left-3 h-9 w-9 rounded-full bg-blue-500/35 blur-sm" />
      <span className="relative flex h-full w-full items-center justify-center text-sm font-extrabold tracking-wide drop-shadow-sm">
        {initials(m)}
      </span>
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
  const user = useAuthStore((s) => s.user);
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
    document.body.classList.add('modal-open');

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, []);

  const {
    data: departments = [],
    isError: departmentsIsError,
    error: departmentsError,
    refetch: refetchDepartments,
  } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r) => r.data),
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

            {departmentsIsError && (
              <div className="mb-5">
                <ApiErrorState
                  error={departmentsError}
                  title="Failed to load departments"
                  fallback="Unable to load department options. You can retry or continue without selecting a department."
                  onRetry={refetchDepartments}
                />
              </div>
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
                <CustomDatePicker
                  value={form.joining_date}
                  onChange={(value) =>
                    setForm({ ...form, joining_date: value })
                  }
                  placeholder="Select joining date"
                  className="w-full"
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
  const { data, isLoading, isError, error, refetch } = useQuery({
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

  if (isError) {
    return (
      <ApiErrorState
        error={error}
        title="Failed to load history"
        fallback="Unable to load member history. Please try again."
        onRetry={refetch}
      />
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
  const user = useAuthStore((s) => s.user);

  const [form, setForm] = useState(null);
  const [edit, setEdit] = useState(false);
  const [tab, setTab] = useState('details');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newManager, setNewManager] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const {
    data: teamMembers = [],
    isError: teamMembersIsError,
    error: teamMembersError,
    refetch: refetchTeamMembers,
  } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => api.get('/team/members').then((res) => res.data),
  });

  const {
    data: fetchedMember,
    isLoading,
    isError: memberIsError,
    error: memberError,
    refetch: refetchMember,
  } = useQuery({
    queryKey: ['teamMember', memberId],
    queryFn: () => api.get(`/team/members/${memberId}`).then((res) => res.data),
    enabled: !!memberId,
  });

  const member = fetchedMember || teamMembers.find((m) => m.id === memberId);

  useEffect(() => {
    if (member && !edit) {
      setForm({
        full_name: member.full_name || '',
        phone: member.phone || '',
        location: member.location || '',
        college: member.college || '',
        course: member.course || '',
        year_of_study: member.year_of_study || '',
        position: member.position || '',
        joining_date: member.joining_date
          ? String(member.joining_date).slice(0, 10)
          : '',
        internship_status: member.internship_status || 'ACTIVE',
        lifecycle_effective_date: member.lifecycle_effective_date
          ? String(member.lifecycle_effective_date).slice(0, 10)
          : '',
        completion_date: member.completion_date
          ? String(member.completion_date).slice(0, 10)
          : '',
        extended_completion_date: member.extended_completion_date
          ? String(member.extended_completion_date).slice(0, 10)
          : '',
        notes: member.notes || '',
      });
    }
  }, [memberId, member, edit]);

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
      const response = err.response?.data;
      const detailMessage = Array.isArray(response?.details)
        ? response.details.find((detail) => detail?.message)?.message
        : response?.details?.message;
      setError(detailMessage || response?.error || 'Save failed');
      setMessage('');
    },
  });

  const saveMemberDetails = () => {
    if (form.internship_status === 'COMPLETED' && !form.completion_date) {
      setError('Completion date is required');
      setMessage('');
      return;
    }

    if (
      form.internship_status === 'COMPLETED' &&
      form.completion_date > lifecycleToday
    ) {
      setError('Completion date cannot be in the future');
      setMessage('');
      return;
    }

    if (
      form.internship_status === 'TERMINATED' &&
      !form.lifecycle_effective_date
    ) {
      setError('Effective date is required');
      setMessage('');
      return;
    }

    if (
      form.internship_status === 'TERMINATED' &&
      form.lifecycle_effective_date > lifecycleToday
    ) {
      setError('Effective date cannot be in the future');
      setMessage('');
      return;
    }

    if (
      form.internship_status === 'ACTIVE' &&
      form.extended_completion_date &&
      !form.completion_date
    ) {
      setError(
        'Planned completion date is required before adding an extension'
      );
      setMessage('');
      return;
    }

    if (
      form.internship_status === 'ACTIVE' &&
      form.extended_completion_date &&
      form.extended_completion_date <= form.completion_date
    ) {
      setError(
        'Extended completion date must be later than the planned completion date'
      );
      setMessage('');
      return;
    }

    const payload = { ...form };

    if (form.internship_status === 'COMPLETED') {
      payload.lifecycle_effective_date = null;
      payload.extended_completion_date = null;
    } else if (form.internship_status === 'TERMINATED') {
      payload.completion_date = null;
      payload.extended_completion_date = null;
    } else if (form.internship_status === 'ACTIVE') {
      payload.lifecycle_effective_date = null;
      payload.completion_date = form.completion_date || null;
      payload.extended_completion_date = form.extended_completion_date || null;
    } else {
      delete payload.lifecycle_effective_date;
      delete payload.completion_date;
      delete payload.extended_completion_date;
    }

    setError('');
    saveMut.mutate(payload);
  };

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

  const passwordMut = useMutation({
    mutationFn: (password) =>
      api.patch(`/team/members/${memberId}/password`, { password }),
    onSuccess: () => {
      setMessage('Password updated successfully');
      setError('');
      setNewPassword('');
      setTimeout(() => setMessage(''), 2500);
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to update password');
      setMessage('');
    },
  });

  const pct = member ? attendancePct(member) : null;
  const lifecycleToday = localDateValue();

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
        className="w-full max-w-md bg-slate-50 dark:bg-slate-800 h-full overflow-auto shadow-2xl border-l border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {memberIsError && !member ? (
          <div className="p-6">
            <ApiErrorState
              error={memberError}
              title="Failed to load member"
              fallback="Unable to load member details. Please try again."
              onRetry={refetchMember}
            />
          </div>
        ) : (!member || !form) && isLoading ? (
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
                    className={`inline-flex mt-2 px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${
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

                <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex min-h-7 items-center justify-center font-extrabold">
                    <Stars value={member.avg_rating} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
                      <Row label="Intern Code" value={member.intern_code} />
                      <Row
                        label="Internship Domain"
                        value={member.internship_domain}
                      />
                      <Row label="Position" value={member.position} />
                      <Row label="Phone" value={member.phone} />
                      <Row label="Location" value={member.location} />
                      <Row label="College" value={member.college} />
                      <Row label="Course" value={member.course} />
                      <Row label="Year" value={member.year_of_study} />
                      <Row
                        label="Joining date"
                        value={
                          member.joining_date
                            ? new Date(member.joining_date).toLocaleDateString()
                            : null
                        }
                      />
                      {member.lifecycle_effective_date && (
                        <Row
                          label="Lifecycle Effective Date"
                          value={new Date(
                            member.lifecycle_effective_date
                          ).toLocaleDateString()}
                        />
                      )}
                      {member.completion_date && (
                        <Row
                          label="Completion Date"
                          value={new Date(
                            member.completion_date
                          ).toLocaleDateString()}
                        />
                      )}
                      {member.extended_completion_date && (
                        <Row
                          label="Extended Completion Date"
                          value={new Date(
                            member.extended_completion_date
                          ).toLocaleDateString()}
                        />
                      )}
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
                      {member.offer_letter_url && (
                        <Row
                          label="Offer Letter"
                          value={
                            <a
                              href={member.offer_letter_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-indigo-600 hover:underline dark:text-indigo-400"
                            >
                              View offer letter
                            </a>
                          }
                        />
                      )}
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
                              onChange={(value) => {
                                setError('');
                                setForm({
                                  ...form,
                                  internship_status: value,
                                  completion_date:
                                    value === 'COMPLETED'
                                      ? lifecycleToday
                                      : value === 'ACTIVE'
                                        ? form.completion_date || ''
                                        : '',
                                  lifecycle_effective_date:
                                    value === 'TERMINATED'
                                      ? lifecycleToday
                                      : '',
                                  extended_completion_date:
                                    value === 'ACTIVE'
                                      ? form.extended_completion_date || ''
                                      : '',
                                });
                              }}
                              options={editStatusOptions}
                              placeholder="Select status"
                              className="w-full"
                            />
                          ) : f.type === 'date' ? (
                            <CustomDatePicker
                              value={form[f.key]}
                              onChange={(value) =>
                                setForm({ ...form, [f.key]: value })
                              }
                              placeholder={`Select ${f.label.toLowerCase()}`}
                              className="w-full"
                            />
                          ) : (
                            <input
                              type="text"
                              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3 w-full rounded-2xl"
                              value={form[f.key]}
                              onChange={(e) =>
                                setForm({ ...form, [f.key]: e.target.value })
                              }
                            />
                          )}
                        </Field>
                      ))}

                      {form.internship_status === 'ACTIVE' && (
                        <>
                          <Field label="Planned Completion Date">
                            <CustomDatePicker
                              value={form.completion_date}
                              onChange={(value) =>
                                setForm({ ...form, completion_date: value })
                              }
                              placeholder="Select planned completion date"
                              className="w-full"
                            />
                          </Field>
                          <Field label="Extended Completion Date (Optional)">
                            <CustomDatePicker
                              value={form.extended_completion_date}
                              onChange={(value) =>
                                setForm({
                                  ...form,
                                  extended_completion_date: value,
                                })
                              }
                              placeholder="Select extended completion date"
                              className="w-full"
                            />
                          </Field>
                        </>
                      )}
                      {form.internship_status === 'COMPLETED' && (
                        <Field label="Completion Date">
                          <CustomDatePicker
                            value={form.completion_date}
                            onChange={(value) =>
                              setForm({ ...form, completion_date: value })
                            }
                            placeholder="Select completion date"
                            className="w-full"
                          />
                        </Field>
                      )}
                      {form.internship_status === 'TERMINATED' && (
                        <Field label="Effective Date">
                          <CustomDatePicker
                            value={form.lifecycle_effective_date}
                            onChange={(value) =>
                              setForm({
                                ...form,
                                lifecycle_effective_date: value,
                              })
                            }
                            placeholder="Select effective date"
                            className="w-full"
                          />
                        </Field>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={saveMemberDetails}
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

                  {teamMembersIsError && (
                    <ApiErrorState
                      error={teamMembersError}
                      title="Failed to load manager options"
                      fallback="Unable to load team members for reassignment."
                      onRetry={refetchTeamMembers}
                    />
                  )}

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

                  <Field label="Reset Password">
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-2.5 flex-1 rounded-2xl text-sm"
                      />

                      <button
                        onClick={() => passwordMut.mutate(newPassword)}
                        disabled={
                          passwordMut.isPending ||
                          !newPassword ||
                          newPassword.length < 8
                        }
                        className="px-3 py-2 rounded-2xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50 shrink-0"
                      >
                        {passwordMut.isPending ? 'Updating...' : 'Reset'}
                      </button>
                    </div>
                    {newPassword && newPassword.length < 8 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        Password must be at least 8 characters.
                      </p>
                    )}
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

  const {
    data: proofs = [],
    isLoading,
    isError,
    error: proofsError,
    refetch,
  } = useQuery({
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

  if (!isLoading && !isError && proofs.length === 0) return null;

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

          {isError && (
            <ApiErrorState
              error={proofsError}
              title="Failed to load pending proofs"
              fallback="Unable to load proofs awaiting verification."
              onRetry={refetch}
            />
          )}

          {isError ? null : isLoading ? (
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
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [eligibilityFilter, setEligibilityFilter] = useState('');
  const [view, setView] = useState('table');
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const tableScrollRef = useRef(null);
  const [tableScrollState, setTableScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: true,
  });

  const user = useAuthStore((s) => s.user);
  const canAdd = rolesBelow(user?.role).length > 0;

  const {
    data: members = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => api.get('/team/members').then((res) => res.data),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return members
      .filter((m) => {
        if (roleFilter && m.role !== roleFilter) return false;

        if (deptFilter) {
          const mDept = m.department_name || m.department_id || '';
          if (mDept !== deptFilter) return false;
        }

        if (statusFilter) {
          if (statusFilter === 'SUSPENDED') {
            if (!m.suspended) return false;
          } else {
            const mStatus = m.internship_status || 'ACTIVE';
            if (mStatus !== statusFilter) return false;
          }
        }

        const rawRating = m.rating ?? m.avg_rating;
        const numRating =
          rawRating != null && rawRating !== '' ? Number(rawRating) : null;

        if (ratingFilter) {
          if (numRating == null || Number.isNaN(numRating)) return false;
          if (Math.round(numRating) !== Number(ratingFilter)) return false;
        }

        if (eligibilityFilter) {
          if (numRating == null || Number.isNaN(numRating)) return false;
          const rounded = Math.round(numRating);
          if (
            eligibilityFilter === 'ELIGIBLE' &&
            (rounded < 5 || rounded > 10)
          ) {
            return false;
          }
          if (
            eligibilityFilter === 'NOT_ELIGIBLE' &&
            (rounded < 1 || rounded > 4)
          ) {
            return false;
          }
        }

        if (!q) return true;

        return [
          m.full_name,
          m.email,
          m.college,
          m.position,
          m.id,
          m.department_name,
          m.internship_domain,
        ].some((v) => (v || '').toLowerCase().includes(q));
      })
      .sort((a, b) => {
        const roleDifference =
          (DISPLAY_ROLE_ORDER[a.role] ?? 99) -
          (DISPLAY_ROLE_ORDER[b.role] ?? 99);
        if (roleDifference) return roleDifference;
        return (a.full_name || a.email || '').localeCompare(
          b.full_name || b.email || '',
          undefined,
          { sensitivity: 'base' }
        );
      });
  }, [
    members,
    search,
    roleFilter,
    deptFilter,
    statusFilter,
    ratingFilter,
    eligibilityFilter,
  ]);

  const departmentFilterOptions = useMemo(() => {
    const depts = [
      ...new Set(
        members.map((m) => m.department_name || m.department_id).filter(Boolean)
      ),
    ];

    return [
      { value: '', label: 'All departments' },
      ...depts.map((d) => ({
        value: d,
        label: d,
      })),
    ];
  }, [members, user?.role]);

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
    const breakdownItems = getTeamRoleBreakdown(user?.role, members);
    const memberBreakdown = breakdownItems.length ? (
      <span className="block text-[13px] font-semibold leading-5 text-slate-700 dark:text-slate-300">
        {breakdownItems.map((row) => (
          <span key={row.map(({ role }) => role).join('-')} className="block">
            {row.map(({ role, count, label }, itemIndex) => (
              <span key={role} className="inline-block whitespace-nowrap">
                {itemIndex > 0 && (
                  <span className="mx-2 font-extrabold text-indigo-400 dark:text-indigo-300">
                    •
                  </span>
                )}
                {count} {label}
              </span>
            ))}
          </span>
        ))}
      </span>
    ) : (
      <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
        No team members
      </span>
    );

    return { active, avgAtt, avgRating, pendingProofs, memberBreakdown };
  }, [members, user?.role]);

  const updateTableScrollState = () => {
    const element = tableScrollRef.current;
    if (!element) return;
    const maxScrollLeft = Math.max(
      0,
      element.scrollWidth - element.clientWidth
    );
    setTableScrollState({
      canScrollLeft: element.scrollLeft > 1,
      canScrollRight: element.scrollLeft < maxScrollLeft - 1,
    });
  };
  const scrollTeamTable = (direction) => {
    const element = tableScrollRef.current;
    if (!element) return;
    element.scrollBy({
      left: direction * Math.max(320, element.clientWidth * 0.72),
      behavior: 'smooth',
    });
  };
  useEffect(() => {
    const frame = window.requestAnimationFrame(updateTableScrollState);
    window.addEventListener('resize', updateTableScrollState);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateTableScrollState);
    };
  }, [filtered.length, view]);

  const exportCsv = async () => {
    try {
      const res = await api.get('/team/members/export', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');

      a.href = url;
      a.download = 'team-members.csv';
      a.click();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export failed:', err);
      alert('Failed to export team members. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <p className="text-slate-600 dark:text-slate-300">Loading team...</p>
    );
  }

  if (isError) {
    return (
      <ApiErrorState
        error={error}
        title="Failed to load team"
        fallback="Unable to load team members. Please try again."
        onRetry={refetch}
      />
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
        <StatCard
          label="Total members"
          value={members.length}
          sub={stats.memberBreakdown}
        />
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
            placeholder="Search name, email, domain, college, position..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
        </div>

        <CustomSelect
          value={deptFilter}
          onChange={setDeptFilter}
          options={departmentFilterOptions}
          placeholder="All departments"
          className="w-full sm:w-52 [&>button]:h-12 [&>button]:flex [&>button]:items-center [&>button]:whitespace-nowrap"
        />

        <CustomSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_FILTER_OPTIONS}
          placeholder="All status"
          className="w-full sm:w-36 [&>button]:h-12 [&>button]:flex [&>button]:items-center [&>button]:whitespace-nowrap"
        />

        <CustomSelect
          value={roleFilter}
          onChange={setRoleFilter}
          options={roleFilterOptions}
          placeholder="All roles"
          className="w-full sm:w-36 [&>button]:h-12 [&>button]:flex [&>button]:items-center [&>button]:whitespace-nowrap"
        />

        <CustomSelect
          value={ratingFilter}
          onChange={setRatingFilter}
          options={RATING_OPTIONS}
          placeholder="All Ratings"
          className="w-full sm:w-36 [&>button]:h-12 [&>button]:flex [&>button]:items-center [&>button]:whitespace-nowrap"
        />

        <CustomSelect
          value={eligibilityFilter}
          onChange={setEligibilityFilter}
          options={ELIGIBILITY_OPTIONS}
          placeholder="All"
          className="w-full sm:w-40 [&>button]:h-12 [&>button]:flex [&>button]:items-center [&>button]:whitespace-nowrap"
        />

        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex h-12 items-stretch overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <button
              onClick={() => setView('table')}
              className={`px-4 py-3 text-sm font-bold transition ${
                view === 'table'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Table
            </button>

            <button
              onClick={() => setView('cards')}
              className={`px-4 py-3 text-sm font-bold transition ${
                view === 'cards'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Cards
            </button>
          </div>

          {view === 'table' && (
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollTeamTable(-1)}
                disabled={!tableScrollState.canScrollLeft}
                aria-label="Scroll team table left"
                title="Scroll table left"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => scrollTeamTable(1)}
                disabled={!tableScrollState.canScrollRight}
                aria-label="Scroll team table right"
                title="Scroll table right"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-10 text-center text-slate-500 dark:text-slate-400">
          {members.length === 0
            ? 'You have no team members yet. Click “Add Member” to get started.'
            : 'No members match your search.'}
        </div>
      ) : view === 'table' ? (
        <>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-none">
            <div
              ref={tableScrollRef}
              className="overflow-x-auto"
              onScroll={updateTableScrollState}
            >
              <table className="w-full min-w-[1360px] table-fixed text-sm">
                <thead className="border-b border-slate-200 text-left text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <tr className="bg-[#f8fafc] dark:bg-[#172033]">
                    <th className="sticky left-0 z-20 w-[260px] min-w-[260px] bg-[#f8fafc] px-3 py-4 font-extrabold shadow-[8px_0_14px_-14px_rgba(15,23,42,0.7)] dark:bg-[#172033]">
                      Member
                    </th>

                    <th className="w-[8%] px-1.5 py-4 text-center font-extrabold">
                      Role
                    </th>

                    <th className="w-[9%] px-1.5 py-4 text-center font-extrabold">
                      Department
                    </th>

                    <th className="w-[10%] px-1.5 py-4 text-center font-extrabold">
                      Domain
                    </th>

                    <th className="w-[10%] px-1.5 py-4 text-center font-extrabold">
                      Phone
                    </th>

                    <th className="w-[11%] px-1.5 py-4 text-center font-extrabold">
                      Attendance
                    </th>

                    <th className="w-[12%] px-1.5 py-4 text-center font-extrabold">
                      Rating
                    </th>

                    <th className="w-[7%] px-1.5 py-4 text-center font-extrabold">
                      Tasks
                    </th>

                    <th
                      className="w-[150px] min-w-[150px] whitespace-nowrap px-2 py-4 text-center font-extrabold"
                      title="Submitted task proofs awaiting verification"
                    >
                      Proofs Pending
                    </th>

                    <th className="w-[10%] px-1.5 py-4 text-center font-extrabold">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((m, index) => {
                    const pct = attendancePct(m);

                    return (
                      <tr
                        key={m.id}
                        className={`group border-b border-slate-100 dark:border-slate-700 last:border-b-0 cursor-pointer transition ${
                          index % 2 === 0
                            ? 'bg-white dark:bg-slate-900'
                            : 'bg-slate-50/50 dark:bg-slate-800/35'
                        } hover:bg-indigo-50/50 dark:hover:bg-slate-800`}
                        onClick={() => setSelected(m.id)}
                      >
                        <td
                          className={`sticky left-0 z-10 w-[260px] min-w-[260px] px-3 py-4 shadow-[8px_0_14px_-14px_rgba(15,23,42,0.7)] transition-colors ${
                            index % 2 === 0
                              ? 'bg-white group-hover:bg-indigo-50 dark:bg-[#1e293b] dark:group-hover:bg-[#263348]'
                              : 'bg-[#f8fafc] group-hover:bg-indigo-50 dark:bg-[#1e293b] dark:group-hover:bg-[#263348]'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar m={m} />

                            <div className="min-w-0">
                              <div className="truncate font-extrabold text-slate-900 dark:text-white">
                                {m.full_name || '—'}
                              </div>

                              <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                                {m.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-1.5 py-4 text-center align-middle">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
                              ROLE_BADGE[m.role] || ROLE_BADGE.INTERN
                            }`}
                          >
                            {ROLE_LABEL[m.role] || m.role}
                          </span>
                        </td>

                        <td className="px-1.5 py-4 text-center align-middle text-slate-700 dark:text-slate-300">
                          {m.department_name || '—'}
                        </td>
                        <td
                          className="truncate px-1.5 py-4 text-center align-middle text-slate-700 dark:text-slate-300"
                          title={m.internship_domain || undefined}
                        >
                          {m.internship_domain || '—'}
                        </td>

                        <td className="px-1.5 py-4 text-center align-middle text-slate-700 dark:text-slate-300">
                          {m.phone || '—'}
                        </td>

                        <td className="px-1.5 py-4 text-center align-middle">
                          {pct === null ? (
                            <span className="text-slate-400 dark:text-slate-500">
                              No data
                            </span>
                          ) : (
                            <div className="mx-auto flex max-w-28 items-center justify-center gap-1.5">
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

                        <td className="px-1.5 py-4 text-center align-middle [&>div]:justify-center">
                          <RatingWithBadge value={m.rating ?? m.avg_rating} />
                        </td>

                        <td className="px-1.5 py-4 text-center align-middle text-slate-700 dark:text-slate-300">
                          {m.verified_tasks}/{m.total_tasks}
                        </td>

                        <td className="px-1.5 py-4 text-center align-middle">
                          {Number(m.pending_proofs) > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/60">
                              {m.pending_proofs} to verify
                            </span>
                          ) : (
                            <span
                              className="font-bold tabular-nums text-slate-500 dark:text-slate-400"
                              title="No submitted task proofs are awaiting verification"
                            >
                              0
                            </span>
                          )}
                        </td>

                        <td className="px-1.5 py-4 text-center align-middle">
                          {m.suspended ? (
                            <span className="inline-flex whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-900/60">
                              Suspended
                            </span>
                          ) : (
                            <span
                              className={`inline-flex whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-bold ${
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
          </div>
        </>
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
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${
                        ROLE_BADGE[m.role] || ROLE_BADGE.INTERN
                      }`}
                    >
                      {ROLE_LABEL[m.role] || m.role}
                    </span>
                  </div>
                </div>
                <div className="mb-4 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  <p>📞 {m.phone || '—'}</p>
                  <p>Domain: {m.internship_domain || '—'}</p>
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
                    <RatingWithBadge value={m.rating ?? m.avg_rating} />
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

      {selected &&
        createPortal(
          <MemberDetail
            memberId={selected}
            onClose={() => setSelected(null)}
          />,
          document.body
        )}

      {adding && <AddMemberModal onClose={() => setAdding(false)} />}
    </div>
  );
}
