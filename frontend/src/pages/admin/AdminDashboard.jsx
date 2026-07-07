import { useEffect, useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Users,
  Filter,
} from 'lucide-react';
import api from '../../lib/axios';
import { Card, Spinner, EmptyState } from '../../components/ui';
import UserActionMenu from '../../components/UserActionMenu';
import CreateUserModal from '../../components/admin/CreateUserModal';
import CustomSelect from '../../components/CustomSelect';
import BulkUserModal from '../../components/admin/BulkUserModal';

const ROLE_COLOR = {
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

const AVATAR_COLOR = {
  ADMIN:
    'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-900/60',
  SENIOR_TL:
    'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/60',
  TL: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900/60',
  CAPTAIN:
    'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-100 dark:border-teal-900/60',
  INTERN:
    'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-100 border-slate-200 dark:border-slate-600',
};

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SENIOR_TL', label: 'Senior TL' },
  { value: 'TL', label: 'TL' },
  { value: 'CAPTAIN', label: 'Captain' },
  { value: 'INTERN', label: 'Intern' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All status' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
];

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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [bulkUserOpen, setBulkUserOpen] = useState(false);

  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const suspendedFilter =
    statusFilter === 'active'
      ? false
      : statusFilter === 'suspended'
        ? true
        : undefined;

  const { data, isLoading } = useQuery({
    queryKey: [
      'adminUsers',
      page,
      limit,
      debouncedSearch,
      roleFilter,
      statusFilter,
    ],
    queryFn: () =>
      api
        .get('/users', {
          params: {
            page,
            limit,
            search: debouncedSearch || undefined,
            role: roleFilter || undefined,
            suspended: suspendedFilter,
          },
        })
        .then((res) => res.data),
    placeholderData: keepPreviousData,
  });

  const invalidateUsers = () =>
    queryClient.invalidateQueries({ queryKey: ['adminUsers'] });

  const suspendMut = useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/suspend`),
    onSuccess: invalidateUsers,
  });

  const activateMut = useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/activate`),
    onSuccess: invalidateUsers,
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: invalidateUsers,
    onSettled: () => setDeletingUserId(null),
  });

  const rows = data?.data ?? data?.users ?? data?.items ?? [];
  const total = data?.total ?? data?.count ?? rows.length;
  const totalPages = Math.max(Math.ceil(total / limit), 1);

  const handleRoleFilterChange = (value) => {
    setRoleFilter(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

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
    <div className="max-w-7xl mx-auto animate-fade-in-up">
      {/* Professional Header Block */}
      <div className="mb-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-indigo-600 via-blue-600 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200/70 dark:shadow-none">
            <ShieldCheck className="w-6 h-6" />
          </div>

          <div>
            <p className="text-xs md:text-sm uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300 font-extrabold mb-1">
              Admin Panel
            </p>

            <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              User Directory
            </h1>

            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-2">
              Manage all platform accounts, roles, and account status.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setBulkUserOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-green hover:opacity-90 text-slate-950 font-bold rounded-lg transition text-sm shadow-md"
          >
            <span>+ Bulk Add</span>
          </button>
          <button
            onClick={() => setCreateUserOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-green hover:opacity-90 text-slate-950 font-bold rounded-lg transition text-sm shadow-md"
          >
            <span>+ Add User</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="p-5 md:p-6 mb-6 border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-white via-slate-50 to-indigo-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/60">
              <Filter className="w-5 h-5" />
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Search & Filters
              </h2>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                Search users and refine by role or account status.
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 w-fit">
            <Users className="w-3.5 h-3.5" />
            {total} user{total === 1 ? '' : 's'}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="search"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40 outline-none transition text-sm shadow-sm"
            />
          </div>

          <CustomSelect
            value={roleFilter}
            onChange={handleRoleFilterChange}
            options={ROLE_OPTIONS}
            placeholder="All roles"
            className="w-full sm:w-44"
          />

          <CustomSelect
            value={statusFilter}
            onChange={handleStatusFilterChange}
            options={STATUS_OPTIONS}
            placeholder="All status"
            className="w-full sm:w-48"
          />
        </div>
      </Card>

      {/* Users Table */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 overflow-hidden shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
        {isLoading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState
            title={
              search || roleFilter || statusFilter
                ? 'No users found'
                : 'No users yet'
            }
            text={
              search || roleFilter || statusFilter
                ? 'No users were found matching those criteria.'
                : 'New users will appear here.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950 text-left text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">
                <tr>
                  <th className="px-6 py-4 font-extrabold whitespace-nowrap">
                    User
                  </th>
                  <th className="px-6 py-4 font-extrabold whitespace-nowrap">
                    Role
                  </th>
                  <th className="px-6 py-4 font-extrabold whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-6 py-4 font-extrabold text-right whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((u, index) => (
                  <tr
                    key={u.id}
                    className={`group transition-colors border-b border-slate-100 dark:border-slate-700 last:border-b-0 ${
                      index % 2 === 0
                        ? 'bg-white dark:bg-slate-900'
                        : 'bg-slate-50/50 dark:bg-slate-800/40'
                    } hover:bg-indigo-50/50 dark:hover:bg-slate-800`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-extrabold border ${
                            AVATAR_COLOR[u.role] || AVATAR_COLOR.INTERN
                          }`}
                        >
                          {initials(u)}
                        </div>

                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900 dark:text-white truncate">
                            {u.full_name || '—'}
                          </div>

                          <div className="text-xs md:text-sm text-slate-500 dark:text-slate-400 truncate">
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold ${
                          ROLE_COLOR[u.role] || ROLE_COLOR.INTERN
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold ${
                          u.suspended
                            ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800/80'
                            : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/80'
                        }`}
                      >
                        {u.suspended ? 'Suspended' : 'Active'}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition">
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500 dark:text-slate-400">
          <span>
            {total} user{total === 1 ? '' : 's'} · page {page} of {totalPages}
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition"
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

      <BulkUserModal
        open={bulkUserOpen}
        onClose={() => setBulkUserOpen(false)}
      />
    </div>
  );
}
