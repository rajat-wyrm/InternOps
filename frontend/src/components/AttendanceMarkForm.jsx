import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { Card, Btn, Input } from './ui';
import CustomSelect from './CustomSelect';
import CustomDatePicker from './CustomDatePicker';

const INITIAL_FORM = {
  userId: '',
  date: new Date().toISOString().slice(0, 10),
  status: 'PRESENT',
  remarks: '',
};

export default function AttendanceMarkForm({
  roster,
  departmentId: propDeptId,
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(INITIAL_FORM);
  const [departmentId, setDepartmentId] = useState(propDeptId || '');
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

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const updateValue = (field) => (value) =>
    setForm((f) => ({ ...f, [field]: value }));

  const markMutation = useMutation({
    mutationFn: (data) => api.post('/attendance/mark', data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['attendance'],
      });
      queryClient.invalidateQueries({
        queryKey: ['memberHistory'],
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

  const effectiveReports = roster || reports;

  const memberOptions = [
    { value: '', label: 'Select member...' },
    ...(effectiveReports ?? []).map((u) => ({
      value: u.id,
      label: `${u.full_name || u.email} (${u.role})`,
    })),
  ];

  const departmentOptions = [
    { value: '', label: 'All departments' },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];

  const handleDepartmentChange = (val) => {
    setDepartmentId(val);
    setForm((f) => ({ ...f, userId: '' }));
  };

  const statusOptions = [
    { value: 'PRESENT', label: 'Present' },
    { value: 'ABSENT', label: 'Absent' },
    { value: 'HALF_DAY', label: 'Half Day' },
  ];

  return (
    <Card className="p-6 md:p-7 mb-6 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
        <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/60">
          <span className="text-lg font-extrabold">✓</span>
        </div>

        <div>
          <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
            Mark Attendance
          </h3>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Mark attendance for a single team member.
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError('');

          markMutation.mutate({
            user_id: form.userId,
            date: form.date,
            status: form.status,
            remarks: form.remarks,
          });
        }}
        className="space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!roster && (
            <div>
              <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                Department
              </label>

              <CustomSelect
                value={departmentId}
                onChange={handleDepartmentChange}
                options={departmentOptions}
                placeholder="All departments"
                disabled={markMutation.isPending}
                className="w-full"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
              Team Member
            </label>

            {loadingReports ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 h-[52px] px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70">
                <span className="w-4 h-4 border-2 border-slate-300 dark:border-slate-700 border-t-indigo-600 dark:border-t-indigo-300 rounded-full animate-spin" />
                Loading team...
              </div>
            ) : (
              <CustomSelect
                value={form.userId}
                onChange={updateValue('userId')}
                options={memberOptions}
                placeholder="Select member..."
                disabled={markMutation.isPending}
                className="w-full"
                searchable
              />
            )}
          </div>

          <div>
            <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
              Date
            </label>

            <CustomDatePicker
              value={form.date}
              onChange={updateValue('date')}
              max={today}
              placeholder="Select date"
              disabled={markMutation.isPending}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
              Status
            </label>

            <CustomSelect
              value={form.status}
              onChange={updateValue('status')}
              options={statusOptions}
              placeholder="Select status"
              disabled={markMutation.isPending}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
              Remarks
            </label>

            <Input
              placeholder="Optional remarks"
              value={form.remarks}
              onChange={update('remarks')}
              maxLength={500}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {form.userId
              ? 'Ready to mark attendance for the selected member.'
              : 'Select a member to enable attendance marking.'}
          </p>

          <Btn
            type="submit"
            disabled={markMutation.isPending || !form.userId}
            className="rounded-2xl px-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:shadow-indigo-200 dark:hover:shadow-none"
          >
            {markMutation.isPending ? 'Marking...' : 'Mark attendance'}
          </Btn>
        </div>
      </form>
    </Card>
  );
}
