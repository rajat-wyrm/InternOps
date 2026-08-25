import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Star,
  History,
  Building2,
  CalendarCheck,
  Target,
  Search,
  Award,
  CheckCircle2,
  XCircle,
  Users,
} from 'lucide-react';
import api from '../lib/axios';
import useAuthStore from '../store/auth';
import RatingForm from '../components/RatingForm';
import CustomSelect from '../components/CustomSelect';
import DepartmentRatingsSheet from '../components/department/DepartmentRatingsSheet';

const ROLE_LABEL = {
  SENIOR_TL: 'Senior TL',
  TL: 'TL',
  CAPTAIN: 'Captain',
  INTERN: 'Intern',
  ADMIN: 'Admin',
};

const ROLE_BADGE = {
  ADMIN:
    'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-900/60',
  SENIOR_TL:
    'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60',
  TL: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/60',
  CAPTAIN:
    'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-100 dark:border-teal-900/60',
  INTERN:
    'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 border border-slate-200 dark:border-slate-500',
};

const STATUS_BADGE = {
  ACTIVE:
    'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/60',
  COMPLETED:
    'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/60',
  ON_HOLD:
    'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/60',
  TERMINATED:
    'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-900/60',
};

function initials(m) {
  const n = (m?.full_name || m?.email || '?').trim();
  return n
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

function Avatar({ m, size = 'w-10 h-10' }) {
  return m?.avatar_url ? (
    <img
      src={m.avatar_url}
      alt=""
      className={`${size} rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm`}
    />
  ) : (
    <div
      className={`${size} rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-500 to-violet-600 text-white flex items-center justify-center text-xs font-extrabold shadow-sm`}
    >
      {initials(m)}
    </div>
  );
}

function Stars({ value }) {
  if (value == null || value === '') {
    return <span className="text-slate-400 dark:text-slate-500">â€”</span>;
  }

  const raw = Number(value);

  if (Number.isNaN(raw)) {
    return <span className="text-slate-400 dark:text-slate-500">â€”</span>;
  }

  // Ratings are stored out of 10. Convert to 5-star visual safely.
  const safeRaw = Math.max(0, Math.min(10, raw));
  const normalized = safeRaw / 2;
  const full = Math.max(0, Math.min(5, Math.round(normalized)));
  const empty = Math.max(0, 5 - full);

  return (
    <span
      title={`${safeRaw.toFixed(1).replace(/\.0$/, '')}/10`}
      className="inline-flex items-center gap-2"
    >
      <span className="inline-flex items-center gap-0.5 text-amber-500 text-base tracking-widest drop-shadow-sm">
        <span>{'â˜…'.repeat(full)}</span>
        <span className="text-slate-300 dark:text-slate-700">
          {'â˜…'.repeat(empty)}
        </span>
      </span>

      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
        {safeRaw.toFixed(1).replace(/\.0$/, '')}/10
      </span>
    </span>
  );
}

function getEligibility(avgRating) {
  if (avgRating == null || avgRating === '') {
    return {
      status: 'UNRATED',
      badge:
        'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
      label: 'âšª No Rating',
    };
  }

  const score = Number(avgRating);
  if (Number.isNaN(score)) {
    return {
      status: 'UNRATED',
      badge:
        'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
      label: 'âšª No Rating',
    };
  }

  // If 1 to 4 ratings -> Not Eligible, else (5 to 10 ratings) -> Eligible
  if (score >= 1 && score < 5) {
    return {
      status: 'NOT_ELIGIBLE',
      badge:
        'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/60 font-extrabold',
      label: 'ðŸ”´ Not Eligible',
    };
  }

  return {
    status: 'ELIGIBLE',
    badge:
      'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 font-extrabold',
    label: 'ðŸŸ¢ Eligible',
  };
}

function StatCard({ label, value, sub, icon, accentColor = 'indigo' }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] dark:shadow-none">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase font-extrabold tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
        {icon && (
          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
      <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
        {value}
      </p>
      {sub && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
          {sub}
        </p>
      )}
    </div>
  );
}

