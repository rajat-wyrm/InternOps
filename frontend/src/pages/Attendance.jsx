import { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { CalendarCheck } from 'lucide-react';
import api from '../lib/axios';
import useAuthStore from '../store/auth';
import AttendanceMarkForm from '../components/AttendanceMarkForm';
import BulkAttendanceForm from '../components/BulkAttendanceForm';
import CustomSelect from '../components/CustomSelect';
import { ApiErrorState } from '../components/ui';

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
  deptId,
  roster = [],
} = {}) {
  const user = useAuthStore((s) => s.user);
  const canMark = ['CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN'].includes(user?.role);
  const isManager = canMark;

  const [viewUserId, setViewUserId] = useState(() => {
    if (isProjectView && roster.length > 0) {
      return roster[0].id;
    }
    return user?.id || '';
  });
  const [page, setPage] = useState(1);
  const limit = 30;

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

  // Managers can pick any team member; everyone can always see their own.
  const {
    data: team = [],
    isError: teamIsError,
    error: teamError,
    refetch: refetchTeam,
  } = useQuery({
    queryKey: ['authorizedMembers'],
    queryFn: () =>
      api.get('/attendance/authorized-members').then((res) => res.data),
    enabled: isManager && !isProjectView,
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['attendance', viewUserId, page],
    queryFn: () =>
      api
        .get(`/attendance/${viewUserId}`, { params: { page, limit } })
        .then((res) => res.data),
    enabled: !!viewUserId,
    placeholderData: keepPreviousData,
  });

  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / limit), 1);

  const effectiveTeam = isProjectView ? roster : team;

  const selectedName =
    viewUserId === user?.id
      ? 'Me'
      : effectiveTeam.find((m) => m.id === viewUserId)?.full_name ||
        effectiveTeam.find((m) => m.id === viewUserId)?.email ||
        '';

  const attendanceUserOptions = isProjectView
    ? roster.map((m) => ({
        value: m.id,
        label: `${m.full_name || m.email} (${m.role})`,
      }))
    : [
        {
          value: user?.id || '',
          label: `Me (${user?.email || 'Current user'})`,
        },
        ...team
          .filter((m) => m.id !== user?.id)
          .map((m) => ({
            value: m.id,
            label: `${m.full_name || m.email} (${m.role})`,
          })),
      ];

  return (
    <div className="animate-fade-in-up">
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

      {canMark && (
        <>
          <AttendanceMarkForm
            roster={isProjectView ? roster : undefined}
            departmentId={deptId}
          />
          <BulkAttendanceForm
            roster={isProjectView ? roster : undefined}
            departmentId={deptId}
          />
        </>
      )}

      <div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-3xl shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none mb-5 border border-slate-200 dark:border-slate-700">
        <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          View attendance of
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

            <CustomSelect
              value={viewUserId}
              onChange={selectUser}
              options={attendanceUserOptions}
              placeholder="Select member"
              className="w-full max-w-sm"
              disabled={teamIsError}
            />
          </>
        ) : (
          <p className="text-slate-700 dark:text-slate-200 font-bold">
            My attendance
          </p>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      )}

      {isError && (
        <ApiErrorState
          error={error}
          title="Failed to load attendance"
          fallback="Unable to load attendance records. Please try again."
          onRetry={refetch}
        />
      )}

      {!isLoading &&
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
                    <th className="px-6 py-4 font-extrabold">Remarks</th>
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

                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {a.remarks || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 text-sm text-slate-500 dark:text-slate-400">
              <span>
                {total} record{total === 1 ? '' : 's'} · page {page} of{' '}
                {totalPages}
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
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
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
  );
}
