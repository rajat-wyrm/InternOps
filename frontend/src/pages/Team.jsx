import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import useAuthStore from '../store/auth';

const ROLE_LABEL = {
  SENIOR_TL: 'Senior TL',
  TL: 'TL',
  CAPTAIN: 'Captain',
  INTERN: 'Intern',
  ADMIN: 'Admin',
};
const ROLE_BADGE = {
  ADMIN: 'bg-purple-100 text-purple-700',
  SENIOR_TL: 'bg-indigo-100 text-indigo-700',
  TL: 'bg-blue-100 text-blue-700',
  CAPTAIN: 'bg-teal-100 text-teal-700',
  INTERN: 'bg-gray-100 text-gray-700',
};
const STATUS_OPTIONS = ['ACTIVE', 'COMPLETED', 'ON_HOLD', 'TERMINATED'];
const STATUS_BADGE = {
  ACTIVE: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  ON_HOLD: 'bg-yellow-100 text-yellow-700',
  TERMINATED: 'bg-red-100 text-red-700',
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
  if (p === null) return 'bg-gray-200';
  if (p >= 85) return 'bg-green-500';
  if (p >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
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
  if (value == null) return <span className="text-gray-400">—</span>;
  const full = Math.round(value);
  return (
    <span title={value} className="text-amber-500">
      {'★'.repeat(full)}
      <span className="text-gray-300">{'★'.repeat(5 - full)}</span>
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function Avatar({ m, size = 'w-10 h-10' }) {
  return m.avatar_url ? (
    <img
      src={m.avatar_url}
      alt=""
      className={`${size} rounded-full object-cover border`}
    />
  ) : (
    <div
      className={`${size} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold`}
    >
      {initials(m)}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
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
  const [error, setError] = useState('');

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

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-semibold">Add Team Member</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
          >
            &times;
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          {error && (
            <p className="text-red-700 bg-red-50 px-3 py-2 rounded">{error}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name">
              <input
                className="border p-2 w-full rounded-lg"
                value={form.full_name}
                onChange={(e) =>
                  setForm({ ...form, full_name: e.target.value })
                }
              />
            </Field>
            <Field label="Role *">
              <select
                className="border p-2 w-full rounded-lg"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {allowedRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Email *">
              <input
                type="email"
                required
                className="border p-2 w-full rounded-lg"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Temp password * (min 8)">
              <input
                type="text"
                required
                minLength={8}
                className="border p-2 w-full rounded-lg"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <Field label="Department">
              <select
                className="border p-2 w-full rounded-lg"
                value={form.department_id}
                onChange={(e) =>
                  setForm({ ...form, department_id: e.target.value })
                }
              >
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Phone">
              <input
                className="border p-2 w-full rounded-lg"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="College">
              <input
                className="border p-2 w-full rounded-lg"
                value={form.college}
                onChange={(e) => setForm({ ...form, college: e.target.value })}
              />
            </Field>
            <Field label="Course">
              <input
                className="border p-2 w-full rounded-lg"
                value={form.course}
                onChange={(e) => setForm({ ...form, course: e.target.value })}
              />
            </Field>
            <Field label="Position">
              <input
                className="border p-2 w-full rounded-lg"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
              />
            </Field>
            <Field label="Joining date">
              <input
                type="date"
                className="border p-2 w-full rounded-lg"
                value={form.joining_date}
                onChange={(e) =>
                  setForm({ ...form, joining_date: e.target.value })
                }
              />
            </Field>
            <Field label="Location">
              <input
                className="border p-2 w-full rounded-lg"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={createMut.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex-1"
            >
              {createMut.isPending ? 'Adding...' : 'Add member'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HistorySection({ memberId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['memberHistory', memberId],
    queryFn: () =>
      api.get(`/team/members/${memberId}/history`).then((r) => r.data),
  });
  if (isLoading)
    return <p className="text-sm text-gray-500">Loading history...</p>;
  const att = data?.attendance || [];
  const rat = data?.ratings || [];
  return (
    <div className="space-y-4">
      <div>
        <h5 className="font-medium text-sm mb-2">Recent attendance</h5>
        {att.length === 0 ? (
          <p className="text-xs text-gray-400">No records.</p>
        ) : (
          <div className="space-y-1 max-h-40 overflow-auto">
            {att.map((a) => (
              <div
                key={a.id}
                className="flex justify-between text-xs border-b border-gray-50 py-1"
              >
                <span>{new Date(a.date).toLocaleDateString()}</span>
                <span
                  className={
                    a.status === 'PRESENT'
                      ? 'text-green-600'
                      : a.status === 'ABSENT'
                        ? 'text-red-600'
                        : 'text-yellow-600'
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
        <h5 className="font-medium text-sm mb-2">Rating history</h5>
        {rat.length === 0 ? (
          <p className="text-xs text-gray-400">No ratings.</p>
        ) : (
          <div className="space-y-1 max-h-40 overflow-auto">
            {rat.map((r) => (
              <div key={r.id} className="text-xs border-b border-gray-50 py-1">
                <div className="flex justify-between">
                  <Stars value={r.score} />
                  <span className="text-gray-400">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                {r.remarks && <p className="text-gray-500">{r.remarks}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MemberDetail({ memberId, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [edit, setEdit] = useState(false);
  const [tab, setTab] = useState('details');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  const pct = member ? attendancePct(member) : null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex justify-end z-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-gray-50 h-full overflow-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading || !form ? (
          <div className="p-6">Loading member...</div>
        ) : (
          <>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
              <button
                onClick={onClose}
                className="float-right text-white/80 hover:text-white text-2xl leading-none"
              >
                &times;
              </button>
              <div className="flex items-center gap-4">
                <Avatar m={member} size="w-16 h-16" />
                <div>
                  <h3 className="text-lg font-semibold">
                    {member.full_name || member.email}
                  </h3>
                  <p className="text-white/80 text-sm">{member.email}</p>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[member.role] || 'bg-white/20'}`}
                  >
                    {ROLE_LABEL[member.role] || member.role}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white p-3 rounded-xl shadow-sm">
                  <p className="text-xl font-bold">
                    {pct === null ? '—' : `${pct}%`}
                  </p>
                  <p className="text-xs text-gray-500">Attendance</p>
                </div>
                <div className="bg-white p-3 rounded-xl shadow-sm">
                  <p className="text-base font-bold">
                    <Stars value={member.avg_rating} />
                  </p>
                  <p className="text-xs text-gray-500">
                    {member.rating_count} ratings
                  </p>
                </div>
                <div className="bg-white p-3 rounded-xl shadow-sm">
                  <p className="text-xl font-bold">
                    {member.verified_tasks}/{member.total_tasks}
                  </p>
                  <p className="text-xs text-gray-500">Tasks done</p>
                </div>
              </div>

              {message && (
                <p className="text-green-700 bg-green-50 px-3 py-2 rounded">
                  {message}
                </p>
              )}
              {error && (
                <p className="text-red-700 bg-red-50 px-3 py-2 rounded">
                  {error}
                </p>
              )}

              {/* Tabs */}
              <div className="flex gap-2 text-sm">
                <button
                  onClick={() => setTab('details')}
                  className={`px-3 py-1.5 rounded-lg ${tab === 'details' ? 'bg-blue-600 text-white' : 'bg-white border'}`}
                >
                  Details
                </button>
                <button
                  onClick={() => setTab('history')}
                  className={`px-3 py-1.5 rounded-lg ${tab === 'history' ? 'bg-blue-600 text-white' : 'bg-white border'}`}
                >
                  History
                </button>
              </div>

              {tab === 'history' ? (
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <HistorySection memberId={memberId} />
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">Details</h4>
                    {!edit && (
                      <button
                        onClick={() => setEdit(true)}
                        className="text-blue-600 text-sm hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {!edit ? (
                    <dl className="space-y-2 text-sm">
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
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[member.internship_status] || ''}`}
                          >
                            {member.internship_status || 'ACTIVE'}
                          </span>
                        }
                      />
                      <Row
                        label="Account"
                        value={
                          member.suspended ? (
                            <span className="text-red-600">Suspended</span>
                          ) : (
                            <span className="text-green-600">Active</span>
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
                              className="border p-2 w-full rounded-lg"
                              rows={3}
                              value={form[f.key]}
                              onChange={(e) =>
                                setForm({ ...form, [f.key]: e.target.value })
                              }
                            />
                          ) : f.type === 'select' ? (
                            <select
                              className="border p-2 w-full rounded-lg"
                              value={form[f.key]}
                              onChange={(e) =>
                                setForm({ ...form, [f.key]: e.target.value })
                              }
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={f.type || 'text'}
                              className="border p-2 w-full rounded-lg"
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
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex-1"
                        >
                          {saveMut.isPending ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEdit(false)}
                          className="px-4 py-2 rounded-lg border"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Suspend / activate */}
              <button
                onClick={() => statusMut.mutate(!member.suspended)}
                disabled={statusMut.isPending}
                className={`w-full px-4 py-2 rounded-lg text-white ${member.suspended ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
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

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1 border-b border-gray-50 last:border-0">
      <dt className="text-gray-500 shrink-0">{label}</dt>
      <dd className="text-gray-800 text-right break-words">
        {value || <span className="text-gray-300">—</span>}
      </dd>
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
    return { active, avgAtt, avgRating };
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

  if (isLoading) return <p>Loading team...</p>;
  if (error)
    return (
      <p className="text-red-600">
        {error.response?.data?.error || 'Failed to load team'}
      </p>
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">My Team</h2>
        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            className="px-3 py-2 rounded-lg border bg-white text-sm hover:bg-gray-50"
          >
            ⬇ Export CSV
          </button>
          {canAdd && (
            <button
              onClick={() => setAdding(true)}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
            >
              + Add Member
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total members" value={members.length} />
        <StatCard label="Active" value={stats.active} />
        <StatCard
          label="Avg attendance"
          value={stats.avgAtt === null ? '—' : `${stats.avgAtt}%`}
        />
        <StatCard
          label="Avg rating"
          value={stats.avgRating ?? '—'}
          sub="out of 5"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <input
            className="border pl-9 p-2 rounded-lg w-full focus:ring-2 focus:ring-blue-400 outline-none"
            placeholder="Search name, email, college, position..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
        </div>
        <select
          className="border p-2 rounded-lg"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r] || r}
            </option>
          ))}
        </select>
        <div className="flex rounded-lg border overflow-hidden">
          <button
            onClick={() => setView('table')}
            className={`px-3 py-2 text-sm ${view === 'table' ? 'bg-blue-600 text-white' : 'bg-white'}`}
          >
            Table
          </button>
          <button
            onClick={() => setView('cards')}
            className={`px-3 py-2 text-sm ${view === 'cards' ? 'bg-blue-600 text-white' : 'bg-white'}`}
          >
            Cards
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-500">
          {members.length === 0
            ? 'You have no team members yet. Click “Add Member” to get started.'
            : 'No members match your search.'}
        </div>
      ) : view === 'table' ? (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="p-3">Member</th>
                <th className="p-3">Role</th>
                <th className="p-3">Department</th>
                <th className="p-3">Phone</th>
                <th className="p-3 w-40">Attendance</th>
                <th className="p-3">Rating</th>
                <th className="p-3">Tasks</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const pct = attendancePct(m);
                return (
                  <tr
                    key={m.id}
                    className="border-t hover:bg-blue-50/40 cursor-pointer transition"
                    onClick={() => setSelected(m.id)}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <Avatar m={m} />
                        <div>
                          <div className="font-medium text-gray-800">
                            {m.full_name || '—'}
                          </div>
                          <div className="text-gray-500 text-xs">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[m.role] || ''}`}
                      >
                        {ROLE_LABEL[m.role] || m.role}
                      </span>
                    </td>
                    <td className="p-3">{m.department_name || '—'}</td>
                    <td className="p-3">{m.phone || '—'}</td>
                    <td className="p-3">
                      {pct === null ? (
                        <span className="text-gray-400">No data</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${pctColor(pct)}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs w-9 text-right">{pct}%</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <Stars value={m.avg_rating} />
                    </td>
                    <td className="p-3">
                      {m.verified_tasks}/{m.total_tasks}
                    </td>
                    <td className="p-3">
                      {m.suspended ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          Suspended
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[m.internship_status] || STATUS_BADGE.ACTIVE}`}
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
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Avatar m={m} size="w-12 h-12" />
                  <div className="min-w-0">
                    <div className="font-medium text-gray-800 truncate">
                      {m.full_name || m.email}
                    </div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[m.role] || ''}`}
                    >
                      {ROLE_LABEL[m.role] || m.role}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-gray-600 space-y-1 mb-3">
                  <p>📞 {m.phone || '—'}</p>
                  <p>🎓 {m.college || '—'}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 border-t pt-3">
                  <span>
                    Att:{' '}
                    <b className="text-gray-800">
                      {pct === null ? '—' : `${pct}%`}
                    </b>
                  </span>
                  <span>
                    <Stars value={m.avg_rating} />
                  </span>
                  <span>
                    Tasks:{' '}
                    <b className="text-gray-800">
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
