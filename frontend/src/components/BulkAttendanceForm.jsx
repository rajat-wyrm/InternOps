import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { Card, Btn, Input, Select } from './ui';

// Client-side cap that matches the backend zod limit in
// backend/src/modules/attendance/routes.js. We refuse to even render the
// toggle-on button past this number, so a manager can never submit a
// request that the backend will reject.
const BULK_MAX = 500;

export default function BulkAttendanceForm() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('PRESENT');
  const [remarks, setRemarks] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const { data: reports, isLoading: loadingReports } = useQuery({
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
      setRemarks('');
      setTimeout(() => setMsg(''), 2500);
    },
    onError: (err) => setError(err.response?.data?.error || 'Bulk mark failed'),
  });

  const team = reports ?? [];
  const atLimit = selectedUsers.length >= BULK_MAX;
  const allSelected = team.length > 0 && selectedUsers.length === team.length;
  const toggleAll = () => {
    if (atLimit) return;
    setSelectedUsers(
      allSelected ? [] : team.slice(0, BULK_MAX).map((u) => u.id)
    );
  };
  const toggleUser = (id) =>
    setSelectedUsers((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id);
      if (p.length >= BULK_MAX) {
        setError(`Cannot select more than ${BULK_MAX} members at once`);
        return p;
      }
      setError('');
      return [...p, id];
    });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedUsers.length === 0) {
      return setError('Select at least one member');
    }
    if (selectedUsers.length > BULK_MAX) {
      return setError(`Cannot bulk-mark more than ${BULK_MAX} members at once`);
    }
    if (date > new Date().toISOString().slice(0, 10)) {
      return setError('Future dates cannot be selected for bulk operations');
    }
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
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-500">
              Select members ({selectedUsers.length}/{BULK_MAX})
            </label>
            <button
              type="button"
              onClick={toggleAll}
              disabled={atLimit && !allSelected}
              className="text-xs text-indigo-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-1 max-h-36 overflow-auto p-1">
            {loadingReports ? (
              <p className="text-gray-500 text-sm">Loading team members...</p>
            ) : team.length === 0 ? (
              <p className="text-gray-500 text-sm">No team members found.</p>
            ) : (
              team.map((u) => {
                const isSelected = selectedUsers.includes(u.id);
                return (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => toggleUser(u.id)}
                    aria-pressed={isSelected}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {u.full_name || u.email}
                  </button>
                );
              })
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            placeholder="Remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
        <div className="pt-1">
          <Btn
            type="submit"
            variant="primary"
            disabled={bulkMutation.isPending || selectedUsers.length === 0}
          >
            {bulkMutation.isPending
              ? 'Marking…'
              : `Bulk mark ${selectedUsers.length || ''}`}
          </Btn>
        </div>
      </form>
    </Card>
  );
}
