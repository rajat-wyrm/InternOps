import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  className = '',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return undefined;

    const updatePosition = () => {
      if (!triggerRef.current) return;

      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = Math.min(options.length * 48 + 12, 288);
      const gap = 8;

      let top = rect.bottom + gap;
      const left = rect.left;
      const width = rect.width;

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      if (spaceBelow < menuHeight + 16 && spaceAbove > menuHeight) {
        top = rect.top - menuHeight - gap;
      }

      setPosition({
        top,
        left,
        width,
      });
    };

    updatePosition();

    const handleClick = (e) => {
      const clickedTrigger =
        triggerRef.current && triggerRef.current.contains(e.target);
      const clickedMenu = menuRef.current && menuRef.current.contains(e.target);

      if (!clickedTrigger && !clickedMenu) {
        setOpen(false);
      }
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, options.length]);

  const dropdown =
    open &&
    createPortal(
      <div
        ref={menuRef}
        className="fixed z-[9999] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-2xl shadow-slate-950/20 dark:shadow-black/50 animate-fade-in"
        style={{
          top: position.top,
          left: position.left,
          width: position.width,
        }}
      >
        <div className="p-1.5 max-h-72 overflow-y-auto">
          {options.map((option) => {
            const active = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`group relative w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-left transition-all duration-150 overflow-hidden ${
                  active
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 dark:hover:from-indigo-950/45 dark:hover:to-slate-800 hover:text-indigo-700 dark:hover:text-indigo-300 hover:translate-x-0.5'
                }`}
              >
                <span
                  className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-all duration-150 ${
                    active
                      ? 'bg-indigo-600 dark:bg-indigo-400 opacity-100'
                      : 'bg-indigo-500 dark:bg-indigo-400 opacity-0 group-hover:opacity-100'
                  }`}
                />

                <span className="relative z-10 truncate pl-1">
                  {option.label}
                </span>

                <span className="relative z-10 flex items-center justify-center shrink-0">
                  {active ? (
                    <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-transparent group-hover:border-indigo-300 dark:group-hover:border-indigo-700 transition" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>,
      document.body
    );

  return (
    <>
      <div ref={triggerRef} className={`relative ${className}`}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          className={`w-full min-h-[52px] px-5 pr-12 rounded-2xl border text-left text-sm font-extrabold transition-all flex items-center shadow-sm ${
            open
              ? 'border-indigo-400 ring-2 ring-indigo-400/20 bg-white dark:bg-slate-800 text-slate-900 dark:text-white'
              : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          <span
            className={selected ? '' : 'text-slate-400 dark:text-slate-500'}
          >
            {selected ? selected.label : placeholder}
          </span>

          <ChevronDown
            className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
              open ? 'rotate-180 text-indigo-500 dark:text-indigo-300' : ''
            }`}
          />
        </button>
      </div>

      {dropdown}
    </>
  );
}
