import { CalendarDays, Layers3 } from 'lucide-react';
import { Card } from '../ui';
import { dateLabel } from '../../utils/hrInsights';
function Breakdown({ title, icon: Icon, items = [] }) {
  const max = Math.max(1, ...items.map((x) => Number(x.count) || 0));
  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center gap-3">
        <Icon className="h-10 w-10 rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/50" />
        <h2 className="text-lg font-extrabold">{title}</h2>
      </div>
      <div className="space-y-4">
        {items.length ? (
          items.slice(0, 8).map((x) => (
            <div key={x.label}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{x.label}</span>
                <b>{x.count}</b>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{
                    width: `${Math.max(5, (Number(x.count) / max) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No data available.</p>
        )}
      </div>
    </Card>
  );
}
export default function HRLifecyclePanels({ departments, roles, milestones }) {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-3">
      <div className="grid items-stretch gap-5 xl:col-span-2 xl:grid-cols-2">
        <Breakdown title="Departments" icon={Layers3} items={departments} />
        <Breakdown title="Roles" icon={Layers3} items={roles} />
      </div>

      <Card className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <CalendarDays className="h-10 w-10 rounded-xl bg-violet-50 p-2 text-violet-600 dark:bg-violet-950/50" />
          <h2 className="text-lg font-extrabold">Lifecycle milestones</h2>
        </div>
        <div className="space-y-3">
          {(milestones || []).slice(0, 7).map((x) => (
            <div
              key={x.id}
              className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700"
            >
              <b className="block truncate text-sm">{x.full_name || x.email}</b>
              <span className="text-xs text-slate-500">
                Join {dateLabel(x.joining_date)} · End{' '}
                {dateLabel(x.extended_completion_date || x.completion_date)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
