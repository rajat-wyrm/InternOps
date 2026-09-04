import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { CalendarCheck, Building2, Star, Target } from 'lucide-react';
import api from '../lib/axios';
import useAuthStore from '../store/auth';
import AttendanceMarkForm from '../components/AttendanceMarkForm';
import BulkAttendanceForm from '../components/BulkAttendanceForm';
import CustomSelect from '../components/CustomSelect';
import { ApiErrorState } from '../components/ui';
import { ROLE_LABEL } from '../constants/roles';
import DepartmentAttendanceSheet from '../components/department/DepartmentAttendanceSheet';

function monthRange(month, today) {
  const [year, monthNumber] = month.split('-').map(Number);
  const from = `${month}-01`;
  const lastDay = new Date(Date.UTC(year, monthNumber, 0))
    .toISOString()
    .slice(0, 10);
  return { from, to: month === today.slice(0, 7) ? today : lastDay };
}
const ATTENDANCE_ROLE_ORDER = {
  ADMIN: 0,
  SENIOR_TL: 1,
  TL: 2,
  CAPTAIN: 3,
  INTERN: 4,
};
function sortAttendanceMembers(members) {
  return [...members].sort((a, b) => {
    const roleDifference =
      (ATTENDANCE_ROLE_ORDER[a.role] ?? 99) -
      (ATTENDANCE_ROLE_ORDER[b.role] ?? 99);
    if (roleDifference) return roleDifference;
    return String(a.full_name || a.email || '').localeCompare(
      String(b.full_name || b.email || ''),
      undefined,
      { sensitivity: 'base' }
    );
  });
}
const STATUS_BADGE = {
  PRESENT:
    'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/60',
  ABSENT:
    'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-900/60',
  HALF_DAY:
    'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/60',
};

