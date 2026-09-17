import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (file) =>
  fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
const normalizeWhitespace = (source) => source.replace(/\s+/g, ' ');

describe('manager assigned department defaults', () => {
  it('syncs both attendance forms when the assigned department arrives', () => {
    for (const file of [
      'components/AttendanceMarkForm.jsx',
      'components/BulkAttendanceForm.jsx',
    ]) {
      const source = read(file);
      expect(source).toContain(
        'if (!propDeptId || propDeptId === departmentId) return;'
      );
      expect(source).toContain('setDepartmentId(propDeptId);');
    }
  });

  it('allows Captain View All through the hierarchy-scoped sheet', () => {
    const source = normalizeWhitespace(read('pages/Attendance.jsx'));
    expect(source).toContain(
      "const canViewAttendanceSheet = [ 'ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN', ].includes(user?.role);"
    );
    expect(source).toContain(
      "const assignedDeptId = departments[0]?.id || '';"
    );
    expect(
      source.split('canViewAttendanceSheet && resolvedDeptId && (')
    ).toHaveLength(3);
  });

  it('defaults Ratings and RatingForm to the assigned department', () => {
    const page = read('pages/Ratings.jsx');
    const form = read('components/RatingForm.jsx');
    expect(page).toContain('user?.departmentId || user?.department_id');
    expect(page).toContain('setViewDepartmentId(departments[0].id);');
    expect(page.match(/departmentId={activeDeptId}/g)).toHaveLength(2);
    expect(form).toContain('setDepartmentId(propDeptId);');
  });
});
