import { useState, useRef, useEffect } from 'react';
import { MoreVertical, UserCheck, UserX, Trash2 } from 'lucide-react';

/**
 * User lifecycle action menu. Renders a kebab (⋮) button that opens a
 * popover with the suspend / activate / delete actions for a single
 * user. Closes on outside click or Escape.
 *
 * Fixes #407 — replaces the per-row button cluster with a single
 * discoverable trigger that scales as more actions are added.
 */
export default function UserActionMenu({
  user,
  onSuspend,
  onActivate,
  onDelete,
  busy,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isSuspended = !!user.suspended;
  const isBusy = !!busy;

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${user.full_name || user.email}`}
        onClick={() => setOpen((o) => !o)}
        disabled={isBusy}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition disabled:opacity-50"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-44 rounded-lg border border-gray-200 bg-white shadow-lg z-20 py-1 animate-fade-in"
        >
          {isSuspended ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onActivate?.(user);
              }}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <UserCheck className="w-4 h-4 text-success" />
              Activate
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSuspend?.(user);
              }}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <UserX className="w-4 h-4 text-warning" />
              Suspend
            </button>
          )}
          <div className="border-t border-gray-100 my-1" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete?.(user);
            }}
            className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
