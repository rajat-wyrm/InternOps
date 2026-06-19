import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { Card, Btn, Input, Select } from './ui';

const INITIAL_FORM = {
  userId: '',
  date: new Date().toISOString().slice(0, 10),
  status: 'PRESENT',
  remarks: '',
};

export default function AttendanceMarkForm() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(INITIAL_FORM);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const { data: reports, isLoading: loadingReports } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => api.get('/team/members').then((res) => res.data),
  });

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const markMutation = useMutation({
    mutationFn: (data) => api.post('/attendance/mark', data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['attendance'],
      });
      setError('');
      setMsg('✓ Attendance marked');
      // Reset only the member + remarks fields — keep the same date and
      // status so consecutive marks for a single day are quick. The
      // date/status reset when the user changes them manually.
      setForm((f) => ({ ...f, userId: '', remarks: '' }));
      setTimeout(() => setMsg(''), 2000);
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed'),
  });

  const today = new Date().toISOString().slice(0, 10);

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
          markMutation.mutate({
            user_id: form.userId,
            date: form.date,
            status: form.status,
            remarks: form.remarks,
          });
        }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <div>
          {loadingReports ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 h-10 px-2">
              <span className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              Loading team…
            </div>
          ) : (
            <Select
              value={form.userId}
              onChange={update('userId')}
              required
              disabled={markMutation.isPending}
            >
              <option value="">Select member…</option>
              {reports?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email} ({u.role})
                </option>
              ))}
            </Select>
          )}
        </div>
        <Input
          type="date"
          value={form.date}
          onChange={update('date')}
          max={today}
          required
        />
        <Select
          value={form.status}
          onChange={update('status')}
          disabled={markMutation.isPending}
        >
          <option value="PRESENT">Present</option>
          <option value="ABSENT">Absent</option>
          <option value="HALF_DAY">Half Day</option>
        </Select>
        <Input
          placeholder="Remarks (optional)"
          value={form.remarks}
          onChange={update('remarks')}
          maxLength={500}
        />
        <Btn
          type="submit"
          disabled={markMutation.isPending || !form.userId}
          className="sm:col-span-2"
        >
          {markMutation.isPending ? 'Marking…' : 'Mark attendance'}
        </Btn>
      </form>
    </Card>
  );
}
