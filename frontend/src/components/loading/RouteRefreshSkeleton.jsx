import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useAuthStore from '../../store/auth';

const pulse = 'animate-pulse bg-slate-200 dark:bg-slate-700/80';
const SKELETON_SLOW_MS = 2500;
const PULSE_CYCLE_MS = 2000;
const routeLoadingStartedAt = new Map();
const shell =
  'border border-slate-200/90 dark:border-slate-700 bg-gradient-to-br from-white via-white to-slate-50/80 dark:bg-none dark:bg-slate-900';
const statusWidths = ['w-[75px]', 'w-[65px]', 'w-[120px]', 'w-[100px]'];
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
    <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-indigo-500/20 bg-indigo-950 p-5 md:flex-row md:items-center md:justify-between">
      <div className="flex gap-3">
        <Block className="h-10 w-10 rounded-2xl" />
        <div className="space-y-2">
          <Block className="h-3 w-36" />
          <Block className="h-5 w-32" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Block className="h-8 w-24 rounded-xl" />
        <Block className="h-8 w-16 rounded-xl" />
        <Block className="h-8 w-16 rounded-xl" />
        <Block className="h-8 w-[136px] rounded-xl" />
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
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Block className="h-12 w-12 shrink-0 rounded-2xl" />
          <div className="space-y-2">
            <Block className="h-8 w-56 rounded-lg" />
            <Block className="h-4 w-64 max-w-[70vw] rounded-lg" />
          </div>
        </div>
        <Block className="-mt-2 h-9 w-32 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <Card key={index} className="h-[216px] self-start p-5 md:p-6">
            <div className="flex items-start gap-4">
              <Block className="h-12 w-12 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Block className="h-6 w-28 rounded-lg" />
                    <Block className="h-6 w-20 rounded-full" />
                    <Block className="h-6 w-16 rounded-full" />
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Block className="h-5 w-5 rounded-md" />
                    <Block className="h-5 w-5 rounded-md" />
                  </div>
                </div>
                <Block className="mt-3 h-4 w-40 rounded-lg" />
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Block className="h-4 w-4 rounded-md" />
                    <Block className="h-4 w-20 rounded-md" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Block className="h-4 w-4 rounded-full" />
                    <Block className="h-4 w-44 rounded-md" />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
              <Block className="h-10 w-40 rounded-2xl" />
              <Block className="h-10 w-32 rounded-2xl" />
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

function ExportsSkeleton() {
  return (
    <>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Block className="h-12 w-12 shrink-0 rounded-2xl" />
          <div>
            <Block className="mb-3 h-4 w-20 rounded-md" />
            <Block className="h-12 w-[260px] rounded-lg" />
            <Block className="mt-3 h-5 w-[480px] max-w-[72vw] rounded-md" />
          </div>
        </div>
      </div>

      <Card className="mb-7 h-[210px] border border-slate-200 p-6 dark:border-slate-700 md:p-7">
        <div className="mb-5 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Block className="h-11 w-11 shrink-0 rounded-2xl" />
            <div>
              <Block className="h-7 w-36 rounded-lg" />
              <Block className="mt-1 h-5 w-[340px] max-w-[68vw] rounded-md" />
            </div>
          </div>
          <Block className="h-8 w-[112px] rounded-full" />
        </div>
        <Block className="mb-2 h-4 w-[150px] rounded-md" />
        <Block className="h-[51px] w-full rounded-2xl" />
      </Card>

      <Card className="mb-7 h-[210px] border border-slate-200 p-6 dark:border-slate-700 md:p-7">
        <div className="mb-5 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Block className="h-11 w-11 shrink-0 rounded-2xl" />
            <div>
              <Block className="h-7 w-36 rounded-lg" />
              <Block className="mt-1 h-5 w-[410px] max-w-[68vw] rounded-md" />
            </div>
          </div>
          <Block className="h-8 w-[112px] rounded-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index}>
              <Block className="mb-2 h-4 w-14 rounded-md" />
              <Block className="h-[51px] w-full rounded-2xl" />
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card
            key={index}
            className="min-h-[260px] border border-slate-200 p-6 dark:border-slate-700 md:p-7"
          >
            <div className="flex h-full flex-col justify-between">
              <div>
                <Block className="mb-6 h-16 w-16 rounded-3xl" />
                <Block
                  className={`h-8 rounded-lg ${
                    index === 0
                      ? 'w-[210px]'
                      : index === 1
                        ? 'w-[170px]'
                        : 'w-[150px]'
                  }`}
                />
                <Block className="mt-2 h-5 w-[190px] rounded-md" />
              </div>
              <Block
                className={`mt-7 h-[42px] rounded-2xl ${
                  index === 2 ? 'w-[112px]' : 'w-[178px]'
                }`}
              />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
function ReportsSkeleton() {
  return (
    <>
      <div className="mb-7 flex items-center gap-4">
        <Block className="h-12 w-12 shrink-0 rounded-2xl" />
        <div>
          <Block className="h-10 w-[190px] rounded-lg" />
          <Block className="mt-2 h-5 w-[360px] max-w-[70vw] rounded-md" />
        </div>
      </div>

      <Card className="mb-5 flex flex-wrap items-end gap-4 p-4">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="w-full sm:w-56">
            <Block className="mb-2 h-4 w-14 rounded-md" />
            <Block className="h-[51px] w-full rounded-2xl" />
          </div>
        ))}
      </Card>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card className="p-5">
          <div className="mb-5 flex items-center gap-2">
            <Block className="h-5 w-5 shrink-0 rounded-md" />
            <Block className="h-6 w-48 rounded-md" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-700"
              >
                <div className="flex items-center gap-3">
                  <Block className="h-5 w-36 rounded-md" />
                  <Block className="h-7 w-24 rounded-full" />
                </div>
                <Block className="h-5 w-10 rounded-md" />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-5 flex items-center gap-2">
            <Block className="h-5 w-5 shrink-0 rounded-md" />
            <Block className="h-6 w-40 rounded-md" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-700"
              >
                <div className="space-y-1">
                  <Block className="h-5 w-36 rounded-md" />
                  <Block className="h-4 w-44 rounded-md" />
                </div>
                <div className="flex items-center gap-2">
                  <Block className="h-5 w-5 rounded-md" />
                  <Block className="h-5 w-24 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 md:col-span-2">
          <div className="mb-5 flex items-center gap-2">
            <Block className="h-5 w-5 shrink-0 rounded-md" />
            <Block className="h-6 w-44 rounded-md" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index}>
                <div className="mb-1 flex justify-between">
                  <Block className="h-5 w-48 rounded-md" />
                  <Block className="h-5 w-28 rounded-md" />
                </div>
                <Block className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
