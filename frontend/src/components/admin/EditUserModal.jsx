import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  HelpCircle,
  Layers,
  Mail,
  Pencil,
  Search,
  User,
  X,
} from 'lucide-react';
import api from '../../lib/axios';
import CustomSelect from '../CustomSelect';
import useAuthStore from '../../store/auth';

const ROLE_OPTIONS = [
  { value: 'TL', label: 'TL' },
  { value: 'CAPTAIN', label: 'Captain' },
  { value: 'INTERN', label: 'Intern' },
];
function AssignmentGroup({
  title,
  description,
  singularLabel,
  pluralLabel,
  items,
  availableItems,
  filteredItems,
  search,
  setSearch,
  selectedIds,
  setSelectedIds,
  assignAll,
  setAssignAll,
  searchPlaceholder,
  showInternCode = false,
  showTransferStatus = false,
  currentLeaderId,
  memberById,
}) {
  const visibleIds = filteredItems.map((item) => item.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const allAvailableSelected =
    availableItems.length > 0 &&
    availableItems.every((item) => selectedIds.includes(item.id));

  const bulkChecked = assignAll || allAvailableSelected;

  const selectedCount = bulkChecked
    ? availableItems.length
    : selectedIds.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-950/30">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {description}
            </p>
          </div>
          <span className="whitespace-nowrap rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-extrabold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-200">
            {selectedCount} selected
          </span>
        </div>

        <label
          className={`mt-4 flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
            availableItems.length === 0
              ? 'cursor-not-allowed border-slate-200 bg-slate-100/70 opacity-60 dark:border-slate-700 dark:bg-slate-900/40'
              : 'cursor-pointer border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10'
          }`}
        >
          <input
            type="checkbox"
            checked={bulkChecked}
            disabled={availableItems.length === 0}
            onChange={(event) => {
              const checked = event.target.checked;

              if (checked) {
                setAssignAll(true);
                setSelectedIds([]);
                setSearch('');
                return;
              }

              setAssignAll(false);

              const availableIds = new Set(
                availableItems.map((item) => item.id)
              );

              setSelectedIds((currentIds) =>
                currentIds.filter((id) => !availableIds.has(id))
              );
            }}
            className="peer sr-only"
          />
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-slate-300 bg-white text-transparent transition-all peer-checked:border-indigo-600 peer-checked:bg-indigo-600 peer-checked:text-white dark:border-slate-600 dark:bg-slate-800 dark:peer-checked:border-indigo-500 dark:peer-checked:bg-indigo-500">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-extrabold text-slate-800 dark:text-slate-100">
              Assign all department {pluralLabel.toLowerCase()}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              {availableItems.length === 0
                ? `No ${pluralLabel.toLowerCase()} exist in this department.`
                : `This will transfer all ${availableItems.length} ${pluralLabel.toLowerCase()} to report directly to this leader.`}
            </span>
          </span>
        </label>
      </div>

      {!assignAll && (
        <div className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                items.length === 0
                  ? `No ${pluralLabel.toLowerCase()} available`
                  : searchPlaceholder
              }
              disabled={items.length === 0}
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-11 text-sm font-medium text-slate-800 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:disabled:bg-slate-900/40 dark:disabled:text-slate-600"
              aria-label={`Search ${pluralLabel.toLowerCase()}`}
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label={`Clear ${pluralLabel.toLowerCase()} search`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {items.length > 0 && (
            <div className="mt-3 flex items-center justify-between gap-3 px-1">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {filteredItems.length}{' '}
                {filteredItems.length === 1 ? singularLabel : pluralLabel} found
              </p>
              {filteredItems.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIds((currentIds) =>
                      allVisibleSelected
                        ? currentIds.filter((id) => !visibleIds.includes(id))
                        : [...new Set([...currentIds, ...visibleIds])]
                    )
                  }
                  className="whitespace-nowrap text-xs font-extrabold text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
                >
                  {allVisibleSelected ? 'Clear visible' : 'Select visible'}
                </button>
              )}
            </div>
          )}

          {items.length > 0 && (
            <div className="mt-3 max-h-52 space-y-2 overflow-y-auto overscroll-contain pr-1">
              {filteredItems.length ? (
                filteredItems.map((item) => {
                  const checked = selectedIds.includes(item.id);

                  const currentManager = item.manager_id
                    ? memberById?.get(item.manager_id)
                    : null;

                  const assignedElsewhere =
                    showTransferStatus &&
                    Boolean(item.manager_id) &&
                    item.manager_id !== currentLeaderId;

                  return (
                    <label
                      key={item.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                        checked
                          ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/15'
                          : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-slate-600 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedIds((ids) =>
                            ids.includes(item.id)
                              ? ids.filter((id) => id !== item.id)
                              : [...ids, item.id]
                          )
                        }
                        className="peer sr-only"
                      />
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-slate-300 bg-white text-transparent transition-all peer-checked:border-indigo-600 peer-checked:bg-indigo-600 peer-checked:text-white dark:border-slate-600 dark:bg-slate-800 dark:peer-checked:border-indigo-500 dark:peer-checked:bg-indigo-500">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-extrabold text-slate-800 dark:text-slate-100">
                          {item.full_name || item.email}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                          {item.email}
                        </span>
                        {showTransferStatus &&
                          currentManager &&
                          assignedElsewhere &&
                          currentManager.role === 'CAPTAIN' && (
                            <span className="mt-1 block truncate text-[11px] font-bold text-amber-700 dark:text-amber-300">
                              {checked
                                ? `Will transfer from ${currentManager.full_name || currentManager.email}`
                                : `Assigned to Captain: ${currentManager.full_name || currentManager.email}`}
                            </span>
                          )}
                      </span>
                      {showTransferStatus && (
                        <span
                          className={`hidden shrink-0 rounded-lg border px-2 py-1 text-[10px] font-extrabold sm:inline-flex ${
                            checked && assignedElsewhere
                              ? 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200'
                              : !currentManager
                                ? 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                : assignedElsewhere &&
                                    currentManager.role === 'TL'
                                  ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200'
                                  : assignedElsewhere
                                    ? 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/15 dark:text-teal-200'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200'
                          }`}
                        >
                          {checked && assignedElsewhere
                            ? 'Transfer on save'
                            : !currentManager
                              ? 'Unassigned'
                              : assignedElsewhere &&
                                  currentManager.role === 'TL'
                                ? 'Directly under TL'
                                : assignedElsewhere
                                  ? 'Under another Captain'
                                  : 'Assigned here'}
                        </span>
                      )}
                      {showInternCode && item.intern_code && (
                        <span className="hidden shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400 sm:inline-flex">
                          {item.intern_code}
                        </span>
                      )}
                    </label>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-7 text-center dark:border-slate-700 dark:bg-slate-900/60">
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    No matching {pluralLabel.toLowerCase()}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EditUserModal({ open, user, onClose }) {
  const currentUser = useAuthStore((state) => state.user);
  const isRestrictedEditor = ['SENIOR_TL', 'TL'].includes(currentUser?.role);
  const allowedRoleOptions =
    currentUser?.role === 'SENIOR_TL'
      ? ROLE_OPTIONS
      : currentUser?.role === 'TL'
        ? ROLE_OPTIONS.filter((option) =>
            ['CAPTAIN', 'INTERN'].includes(option.value)
          )
        : ROLE_OPTIONS;
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [assignAllCaptains, setAssignAllCaptains] = useState(false);
  const [assignAllInterns, setAssignAllInterns] = useState(false);
  const [selectedCaptainIds, setSelectedCaptainIds] = useState([]);
  const [selectedInternIds, setSelectedInternIds] = useState([]);
  const [captainSearch, setCaptainSearch] = useState('');
  const [internSearch, setInternSearch] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open || !user) return;
    setFullName(user.full_name || '');
    setEmail(user.email || '');
    setRole(user.role || '');
    setDepartmentId(user.department_id || '');
    setManagerId(user.manager_id || '');
    setAssignAllCaptains(false);
    setAssignAllInterns(false);
    setSelectedCaptainIds([]);
    setSelectedInternIds([]);
    setCaptainSearch('');
    setInternSearch('');
    setError('');
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [open, user]);
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r) => r.data || []),
    enabled: open && !isRestrictedEditor,
  });
  const { data: members = [] } = useQuery({
    queryKey: ['departmentHierarchyMembers', departmentId],
    queryFn: () =>
      api
        .get(`/users/department/${departmentId}/members`)
        .then((r) => r.data || []),
    enabled: open && !!departmentId,
  });
  const adminLocked = user?.role === 'ADMIN';
  const seniorLocked = user?.role === 'SENIOR_TL';
  const departmentLocked = adminLocked || seniorLocked || isRestrictedEditor;
  const hierarchyLocked = adminLocked || seniorLocked;
  const canEditHierarchy = !hierarchyLocked;
  const roleLocked = adminLocked || seniorLocked;
  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members]
  );
  const captains = useMemo(
    () =>
      members.filter(
        (member) =>
          member.role === 'CAPTAIN' &&
          !member.suspended &&
          member.id !== user?.id
      ),
    [members, user?.id]
  );
  const filteredCaptains = useMemo(() => {
    const query = captainSearch.trim().toLowerCase();
    if (!query) return captains;
    return captains.filter((captain) =>
      [
        captain.full_name,
        captain.email,
        captain.intern_code,
        captain.phone,
      ].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(query)
      )
    );
  }, [captainSearch, captains]);
  const availableCaptains = captains;
  const interns = useMemo(
    () =>
      members.filter(
        (member) => member.role === 'INTERN' && member.id !== user?.id
      ),
    [members, user?.id]
  );

  const directAssignableInterns = useMemo(
    () =>
      role === 'TL'
        ? interns.filter(
            (intern) =>
              !intern.manager_id ||
              intern.manager_id === user?.id ||
              intern.manager_id === user?.manager_id
          )
        : interns,
    [interns, role, user?.id, user?.manager_id]
  );
  const filteredInterns = useMemo(() => {
    const query = internSearch.trim().toLowerCase();
    if (!query) return directAssignableInterns;
    return directAssignableInterns.filter((intern) =>
      [intern.full_name, intern.email, intern.intern_code, intern.phone].some(
        (value) =>
          String(value || '')
            .toLowerCase()
            .includes(query)
      )
    );
  }, [directAssignableInterns, internSearch]);
  const availableInterns = directAssignableInterns;
  const selectedCaptains = useMemo(
    () => captains.filter((captain) => selectedCaptainIds.includes(captain.id)),
    [captains, selectedCaptainIds]
  );
  const captainManagedInterns = useMemo(
    () =>
      interns.filter((intern) =>
        selectedCaptainIds.includes(intern.manager_id)
      ),
    [interns, selectedCaptainIds]
  );
  const visibleInternCount = new Set([
    ...selectedInternIds,
    ...captainManagedInterns.map((intern) => intern.id),
  ]).size;
  useEffect(() => {
    if (!open || !user || !members.length || !canEditHierarchy) return;
    setSelectedCaptainIds(
      role === 'TL'
        ? captains
            .filter((captain) => captain.manager_id === user.id)
            .map((captain) => captain.id)
        : []
    );
    setSelectedInternIds(
      interns
        .filter((intern) => intern.manager_id === user.id)
        .map((intern) => intern.id)
    );
  }, [captains, canEditHierarchy, interns, members.length, open, role, user]);
  const managers = useMemo(
    () =>
      members.filter(
        (m) => m.id !== user?.id && ['TL', 'CAPTAIN'].includes(m.role)
      ),
    [members, user?.id]
  );
  const mutation = useMutation({
    mutationFn: async () => {
      const base = {
        full_name: fullName.trim(),
        email: email.trim(),
      };
      if (!roleLocked) {
        base.role = role;
      }
      if (!departmentLocked) {
        base.department_id = departmentId || null;
      }

      if (!departmentLocked && role === 'INTERN') {
        base.manager_id = managerId || null;
      }

      await api.patch(`/users/${user.id}`, base);

      if (canEditHierarchy && ['TL', 'CAPTAIN'].includes(role)) {
        await api.patch(`/users/${user.id}/hierarchy`, {
          role,
          department_id: departmentId,
          assign_all_captains: role === 'TL' && assignAllCaptains,
          assign_all_interns: assignAllInterns,
          captain_ids:
            role === 'TL' && !assignAllCaptains ? selectedCaptainIds : [],
          intern_ids: assignAllInterns ? [] : selectedInternIds,
        });
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['adminUsers'] }),
        queryClient.invalidateQueries({ queryKey: ['departmentTeams'] }),
        queryClient.invalidateQueries({ queryKey: ['teamMembers'] }),
      ]);
      onClose();
    },
    onError: (e) => setError(e.response?.data?.error || 'User update failed'),
  });
  if (!open || !user) return null;
  const input =
    'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white';
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <Pencil className="h-5 w-5 text-indigo-500" />
            <div>
              <h2 className="text-xl font-extrabold">Edit User</h2>
              <p className="text-sm text-slate-500">
                Update account and hierarchy details
              </p>
            </div>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="overflow-y-auto p-6">
          {error && (
            <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">
              {error}
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="mb-2 block text-xs font-extrabold uppercase text-slate-500">
                Full Name
              </span>
              <div className="relative">
                <User className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  className={`${input} pl-11`}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </label>
            <label>
              <span className="mb-2 block text-xs font-extrabold uppercase text-slate-500">
                Email
              </span>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  className={`${input} pl-11`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </label>
            <label>
              <span className="mb-2 block text-xs font-extrabold uppercase text-slate-500">
                Role
              </span>
              <div className="relative">
                <Layers className="absolute left-4 top-3.5 z-10 h-4 w-4 text-slate-400" />
                <CustomSelect
                  value={role}
                  onChange={(v) => {
                    setRole(v);
                    setAssignAllCaptains(false);
                    setAssignAllInterns(false);
                    setSelectedCaptainIds([]);
                    setSelectedInternIds([]);
                    setCaptainSearch('');
                    setInternSearch('');
                  }}
                  options={
                    adminLocked
                      ? [{ value: 'ADMIN', label: 'Admin' }]
                      : seniorLocked
                        ? [{ value: 'SENIOR_TL', label: 'Senior TL' }]
                        : allowedRoleOptions
                  }
                  disabled={roleLocked || mutation.isPending}
                  className="[&>button]:pl-11"
                />
              </div>
              {adminLocked && (
                <p className="mt-2 text-xs font-bold text-violet-600 dark:text-violet-300">
                  Admin role is protected and cannot be changed.
                </p>
              )}

              {seniorLocked && (
                <p className="mt-2 text-xs font-bold text-violet-600 dark:text-violet-300">
                  Senior TL changes must use Departments {'>'} Replace Senior
                  TL.
                </p>
              )}
            </label>
            <label>
              <span className="mb-2 block text-xs font-extrabold uppercase text-slate-500">
                Department
              </span>
              <div className="relative">
                <HelpCircle className="absolute left-4 top-3.5 z-10 h-4 w-4 text-slate-400" />
                <CustomSelect
                  value={departmentId}
                  onChange={setDepartmentId}
                  options={
                    isRestrictedEditor
                      ? [
                          {
                            value: departmentId,
                            label:
                              user.department_name ||
                              (departmentId
                                ? 'Assigned department'
                                : 'Not assigned'),
                          },
                        ]
                      : departments.map((d) => ({
                          value: d.id,
                          label: d.name,
                        }))
                  }
                  disabled={departmentLocked || mutation.isPending}
                  placeholder={
                    departmentId ? 'Assigned department' : 'Not assigned'
                  }
                  className="[&>button]:pl-11"
                />
              </div>
            </label>
          </div>
          {!departmentLocked && role === 'INTERN' && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-extrabold uppercase text-slate-500">
                Assign Manager
              </p>
              <CustomSelect
                value={managerId}
                onChange={setManagerId}
                options={managers.map((m) => ({
                  value: m.id,
                  label: `${m.full_name || m.email} (${m.role})`,
                }))}
                placeholder="Select TL or Captain"
                searchable
              />
            </div>
          )}
          {canEditHierarchy && ['TL', 'CAPTAIN'].includes(role) && (
            <section className="mt-5 space-y-4">
              {role === 'TL' && (
                <AssignmentGroup
                  title="Assign Captains to this TL"
                  description="Captains remain responsible for their directly assigned interns."
                  singularLabel="Captain"
                  pluralLabel="Captains"
                  items={captains}
                  availableItems={availableCaptains}
                  filteredItems={filteredCaptains}
                  search={captainSearch}
                  setSearch={setCaptainSearch}
                  selectedIds={selectedCaptainIds}
                  setSelectedIds={setSelectedCaptainIds}
                  assignAll={assignAllCaptains}
                  setAssignAll={setAssignAllCaptains}
                  searchPlaceholder="Search Captains by name, email, Intern Code, or phone..."
                  showInternCode
                />
              )}

              {role === 'TL' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/70">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        TL hierarchy summary
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        Captain-managed interns remain visible to this TL
                        through the hierarchy.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-extrabold">
                      <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
                        {selectedInternIds.length} direct interns
                      </span>
                      <span className="rounded-lg bg-teal-50 px-2.5 py-1 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200">
                        {captainManagedInterns.length} through Captains
                      </span>
                      <span className="rounded-lg bg-violet-50 px-2.5 py-1 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
                        {visibleInternCount} visible interns
                      </span>
                    </div>
                  </div>

                  {selectedCaptains.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {selectedCaptains.map((captain) => {
                        const assignedInterns = interns.filter(
                          (intern) => intern.manager_id === captain.id
                        );

                        return (
                          <div
                            key={captain.id}
                            className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"
                          >
                            <div className="flex items-center gap-3 px-3.5 py-3">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-xs font-extrabold text-teal-700 dark:bg-teal-500/15 dark:text-teal-200">
                                C
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-extrabold text-slate-800 dark:text-slate-100">
                                  {captain.full_name || captain.email}
                                </span>
                                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                                  Captain{' '}
                                  <span aria-hidden="true">&middot;</span>{' '}
                                  {assignedInterns.length}{' '}
                                  {assignedInterns.length === 1
                                    ? 'intern'
                                    : 'interns'}
                                </span>
                              </span>
                              {captain.intern_code && (
                                <span className="shrink-0 rounded-lg bg-slate-200/80 px-2 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                                  {captain.intern_code}
                                </span>
                              )}
                            </div>
                            {assignedInterns.length > 0 && (
                              <div className="border-t border-slate-200 px-3.5 py-2.5 dark:border-slate-700">
                                <div className="ml-4 space-y-2 border-l-2 border-teal-200 pl-4 dark:border-teal-500/30">
                                  {assignedInterns.map((intern) => (
                                    <div
                                      key={intern.id}
                                      className="relative flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 dark:bg-slate-900/70"
                                    >
                                      <span className="absolute -left-[18px] top-1/2 h-px w-4 -translate-y-1/2 bg-teal-200 dark:bg-teal-500/30" />
                                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-100 text-[10px] font-extrabold text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
                                        I
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                                          {intern.full_name || intern.email}
                                        </span>
                                        <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                                          {intern.email}
                                        </span>
                                      </span>
                                      {intern.intern_code && (
                                        <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                          {intern.intern_code}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <AssignmentGroup
                title={
                  role === 'TL'
                    ? 'Direct interns assigned to this TL'
                    : 'Assign interns to this Captain'
                }
                description={
                  role === 'TL'
                    ? 'Senior-TL-managed and unassigned interns can be transferred directly to this TL. Captain-managed interns remain visible through the hierarchy and are not selected here.'
                    : 'Assign interns who report directly to this Captain.'
                }
                singularLabel="Intern"
                pluralLabel="Interns"
                items={interns}
                availableItems={availableInterns}
                filteredItems={filteredInterns}
                search={internSearch}
                setSearch={setInternSearch}
                selectedIds={selectedInternIds}
                setSelectedIds={setSelectedInternIds}
                assignAll={assignAllInterns}
                setAssignAll={setAssignAllInterns}
                searchPlaceholder="Search name, email, Intern Code, or phone..."
                showInternCode
                showTransferStatus={role === 'CAPTAIN'}
                currentLeaderId={user.id}
                memberById={memberById}
              />
            </section>
          )}
        </div>
        <footer className="flex justify-end gap-3 border-t border-slate-200 px-6 py-5 dark:border-slate-700">
          <button
            onClick={onClose}
            className="rounded-2xl border px-5 py-3 font-bold"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-3 font-extrabold text-white disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
