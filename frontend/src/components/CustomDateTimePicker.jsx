import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

function pad(value) {
  return String(value).padStart(2, '0');
}

function to12Hour(hour24) {
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;

  return {
    hour12,
    period,
  };
}

function to24Hour(hour12, period) {
  const normalizedHour = Number(hour12);

  if (period === 'AM') {
    return normalizedHour === 12 ? 0 : normalizedHour;
  }

  return normalizedHour === 12 ? 12 : normalizedHour + 12;
}

function formatDateTime(date, hour12, minute, period) {
  const hour24 = to24Hour(hour12, period);

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());

  return `${year}-${month}-${day}T${pad(hour24)}:${pad(minute)}`;
}

function parseValue(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function displayDateTime(value) {
  const date = parseValue(value);

  if (!date) return '';

  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
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

export default function CustomDateTimePicker({
  value,
  onChange,
  min,
  max,
  placeholder = 'Select date and time',
  className = '',
  disabled = false,
}) {
  const parsedValue = parseValue(value);
  const today = new Date();
  const initialMonth = parsedValue || today;

  const initialTime = parsedValue
    ? to12Hour(parsedValue.getHours())
    : to12Hour(12);

  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(
    new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1)
  );

  const [selectedDate, setSelectedDate] = useState(parsedValue || today);
  const [hour, setHour] = useState(initialTime.hour12);
  const [minute, setMinute] = useState(
    parsedValue ? parsedValue.getMinutes() : 0
  );
  const [period, setPeriod] = useState(initialTime.period);

  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 520,
  });

  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const minDate = min ? new Date(min) : null;
  const maxDate = max ? new Date(max) : null;

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
      return date;
    });
  }, [viewDate]);

  const hours = Array.from({ length: 12 }, (_, index) => index + 1);
  const minutes = Array.from({ length: 60 }, (_, index) => index);

  useEffect(() => {
    if (!parsedValue) return;

    const parsedTime = to12Hour(parsedValue.getHours());

    setSelectedDate(parsedValue);
    setHour(parsedTime.hour12);
    setMinute(parsedValue.getMinutes());
    setPeriod(parsedTime.period);
    setViewDate(new Date(parsedValue.getFullYear(), parsedValue.getMonth(), 1));
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;

    const updatePosition = () => {
      if (!triggerRef.current) return;

      const rect = triggerRef.current.getBoundingClientRect();
      const gap = 8;
      const viewportPadding = 16;
      const preferredWidth = 760;
      const preferredHeight = 520;

      const width = Math.min(
        Math.max(rect.width, preferredWidth),
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
      }

      setPosition({
        top,
        left,
        width,
        maxHeight: Math.max(380, maxHeight),
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
    setSelectedDate(date);
  };

  const clearValue = () => {
    onChange('');
    setOpen(false);
  };

  const selectNow = () => {
    const now = new Date();
    const currentTime = to12Hour(now.getHours());

    setSelectedDate(now);
    setHour(currentTime.hour12);
    setMinute(now.getMinutes());
    setPeriod(currentTime.period);
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const applyValue = () => {
    const finalDate = new Date(selectedDate);
    const hour24 = to24Hour(hour, period);

    finalDate.setHours(hour24);
    finalDate.setMinutes(minute);
    finalDate.setSeconds(0);
    finalDate.setMilliseconds(0);

    if (minDate && finalDate < minDate) return;
    if (maxDate && finalDate > maxDate) return;

    onChange(formatDateTime(finalDate, hour, minute, period));
    setOpen(false);
  };

  const picker =
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
            maxHeight: position.maxHeight - 74,
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px]">
            <div className="p-4 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700">
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
                  const isCurrentMonth =
                    date.getMonth() === viewDate.getMonth();
                  const active = isSameDate(date, selectedDate);
                  const isToday = isSameDate(date, today);
                  const disabledDay = !isCurrentMonth;

                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      disabled={disabledDay}
                      onClick={() => selectDate(date)}
                      className={`h-10 rounded-2xl text-sm font-bold transition-all border ${
                        active && isCurrentMonth
                          ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-transparent shadow-lg shadow-indigo-200/50 dark:shadow-none'
                          : !isCurrentMonth
                            ? 'text-slate-400/40 dark:text-slate-600/50 cursor-not-allowed border-transparent bg-slate-50/40 dark:bg-slate-900/30'
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

            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>

                <div>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Time
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {pad(hour)}:{pad(minute)} {period}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[80px_90px_90px] gap-3">
                <div>
                  <p className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Hour
                  </p>

                  <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 p-1">
                    {hours.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setHour(h)}
                        className={`w-full px-3 py-2 rounded-xl text-sm font-bold transition ${
                          hour === h
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                        }`}
                      >
                        {pad(h)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Minute
                  </p>

                  <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 p-1">
                    {minutes.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMinute(m)}
                        className={`w-full px-3 py-2 rounded-xl text-sm font-bold transition ${
                          minute === m
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                        }`}
                      >
                        {pad(m)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    AM/PM
                  </p>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-1 space-y-1">
                    {['AM', 'PM'].map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPeriod(item)}
                        className={`w-full px-3 py-2 rounded-xl text-sm font-bold transition ${
                          period === item
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
          <button
            type="button"
            onClick={clearValue}
            className="px-4 py-2 rounded-2xl text-xs font-extrabold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Clear
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectNow}
              className="px-4 py-2 rounded-2xl text-xs font-extrabold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
            >
              Now
            </button>

            <button
              type="button"
              onClick={applyValue}
              className="px-4 py-2 rounded-2xl text-xs font-extrabold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:shadow-lg hover:shadow-indigo-200 dark:hover:shadow-none transition"
            >
              Apply
            </button>
          </div>
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
            {value ? displayDateTime(value) : placeholder}
          </span>

          <CalendarClock
            className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${
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
