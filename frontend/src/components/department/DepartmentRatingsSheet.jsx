import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Expand, Search, Star, X } from 'lucide-react';

const MEMBER_COLUMN_WIDTH = 'w-72 min-w-72 max-w-72';
const ROLE_COLUMN_WIDTH = 'w-36 min-w-36 max-w-36';
const FULLSCREEN_MIN_ROWS = 14;

function ScoreBadge({ value }) {
  if (value == null) {
    return (
      <span className="font-bold text-slate-400 dark:text-slate-500">—</span>
    );
  }

  const score = Number(value);
  const tone =
    score >= 8
      ? 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-900 dark:text-emerald-100'
      : score >= 5
        ? 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-500 dark:bg-amber-900 dark:text-amber-100'
        : 'border-red-300 bg-red-100 text-red-800 dark:border-red-600 dark:bg-red-900 dark:text-red-100';

  return (
    <span
      className={`inline-flex min-w-14 items-center justify-center rounded-xl border px-2.5 py-1.5 text-sm font-black shadow-sm ${tone}`}
    >
      {score.toFixed(1).replace(/\.0$/, '')}/10
    </span>
  );
}

function EligibilityBadge({ score }) {
  if (score == null) {
    return (
      <span className="font-bold text-slate-400 dark:text-slate-500">—</span>
    );
  }

  const val = Number(score);
  if (Number.isNaN(val)) {
    return (
      <span className="font-bold text-slate-400 dark:text-slate-500">—</span>
    );
  }

  const rounded = Math.round(val);
  if (rounded >= 1 && rounded <= 4) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 shadow-sm">
        🔴 Not Eligible
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 shadow-sm">
      🟢 Eligible
    </span>
  );
}

