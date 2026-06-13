import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { Card, Btn, Input, Select } from './ui';

export default function AttendanceMarkForm() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('PRESENT');
  const [remarks, setRemarks] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const { data: reports } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => api.get('/team/members').then((res) => res.data),
  });

  const markMutation = useMutation({
    mutationFn: (data) => api.post('/attendance/mark', data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['attendance'],
      });
      setError('');
      setMsg('✓ Attendance marked');
      setTimeout(() => setMsg(''), 2000);
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed'),
  });

  return (
    <Card className="p-5 mb-4">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        ✅ Mark Attendance
      </h3>
      {error && <p className="text-rose-600 text-sm mb-2">{error}</p>}
      {msg && <p className="text-green-600 text-sm mb-2">{msg}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          markMutation.mutate({ user_id: userId, date, status, remarks });
        }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <Select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
        >
          <option value="">Select member…</option>
          {reports?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name || u.email} ({u.role})
            </option>
          ))}
        </Select>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          required
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="PRESENT">Present</option>
          <option value="ABSENT">Absent</option>
          <option value="HALF_DAY">Half Day</option>
        </Select>
        <Input
          placeholder="Remarks (optional)"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
        <Btn
          type="submit"
          disabled={markMutation.isPending}
          className="sm:col-span-2"
        >
          {markMutation.isPending ? 'Marking…' : 'Mark attendance'}
        </Btn>
      </form>
    </Card>
  );
}
