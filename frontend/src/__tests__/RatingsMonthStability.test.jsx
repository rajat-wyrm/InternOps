import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const ratingsSource = fs.readFileSync(
  path.resolve(__dirname, '../pages/Ratings.jsx'),
  'utf8'
);
const repositorySource = fs.readFileSync(
  path.resolve(__dirname, '../../../backend/src/modules/ratings/repository.js'),
  'utf8'
);

describe('ratings month stability contracts', () => {
  test('does not replace the selected month after sheet data loads', () => {
    expect(ratingsSource).not.toContain(
      'setSelectedMonth(sheetAvailableMonths[0])'
    );
    expect(ratingsSource).toContain('const validSheetData = sheetData || null');
    expect(ratingsSource).toContain(
      'viewAll && !!activeDeptId && sheetIsLoading'
    );
  });

  test('keeps the current month selectable after a historical selection', () => {
    const sheetSource = fs.readFileSync(
      path.resolve(
        __dirname,
        '../components/department/DepartmentRatingsSheet.jsx'
      ),
      'utf8'
    );
    expect(ratingsSource).toContain('currentMonth={currentMonth}');
    expect(sheetSource).toContain('currentMonth,');
    expect(sheetSource).toContain('selectedMonth,');
    expect(sheetSource).toContain('...(data?.available_months || [])');
    expect(sheetSource).toMatch(/new\s+Set\s*\(/);
    expect(sheetSource).toMatch(
      /\.sort\s*\(\s*\(a,\s*b\)\s*=>\s*b\.localeCompare\(a\)\s*\)/s
    );
  });

  test('keeps the requested month available even without saved ratings', () => {
    expect(repositorySource).toContain('available_months: [');
    expect(repositorySource).toContain('selectedMonth,');
    expect(repositorySource).toContain(
      '.filter((month) => month !== selectedMonth)'
    );
  });
});
