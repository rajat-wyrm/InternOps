import { useEffect, useMemo, useState } from 'react';
import { Badge, Card } from '../ui';
import { dateLabel, statusColor } from '../../utils/hrInsights';

const PAGE_SIZE = 10;
const ROLE_ORDER = {
  SENIOR_TL: 0,
  TL: 1,
  CAPTAIN: 2,
  INTERN: 3,
};

export default function HRDirectory({ members = [], resetKey = '' }) {
  const [page, setPage] = useState(1);
  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const roleDifference =
          (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99);
        if (roleDifference) return roleDifference;
        return (a.full_name || a.email || '').localeCompare(
          b.full_name || b.email || '',
          undefined,
          { sensitivity: 'base' }
        );
      }),
    [members]
  );
  const totalPages = Math.max(1, Math.ceil(sortedMembers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleMembers = sortedMembers.slice(
    firstIndex,
    firstIndex + PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <Card className="overflow-x-auto">
      <table className="min-w-[1100px] w-full text-sm">
        <thead className="border-b-2 border-slate-200 bg-slate-100 text-left dark:border-indigo-500/20 dark:bg-indigo-950/40">
          <tr>
            {[
              'Member',
              'Role',
              'Department',
              'Phone',
              'Joining',
              'Planned end',
              'Document',
              'Status',
            ].map((label) => (
              <th key={label} className="p-4 font-extrabold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {visibleMembers.map((member, index) => (
            <tr
              key={member.id}
              className={index % 2 ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''}
            >
              <td className="p-4">
                <b className="block">{member.full_name || 'Unnamed member'}</b>
                <span className="text-xs text-slate-500">{member.email}</span>
              </td>
              <td className="p-4">
                <Badge>{member.role}</Badge>
              </td>
              <td className="p-4">{member.department_name || 'Unassigned'}</td>
              <td className="p-4">{member.phone || 'Missing'}</td>
              <td className="p-4">{dateLabel(member.joining_date)}</td>
              <td className="p-4">
                {dateLabel(
                  member.extended_completion_date || member.completion_date
                )}
              </td>
              <td className="p-4">
                <Badge color={member.offer_letter_url ? 'green' : 'yellow'}>
                  {member.offer_letter_url ? 'Available' : 'Missing'}
                </Badge>
              </td>
              <td className="p-4">
                <Badge color={statusColor(member.internship_status)}>
                  {member.suspended ? 'SUSPENDED' : member.internship_status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!sortedMembers.length && (
        <p className="p-8 text-center text-slate-500">
          No HR records match these filters.
        </p>
      )}

      {sortedMembers.length > PAGE_SIZE && (
        <div className="flex min-w-[1100px] flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing {firstIndex + 1}-
            {Math.min(firstIndex + PAGE_SIZE, sortedMembers.length)} of{' '}
            {sortedMembers.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage === 1}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
            >
              Previous
            </button>
            <span className="min-w-24 text-center text-sm font-bold text-slate-700 dark:text-slate-200">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
              disabled={currentPage === totalPages}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
