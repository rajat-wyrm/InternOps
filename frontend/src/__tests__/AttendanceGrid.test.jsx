import { describe, expect, test } from 'vitest';
import fs from 'fs';
import path from 'path';
const sheet = fs.readFileSync(
  path.resolve(
    __dirname,
    '../components/department/DepartmentAttendanceSheet.jsx'
  ),
  'utf8'
);
const team = fs.readFileSync(
  path.resolve(__dirname, '../pages/Team.jsx'),
  'utf8'
);
const home = fs.readFileSync(
  path.resolve(__dirname, '../pages/Home.jsx'),
  'utf8'
);
const attendance = fs.readFileSync(
  path.resolve(__dirname, '../pages/Attendance.jsx'),
  'utf8'
);
const usersRepository = fs.readFileSync(
  path.resolve(__dirname, '../../../backend/src/modules/users/repository.js'),
  'utf8'
);
const attendanceRoutes = fs.readFileSync(
  path.resolve(__dirname, '../../../backend/src/modules/attendance/routes.js'),
  'utf8'
);
const attendanceMarkForm = fs.readFileSync(
  path.resolve(__dirname, '../components/AttendanceMarkForm.jsx'),
  'utf8'
);
const bulkAttendanceForm = fs.readFileSync(
  path.resolve(__dirname, '../components/BulkAttendanceForm.jsx'),
  'utf8'
);
describe('attendance grid contracts', () => {
  test('current legend uses P A I while preserving historical Leave records', () => {
    for (const x of [
      "label: 'Present'",
      "label: 'Absent'",
      "label: 'Informed absence'",
      'bg-red-100',
      'bg-blue-100',
    ])
      expect(sheet).toContain(x);
    expect(sheet).toContain('LEAVE: {');
    expect(sheet).toMatch(
      /LEAVE:\s*\{[\s\S]*?symbol:\s*'L'[\s\S]*?label:\s*'Approved leave'/
    );
    expect(sheet).not.toContain("['PRESENT', 'ABSENT', 'INFORMED', 'LEAVE']");
  });
  test('sticky member role dates', () => {
    expect(sheet).toContain('sticky left-0 top-0 z-[60]');
    expect(sheet).toContain('sticky left-72 top-0 z-[60]');
    expect(sheet).toContain('sticky top-0 z-30');
  });
  test('Sunday and role ordering', () => {
    expect(sheet).toMatch(/\.getDay\(\)\s*!==\s*0/);
    expect(sheet).toContain('ROLE_ORDER');
  });
  test('finite attendance percent', () => {
    expect(team).toContain('Number.isFinite(total)');
    expect(team).toContain('present / total');
    expect(team).not.toContain('half_day_count) * 0.5');
  });
  test('dashboard and theme regressions', () => {
    expect(home).toContain('Number.isFinite(averageAttendance)');
    expect(team).toContain('DISPLAY_ROLE_ORDER');
    expect(sheet).toContain('bg-white');
    expect(sheet).toContain('dark:bg-slate-900');
    expect(sheet).toContain('border-slate-200');
    expect(sheet).toContain('dark:border-slate-700');
  });
  test('orders dropdown and users before pagination', () => {
    expect(attendance).toContain('ATTENDANCE_ROLE_ORDER');
    expect(attendance).toContain('sortAttendanceMembers([');
    expect(attendance).toContain('isCurrentUser: true');
    expect(usersRepository).toContain("WHEN 'ADMIN' THEN 0");
    expect(usersRepository.indexOf('ORDER BY')).toBeLessThan(
      usersRepository.indexOf('LIMIT $')
    );
    expect(attendanceRoutes).toContain("WHEN 'SENIOR_TL' THEN 1");
  });

  test('sticky identity columns are opaque and isolated', () => {
    expect(sheet).toContain('<colgroup>');
    expect(sheet).toContain('table-fixed');
    expect(sheet).toContain('isolate');
    expect(sheet).toContain('sticky left-0 z-50 bg-white dark:bg-slate-900');
    expect(sheet).toContain('sticky left-72 z-50 bg-white');
    expect(sheet).not.toContain(
      'shadow-[8px_0_12px_-10px_rgba(15,23,42,0.75)]'
    );
  });
  test('current attendance creation accepts only P A I', () => {
    expect(attendanceRoutes).toContain(
      "z.enum(['PRESENT', 'ABSENT', 'INFORMED'])"
    );
    expect(attendanceRoutes).not.toContain(
      "z.enum(['PRESENT', 'ABSENT', 'INFORMED', 'LEAVE'])"
    );
    expect(attendanceMarkForm).not.toContain(
      "{ value: 'LEAVE', label: 'Approved leave' }"
    );
    expect(bulkAttendanceForm).not.toContain(
      "{ value: 'LEAVE', label: 'Approved leave' }"
    );
  });
  test('lifecycle status and historical export contracts', () => {
    expect(sheet).toContain('LIFECYCLE_BADGE');
    expect(sheet).toContain('DISCONTINUED');
    expect(sheet).toMatch(/>\s*Status\s*<\/th>/);
    expect(sheet).toContain(
      "import DownloadDataMenu from '../DownloadDataMenu'"
    );
    expect(sheet).toContain('exportTable({');
    expect(sheet).toContain("sheetName: 'Attendance'");
  });
  test('month selection, JOINED timeline, and dark lifecycle badges', () => {
    expect(attendance).toContain('monthRange(selectedMonth, today)');
    expect(sheet).toContain('<CustomMonthPicker');
    expect(sheet).not.toContain('type="month"');
    expect(sheet).not.toContain('onFromChange');
    expect(sheet).not.toContain('onToChange');
    expect(sheet).toContain('JOINED');
    expect(sheet).toContain('member.joining_date');
    expect(sheet).toContain("return 'BEFORE_JOINING'");
    expect(sheet).toContain('dark:bg-emerald-950/70');
  });
  test('centers Role and Status values and renders lifecycle markers', () => {
    expect(sheet).toContain(
      '${ROLE_COLUMN} border-b border-r border-slate-200 px-5 py-4 text-center'
    );
    expect(sheet).toContain(
      '${STATUS_COLUMN} border-b border-r border-slate-200 px-5 py-4 text-center'
    );
    expect(sheet).toContain("return 'COMPLETED'");
    expect(sheet).toContain('return status;');
    expect(sheet).toContain('<TimelineMark status={cellState} />');
    expect(sheet).not.toContain('&nbsp;');
    expect(sheet).toMatch(
      /aria-label=\{\s*unavailable\s*\?\s*'Not applicable'\s*:\s*'No record'\s*\}/
    );
  });
  test('month roster excludes members outside lifecycle range', () => {
    const repository = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../backend/src/modules/attendance/repository.js'
      ),
      'utf8'
    );
    expect(repository).toContain('memberAppliesToRange(member, from, to)');
    expect(repository).toContain('.filter((member) =>');
    expect(repository).toContain('joinedOn > to');
    expect(repository).toContain('completedOn >= from');
    expect(repository).toContain('endedOn >= from');
  });
  test('custom month picker contracts', () => {
    const monthPicker = fs.readFileSync(
      path.resolve(__dirname, '../components/CustomMonthPicker.jsx'),
      'utf8'
    );
    expect(monthPicker).toContain('const MONTHS = [');
    expect(monthPicker).toContain("'September'");
    expect(monthPicker).toContain('grid grid-cols-3');
    expect(monthPicker).toContain('Previous year');
    expect(monthPicker).toContain('Next year');
    expect(monthPicker).toContain('dark:bg-slate-950');
    expect(monthPicker).toContain('disabled={unavailable}');
    expect(sheet).toContain(
      "import CustomMonthPicker from '../CustomMonthPicker'"
    );
  });
  test('restricts attendance month selection to months with records', () => {
    const repository = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../backend/src/modules/attendance/repository.js'
      ),
      'utf8'
    );
    const monthPicker = fs.readFileSync(
      path.resolve(__dirname, '../components/CustomMonthPicker.jsx'),
      'utf8'
    );
    expect(repository).toContain("TO_CHAR(a.date, 'YYYY-MM') AS month");
    expect(repository).toContain('a.deleted_at IS NULL');
    expect(repository).toContain('available_months: availableMonths');
    expect(sheet).toContain('allowedMonths={data?.available_months ?? []}');
    expect(sheet).toContain(
      'No attendance records are available for this team.'
    );
    expect(attendance).toContain('sheetData?.available_months || []');
    expect(attendance).toContain(
      'sheetAvailableMonths[sheetAvailableMonths.length - 1]'
    );
    expect(monthPicker).toContain(
      'Array.isArray(allowedMonths) ? new Set(allowedMonths) : null'
    );
    expect(monthPicker).toContain(
      'if (allowed && !allowedYears.length) return;'
    );
  });
  test('waits for month popup positioning before display', () => {
    const monthPicker = fs.readFileSync(
      path.resolve(__dirname, '../components/CustomMonthPicker.jsx'),
      'utf8'
    );
    expect(monthPicker).toContain('positionReady');
    expect(monthPicker).toContain(
      "visibility: positionReady ? 'visible' : 'hidden'"
    );
    expect(monthPicker).toContain(
      "pointerEvents: positionReady ? 'auto' : 'none'"
    );
    expect(monthPicker).toContain('setPositionReady(true)');
    expect(monthPicker).toContain('setPositionReady(false)');
  });
});
