import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, X } from 'lucide-react';
export default function DeleteDepartmentModal({
  department,
  stage,
  userCount,
  error,
  pending,
  onClose,
  onDelete,
  onContinue,
  onViewUsers,
}) {
  const [confirmation, setConfirmation] = useState('');
  useEffect(() => setConfirmation(''), [department, stage]);
  if (!department) return null;
  const assigned = stage === 'assigned';
  const removal = stage === 'remove';
  const exact = confirmation.trim() === department.name;
  const members = `${userCount} assigned ${userCount === 1 ? 'member' : 'members'}`;
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      onClick={() => !pending && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-700">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
                {removal
                  ? 'Review department removal'
                  : `Delete ${department.name}?`}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Protected removal with an audit trail
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 px-6 py-5 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          )}
          {!assigned && !removal && (
            <p>
              The department will be removed from active use. If active members
              are assigned, the next screen will explain the protected
              account-removal process.
            </p>
          )}
          {assigned && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              <strong>{members}</strong> are connected to this department.
              Member access can be removed and personal profile data anonymized.
              Shared organizational records will be retained.
            </div>
          )}
          {removal && (
            <>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
                <strong>{members}</strong> will lose access. Their personal
                profile information will be anonymized and the department will
                be removed from active use.
              </div>
              <label
                htmlFor="department-removal-confirmation"
                className="block font-extrabold text-slate-900 dark:text-white"
              >
                Type{' '}
                <span className="text-rose-600 dark:text-rose-300">
                  {department.name}
                </span>{' '}
                to confirm
              </label>
              <input
                id="department-removal-confirmation"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                disabled={pending}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 px-6 py-5 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-2xl border border-slate-300 px-5 py-3 font-extrabold dark:border-slate-700"
          >
            Cancel
          </button>
          {assigned && (
            <button
              type="button"
              onClick={onViewUsers}
              className="rounded-2xl border border-indigo-200 px-5 py-3 font-extrabold text-indigo-700 dark:border-indigo-800 dark:text-indigo-300"
            >
              View Members
            </button>
          )}
          {assigned && (
            <button
              type="button"
              onClick={onContinue}
              className="rounded-2xl bg-amber-500 px-5 py-3 font-extrabold text-slate-950"
            >
              Review Account Removal
            </button>
          )}
          {!assigned && !removal && (
            <button
              type="button"
              onClick={() => onDelete(null)}
              disabled={pending}
              className="rounded-2xl bg-rose-600 px-5 py-3 font-extrabold text-white"
            >
              {pending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Removing...
                </span>
              ) : (
                'Remove Department'
              )}
            </button>
          )}
          {removal && (
            <button
              type="button"
              onClick={() => onDelete(confirmation.trim())}
              disabled={pending || !exact}
              className="rounded-2xl bg-rose-600 px-5 py-3 font-extrabold text-white disabled:opacity-50"
            >
              {pending ? 'Removing...' : 'Remove Department and Member Access'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
