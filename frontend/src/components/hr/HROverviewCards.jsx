import {
  Users,
  UserCheck,
  CalendarPlus,
  CalendarClock,
  FileWarning,
  AlertTriangle,
} from 'lucide-react';
import { StatCard } from '../ui';
export default function HROverviewCards({ summary = {} }) {
  const cards = [
    ['Workforce', summary.total, Users, 'from-indigo-500 to-blue-600'],
    ['Active', summary.active, UserCheck, 'from-emerald-500 to-teal-600'],
    [
      'Joining soon',
      summary.upcoming_joinings,
      CalendarPlus,
      'from-sky-500 to-cyan-600',
    ],
    [
      'Completing soon',
      summary.upcoming_completions,
      CalendarClock,
      'from-violet-500 to-purple-600',
    ],
    [
      'Missing documents',
      summary.missing_documents,
      FileWarning,
      'from-amber-500 to-orange-600',
    ],
    [
      'Needs action',
      (summary.incomplete_profiles || 0) + (summary.overdue_active || 0),
      AlertTriangle,
      'from-rose-500 to-red-600',
    ],
  ];
  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(([label, value, Icon, gradient]) => (
        <StatCard
          key={label}
          label={label}
          value={value ?? 0}
          icon={<Icon className="h-6 w-6" />}
          gradient={gradient}
        />
      ))}
    </div>
  );
}
