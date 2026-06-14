import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import useAuthStore from '../store/auth';
import RatingForm from '../components/RatingForm';

function Stars({ value }) {
  const full = Math.round(value || 0);
  return (
    <span className="text-amber-500">
      {'★'.repeat(full)}
      <span className="text-gray-300">{'★'.repeat(5 - full)}</span>
    </span>
  );
}

export default function Ratings() {
  const { user } = useAuthStore();
  const canRate = ['ADMIN', 'CAPTAIN', 'TL', 'SENIOR_TL'].includes(user?.role);
  const isManager = ['CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN'].includes(
    user?.role
  );
  const [viewUserId, setViewUserId] = useState(user?.id || '');

  const { data: team = [] } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => api.get('/team/members').then((res) => res.data),
    enabled: isManager,
  });

  const {
    data: ratings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ratings', viewUserId],
    queryFn: () => api.get(`/ratings/${viewUserId}`).then((res) => res.data),
    enabled: !!viewUserId,
  });

  const avg = ratings?.length
    ? (ratings.reduce((a, r) => a + r.score, 0) / ratings.length).toFixed(1)
    : null;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Ratings</h2>
      {canRate && <RatingForm />}

      <div className="bg-white p-4 rounded-xl shadow-sm mb-4 flex items-end justify-between flex-wrap gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            View ratings of
          </label>
          {isManager ? (
            <select
              value={viewUserId}
              onChange={(e) => setViewUserId(e.target.value)}
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
            <p className="text-gray-700">My ratings</p>
          )}
        </div>
        {avg && (
          <div className="text-right">
            <div className="text-2xl font-bold">{avg}</div>
            <div className="text-xs text-gray-500">avg of {ratings.length}</div>
          </div>
        )}
      </div>

      {isLoading && <p>Loading...</p>}
      {error && (
        <p className="text-red-500">
          {error.response?.data?.error || 'Failed to load ratings'}
        </p>
      )}
      {ratings &&
        (ratings.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
            No ratings yet.
          </div>
        ) : (
          <div className="space-y-2">
            {ratings.map((r) => (
              <div
                key={r.id}
                className="bg-white border rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <Stars value={r.score} />
                  <span className="text-xs text-gray-400">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                {r.remarks && (
                  <p className="text-gray-700 mt-1 italic">{r.remarks}</p>
                )}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
