import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const readAttendance = () =>
  fs.readFileSync(
    path.resolve(__dirname, '..', 'pages/Attendance.jsx'),
    'utf8'
  );

const normalizeWhitespace = (source) => source.replace(/\s+/g, ' ');

describe('attendance authorization UI', () => {
  it('uses the dedicated authorized-members endpoint for manager selectors', () => {
    const source = readAttendance();
    expect(source).toContain(".get('/attendance/authorized-members'");
    expect(source).not.toContain(".get('/hierarchy/full-team'");
  });

  it('allows Captain individual attendance without department resolution', () => {
    const source = readAttendance();
    expect(source).not.toContain("const isCaptain = user?.role === 'CAPTAIN'");
    expect(source).toContain('canViewAttendanceSheet &&');
    expect(source).not.toContain('if (!resolvedDeptId || isProjectView');
  });

  it('allows Captain hierarchy-scoped View All attendance', () => {
    const source = normalizeWhitespace(readAttendance());
    expect(source).toContain(
      "const canViewAttendanceSheet = [ 'ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN', ].includes(user?.role);"
    );
    expect(
      source.split('canViewAttendanceSheet && resolvedDeptId && (')
    ).toHaveLength(3);
    expect(source).toContain(
      "const assignedDeptId = departments[0]?.id || '';"
    );
  });
});