function TemplatesSkeleton() {
  const actionWidths = [
    'w-[82px]', // Preview
    'w-[96px]', // Generate
    'w-[64px]', // Edit
    'w-[84px]', // Versions
    'w-[116px]', // Save Version
    'w-[76px]', // Export
    'w-[76px]', // Delete
  ];
  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Block className="h-12 w-12 shrink-0 rounded-2xl" />
          <div>
            <Block className="h-10 w-[300px] max-w-[65vw] rounded-lg" />
            <Block className="mt-2 h-5 w-[420px] max-w-[70vw] rounded-md" />
          </div>
        </div>
        <div className="-mt-7 flex gap-2">
          <Block className="h-[37px] w-[140px] rounded-lg" />
          <Block className="h-[38px] w-[154px] rounded-lg" />
        </div>
      </div>

      <Card className="mb-5 h-[127px] p-4">
        <div className="flex h-full flex-col justify-center">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <Block className="h-6 w-40 rounded-md" />
              <Block className="mt-2 h-5 w-[350px] max-w-[70vw] rounded-md" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Block className="h-[37px] w-[80px] rounded-lg" />
            <Block className="h-[37px] w-[86px] rounded-lg" />
            <Block className="h-[37px] w-[97px] rounded-lg" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {Array.from({ length: 2 }, (_, cardIndex) => (
          <Card key={cardIndex} className="h-[261px] p-5">
            <div className="flex h-full flex-col justify-center">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Block className="h-7 w-36 rounded-md" />
                    <Block className="h-7 w-19 rounded-full" />
                  </div>
                  <Block className="mt-1 h-5 w-36 rounded-md" />
                </div>
              </div>
              <div className="mt-4">
                <Block className="mb-2 h-4 w-20 rounded-md" />
                <div className="flex flex-wrap gap-2">
                  {['w-[92px]', 'w-[112px]', 'w-[72px]', 'w-[68px]'].map(
                    (width) => (
                      <Block
                        key={width}
                        className={`h-7 ${width} rounded-full`}
                      />
                    )
                  )}
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {actionWidths.map((width) => (
                  <Block
                    key={width}
                    className={`h-[36px] ${width} rounded-lg`}
                  />
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function NoticeBlock({ className = '' }) {
  return (
    <Block className={`!animate-[pulse_2s_linear_infinite] ${className}`} />
  );
}
function DepartmentContextSkeleton() {
  return (
    <div className="mb-6 flex flex-col items-start justify-between gap-4 rounded-3xl border border-indigo-500/20 bg-gradient-to-r from-slate-900 to-indigo-950 p-4 md:flex-row md:items-center">
      {/* Department Context banner */}
      {/* Department identity */}
      <div className="h-12 flex items-center gap-3">
        {/* Department Context icon */}
        <Block className="h-10 w-10 shrink-0 rounded-2xl bg-indigo-500/20" />
        <div>
          {/* Context label and Admin Scope badge */}
          <div className="flex items-center gap-2">
            <Block className="h-4 w-36 rounded-md bg-indigo-500/20" />
            <Block className="h-6 w-24 rounded-full bg-indigo-500/20" />
          </div>
          {/* Department name */}
          <Block className="mt-2 h-6 w-28 rounded-md bg-indigo-500/20" />
        </div>
      </div>
      {/* Attendance, Ratings, Tasks, and Change Department actions */}
      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
        <Block className="h-9 w-28 rounded-xl bg-white/10" />
        <Block className="h-9 w-24 rounded-xl bg-white/10" />
        <Block className="h-9 w-20 rounded-xl bg-white/10" />
        <Block className="h-9 w-44 rounded-xl bg-white/10" />
      </div>
    </div>
  );
}

function DepartmentAttendanceSkeleton() {
  return (
    <div>
      {/* Shared Department Context banner */}
      <DepartmentContextSkeleton />
      {/* Attendance page header */}
      <div className="mb-7 flex items-center gap-4">
        {/* Attendance header icon */}
        <Block className="h-12 w-12 shrink-0 rounded-2xl" />
        <div>
          {/* Attendance eyebrow label */}
          <Block className="h-4 w-36 rounded-md" />
          {/* Attendance title */}
          <Block className="mt-3 h-12 w-64 rounded-xl" />
          {/* Attendance subtitle */}
          <Block className="mt-3 h-5 w-[390px] max-w-[72vw] rounded-md" />
        </div>
      </div>
      {/* View attendance controls card */}
      <div className="mb-5 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 md:p-6">
        {/* View attendance for label */}
        <Block className="mb-3 h-4 w-[150px] rounded-md" />
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Team-member selector */}
          <Block className="h-[51px] w-full rounded-2xl sm:max-w-sm" />
          {/* View All button */}
          <Block className="h-11 w-[104px] rounded-xl" />
        </div>
      </div>
      {/* Attendance records table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {/* Date, Status, and Remarks table header */}
        <div className="grid h-14 grid-cols-3 items-center border-b border-slate-200 bg-slate-50 px-6 dark:border-slate-700 dark:bg-slate-950">
          <Block className="h-5 w-16" />
          <Block className="h-5 w-16" />
          <Block className="mx-auto h-5 w-20" />
        </div>
        {/* Alternating attendance rows */}
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={`grid h-[74px] grid-cols-3 items-center border-b border-slate-100 px-6 last:border-0 dark:border-slate-700 ${i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/35'}`}
          >
            <Block className="h-5 w-28" />
            <Block className="h-7 w-24 rounded-full" />
            <Block className="mx-auto h-5 w-5" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DepartmentRatingsSkeleton() {
  return (
    <div>
      {/* Shared Department Context banner */}
      <DepartmentContextSkeleton />
      {/* Ratings page header */}
      <div className="mb-6 flex items-center gap-4">
        {/* Ratings header icon */}
        <Block className="h-12 w-12 shrink-0 rounded-2xl" />
        <div>
          {/* Performance eyebrow label */}
          <Block className="h-4 w-40" />
          {/* Ratings title */}
          <Block className="mt-3 h-12 w-52" />
          {/* Ratings subtitle */}
          <Block className="mt-3 h-5 w-[410px] max-w-[72vw]" />
        </div>
      </div>
      {/* View Ratings History card */}
      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900 md:h-[273px] md:p-7">
        {/* History heading and average-rating summary */}
        <div className="mb-6 flex justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            {/* History icon */}
            <Block className="h-10 w-10 shrink-0 rounded-xl" />
            <div>
              {/* View Ratings History title */}
              <Block className="h-7 w-56" />
              {/* History description */}
              <Block className="mt-2 h-5 w-[460px] max-w-[60vw]" />
            </div>
          </div>
          {/* Average rating summary */}
          <Block className="h-[92px] w-[240px] rounded-2xl" />
        </div>
        {/* Department selector, team-member selector, and View All action */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem] lg:items-end">
          <div>
            <Block className="mb-2 h-4 w-28" />
            <Block className="h-[51px] w-full rounded-2xl" />
          </div>
          <div>
            <Block className="mb-2 h-4 w-28" />
            <Block className="h-[51px] w-full rounded-2xl" />
          </div>
          {/* View All button */}
          <Block className="h-[42px] w-28 rounded-xl" />
        </div>
      </div>
      {/* Rating-history result cards */}
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
          >
            {/* Score and submitted-date placeholders */}
            <div className="mb-3 flex items-center justify-between gap-4">
              <Block className="h-7 w-48" />
              <Block className="h-7 w-28 rounded-full" />
            </div>
            {/* Rating remarks */}
            <Block className="h-5 w-72 max-w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectDetailSkeleton() {
  return (
    <div>
      {/* Back to Department button */}
      <Block className="mb-4 h-[40px] w-[190px] rounded-2xl" />

      {/* Project Detail header */}
      <div className="mb-7 flex items-center gap-4">
        {/* Header icon */}
        <Block className="h-12 w-12 shrink-0 rounded-2xl" />
        <div>
          {/* Lead name */}
          <Block className="h-12 w-[320px] max-w-[62vw] rounded-xl" />
          {/* Department and page description */}
          <Block className="mt-3 h-5 w-[300px] max-w-[72vw] rounded-md" />
        </div>
      </div>

      {/* Hierarchy summary outer Card uses the shared real Card surface */}
      <Card className="-mt-1 mb-5 p-5 md:flex md:h-[112px] md:items-center">
        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40"
            >
              {/* Summary label */}
              <Block className="h-3 w-24 rounded-md" />
              {/* Summary value */}
              <Block
                className={`mt-3 h-7 rounded-md ${
                  index === 0 ? 'w-48' : index === 1 ? 'w-28' : 'w-12'
                }`}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Attendance and Ratings tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        <Block className="h-[40px] w-[147px] rounded-2xl" />
        <Block className="h-[40px] w-[120px] rounded-2xl" />
      </div>

      {/* Attendance controls use the exact real card surface and border */}
      <div className="mb-5 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 md:p-6">
        {/* View attendance for label */}
        <Block className="mb-3 h-4 w-[150px] rounded-md" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Member select */}
          <Block className="h-[51px] w-full rounded-2xl sm:max-w-[430px]" />
          {/* View all attendance button */}
          <Block className="h-[41px] w-[190px] rounded-xl" />
        </div>
      </div>

      {/* Attendance table uses the exact real shell surface and border */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {/* Exact real table-header surface */}
        <div className="grid h-[54px] grid-cols-3 items-center border-b border-slate-200 bg-slate-50 px-6 dark:border-slate-700 dark:bg-slate-950">
          <Block className="h-5 w-16 rounded-md" />
          <Block className="h-5 w-16 rounded-md" />
          <Block className="mx-auto h-5 w-20 rounded-md" />
        </div>
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className={`grid h-[64px] grid-cols-3 items-center border-b border-slate-100 px-6 last:border-0 dark:border-slate-700 ${
              index % 2 === 0
                ? 'bg-white dark:bg-slate-900'
                : 'bg-slate-50/50 dark:bg-slate-800/35'
            }`}
          >
            <Block className="h-5 w-28 rounded-md" />
            <Block className="h-7 w-24 rounded-full" />
            <Block className="mx-auto h-5 w-5 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
function DepartmentProjectsSkeleton() {
  return (
    <div>
      {/* Back to Departments button */}
      <Block className="mb-4 h-[40px] w-[197px] rounded-2xl" />

      {/* Department header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {/* Department header icon */}
          <Block className="h-12 w-12 shrink-0 rounded-2xl" />

          <div>
            {/* Department title */}
            <Block className="-mt-1 h-12 w-[350px] max-w-[62vw] rounded-xl" />

            {/* Department subtitle */}
            <Block className="mt-3 h-5 w-[490px] max-w-[72vw] rounded-md" />
          </div>
        </div>

        {/* Replace Senior TL button */}
        <Block className="-mt-10 h-[40px] w-[172px] rounded-2xl" />
      </div>

      {/* Department hierarchy cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card
            key={index}
            className="h-[194px] border border-slate-200 p-5 dark:border-slate-700/80 dark:!bg-slate-800"
          >
            <div className="flex h-full items-start justify-between gap-4">
              <div className="flex h-full min-w-0 flex-1 flex-col">
                {/* Lead information */}
                <div className="mb-3 flex items-center gap-3">
                  {/* Lead avatar */}
                  <Block className="h-11 w-11 shrink-0 rounded-2xl" />

                  <div className="min-w-0 flex-1">
                    {/* Lead name */}
                    <Block className="h-6 w-[210px] max-w-full rounded-md" />

                    {/* Lead role badge */}
                    <Block className="mt-2 h-7 w-[88px] rounded-full" />
                  </div>
                </div>

                {/* Member information section */}
                <div className="mt-auto flex flex-col justify-start gap-3 border-t border-slate-700/70 pt-4">
                  {/* Member count */}
                  <Block className="h-5 w-[160px] rounded-md" />

                  {/* Team breakdown badges */}
                  <div className="flex flex-wrap items-start gap-2">
                    {/* TL count */}
                    <Block className="h-7 w-[42px] rounded-lg" />

                    {/* Captain count */}
                    <Block className="h-7 w-[90px] rounded-lg" />

                    {/* Intern count */}
                    <Block className="h-7 w-[86px] rounded-lg" />
                  </div>
                </div>
              </div>

              {/* Users icon on the right */}
              <Block className="h-5 w-5 shrink-0 rounded-md" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
function DepartmentsSkeleton() {
  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Block className="h-12 w-12 shrink-0 rounded-2xl" />
          <div>
            <Block className="h-10 w-[225px] max-w-[62vw] rounded-lg" />
            <Block className="mt-2 h-5 w-[350px] max-w-[72vw] rounded-md" />
          </div>
        </div>
        <Block className="h-[38px] w-[144px] -translate-y-[15px] rounded-2xl" />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card
            key={index}
            className="h-[190px] border border-slate-200 p-5 dark:border-slate-700 dark:!bg-slate-800"
          >
            <div className="flex h-full flex-col justify-center">
              <div className="flex items-center gap-4">
                <Block className="h-11 w-11 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <Block className="h-5 w-[150px] max-w-full rounded-md" />
                  <Block className="mt-2 h-4 w-[175px] max-w-full rounded-md" />
                </div>
                <Block className="h-7 w-7 shrink-0 rounded-xl" />
              </div>
              <div className="mt-4 border-t border-slate-700 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Block className="h-7 w-[116px] rounded-xl" />
                  <Block className="h-7 w-[92px] rounded-xl" />
                  <Block className="h-7 w-[78px] rounded-xl" />
                  <Block className="h-7 w-[144px] rounded-xl" />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
function AdminUsersSkeleton() {
  const columns = '42% 15% 20% 13% 10%';
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-[30px] flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Block className="h-14 w-14 shrink-0 rounded-3xl" />
          <div>
            <Block className="mb-2 h-3 w-28 rounded-md" />
            <Block className="h-12 w-[300px] max-w-[62vw] rounded-xl" />
            <Block className="mt-3 h-5 w-[430px] max-w-[72vw] rounded-md" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:translate-y-1">
          <Block className="h-10 w-[156px] rounded-lg" />
          <Block className="h-10 w-[104px] rounded-lg" />
          <Block className="h-10 w-[104px] rounded-lg" />
        </div>
      </div>

      <Card className="mb-6 h-[175px] p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Block className="h-11 w-11 shrink-0 rounded-2xl" />
            <div>
              <Block className="h-7 w-[180px] rounded-lg" />
              <Block className="mt-2 h-4 w-[430px] max-w-[68vw] rounded-md" />
            </div>
          </div>
          <Block className="h-8 w-[104px] rounded-full" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Block className="h-[51px] min-w-[240px] flex-1 rounded-2xl" />
          <Block className="h-[51px] w-full rounded-2xl sm:w-44" />
          <Block className="h-[51px] w-full rounded-2xl sm:w-52" />
          <Block className="h-[51px] w-full rounded-2xl sm:w-48" />
        </div>
      </Card>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900">
        <div
          className="grid min-h-[56px] items-center border-b border-slate-200 bg-slate-50 px-6 dark:border-slate-600 dark:bg-slate-950"
          style={{ gridTemplateColumns: columns }}
        >
          <Block className="h-5 w-16 rounded-md" />
          <Block className="mx-auto h-5 w-14 rounded-md" />
          <Block className="mx-auto h-5 w-24 rounded-md" />
          <Block className="mx-auto h-5 w-16 rounded-md" />
          <Block className="ml-auto h-5 w-16 rounded-md" />
        </div>
        {Array.from({ length: 6 }, (_, row) => (
          <div
            key={row}
            className={`grid min-h-[88px] items-center border-b border-slate-100 px-6 last:border-0 dark:border-slate-700 ${
              row % 2 === 0
                ? 'bg-white dark:bg-slate-900'
                : 'bg-slate-50/50 dark:bg-slate-800/40'
            }`}
            style={{ gridTemplateColumns: columns }}
          >
            <div className="flex min-w-0 items-center gap-4">
              <Block className="h-11 w-11 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <Block className="h-5 w-40 max-w-full rounded-md" />
                <Block className="mt-2 h-4 w-52 max-w-full rounded-md" />
              </div>
            </div>
            <Block className="mx-auto h-7 w-20 rounded-full" />
            <Block className="mx-auto h-5 w-28 rounded-md" />
            <Block className="mx-auto h-7 w-20 rounded-full" />
            <Block className="ml-auto h-8 w-8 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
function NoticesSkeleton() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex items-center gap-4">
        <NoticeBlock className="h-12 w-12 shrink-0 rounded-2xl" />

        <div>
          <NoticeBlock className="h-10 w-[230px] max-w-[62vw] rounded-lg" />
          <NoticeBlock className="mt-4 h-5 w-[330px] max-w-[72vw] rounded-md" />
        </div>
      </div>

      <Card className="mb-6 flex h-[467px] items-center border border-slate-200 p-5 dark:border-slate-700 dark:!bg-slate-800">
        <div className="w-full translate-y-1">
          <div className="mb-5 flex items-center gap-2">
            <NoticeBlock className="h-4 w-4 rounded-md" />
            <NoticeBlock className="h-7 w-[170px] rounded-lg" />
          </div>

          <NoticeBlock className="h-[36px] w-[280px] max-w-full rounded-lg border border-dashed border-slate-300 dark:border-slate-600" />

          <NoticeBlock className="mt-5 h-[46px] w-full rounded-2xl" />

          <NoticeBlock className="mt-3 h-[96px] w-full rounded-2xl" />

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NoticeBlock className="h-[46px] w-full rounded-2xl" />
            <NoticeBlock className="h-[46px] w-full rounded-2xl" />
          </div>

          <div className="mt-4 flex items-center gap-2">
            <NoticeBlock className="h-4 w-4 rounded-md" />
            <NoticeBlock className="h-4 w-[170px] rounded-md" />
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <NoticeBlock className="h-[46px] w-full rounded-2xl sm:w-72" />
            <NoticeBlock className="h-[46px] w-[180px] rounded-2xl" />
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index} className="p-4 dark:!bg-slate-800 md:p-5">
            <div className="flex items-center gap-4">
              <NoticeBlock className="h-20 w-32 shrink-0 rounded-xl" />

              <div className="min-w-0 flex-1">
                <NoticeBlock className="h-6 w-24 rounded-full" />
                <NoticeBlock className="mt-2 h-6 w-[240px] rounded-md" />
                <NoticeBlock className="mt-2 h-4 w-[520px] max-w-full rounded-md" />
              </div>

              <div className="flex shrink-0 gap-1">
                <NoticeBlock className="h-8 w-8 rounded-lg" />
                <NoticeBlock className="h-8 w-8 rounded-lg" />
                <NoticeBlock className="h-8 w-8 rounded-lg" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
function NotificationsSkeleton() {
  return (
    <>
      <div className="mb-[27px] flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Block className="h-12 w-12 shrink-0 rounded-2xl" />
          <div>
            {/* Activity Center */}
            <Block className="mt-1 mb-4 h-4 w-[168px] rounded-md" />
            {/* Notifications */}
            <Block className="h-9 w-[220px] rounded-lg" />
            {/* 4 unread activity updates */}
            <Block className="mt-4 h-5 w-[195px] rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Block className="h-[42px] w-[125px] shrink-0 rounded-2xl" />
          <Block className="h-[42px] w-[147px] shrink-0 rounded-2xl" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Card key={index} className="min-h-[145px] p-5">
            <div className="flex items-start gap-4">
              <Block className="h-11 w-11 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1 pt-0.5">
                <Block className="h-5 w-52 rounded-md" />
                <Block className="mt-2 h-4 w-[34rem] max-w-full rounded-md" />
                <Block className="mt-3 h-3 w-20 rounded-md" />
              </div>
              <div className="flex shrink-0 items-center gap-2 pt-1">
                <Block className="h-5 w-24 rounded-md" />
                <Block className="h-8 w-8 rounded-xl" />
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
      <div className="mb-[33px] flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Block className="mt-1 h-12 w-12 shrink-0 rounded-2xl" />
          <div>
            <Block className="h-10 w-[264px] max-w-[62vw] rounded-lg" />
            <Block className="mt-2 h-5 w-[468px] max-w-[70vw] rounded-lg" />
          </div>
        </div>
        <Block className="-mt-[26px] h-[42px] w-[166px] shrink-0 rounded-2xl" />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <Card key={index} className="h-[90px] px-4 py-3">
            <div className="flex h-full items-center gap-3">
              <Block className="h-11 w-11 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <Block className="h-5 w-24 rounded-md" />
                <Block className="mt-2 h-4 w-52 max-w-full rounded-md" />
                <Block className="mt-2 h-4 w-36 max-w-full rounded-md" />
              </div>
              <Block className="h-[36px] w-[82px] shrink-0 rounded-2xl" />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
function ProfileSkeleton({ role }) {
  const accountDetailCount =
    role === 'ADMIN' ? 3 : role === 'SENIOR_TL' ? 5 : 4;
  const accountDetailGrid =
    accountDetailCount === 3
      ? 'sm:grid-cols-3 xl:w-[500px]'
      : 'sm:grid-cols-2 xl:w-[500px]';

  return (
    <>
      <div className="mb-[38px] flex items-center gap-3">
        <Block className="h-11 w-11 shrink-0 rounded-xl" />
        <div>
          <Block className="h-7 w-32 rounded-lg" />
          <Block className="mt-2 h-4 w-64 max-w-[70vw] rounded-lg" />
        </div>
      </div>

      <Card className="mb-5 flex min-h-[187px] items-center p-4 md:p-5">
        <div className="flex w-full flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
            <div className="w-32 shrink-0">
              <Block className="mx-auto h-24 w-24 rounded-3xl" />
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Block className="h-9 w-48 rounded-lg" />
                <Block className="h-6 w-20 rounded-full" />
                <Block className="h-6 w-16 rounded-full" />
              </div>
              <div className="flex items-center gap-2">
                <Block className="h-4 w-4 shrink-0 rounded-md" />
                <Block className="h-5 w-56 max-w-full rounded-lg" />
              </div>
              <Block className="mt-3 h-4 w-[34rem] max-w-full rounded-lg" />
              <Block className="mt-2 h-4 w-80 max-w-full rounded-lg" />
            </div>
          </div>

          <div
            className={`grid shrink-0 grid-cols-1 gap-2 ${accountDetailGrid}`}
          >
            {Array.from({ length: accountDetailCount }, (_, index) => (
              <div
                key={index}
                className="flex min-h-[70px] min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <Block className="mt-0.5 h-4 w-4 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <Block className="h-3 w-20 rounded-md" />
                  <Block className="mt-2 h-4 w-28 max-w-full rounded-md" />
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
              <div>
                <Block className="h-5 w-44 rounded-lg" />
                <Block className="mt-2 h-4 w-40 rounded-lg" />
              </div>
            </div>

            <div className="space-y-4">
              {Array.from({ length: 2 }, (_, index) => (
                <div key={index}>
                  <Block className="mb-2 h-3 w-24 rounded-md" />
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
                <div>
                  <Block className="h-5 w-32 rounded-lg" />
                  <Block className="mt-2 h-4 w-48 max-w-[45vw] rounded-lg" />
                </div>
              </div>
              <Block className="h-5 w-20 shrink-0 rounded-lg" />
            </div>
          </Card>
        </div>

        <Card className="p-5 md:p-6">
          <div className="mb-4 flex items-center gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
            <Block className="h-11 w-11 shrink-0 rounded-2xl" />
            <div>
              <Block className="h-5 w-48 rounded-lg" />
              <Block className="mt-2 h-4 w-64 max-w-[55vw] rounded-lg" />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Block className="mb-2 h-3 w-32 rounded-md" />
              <Block className="h-12 w-full rounded-2xl" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 2 }, (_, index) => (
                <div key={index}>
                  <Block className="mb-2 h-3 w-36 rounded-md" />
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
function PerformanceIntelligenceSkeleton() {
  const tabWidths = ['w-[160px]', 'w-[205px]', 'w-[114px]', 'w-[215px]'];
  return (
    <div className="min-h-[calc(100vh-7rem)] rounded-3xl bg-white p-4 text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Block className="mt-1 h-6 w-6 shrink-0 rounded-md" />
              <Block className="mt-1 h-8 w-[370px] max-w-[68vw] rounded-lg" />
            </div>
            <Block className="mt-3 h-5 w-[680px] max-w-[76vw] rounded-md" />
          </div>
          <Block className=" h-[42px] w-[190px] shrink-0 rounded-lg" />
        </div>

        <div className="!mt-6 flex gap-6 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
          {tabWidths.map((width, index) => (
            <div
              key={width}
              className={`border-b-2 pb-3 ${
                index === 0 ? 'border-indigo-500' : 'border-transparent'
              }`}
            >
              <Block className={`h-5 ${width} shrink-0 rounded-md`} />
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="h-[192px] relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-500 dark:!bg-slate-900 dark:shadow-lg dark:shadow-black/20">
              <div className="flex items-center justify-between">
                <Block className="h-4 w-44 rounded-md" />
                <Block className="h-5 w-5 rounded-md" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <Block className="h-12 w-28 rounded-lg" />
                <Block className="h-5 w-12 rounded-md" />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Block className="h-6 w-14 rounded-md" />
                <Block className="h-4 w-20 rounded-md" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-500 dark:!bg-slate-900 dark:shadow-lg dark:shadow-black/20">
              <div className="flex items-center justify-between">
                <Block className="h-4 w-40 rounded-md" />
                <Block className="h-5 w-5 rounded-md" />
              </div>
              <Block className="mt-4 h-7 w-36 rounded-full" />
              <Block className="mt-2 h-4 w-44 max-w-full rounded-md" />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-500 dark:!bg-slate-900 dark:shadow-lg dark:shadow-black/20">
              <div className="flex items-center justify-between">
                <Block className="h-4 w-40 rounded-md" />
                <Block className="h-5 w-5 rounded-md" />
              </div>
              <Block className="mt-3 h-10 w-24 rounded-lg" />
              <Block className="mt-2 h-4 w-32 rounded-md" />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-500 dark:!bg-slate-900 dark:shadow-lg dark:shadow-black/20">
              <div className="flex items-center justify-between">
                <Block className="h-4 w-32 rounded-md" />
                <Block className="h-5 w-5 rounded-md" />
              </div>
              <Block className="mt-3 h-10 w-32 rounded-lg" />
              <Block className="mt-2 h-4 w-32 rounded-md" />
            </div>
          </div>

          <div className="h-[236px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-950">
            <div className="mb-4 flex items-center gap-2">
              <Block className="h-5 w-5 rounded-md" />
              <Block className="h-7 w-[310px] rounded-lg" />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {Array.from({ length: 9 }, (_, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex justify-between">
                    <Block className="h-4 w-32 rounded-md" />
                    <Block className="h-4 w-12 rounded-md" />
                  </div>
                  <Block className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function InternOpsSkeleton() {
  const columns = '31% 25% 19% 20% 5%';
  return (
    <>
      <div className="mb-8 flex items-center gap-4">
        <Block className="h-12 w-12 shrink-0 rounded-2xl" />
        <div>
          <Block className="h-10 w-[250px] rounded-lg" />
          <Block className="mt-2 h-5 w-[560px] max-w-[72vw] rounded-lg" />
        </div>
      </div>
      <div className="mb-7 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <Card className="h-[138px] p-5 lg:col-span-2">
          <Block className="mb-4 h-4 w-48 rounded-md" />
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="flex flex-1 items-center gap-2">
              <Block className="h-11 flex-1 rounded-xl" />
              <Block className="h-4 w-5 rounded-md" />
              <Block className="h-11 flex-1 rounded-xl" />
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              {Array.from({ length: 5 }, (_, index) => (
                <Block key={index} className="h-9 w-24 rounded-lg" />
              ))}
            </div>
          </div>
        </Card>
        <Card className="h-[110px] p-5">
          <Block className="mb-4 h-4 w-32 rounded-md" />
          <Block className="h-11 w-full rounded-xl" />
        </Card>
      </div>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800/70">
            {statusWidths.map((width, index) => (
              <Block key={index} className={`h-[30px] ${width} rounded-lg`} />
            ))}
          </div>
          <Card>
            <div
              className="grid min-h-[55px] items-center border-b border-slate-200 bg-slate-50/80 px-4 dark:border-slate-700 dark:bg-slate-800/70"
              style={{ gridTemplateColumns: columns }}
            >
              {Array.from({ length: 5 }, (_, index) => (
                <Block
                  key={index}
                  className={`h-4 rounded-md ${index === 0 ? 'w-40' : index === 4 ? 'mx-auto w-4' : 'mx-auto w-24'}`}
                />
              ))}
            </div>
            {Array.from({ length: 5 }, (_, row) => (
              <div
                key={row}
                className="grid min-h-[74px] items-center border-b border-slate-100 px-4 last:border-0 dark:border-slate-800"
                style={{ gridTemplateColumns: columns }}
              >
                <div className="space-y-2">
                  <Block className="h-5 w-40 rounded-md" />
                  <Block className="h-4 w-52 max-w-full rounded-md" />
                </div>
                <div className="mx-auto flex items-center gap-2">
                  <Block className="h-2 w-20 rounded-full" />
                  <Block className="h-5 w-12 rounded-md" />
                </div>
                <div className="mx-auto flex items-center gap-2">
                  <Block className="h-5 w-10 rounded-md" />
                  <Block className="h-4 w-20 rounded-md" />
                </div>
                <Block className="mx-auto h-8 w-28 rounded-full" />
                <Block className="mx-auto h-5 w-4 rounded-md" />
              </div>
            ))}
          </Card>
        </div>
        <Card className="flex min-h-[310px] items-center justify-center border-dashed p-12">
          <div className="w-full space-y-4">
            <Block className="mx-auto h-12 w-12 rounded-2xl" />
            <Block className="mx-auto h-5 w-72 max-w-full rounded-md" />
            <Block className="mx-auto h-5 w-60 max-w-full rounded-md" />
          </div>
        </Card>
      </div>
    </>
  );
}
function AuditLogSkeleton() {
  // Mirrors the loaded Audit Log table column proportions.
  const columns = '17fr 23fr 20fr 16fr 24fr';

  // Placeholder widths follow the Time, Actor, Action, Resource, and Details columns.
  const cellWidths = [
    'w-[82%]', // Time placeholder width
    'w-[88%]', // Actor placeholder width
    'w-[132px]', // Action badge placeholder width
    'w-[72%]', // Resource placeholder width
    'w-[86%]', // Details placeholder width
  ];

  return (
    <div className="pt-0">
      {/* Audit Log page header. */}
      <div className="mb-[37px] flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Block className="h-12 w-12 shrink-0 rounded-2xl" />
          <div>
            <Block className="mb-3 h-4 w-32 rounded-md" />

            <Block className="my-2 h-10 w-[178px] rounded-lg" />

            <Block className="mt-3 h-5 w-[320px] max-w-[70vw] rounded-lg" />
          </div>
        </div>
      </div>

      {/* Audit Log table shell and column header. */}
      <div className="-mt-1 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:border-indigo-400/20 dark:bg-slate-900 dark:shadow-[0_16px_40px_rgba(2,6,23,0.24)]">
        <div
          className="grid h-12 items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 dark:border-indigo-400/15 dark:bg-slate-950/70"
          style={{ gridTemplateColumns: columns }}
        >
          {['w-12', 'w-14', 'w-16', 'w-20', 'w-16'].map((width) => (
            <Block key={width} className={`h-4 rounded-md ${width}`} />
          ))}
        </div>

        {/* Alternating placeholders mirror the loaded Audit Log rows. */}
        {Array.from({ length: 10 }, (_, row) => (
          <div
            key={row}
            className={`grid h-[56px] items-center gap-4 border-b border-slate-100 px-4 last:border-b-0 dark:border-slate-700 ${
              row % 2 === 0
                ? 'bg-white dark:bg-slate-900'
                : 'bg-slate-50/50 dark:bg-slate-800/25'
            }`}
            style={{ gridTemplateColumns: columns }}
          >
            {cellWidths.map((width, column) => (
              <Block
                key={column}
                className={`h-4 max-w-full ${width} ${
                  column === 2 ? 'h-7 rounded-full' : 'rounded-md'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function AssistantSkeleton() {
  const moduleWidths = ['w-36', 'w-32', 'w-40', 'w-36', 'w-24', 'w-28'];

  return (
    <div className="h-[calc(100vh-6.5rem)] min-h-[680px] max-h-[calc(100vh-6.5rem)]">
      <div className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-950 dark:shadow-none">
        {/*
          Assistant header height: min-h-[98px] mirrors the loaded gradient banner.
          Adjust this value only when the real Assistant header height changes.
        */}
        <div className="relative min-h-[98px] shrink-0 overflow-hidden bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.18),transparent_28%)]" />
          <div className="relative flex flex-col justify-between gap-4 px-5 py-4 md:px-7 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4">
              <Block className="h-12 w-12 shrink-0 rounded-3xl bg-white/20 dark:bg-white/20" />
              <div>
                <div className="flex items-center gap-2">
                  <Block className="h-2.5 w-2.5 rounded-full bg-emerald-300 dark:bg-emerald-300" />
                  <Block className="h-8 w-[250px] max-w-[58vw] rounded-lg bg-white/25 dark:bg-white/25" />
                </div>
                <Block className="mt-2 h-4 w-[560px] max-w-[70vw] rounded-md bg-indigo-100/30 dark:bg-indigo-100/30" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Block className="h-[51px] w-44 rounded-2xl bg-slate-900/75 dark:bg-slate-900/75" />
              <Block className="h-11 w-11 rounded-2xl bg-white/20 dark:bg-white/20" />
            </div>
          </div>
        </div>

        {/*
          Assistant tabs: h-[46px] keeps the chat workspace aligned with the loaded view.
        */}
        <div className="grid shrink-0 grid-cols-3 border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {['w-20', 'w-28', 'w-24'].map((width, index) => (
            <div
              key={width}
              className={`flex h-[46px] items-center justify-center ${
                index === 0
                  ? 'border-b-2 border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/30'
                  : ''
              }`}
            >
              <Block className={`h-5 ${width} rounded-md`} />
            </div>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Main chat workspace. */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
            <div className="min-h-0 flex-1 overflow-hidden px-4 py-5 md:px-6">
              <div className="max-w-5xl">
                {/* Welcome card height: h-[307px] mirrors the loaded introductory message. */}
                <div className="h-[307px] w-[76%] max-w-[760px] overflow-hidden rounded-[1.5rem] rounded-bl-md border border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
                  <Block className="h-5 w-[360px] max-w-full rounded-md" />
                  <Block className="mt-5 h-4 w-[610px] max-w-full rounded-md" />
                  <Block className="mt-3 h-4 w-[470px] max-w-full rounded-md" />
                  <div className="mt-4 space-y-2.5">
                    {['w-52', 'w-72', 'w-80', 'w-64'].map((width) => (
                      <Block
                        key={width}
                        className={`h-4 ${width} max-w-full rounded-md`}
                      />
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {['w-36', 'w-32', 'w-40', 'w-36', 'w-28'].map((width) => (
                      <Block
                        key={width}
                        className={`h-8 ${width} rounded-full`}
                      />
                    ))}
                  </div>
                  <Block className="mt-3 h-3 w-16 rounded-md" />
                </div>
              </div>
            </div>

            {/* Quick actions and message composer. */}
            <div className="shrink-0 border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <div className="flex gap-2 overflow-hidden px-4 py-3 md:px-6">
                {['w-36', 'w-28', 'w-28', 'w-28', 'w-24', 'w-28'].map(
                  (width, index) => (
                    <Block
                      key={`${width}-${index}`}
                      className={`h-8 ${width} shrink-0 rounded-full`}
                    />
                  )
                )}
              </div>
              <div className="flex items-end gap-3 px-4 pb-4 md:px-6">
                <Block className="h-12 flex-1 rounded-3xl" />
                <Block className="h-12 w-12 shrink-0 rounded-3xl bg-indigo-500/50 dark:bg-indigo-500/50" />
              </div>
            </div>
          </div>

          {/* Desktop role insights and assistant modules. */}
          <div className="hidden w-[330px] shrink-0 flex-col gap-4 overflow-hidden border-l border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/60 xl:flex">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-5 flex items-center gap-3">
                <Block className="h-11 w-11 shrink-0 rounded-2xl" />
                <div className="space-y-2">
                  <Block className="h-3 w-24 rounded-md" />
                  <Block className="h-6 w-20 rounded-md" />
                </div>
              </div>
              <Block className="mb-3 h-4 w-20 rounded-md" />
              <div className="space-y-3">
                {Array.from({ length: 5 }, (_, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Block className="h-4 w-4 shrink-0 rounded-full" />
                    <Block
                      className={`h-4 ${index % 2 === 0 ? 'w-36' : 'w-44'} rounded-md`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
                <Block className="mb-3 h-4 w-24 rounded-md" />
                <div className="flex items-center gap-2">
                  <Block className="h-4 w-4 shrink-0 rounded-full" />
                  <Block className="h-4 w-52 rounded-md" />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-5 flex items-center gap-3">
                <Block className="h-11 w-11 shrink-0 rounded-2xl" />
                <div className="space-y-2">
                  <Block className="h-3 w-32 rounded-md" />
                  <Block className="h-6 w-44 rounded-md" />
                </div>
              </div>
              <div className="space-y-2">
                {moduleWidths.map((width) => (
                  <div
                    key={width}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/70"
                  >
                    <Block className={`h-4 ${width} max-w-full rounded-md`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickGenerateSkeleton() {
  const fieldWidths = ['w-40', 'w-52', 'w-28', 'w-36'];

  return (
    <>
      {/* Quick Generate page header. */}
      <div className="mb-6 flex items-center gap-4">
        <Block className="h-12 w-12 shrink-0 rounded-2xl" />
        <div>
          <Block className="h-10 w-[460px] max-w-[68vw] rounded-xl" />
          <Block className="mt-3 h-5 w-[490px] max-w-[72vw] rounded-md" />
        </div>
      </div>

      {/* The loaded workspace uses a centered three-column form and two-column preview. */}
      <div className="mx-auto max-w-5xl px-4 pt-[37px] pb-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Card className="min-h-[760px] p-6">
              <Block className="mb-5 h-7 w-48 rounded-lg" />
              <div className="space-y-4">
                {fieldWidths.map((width, index) => (
                  <div key={`${width}-${index}`}>
                    <Block className={`mb-1.5 h-5 ${width} rounded-md`} />
                    <Block className="h-[51px] w-full rounded-xl" />
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-4">
                  {['w-24', 'w-20'].map((width) => (
                    <div key={width}>
                      <Block className={`mb-1.5 h-5 ${width} rounded-md`} />
                      <Block className="h-[51px] w-full rounded-xl" />
                    </div>
                  ))}
                </div>

                <div>
                  <Block className="mb-1.5 h-5 w-24 rounded-md" />
                  <Block className="h-[51px] w-full rounded-xl" />
                </div>
                <Block className="h-12 w-full rounded-xl" />
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="h-[294px] p-6">
              <Block className="mb-5 h-7 w-56 rounded-lg" />
              <div className="flex h-[180px] flex-col items-center justify-center">
                <Block className="h-12 w-12 rounded-xl" />
                <Block className="mt-5 h-5 w-48 rounded-md" />
                <Block className="mt-3 h-4 w-52 rounded-md" />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function CertificatesSkeleton() {
  const columns = '24% 32% 13% 12% 12% 7%';

  return (
    <>
      {/* Certificates page header and its two real actions. */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Block className="h-12 w-12 shrink-0 rounded-2xl" />
          <div>
            <Block className="h-10 w-52 rounded-xl" />
            <Block className="mt-3 h-5 w-[330px] max-w-[70vw] rounded-md" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:-mt-8">
          <Block className="h-[38px] w-[135px] rounded-xl" />
          <Block className="h-[38px] w-[184px] rounded-xl" />
        </div>
      </div>

      {/* Search card and inset search control. */}
      <Card className="-mt-1 mb-6 p-4">
        <div className="flex h-[46px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 dark:border-slate-700 dark:bg-slate-800">
          <Block className="h-5 w-5 shrink-0 rounded-md" />
          <Block className="h-5 w-[310px] max-w-[70%] rounded-md" />
        </div>
      </Card>

      {/* Six-column certificate table matching the loaded page. */}
      <Card>
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div
              className="grid h-[52px] items-center border-b border-slate-200 bg-slate-50 px-4 dark:border-slate-700 dark:bg-slate-950"
              style={{ gridTemplateColumns: columns }}
            >
              {['w-20', 'w-14', 'w-12', 'w-14', 'w-10', 'w-14'].map(
                (width, index) => (
                  <Block
                    key={`${width}-${index}`}
                    className={`h-5 ${width} rounded-md ${index === 5 ? 'ml-auto' : ''}`}
                  />
                )
              )}
            </div>

            {Array.from({ length: 6 }, (_, row) => (
              <div
                key={row}
                className="grid h-[68px] items-center border-b border-slate-100 px-4 last:border-0 dark:border-slate-700"
                style={{ gridTemplateColumns: columns }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Block className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <Block className="h-5 w-32 max-w-full rounded-md" />
                    <Block className="mt-1 h-4 w-40 max-w-full rounded-md" />
                  </div>
                </div>
                <Block className="h-5 w-[88%] max-w-full rounded-md" />
                <Block className="h-7 w-24 rounded-full" />
                <Block className="h-7 w-24 rounded-full" />
                <Block className="h-5 w-24 rounded-md" />
                <div className="ml-auto flex items-center gap-2">
                  <Block className="h-8 w-8 rounded-lg" />
                  <Block className="h-8 w-8 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>{' '}
      </Card>
    </>
  );
}

function BulkGenerateSkeleton() {
  return (
    <>
      {/* Bulk Generate header. */}
      <div className="mb-6 flex items-center gap-4">
        <Block className="h-12 w-12 shrink-0 rounded-2xl" />
        <Block className="h-10 w-[450px] max-w-[72vw] rounded-xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-8 pt-4 sm:pt-[28px]">
        {/* Three-step workflow progress. */}
        <div className="mb-6 flex items-center justify-center sm:mb-7">
          {[1, 2, 3].map((item) => (
            <div key={item} className="flex min-w-0 items-center">
              <Block
                className={`h-9 w-9 shrink-0 rounded-full sm:h-10 sm:w-10 ${
                  item === 1 ? 'bg-blue-500/70 dark:bg-blue-500/70' : ''
                }`}
              />
              {item < 3 && (
                <Block className="mx-2 h-1 w-12 rounded-full sm:w-[84px]" />
              )}
            </div>
          ))}
        </div>

        {/* Step 1 template-selection card. */}
        <Card className="mt-[5px] p-5 sm:px-6 sm:pt-[29px] sm:pb-6">
          <Block className="mb-5 h-7 w-56 max-w-full rounded-lg" />
          <Block className="mb-3 h-5 w-52 max-w-full rounded-md" />
          <Block className="h-[51px] w-full rounded-xl" />
          <Block className="mt-4 h-[42px] w-[135px] rounded-lg" />
        </Card>
      </div>
    </>
  );
}

function CanvaTemplatesSkeleton() {
  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Block className="h-12 w-12 shrink-0 rounded-2xl" />
        <Block className="h-10 w-[320px] max-w-[68vw] rounded-xl" />
      </div>
      <div className="mx-auto mt-[28px] max-w-7xl space-y-5">
        <Card className="p-5 sm:px-6 sm:py-[20px]">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Block className="h-12 w-12 shrink-0 rounded-xl" />
              <div className="min-w-0">
                <Block className="h-7 w-40 rounded-lg" />
                <Block className="mt-2 h-5 w-[390px] max-w-[62vw] rounded-md" />
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Block className="h-7 w-[130px] rounded-full" />
              <Block className="h-[42px] w-[190px] rounded-lg" />
            </div>
          </div>
        </Card>
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Block className="h-7 w-44 rounded-lg" />
              <Block className="mt-2 h-5 w-[270px] max-w-[68vw] rounded-md" />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
              <Block className="h-[42px] w-[235px] rounded-lg" />
              <Block className="h-[42px] w-[175px] rounded-lg" />
            </div>
          </div>
          <div className="flex min-h-[232px] flex-col items-center justify-center pb-6 pt-10 text-center">
            <Block className="h-12 w-12 rounded-2xl" />
            <Block className="mt-5 h-5 w-[360px] max-w-[80%] rounded-md" />
          </div>
        </Card>
      </div>
    </>
  );
}

function AICertificatesSkeleton() {
  const tabWidths = [
    'w-[121px]',
    'w-[100px]',
    'w-[131px]',
    'w-[129px]',
    'w-[149px]',
    'w-[131px]',
    'w-[149px]',
    'w-[149px]',
    'w-[96px]',
  ];
  const pairedFields = [
    ['w-14', 'w-16'],
    ['w-14', 'w-12'],
    ['w-16', 'w-12'],
    ['w-20', 'w-20'],
  ];

  return (
    <>
      <div className="mb-7 flex items-center gap-4">
        <Block className="h-12 w-12 shrink-0 rounded-2xl" />
        <div>
          <div className="sm:hidden">
            <Block className="h-9 w-[235px] rounded-xl" />
            <Block className="mt-2 h-9 w-[170px] rounded-xl" />
            <Block className="mt-3 h-4 w-[285px] rounded-md" />
            <Block className="mt-2 h-4 w-[155px] rounded-md" />
          </div>
          <div className="hidden sm:block">
            <Block className="h-10 w-[415px] max-w-[68vw] rounded-xl" />
            <Block className="mt-3 h-5 w-[510px] max-w-[72vw] rounded-md" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-8 pt-8">
        <div className="mb-7 flex flex-wrap gap-x-2 gap-y-3">
          {tabWidths.map((width, index) => (
            <Block
              key={`${width}-${index}`}
              className={`h-[33px] ${width} rounded-lg ${
                index === 0 ? 'bg-indigo-500/70 dark:bg-indigo-500/70' : ''
              }`}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Card className="p-6">
              <Block className="mb-5 h-7 w-24 rounded-lg" />
              <div className="space-y-4">
                {pairedFields.slice(0, 1).map((row, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                  >
                    {row.map((width, fieldIndex) => (
                      <div key={`${width}-${fieldIndex}`}>
                        <Block className={`mb-1.5 h-4 ${width} rounded-md`} />
                        <Block className="h-[44px] w-full rounded-xl" />
                      </div>
                    ))}
                  </div>
                ))}

                <div>
                  <Block className="mb-1.5 h-4 w-24 rounded-md" />
                  <Block className="h-[84px] w-full rounded-xl" />
                </div>

                {pairedFields.slice(1).map((row, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                  >
                    {row.map((width, fieldIndex) => (
                      <div key={`${width}-${fieldIndex}`}>
                        <Block className={`mb-1.5 h-4 ${width} rounded-md`} />
                        <Block className="h-[44px] w-full rounded-xl" />
                      </div>
                    ))}
                  </div>
                ))}

                <div>
                  <Block className="mb-1.5 h-4 w-12 rounded-md" />
                  <Block className="h-[44px] w-full rounded-xl" />
                </div>
                <div className="flex items-center gap-2">
                  <Block className="h-4 w-4 shrink-0 rounded-md" />
                  <Block className="h-4 w-40 rounded-md" />
                </div>
                <Block className="h-[46px] w-full rounded-xl" />
              </div>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card className="min-h-[414px] p-6">
              <Block className="h-7 w-16 rounded-lg" />
              <div className="flex min-h-[285px] translate-y-[40px] flex-col items-center justify-center text-center">
                <Block className="h-12 w-12 rounded-2xl" />
                <Block className="mt-4 h-5 w-52 rounded-md" />
                <Block className="mt-3 h-4 w-40 rounded-md" />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function GithubSyncSkeleton() {
  const tabs = [
    'w-[120px]',
    'w-[117px]',
    'w-[135px]',
    'w-[150px]',
    'w-[143px]',
  ];
  return (
    <>
      <div className="mb-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <Block className="h-12 w-12 shrink-0 rounded-2xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <Block className="h-10 w-60 max-w-[62vw] rounded-xl" />
              <Block className="h-6 w-[104px] rounded-full" />
            </div>
            <Block className="mt-3 h-5 w-[500px] max-w-[72vw] rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:-mt-2 lg:ml-auto lg:flex lg:justify-end">
          <Block className="h-[37px] w-full rounded-xl lg:w-[138px]" />
          <Block className="h-[37px] w-full rounded-xl lg:w-[110px]" />
          <Block className="h-[37px] w-full rounded-xl lg:w-[124px]" />
        </div>
      </div>
      <div className="mb-6 flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
        {tabs.map((width, index) => (
          <Block
            key={index}
            className={`h-[38px] ${width} shrink-0 rounded-xl`}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="h-[112px] p-5">
            <div className="flex h-full items-center gap-3">
              <Block
                className={`h-11 w-11 shrink-0 rounded-xl ${(
                  <Block className="h-11 w-11 shrink-0 rounded-xl bg-slate-300/80 dark:bg-slate-600/80" />
                )}`}
              />
              <div className="min-w-0 flex-1">
                <Block className="h-4 w-28 rounded-md" />
                <Block className="mt-2 h-7 w-24 rounded-lg" />
                <Block className="mt-1 h-4 w-32 max-w-full rounded-md" />
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div className="flex h-[86px] flex-wrap content-center items-center gap-2">
        <Block className="h-[38px] w-[132px] rounded-xl" />
        <Block className="h-[38px] w-[218px] rounded-xl" />
        <Block className="h-[38px] w-[168px] rounded-xl" />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <Card key={index} className="h-[97px] p-5">
            <div className="flex h-full translate-y-1.5 flex-col justify-center">
              <div className="flex items-center gap-2">
                {/* Globe or chart icon */}
                <Block className="h-5 w-5 shrink-0 rounded-md" />

                {/* By Repository or By Platform */}
                <Block className="h-5 w-[168px] rounded-md" />
              </div>

              <div className="mt-3 flex items-center justify-between gap-4">
                {/* Repository name or Unspecified */}
                <Block
                  className={`h-5 rounded-md ${
                    index === 0 ? 'w-[290px]' : 'w-[150px]'
                  }`}
                />

                {/* 85 badge */}
                <Block className="h-7 w-12 shrink-0 rounded-full" />
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card className="h-[173px] p-5">
        <div>
          <div className="flex items-center gap-2">
            <Block className="h-5 w-5 shrink-0 rounded-md" />
            <Block className="h-5 w-[218px] rounded-md" />
          </div>

          <Block className="mt-4 h-4 w-28 rounded-md" />

          <div className="mt-2 flex items-center gap-3">
            <Block className="h-[42px] min-w-0 flex-1 rounded-xl" />
            <Block className="h-5 w-5 shrink-0 rounded-md" />
          </div>

          <div className="mt-3 flex items-center gap-3">
            <Block className="h-3 w-3 shrink-0 rounded-full bg-red-400/80 dark:bg-red-500/80" />
            <Block className="h-4 w-[145px] rounded-md" />

            <Block className="h-4 w-1 rounded-md" />

            <Block className="h-3 w-3 shrink-0 rounded-full bg-amber-400/80 dark:bg-amber-500/80" />
            <Block className="h-4 w-[115px] rounded-md" />
          </div>
        </div>
      </Card>
    </>
  );
}
function FeatureFlagsSkeleton() {
  const cards = [true, true, false, true, true, false, false];

  return (
    <>
      <div className="mb-9 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Block className="h-12 w-12 shrink-0 rounded-2xl" />
          <div>
            <Block className="mb-2 h-4 w-44 rounded-md" />
            <Block className="h-11 w-[230px] max-w-[60vw] rounded-xl" />
            <Block className="mt-3 h-5 w-[410px] max-w-[72vw] rounded-md" />
          </div>
        </div>
        <Block className="mt-1 h-[42px] w-[110px] rounded-xl" />
      </div>

      <div className="mb-[34px] grid grid-cols-3 gap-4">
        {['blue', 'green', 'rose'].map((tone) => (
          <div
            key={tone}
            className={`h-[155px] rounded-3xl border p-5 ${
              tone === 'blue'
                ? 'border-blue-200 bg-blue-100/60 dark:border-blue-900/40 dark:bg-blue-900/40'
                : tone === 'green'
                  ? 'border-green-200 bg-green-100/60 dark:border-green-900/40 dark:bg-green-900/40'
                  : 'border-rose-200 bg-rose-100/60 dark:border-rose-900/40 dark:bg-rose-900/40'
            }`}
          >
            <Block className="mb-4 h-10 w-10 rounded-2xl" />
            <Block className="h-8 w-8 rounded-lg" />
            <Block className="mt-3 h-4 w-full max-w-28 rounded-md" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((enabled, index) => (
          <Card
            key={index}
            className={`relative min-h-[214px] overflow-hidden p-5 xl:min-h-[158px] ${
              enabled ? 'dark:bg-slate-900' : 'dark:bg-slate-800/60'
            }`}
          >
            <div
              className={`absolute inset-y-0 left-0 w-1 ${
                enabled ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
            />
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Block className="h-5 w-24 rounded-md" />

                  <Block className="h-6 w-12 shrink-0 rounded-full" />
                </div>

                <Block className="mt-3 h-4 w-full max-w-[145px] rounded-md" />
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
                <Block className="h-[38px] w-[86px] rounded-xl" />

                <Block className="h-[38px] w-[66px] rounded-xl" />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 items-center gap-x-3 gap-y-2 xl:grid-cols-[auto_auto_1fr]">
              <Block className="h-4 w-24 rounded-md" />

              <Block className="h-4 w-20 rounded-md" />

              <Block className="col-span-2 h-4 w-28 justify-self-end rounded-md xl:col-span-1" />
            </div>

            <Block className="mt-3 h-4 w-16 rounded-md" />
          </Card>
        ))}
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
  if (kind === 'admin') body = <AdminUsersSkeleton />;
  else if (kind === 'departments') body = <DepartmentsSkeleton />;
  else if (kind === 'dashboard')
    body = <Dashboard intern={role === 'INTERN'} />;
  else if (kind === 'team') body = <Team />;
  else if (kind === 'attendance') body = <Attendance />;
  else if (kind === 'ratings') body = <Ratings />;
  else if (kind === 'tasks') body = <Tasks />;
  else if (kind === 'meetings') body = <Meetings />;
  else if (kind === 'hr') body = <HRSkeleton />;
  else if (kind === 'analytics') body = <Analytics />;
  else if (kind === 'reports') body = <ReportsSkeleton />;
  else if (kind === 'report-templates') body = <TemplatesSkeleton />;
  else if (kind === 'exports') body = <ExportsSkeleton />;
  else if (kind === 'notices') body = <NoticesSkeleton />;
  else if (kind === 'notifications') body = <NotificationsSkeleton />;
  else if (kind === 'sessions') body = <SessionsSkeleton />;
  else if (kind === 'profile') body = <ProfileSkeleton role={role} />;
  else if (kind === 'internops') body = <InternOpsSkeleton />;
  else if (kind === 'performance-intelligence')
    body = <PerformanceIntelligenceSkeleton />;
  else if (kind === 'department-attendance')
    body = <DepartmentAttendanceSkeleton />;
  else if (kind === 'department-ratings') body = <DepartmentRatingsSkeleton />;
  else if (kind === 'department-tasks') body = <Tasks department />;
  else if (kind === 'project-detail') body = <ProjectDetailSkeleton />;
  else if (kind === 'department-projects')
    body = <DepartmentProjectsSkeleton />;
  else if (kind === 'task-detail') body = <TaskDetails />;
  else if (kind === 'feature-flags') body = <FeatureFlagsSkeleton />;
  else if (kind === 'github-sync') body = <GithubSyncSkeleton />;
  else if (kind === 'ai-certificates') body = <AICertificatesSkeleton />;
  else if (kind === 'quick-generate') body = <QuickGenerateSkeleton />;
  else if (kind === 'bulk-generate') body = <BulkGenerateSkeleton />;
  else if (kind === 'audit') body = <AuditLogSkeleton />;
  else if (kind === 'assistant') body = <AssistantSkeleton />;
  else if (kind === 'certificates') body = <CertificatesSkeleton />;
  else if (kind === 'canva-templates') body = <CanvaTemplatesSkeleton />;
  else body = <Generic />;
  return (
    <section
      className="relative min-h-[calc(100vh-7rem)]"
      style={{ '--skeleton-pulse-delay': `${pulseDelay}ms` }}
      aria-label="Loading page content"
      data-testid={`refresh-skeleton-${kind}`}
    >
      {body}
      {kind !== 'canva-templates' && (
        <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
          {slow ? 'This is taking longer than usual...' : 'Loading page...'}
        </p>
      )}
    </section>
  );
}
