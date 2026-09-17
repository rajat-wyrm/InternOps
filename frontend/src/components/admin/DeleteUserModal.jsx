import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, X } from 'lucide-react';

export default function DeleteUserModal({
  user,
  pending,
  error,
  onClose,
  onConfirm,
}) {
  const [confirmation, setConfirmation] = useState('');
  useEffect(() => setConfirmation(''), [user]);
  if (!user) return null;
  const matches =
    confirmation.trim().toLowerCase() === user.email.toLowerCase();
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      onClick={() => !pending && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-user-title"
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-2xl dark:border-rose-900/60 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-700">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <h2
                id="remove-user-title"
                className="text-xl font-black tracking-tight text-slate-950 dark:text-white"
              >
                Remove user account?
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                This action cannot be reversed from the application.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            aria-label="Close"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 px-6 py-5">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
            <strong>{user.full_name || user.email}</strong> will lose access
            immediately. Personal profile information will be anonymized. Shared
            organizational records are retained without active-account access.
          </div>
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          )}
          <div>
            <label
              htmlFor="remove-user-confirmation"
              className="mb-2 block text-sm font-extrabold text-slate-800 dark:text-slate-100"
            >
              Type{' '}
              <span className="text-rose-600 dark:text-rose-300">
                {user.email}
              </span>{' '}
              to confirm
            </label>
            <input
              id="remove-user-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={pending}
              autoComplete="off"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-5 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-2xl border border-slate-300 px-5 py-3 font-extrabold dark:border-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(confirmation.trim())}
            disabled={pending || !matches}
            className="rounded-2xl bg-rose-600 px-5 py-3 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'Removing...' : 'Remove User and Revoke Access'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
