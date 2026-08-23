import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Expand, Search, X } from 'lucide-react';

const STATUS_LABEL = {
  PRESENT: 'P',
  ABSENT: 'A',
  HALF_DAY: 'H',
};

const STATUS_CLASS = {
  PRESENT:
    'border border-emerald-300 bg-emerald-100 text-emerald-800 shadow-sm dark:border-emerald-600 dark:bg-emerald-900 dark:text-emerald-100',
  ABSENT:
    'border border-red-300 bg-red-100 text-red-800 shadow-sm dark:border-red-600 dark:bg-red-900 dark:text-red-100',
  HALF_DAY:
    'border border-amber-300 bg-amber-100 text-amber-900 shadow-sm dark:border-amber-500 dark:bg-amber-900 dark:text-amber-100',
};

const MEMBER_COLUMN_WIDTH = 'w-72 min-w-72 max-w-72';
const ROLE_COLUMN_WIDTH = 'w-40 min-w-40 max-w-40';
const FULLSCREEN_MIN_ROWS = 14;

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
}

function AttendanceGrid({ members, dates, records, search, fullScreen }) {
  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members;

    return members.filter((member) =>
      `${member.full_name || ''} ${member.email || ''} ${member.role || ''}`
        .toLowerCase()
        .includes(term)
    );
  }, [members, search]);

  const recordsByMember = useMemo(() => {
    const index = new Map();
    for (const record of records) {
      if (!index.has(record.user_id)) index.set(record.user_id, new Map());
      index.get(record.user_id).set(record.date.slice(0, 10), record);
    }
    return index;
  }, [records]);

  if (filteredMembers.length === 0) {
    return (
      <div className="p-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
        No department members match this search.
      </div>
    );
  }

  return (
    <div
      className={
        fullScreen
          ? 'min-h-0 flex-1 overflow-auto bg-white dark:bg-slate-900'
          : 'max-h-[62vh] overflow-auto'
      }
    >
      <table className="min-w-max w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-950">
          <tr>
            <th
              className={`sticky left-0 z-30 ${MEMBER_COLUMN_WIDTH} border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-5 py-4 text-left font-extrabold text-slate-700 dark:text-slate-200`}
            >
              Member
            </th>
            <th
              className={`sticky left-72 z-30 ${ROLE_COLUMN_WIDTH} border-b border-r border-slate-200 bg-slate-50 px-4 py-4 text-left font-extrabold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200`}
            >
              Role
            </th>
            {dates.map((date) => (
              <th
                key={date}
                className="min-w-20 border-b border-r border-slate-200 dark:border-slate-700 px-3 py-4 text-center font-extrabold text-slate-600 dark:text-slate-300"
              >
                {formatDate(date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredMembers.map((member, index) => {
            const memberRecords = recordsByMember.get(member.id) || new Map();
            const stickyCellBackground =
              index % 2 === 0
                ? 'bg-white dark:bg-slate-900'
                : 'bg-slate-50 dark:bg-slate-800';

            return (
              <tr
                key={member.id}
                className={
                  index % 2 === 0
                    ? 'bg-white dark:bg-slate-900'
                    : 'bg-slate-50 dark:bg-slate-800'
                }
              >
                <td
                  className={`sticky left-0 z-20 ${MEMBER_COLUMN_WIDTH} ${stickyCellBackground} border-b border-r border-slate-200 px-5 py-3 dark:border-slate-700`}
                >
                  <div className="font-extrabold text-slate-900 dark:text-white">
                    {member.full_name || 'Unnamed member'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {member.email}
                  </div>
                </td>
                <td
                  className={`sticky left-72 z-20 ${ROLE_COLUMN_WIDTH} ${stickyCellBackground} border-b border-r border-slate-200 px-4 py-3 dark:border-slate-700`}
                >
                  <span className="rounded-full border border-indigo-200 bg-indigo-100 px-2.5 py-1 text-xs font-extrabold text-indigo-800 dark:border-indigo-700 dark:bg-indigo-900 dark:text-indigo-100">
                    {member.role}
                  </span>
                </td>
                {dates.map((date) => {
                  const record = memberRecords.get(date);
                  return (
                    <td
                      key={date}
                      className="border-b border-r border-slate-200 dark:border-slate-600 px-3 py-3 text-center"
                      title={record?.remarks || record?.status || 'No record'}
                    >
                      {record ? (
                        <span
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black tracking-wide ${STATUS_CLASS[record.status] || ''}`}
                        >
                          {STATUS_LABEL[record.status] || '?'}
                        </span>
                      ) : (
                        <span className="font-bold text-slate-400 dark:text-slate-500">
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {fullScreen &&
            Array.from({
              length: Math.max(FULLSCREEN_MIN_ROWS - filteredMembers.length, 0),
            }).map((_, emptyIndex) => {
              const rowIndex = filteredMembers.length + emptyIndex;
              const emptyCellBackground =
                rowIndex % 2 === 0
                  ? 'bg-white dark:bg-slate-900'
                  : 'bg-slate-50 dark:bg-slate-800';

              return (
                <tr
                  key={`empty-row-${emptyIndex}`}
                  aria-hidden="true"
                  className={emptyCellBackground}
                >
                  <td
                    className={`sticky left-0 z-20 h-12 ${MEMBER_COLUMN_WIDTH} ${emptyCellBackground} border-b border-r border-slate-200 dark:border-slate-700`}
                  />
                  <td
                    className={`sticky left-72 z-20 h-12 ${ROLE_COLUMN_WIDTH} ${emptyCellBackground} border-b border-r border-slate-200 dark:border-slate-700`}
                  />
                  {dates.map((date) => (
                    <td
                      key={`empty-${emptyIndex}-${date}`}
                      className="h-12 min-w-20 border-b border-r border-slate-200 dark:border-slate-700"
                    />
                  ))}
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}

export default function DepartmentAttendanceSheet({
  departmentName,
  data,
  from,
  to,
  onFromChange,
  onToChange,
  isLoading,
  error,
  onRetry,
}) {
  const [search, setSearch] = useState('');
  const [fullScreen, setFullScreen] = useState(false);

  useEffect(() => {
    if (!fullScreen) return undefined;
    document.body.classList.add('modal-open');
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setFullScreen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [fullScreen]);

  const renderContent = (isFullScreen = false) => (
    <div
      className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-none ${
        isFullScreen ? 'flex h-[calc(100vh-3rem)] min-h-[34rem] flex-col' : ''
      }`}
    >
      <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-700 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
            Department attendance sheet
          </p>
          <h3 className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">
            {departmentName || 'Department'}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            P = Present, A = Absent, H = Half Day, — = No record
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
            From
            <input
              type="date"
              value={from}
              onChange={(event) => onFromChange(event.target.value)}
              className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
            To
            <input
              type="date"
              value={to}
              onChange={(event) => onToChange(event.target.value)}
              className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search members..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          {!isFullScreen && (
            <button
              type="button"
              onClick={() => setFullScreen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500"
            >
              <Expand className="h-4 w-4" />
              View Full
            </button>
          )}
          {isFullScreen && (
            <button
              type="button"
              onClick={() => setFullScreen(false)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
              Close
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="h-9 w-9 animate-spin rounded-full border-b-2 border-emerald-600" />
        </div>
      ) : error ? (
        <div className="p-10 text-center">
          <p className="font-bold text-red-600 dark:text-red-300">
            {error.response?.data?.error ||
              'Failed to load department attendance'}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
          >
            Retry
          </button>
        </div>
      ) : data?.members?.length ? (
        <AttendanceGrid
          members={data.members}
          dates={data.dates || []}
          records={data.records || []}
          search={search}
          fullScreen={isFullScreen}
        />
      ) : (
        <div className="p-12 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
          No members are available in this department view.
        </div>
      )}
    </div>
  );

  return (
    <>
      {renderContent(false)}
      {fullScreen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] overflow-hidden bg-slate-950/80 p-3 backdrop-blur-sm md:p-6">
            <div className="mx-auto h-full max-w-[1800px]">
              {renderContent(true)}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
