import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import api from '../lib/axios';
import useAuthStore from '../store/auth';
import RatingForm from '../components/RatingForm';

function Stars({ value }) {
  const full = Math.round(value || 0);
  return (
    <span className="text-amber-500 text-lg tracking-widest drop-shadow-sm">
      {'★'.repeat(full)}
      <span className="text-gray-200">{'★'.repeat(5 - full)}</span>
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

  useEffect(() => {
    if (user?.id && !viewUserId) setViewUserId(user.id);
  }, [user?.id]);

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
    <div className="animate-fade-in-up">
      {/* 🚀 Professional Header 🚀 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-amber-100 text-amber-600 rounded-lg shadow-sm">
          <Star className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
            Ratings
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Evaluate performance and view historical scores
          </p>
        </div>
      </div>

      {canRate && <RatingForm />}

      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            View ratings of
          </label>
          {isManager ? (
            <select
              value={viewUserId}
              onChange={(e) => setViewUserId(e.target.value)}
              className="border border-gray-200 rounded-lg p-2.5 w-full max-w-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-sm"
            >
              <option value={user?.id}>Me ({user?.email})</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.email} ({m.role})
                </option>
              ))}
            </select>
          ) : (
            <p className="text-gray-700 font-medium bg-gray-50 px-4 py-2.5 rounded-lg inline-block">
              My ratings
            </p>
          )}
        </div>

        {avg && (
          <div className="text-right bg-amber-50 px-5 py-3 rounded-xl border border-amber-100/50">
            <div className="text-3xl font-extrabold text-amber-600">{avg}</div>
            <div className="text-xs font-medium text-amber-600/70 uppercase tracking-wider mt-0.5">
              avg of {ratings.length}
            </div>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">
          {error.response?.data?.error || 'Failed to load ratings'}
        </div>
      )}

      {ratings &&
        (ratings.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-12 text-center text-gray-500">
            <Star className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p>No ratings have been submitted yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ratings.map((r) => (
              <div
                key={r.id}
                className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <Stars value={r.score} />
                  <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-md">
                    {new Date(r.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                {r.remarks ? (
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {r.remarks}
                  </p>
                ) : (
                  <p className="text-gray-400 text-sm italic">
                    No remarks provided.
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
