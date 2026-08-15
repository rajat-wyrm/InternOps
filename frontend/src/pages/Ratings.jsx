import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Star, History, Building2, CalendarCheck, Target } from 'lucide-react';
import api from '../lib/axios';
import useAuthStore from '../store/auth';
import RatingForm from '../components/RatingForm';
import CustomSelect from '../components/CustomSelect';
import DepartmentRatingsSheet from '../components/department/DepartmentRatingsSheet';

function Stars({ value }) {
  if (value == null || value === '') {
    return <span className="text-slate-400 dark:text-slate-500">—</span>;
  }

  const raw = Number(value);

  if (Number.isNaN(raw)) {
    return <span className="text-slate-400 dark:text-slate-500">—</span>;
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
      <span className="inline-flex items-center gap-0.5 text-amber-500 text-lg tracking-widest drop-shadow-sm">
        <span>{'★'.repeat(full)}</span>
        <span className="text-slate-300 dark:text-slate-700">
          {'★'.repeat(empty)}
        </span>
      </span>

      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
        {safeRaw.toFixed(1).replace(/\.0$/, '')}/10
      </span>
    </span>
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

  const { data: team = [] } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => api.get('/team/members').then((res) => res.data),
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
    isLoading,
    error,
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

  const avg = ratings?.length
    ? (ratings.reduce((a, r) => a + Number(r.score || 0), 0) / ratings.length)
        .toFixed(1)
        .replace(/\.0$/, '')
    : null;

  const departmentOptions = [
    { value: '', label: 'All departments' },
    ...departments.map((d) => ({
      value: d.id,
      label: d.name,
    })),
  ];

  const filteredTeam = isProjectView
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
        ...filteredTeam
          .filter((m) => m.id !== user?.id)
          .map((m) => ({
            value: m.id,
            label: `${m.full_name || m.email} (${m.role})`,
          })),
      ];

  const activeDepartment = departments.find((d) => d.id === activeDeptId);

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
                Ratings
              </h1>

              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
                Evaluate performance and view historical scores
              </p>
            </div>
          </div>
        </div>
      )}

      {/* For Admin: render View Section on top, Rating Form at bottom. For others: Rating Form on top, View Section at bottom */}
      {isAdmin ? (
        <>
          <div className="bg-white dark:bg-slate-900 p-6 md:p-7 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/60 shadow-sm shrink-0">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
                    View Ratings History
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Select a department and member to check their ratings and
                    average score.
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
                      avg of {ratings.length}{' '}
                      {ratings.length === 1 ? 'rating' : 'ratings'} · out of 10
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
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                      Team Member
                    </label>

                    <CustomSelect
                      value={viewUserId}
                      onChange={setViewUserId}
                      options={ratingUserOptions}
                      placeholder="Select member"
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
          </div>

          {viewAll && (
            <div className="mb-6">
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

          {!viewAll && isLoading && (
            <div className="flex justify-center p-8 mb-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
            </div>
          )}

          {!viewAll && error && (
            <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 p-4 rounded-2xl border border-red-100 dark:border-red-900/60 mb-6">
              {error.response?.data?.error || 'Failed to load ratings'}
            </div>
          )}

          {!viewAll && !viewUserId && !isLoading && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none p-12 text-center text-slate-500 dark:text-slate-400 mb-6">
              <Star className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="font-semibold">
                Select a team member to view their rating history.
              </p>
            </div>
          )}

          {!viewAll &&
            ratings &&
            (ratings.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none p-12 text-center text-slate-500 dark:text-slate-400 mb-6">
                <Star className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />

                <p className="font-semibold">
                  No ratings have been submitted yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
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

          {canRate && (
            <RatingForm
              roster={isProjectView ? roster : undefined}
              departmentId={deptId}
            />
          )}
        </>
      ) : (
        <>
          {canRate && (
            <RatingForm
              roster={isProjectView ? roster : undefined}
              departmentId={deptId}
            />
          )}

          <div className="bg-white dark:bg-slate-900 p-6 md:p-7 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/60 shadow-sm shrink-0">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
                    View Ratings History
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Select a department and member to check their ratings and
                    average score.
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
                      avg of {ratings.length}{' '}
                      {ratings.length === 1 ? 'rating' : 'ratings'} · out of 10
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
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                      Team Member
                    </label>

                    <CustomSelect
                      value={viewUserId}
                      onChange={setViewUserId}
                      options={ratingUserOptions}
                      placeholder="Select member"
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
          </div>

          {viewAll && (
            <div className="mb-6">
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

          {!viewAll && isLoading && (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
            </div>
          )}

          {!viewAll && error && (
            <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 p-4 rounded-2xl border border-red-100 dark:border-red-900/60">
              {error.response?.data?.error || 'Failed to load ratings'}
            </div>
          )}

          {!viewAll && !viewUserId && !isLoading && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none p-12 text-center text-slate-500 dark:text-slate-400">
              <Star className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="font-semibold">
                Select a team member to view their rating history.
              </p>
            </div>
          )}

          {!viewAll &&
            ratings &&
            (ratings.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none p-12 text-center text-slate-500 dark:text-slate-400">
                <Star className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />

                <p className="font-semibold">
                  No ratings have been submitted yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
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
        </>
      )}
    </div>
  );
}
