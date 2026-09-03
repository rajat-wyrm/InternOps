import { useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Expand, Search, X } from 'lucide-react';
import DownloadDataMenu from '../DownloadDataMenu';
import { exportTable, makeExportFileName } from '../../utils/tableExport';
import CustomMonthPicker from '../CustomMonthPicker';

const ROLE_ORDER = { ADMIN: 0, SENIOR_TL: 1, TL: 2, CAPTAIN: 3, INTERN: 4 };
const STATUS_META = {
  PRESENT: {
    symbol: 'P',
    label: 'Present',
    badge:
      'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200',
  },
  ABSENT: {
    symbol: 'A',
    label: 'Absent',
    badge:
      'border-red-200 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-900/70 dark:text-red-200',
  },
  INFORMED: {
    symbol: 'I',
    label: 'Informed absence',
    badge:
      'border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-700 dark:bg-blue-900/70 dark:text-blue-200',
  },
  LEAVE: {
    symbol: 'L',
    label: 'Approved leave',
    badge:
      'border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-700 dark:bg-purple-900/70 dark:text-purple-200',
  },

  HALF_DAY: {
    symbol: 'H',
    label: 'Legacy Half Day',
    badge:
      'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/70 dark:text-amber-200',
  },
};

const MEMBER_COLUMN = 'w-72 min-w-72 max-w-72';
const ROLE_COLUMN = 'w-36 min-w-36 max-w-36';
const STATUS_COLUMN = 'w-40 min-w-40 max-w-40';
const LIFECYCLE_BADGE = {
  ACTIVE:
    'border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300',
  ON_HOLD:
    'border border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-300',
  COMPLETED:
    'border border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-700 dark:bg-blue-950/70 dark:text-blue-300',
  TERMINATED:
    'border border-red-200 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-950/70 dark:text-red-300',
  DISCONTINUED:
    'border border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-700 dark:bg-orange-950/70 dark:text-orange-300',
};

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
}

function AttendanceMark({ status }) {
  const meta = STATUS_META[status];
  if (!meta) {
    return <span className="text-slate-400 dark:text-slate-500">—</span>;
  }
  return (
    <span
      title={meta.label}
      aria-label={meta.label}
      className={`inline-flex h-9 min-w-9 items-center justify-center rounded-xl border px-2 text-sm font-extrabold ${meta.badge}`}
    >
      {meta.symbol}
    </span>
  );
}

const TIMELINE_MARKER = {
  JOINED:
    'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-300',
  COMPLETED:
    'border-cyan-300 bg-cyan-100 text-cyan-800 dark:border-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300',
  TERMINATED:
    'border-red-300 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-950/70 dark:text-red-300',
  DISCONTINUED:
    'border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-700 dark:bg-orange-950/70 dark:text-orange-300',
};

function TimelineMark({ status }) {
  return (
    <span
      className={`inline-flex min-h-9 items-center justify-center rounded-xl border px-2.5 text-xs font-extrabold ${TIMELINE_MARKER[status]}`}
    >
      {status}
    </span>
  );
}

function lifecycleCellState(member, date) {
  const joined = String(member.joining_date || '').slice(0, 10);
  const status = member.internship_status || 'ACTIVE';
  const completedOn = String(
    member.extended_completion_date || member.completion_date || ''
  ).slice(0, 10);
  const endedOn = String(member.lifecycle_effective_date || '').slice(0, 10);

  if (joined && date < joined) return 'BEFORE_JOINING';
  if (joined && date === joined) return 'JOINED';
  if (status === 'COMPLETED' && completedOn && date === completedOn)
    return 'COMPLETED';
  if (status === 'COMPLETED' && completedOn && date > completedOn)
    return 'LOCKED';
  if (
    ['TERMINATED', 'DISCONTINUED'].includes(status) &&
    endedOn &&
    date === endedOn
  )
    return status;
  if (
    ['TERMINATED', 'DISCONTINUED'].includes(status) &&
    endedOn &&
    date > endedOn
  )
    return 'LOCKED';
  return 'AVAILABLE';
}

