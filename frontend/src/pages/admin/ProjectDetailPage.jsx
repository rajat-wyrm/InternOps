import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarCheck, Star, Video, Target } from 'lucide-react';
import api from '../../lib/axios';
import {
  PageHeader,
  Card,
  Spinner,
  ApiErrorState,
  Btn,
} from '../../components/ui';

// Import the original pages to match features exactly
import Attendance from '../Attendance';
import Ratings from '../Ratings';
import Meetings from '../Meetings';
import Tasks from '../Tasks';

function SummaryPill({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-3">
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
        {value}
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const navigate = useNavigate();
  const { deptId, leadId } = useParams();
  const [tab, setTab] = useState('attendance');

  // Queries
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r) => r.data),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['departmentTeams', deptId],
    queryFn: () => api.get(`/departments/${deptId}/teams`).then((r) => r.data),
    enabled: !!deptId,
  });

  const rosterQuery = useQuery({
    queryKey: ['fullTeam', leadId],
    queryFn: () =>
      api
        .get('/hierarchy/full-team', { params: { managerId: leadId } })
        .then((r) => r.data),
    enabled: !!leadId,
  });

  const department = departments.find((item) => item.id === deptId);
  const lead = teams.find((item) => item.lead_id === leadId);

  // Roster includes all members in the hierarchy + the lead themselves
  const roster = useMemo(() => {
    const list = [...(rosterQuery.data?.data || [])];
    if (lead && !list.some((m) => m.id === lead.lead_id)) {
      list.unshift({
        id: lead.lead_id,
        full_name: lead.lead_name,
        role: lead.role,
        email: '',
      });
    }
    return list;
  }, [rosterQuery.data?.data, lead]);

  const isLoading = rosterQuery.isLoading;
  const error = rosterQuery.error;

  return (
    <div className="animate-fade-in-up">
      <div className="mb-5">
        <Btn
          variant="outline"
          onClick={() => navigate(`/departments/${deptId}/projects`)}
          className="mb-4"
        >
          <span className="inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Projects
          </span>
        </Btn>

        <PageHeader
          title={lead?.lead_name || 'Project Detail'}
          subtitle={`${department?.name || 'Department'} · roster, attendance, ratings, meetings, and tasks`}
          icon="👥"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : error ? (
        <ApiErrorState
          error={error}
          title="Failed to load project detail"
          fallback="Unable to load this project's roster."
        />
      ) : (
        <>
          <Card className="p-5 mb-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <SummaryPill
                label="Project lead"
                value={lead?.lead_name || leadId}
              />
              <SummaryPill label="Role" value={lead?.role || '—'} />
              <SummaryPill label="Roster size" value={roster.length} />
            </div>
          </Card>

          <div className="flex gap-2 mb-5 flex-wrap">
            <button
              type="button"
              onClick={() => setTab('attendance')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-extrabold border transition-colors ${
                tab === 'attendance'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              Attendance
            </button>
            <button
              type="button"
              onClick={() => setTab('ratings')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-extrabold border transition-colors ${
                tab === 'ratings'
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
            >
              <Star className="w-4 h-4" />
              Ratings
            </button>
            <button
              type="button"
              onClick={() => setTab('meetings')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-extrabold border transition-colors ${
                tab === 'meetings'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
            >
              <Video className="w-4 h-4" />
              Meetings
            </button>
            <button
              type="button"
              onClick={() => setTab('tasks')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-extrabold border transition-colors ${
                tab === 'tasks'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
            >
              <Target className="w-4 h-4" />
              Tasks
            </button>
          </div>

          <div className="mt-4">
            {tab === 'attendance' && (
              <Attendance
                isProjectView={true}
                deptId={deptId}
                roster={roster}
              />
            )}
            {tab === 'ratings' && (
              <Ratings isProjectView={true} deptId={deptId} roster={roster} />
            )}
            {tab === 'meetings' && (
              <Meetings isProjectView={true} deptId={deptId} roster={roster} />
            )}
            {tab === 'tasks' && <Tasks isProjectView={true} roster={roster} />}
          </div>
        </>
      )}
    </div>
  );
}