export default function Ratings({
  isProjectView = false,
  deptId: propDeptId,
  roster = [],
} = {}) {
  const { deptId: routeDeptId } = useParams();
  const deptId = propDeptId || routeDeptId;
  const user = useAuthStore((s) => s.user);
  const canRate = ['ADMIN', 'CAPTAIN', 'TL', 'SENIOR_TL'].includes(user?.role);
  const isManager = ['CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN'].includes(
    user?.role
  );
  const isAdmin = user?.role === 'ADMIN';

  const [viewDepartmentId, setViewDepartmentId] = useState(deptId || '');
  const [viewAll, setViewAll] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const [sheetFrom, setSheetFrom] = useState(yearStart);
  const [sheetTo, setSheetTo] = useState(today);
  const [viewUserId, setViewUserId] = useState(() => {
    if (isProjectView && roster.length > 0) {
      return roster[0].id;
    }
    return deptId ? '' : user?.id || '';
  });

  // Admin filter states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [eligibilityFilter, setEligibilityFilter] = useState('');
  const [directoryViewMode, setDirectoryViewMode] = useState('table');

  const activeDeptId = deptId || viewDepartmentId;

  useEffect(() => {
    if (isProjectView) {
      setViewDepartmentId(deptId || '');

      if (roster.length > 0) {
        setViewUserId((currentUserId) => currentUserId || roster[0].id);
      }

      return;
    }

    if (deptId) {
      setViewDepartmentId(deptId);
      return;
    }

    if (user?.id) {
      setViewUserId((currentUserId) => currentUserId || user.id);
    }
  }, [isProjectView, deptId, roster, user?.id]);

  const { data: team = [], isLoading: isTeamLoading } = useQuery({
    queryKey: ['teamMembers', activeDeptId],
    queryFn: () =>
      api
        .get('/team/members', {
          params: { department_id: activeDeptId || undefined },
        })
        .then((res) => res.data),
    enabled: isManager && !isProjectView,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((res) => res.data),
    enabled: isManager && !isProjectView,
  });

  const {
    data: sheetData,
    isLoading: sheetIsLoading,
    error: sheetError,
    refetch: refetchSheet,
  } = useQuery({
    queryKey: ['departmentRatingsSheet', activeDeptId, sheetFrom, sheetTo],
    queryFn: () =>
      api
        .get(`/ratings/department/${activeDeptId}/sheet`, {
          params: { from: sheetFrom, to: sheetTo },
        })
        .then((res) => res.data),
    enabled: viewAll && !!activeDeptId && !isProjectView,
  });

  const {
    data: ratings,
    isLoading: isRatingsLoading,
    error: ratingsError,
  } = useQuery({
    queryKey: ['ratings', viewUserId],
    queryFn: () => api.get(`/ratings/${viewUserId}`).then((res) => res.data),
    enabled: !!viewUserId && !viewAll,
  });

  const handleViewDepartmentChange = (dId) => {
    setViewAll(false);
    setViewDepartmentId(dId);
    if (dId) {
      setViewUserId('');
    } else {
      setViewUserId(user?.id || '');
    }
  };

  const inspectInternRating = (userId) => {
    setViewUserId(userId);
    const el = document.getElementById('intern-rating-history');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const avg = ratings?.length
    ? (ratings.reduce((a, r) => a + Number(r.score || 0), 0) / ratings.length)
        .toFixed(1)
        .replace(/\.0$/, '')
    : null;

  const departmentOptions = useMemo(
    () => [
      { value: '', label: 'All departments' },
      ...departments.map((d) => ({
        value: d.id,
        label: d.name,
      })),
    ],
    [departments]
  );

  const statusFilterOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'ACTIVE', label: 'ACTIVE' },
    { value: 'COMPLETED', label: 'COMPLETED' },
    { value: 'ON_HOLD', label: 'ON_HOLD' },
    { value: 'TERMINATED', label: 'TERMINATED' },
  ];

  const ratingFilterOptions = [
    { value: '', label: 'All Ratings' },
    { value: '1', label: '1' },
    { value: '2', label: '2' },
    { value: '3', label: '3' },
    { value: '4', label: '4' },
    { value: '5', label: '5' },
    { value: '6', label: '6' },
    { value: '7', label: '7' },
    { value: '8', label: '8' },
    { value: '9', label: '9' },
    { value: '10', label: '10' },
  ];

  const eligibilityFilterOptions = [
    { value: '', label: 'All Eligibility' },
    { value: 'ELIGIBLE', label: 'ðŸŸ¢ Eligible' },
    { value: 'NOT_ELIGIBLE', label: 'ðŸ”´ Not Eligible' },
  ];

  // Base list of team members / roster
  const baseMembers = isProjectView
    ? roster
    : team.filter((m) => !activeDeptId || m.department_id === activeDeptId);

  useEffect(() => {
    if (!deptId || isProjectView || team.length === 0) return;

    const departmentMembers = team.filter(
      (member) => member.department_id === deptId
    );

    if (departmentMembers.length === 0) return;

    setViewUserId((currentUserId) => {
      const selectedUserIsInDepartment = departmentMembers.some(
        (member) => member.id === currentUserId
      );

      return selectedUserIsInDepartment
        ? currentUserId
        : departmentMembers[0].id;
    });
  }, [deptId, isProjectView, team]);

  const ratingUserOptions = isProjectView
    ? roster.map((m) => ({
        value: m.id,
        label: `${m.full_name || m.email} (${m.role})`,
      }))
    : [
        {
          value: user?.id || '',
          label: `Me (${user?.email || 'Current user'})`,
        },
        ...baseMembers
          .filter((m) => m.id !== user?.id)
          .map((m) => ({
            value: m.id,
            label: `${m.full_name || m.email} (${m.role})`,
          })),
      ];

  const activeDepartment = departments.find((d) => d.id === activeDeptId);

  const selectedMemberInfo = baseMembers.find((m) => m.id === viewUserId);

  // Directory stats derived from the current base member list
  const stats = useMemo(() => {
    const total = baseMembers.length;
    let highPerformers = 0;
    let eligible = 0;
    let notEligible = 0;
    let ratedCount = 0;
    let scoreSum = 0;

    baseMembers.forEach((m) => {
      const score = Number(m.avg_rating);
      if (m.avg_rating == null || m.avg_rating === '' || Number.isNaN(score)) {
        return;
      }

      ratedCount += 1;
      scoreSum += score;

      if (score >= 8) highPerformers += 1;
      if (score >= 5) {
        eligible += 1;
      } else if (score >= 1) {
        notEligible += 1;
      }
    });

    return {
      total,
      highPerformers,
      eligible,
      notEligible,
      avgScore: ratedCount
        ? (scoreSum / ratedCount).toFixed(1).replace(/\.0$/, '')
        : null,
    };
  }, [baseMembers]);

  // Filtered member list for the directory table/grid
  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return baseMembers.filter((m) => {
      if (q) {
        const haystack = `${m.full_name || ''} ${m.email || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (statusFilter && (m.internship_status || 'ACTIVE') !== statusFilter) {
        return false;
      }

      if (ratingFilter) {
        const score = Number(m.avg_rating);
        if (Number.isNaN(score) || Math.round(score) !== Number(ratingFilter)) {
          return false;
        }
      }

      if (eligibilityFilter) {
        const eligibility = getEligibility(m.avg_rating);
        if (eligibility.status !== eligibilityFilter) return false;
      }

      return true;
    });
  }, [baseMembers, search, statusFilter, ratingFilter, eligibilityFilter]);

  return (
    <div className="animate-fade-in-up">
      {/* Admin Department Navigation Context Banner */}
      {isAdmin && activeDeptId && !isProjectView && (
        <div className="mb-6 p-4 rounded-3xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-indigo-500/20 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider text-indigo-300">
                  Department Context
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200">
                  Admin Scope
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-white">
                {activeDepartment?.name || 'Department View'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            <Link
              to={
                deptId
                  ? `/admin/departments/${deptId}/attendance`
                  : '/attendance'
              }
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-indigo-100 transition"
            >
              Attendance
            </Link>
            <Link
              to={deptId ? `/admin/departments/${deptId}/ratings` : '/ratings'}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-white shadow-sm"
            >
              Ratings
            </Link>
            <Link
              to={deptId ? `/admin/departments/${deptId}/tasks` : '/tasks'}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-indigo-100 transition"
            >
              Tasks
            </Link>
            <Link
              to="/admin/departments"
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-indigo-200 transition ml-auto md:ml-2"
            >
              Change Department
            </Link>
          </div>
        </div>
      )}

      {/* Professional Header */}
      {!isProjectView && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/60 text-amber-600 dark:text-amber-300 flex items-center justify-center shadow-sm">
              <Star className="w-6 h-6" />
            </div>

            <div>
              <p className="text-xs md:text-sm uppercase tracking-[0.22em] text-amber-600 dark:text-amber-300 font-extrabold mb-1">
                Performance
              </p>

              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Ratings &amp; Eligibility
              </h1>

              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
                View, search, and filter intern ratings (1-10) and evaluate
                eligibility status
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stat Cards for Admin / Manager */}
      {isManager && !isProjectView && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-7">
          <StatCard
            label="Total Interns"
            value={stats.total}
            icon={<Users className="w-4 h-4" />}
          />
          <StatCard
            label="High Performers"
            value={stats.highPerformers}
            sub="Rating 8-10"
            icon={<Award className="w-4 h-4 text-amber-500" />}
          />
          <StatCard
            label="Eligible"
            value={stats.eligible}
            sub="Rating 5-10"
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          />
          <StatCard
            label="Not Eligible"
            value={stats.notEligible}
            sub="Rating 1-4"
            icon={<XCircle className="w-4 h-4 text-rose-500" />}
          />
          <StatCard
            label="Avg Rating"
            value={stats.avgScore ? `${stats.avgScore}` : 'â€”'}
            sub="out of 10"
            icon={<Star className="w-4 h-4 text-amber-500" />}
          />
        </div>
      )}

      {/* Admin / Manager Comprehensive Intern Ratings Directory & Filter Section */}
      {isManager && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none mb-7">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
                Intern Ratings &amp; Eligibility Directory
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Filter interns by rating (1-10), eligibility condition,
                department, and internship status
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <CustomSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusFilterOptions}
              placeholder="All Statuses"
            />

            <CustomSelect
              value={ratingFilter}
              onChange={setRatingFilter}
              options={ratingFilterOptions}
              placeholder="All Ratings"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {!isProjectView && (
              <CustomSelect
                value={activeDeptId}
                onChange={handleViewDepartmentChange}
                options={departmentOptions}
                placeholder="All departments"
                searchable={true}
              />
            )}

            <CustomSelect
              value={eligibilityFilter}
              onChange={setEligibilityFilter}
              options={eligibilityFilterOptions}
              placeholder="All Eligibility"
            />
          </div>

          {/* Directory Content */}
          {isTeamLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400">
              <Star className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="font-bold">
                No interns match the selected filter criteria.
              </p>
              <p className="text-xs mt-1 text-slate-400">
                Try adjusting your search, department, rating, or eligibility
                filters.
              </p>
            </div>
          ) : directoryViewMode === 'table' ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950 text-left text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-4 font-extrabold">Intern</th>
                    <th className="p-4 font-extrabold">Role</th>
                    <th className="p-4 font-extrabold">Department</th>
                    <th className="p-4 font-extrabold">Status</th>
                    <th className="p-4 font-extrabold">Rating (1-10)</th>
                    <th className="p-4 font-extrabold">Eligibility</th>
                    <th className="p-4 font-extrabold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((m, index) => {
                    const eligibility = getEligibility(m.avg_rating);
                    return (
                      <tr
                        key={m.id}
                        className={`border-b border-slate-100 dark:border-slate-800 last:border-b-0 transition ${
                          index % 2 === 0
                            ? 'bg-white dark:bg-slate-900'
                            : 'bg-slate-50/50 dark:bg-slate-800/30'
                        } hover:bg-amber-50/30 dark:hover:bg-slate-800`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar m={m} />
                            <div>
                              <div className="font-extrabold text-slate-900 dark:text-white">
                                {m.full_name || 'â€”'}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {m.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              ROLE_BADGE[m.role] || ROLE_BADGE.INTERN
                            }`}
                          >
                            {ROLE_LABEL[m.role] || m.role}
                          </span>
                        </td>

                        <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">
                          {m.department_name || 'â€”'}
                        </td>

                        <td className="p-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              STATUS_BADGE[m.internship_status] ||
                              STATUS_BADGE.ACTIVE
                            }`}
                          >
                            {m.internship_status || 'ACTIVE'}
                          </span>
                        </td>

                        <td className="p-4">
                          <Stars value={m.avg_rating} />
                          {m.rating_count > 0 && (
                            <span className="text-[10px] block text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                              ({m.rating_count}{' '}
                              {m.rating_count === 1 ? 'rating' : 'ratings'})
                            </span>
                          )}
                        </td>

                        <td className="p-4">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs ${eligibility.badge}`}
                          >
                            {eligibility.label}
                          </span>
                        </td>

                        <td className="p-4 text-right">
                          <button
                            onClick={() => inspectInternRating(m.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition"
                          >
                            Check Rating
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMembers.map((m) => {
                const eligibility = getEligibility(m.avg_rating);
                return (
                  <div
                    key={m.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-sm hover:shadow-md transition"
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar m={m} />
                        <div>
                          <div className="font-extrabold text-slate-900 dark:text-white truncate max-w-[140px]">
                            {m.full_name || m.email}
                          </div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ROLE_BADGE[m.role] || ROLE_BADGE.INTERN
                            }`}
                          >
                            {ROLE_LABEL[m.role] || m.role}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs ${eligibility.badge}`}
                      >
                        {eligibility.label}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 mb-4">
                      <p>ðŸ¢ {m.department_name || 'No department'}</p>
                      <p>ðŸ“Œ Status: {m.internship_status || 'ACTIVE'}</p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <Stars value={m.avg_rating} />
                      </div>

                      <button
                        onClick={() => inspectInternRating(m.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-amber-500 text-white hover:bg-amber-600 shadow-sm"
                      >
                        Check Rating
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Individual Intern Rating Detail Inspector & History Timeline */}
      <div id="intern-rating-history">
        <div className="bg-white dark:bg-slate-900 p-6 md:p-7 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/60 shadow-sm shrink-0">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
                  Individual Rating History &amp; Inspector
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Select a team member to check their ratings history, comments,
                  and average score.
                </p>
              </div>
            </div>

            {avg && (
              <div className="bg-amber-50 dark:bg-amber-950/40 px-5 py-3 rounded-2xl border border-amber-100 dark:border-amber-900/60 flex items-center gap-3 self-start sm:self-center">
                <div className="text-4xl font-extrabold text-amber-600 dark:text-amber-300">
                  {avg}
                </div>
                <div className="text-left">
                  <div className="text-[10px] font-extrabold text-amber-700/70 dark:text-amber-300/80 uppercase tracking-wider">
                    Average Rating
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                    avg of {ratings?.length || 0}{' '}
                    {ratings?.length === 1 ? 'rating' : 'ratings'} Â· out of 10
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {isManager ? (
              <>
                {!isProjectView && (
                  <div>
                    <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                      Department
                    </label>

                    <CustomSelect
                      value={activeDeptId}
                      onChange={handleViewDepartmentChange}
                      options={departmentOptions}
                      placeholder="All departments"
                      className="w-full"
                      searchable={true}
                    />
                    {!isProjectView && activeDeptId && (
                      <button
                        type="button"
                        onClick={() => setViewAll((current) => !current)}
                        className="mt-3 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-extrabold text-slate-950 hover:bg-amber-400"
                      >
                        {viewAll ? 'Individual View' : 'View All'}
                      </button>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                    Select Member to Check Rating
                  </label>

                  <CustomSelect
                    value={viewUserId}
                    onChange={setViewUserId}
                    options={ratingUserOptions}
                    placeholder="Select member"
                    className="w-full"
                    searchable={true}
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Viewing:
                </span>
                <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-900/50">
                  My ratings
                </span>
              </div>
            )}
          </div>

          {viewAll && (
            <div className="mt-6">
              <DepartmentRatingsSheet
                departmentName={activeDepartment?.name}
                data={sheetData}
                from={sheetFrom}
                to={sheetTo}
                onFromChange={setSheetFrom}
                onToChange={setSheetTo}
                isLoading={sheetIsLoading}
                error={sheetError}
                onRetry={refetchSheet}
              />
            </div>
          )}

          {!viewAll && isRatingsLoading && (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
            </div>
          )}

          {!viewAll && ratingsError && (
            <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 p-4 rounded-2xl border border-red-100 dark:border-red-900/60 mt-6">
              {ratingsError.response?.data?.error || 'Failed to load ratings'}
            </div>
          )}

          {!viewAll && !viewUserId && !isRatingsLoading && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none p-12 text-center text-slate-500 dark:text-slate-400 mt-6">
              <Star className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />

              <p className="font-semibold">
                No ratings have been submitted for{' '}
                {selectedMemberInfo?.full_name || 'this member'} yet.
              </p>
            </div>
          )}

          {!viewAll &&
            ratings &&
            (ratings.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none p-12 text-center text-slate-500 dark:text-slate-400 mt-6">
                <Star className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />

                <p className="font-semibold">
                  No ratings have been submitted yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3 mt-6">
                {ratings.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)] dark:shadow-none hover:shadow-[0_16px_38px_rgba(15,23,42,0.08)] dark:hover:shadow-none transition-all group"
                  >
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <Stars value={r.score} />

                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full">
                        {new Date(r.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    {r.remarks ? (
                      <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                        {r.remarks}
                      </p>
                    ) : (
                      <p className="text-slate-400 dark:text-slate-500 text-sm italic">
                        No remarks provided.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ))}
        </div>

        {canRate && (
          <RatingForm
            roster={isProjectView ? roster : undefined}
            departmentId={deptId}
          />
        )}
      </div>
    </div>
  );
}
