import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Calendar,
  Search,
  ChevronRight,
  ArrowUpDown,
  X,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Clock,
  MessageSquare,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import api from '../lib/axios';
import {
  Card,
  PageHeader,
  Badge,
  Stars,
  Spinner,
  ApiErrorState,
} from '../components/ui';

// Status styling mapping
const STATUS_COLORS = {
  Good: 'green',
  'Attention Required': 'red',
  'Missing Data': 'gray',
};

const STATUS_ICONS = {
  Good: <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />,
  'Attention Required': (
    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
  ),
  'Missing Data': <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />,
};

export default function InternOps() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedInternId, setSelectedInternId] = useState(null);

  // Sort State
  const [sortField, setSortField] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Fallback to the seeded demo dates if nothing is in URL search parameter
  const fallbackStart = '2026-08-17';
  const fallbackEnd = '2026-08-23';

  const startDate = searchParams.get('startDate') || fallbackStart;
  const endDate = searchParams.get('endDate') || fallbackEnd;

  // React Query fetch
  const {
    data: interns = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['internopsSummary', startDate, endDate],
    queryFn: () =>
      api
        .get('/internops/summary', { params: { startDate, endDate } })
        .then((res) => res.data),
    staleTime: 30 * 1000, // cache for 30s
  });

  // Calculate Date Ranges for Quick Picks
  const handlePickerPreset = (preset) => {
    const d = new Date();
    let start = '';
    let end = '';

    if (preset === 'THIS_WEEK') {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const sunday = new Date(d.setDate(diff + 6));
      start = monday.toISOString().slice(0, 10);
      end = sunday.toISOString().slice(0, 10);
    } else if (preset === 'LAST_WEEK') {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
      const monday = new Date(d.setDate(diff));
      const sunday = new Date(d.setDate(diff + 6));
      start = monday.toISOString().slice(0, 10);
      end = sunday.toISOString().slice(0, 10);
    } else if (preset === 'THIS_MONTH') {
      start = new Date(d.getFullYear(), d.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        .toISOString()
        .slice(0, 10);
    } else if (preset === 'LAST_MONTH') {
      start = new Date(d.getFullYear(), d.getMonth() - 1, 1)
        .toISOString()
        .slice(0, 10);
      end = new Date(d.getFullYear(), d.getMonth(), 0)
        .toISOString()
        .slice(0, 10);
    } else if (preset === 'DEMO_AUG_2026') {
      start = '2026-08-17';
      end = '2026-08-23';
    }

    setSearchParams({ startDate: start, endDate: end });
  };

  const handleDateChange = (type, val) => {
    if (type === 'start') {
      setSearchParams({ startDate: val, endDate });
    } else {
      setSearchParams({ startDate, endDate: val });
    }
  };

  // Sorting helper
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Process and filter/sort interns list
  const processedInterns = useMemo(() => {
    let list = [...interns];

    // Filter by search text
    if (searchText) {
      const q = searchText.toLowerCase();
      list = list.filter(
        (i) =>
          (i.name && i.name.toLowerCase().includes(q)) ||
          (i.email && i.email.toLowerCase().includes(q))
      );
    }

    // Filter by status
    if (statusFilter !== 'ALL') {
      list = list.filter((i) => i.status === statusFilter);
    }

    // Sort list
    list.sort((a, b) => {
      let valA, valB;

      switch (sortField) {
        case 'name':
          valA = a.name || '';
          valB = b.name || '';
          break;
        case 'attendance':
          valA = a.attendancePercentage || 0;
          valB = b.attendancePercentage || 0;
          break;
        case 'rating':
          valA = a.avgRating || 0;
          valB = b.avgRating || 0;
          break;
        case 'status':
          valA = a.status || '';
          valB = b.status || '';
          break;
        default:
          valA = a.name || '';
          valB = b.name || '';
      }

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [interns, searchText, statusFilter, sortField, sortAsc]);

  // Currently selected intern details
  const selectedIntern = useMemo(() => {
    return interns.find((i) => i.id === selectedInternId) || null;
  }, [interns, selectedInternId]);

  return (
    <div className="relative min-h-[80vh] animate-fade-in-up text-slate-900 dark:text-white">
      {/* Header Block */}
      <PageHeader
        title="InternOps"
        subtitle="Monitor intern attendance and performance across a selected time period."
        icon={
          <Building2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        }
      />

      {/* Date Picker and Filters Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-7 items-start">
        {/* Date Selector Card */}
        <Card className="p-5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 xl:col-span-2">
          <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-500" />
            Date Range Selection
          </h3>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleDateChange('start', e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 w-full"
              />
              <span className="text-slate-400 font-medium">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleDateChange('end', e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 w-full"
              />
            </div>

            {/* Presets Quick Filters */}
            <div className="flex flex-wrap gap-1.5 w-full sm:w-auto justify-start sm:justify-end">
              <button
                onClick={() => handlePickerPreset('THIS_WEEK')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
              >
                This Week
              </button>
              <button
                onClick={() => handlePickerPreset('LAST_WEEK')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
              >
                Last Week
              </button>
              <button
                onClick={() => handlePickerPreset('THIS_MONTH')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
              >
                This Month
              </button>
              <button
                onClick={() => handlePickerPreset('LAST_MONTH')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
              >
                Last Month
              </button>
              <button
                onClick={() => handlePickerPreset('DEMO_AUG_2026')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-extrabold bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/10 transition"
              >
                Aug 2026 Seed
              </button>
            </div>
          </div>
        </Card>

        {/* Search and filter text details */}
        <Card className="p-5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-indigo-500" />
            Quick Filter
          </h3>

          <div className="relative">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 w-full"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </Card>
      </div>

      {/* Main Table and Sidebar Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Intern Performance Table Card */}
        <div className="xl:col-span-2 space-y-4">
          {/* Status Tabs filters */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl w-fit border border-slate-200/50 dark:border-slate-800">
            {['ALL', 'Good', 'Attention Required', 'Missing Data'].map(
              (state) => (
                <button
                  key={state}
                  onClick={() => setStatusFilter(state)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                    statusFilter === state
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {state === 'ALL' ? 'All Roles' : state}
                </button>
              )
            )}
          </div>

          {isLoading ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-12 transition-all">
              <Spinner label="Loading intern records..." />
            </div>
          ) : isError ? (
            <ApiErrorState
              error={error}
              title="Failed to fetch InternOps data"
              fallback="Make sure the CSV data files are located in the project root."
              onRetry={refetch}
            />
          ) : processedInterns.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-12 text-center text-slate-400">
              No interns matched your filters for the range from {startDate} to{' '}
              {endDate}.
            </div>
          ) : (
            <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-55 dark:bg-slate-950 text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-extrabold select-none">
                    <tr>
                      <th
                        onClick={() => handleSort('name')}
                        className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          Intern Name &amp; ID
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('attendance')}
                        className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 font-bold">
                          Attendance %
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('rating')}
                        className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 font-bold">
                          Avg Rating
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('status')}
                        className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 font-bold">
                          Status
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                        </div>
                      </th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {processedInterns.map((i, index) => (
                      <tr
                        key={i.id}
                        onClick={() => setSelectedInternId(i.id)}
                        className={`cursor-pointer transition-colors hover:bg-indigo-50/20 dark:hover:bg-slate-850 ${
                          selectedInternId === i.id
                            ? 'bg-indigo-50/30 dark:bg-slate-800'
                            : ''
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="font-extrabold text-slate-800 dark:text-white capitalize">
                            {i.name}
                          </div>
                          <div className="text-xs text-slate-400 font-medium">
                            {i.email}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  i.attendancePercentage >= 80
                                    ? 'bg-emerald-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${i.attendancePercentage}%` }}
                              />
                            </div>
                            <span className="font-bold text-slate-800 dark:text-indigo-200">
                              {i.attendancePercentage}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-amber-500">
                              {i.avgRating || '—'}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                              ({i.numRatings} ratings)
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge color={STATUS_COLORS[i.status]}>
                            {i.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <ChevronRight className="w-4 h-4 text-indigo-400 inline-block transition hover:translate-x-0.5" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* Slide-over Drill-down side panel */}
        <div className="xl:col-span-1">
          {selectedIntern ? (
            <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-6 relative animate-fade-in">
              {/* Close Button */}
              <button
                onClick={() => setSelectedInternId(null)}
                className="absolute right-4 top-4 w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 transition"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header profile */}
              <div className="mb-6 border-b border-slate-150 dark:border-slate-850 pb-5">
                <div className="text-xs uppercase font-extrabold tracking-wider text-indigo-500 mb-2">
                  Intern Metrics
                </div>
                <h3 className="text-xl font-black capitalize text-slate-800 dark:text-white mb-1">
                  {selectedIntern.name}
                </h3>
                <div className="text-xs text-slate-450 dark:text-slate-400 break-all">
                  {selectedIntern.email}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  {STATUS_ICONS[selectedIntern.status]}
                  <span className="text-sm font-extrabold select-none capitalize">
                    {selectedIntern.status} Status
                  </span>
                </div>
              </div>

              {/* Grid Statistics */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/50 dark:border-slate-850">
                  <div className="text-[10px] uppercase font-bold text-slate-400">
                    Attendance
                  </div>
                  <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-1">
                    {selectedIntern.attendancePercentage}%
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    {selectedIntern.presentDays} of{' '}
                    {selectedIntern.totalAttendance} checks
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/50 dark:border-slate-850">
                  <div className="text-[10px] uppercase font-bold text-slate-400">
                    Avg Rating
                  </div>
                  <div className="text-lg font-black text-amber-500 mt-1">
                    {selectedIntern.avgRating || '—'}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1">
                    Trend:
                    {selectedIntern.ratingTrend === 'UP' && (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    )}
                    {selectedIntern.ratingTrend === 'DOWN' && (
                      <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                    )}
                    <span className="font-extrabold text-[9px] text-slate-600 dark:text-slate-400">
                      {selectedIntern.ratingTrend}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rating History LineChart */}
              {selectedIntern.ratingsHistory &&
                selectedIntern.ratingsHistory.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-3">
                      Rating Progression
                    </h4>
                    <div className="h-40 bg-slate-50 dark:bg-slate-950 rounded-2xl p-2 border border-slate-200/30 dark:border-slate-850">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={selectedIntern.ratingsHistory}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            strokeOpacity={0.1}
                          />
                          <XAxis
                            dataKey="date"
                            stroke="#64748b"
                            fontSize={8}
                            tickLine={false}
                            tickFormatter={(str) => {
                              if (!str) return '';
                              // Slice to MM-DD
                              return str.split('-').slice(1).join('/');
                            }}
                          />
                          <YAxis
                            domain={[1, 5]}
                            ticks={[1, 2, 3, 4, 5]}
                            stroke="#64748b"
                            fontSize={8}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              background: '#0f172a',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '10px',
                            }}
                            labelStyle={{ color: '#fff' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="#6366f1"
                            strokeWidth={2.5}
                            dot={{ r: 3.5, strokeWidth: 1.5 }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

              {/* Tabs for Details */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    Attendance Logs
                  </h4>
                  <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1">
                    {selectedIntern.attendanceHistory &&
                    selectedIntern.attendanceHistory.length > 0 ? (
                      selectedIntern.attendanceHistory.map((att, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-850"
                        >
                          <span className="font-extrabold text-slate-650">
                            {new Date(att.date).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>

                          <div className="flex items-center gap-2">
                            {att.status.toUpperCase() === 'PRESENT' ? (
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-500 font-black px-2 py-0.5 rounded-md">
                                PRESENT
                              </span>
                            ) : (
                              <span className="text-[10px] bg-rose-500/10 text-rose-500 font-black px-2 py-0.5 rounded-md">
                                ABSENT
                              </span>
                            )}
                            {att.arrivalTime && (
                              <span className="text-[10px] text-slate-450 dark:text-slate-450 italic mt-0.5">
                                at {att.arrivalTime.slice(0, 5)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-450 text-center py-4 bg-slate-50 dark:bg-slate-950 rounded-2xl">
                        No logs recorded.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                    Supervisor Remarks
                  </h4>
                  <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1">
                    {selectedIntern.ratingsHistory &&
                    selectedIntern.ratingsHistory.length > 0 ? (
                      selectedIntern.ratingsHistory
                        .slice()
                        .reverse()
                        .map((rating, idx) => (
                          <div
                            key={idx}
                            className="text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-850"
                          >
                            <div className="flex justify-between items-start gap-1 pb-1.5 border-b border-slate-200/20 dark:border-slate-850 mb-1.5">
                              <span className="font-extrabold text-slate-650">
                                {new Date(rating.date).toLocaleDateString(
                                  'en-GB',
                                  { day: '2-digit', month: 'short' }
                                )}
                              </span>
                              <span className="font-black text-amber-500 flex items-center gap-0.5 text-[10px]">
                                ★ {rating.score}/5
                              </span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 italic text-[11px] leading-relaxed">
                              "{rating.remarks || 'No remarks left.'}"
                            </p>
                          </div>
                        ))
                    ) : (
                      <div className="text-xs text-slate-450 text-center py-4 bg-slate-50 dark:bg-slate-950 rounded-2xl">
                        No remarks recorded.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="border border-dashed border-slate-300 dark:border-slate-700 bg-transparent p-12 text-center text-slate-400">
              <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              Click on an intern row in the table to display metrics and
              performance history details.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
