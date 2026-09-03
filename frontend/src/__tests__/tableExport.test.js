import { describe, expect, it } from 'vitest';
import {
  makeExportFileName,
  rowsToDelimited,
  rowsToHtml,
  safeFilePart,
  splitPdfColumnGroups,
  normalizeExportValue,
} from '../utils/tableExport';
describe('tableExport', () => {
  it('creates safe report names', () =>
    expect(makeExportFileName('ratings', 'AI Tutor', '2026-09', 'xlsx')).toBe(
      'ratings-AI-Tutor-2026-09.xlsx'
    ));
  it('escapes CSV values', () =>
    expect(
      rowsToDelimited(
        [{ key: 'name', label: 'Name' }],
        [{ name: 'Saini, Neeraj' }],
        ','
      )
    ).toContain('"Saini, Neeraj"'));
  it('escapes HTML values', () =>
    expect(
      rowsToHtml(
        'Report',
        [{ key: 'name', label: 'Name' }],
        [{ name: '<Admin>' }]
      )
    ).toContain('&lt;Admin&gt;'));
  it('preserves Unicode in safe names', () =>
    expect(safeFilePart('à¤¸à¥à¤µà¤¾à¤—à¤¤ à¤Ÿà¥€à¤®')).not.toBe('department'));
  it('keeps missing attendance records blank in exports', () => {
    expect(normalizeExportValue('No record')).toBe('');
    expect(normalizeExportValue('NO RECORD')).toBe('');
    expect(normalizeExportValue('PRESENT')).toBe('PRESENT');
  });

  it('splits attendance PDF dates into readable groups', () => {
    const columns = [
      ...Array.from({ length: 6 }, (_, index) => ({ key: `identity${index}` })),
      ...Array.from({ length: 16 }, (_, index) => ({ key: `date${index}` })),
    ];
    const groups = splitPdfColumnGroups(columns, 'Attendance');
    expect(groups).toHaveLength(3);
    expect(groups[0]).toHaveLength(13);
    expect(groups[2]).toHaveLength(8);
  });

  it('keeps one rating and reason pair on each PDF page', () => {
    const columns = [
      ...Array.from({ length: 6 }, (_, index) => ({
        key: `identity${index}`,
      })),
      ...Array.from({ length: 5 }, (_, index) => [
        { key: `rating${index}` },
        { key: `reason${index}` },
      ]).flat(),
    ];

    const groups = splitPdfColumnGroups(columns, 'Ratings');

    expect(groups).toHaveLength(5);
    expect(groups.every((group) => group.length === 8)).toBe(true);
  });

  it('creates designed HTML reports', () => {
    const html = rowsToHtml(
      'Attendance Report',
      [{ key: 'status', label: 'Status' }],
      [{ status: 'PRESENT' }]
    );
    expect(html).toContain('linear-gradient');
    expect(html).toContain('class="good"');
  });
});
