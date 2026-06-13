import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { Card, Btn, Textarea, Select } from './ui';

export default function RatingForm() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState('');
  const [score, setScore] = useState(5);
  const [remarks, setRemarks] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const { data: reports } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => api.get('/team/members').then((res) => res.data),
  });

  const rateMutation = useMutation({
    mutationFn: (data) => api.post('/ratings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratings'] });
      setError('');
      setMsg('✓ Rating submitted');
      setRemarks('');
      setTimeout(() => setMsg(''), 2000);
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed'),
  });

  return (
    <Card className="p-5 mb-4">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        ⭐ Rate a Team Member
      </h3>
      {error && <p className="text-rose-600 text-sm mb-2">{error}</p>}
      {msg && <p className="text-green-600 text-sm mb-2">{msg}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          rateMutation.mutate({ rated_user_id: userId, score, remarks });
        }}
        className="space-y-3"
      >
        <Select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
        >
          <option value="">Select member…</option>
          {reports?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name || u.email}
            </option>
          ))}
        </Select>
        <div>
          <label className="text-xs text-gray-500">Score</label>
          <div className="flex gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setScore(n)}
                className={`text-3xl transition hover:scale-110 ${n <= score ? 'text-amber-500' : 'text-gray-300'}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
        <Textarea
          placeholder="Remarks / feedback"
          rows={2}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
        <Btn variant="success" type="submit" disabled={rateMutation.isPending}>
          {rateMutation.isPending ? 'Submitting…' : `Submit ${score}★ rating`}
        </Btn>
      </form>
    </Card>
  );
}
