import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function parseMonth(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(value || '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year, month } : null;
}

function formatMonth(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function displayMonth(value) {
  const parsed = parseMonth(value);
  return parsed ? `${MONTHS[parsed.month - 1]} ${parsed.year}` : '';
}

export default function CustomMonthPicker({
  value,
  onChange,
  min,
  max,
  allowedMonths,
  placeholder = 'Select month',
  className = '',
  disabled = false,
}) {
  const now = new Date();
  const current = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const selected = parseMonth(value);
  const minimum = parseMonth(min);
  const maximum = parseMonth(max);
  const allowed = useMemo(
    () => (Array.isArray(allowedMonths) ? new Set(allowedMonths) : null),
    [allowedMonths]
  );
  const allowedYears = useMemo(
    () =>
      allowed
        ? [
            ...new Set([...allowed].map((month) => Number(month.slice(0, 4)))),
          ].sort((a, b) => a - b)
        : [],
    [allowed]
  );

  const [open, setOpen] = useState(false);
  const [positionReady, setPositionReady] = useState(false);
  const [viewYear, setViewYear] = useState(selected?.year || current.year);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 320 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (selected) setViewYear(selected.year);
  }, [value, selected?.year]);

  useEffect(() => {
    if (!open) {
      setPositionReady(false);
      return undefined;
    }

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, window.innerWidth - 24);
      const left = Math.min(
        Math.max(12, rect.left),
        window.innerWidth - width - 12
      );
      const estimatedHeight = 300;
      const below = window.innerHeight - rect.bottom;
      const top =
        below >= estimatedHeight + 12
          ? rect.bottom + 8
          : Math.max(12, rect.top - estimatedHeight - 8);
      setPosition({ top, left, width });
      setPositionReady(true);
    };

    const closeOutside = (event) => {
      if (
        !triggerRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const closeEscape = (event) => event.key === 'Escape' && setOpen(false);

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeEscape);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [open]);

  const isDisabled = (year, month) => {
    const candidate = formatMonth(year, month);
    return (
      (min && candidate < min) ||
      (max && candidate > max) ||
      Boolean(allowed && !allowed.has(candidate))
    );
  };

  const chooseMonth = (month) => {
    if (isDisabled(viewYear, month)) return;
    onChange(formatMonth(viewYear, month));
    setOpen(false);
  };

  const moveYear = (direction) => {
    if (allowed && !allowedYears.length) return;
    if (!allowed) {
      setViewYear((year) => year + direction);
      return;
    }
    const currentIndex = allowedYears.indexOf(viewYear);
    const nextIndex =
      currentIndex < 0
        ? direction > 0
          ? 0
          : allowedYears.length - 1
        : currentIndex + direction;
    if (allowedYears[nextIndex] != null) setViewYear(allowedYears[nextIndex]);
  };

  const picker =
    open &&
    createPortal(
      <div
        ref={menuRef}
        className="fixed z-[9999] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 dark:border-slate-700 dark:bg-slate-950 dark:shadow-black/50"
        style={{
          top: position.top,
          left: position.left,
          width: position.width,
          visibility: positionReady ? 'visible' : 'hidden',
          pointerEvents: positionReady ? 'auto' : 'none',
        }}
        role="dialog"
        aria-label="Choose month"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <button
            type="button"
            onClick={() => moveYear(-1)}
            disabled={Boolean(
              allowed
                ? !allowedYears.length || viewYear <= allowedYears[0]
                : minimum && viewYear <= minimum.year
            )}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Previous year"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="text-sm font-extrabold text-slate-900 dark:text-white">
            {viewYear}
          </p>
          <button
            type="button"
            onClick={() => moveYear(1)}
            disabled={Boolean(
              allowed
                ? !allowedYears.length ||
                    viewYear >= allowedYears[allowedYears.length - 1]
                : maximum && viewYear >= maximum.year
            )}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Next year"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 p-4">
          {MONTHS.map((label, index) => {
            const month = index + 1;
            const candidate = formatMonth(viewYear, month);
            const active = candidate === value;
            const unavailable = isDisabled(viewYear, month);
            return (
              <button
                key={label}
                type="button"
                disabled={unavailable}
                onClick={() => chooseMonth(month)}
                className={`rounded-xl px-2 py-2.5 text-xs font-extrabold transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm dark:bg-indigo-500'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                } disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:disabled:text-slate-700`}
              >
                {label.slice(0, 3)}
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
          onClick={() => setOpen((currentOpen) => !currentOpen)}
          className={`flex min-h-[42px] w-full items-center rounded-xl border px-3 pr-10 text-left text-sm font-extrabold shadow-sm transition ${
            open
              ? 'border-indigo-400 bg-white text-slate-900 ring-2 ring-indigo-400/20 dark:bg-slate-950 dark:text-white'
              : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-300 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-indigo-700'
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <span className={value ? '' : 'text-slate-400 dark:text-slate-500'}>
            {value ? displayMonth(value) : placeholder}
          </span>
          <CalendarDays
            className={`absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
              open
                ? 'text-indigo-500 dark:text-indigo-300'
                : 'text-slate-400 dark:text-slate-500'
            }`}
          />
        </button>
      </div>
      {picker}
    </>
  );
}

export { MONTHS, displayMonth, formatMonth, parseMonth };
