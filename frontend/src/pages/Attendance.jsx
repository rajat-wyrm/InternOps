import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck } from 'lucide-react'; // Added import here
import api from '../lib/axios';
import useAuthStore from '../store/auth';
import AttendanceMarkForm from '../components/AttendanceMarkForm';
import BulkAttendanceForm from '../components/BulkAttendanceForm';

const STATUS_BADGE = {
  PRESENT: 'bg-green-100 text-green-700',
  ABSENT: 'bg-red-100 text-red-700',
  HALF_DAY: 'bg-yellow-100 text-yellow-700',
};

export default function Attendance() {
  const { user } = useAuthStore();
  const canMark = ['CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN'].includes(user?.role);
  const isManager = canMark;
  const [viewUserId, setViewUserId] = useState(user?.id || '');
  const [page, setPage] = useState(1);
  const limit = 30;

  // Reset to the first page whenever the viewed user changes.
  const selectUser = (id) => {
    setViewUserId(id);
    setPage(1);
  };

  // Managers can pick any team member; everyone can always see their own.
  const { data: team = [] } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => api.get('/team/members').then((res) => res.data),
    enabled: isManager,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['attendance', viewUserId, page],
    queryFn: () =>
      api
        .get(`/attendance/${viewUserId}`, { params: { page, limit } })
        .then((res) => res.data),
    enabled: !!viewUserId,
    keepPreviousData: true,
  });

  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / limit), 1);

  const selectedName =
    viewUserId === user?.id
      ? 'Me'
      : team.find((m) => m.id === viewUserId)?.full_name ||
        team.find((m) => m.id === viewUserId)?.email ||
        '';

  return (
    <div className="animate-fade-in-up">
      {}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg shadow-sm">
          <CalendarCheck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
            Attendance
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track and manage daily attendance records
          </p>
        </div>
      </div>

      {canMark && (
        <>
          <AttendanceMarkForm />
          <BulkAttendanceForm />
        </>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm mb-4 border border-gray-100">
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          View attendance of
        </label>

        {isManager ? (
          <select
            value={viewUserId}
            onChange={(e) => selectUser(e.target.value)}
            className="border border-gray-200 rounded-lg p-2.5 w-full max-w-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
          >
            <option value={user?.id}>Me ({user?.email})</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name || m.email} ({m.role})
              </option>
            ))}
          </select>
        ) : (
          <p className="text-gray-700 font-medium">My attendance</p>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">
          {error.response?.data?.error || 'Failed to load attendance'}
        </div>
      )}

      {!isLoading &&
        !error &&
        (records.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-12 text-center text-gray-500">
            <CalendarCheck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p>No attendance records for {selectedName || 'this user'}.</p>
          </div>
        ) : (
          <>
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50 text-left text-gray-600 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Remarks</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-50">
                  {records.map((a) => (
                    <tr
                      key={a.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                        {new Date(a.date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${
                            STATUS_BADGE[a.status] || ''
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-gray-600">
                        {a.remarks || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
              <span>
                {total} record{total === 1 ? '' : 's'} · page {page} of{' '}
                {totalPages}
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors font-medium"
                >
                  Previous
                </button>

                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors font-medium"
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
