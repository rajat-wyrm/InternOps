import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, UserCheck, Briefcase, UserX, Pause } from 'lucide-react';
import api from '../../lib/axios';
import { QUERY_KEYS } from '../../constants/queryKeys';

export default function InternStatCards() {
  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.TEAM_MEMBERS,
    queryFn: () => api.get('/team/members').then((res) => res.data),
  });

  const stats = useMemo(() => {
    const members = Array.isArray(teamMembers) ? teamMembers : [];

    // Filter for INTERN role if role property is available on items
    const hasRoleAttr = members.some((m) => m.role);
    const targetList = hasRoleAttr
      ? members.filter((m) => !m.role || m.role.toUpperCase() === 'INTERN')
      : members;

    const finalTargetList = targetList.length > 0 ? targetList : members;

    let active = 0;
    let completed = 0;
    let terminated = 0;
    let discontinued = 0;

    finalTargetList.forEach((m) => {
      const status = (
        m.internship_status ||
        m.status ||
        'ACTIVE'
      ).toUpperCase();

      if (status === 'COMPLETED') {
        completed++;
      } else if (status === 'TERMINATED') {
        terminated++;
      } else if (status === 'DISCONTINUED' || status === 'ON_HOLD') {
        discontinued++;
      } else if (status === 'ACTIVE') {
        if (!m.suspended) {
          active++;
        } else {
          discontinued++;
        }
      } else {
        active++;
      }
    });

    return {
      total: finalTargetList.length,
      active,
      completed,
      terminated,
      discontinued,
    };
  }, [teamMembers]);

  const cards = [
    {
      id: 'total-interns',
      label: 'Total Interns',
      value: stats.total,
      icon: Users,
      iconBg: 'bg-indigo-100/80 dark:bg-indigo-950/60',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      cornerBg: 'bg-indigo-100/50 dark:bg-indigo-950/30',
    },
    {
      id: 'active-interns',
      label: 'Active',
      value: stats.active,
      icon: UserCheck,
      iconBg: 'bg-emerald-100/80 dark:bg-emerald-950/60',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      cornerBg: 'bg-emerald-100/50 dark:bg-emerald-950/30',
    },
    {
      id: 'completed-interns',
      label: 'Completed',
      value: stats.completed,
      icon: Briefcase,
      iconBg: 'bg-blue-100/80 dark:bg-blue-950/60',
      iconColor: 'text-blue-600 dark:text-blue-400',
      cornerBg: 'bg-blue-100/50 dark:bg-blue-950/30',
    },
    {
      id: 'terminated-interns',
      label: 'Terminated',
      value: stats.terminated,
      icon: UserX,
      iconBg: 'bg-rose-100/80 dark:bg-rose-950/60',
      iconColor: 'text-rose-600 dark:text-rose-400',
      cornerBg: 'bg-rose-100/50 dark:bg-rose-950/30',
    },
    {
      id: 'discontinued-interns',
      label: 'Discontinued',
      value: stats.discontinued,
      icon: Pause,
      iconBg: 'bg-amber-100/80 dark:bg-amber-950/60',
      iconColor: 'text-amber-600 dark:text-amber-400',
      cornerBg: 'bg-amber-100/50 dark:bg-amber-950/30',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
      {cards.map((card) => {
        const IconComponent = card.icon;
        return (
          <div
            key={card.id}
            data-testid={`stat-card-${card.id}`}
            className="relative overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:shadow-none flex flex-col justify-between"
          >
            <div
              className={`w-14 h-14 rounded-2xl ${card.iconBg} ${card.iconColor} flex items-center justify-center mb-6 transition-transform hover:scale-105`}
            >
              <IconComponent className="w-7 h-7" />
            </div>

            <div className="relative z-10">
              <p className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {isLoading ? (
                  <span className="inline-block w-16 h-10 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                ) : (
                  card.value
                )}
              </p>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-2">
                {card.label}
              </p>
            </div>

            <div
              className={`absolute -right-8 -bottom-8 w-28 h-28 rounded-full ${card.cornerBg} pointer-events-none`}
            />
          </div>
        );
      })}
    </div>
  );
}
