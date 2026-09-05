export const HR_STATUS_OPTIONS = [
  ['', 'All statuses'],
  ['ACTIVE', 'Active'],
  ['ON_HOLD', 'On hold'],
  ['COMPLETED', 'Completed'],
  ['TERMINATED', 'Terminated'],
  ['DISCONTINUED', 'Discontinued'],
];
export const HR_ISSUE_OPTIONS = [
  ['', 'All records'],
  ['missing-document', 'Missing offer letter'],
  ['missing-phone', 'Missing phone'],
  ['missing-department', 'Missing department'],
  ['overdue', 'Overdue active'],
];
export function dateLabel(value) {
  if (!value) return 'Not set';
  return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString(
    undefined,
    { day: '2-digit', month: 'short', year: 'numeric' }
  );
}
export function statusColor(status) {
  return (
    {
      ACTIVE: 'green',
      ON_HOLD: 'yellow',
      COMPLETED: 'blue',
      TERMINATED: 'red',
      DISCONTINUED: 'gray',
    }[status] || 'gray'
  );
}
