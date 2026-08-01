import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { Card, Btn, Input } from './ui';
import CustomSelect from './CustomSelect';
import CustomDatePicker from './CustomDatePicker';

export default function BulkAttendanceForm({
  roster,
  departmentId: propDeptId,
}) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('PRESENT');
  const [remarks, setRemarks] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [departmentId, setDepartmentId] = useState(propDeptId || '');
  const [memberSearch, setMemberSearch] = useState('');
  const [fillMissing, setFillMissing] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((res) => res.data),
    enabled: !roster,
  });

  const { data: reports = [], isLoading: loadingReports } = useQuery({
    queryKey: ['teamMembers', departmentId],
    queryFn: () =>
      api
        .get('/team/members', {
          params: { department_id: departmentId || undefined },
        })
        .then((res) => res.data),
    enabled: !roster,
  });

  const bulkMutation = useMutation({
    mutationFn: (data) => api.post('/attendance/bulk', data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setError('');
      setMsg(`✓ Marked ${variables.entries.length} members`);
      setSelectedUsers([]);
      setRemarks('');
      setFillMissing(false);
      setTimeout(() => setMsg(''), 2500);
    },
    onError: (err) => setError(err.response?.data?.error || 'Bulk mark failed'),
  });

  const effectiveReports = roster || reports;
  const team = (effectiveReports ?? []).filter((u) =>
    (u.full_name || u.email)
      .toLowerCase()
      .includes(memberSearch.trim().toLowerCase())
  );
  const allSelected = team.length > 0 && selectedUsers.length === team.length;
  const today = new Date().toISOString().slice(0, 10);

  const fillStatus = status === 'PRESENT' ? 'ABSENT' : 'PRESENT';
  const remainingCount = team.length - selectedUsers.length;

  const statusOptions = [
    { value: 'PRESENT', label: 'Present' },
    { value: 'ABSENT', label: 'Absent' },
    { value: 'HALF_DAY', label: 'Half Day' },
  ];

  const departmentOptions = [
    { value: '', label: 'All departments' },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];

  const handleDepartmentChange = (val) => {
    setDepartmentId(val);
    setSelectedUsers([]);
  };

  const toggleAll = () => {
    setSelectedUsers(allSelected ? [] : team.map((u) => u.id));
  };

  const toggleUser = (id) =>
    setSelectedUsers((p) => {
      setError('');
      return p.includes(id) ? p.filter((x) => x !== id) : [...p, id];
    });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (selectedUsers.length === 0) {
      return setError('Select at least one member');
    }

    if (date > today) {
      return setError('Future dates cannot be selected for bulk operations');
    }

    const entries = selectedUsers.map((uid) => ({
      user_id: uid,
      date,
      status,
      remarks,
    }));

    if (fillMissing) {
      const others = team.filter((u) => !selectedUsers.includes(u.id));

      for (const u of others) {
        entries.push({
          user_id: u.id,
          date,
          status: fillStatus,
          remarks: '',
        });
      }
    }

    bulkMutation.mutate({ entries });
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
                {selectedUsers.length}
              </span>

              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            {!roster && (
              <CustomSelect
                value={departmentId}
                onChange={handleDepartmentChange}
                options={departmentOptions}
                placeholder="All departments"
                disabled={bulkMutation.isPending}
                className="w-full"
              />
            )}

            <Input
              placeholder="Search members..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              disabled={bulkMutation.isPending}
              className={roster ? 'col-span-1 sm:col-span-2' : ''}
            />
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

            <CustomDatePicker
              value={date}
              onChange={setDate}
              max={today}
              placeholder="Select date"
              disabled={bulkMutation.isPending}
              className="w-full"
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
              disabled={bulkMutation.isPending}
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
              disabled={bulkMutation.isPending}
            />
          </div>
        </div>

        {selectedUsers.length > 0 && remainingCount > 0 && (
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={fillMissing}
              onChange={(e) => setFillMissing(e.target.checked)}
              className="accent-indigo-600 w-3.5 h-3.5"
            />
            Auto-mark remaining {remainingCount} member
            {remainingCount === 1 ? '' : 's'}
            as {fillStatus === 'ABSENT' ? 'Absent' : 'Present'}
          </label>
        )}

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
