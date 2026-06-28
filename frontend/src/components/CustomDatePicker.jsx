import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

function startOfDay(date) {
  if (!date) return null;

  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);

  return copy;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function displayDate(value) {
  if (!value) return '';

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isSameDate(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isBeforeDate(a, b) {
  const dateA = startOfDay(a);
  const dateB = startOfDay(b);

  return dateA && dateB && dateA < dateB;
}

function isAfterDate(a, b) {
  const dateA = startOfDay(a);
  const dateB = startOfDay(b);

  return dateA && dateB && dateA > dateB;
}

export default function CustomDatePicker({
  value,
  onChange,
  max,
  min,
  placeholder = 'Select date',
  className = '',
  disabled = false,
}) {
  const selectedDate = value ? new Date(`${value}T00:00:00`) : null;
  const today = startOfDay(new Date());
  const initialMonth = selectedDate || today;

  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(
    new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1)
  );

  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 360,
    maxHeight: 430,
  });

  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const maxDate = max ? startOfDay(new Date(`${max}T00:00:00`)) : null;
  const minDate = min ? startOfDay(new Date(`${min}T00:00:00`)) : null;

  const monthLabel = viewDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const days = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay();

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Only create as many rows as needed:
    // 5 rows for normal months, 6 rows only when the month actually needs it.
    const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;

    const start = new Date(year, month, 1 - startDay);

    return Array.from({ length: totalCells }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return startOfDay(date);
    });
  }, [viewDate]);

  useEffect(() => {
    if (!open) return undefined;

    const updatePosition = () => {
      if (!triggerRef.current) return;

      const rect = triggerRef.current.getBoundingClientRect();
      const gap = 8;
      const viewportPadding = 16;
      const preferredWidth = 360;
      const preferredHeight = 430;

      const width = Math.min(
        preferredWidth,
        window.innerWidth - viewportPadding * 2
      );

      const left = Math.min(
        Math.max(viewportPadding, rect.left),
        window.innerWidth - width - viewportPadding
      );

      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;

      let top = rect.bottom + gap;
      let maxHeight = Math.min(preferredHeight, spaceBelow);

      if (spaceBelow < preferredHeight && spaceAbove > spaceBelow) {
        maxHeight = Math.min(preferredHeight, spaceAbove);
        top = rect.top - maxHeight - gap;
      }

      if (top < viewportPadding) {
        top = viewportPadding;
        maxHeight = window.innerHeight - viewportPadding * 2;
      }

      setPosition({
        top,
        left,
        width,
        maxHeight: Math.max(300, maxHeight),
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
  }, [open]);

  const changeMonth = (amount) => {
    setViewDate((current) => {
      const next = new Date(current);
      next.setMonth(current.getMonth() + amount);
      return next;
    });
  };

  const selectDate = (date) => {
    const safeDate = startOfDay(date);

    if (minDate && isBeforeDate(safeDate, minDate)) return;
    if (maxDate && isAfterDate(safeDate, maxDate)) return;

    onChange(formatDate(safeDate));
    setOpen(false);
  };

  const clearDate = () => {
    onChange('');
    setOpen(false);
  };

  const selectToday = () => {
    if (minDate && isBeforeDate(today, minDate)) return;
    if (maxDate && isAfterDate(today, maxDate)) return;

    onChange(formatDate(today));
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setOpen(false);
  };

  const calendar =
    open &&
    createPortal(
      <div
        ref={menuRef}
        className="fixed z-[9999] rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-2xl shadow-slate-950/20 dark:shadow-black/50 animate-fade-in overflow-hidden"
        style={{
          top: position.top,
          left: position.left,
          width: position.width,
          maxHeight: position.maxHeight,
        }}
      >
        <div
          className="overflow-y-auto"
          style={{
            maxHeight: position.maxHeight - 73,
          }}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="w-9 h-9 rounded-2xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                {monthLabel}
              </p>

              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="w-9 h-9 rounded-2xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                aria-label="Next month"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <div
                  key={day}
                  className="h-8 flex items-center justify-center text-xs font-extrabold text-slate-400 dark:text-slate-500"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((date) => {
                const isCurrentMonth = date.getMonth() === viewDate.getMonth();
                const active = selectedDate && isSameDate(date, selectedDate);
                const isToday = isSameDate(date, today);

                const disabledDay =
                  !isCurrentMonth ||
                  (minDate && isBeforeDate(date, minDate)) ||
                  (maxDate && isAfterDate(date, maxDate));

                return (
                  <button
                    key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
                    type="button"
                    disabled={disabledDay}
                    onClick={() => selectDate(date)}
                    className={`h-10 rounded-2xl text-sm font-bold transition-all border ${
                      active && isCurrentMonth
                        ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-transparent shadow-lg shadow-indigo-200/50 dark:shadow-none'
                        : !isCurrentMonth
                          ? 'text-slate-400/40 dark:text-slate-600/50 cursor-not-allowed border-transparent bg-slate-50/40 dark:bg-slate-900/30'
                          : disabledDay
                            ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed border-transparent'
                            : isToday
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/60'
                              : 'text-slate-700 dark:text-slate-200 border-transparent hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-700 dark:hover:text-indigo-300'
                    }`}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
          <button
            type="button"
            onClick={clearDate}
            className="px-4 py-2 rounded-2xl text-xs font-extrabold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={selectToday}
            className="px-4 py-2 rounded-2xl text-xs font-extrabold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
          >
            Today
          </button>
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
          <span className={value ? '' : 'text-slate-400 dark:text-slate-500'}>
            {value ? displayDate(value) : placeholder}
          </span>

          <CalendarDays
            className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${
              open
                ? 'text-indigo-500 dark:text-indigo-300'
                : 'text-slate-400 dark:text-slate-500'
            }`}
          />
        </button>
      </div>

      {calendar}
    </>
  );
}