function StatusBadge({ status = 'ACTIVE' }) {
  const s = String(status).toUpperCase();
  const styles = {
    ACTIVE:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60',
    COMPLETED:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60',
    ON_HOLD:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60',
    TERMINATED:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-extrabold ${
        styles[s] || styles.ACTIVE
      }`}
    >
      {s}
    </span>
  );
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function RatingsGrid({
  members,
  search,
  statusFilter,
  ratingFilter,
  eligibilityFilter,
  fullScreen,
}) {
  const filteredMembers = useMemo(() => {
    let result = members;

    // Search filter
    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter((member) =>
        `${member.full_name || ''} ${member.email || ''} ${member.role || ''} ${member.department_name || ''}`
          .toLowerCase()
          .includes(term)
      );
    }

    // Intern Status filter
    if (statusFilter && statusFilter !== 'all') {
      result = result.filter(
        (m) =>
          (m.internship_status || 'ACTIVE').toUpperCase() ===
          statusFilter.toUpperCase()
      );
    }

    // Rating score filter (1 to 10)
    if (ratingFilter && ratingFilter !== 'all') {
      const targetRating = Number(ratingFilter);
      result = result.filter((member) => {
        const score =
          member.average_score != null
            ? Number(member.average_score)
            : member.latest_score != null
              ? Number(member.latest_score)
              : null;
        if (score == null || Number.isNaN(score)) return false;

        return Math.round(score) === targetRating;
      });
    }

    // Eligibility filter (ELIGIBLE / NOT_ELIGIBLE)
    if (eligibilityFilter && eligibilityFilter !== 'all') {
      result = result.filter((member) => {
        const score =
          member.average_score != null
            ? Number(member.average_score)
            : member.latest_score != null
              ? Number(member.latest_score)
              : null;
        if (score == null || Number.isNaN(score)) return false;

        const rounded = Math.round(score);
        if (eligibilityFilter === 'ELIGIBLE') {
          return rounded >= 5 && rounded <= 10;
        }
        if (eligibilityFilter === 'NOT_ELIGIBLE') {
          return rounded >= 1 && rounded <= 4;
        }
        return true;
      });
    }

    return result;
  }, [members, search, statusFilter, ratingFilter, eligibilityFilter]);

  if (filteredMembers.length === 0) {
    return (
      <div className="p-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
        No department members match the selected filters.
      </div>
    );
  }

  const headers = [
    'Department',
    'Status',
    'Eligibility',
    'Average',
    'Ratings',
    'Latest',
    'Latest Date',
    'Latest Remarks',
  ];

  return (
    <div
      className={
        fullScreen
          ? 'min-h-0 flex-1 overflow-auto bg-white dark:bg-slate-900'
          : 'max-h-[62vh] overflow-auto'
      }
    >
      <table className="min-w-[1300px] w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-30 bg-slate-50 dark:bg-slate-950">
          <tr>
            <th
              className={`sticky left-0 z-40 ${MEMBER_COLUMN_WIDTH} border-b border-r border-slate-300 bg-slate-50 px-5 py-4 text-left font-extrabold text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100`}
            >
              Member
            </th>
            <th
              className={`sticky left-72 z-40 ${ROLE_COLUMN_WIDTH} border-b border-r border-slate-300 bg-slate-50 px-4 py-4 text-left font-extrabold text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100`}
            >
              Role
            </th>
            {headers.map((header) => (
              <th
                key={header}
                className="min-w-32 border-b border-r border-slate-300 px-4 py-4 text-left font-extrabold text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredMembers.map((member, index) => {
            const rowBackground =
              index % 2 === 0
                ? 'bg-white dark:bg-slate-900'
                : 'bg-slate-50 dark:bg-slate-800';

            const effectiveScore =
              member.average_score != null
                ? member.average_score
                : member.latest_score;

            return (
              <tr key={member.id} className={rowBackground}>
                <td
                  className={`sticky left-0 z-20 ${MEMBER_COLUMN_WIDTH} ${rowBackground} border-b border-r border-slate-200 px-5 py-4 dark:border-slate-600`}
                >
                  <div className="font-extrabold text-slate-900 dark:text-white">
                    {member.full_name || 'Unnamed member'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {member.email}
                  </div>
                </td>
                <td
                  className={`sticky left-72 z-20 ${ROLE_COLUMN_WIDTH} ${rowBackground} border-b border-r border-slate-200 px-4 py-4 dark:border-slate-600`}
                >
                  <span className="rounded-full border border-indigo-200 bg-indigo-100 px-2.5 py-1 text-xs font-extrabold text-indigo-800 dark:border-indigo-700 dark:bg-indigo-900 dark:text-indigo-100">
                    {member.role}
                  </span>
                </td>
                <td className="border-b border-r border-slate-200 px-4 py-3 font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">
                  {member.department_name || '—'}
                </td>
                <td className="border-b border-r border-slate-200 px-4 py-3 dark:border-slate-600">
                  <StatusBadge status={member.internship_status} />
                </td>
                <td className="border-b border-r border-slate-200 px-4 py-3 dark:border-slate-600">
                  <EligibilityBadge score={effectiveScore} />
                </td>
                <td className="border-b border-r border-slate-200 px-4 py-3 dark:border-slate-600">
                  <ScoreBadge value={member.average_score} />
                </td>
                <td className="border-b border-r border-slate-200 px-4 py-3 font-extrabold text-slate-700 dark:border-slate-600 dark:text-slate-200">
                  {member.rating_count}
                </td>
                <td className="border-b border-r border-slate-200 px-4 py-3 dark:border-slate-600">
                  <ScoreBadge value={member.latest_score} />
                </td>
                <td className="border-b border-r border-slate-200 px-4 py-3 font-semibold text-slate-600 dark:border-slate-600 dark:text-slate-300">
                  {formatDate(member.latest_created_at)}
                </td>
                <td className="max-w-sm border-b border-r border-slate-200 px-4 py-3 text-slate-600 dark:border-slate-600 dark:text-slate-300">
                  <span
                    className="line-clamp-2"
                    title={member.latest_remarks || ''}
                  >
                    {member.latest_remarks || '—'}
                  </span>
                </td>
              </tr>
            );
          })}

          {fullScreen &&
            Array.from({
              length: Math.max(FULLSCREEN_MIN_ROWS - filteredMembers.length, 0),
            }).map((_, emptyIndex) => {
              const rowIndex = filteredMembers.length + emptyIndex;
              const rowBackground =
                rowIndex % 2 === 0
                  ? 'bg-white dark:bg-slate-900'
                  : 'bg-slate-50 dark:bg-slate-800';

              return (
                <tr
                  key={`empty-row-${emptyIndex}`}
                  aria-hidden="true"
                  className={rowBackground}
                >
                  <td
                    className={`sticky left-0 z-20 h-12 ${MEMBER_COLUMN_WIDTH} ${rowBackground} border-b border-r border-slate-200 dark:border-slate-600`}
                  />
                  <td
                    className={`sticky left-72 z-20 h-12 ${ROLE_COLUMN_WIDTH} ${rowBackground} border-b border-r border-slate-200 dark:border-slate-600`}
                  />
                  {headers.map((header) => (
                    <td
                      key={`empty-${emptyIndex}-${header}`}
                      className="h-12 min-w-32 border-b border-r border-slate-200 dark:border-slate-600"
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

export default function DepartmentRatingsSheet({
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [eligibilityFilter, setEligibilityFilter] = useState('all');
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
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-300">
            Department ratings sheet
          </p>
          <h3 className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">
            {departmentName || 'All Departments'}
          </h3>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
            Ratings are scored 1 to 10 (1–4: 🔴 Not Eligible, 5–10: 🟢 Eligible)
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
            From
            <input
              type="date"
              value={from}
              onChange={(event) => onFromChange(event.target.value)}
              className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
            To
            <input
              type="date"
              value={to}
              onChange={(event) => onToChange(event.target.value)}
              className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>

          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Rating
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
            >
              <option value="all">All Ratings</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="6">6</option>
              <option value="7">7</option>
              <option value="8">8</option>
              <option value="9">9</option>
              <option value="10">10</option>
            </select>
          </label>

          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Eligibility
            <select
              value={eligibilityFilter}
              onChange={(e) => setEligibilityFilter(e.target.value)}
              className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
            >
              <option value="all">All Eligibility</option>
              <option value="ELIGIBLE">🟢 Eligible (5-10)</option>
              <option value="NOT_ELIGIBLE">🔴 Not Eligible (1-4)</option>
            </select>
          </label>

          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
            >
              <option value="all">All Status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="ON_HOLD">ON_HOLD</option>
              <option value="TERMINATED">TERMINATED</option>
            </select>
          </label>

          <div className="relative min-w-44 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search members..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-amber-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {!isFullScreen ? (
            <button
              type="button"
              onClick={() => setFullScreen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-extrabold text-white hover:bg-slate-800 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
            >
              <Expand className="h-4 w-4" />
              View Full
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setFullScreen(false)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
              Close
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="h-9 w-9 animate-spin rounded-full border-b-2 border-amber-500" />
        </div>
      ) : error ? (
        <div className="p-10 text-center">
          <p className="font-bold text-red-600 dark:text-red-300">
            {error.response?.data?.error || 'Failed to load department ratings'}
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
        <RatingsGrid
          members={data.members}
          search={search}
          statusFilter={statusFilter}
          ratingFilter={ratingFilter}
          eligibilityFilter={eligibilityFilter}
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
