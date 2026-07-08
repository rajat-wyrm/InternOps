import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { Card, Btn, Textarea } from './ui';
import RatingSuggestionCard from './RatingSuggestionCard';
import CustomSelect from './CustomSelect';

export default function RatingForm() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState('');
  const [score, setScore] = useState(10);
  const [remarks, setRemarks] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const { data: reports = [] } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => api.get('/team/members').then((res) => res.data),
  });

  const { data: suggestion, isLoading: suggestionLoading } = useQuery({
    queryKey: ['ratingSuggestion', userId],
    queryFn: () =>
      api.get(`/ratings/suggestions/${userId}`).then((res) => res.data),
    enabled: !!userId,
  });

  useEffect(() => {
    if (suggestion?.recommendation?.suggestedScore) {
      setScore(Math.round(suggestion.recommendation.suggestedScore));
    }
  }, [suggestion]);

  const rateMutation = useMutation({
    mutationFn: (data) => api.post('/ratings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratings'] });
      setError('');
      setMsg('✓ Rating submitted');
      setRemarks('');
      setUserId('');
      setScore(10);
      setTimeout(() => setMsg(''), 2000);
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed'),
  });

  const memberOptions = [
    { value: '', label: 'Select member...' },
    ...reports.map((u) => ({
      value: u.id,
      label: u.full_name || u.email,
    })),
  ];

  return (
    <Card className="p-6 md:p-7 mb-6 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
        <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 flex items-center justify-center border border-amber-100 dark:border-amber-900/60">
          ⭐
        </div>

        <div>
          <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
            Rate a Team Member
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select a member, choose a score, and submit feedback.
          </p>
        </div>
      </div>

      {error && (
        <div className="text-rose-700 dark:text-rose-300 text-sm mb-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/60 px-4 py-3 rounded-2xl font-medium">
          {error}
        </div>
      )}

      {msg && (
        <div className="text-emerald-700 dark:text-emerald-300 text-sm mb-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 px-4 py-3 rounded-2xl font-medium">
          {msg}
        </div>
      )}

      <RatingSuggestionCard
        suggestion={suggestion}
        loading={suggestionLoading}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          rateMutation.mutate({ rated_user_id: userId, score, remarks });
        }}
        className="space-y-5"
      >
        <div>
          <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
            Team Member
          </label>

          <CustomSelect
            value={userId}
            onChange={setUserId}
            options={memberOptions}
            placeholder="Select member..."
            className="w-full"
            disabled={rateMutation.isPending}
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Score
            </label>

            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60">
              {score}/10
            </span>
          </div>

          <div
            className={`rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-3 ${rateMutation.isPending ? 'opacity-60 pointer-events-none' : ''}`}
          >
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setScore(n)}
                  className={`h-10 rounded-2xl text-sm font-extrabold transition-all border ${
                    score === n
                      ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-transparent shadow-lg shadow-indigo-200/60 dark:shadow-none'
                      : n < score
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
                        : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  aria-label={`Set rating ${n} out of 10`}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all"
                style={{ width: `${score * 10}%` }}
              />
            </div>

            <div className="flex justify-between mt-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <span>Low</span>
              <span>Excellent</span>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
            Remarks / Feedback
          </label>

          <Textarea
            placeholder="Remarks / feedback"
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            disabled={rateMutation.isPending}
          />
        </div>

        <Btn
          variant="success"
          type="submit"
          disabled={rateMutation.isPending || !userId}
          className="rounded-2xl px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:shadow-emerald-200 dark:hover:shadow-none"
        >
          {rateMutation.isPending
            ? 'Submitting...'
            : `Submit ${score}/10 rating`}
        </Btn>
      </form>
    </Card>
  );
}
