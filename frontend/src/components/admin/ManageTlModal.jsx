import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Crown, X } from 'lucide-react';
import api from '../../lib/axios';
import CustomSelect from '../CustomSelect';
import { Spinner } from '../ui';

const ROLE_OPTIONS = [
  { value: 'TL', label: 'TL' },
  { value: 'CAPTAIN', label: 'Captain' },
  { value: 'INTERN', label: 'Intern' },
];

export default function ManageTlModal({ department, onClose, onCompleted }) {
  const [replacementId, setReplacementId] = useState('');
  const [outgoingRole, setOutgoingRole] = useState('TL');
  const [suspendOutgoing, setSuspendOutgoing] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, []);
  const {
    data: leads = [],
    isLoading: leadsLoading,
    isError: leadsFailed,
  } = useQuery({
    queryKey: ['departmentTeams', department.id],
    queryFn: () =>
      api.get(`/departments/${department.id}/teams`).then((r) => r.data || []),
  });
  const {
    data: userPage,
    isLoading: usersLoading,
    isError: usersFailed,
  } = useQuery({
    queryKey: ['departmentSeniorTlCandidates', department.id],
    queryFn: () => api.get('/users?limit=100').then((r) => r.data),
  });
  const currentSeniorTl = useMemo(
    () => leads.find((lead) => lead.role === 'SENIOR_TL') || null,
    [leads]
  );
  const candidates = useMemo(
    () =>
      (userPage?.data || []).filter(
        (candidate) =>
          candidate.department_id === department.id &&
          candidate.id !== currentSeniorTl?.lead_id &&
          !candidate.suspended &&
          ['TL', 'CAPTAIN', 'INTERN'].includes(candidate.role)
      ),
    [currentSeniorTl?.lead_id, department.id, userPage?.data]
  );
  const selected = candidates.find(
    (candidate) => candidate.id === replacementId
  );
  const handover = useMutation({
    mutationFn: () =>
      api.post(`/departments/${department.id}/senior-tl-handover`, {
        outgoing_lead_id: currentSeniorTl.lead_id,
        replacement_id: replacementId,
        outgoing_role: outgoingRole,
        suspend_outgoing: suspendOutgoing,
      }),
    onSuccess: onCompleted,
    onError: (requestError) =>
      setError(
        requestError.response?.data?.error ||
          'Senior TL replacement failed. No hierarchy changes were saved.'
      ),
  });
  const loading = leadsLoading || usersLoading;
  const failed = leadsFailed || usersFailed;
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Replace Senior TL
              </h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {department.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={handover.isPending}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 px-6 py-5">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner label="Loading Senior TL details..." />
            </div>
          ) : failed ? (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Unable to load Senior TL details.
            </div>
          ) : !currentSeniorTl ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              This department has no Senior TL to replace.
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Current Senior TL
                  </p>
                  <p className="mt-2 font-extrabold text-slate-900 dark:text-white">
                    {currentSeniorTl.lead_name || 'Unnamed Senior TL'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    After replacement
                  </p>
                  <p className="mt-2 font-extrabold text-slate-900 dark:text-white">
                    {selected?.full_name ||
                      selected?.email ||
                      'Select a replacement'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Outgoing Senior TL becomes {outgoingRole}
                  </p>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Replacement Senior TL
                </label>
                <CustomSelect
                  value={replacementId}
                  onChange={(value) => {
                    setReplacementId(value);
                    setError('');
                  }}
                  options={candidates.map((candidate) => ({
                    value: candidate.id,
                    label: `${candidate.full_name || candidate.email} (${candidate.role})`,
                  }))}
                  placeholder="Select an active department member"
                  searchable
                  disabled={!candidates.length || handover.isPending}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Outgoing Senior TL role
                </label>
                <CustomSelect
                  value={outgoingRole}
                  onChange={setOutgoingRole}
                  options={ROLE_OPTIONS}
                  disabled={handover.isPending}
                />
              </div>
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <input
                  type="checkbox"
                  checked={suspendOutgoing}
                  onChange={(event) => setSuspendOutgoing(event.target.checked)}
                  disabled={handover.isPending}
                  className="mt-1 h-4 w-4 accent-indigo-600"
                />
                <span>
                  <span className="block font-bold text-slate-800 dark:text-white">
                    Suspend outgoing Senior TL
                  </span>
                  <span className="mt-1 block text-sm text-slate-500">
                    Existing TL, Captain, and Intern assignments will not move.
                  </span>
                </span>
              </label>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                Only the two leadership roles are changed. The department
                hierarchy and all existing manager assignments remain unchanged.
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-5 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            disabled={handover.isPending}
            className="rounded-2xl border border-slate-200 px-5 py-3 font-bold dark:border-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handover.mutate()}
            disabled={
              !currentSeniorTl || !replacementId || handover.isPending || failed
            }
            className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 font-extrabold text-white disabled:opacity-50"
          >
            {handover.isPending
              ? 'Replacing Senior TL...'
              : 'Confirm Senior TL replacement'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
