import React, { useState, useMemo } from 'react';
import {
  Bell,
  AlertTriangle,
  Info,
  CheckCircle2,
  Inbox,
  Sparkles,
  Filter,
} from 'lucide-react';

/**
 * Initial sample notice objects covering high, medium, and low priorities.
 */
export const SAMPLE_NOTICES = [
  {
    id: 'notice-1',
    title: 'Portal Downtime',
    content: 'Portal downtime scheduled tonight 11 PM - 1 AM',
    priority: 'high',
    createdAt: 'Today, 11:00 PM',
  },
  {
    id: 'notice-2',
    title: 'Timesheet Reminder',
    content: 'Submit pending timesheets by EOD or risk stipend delay',
    priority: 'high',
    createdAt: 'Today, 05:00 PM',
  },
  {
    id: 'notice-3',
    title: 'Onboarding Update',
    content: 'New onboarding document uploaded — please review',
    priority: 'medium',
    createdAt: 'Yesterday, 02:00 PM',
  },
  {
    id: 'notice-4',
    title: 'Weekly Sync',
    content: 'Weekly sync moved to 4 PM Friday',
    priority: 'medium',
    createdAt: 'Yesterday, 10:30 AM',
  },
  {
    id: 'notice-5',
    title: 'Referral Program',
    content: 'Referral program now open for interns',
    priority: 'low',
    createdAt: 'Aug 23, 2026',
  },
  {
    id: 'notice-6',
    title: 'Merch Store',
    content: 'New merch store live on the portal',
    priority: 'low',
    createdAt: 'Aug 22, 2026',
  },
];

/**
 * Priority ordering map (High -> Medium -> Low)
 */
const PRIORITY_ORDER = {
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Priority style configuration adhering to dark glassmorphism theme
 */
const PRIORITY_CONFIG = {
  high: {
    label: 'HIGH',
    badgeLabel: 'URGENT',
    leftBorderColor: '#ef4444',
    badgeBg: 'rgba(239, 68, 68, 0.15)',
    badgeTextColor: '#ef4444',
    badgeBorderColor: 'rgba(239, 68, 68, 0.3)',
    Icon: AlertTriangle,
  },
  medium: {
    label: 'MEDIUM',
    badgeLabel: 'MEDIUM',
    leftBorderColor: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    badgeTextColor: '#f59e0b',
    badgeBorderColor: 'rgba(245, 158, 11, 0.3)',
    Icon: Info,
  },
  low: {
    label: 'LOW',
    badgeLabel: 'LOW',
    leftBorderColor: '#22c55e',
    badgeBg: 'rgba(34, 197, 94, 0.15)',
    badgeTextColor: '#22c55e',
    badgeBorderColor: 'rgba(34, 197, 94, 0.3)',
    Icon: CheckCircle2,
  },
};

export default function NoticeBoard({ initialNotices = SAMPLE_NOTICES }) {
  const [notices, setNotices] = useState(initialNotices);
  const [activeFilter, setActiveFilter] = useState('ALL');

  // Client-side sorting: High (1) -> Medium (2) -> Low (3)
  const sortedNotices = useMemo(() => {
    return [...notices].sort((a, b) => {
      const pA = PRIORITY_ORDER[a.priority?.toLowerCase()] ?? 99;
      const pB = PRIORITY_ORDER[b.priority?.toLowerCase()] ?? 99;
      return pA - pB;
    });
  }, [notices]);

  // Priority filtering (if user clicks filter pills)
  const filteredNotices = useMemo(() => {
    if (activeFilter === 'ALL') return sortedNotices;
    return sortedNotices.filter(
      (n) => n.priority?.toLowerCase() === activeFilter.toLowerCase()
    );
  }, [sortedNotices, activeFilter]);

  const clearAllNotices = () => setNotices([]);
  const resetNotices = () => setNotices(initialNotices);

  return (
    <div className="flex h-[560px] w-full min-h-0 flex-col gap-4">
      {/* Notice Board Sub-Header / Quick Filter Bar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-slate-300">
          <Filter className="w-3.5 h-3.5 text-indigo-400" />
          <span>Filter:</span>
          {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => setActiveFilter(filterKey)}
              className={`px-2 py-0.5 rounded-md font-semibold transition ${
                activeFilter === filterKey
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {filterKey}
            </button>
          ))}
        </div>

        {/* Local state action controls (Reset / Clear for testing state) */}
        <div className="flex items-center gap-2">
          {notices.length === 0 ? (
            <button
              onClick={resetNotices}
              className="text-[11px] text-indigo-300 hover:text-indigo-200 underline cursor-pointer"
            >
              Reset Samples
            </button>
          ) : (
            <button
              onClick={clearAllNotices}
              className="text-[11px] text-slate-400 hover:text-red-400 transition cursor-pointer"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Main List / Empty State */}
      {notices.length === 0 || filteredNotices.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-10 text-center backdrop-blur-md">
          <Inbox className="w-10 h-10 text-slate-500 mb-2 stroke-[1.5]" />
          <p className="text-sm font-semibold text-slate-300">
            No active notices.
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            {notices.length === 0
              ? 'There are currently no announcements to display.'
              : `No notices found with "${activeFilter}" priority.`}
          </p>
          {notices.length === 0 && (
            <button
              onClick={resetNotices}
              className="mt-4 px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold transition"
            >
              Load Sample Notices
            </button>
          )}
        </div>
      ) : (
        <div className="notice-scrollbar min-h-0 flex-1 space-y-3.5 overflow-y-auto pr-2">
          {filteredNotices.map((notice) => {
            const priorityKey = (notice.priority || 'low').toLowerCase();
            const config = PRIORITY_CONFIG[priorityKey] || PRIORITY_CONFIG.low;
            const {
              badgeLabel,
              leftBorderColor,
              badgeBg,
              badgeTextColor,
              badgeBorderColor,
              Icon,
            } = config;

            return (
              <div
                key={notice.id}
                style={{ borderLeftColor: leftBorderColor }}
                className="group relative rounded-xl border-l-[4px] border-t border-r border-b border-white/10 bg-white/[0.06] hover:bg-white/[0.09] backdrop-blur-md p-4 transition-all duration-200 shadow-lg hover:shadow-indigo-500/5"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: Notice Title & Priority Icon */}
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon
                      className="w-4 h-4 shrink-0"
                      style={{ color: badgeTextColor }}
                    />
                    <h3 className="text-sm font-bold text-white tracking-wide truncate">
                      {notice.title}
                    </h3>
                  </div>

                  {/* Right: Priority Badge Pill */}
                  <div
                    style={{
                      backgroundColor: badgeBg,
                      color: badgeTextColor,
                      borderColor: badgeBorderColor,
                    }}
                    className="shrink-0 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border shadow-sm tracking-wider"
                  >
                    <span>{badgeLabel}</span>
                  </div>
                </div>

                {/* Notice Content Body */}
                <p className="text-xs text-slate-200 mt-2 leading-relaxed font-medium">
                  {notice.content}
                </p>

                {/* Footer Timestamp */}
                {notice.createdAt && (
                  <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{notice.createdAt}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-300 font-semibold">
                      InternOps Notice
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
