import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Star,
  Users,
} from 'lucide-react';
import { Card } from '../ui';

const number = (value) => Number(value || 0);
const percent = (value) => `${number(value).toFixed(1)}%`;

function Metric({ icon: Icon, label, value, detail, tone = 'indigo' }) {
  const tones = {
    indigo:
      'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300',
    emerald:
      'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
    amber:
      'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300',
    violet:
      'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300',
  };
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <Icon className={`h-11 w-11 rounded-xl p-2.5 ${tones[tone]}`} />
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">
            {value}
          </p>
          {detail && (
            <p className="truncate text-xs text-slate-500">{detail}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function Distribution({ title, rows = [], color = 'bg-indigo-500' }) {
  const total = rows.reduce((sum, row) => sum + number(row.count), 0);
  const max = Math.max(1, ...rows.map((row) => number(row.count)));
  return (
    <Card className="p-6">
      <h2 className="mb-5 text-lg font-extrabold">{title}</h2>
      <div className="space-y-4">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{row.label}</span>
                <b>
                  {row.count}
                  {title === 'Rating records by score' && total
                    ? ` · ${((number(row.count) / total) * 100).toFixed(1)}%`
                    : ''}
                </b>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full ${color}`}
                  style={{
                    width: `${Math.max(4, (number(row.count) / max) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No data available.</p>
        )}
      </div>
      {title === 'Rating records by score' && (
        <p className="mt-4 text-xs text-slate-500">
          {total} rating records in the selected range
        </p>
      )}
    </Card>
  );
}

export default function AnalyticsWorkspace({
  data,
  section = 'all',
  departmentSelected = false,
}) {
  if (!data) return null;
  const {
    summary = {},
    attendance = {},
    ratings = {},
    tasks = {},
    departments = [],
    workforce = {},
    lifecycle = {},
  } = data;
  const showSummary = section === 'all' || section === 'summary';
  const showDistributions = section === 'all' || section === 'distributions';
  const showComparison = section === 'all' || section === 'comparison';
  const showOperations = section === 'all' || section === 'operations';
  const submittedProofs = number(tasks.submitted_proofs);
  const taskActivity =
    number(tasks.total_tasks) +
    number(tasks.assignments) +
    submittedProofs +
    number(tasks.pending_proofs);
  return (
    <div className="space-y-6">
      {showSummary && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={Users}
            label="Workforce"
            value={summary.total_users || 0}
            detail={`${summary.active_users || 0} active`}
          />
          <Metric
            icon={Activity}
            label="Attendance rate"
            value={percent(attendance.rate)}
            detail={`${attendance.present || 0} present records`}
            tone="emerald"
          />
          <Metric
            icon={Star}
            label="Average rating"
            value={`${number(ratings.average).toFixed(1)} / 10`}
            detail={`${ratings.total || 0} ratings`}
            tone="amber"
          />
          <Metric
            icon={CheckCircle2}
            label="Proof verification"
            value={
              submittedProofs ? percent(tasks.verification_rate) : 'No data'
            }
            detail={
              submittedProofs
                ? `${tasks.verified_proofs || 0} of ${submittedProofs} verified`
                : 'No proofs submitted'
            }
            tone="violet"
          />
        </div>
      )}
      {showDistributions && (
        <div className="grid items-start gap-6 xl:grid-cols-3">
          <Distribution
            title="Workforce status"
            rows={workforce.statuses}
            color="bg-emerald-500"
          />
          <Distribution
            title="Role distribution"
            rows={workforce.roles}
            color="bg-indigo-500"
          />
          <Distribution
            title="Rating records by score"
            rows={ratings.distribution}
            color="bg-amber-500"
          />
        </div>
      )}
      {showComparison && (
        <Card className="p-6">
          <div className="mb-5 flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-700">
            <BarChart3 className="h-10 w-10 rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300" />
            <div>
              <h2 className="text-lg font-extrabold">
                {departmentSelected
                  ? 'Selected Department Summary'
                  : 'Department Comparison'}
              </h2>
              <p className="text-sm text-slate-500">
                Attendance, ratings, workforce, and proof completion
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="border-b-2 border-slate-200 bg-slate-100 text-left dark:border-indigo-500/20 dark:bg-indigo-950/40">
                <tr>
                  {[
                    'Department',
                    'Members',
                    'Attendance',
                    'Average rating',
                    'Tasks',
                    'Verified proofs',
                  ].map((label) => (
                    <th key={label} className="p-4 font-extrabold">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {departments.map((row, index) => (
                  <tr
                    key={row.department_id || row.department_name}
                    className={
                      index % 2 ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''
                    }
                  >
                    <td className="p-4 font-bold">{row.department_name}</td>
                    <td className="p-4">{row.members}</td>
                    <td className="p-4">{percent(row.attendance_rate)}</td>
                    <td className="p-4">
                      {number(row.average_rating).toFixed(1)}
                    </td>
                    <td className="p-4">{row.tasks}</td>
                    <td className="p-4">{row.verified_proofs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!departments.length && (
              <p className="p-8 text-center text-slate-500">
                No department comparison data is available.
              </p>
            )}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Showing departments with workforce records in the selected scope.
          </p>
        </Card>
      )}
      {showOperations && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-3">
              <BriefcaseBusiness className="h-10 w-10 rounded-xl bg-violet-50 p-2 text-violet-600 dark:bg-violet-950/50" />
              <h2 className="text-lg font-extrabold">
                Task and proof performance
              </h2>
            </div>
            {taskActivity === 0 ? (
              <p className="rounded-2xl border border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-700">
                No task or proof activity in the selected date range.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Tasks', tasks.total_tasks],
                  ['Assignments', tasks.assignments],
                  ['Submitted proofs', tasks.submitted_proofs],
                  ['Pending proofs', tasks.pending_proofs],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"
                  >
                    <span className="text-slate-500">{label}</span>
                    <b className="mt-1 block text-2xl">{value || 0}</b>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-3">
              <CalendarClock className="h-10 w-10 rounded-xl bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/50" />
              <h2 className="text-lg font-extrabold">Lifecycle movement</h2>
            </div>
            <div className="space-y-3">
              {[
                ['Upcoming joinings', lifecycle.upcoming_joinings],
                ['Upcoming completions', lifecycle.upcoming_completions],
                ['Completed in range', lifecycle.completed],
                ['Exited in range', lifecycle.exited],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-700"
                >
                  <span className="flex items-center gap-2">
                    <CircleDot className="h-4 w-4 text-indigo-500" />
                    {label}
                  </span>
                  <b>{value || 0}</b>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
