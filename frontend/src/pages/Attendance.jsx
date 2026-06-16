import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
    <div>
      <h2 className="text-2xl font-bold mb-4">Attendance</h2>

      {canMark && (
        <>
          <AttendanceMarkForm />
          <BulkAttendanceForm />
        </>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
        <label className="block text-xs text-gray-500 mb-1">
          View attendance of
        </label>

        {isManager ? (
          <select
            value={viewUserId}
            onChange={(e) => selectUser(e.target.value)}
            className="border rounded-lg p-2 w-full max-w-sm"
          >
            <option value={user?.id}>Me ({user?.email})</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name || m.email} ({m.role})
              </option>
            ))}
          </select>
        ) : (
          <p className="text-gray-700">My attendance</p>
        )}
      </div>

      {isLoading && <p>Loading...</p>}

      {error && (
        <p className="text-red-500">
          {error.response?.data?.error || 'Failed to load attendance'}
        </p>
      )}

      {!isLoading &&
        !error &&
        (records.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
            No attendance records for {selectedName || 'this user'}.
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Remarks</th>
                  </tr>
                </thead>

                <tbody>
                  {records.map((a) => (
                    <tr key={a.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">
                        {new Date(a.date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_BADGE[a.status] || ''
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>

                      <td className="p-3">{a.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
              <span>
                {total} record{total === 1 ? '' : 's'} · page {page} of{' '}
                {totalPages}
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>

                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
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
