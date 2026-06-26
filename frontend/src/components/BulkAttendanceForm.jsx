import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { Card, Btn, Input } from './ui';
import CustomSelect from './CustomSelect';

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

  const { data: reports = [], isLoading: loadingReports } = useQuery({
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

  const statusOptions = [
    { value: 'PRESENT', label: 'Present' },
    { value: 'ABSENT', label: 'Absent' },
    { value: 'HALF_DAY', label: 'Half Day' },
  ];

  const toggleAll = () => {
    if (atLimit && !allSelected) return;

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
    <Card className="p-6 md:p-7 mb-6 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
        <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 flex items-center justify-center border border-blue-100 dark:border-blue-900/60">
          <span className="text-lg font-extrabold">✓</span>
        </div>

        <div>
          <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
            Bulk Mark Attendance
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select multiple team members and mark attendance in one action.
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

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Select Members
            </label>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60">
                {selectedUsers.length}/{BULK_MAX}
              </span>

              <button
                type="button"
                onClick={toggleAll}
                disabled={atLimit && !allSelected}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-3">
            <div className="max-h-44 overflow-y-auto pr-1">
              {loadingReports ? (
                <p className="text-slate-500 dark:text-slate-400 text-sm px-2 py-3">
                  Loading team members...
                </p>
              ) : team.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-sm px-2 py-3">
                  No team members found.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {team.map((u) => {
                    const isSelected = selectedUsers.includes(u.id);

                    return (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => toggleUser(u.id)}
                        aria-pressed={isSelected}
                        className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all border ${
                          isSelected
                            ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-transparent shadow-sm'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-200 dark:hover:border-indigo-900/60'
                        }`}
                      >
                        {u.full_name || u.email}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
              Date
            </label>

            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>

          <div>
            <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
              Status
            </label>

            <CustomSelect
              value={status}
              onChange={setStatus}
              options={statusOptions}
              placeholder="Select status"
              className="w-full"
            />
          </div>

          <div>
            <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
              Remarks
            </label>

            <Input
              placeholder="Optional remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {selectedUsers.length === 0
              ? 'Select members to enable bulk marking.'
              : `${selectedUsers.length} member${
                  selectedUsers.length === 1 ? '' : 's'
                } selected.`}
          </p>

          <Btn
            type="submit"
            variant="primary"
            disabled={bulkMutation.isPending || selectedUsers.length === 0}
            className="rounded-2xl px-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:shadow-indigo-200 dark:hover:shadow-none"
          >
            {bulkMutation.isPending
              ? 'Marking...'
              : `Bulk mark ${selectedUsers.length || ''}`}
          </Btn>
        </div>
      </form>
    </Card>
  );
}
