import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import api from '../../lib/axios';
import { PageHeader, Spinner, EmptyState } from '../../components/ui';
import UserActionMenu from '../../components/UserActionMenu';
import CreateUserModal from '../../components/admin/CreateUserModal';

const ROLE_COLOR = {
  ADMIN: 'bg-brand-orange/10 text-brand-orange',
  SENIOR_TL: 'bg-brand-green/10 text-brand-green',
  TL: 'bg-info/10 text-info',
  CAPTAIN: 'bg-warning/10 text-warning',
  INTERN: 'bg-gray-200 text-gray-700',
};

function initials(u) {
  const n = (u.full_name || u.email || '?').trim();
  return (
    n
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  );
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['adminUsers', page, limit],
    queryFn: () =>
      api.get(`/users?page=${page}&limit=${limit}`).then((res) => res.data),
  });

  const inv = () => queryClient.invalidateQueries({ queryKey: ['adminUsers'] });

  const suspendMut = useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/suspend`),
    onSuccess: inv,
  });
  const activateMut = useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/activate`),
    onSuccess: inv,
  });
  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: inv,
    onSettled: () => setDeletingUserId(null),
  });

  // Client-side filter and search over the loaded page. Combined with
  // server-side pagination, this gives instant feedback while typing.
  const filtered = useMemo(() => {
    const rows = data?.data ?? data ?? [];
    if (!Array.isArray(rows)) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (statusFilter === 'active' && u.suspended) return false;
      if (statusFilter === 'suspended' && !u.suspended) return false;
      if (!q) return true;
      return (
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    });
  }, [data, search, roleFilter, statusFilter]);

  const total = data?.total ?? (Array.isArray(data) ? data.length : 0);
  const totalPages = Math.max(Math.ceil(total / limit), 1);

  const handleDelete = (user) => {
    if (deleteMut.isPending || deletingUserId === user.id) return;
    if (
      confirm(`Delete ${user.full_name || user.email}? This cannot be undone.`)
    ) {
      setDeletingUserId(user.id);
      deleteMut.mutate(user.id);
    }
  };

  return (
    <div>
      <PageHeader
        title="User Directory"
        subtitle="Manage all platform accounts, roles, and status"
        actions={
          <button
            onClick={() => setCreateUserOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-green hover:opacity-90 text-slate-950 font-bold rounded-lg transition text-sm shadow-md"
          >
            <span>+ Add User</span>
          </button>
        }
        icon={
          <div className="w-11 h-11 rounded-xl bg-brand-orange text-white flex items-center justify-center shadow-md">
            <ShieldCheck className="w-5 h-5" />
          </div>
        }
      />

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 bg-white focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/30 outline-none transition text-sm"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/30 outline-none"
        >
          <option value="">All roles</option>
          <option value="ADMIN">Admin</option>
          <option value="SENIOR_TL">Senior TL</option>
          <option value="TL">TL</option>
          <option value="CAPTAIN">Captain</option>
          <option value="INTERN">Intern</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/30 outline-none"
        >
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        {isLoading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={
              search || roleFilter || statusFilter
                ? 'No matches'
                : 'No users yet'
            }
            text={
              search || roleFilter || statusFilter
                ? 'Try a different search term or filter.'
                : 'New users will appear here.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-orange/10 text-brand-orange flex items-center justify-center text-xs font-bold">
                          {initials(u)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">
                            {u.full_name || '—'}
                          </div>
                          <div className="text-xs text-gray-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          ROLE_COLOR[u.role] || 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          u.suspended
                            ? 'bg-error/10 text-error'
                            : 'bg-success/10 text-success'
                        }`}
                      >
                        {u.suspended ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <UserActionMenu
                        user={u}
                        busy={
                          deletingUserId === u.id ||
                          deleteMut.isPending ||
                          suspendMut.isPending ||
                          activateMut.isPending
                        }
                        onSuspend={(target) => suspendMut.mutate(target.id)}
                        onActivate={(target) => activateMut.mutate(target.id)}
                        onDelete={handleDelete}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>
            {total} user{total === 1 ? '' : 's'} · page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <CreateUserModal
        open={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
      />
    </div>
  );
}
