import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import api from '../../lib/axios';
import { QUERY_KEYS } from '../../constants/queryKeys';

export default function InternsByDomainChart() {
  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.TEAM_MEMBERS,
    queryFn: () => api.get('/team/members').then((res) => res.data),
  });

  const chartData = useMemo(() => {
    const members = Array.isArray(teamMembers) ? teamMembers : [];
    const interns = members.filter(
      (m) => !m.role || m.role.toUpperCase() === 'INTERN'
    );

    const counts = {};
    interns.forEach((m) => {
      const domain = (m.internship_domain || '').trim();
      if (!domain) return;
      counts[domain] = (counts[domain] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count);
  }, [teamMembers]);

  return (
    <div className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:shadow-none mb-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-2xl bg-indigo-100/80 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <BarChart3 className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
            Interns by Domain
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Distribution of interns across internship domains
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <span className="inline-block w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
          No domain data available yet.
        </div>
      ) : (
        <div
          className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-3 border border-slate-200/30 dark:border-slate-850"
          style={{ height: Math.max(260, chartData.length * 46) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 24, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                strokeOpacity={0.15}
              />
              <XAxis
                type="number"
                allowDecimals={false}
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="domain"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                width={140}
              />
              <Tooltip
                cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
                contentStyle={{
                  background: '#0f172a',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#fff', fontWeight: 700 }}
                formatter={(value) => [
                  `${value} intern${value === 1 ? '' : 's'}`,
                  'Count',
                ]}
              />
              <Bar
                dataKey="count"
                fill="#6366f1"
                radius={[0, 6, 6, 0]}
                barSize={22}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