function Legend() {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="Attendance legend"
    >
      {['PRESENT', 'ABSENT', 'INFORMED'].map((status) => {
        const meta = STATUS_META[status];
        return (
          <div
            key={status}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:shadow-none"
          >
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-lg border text-[11px] font-extrabold ${meta.badge}`}
            >
              {meta.symbol}
            </span>
            <span>{meta.label}</span>
          </div>
        );
      })}
      <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:shadow-none">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          —
        </span>
        <span>No record</span>
      </div>
    </div>
  );
}

function AttendanceGrid({ members, dates, records, search }) {
  const visibleDates = useMemo(
    () => dates.filter((date) => new Date(`${date}T00:00:00`).getDay() !== 0),
    [dates]
  );

  const visibleMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...members]
      .filter(
        (member) =>
          !query ||
          `${member.full_name || ''} ${member.email || ''} ${member.intern_code || ''} ${member.role || ''}`
            .toLowerCase()
            .includes(query)
      )
      .sort((a, b) => {
        const roleDifference =
          (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99);
        if (roleDifference) return roleDifference;
        return String(a.full_name || a.email || '').localeCompare(
          String(b.full_name || b.email || ''),
          undefined,
          { sensitivity: 'base' }
        );
      });
  }, [members, search]);

  const recordIndex = useMemo(() => {
    const index = new Map();
    for (const record of records) {
      if (!index.has(record.user_id)) index.set(record.user_id, new Map());
      index.get(record.user_id).set(String(record.date).slice(0, 10), record);
    }
    return index;
  }, [records]);

  if (!visibleMembers.length) {
    return (
      <div className="p-10 text-center text-slate-500 dark:text-slate-400">
        No department members match this search.
      </div>
    );
  }

  return (
    <table className="isolate w-max min-w-full table-fixed border-separate border-spacing-0 text-sm">
      <colgroup>
        <col className="w-72 min-w-72" />
        <col className="w-36 min-w-36" />
        <col className="w-40 min-w-40" />
        {visibleDates.map((date) => (
          <col key={date} className="w-28 min-w-28" />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th
            className={`sticky left-0 top-0 z-[60] ${MEMBER_COLUMN} border-b border-r border-slate-200 bg-slate-50 px-6 py-4 text-left font-extrabold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200`}
          >
            Member
          </th>
          <th
            className={`sticky left-72 top-0 z-[60] ${ROLE_COLUMN} border-b border-r border-slate-200 bg-slate-50 px-5 py-4 text-center font-extrabold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200`}
          >
            Role
          </th>
          <th
            className={`sticky left-[27rem] top-0 z-[60] ${STATUS_COLUMN} border-b border-r border-slate-200 bg-slate-50 px-5 py-4 text-center font-extrabold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200`}
          >
            Status
          </th>
          {visibleDates.map((date) => (
            <th
              key={date}
              className="sticky top-0 z-30 min-w-28 border-b border-r border-slate-200 bg-slate-50 px-4 py-4 text-center font-extrabold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              {formatDate(date)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {visibleMembers.map((member, index) => {
          const memberRecords = recordIndex.get(member.id) || new Map();
          const rowSurface =
            index % 2 === 0
              ? 'bg-white dark:bg-slate-900'
              : 'bg-slate-50/80 dark:bg-slate-800/50';
          return (
            <tr key={member.id}>
              <td
                className={`sticky left-0 z-50 bg-white dark:bg-slate-900 ${MEMBER_COLUMN} border-b border-r border-slate-200 px-6 py-4 dark:border-slate-700`}
              >
                <div className="truncate font-extrabold text-slate-900 dark:text-white">
                  {member.full_name || 'Unnamed member'}
                </div>
                <div className="truncate text-sm text-slate-500 dark:text-slate-400">
                  {member.email}
                </div>
                <div className="mt-0.5 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Intern Code: {member.intern_code || '—'}
                </div>
              </td>
              <td
                className={`sticky left-72 z-50 bg-white dark:bg-slate-900 ${ROLE_COLUMN} border-b border-r border-slate-200 px-5 py-4 text-center dark:border-slate-700`}
              >
                <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-extrabold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                  {String(member.role || '').replace('_', ' ')}
                </span>
              </td>
              <td
                className={`sticky left-[27rem] z-50 bg-white dark:bg-slate-900 ${STATUS_COLUMN} border-b border-r border-slate-200 px-5 py-4 text-center dark:border-slate-700`}
              >
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${LIFECYCLE_BADGE[member.internship_status || 'ACTIVE'] || LIFECYCLE_BADGE.ACTIVE}`}
                >
                  {String(member.internship_status || 'ACTIVE').replace(
                    '_',
                    ' '
                  )}
                </span>
              </td>
              {visibleDates.map((date) => {
                const record = memberRecords.get(date);
                const cellState = lifecycleCellState(member, date);
                const unavailable = ['BEFORE_JOINING', 'LOCKED'].includes(
                  cellState
                );
                return (
                  <td
                    key={date}
                    title={
                      cellState === 'BEFORE_JOINING'
                        ? 'Internship had not started'
                        : cellState === 'LOCKED'
                          ? 'Internship activity ended'
                          : undefined
                    }
                    className={`min-w-28 ${rowSurface} border-b border-r border-slate-200 px-4 py-3 text-center dark:border-slate-700`}
                  >
                    {[
                      'JOINED',
                      'COMPLETED',
                      'TERMINATED',
                      'DISCONTINUED',
                    ].includes(cellState) ? (
                      <TimelineMark status={cellState} />
                    ) : record && !unavailable ? (
                      <AttendanceMark status={record.status} />
                    ) : (
                      <span
                        aria-label={
                          unavailable ? 'Not applicable' : 'No record'
                        }
                        className="text-slate-400 dark:text-slate-500"
                      >
                        —
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function DepartmentAttendanceSheet({
  departmentName,
  data,
  selectedMonth,
  onMonthChange,
  isLoading,
  isRefreshing = false,
  error,
  onRetry,
}) {
  const [search, setSearch] = useState('');
  const [fullScreen, setFullScreen] = useState(false);
  const monthDates = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    if (!year || !month) return [];
    const days = new Date(year, month, 0).getDate();
    return Array.from({ length: days }, (_, index) => {
      const day = String(index + 1).padStart(2, '0');
      return `${selectedMonth}-${day}`;
    }).filter((date) => new Date(`${date}T00:00:00`).getDay() !== 0);
  }, [selectedMonth]);
  const exportAttendance = (format) => {
    const visibleDates = (data?.dates || []).filter(
      (date) => new Date(`${date}T00:00:00`).getDay() !== 0
    );
    const term = search.trim().toLowerCase();
    const members = (data?.members || []).filter(
      (member) =>
        !term ||
        `${member.full_name || ''} ${member.email || ''} ${member.intern_code || ''} ${member.role || ''}`
          .toLowerCase()
          .includes(term)
    );
    const records = new Map(
      (data?.records || []).map((record) => [
        `${record.user_id}|${String(record.date).slice(0, 10)}`,
        record.status,
      ])
    );
    const columns = [
      { key: 'member', label: 'Member', width: 26 },
      { key: 'email', label: 'Email', width: 30 },
      { key: 'internCode', label: 'Intern Code', width: 16 },
      { key: 'role', label: 'Role', width: 16 },
      { key: 'status', label: 'Internship Status', width: 20 },
      ...visibleDates.map((date) => ({
        key: date,
        label: formatDate(date),
        width: 14,
      })),
    ];
    const rows = members.map((member) => {
      const row = {
        member: member.full_name || 'Unnamed member',
        email: member.email || '',
        internCode: member.intern_code || '',
        role: String(member.role || '').replaceAll('_', ' '),
        status: String(member.internship_status || 'ACTIVE').replaceAll(
          '_',
          ' '
        ),
      };
      for (const date of visibleDates) {
        const state = lifecycleCellState(member, date);
        row[date] = [
          'JOINED',
          'COMPLETED',
          'TERMINATED',
          'DISCONTINUED',
        ].includes(state)
          ? state
          : records.get(`${member.id}|${date}`) || 'No record';
      }
      return row;
    });
    const base = makeExportFileName(
      'attendance',
      departmentName,
      selectedMonth,
      'tmp'
    ).replace(/\.tmp$/, '');
    exportTable({
      format,
      title: `Attendance - ${departmentName || 'Department'} - ${selectedMonth}`,
      fileBase: base,
      sheetName: 'Attendance',
      columns,
      rows,
    });
  };
  const displayedInternCount = useMemo(() => {
    const query = search.trim().toLowerCase();
    return new Set(
      (data?.members || [])
        .filter(
          (member) =>
            !query ||
            `${member.full_name || ''} ${member.email || ''} ${member.intern_code || ''} ${member.role || ''}`
              .toLowerCase()
              .includes(query)
        )
        .map((member) => member.id)
    ).size;
  }, [data?.members, search]);

  useLayoutEffect(() => {
    if (!fullScreen) return undefined;
    document.body.classList.add('modal-open');
    const onKeyDown = (event) => event.key === 'Escape' && setFullScreen(false);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [fullScreen]);

  const content = (expanded = false) => (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:shadow-none ${
        expanded
          ? 'h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] shadow-2xl'
          : 'max-h-[75vh]'
      }`}
    >
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-5 dark:border-slate-700 dark:bg-slate-900 sm:px-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(14rem,1fr)_minmax(44rem,auto)] xl:items-end">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
              Department attendance sheet
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {departmentName || 'Department'}
              </h3>
              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                Total Interns:{' '}
                <span className="inline-block min-w-5 text-center">
                  {isLoading ? '--' : displayedInternCount}
                </span>
              </span>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-end justify-end gap-3">
            <label className="w-full text-xs font-bold text-slate-500 dark:text-slate-400 sm:w-48">
              Month
              <CustomMonthPicker
                value={selectedMonth}
                onChange={onMonthChange}
                max={new Date().toISOString().slice(0, 7)}
                allowedMonths={data?.available_months ?? []}
                className="mt-1"
              />
            </label>
            <label className="relative w-full self-end sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search members..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
              />
            </label>
            <DownloadDataMenu
              onSelect={exportAttendance}
              disabled={isLoading || isRefreshing || !data?.members?.length}
            />
            {!expanded ? (
              <button
                type="button"
                onClick={() => setFullScreen(true)}
                className="inline-flex self-end items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700"
              >
                <Expand className="h-4 w-4" />
                View Full
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setFullScreen(false)}
                className="inline-flex self-end items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              >
                <X className="h-4 w-4" />
                Close
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Legend />
        </div>
      </div>

      <div className="internops-sheet-scroll relative min-h-[24rem] flex-1 overflow-auto bg-white dark:bg-slate-900">
        {isRefreshing && !isLoading && (
          <div className="pointer-events-none sticky left-0 top-0 z-[80] flex h-1 w-full overflow-hidden bg-indigo-100 dark:bg-slate-800">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-indigo-500" />
          </div>
        )}

        {isLoading ? (
          <div
            className="min-h-[24rem]"
            role="status"
            aria-label="Loading attendance sheet"
          >
            <table className="isolate w-max min-w-full table-fixed border-separate border-spacing-0 text-sm">
              <colgroup>
                <col className="w-72 min-w-72" />
                <col className="w-36 min-w-36" />
                <col className="w-40 min-w-40" />
                {monthDates.map((date) => (
                  <col key={date} className="w-28 min-w-28" />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th
                    className={`sticky left-0 top-0 z-[60] ${MEMBER_COLUMN} border-b border-r border-slate-200 bg-slate-50 px-6 py-4 text-left font-extrabold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200`}
                  >
                    Member
                  </th>
                  <th
                    className={`sticky left-72 top-0 z-[60] ${ROLE_COLUMN} border-b border-r border-slate-200 bg-slate-50 px-5 py-4 text-center font-extrabold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200`}
                  >
                    Role
                  </th>
                  <th
                    className={`sticky left-[27rem] top-0 z-[60] ${STATUS_COLUMN} border-b border-r border-slate-200 bg-slate-50 px-5 py-4 text-center font-extrabold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200`}
                  >
                    Status
                  </th>
                  {monthDates.map((date) => (
                    <th
                      key={date}
                      className="sticky top-0 z-30 min-w-28 border-b border-r border-slate-200 bg-slate-50 px-4 py-4 text-center font-extrabold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                    >
                      {formatDate(date)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }, (_, rowIndex) => {
                  const rowSurface =
                    rowIndex % 2 === 0
                      ? 'bg-white dark:bg-slate-900'
                      : 'bg-slate-50/80 dark:bg-slate-800/50';
                  return (
                    <tr key={`attendance-loading-row-${rowIndex}`}>
                      <td
                        className={`sticky left-0 z-50 ${rowSurface} ${MEMBER_COLUMN} border-b border-r border-slate-200 px-6 py-4 dark:border-slate-700`}
                      >
                        <div className="space-y-2">
                          <div className="h-3.5 w-3/5 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
                          <div className="h-3 w-4/5 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
                          <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
                        </div>
                      </td>
                      <td
                        className={`sticky left-72 z-50 ${rowSurface} ${ROLE_COLUMN} border-b border-r border-slate-200 px-5 py-4 text-center dark:border-slate-700`}
                      >
                        <div className="mx-auto h-7 w-[5.25rem] animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
                      </td>
                      <td
                        className={`sticky left-[27rem] z-50 ${rowSurface} ${STATUS_COLUMN} border-b border-r border-slate-200 px-5 py-4 text-center dark:border-slate-700`}
                      >
                        <div className="mx-auto h-7 w-[5.75rem] animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
                      </td>
                      {monthDates.map((date) => (
                        <td
                          key={date}
                          className={`min-w-28 ${rowSurface} border-b border-r border-slate-200 px-4 py-3 text-center dark:border-slate-700`}
                        >
                          <div className="mx-auto h-9 min-w-9 max-w-9 animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 dark:text-red-300">
            <p>
              {error.response?.data?.error ||
                'Failed to load department attendance'}
            </p>
            <button
              onClick={onRetry}
              className="mt-3 rounded-xl bg-red-600 px-4 py-2 font-bold text-white"
            >
              Retry
            </button>
          </div>
        ) : data?.available_months?.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            No attendance records are available for this team.
          </div>
        ) : data?.members?.length ? (
          <AttendanceGrid
            members={data.members}
            dates={monthDates}
            records={data.records || []}
            search={search}
          />
        ) : (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            No members are available in this department view.
          </div>
        )}
      </div>
    </section>
  );

  if (fullScreen) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
        {content(true)}
      </div>,
      document.body
    );
  }

  return content(false);
}