export default function Attendance({
  isProjectView = false,
  deptId: propDeptId,
  roster = [],
  onViewAllAttendance,
} = {}) {
  const { deptId: routeDeptId } = useParams();
  const deptId = propDeptId || routeDeptId;
  const user = useAuthStore((s) => s.user);
  const requestedDeptId =
    deptId || user?.departmentId || user?.department_id || '';
  const canMark = ['CAPTAIN', 'TL', 'SENIOR_TL'].includes(user?.role);
  const isAdmin = user?.role === 'ADMIN';
  const canViewAttendanceSheet = [
    'ADMIN',
    'SENIOR_TL',
    'TL',
    'CAPTAIN',
  ].includes(user?.role);
  const canViewAttendance = ['CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN'].includes(
    user?.role
  );
  const isManager = canViewAttendance;

  const [viewUserId, setViewUserId] = useState(() => {
    if (isProjectView && roster.length > 0) {
      return roster[0].id;
    }
    return user?.id || '';
  });
  const [page, setPage] = useState(1);
  const [viewAll, setViewAll] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const { from: sheetFrom, to: sheetTo } = monthRange(selectedMonth, today);
  const limit = 30;

  const switchAttendanceView = () => {
    setViewAll((current) => !current);
  };

  useEffect(() => {
    if (isProjectView && roster.length > 0) {
      setViewUserId(roster[0].id);
      setPage(1);
    }
  }, [isProjectView, roster]);

  // Reset to the first page whenever the viewed user changes.
  const selectUser = (id) => {
    setViewUserId(id);
    setPage(1);
  };

  // Managers use their first authorized department as the default scope.
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((res) => res.data),
    enabled: isManager && !isProjectView,
  });

  // Managers can pick any team member; everyone can always see their own.
  const {
    data: team = [],
    isError: teamIsError,
    error: teamError,
    refetch: refetchTeam,
  } = useQuery({
    queryKey: ['authorizedAttendanceMembers', user?.id, requestedDeptId],
    queryFn: () =>
      api
        .get('/attendance/authorized-members', {
          params: isAdmin
            ? { department_id: requestedDeptId || undefined }
            : undefined,
        })
        .then((res) => res.data || []),
    enabled: canViewAttendance && !isProjectView && !!user?.id,
  });

  const teamDeptId = team.find((member) => member.department_id)?.department_id;
  const assignedDeptId = departments[0]?.id || '';
  const resolvedDeptId = requestedDeptId || teamDeptId || assignedDeptId;
  const departmentIsResolving =
    canViewAttendanceSheet && !isProjectView && !resolvedDeptId && !teamIsError;

  const activeDepartment = departments.find(
    (department) => department.id === resolvedDeptId
  );

  const {
    data: sheetData,
    isLoading: sheetIsLoading,
    isFetching: sheetIsFetching,
    error: sheetError,
    refetch: refetchSheet,
  } = useQuery({
    queryKey: ['departmentAttendanceSheet', resolvedDeptId, sheetFrom, sheetTo],
    queryFn: () =>
      api
        .get(`/attendance/department/${resolvedDeptId}/sheet`, {
          params: { from: sheetFrom, to: sheetTo },
        })
        .then((res) => res.data),
    enabled: viewAll && !!resolvedDeptId,
  });

  const sheetAvailableMonths = sheetData?.available_months || [];
  const sheetMatchesSelectedMonth =
    !!sheetData &&
    (sheetAvailableMonths.length === 0 ||
      sheetAvailableMonths.includes(selectedMonth));
  const validSheetData = sheetMatchesSelectedMonth ? sheetData : null;
  const attendanceSheetIsPending =
    viewAll &&
    !!resolvedDeptId &&
    (sheetIsLoading || !sheetMatchesSelectedMonth);
  useEffect(() => {
    if (
      !sheetAvailableMonths.length ||
      sheetAvailableMonths.includes(selectedMonth)
    ) {
      return;
    }
    setSelectedMonth(sheetAvailableMonths[sheetAvailableMonths.length - 1]);
  }, [selectedMonth, sheetData?.available_months]);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['attendance', viewUserId, page],
    queryFn: () =>
      api
        .get(`/attendance/${viewUserId}`, { params: { page, limit } })
        .then((res) => res.data),
    enabled: !!viewUserId && !viewAll,
    placeholderData: keepPreviousData,
  });

  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / limit), 1);

  const effectiveTeam = isProjectView ? roster : team;

  useEffect(() => {
    if (isProjectView || team.length === 0) return;
    const selectedUserIsVisible =
      viewUserId === user?.id ||
      team.some((member) => member.id === viewUserId);
    if (!selectedUserIsVisible) {
      setViewUserId(user?.id || sortAttendanceMembers(team)[0].id);
      setPage(1);
    }
  }, [isProjectView, team, user?.id, viewUserId]);
  const selectedName =
    viewUserId === user?.id
      ? 'Me'
      : effectiveTeam.find((m) => m.id === viewUserId)?.full_name ||
        effectiveTeam.find((m) => m.id === viewUserId)?.email ||
        '';

  const attendanceOptionMembers = isProjectView
    ? sortAttendanceMembers(roster)
    : sortAttendanceMembers([
        ...(user?.id
          ? [
              {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                isCurrentUser: true,
              },
            ]
          : []),
        ...team.filter((member) => member.id !== user?.id),
      ]);
  const attendanceUserOptions = attendanceOptionMembers.map((member) => ({
    value: member.id,
    label: member.isCurrentUser
      ? `Me (${member.email || 'Current user'}) - ${ROLE_LABEL[member.role] || member.role}`
      : `${member.full_name || member.email} (${ROLE_LABEL[member.role] || member.role})`,
  }));

  return (
    <div>
      {/* Admin Department Navigation Context Banner */}
      {isAdmin && deptId && !isProjectView && (
        <div className="mb-6 p-4 rounded-3xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-indigo-500/20 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider text-indigo-300">
                  Department Context
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200">
                  Admin Scope
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-white">
                {activeDepartment?.name || 'Department View'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            <Link
              to={`/admin/departments/${deptId}/attendance`}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 text-white shadow-sm"
            >
              Attendance
            </Link>
            <Link
              to={`/admin/departments/${deptId}/ratings`}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-indigo-100 transition"
            >
              Ratings
            </Link>
            <Link
              to={`/admin/departments/${deptId}/tasks`}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-indigo-100 transition"
            >
              Tasks
            </Link>
            <Link
              to="/admin/departments"
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-indigo-200 transition ml-auto md:ml-2"
            >
              Change Department
            </Link>
          </div>
        </div>
      )}

      {/* Professional Header Block */}
      {!isProjectView && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shadow-sm">
              <CalendarCheck className="w-6 h-6" />
            </div>

            <div>
              <p className="text-xs md:text-sm uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300 font-extrabold mb-1">
                Attendance
              </p>

              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Attendance
              </h1>

              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
                Track and manage daily attendance records
              </p>
            </div>
          </div>
        </div>
      )}

      {/* For Admin: render View Section on top, Marking Forms at bottom. For others: Marking Forms on top, View Section at bottom */}
      {isAdmin ? (
        <>
          <div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-3xl shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none mb-5 border border-slate-200 dark:border-slate-700">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              View attendance for
            </label>

            {isManager ? (
              <>
                {teamIsError && (
                  <div className="mb-4">
                    <ApiErrorState
                      error={teamError}
                      title="Failed to load authorized members"
                      fallback="Unable to load members you can view. Please try again."
                      onRetry={refetchTeam}
                    />
                  </div>
                )}

                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CustomSelect
                    value={viewUserId}
                    onChange={selectUser}
                    options={attendanceUserOptions}
                    placeholder="Select member"
                    className="w-full sm:max-w-sm"
                    disabled={teamIsError}
                    searchable={true}
                  />

                  {isProjectView && onViewAllAttendance ? (
                    <button
                      type="button"
                      onClick={() => onViewAllAttendance(viewUserId)}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                    >
                      <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                      View all attendance
                    </button>
                  ) : (
                    canViewAttendanceSheet &&
                    resolvedDeptId && (
                      <button
                        type="button"
                        onClick={switchAttendanceView}
                        aria-label={
                          viewAll
                            ? 'Switch to individual view'
                            : 'View all attendance'
                        }
                        className={`relative h-11 shrink-0 overflow-hidden rounded-xl bg-emerald-600 text-sm font-extrabold text-white transition-[width,background-color] duration-300 ease-in-out hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 ${
                          viewAll ? 'w-[152px]' : 'w-[104px]'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute inset-0 flex items-center justify-center whitespace-nowrap transition-[opacity,transform] duration-200 ease-out ${
                            viewAll
                              ? 'translate-y-0 opacity-100'
                              : '-translate-y-1 opacity-0'
                          }`}
                        >
                          Individual View
                        </span>

                        <span
                          aria-hidden="true"
                          className={`absolute inset-0 flex items-center justify-center whitespace-nowrap transition-[opacity,transform] duration-200 ease-out ${
                            viewAll
                              ? 'translate-y-1 opacity-0'
                              : 'translate-y-0 opacity-100'
                          }`}
                        >
                          View All
                        </span>

                        <span className="sr-only">
                          {viewAll ? 'Individual View' : 'View All'}
                        </span>
                      </button>
                    )
                  )}
                </div>
              </>
            ) : (
              <p className="text-slate-700 dark:text-slate-200 font-bold">
                My attendance
              </p>
            )}
          </div>

          <div aria-live="polite">
            {viewAll && (
              <div className="mb-5">
                <DepartmentAttendanceSheet
                  departmentName={activeDepartment?.name}
                  data={validSheetData}
                  selectedMonth={selectedMonth}
                  onMonthChange={setSelectedMonth}
                  isLoading={attendanceSheetIsPending || sheetIsLoading}
                  isRefreshing={sheetIsFetching && !!validSheetData}
                  error={sheetError}
                  onRetry={refetchSheet}
                />
              </div>
            )}
            {!viewAll && isLoading && (
              <div className="flex justify-center p-8 mb-5">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
              </div>
            )}

            {!viewAll && isError && (
              <div className="mb-5">
                <ApiErrorState
                  error={error}
                  title="Failed to load attendance"
                  fallback="Unable to load attendance records. Please try again."
                  onRetry={refetch}
                />
              </div>
            )}

            {!viewAll &&
              !isLoading &&
              !isError &&
              (records.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none p-12 text-center text-slate-500 dark:text-slate-400 mb-5">
                  <CalendarCheck className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />

                  <p className="font-semibold">
                    No attendance records for {selectedName || 'this user'}.
                  </p>
                </div>
              ) : (
                <div className="mb-5">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-950 text-left text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="px-6 py-4 font-extrabold">Date</th>
                          <th className="px-6 py-4 font-extrabold">Status</th>
                          <th className="px-6 py-4 text-center font-extrabold">
                            Remarks
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {records.map((a, index) => (
                          <tr
                            key={a.id}
                            className={`transition-colors border-b border-slate-100 dark:border-slate-700 last:border-b-0 ${
                              index % 2 === 0
                                ? 'bg-white dark:bg-slate-900'
                                : 'bg-slate-50/50 dark:bg-slate-800/35'
                            } hover:bg-emerald-50/40 dark:hover:bg-slate-800`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-slate-700 dark:text-slate-200 font-medium">
                              {new Date(a.date).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold tracking-wide ${
                                  STATUS_BADGE[a.status] || ''
                                }`}
                              >
                                {a.status}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-300">
                              {a.remarks ? (
                                a.remarks
                              ) : (
                                <span
                                  className="inline-flex min-h-5 items-center justify-center text-base leading-none"
                                  aria-label="No remarks"
                                >
                                  &mdash;
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between mt-4 text-sm text-slate-500 dark:text-slate-400">
                    <span>
                      {total} record{total === 1 ? '' : 's'} &middot; page{' '}
                      {page} of {totalPages}
                    </span>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                        disabled={page <= 1}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-bold"
                      >
                        Previous
                      </button>

                      <button
                        onClick={() =>
                          setPage((p) => Math.min(p + 1, totalPages))
                        }
                        disabled={page >= totalPages}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-bold"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
          {canMark && (
            <>
              <AttendanceMarkForm
                roster={isProjectView ? roster : undefined}
                departmentId={resolvedDeptId || undefined}
              />
              <BulkAttendanceForm
                roster={isProjectView ? roster : undefined}
                departmentId={resolvedDeptId || undefined}
              />
            </>
          )}
        </>
      ) : (
        <>
          {canMark && (
            <>
              <AttendanceMarkForm
                roster={isProjectView ? roster : undefined}
                departmentId={resolvedDeptId || undefined}
              />
              <BulkAttendanceForm
                roster={isProjectView ? roster : undefined}
                departmentId={resolvedDeptId || undefined}
              />
            </>
          )}

          <div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-3xl shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none mb-5 border border-slate-200 dark:border-slate-700">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              View attendance for
            </label>

            {isManager ? (
              <>
                {teamIsError && (
                  <div className="mb-4">
                    <ApiErrorState
                      error={teamError}
                      title="Failed to load authorized members"
                      fallback="Unable to load members you can view. Please try again."
                      onRetry={refetchTeam}
                    />
                  </div>
                )}

                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CustomSelect
                    value={viewUserId}
                    onChange={selectUser}
                    options={attendanceUserOptions}
                    placeholder="Select member"
                    className="w-full sm:max-w-sm"
                    disabled={teamIsError}
                    searchable={true}
                  />
                  {!isProjectView && departmentIsResolving && (
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 sm:ml-auto">
                      Resolving department attendance...
                    </p>
                  )}
                  {isProjectView && onViewAllAttendance ? (
                    <button
                      type="button"
                      onClick={() => onViewAllAttendance(viewUserId)}
                      className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-extrabold text-white transition-colors hover:bg-emerald-700 sm:ml-auto sm:w-auto"
                    >
                      <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                      View All Attendance
                    </button>
                  ) : (
                    canViewAttendanceSheet &&
                    resolvedDeptId && (
                      <button
                        type="button"
                        onClick={switchAttendanceView}
                        className="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-extrabold text-white transition-colors hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-70 sm:ml-auto sm:w-auto"
                      >
                        {viewAll ? 'Individual View' : 'View All'}
                      </button>
                    )
                  )}
                </div>
              </>
            ) : (
              <p className="text-slate-700 dark:text-slate-200 font-bold">
                My attendance
              </p>
            )}
          </div>

          <div aria-live="polite">
            {viewAll && (
              <div className="mb-5">
                <DepartmentAttendanceSheet
                  departmentName={activeDepartment?.name}
                  data={validSheetData}
                  selectedMonth={selectedMonth}
                  onMonthChange={setSelectedMonth}
                  isLoading={attendanceSheetIsPending || sheetIsLoading}
                  isRefreshing={sheetIsFetching && !!validSheetData}
                  error={sheetError}
                  onRetry={refetchSheet}
                />
              </div>
            )}
            {!viewAll && isLoading && (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
              </div>
            )}

            {!viewAll && isError && (
              <ApiErrorState
                error={error}
                title="Failed to load attendance"
                fallback="Unable to load attendance records. Please try again."
                onRetry={refetch}
              />
            )}

            {!viewAll &&
              !isLoading &&
              !isError &&
              (records.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none p-12 text-center text-slate-500 dark:text-slate-400">
                  <CalendarCheck className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />

                  <p className="font-semibold">
                    No attendance records for {selectedName || 'this user'}.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-950 text-left text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="px-6 py-4 font-extrabold">Date</th>
                          <th className="px-6 py-4 font-extrabold">Status</th>
                          <th className="px-6 py-4 text-center font-extrabold">
                            Remarks
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {records.map((a, index) => (
                          <tr
                            key={a.id}
                            className={`transition-colors border-b border-slate-100 dark:border-slate-700 last:border-b-0 ${
                              index % 2 === 0
                                ? 'bg-white dark:bg-slate-900'
                                : 'bg-slate-50/50 dark:bg-slate-800/35'
                            } hover:bg-emerald-50/40 dark:hover:bg-slate-800`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-slate-700 dark:text-slate-200 font-medium">
                              {new Date(a.date).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold tracking-wide ${
                                  STATUS_BADGE[a.status] || ''
                                }`}
                              >
                                {a.status}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-300">
                              {a.remarks ? (
                                a.remarks
                              ) : (
                                <span
                                  className="inline-flex min-h-5 items-center justify-center text-base leading-none"
                                  aria-label="No remarks"
                                >
                                  &mdash;
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between mt-4 text-sm text-slate-500 dark:text-slate-400">
                    <span>
                      {total} record{total === 1 ? '' : 's'} &middot; page{' '}
                      {page} of {totalPages}
                    </span>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                        disabled={page <= 1}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-bold"
                      >
                        Previous
                      </button>

                      <button
                        onClick={() =>
                          setPage((p) => Math.min(p + 1, totalPages))
                        }
                        disabled={page >= totalPages}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-bold"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
