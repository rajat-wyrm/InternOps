import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useAuthStore from '../../store/auth';

const pulse = 'animate-pulse bg-slate-200 dark:bg-slate-700/80';
const SKELETON_SLOW_MS = 2500;
const PULSE_CYCLE_MS = 2000;
const routeLoadingStartedAt = new Map();
const shell =
  'border border-slate-200/90 dark:border-slate-700 bg-gradient-to-br from-white via-white to-slate-50/80 dark:bg-none dark:bg-slate-900';
function Block({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`${pulse} rounded-xl ${className}`}
      style={{ animationDelay: 'var(--skeleton-pulse-delay, 0ms)' }}
    />
  );
}
function Card({ children, className = '' }) {
  return (
    <div
      className={`${shell} relative overflow-hidden rounded-3xl ${className}`}
    >
      {children}
    </div>
  );
}
function PageHeading({ action = false, compact = false }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        {!compact && <Block className="h-12 w-12 shrink-0 rounded-2xl" />}
        <div className="space-y-2">
          <Block className="h-3 w-28" />
          <Block
            className={`${compact ? 'h-12 w-96 max-w-[72vw]' : 'h-8 w-56'}`}
          />
          <Block className="h-4 w-[34rem] max-w-[76vw]" />
        </div>
      </div>
      {action && (
        <div className="flex gap-2">
          <Block className="h-11 w-32" />
          <Block className="h-11 w-36" />
        </div>
      )}
    </div>
  );
}
function Lines({ count = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <Block key={i} className={`h-4 ${i % 4 === 2 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}
function DashboardStatSkeleton({ variant }) {
  const withBreakdown = variant === 'team';
  const withCaption = variant === 'rating' || variant === 'intern-present';

  return (
    <Card className="min-h-[220px] p-6">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-slate-200/60 dark:bg-slate-700/50" />
      <div className="relative z-10 flex h-full items-start justify-between gap-4">
        <div className="min-w-0 flex-1 pt-6">
          <Block
            className={`h-11 rounded-xl ${
              variant === 'attendance'
                ? 'w-24'
                : variant === 'rating'
                  ? 'w-20'
                  : 'w-16'
            }`}
          />
          <Block className="mt-2 h-4 w-32 rounded-lg" />
          {withBreakdown && (
            <div className="mt-2 space-y-1.5">
              <Block className="h-3 w-28 rounded-md" />
              <Block className="h-3 w-40 max-w-full rounded-md" />
            </div>
          )}
          {withCaption && <Block className="mt-1.5 h-3 w-20 rounded-md" />}
        </div>
        <Block className="h-14 w-14 shrink-0 rounded-2xl" />
      </div>
    </Card>
  );
}

function DashboardHeading() {
  return (
    <div className="mb-7">
      <Block className="mb-2 h-4 w-40 rounded-md" />
      <Block className="h-10 w-[26rem] max-w-[72vw] rounded-xl md:h-14" />
      <Block className="mt-2 h-4 w-[34rem] max-w-2xl rounded-lg md:h-5" />
    </div>
  );
}

function AttentionRows({ intern }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: intern ? 4 : 5 }, (_, index) => (
        <div
          key={index}
          className="flex min-h-[48px] items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-700"
        >
          <Block className="h-4 w-36 rounded-md sm:w-44" />
          <Block className="h-4 w-10 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function QuickActionsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="flex min-h-[102px] items-center gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700"
        >
          <Block className="h-10 w-10 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Block className="h-4 w-32 max-w-full rounded-md" />
            <Block className="h-3 w-28 max-w-full rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardPanelHeader({ action = false, intern = false }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-700">
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          {!action && <Block className="h-5 w-5 shrink-0 rounded-md" />}
          <Block className="h-6 w-44 rounded-lg" />
        </div>
        <Block
          className={`h-4 max-w-full rounded-lg ${intern ? 'w-72' : 'w-80'}`}
        />
      </div>
      {action && <Block className="h-4 w-28 shrink-0 rounded-md" />}
    </div>
  );
}

function Dashboard({ intern }) {
  return (
    <>
      <DashboardHeading />
      <div
        className={`mb-6 grid grid-cols-2 gap-4 ${
          intern ? 'md:grid-cols-3' : 'md:grid-cols-4'
        }`}
      >
        {intern ? (
          <>
            <DashboardStatSkeleton variant="intern-present" />
            <DashboardStatSkeleton variant="rating" />
            <DashboardStatSkeleton variant="active" />
          </>
        ) : (
          <>
            <DashboardStatSkeleton variant="team" />
            <DashboardStatSkeleton variant="active" />
            <DashboardStatSkeleton variant="attendance" />
            <DashboardStatSkeleton variant="rating" />
          </>
        )}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="min-h-[340px] p-6 md:p-7">
          <DashboardPanelHeader action={!intern} intern={intern} />
          <AttentionRows intern={intern} />
        </Card>
        <Card className="min-h-[340px] p-6 md:p-7">
          <DashboardPanelHeader intern={intern} />
          <QuickActionsSkeleton />
        </Card>
      </div>
    </>
  );
}

function Header({ actions = 1 }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <Block className="h-12 w-12 rounded-2xl" />
        <div className="space-y-2">
          <Block className="h-3 w-24" />
          <Block className="h-8 w-56" />
          <Block className="h-4 w-80 max-w-[70vw]" />
        </div>
      </div>
      {actions > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Block key={i} className="h-11 w-36" />
          ))}
        </div>
      )}
    </div>
  );
}
function TableShape({ cols = 5, rows = 6 }) {
  return (
    <Card>
      <div
        className="grid h-14 gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800"
        style={{ gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` }}
      >
        {Array.from({ length: cols }, (_, i) => (
          <Block key={i} className="h-4" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="grid min-h-16 gap-3 border-b border-slate-100 px-5 py-4 last:border-0 dark:border-slate-800"
          style={{ gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` }}
        >
          {Array.from({ length: cols }, (_, c) => (
            <Block key={c} className={c === 0 ? 'h-8' : 'h-4 self-center'} />
          ))}
        </div>
      ))}
    </Card>
  );
}
function Context() {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-indigo-500/20 bg-indigo-950 p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex gap-3">
        <Block className="h-10 w-10 rounded-2xl" />
        <div className="space-y-2">
          <Block className="h-3 w-36" />
          <Block className="h-5 w-32" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Block key={i} className="h-9 w-24" />
        ))}
      </div>
    </div>
  );
}
function TeamHeaderSkeleton() {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <Block className="h-12 w-12 shrink-0 rounded-2xl" />
        <div className="space-y-2">
          <Block className="h-9 w-40 rounded-lg" />
          <Block className="h-4 w-80 max-w-[70vw] rounded-lg" />
        </div>
      </div>
      <div className="flex items-center gap-2 sm:-translate-y-3">
        <div className="flex h-[45px] w-[124px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
          <Block className="h-full w-1/2 rounded-none" />
          <div className="h-full w-1/2 bg-slate-100 dark:bg-slate-800" />
        </div>
        <Block className="h-[41px] w-36 rounded-2xl" />
        <Block className="h-[41px] w-36 rounded-2xl" />
      </div>
    </div>
  );
}

function TeamStatSkeleton({ variant }) {
  const hasBreakdown = variant === 'members';
  const hasCaption = variant === 'rating' || variant === 'proofs';
  return (
    <Card className="min-h-[190px] p-5">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-slate-200/70 dark:bg-slate-700/70" />
      <div className="relative z-10 flex h-full min-h-[150px] w-full flex-col justify-center">
        <Block
          className={`h-10 rounded-xl ${variant === 'attendance' ? 'w-24' : variant === 'rating' ? 'w-20' : 'w-16'}`}
        />
        <Block className="mt-2 h-4 w-28 rounded-lg" />
        <div className="mt-0.5 min-h-[42px]">
          {hasBreakdown && (
            <div className="space-y-1.5 pt-1">
              <Block className="h-3 w-28 rounded-md" />
              <Block className="h-3 w-40 max-w-full rounded-md" />
            </div>
          )}
          {hasCaption && <Block className="mt-1.5 h-3 w-24 rounded-md" />}
        </div>
      </div>
    </Card>
  );
}

const teamColumns = '260px 8% 9% 10% 10% 11% 12% 7% 150px 10%';
function TeamTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <div className="min-w-[1360px]">
          <div
            className="grid min-h-14 items-center border-b border-slate-200 bg-[#f8fafc] px-3 dark:border-slate-700 dark:bg-[#172033]"
            style={{ gridTemplateColumns: teamColumns }}
          >
            {Array.from({ length: 10 }, (_, index) => (
              <Block
                key={index}
                className={`h-4 rounded-md ${index === 0 ? 'w-28' : 'mx-auto w-16'}`}
              />
            ))}
          </div>
          {Array.from({ length: 5 }, (_, row) => (
            <div
              key={row}
              className={`grid min-h-[96px] items-center border-b border-slate-100 px-3 last:border-0 dark:border-slate-700 ${row % 2 === 0 ? 'bg-white dark:bg-[#1e293b]' : 'bg-[#f8fafc] dark:bg-slate-800/35'}`}
              style={{ gridTemplateColumns: teamColumns }}
            >
              <div className="flex items-center gap-3">
                <Block className="h-10 w-10 shrink-0 rounded-2xl" />
                <div className="space-y-2">
                  <Block className="h-4 w-32 rounded-md" />
                  <Block className="h-3 w-40 rounded-md" />
                </div>
              </div>
              <Block className="mx-auto h-6 w-16 rounded-full" />
              <Block className="mx-auto h-4 w-20 rounded-md" />
              <Block className="mx-auto h-4 w-24 rounded-md" />
              <Block className="mx-auto h-4 w-20 rounded-md" />
              <div className="mx-auto flex w-28 items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full w-2/3 bg-slate-300 dark:bg-slate-600" />
                </div>
                <Block className="h-3 w-8 rounded-md" />
              </div>
              <div className="mx-auto flex items-center gap-2">
                <Block className="h-4 w-5 rounded-md" />
                <Block className="h-6 w-16 rounded-full" />
              </div>
              <Block className="mx-auto h-4 w-10 rounded-md" />
              <Block className="mx-auto h-6 w-20 rounded-full" />
              <Block className="mx-auto h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Team() {
  return (
    <div className="pt-[22px]">
      <TeamHeaderSkeleton />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <TeamStatSkeleton variant="members" />
        <TeamStatSkeleton variant="active" />
        <TeamStatSkeleton variant="attendance" />
        <TeamStatSkeleton variant="rating" />
        <TeamStatSkeleton variant="proofs" />
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Block className="h-[51px] min-w-[240px] flex-1 rounded-2xl" />
        <Block className="h-[51px] w-full rounded-2xl sm:w-52" />
        <Block className="h-[51px] w-full rounded-2xl sm:w-36" />
        <Block className="h-[51px] w-full rounded-2xl sm:w-36" />
        <Block className="h-[51px] w-full rounded-2xl sm:w-36" />
        <Block className="h-[51px] w-full rounded-2xl sm:w-40" />
      </div>
      <TeamTableSkeleton />
    </div>
  );
}
function Attendance({ department = false, project = false }) {
  return (
    <>
      {department && <Context />}
      {!project && <Header actions={0} />}
      <Card className="mb-5 p-5 md:p-6">
        <Block className="mb-3 h-3 w-40" />
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Block className="h-11 w-full sm:max-w-sm" />
          <Block className="h-11 w-32" />
        </div>
      </Card>
      <TableShape cols={3} rows={5} />
    </>
  );
}
function Ratings({ department = false, project = false }) {
  return (
    <>
      {department && <Context />}
      {!project && <Header actions={0} />}
      <Card className="mb-6 p-6 md:p-7">
        <div className="mb-6 flex justify-between border-b border-slate-200 pb-4 dark:border-slate-700">
          <div className="space-y-2">
            <Block className="h-7 w-56" />
            <Block className="h-4 w-96 max-w-full" />
          </div>
          <Block className="h-20 w-44" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_12rem]">
          <Block className="h-12" />
          {!project && <Block className="h-12" />}
          <Block className="h-12" />
        </div>
      </Card>
      <Card className="min-h-56 p-8">
        <Lines count={5} />
      </Card>
    </>
  );
}
function Tasks({ department = false }) {
  return (
    <>
      {department && <Context />}
      <Header />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="min-h-[230px] p-5 md:p-6">
            <div className="flex gap-4">
              <Block className="h-12 w-12 rounded-2xl" />
              <div className="flex-1">
                <Lines count={4} />
              </div>
            </div>
            <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
              <Block className="h-10 w-40" />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
function Meetings() {
  return (
    <>
      <Header actions={2} />
      <div className="grid gap-5 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="min-h-56 p-5 md:p-6">
            <div className="flex gap-3">
              <Block className="h-12 w-12 rounded-2xl" />
              <div className="flex-1">
                <Lines count={3} />
              </div>
            </div>
            <Block className="mt-5 h-20 w-full rounded-2xl" />
            <Block className="mt-4 h-4 w-40" />
          </Card>
        ))}
      </div>
    </>
  );
}
function HRStatSkeleton({ index }) {
  const numberWidths = ['w-16', 'w-16', 'w-10', 'w-14', 'w-10', 'w-10'];
  const labelWidths = ['w-24', 'w-16', 'w-28', 'w-32', 'w-36', 'w-28'];
  return (
    <Card className="p-6 min-h-[174px]">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-slate-200/60 dark:bg-slate-700/50" />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="pt-6">
          <Block className={`h-10 ${numberWidths[index]} rounded-xl`} />
          <Block className={`mt-2 h-4 ${labelWidths[index]} rounded-lg`} />
        </div>
        <Block className="h-14 w-14 shrink-0 rounded-2xl" />
      </div>
    </Card>
  );
}
function HRBreakdownSkeleton({ milestones = false }) {
  return (
    <Card className="min-h-[330px] p-6">
      <div className="mb-7 flex items-center gap-3">
        <Block className="h-10 w-10 rounded-xl" />
        <Block className="h-6 w-36 rounded-lg" />
      </div>
      <div className="space-y-5">
        {Array.from({ length: milestones ? 3 : 4 }, (_, index) =>
          milestones ? (
            <div
              key={index}
              className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700"
            >
              <Block className="h-4 w-36 rounded-md" />
              <Block className="mt-2 h-3 w-56 max-w-full rounded-md" />
            </div>
          ) : (
            <div key={index}>
              <div className="mb-2 flex justify-between">
                <Block className="h-4 w-28 rounded-md" />
                <Block className="h-4 w-8 rounded-md" />
              </div>
              <Block className="h-2 w-full rounded-full" />
            </div>
          )
        )}
      </div>
    </Card>
  );
}
function HRSkeleton() {
  return (
    <div className="space-y-6 pt-[9px]">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Block className="h-12 w-12 shrink-0 rounded-2xl" />
          <div className="space-y-2">
            <Block className="h-9 w-64 rounded-lg" />
            <Block className="h-5 w-[28rem] max-w-[70vw] rounded-lg" />
          </div>
        </div>
        <Block className="relative -top-[19px] h-11 w-36 rounded-2xl" />
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <HRStatSkeleton key={index} index={index} />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <HRBreakdownSkeleton />
        <HRBreakdownSkeleton />
        <HRBreakdownSkeleton milestones />
      </div>
      <div className="flex flex-wrap gap-3">
        <Block className="h-12 min-w-[260px] flex-1 rounded-2xl" />
        <Block className="h-12 w-full rounded-2xl sm:w-48" />
        <Block className="h-12 w-full rounded-2xl sm:w-56" />
      </div>
      <TableShape cols={8} rows={5} />
    </div>
  );
}
function Analytics() {
  return (
    <div className="space-y-6">
      <Header actions={0} />
      <Card className="flex gap-4 p-4">
        <Block className="h-12 min-w-60 flex-1" />
        <Block className="h-12 w-48" />
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="h-28 p-5">
            <Lines count={3} />
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:h-[520px] lg:grid-cols-2">
        <Card className="min-h-[420px] p-6">
          <Lines count={8} />
        </Card>
        <Card className="min-h-[420px] p-6">
          <Lines count={10} />
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} className="min-h-72 p-6">
            <Lines count={7} />
          </Card>
        ))}
      </div>
      <Card className="min-h-80 p-6">
        <TableShape cols={6} rows={4} />
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-h-64 p-6">
          <Lines count={6} />
        </Card>
        <Card className="min-h-64 p-6">
          <Lines count={6} />
        </Card>
      </div>
      <Card className="p-6">
        <div className="mb-5 flex justify-end gap-4">
          <Block className="h-12 w-48" />
          <Block className="h-12 w-40" />
        </div>
        <TableShape cols={4} rows={5} />
      </Card>
    </div>
  );
}
function TaskDetails() {
  return (
    <div className="space-y-7">
      <div className="flex justify-between">
        <Block className="h-11 w-36" />
        <Block className="h-8 w-48" />
      </div>
      <Card className="min-h-52 p-8">
        <div className="flex gap-4">
          <Block className="h-14 w-14 rounded-3xl" />
          <div className="flex-1">
            <Lines count={5} />
          </div>
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Card key={i} className="h-36 p-5">
            <Lines count={3} />
          </Card>
        ))}
      </div>
      <Card className="min-h-72 p-7">
        <Lines count={7} />
      </Card>
      <Card className="p-7">
        <div className="mb-6 flex gap-3">
          <Block className="h-11 min-w-60 flex-1" />
          <Block className="h-11 w-56" />
          <Block className="h-11 w-56" />
        </div>
        <TableShape cols={6} />
      </Card>
    </div>
  );
}
function FormPage({ tabs = false }) {
  return (
    <>
      <Header actions={0} />
      {tabs && (
        <div className="mb-6 flex flex-wrap gap-2">
          {Array.from({ length: 9 }, (_, i) => (
            <Block key={i} className="h-9 w-28" />
          ))}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="min-h-[650px] p-6 lg:col-span-2">
          <Lines count={12} />
        </Card>
        <Card className="min-h-[650px] p-6 lg:col-span-3">
          <Lines count={8} />
        </Card>
      </div>
    </>
  );
}
function Generic({ cols = 5 }) {
  return (
    <>
      <Header />
      <Card className="mb-6 p-4">
        <Block className="h-12 w-full" />
      </Card>
      <TableShape cols={cols} />
    </>
  );
}

function ReportsSkeleton() {
  return (
    <>
      <PageHeading compact />
      <Card className="mb-5 flex flex-wrap gap-4 p-4">
        <Block className="h-12 w-56" />
        <Block className="h-12 w-56" />
      </Card>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card className="min-h-72 p-5">
          <Lines count={7} />
        </Card>
        <Card className="min-h-72 p-5">
          <Lines count={7} />
        </Card>
        <Card className="min-h-64 p-5 md:col-span-2">
          <Lines count={6} />
        </Card>
      </div>
    </>
  );
}
function TemplatesSkeleton() {
  return (
    <>
      <PageHeading action compact />
      <Card className="mb-5 p-4">
        <Lines count={3} />
      </Card>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="min-h-60 p-5">
            <Lines count={8} />
          </Card>
        ))}
      </div>
    </>
  );
}
function NotificationsSkeleton() {
  return (
    <>
      <Header actions={2} />
      <div className="space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i} className="min-h-28 p-5">
            <div className="flex gap-4">
              <Block className="h-11 w-11" />
              <div className="flex-1">
                <Lines count={3} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
function SessionsSkeleton() {
  return (
    <>
      <PageHeading action compact />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="h-28 p-4">
            <div className="flex gap-3">
              <Block className="h-11 w-11" />
              <div className="flex-1">
                <Lines count={3} />
              </div>
              <Block className="h-10 w-24" />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
function ProfileSkeleton() {
  return (
    <>
      <div className="mb-5 flex items-center gap-3">
        <Block className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="space-y-2">
          <Block className="h-7 w-32 rounded-lg" />
          <Block className="h-4 w-64 max-w-[70vw] rounded-lg" />
        </div>
      </div>
      <Card className="mb-5 p-4 md:p-5">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
            <div className="w-32 shrink-0">
              <Block className="mx-auto h-24 w-24 rounded-3xl" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Block className="h-9 w-48 rounded-lg" />
                <Block className="h-6 w-20 rounded-full" />
                <Block className="h-6 w-16 rounded-full" />
              </div>
              <Block className="h-5 w-64 max-w-full rounded-lg" />
              <Block className="mt-4 h-4 w-[34rem] max-w-full rounded-lg" />
              <Block className="mt-2 h-4 w-80 max-w-full rounded-lg" />
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:w-[500px]">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="flex min-h-[70px] items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <Block className="mt-0.5 h-4 w-4 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Block className="h-3 w-20 rounded-md" />
                  <Block className="h-4 w-28 max-w-full rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex h-full flex-col gap-5">
          <Card className="p-5 md:p-6">
            <div className="mb-4 flex items-center gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
              <Block className="h-11 w-11 shrink-0 rounded-2xl" />
              <div className="space-y-2">
                <Block className="h-5 w-44 rounded-lg" />
                <Block className="h-4 w-40 rounded-lg" />
              </div>
            </div>
            <div className="space-y-4">
              {Array.from({ length: 2 }, (_, index) => (
                <div key={index} className="space-y-2">
                  <Block className="h-3 w-24 rounded-md" />
                  <Block className="h-12 w-full rounded-2xl" />
                </div>
              ))}
              <Block className="h-10 w-32 rounded-xl" />
            </div>
          </Card>
          <Card className="mt-auto p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Block className="h-11 w-11 shrink-0 rounded-2xl" />
                <div className="space-y-2">
                  <Block className="h-5 w-32 rounded-lg" />
                  <Block className="h-4 w-48 max-w-[45vw] rounded-lg" />
                </div>
              </div>
              <Block className="h-5 w-20 shrink-0 rounded-lg" />
            </div>
          </Card>
        </div>
        <Card className="p-5 md:p-6">
          <div className="mb-4 flex items-center gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
            <Block className="h-11 w-11 shrink-0 rounded-2xl" />
            <div className="space-y-2">
              <Block className="h-5 w-48 rounded-lg" />
              <Block className="h-4 w-64 max-w-[55vw] rounded-lg" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Block className="h-3 w-32 rounded-md" />
              <Block className="h-12 w-full rounded-2xl" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 2 }, (_, index) => (
                <div key={index} className="space-y-2">
                  <Block className="h-3 w-36 rounded-md" />
                  <Block className="h-12 w-full rounded-2xl" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60 sm:grid-cols-2">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Block className="h-3.5 w-3.5 shrink-0 rounded-full" />
                  <Block className="h-3 w-32 rounded-md" />
                </div>
              ))}
            </div>
            <Block className="h-10 w-40 rounded-xl" />
          </div>
        </Card>
      </div>
    </>
  );
}
function InternOpsSkeleton() {
  return (
    <>
      <PageHeading compact />
      <div className="mb-7 grid gap-6 lg:grid-cols-3">
        <Card className="h-32 p-5 lg:col-span-2">
          <Lines count={4} />
        </Card>
        <Card className="h-32 p-5">
          <Lines count={4} />
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TableShape cols={5} rows={7} />
        </div>
        <Card className="min-h-96 p-6">
          <Lines count={10} />
        </Card>
      </div>
    </>
  );
}

export function routeKind(path) {
  if (/^\/(?:admin\/)?tasks\/[^/]+$/.test(path)) return 'task-detail';
  if (/^\/departments\/[^/]+\/projects\/[^/]+$/.test(path))
    return 'project-detail';
  if (/^\/departments\/[^/]+\/projects$/.test(path))
    return 'department-projects';
  if (/^\/admin\/departments\/[^/]+\/attendance$/.test(path))
    return 'department-attendance';
  if (/^\/admin\/departments\/[^/]+\/ratings$/.test(path))
    return 'department-ratings';
  if (/^\/admin\/departments\/[^/]+\/tasks$/.test(path))
    return 'department-tasks';
  return path.split('/')[1] || 'dashboard';
}
export default function RouteRefreshSkeleton() {
  const { pathname } = useLocation();
  const role = useAuthStore((s) => s.user?.role);
  const startedAt = routeLoadingStartedAt.get(pathname) ?? Date.now();
  if (!routeLoadingStartedAt.has(pathname)) {
    routeLoadingStartedAt.set(pathname, startedAt);
  }
  const elapsed = Date.now() - startedAt;
  const [slow, setSlow] = useState(elapsed >= SKELETON_SLOW_MS);
  useEffect(() => {
    const remaining = Math.max(0, SKELETON_SLOW_MS - (Date.now() - startedAt));
    if (remaining === 0) {
      setSlow(true);
      return undefined;
    }
    const id = window.setTimeout(() => setSlow(true), remaining);
    return () => window.clearTimeout(id);
  }, [startedAt]);
  const [pulseDelay] = useState(
    () => -((Date.now() - startedAt) % PULSE_CYCLE_MS)
  );

  const kind = routeKind(pathname);
  let body;
  if (kind === 'dashboard') body = <Dashboard intern={role === 'INTERN'} />;
  else if (kind === 'team') body = <Team />;
  else if (kind === 'attendance') body = <Attendance />;
  else if (kind === 'ratings') body = <Ratings />;
  else if (kind === 'tasks') body = <Tasks />;
  else if (kind === 'meetings') body = <Meetings />;
  else if (kind === 'hr') body = <HRSkeleton />;
  else if (kind === 'analytics') body = <Analytics />;
  else if (kind === 'reports') body = <ReportsSkeleton />;
  else if (kind === 'report-templates') body = <TemplatesSkeleton />;
  else if (kind === 'notifications') body = <NotificationsSkeleton />;
  else if (kind === 'sessions') body = <SessionsSkeleton />;
  else if (kind === 'profile') body = <ProfileSkeleton />;
  else if (kind === 'internops') body = <InternOpsSkeleton />;
  else if (kind === 'department-attendance') body = <Attendance department />;
  else if (kind === 'department-ratings') body = <Ratings department />;
  else if (kind === 'department-tasks') body = <Tasks department />;
  else if (kind === 'project-detail')
    body = (
      <>
        <Header actions={0} />
        <Attendance project />
      </>
    );
  else if (kind === 'department-projects')
    body = (
      <>
        <Header />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i} className="h-64 p-5">
              <Lines count={6} />
            </Card>
          ))}
        </div>
      </>
    );
  else if (kind === 'task-detail') body = <TaskDetails />;
  else if (kind === 'ai-certificates') body = <FormPage tabs />;
  else if (['quick-generate', 'bulk-generate'].includes(kind))
    body = <FormPage />;
  else if (kind === 'audit')
    body = (
      <>
        <Header actions={0} />
        <TableShape cols={5} rows={7} />
      </>
    );
  else if (kind === 'certificates') body = <Generic cols={6} />;
  else body = <Generic />;
  return (
    <section
      className="relative min-h-[calc(100vh-7rem)]"
      style={{ '--skeleton-pulse-delay': `${pulseDelay}ms` }}
      aria-label="Loading page content"
      data-testid={`refresh-skeleton-${kind}`}
    >
      {body}
      <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
        {slow ? 'This is taking longer than usual...' : 'Loading page...'}
      </p>
    </section>
  );
}
