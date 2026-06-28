import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const ref = useRef(null);
  const menuRef = useRef(null);

  const isSuspended = !!user.suspended;
  const isBusy = !!busy;

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      if (!ref.current) return;

      const rect = ref.current.getBoundingClientRect();
      const menuWidth = 192;
      const gap = 8;

      const left = Math.min(
        window.innerWidth - menuWidth - 12,
        Math.max(12, rect.right - menuWidth)
      );

      const top = Math.min(window.innerHeight - 160, rect.bottom + gap);

      setPosition({ top, left });
    };

    updatePosition();

    const onClick = (e) => {
      const clickedButton = ref.current && ref.current.contains(e.target);
      const clickedMenu = menuRef.current && menuRef.current.contains(e.target);

      if (!clickedButton && !clickedMenu) {
        setOpen(false);
      }
    };

    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[9999] w-48 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-950/15 dark:shadow-black/30 animate-fade-in"
          style={{
            top: position.top,
            left: position.left,
          }}
        >
          <div className="p-1.5">
            {isSuspended ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onActivate?.(user);
                }}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-emerald-700 dark:text-emerald-300 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
              >
                <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </span>
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
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-amber-700 dark:text-amber-300 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
              >
                <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/60 flex items-center justify-center">
                  <UserX className="w-4 h-4" />
                </span>
                Suspend
              </button>
            )}

            <div className="my-1.5 border-t border-slate-100 dark:border-slate-700" />

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDelete?.(user);
              }}
              className="w-full text-left flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-red-700 dark:text-red-300 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            >
              <span className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/60 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </span>
              Delete
            </button>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <div className="relative inline-block" ref={ref}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Actions for ${user.full_name || user.email}`}
          onClick={() => setOpen((o) => !o)}
          disabled={isBusy}
          className={`w-9 h-9 rounded-2xl flex items-center justify-center transition disabled:opacity-50 disabled:cursor-not-allowed ${
            open
              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
              : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {menu}
    </>
  );
}
