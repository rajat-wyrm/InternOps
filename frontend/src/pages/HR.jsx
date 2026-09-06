import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  Filter,
  BriefcaseBusiness,
  Pencil,
} from 'lucide-react';
import api from '../lib/axios';
import { Card, Spinner, EmptyState } from '../components/ui';
import CreateUserModal from '../components/admin/CreateUserModal';
import EditUserModal from '../components/admin/EditUserModal';
import CustomSelect from '../components/CustomSelect';

const ROLE_COLOR = {
  ADMIN:
    'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-900/60',
  MANAGEMENT:
    'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/60',
  HR: 'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border border-pink-100 dark:border-pink-900/60',
  SENIOR_TL:
    'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60',
  TL: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/60',
  CAPTAIN:
    'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-100 dark:border-teal-900/60',
  INTERN:
    'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 border border-slate-200 dark:border-slate-500',
};

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGEMENT', label: 'Management' },
  { value: 'HR', label: 'HR' },
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

function initials(user) {
  const name = (user.full_name || user.email || '?').trim();

  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join('') || '?'
  );
}

export default function HR() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

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

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [
      'hrUsers',
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

  return (
    <div className="max-w-7xl mx-auto animate-fade-in-up">
      <div className="mb-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-pink-500 via-rose-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-pink-200/60 dark:shadow-none">
            <BriefcaseBusiness className="w-6 h-6" />
          </div>

          <div>
            <p className="text-xs md:text-sm uppercase tracking-[0.22em] text-pink-600 dark:text-pink-300 font-extrabold mb-1">
              Human Resources
            </p>

            <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              People Management
            </h1>

            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-2">
              Manage people, roles, departments, and employee information.
            </p>
          </div>
        </div>

        <button
          onClick={() => setCreateUserOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-brand-green hover:opacity-90 text-slate-950 font-bold rounded-xl transition text-sm shadow-md"
        >
          <span>+ Add User</span>
        </button>
      </div>

      <Card className="p-5 md:p-6 mb-6 border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-white via-slate-50 to-pink-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-300 flex items-center justify-center border border-pink-100 dark:border-pink-900/60">
              <Filter className="w-5 h-5" />
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Search & Filters
              </h2>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                Find employees by name, email, role, or status.
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
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/40 outline-none transition text-sm shadow-sm"
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

      {isError && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-800 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-semibold text-red-700 dark:text-red-300">
              Failed to load users.
            </p>

            <p className="text-sm text-red-600 dark:text-red-400">
              {error?.response?.data?.message ||
                error?.message ||
                'Something went wrong while fetching users.'}
            </p>
          </div>

          <button
            onClick={() => refetch()}
            className="ml-4 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
          >
            Retry
          </button>
        </div>
      )}

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
                : 'Users will appear here.'
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
                {rows.map((user, index) => (
                  <tr
                    key={user.id}
                    className={`group transition-colors border-b border-slate-100 dark:border-slate-700 last:border-b-0 ${
                      index % 2 === 0
                        ? 'bg-white dark:bg-slate-900'
                        : 'bg-slate-50/50 dark:bg-slate-800/40'
                    } hover:bg-pink-50/40 dark:hover:bg-slate-800`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-extrabold border ${
                            ROLE_COLOR[user.role] || ROLE_COLOR.INTERN
                          }`}
                        >
                          {initials(user)}
                        </div>

                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900 dark:text-white truncate">
                            {user.full_name || '—'}
                          </div>

                          <div className="text-xs md:text-sm text-slate-500 dark:text-slate-400 truncate">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold ${
                          ROLE_COLOR[user.role] || ROLE_COLOR.INTERN
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold ${
                          user.suspended
                            ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800/80'
                            : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/80'
                        }`}
                      >
                        {user.suspended ? 'Suspended' : 'Active'}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingUser(user)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 transition font-bold"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="mt-3 flex items-center justify-between px-1 text-sm text-slate-500 dark:text-slate-400">
          <span>
            {total} user{total === 1 ? '' : 's'} · page {page} of {totalPages}
          </span>

          {totalPages > 1 && (
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
          )}
        </div>
      )}

      <CreateUserModal
        open={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
      />

      <EditUserModal
        open={!!editingUser}
        user={editingUser}
        onClose={() => setEditingUser(null)}
      />
    </div>
  );
}
