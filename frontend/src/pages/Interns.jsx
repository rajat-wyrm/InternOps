import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserRoundPlus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  UsersRound,
} from 'lucide-react';

import api from '../lib/axios';
import { Card, Btn, Input, EmptyState, Spinner } from '../components/ui';

const emptyForm = {
  serial_no: '',
  record_date: '',
  intern_code: '',
  full_name: '',
  email_id: '',
  mobile_no: '',
  domain: '',
  start_date: '',
  end_date: '',
};

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString();
}

function toInputDate(value) {
  if (!value) return '';

  const stringValue = String(value);

  // Handles values such as:
  // 2026-08-26
  // 2026-08-26T00:00:00.000Z
  return stringValue.slice(0, 10);
}

export default function Interns() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const {
    data: response,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['interns', search],

    queryFn: async () => {
      const res = await api.get('/interns', {
        params: {
          search: search || undefined,
          limit: 100,
          page: 1,
        },
      });

      return res.data;
    },
  });

  const save = useMutation({
    mutationFn: async (payload) => {
      if (editingId !== null) {
        return api.put(`/interns/${editingId}`, payload);
      }

      return api.post('/interns', payload);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['interns'],
      });

      setForm(emptyForm);
      setEditingId(null);
      setError('');
    },

    onError: (err) => {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          'Failed to save intern'
      );
    },
  });

  const remove = useMutation({
    mutationFn: async (id) => {
      return api.delete(`/interns/${id}`);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['interns'],
      });
    },

    onError: (err) => {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          'Failed to delete intern'
      );
    },
  });

  let interns = [];

  if (Array.isArray(response)) {
    interns = response;
  } else if (response && Array.isArray(response.data)) {
    interns = response.data;
  }

  const updateField = (name, value) => {
    setForm((old) => ({
      ...old,
      [name]: value,
    }));
  };

  const submit = (event) => {
    event.preventDefault();
    setError('');

    if (!form.serial_no || !form.intern_code || !form.full_name) {
      setError('Serial No., Intern Code and Full Name are required.');
      return;
    }

    save.mutate({
      serial_no: Number(form.serial_no),

      // Date column
      record_date: form.record_date || null,

      intern_code: form.intern_code.trim(),
      full_name: form.full_name.trim(),

      email_id: form.email_id.trim() || null,
      mobile_no: form.mobile_no.trim() || null,
      domain: form.domain.trim() || null,

      // Start Date
      start_date: form.start_date || null,

      // End Date
      end_date: form.end_date || null,
    });
  };

  const edit = (row) => {
    setEditingId(row.id);

    setForm({
      serial_no: row.serial_no ?? '',

      // Database record_date → Date field
      record_date: toInputDate(row.record_date),

      intern_code: row.intern_code ?? '',
      full_name: row.full_name ?? '',
      email_id: row.email_id ?? '',
      mobile_no: row.mobile_no ?? '',
      domain: row.domain ?? '',

      // Database start_date → Start Date field
      start_date: toInputDate(row.start_date),

      // Database end_date → End Date field
      end_date: toInputDate(row.end_date),
    });

    setError('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  };

  const deleteIntern = (row) => {
    const name =
      typeof row.full_name === 'string' ? row.full_name : 'this intern';

    if (window.confirm(`Delete ${name}?`)) {
      remove.mutate(row.id);
    }
  };

  return (
    <div className="animate-fade-in-up">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
            <UsersRound className="w-6 h-6" />
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300 font-extrabold">
              Workforce
            </p>

            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
              Interns
            </h1>

            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Manage intern records
            </p>
          </div>
        </div>

        {/* SEARCH */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />

          <Input
            className="pl-9"
            placeholder="Search interns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* FORM */}
      <Card className="p-6 mb-6">
        <form
          onSubmit={submit}
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          {/* S.NO */}
          <Input
            type="number"
            placeholder="S.No."
            value={form.serial_no}
            onChange={(e) => updateField('serial_no', e.target.value)}
            required
          />

          {/* DATE */}
          <Input
            type="date"
            value={form.record_date}
            onChange={(e) => updateField('record_date', e.target.value)}
          />

          {/* INTERN CODE */}
          <Input
            placeholder="Intern Code"
            value={form.intern_code}
            onChange={(e) => updateField('intern_code', e.target.value)}
            required
          />

          {/* FULL NAME */}
          <Input
            placeholder="Full Name"
            value={form.full_name}
            onChange={(e) => updateField('full_name', e.target.value)}
            required
          />

          {/* EMAIL ID */}
          <Input
            type="email"
            placeholder="Email ID"
            value={form.email_id}
            onChange={(e) => updateField('email_id', e.target.value)}
          />

          {/* MOBILE NO. */}
          <Input
            placeholder="Mobile No."
            value={form.mobile_no}
            onChange={(e) => updateField('mobile_no', e.target.value)}
          />

          {/* DOMAIN */}
          <Input
            placeholder="Domain"
            value={form.domain}
            onChange={(e) => updateField('domain', e.target.value)}
          />

          {/* START DATE */}
          <Input
            type="date"
            value={form.start_date}
            onChange={(e) => updateField('start_date', e.target.value)}
          />

          {/* END DATE */}
          <Input
            type="date"
            value={form.end_date}
            onChange={(e) => updateField('end_date', e.target.value)}
          />

          {/* BUTTONS */}
          <div className="md:col-span-3 flex gap-3">
            <Btn type="submit" disabled={save.isPending}>
              {save.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserRoundPlus className="w-4 h-4" />
              )}

              {editingId !== null ? 'Update Intern' : 'Add Intern'}
            </Btn>

            {editingId !== null && (
              <Btn type="button" variant="secondary" onClick={cancelEdit}>
                Cancel
              </Btn>
            )}
          </div>
        </form>

        {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
      </Card>

      {/* API ERROR */}
      {isError && (
        <Card className="p-6">
          <p className="text-rose-600 font-semibold">Failed to load interns.</p>

          <p className="text-sm text-slate-500 mt-1">
            Please check that the backend server is running.
          </p>
        </Card>
      )}

      {/* LOADING */}
      {!isError && isLoading && (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      )}

      {/* NO DATA */}
      {!isError && !isLoading && interns.length === 0 && (
        <EmptyState
          icon={<UsersRound className="w-12 h-12 text-slate-300" />}
          title="No interns yet"
          text="Add your first intern above."
        />
      )}

      {/* DATA TABLE */}
      {!isError && !isLoading && interns.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                <th className="p-3">S.No.</th>
                <th className="p-3">Date</th>
                <th className="p-3">Intern Code</th>
                <th className="p-3">Full Name</th>
                <th className="p-3">Email ID</th>
                <th className="p-3">Mobile No.</th>
                <th className="p-3">Domain</th>
                <th className="p-3">Start Date</th>
                <th className="p-3">End Date</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {interns.map((row, index) => {
                const id = row?.id ?? index;

                return (
                  <tr
                    key={id}
                    className="border-b border-slate-100 dark:border-slate-800"
                  >
                    {/* S.NO */}
                    <td className="p-3">{row?.serial_no ?? '—'}</td>

                    {/* DATE */}
                    <td className="p-3">{formatDate(row?.record_date)}</td>

                    {/* INTERN CODE */}
                    <td className="p-3 font-semibold">
                      {row?.intern_code ?? '—'}
                    </td>

                    {/* FULL NAME */}
                    <td className="p-3">{row?.full_name ?? '—'}</td>

                    {/* EMAIL ID */}
                    <td className="p-3">{row?.email_id ?? '—'}</td>

                    {/* MOBILE NO. */}
                    <td className="p-3">{row?.mobile_no ?? '—'}</td>

                    {/* DOMAIN */}
                    <td className="p-3">{row?.domain ?? '—'}</td>

                    {/* START DATE */}
                    <td className="p-3">{formatDate(row?.start_date)}</td>

                    {/* END DATE */}
                    <td className="p-3">{formatDate(row?.end_date)}</td>

                    {/* ACTIONS */}
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                          onClick={() => edit(row)}
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          className="p-2 rounded-xl hover:bg-rose-50 text-rose-600"
                          disabled={remove.isPending}
                          onClick={() => deleteIntern(row)}
                          title="Delete"
                        >
                          {remove.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
