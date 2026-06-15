import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { Card, Btn, Input, Select } from './ui';

export default function BulkAttendanceForm() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('PRESENT');
  const [remarks, setRemarks] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const { data: reports } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => api.get('/team/members').then((res) => res.data),
  });

  const bulkMutation = useMutation({
    mutationFn: (data) => api.post('/attendance/bulk', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setError('');
      setMsg(`✓ Marked ${selectedUsers.length} members`);
      setSelectedUsers([]);
      setTimeout(() => setMsg(''), 2500);
    },
    onError: (err) => setError(err.response?.data?.error || 'Bulk mark failed'),
  });

  const toggleUser = (id) =>
    setSelectedUsers((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id]
    );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedUsers.length === 0)
      return setError('Select at least one member');
    bulkMutation.mutate({
      entries: selectedUsers.map((uid) => ({
        user_id: uid,
        date,
        status,
        remarks,
      })),
    });
  };

  return (
    <Card className="p-5 mb-4">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        ⚡ Bulk Mark Attendance
      </h3>
      {error && <p className="text-rose-600 text-sm mb-2">{error}</p>}
      {msg && <p className="text-green-600 text-sm mb-2">{msg}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs text-gray-500">
            Select members ({selectedUsers.length} selected)
          </label>
          <div className="flex flex-wrap gap-2 mt-1 max-h-36 overflow-auto p-1">
            {reports?.map((u) => (
              <button
                type="button"
                key={u.id}
                onClick={() => toggleUser(u.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${selectedUsers.includes(u.id) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {u.full_name || u.email}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="PRESENT">Present</option>
            <option value="ABSENT">Absent</option>
            <option value="HALF_DAY">Half Day</option>
          </Select>
          <Input
            placeholder="Remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
        <Btn type="submit" variant="primary" disabled={bulkMutation.isPending}>
          {bulkMutation.isPending
            ? 'Marking…'
            : `Bulk mark ${selectedUsers.length || ''}`}
        </Btn>
      </form>
    </Card>
  );
}
