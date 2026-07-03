import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock } from 'lucide-react';

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

function parseTime(value) {
  if (!value) return null;

  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return {
    hour,
    minute,
  };
}

function displayTime(value) {
  const parsed = parseTime(value);

  if (!parsed) return '';

  const converted = to12Hour(parsed.hour);

  return `${pad(converted.hour12)}:${pad(parsed.minute)} ${converted.period}`;
}

export default function CustomTimePicker({
  value,
  onChange,
  placeholder = 'Select time',
  className = '',
  disabled = false,
}) {
  const parsedValue = parseTime(value);
  const initialTime = parsedValue ? to12Hour(parsedValue.hour) : to12Hour(12);

  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(initialTime.hour12);
  const [minute, setMinute] = useState(parsedValue ? parsedValue.minute : 0);
  const [period, setPeriod] = useState(initialTime.period);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const hours = Array.from({ length: 12 }, (_, index) => index + 1);
  const minutes = Array.from({ length: 60 }, (_, index) => index);

  useEffect(() => {
    if (!parsedValue) return;

    const converted = to12Hour(parsedValue.hour);

    setHour(converted.hour12);
    setMinute(parsedValue.minute);
    setPeriod(converted.period);
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;

    const updatePosition = () => {
      if (!triggerRef.current) return;

      const rect = triggerRef.current.getBoundingClientRect();
      const pickerHeight = 360;
      const gap = 8;

      let top = rect.bottom + gap;
      const width = Math.max(rect.width, 330);
      const left = Math.min(rect.left, window.innerWidth - width - 16);

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      if (spaceBelow < pickerHeight + 16 && spaceAbove > pickerHeight) {
        top = rect.top - pickerHeight - gap;
      }

      setPosition({
        top,
        left: Math.max(16, left),
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
  }, [open]);

  const clearValue = () => {
    onChange('');
    setOpen(false);
  };

  const selectNow = () => {
    const now = new Date();
    const converted = to12Hour(now.getHours());

    setHour(converted.hour12);
    setMinute(now.getMinutes());
    setPeriod(converted.period);
  };

  const applyValue = () => {
    const hour24 = to24Hour(hour, period);

    onChange(`${pad(hour24)}:${pad(minute)}`);
    setOpen(false);
  };

  const picker =
    open &&
    createPortal(
      <div
        ref={menuRef}
        className="fixed z-[9999] overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-2xl shadow-slate-950/20 dark:shadow-black/50 animate-fade-in"
        style={{
          top: position.top,
          left: position.left,
          width: position.width,
        }}
      >
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>

            <div>
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                Select Time
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

        <div className="flex items-center justify-between gap-3 px-4 py-4 border-t border-slate-200 dark:border-slate-700">
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
            {value ? displayTime(value) : placeholder}
          </span>

          <Clock
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
