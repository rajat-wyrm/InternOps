import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import WorkbookImportModal from '../components/admin/WorkbookImportModal';

vi.mock('../lib/axios', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: [] })),
    post: vi.fn(),
  },
}));

describe('WorkbookImportModal portal', () => {
  test('renders in document.body without rendering document.body as a child', () => {
    const onClose = vi.fn();
    const { container, unmount } = render(
      <WorkbookImportModal open onClose={onClose} />
    );

    expect(container).toBeEmptyDOMElement();
    expect(
      screen.getByRole('dialog', { name: /preview intern workbook/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Import current interns')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /close workbook preview/i })
    );
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(
      screen.queryByRole('dialog', { name: /preview intern workbook/i })
    ).toBeNull();
  });
});

test('resets the modal body scroll when expanding and restoring', () => {
  const onClose = vi.fn();
  let animationFrameCallback;
  vi.stubGlobal('requestAnimationFrame', (callback) => {
    animationFrameCallback = callback;
    return 1;
  });

  render(<WorkbookImportModal open onClose={onClose} />);
  const body = screen.getByTestId('workbook-modal-body');
  body.scrollTo = vi.fn();
  body.scrollTop = 240;

  fireEvent.click(
    screen.getByRole('button', { name: /expand workbook preview/i })
  );
  act(() => animationFrameCallback());
  expect(body.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' });
  expect(
    screen.getByRole('button', { name: /restore workbook preview size/i })
  ).toBeInTheDocument();

  body.scrollTop = 180;
  fireEvent.click(
    screen.getByRole('button', { name: /restore workbook preview size/i })
  );
  act(() => animationFrameCallback());
  expect(body.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' });
  expect(
    screen.getByRole('button', { name: /expand workbook preview/i })
  ).toBeInTheDocument();

  vi.unstubAllGlobals();
});

test('uses completed assignment wording instead of dry-run or manager labels', () => {
  render(<WorkbookImportModal open onClose={vi.fn()} />);
  expect(screen.getByText('Assign to department')).toBeInTheDocument();
  expect(screen.getByText('Assign direct manager')).toBeInTheDocument();
  expect(
    screen.getByText('Select Senior TL, TL, or Captain')
  ).toBeInTheDocument();
  expect(screen.queryByText(/account dry run/i)).toBeNull();
  expect(screen.queryByText(/TL manager/i)).toBeNull();
});

test('workbook modal source includes expand toggle and one-line email action', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(
    path.resolve(__dirname, '../components/admin/WorkbookImportModal.jsx'),
    'utf8'
  );
  expect(source).toContain('Expand workbook preview');
  expect(source).toContain('Restore workbook preview size');
  expect(source).toContain('whitespace-nowrap');
});

test('manual review source includes attendance completion history', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(
    path.resolve(__dirname, '../components/admin/WorkbookImportModal.jsx'),
    'utf8'
  );
  expect(source).toContain('Completion-date history');
  expect(source).toContain('completionDateHistory');
  expect(source).toContain('Attendance records,');
  expect(source).toContain('completion dates remain');
  expect(source).toContain('authoritative.');
});

test('source includes guarded execute endpoint and confirmation', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(
    path.resolve(__dirname, '../components/admin/WorkbookImportModal.jsx'),
    'utf8'
  );
  expect(source).toContain("'/workbook-imports/execute'");
  expect(source).toContain('previewFingerprint: preview.previewFingerprint');
  expect(source).toContain(
    'emailPreviewFingerprint: preview.emailPreviewFingerprint'
  );
  expect(source).toContain('window.confirm');
  expect(source).toContain('!preview.importBlocked');
  expect(source).toContain('Import completed successfully');
  expect(source).toContain('valid weekly ratings into Neon');
  expect(source).toContain("ratingSheets: 'Rating sheets'");
  expect(source).toContain(
    "ratingAfterCompletionExcluded: 'Ratings after completion excluded'"
  );
  expect(source).not.toContain('accountPlanRatingsToImport');
});

test('source presents attendance-only counts with readable labels', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(
    path.resolve(__dirname, '../components/admin/WorkbookImportModal.jsx'),
    'utf8'
  );
  expect(source).toContain('Active attendance to import');
  expect(source).toContain('Non-active attendance excluded');
  expect(source).toContain('Primary email sheet');
  expect(source).toContain('Fallback email sheet');
  expect(source).toContain('Primary email rows');
  expect(source).toContain('Fallback email rows');
  expect(source).toContain('Not included in this attendance-only import');
  expect(source).toContain('allAttendance - activeAttendance');
  expect(source).not.toContain(
    "accountPlanAttendanceExcluded: 'Attendance excluded'"
  );
  expect(source).not.toContain(
    "databaseUnmatchedAttendance: 'Unmatched attendance'"
  );
});

test('source allows the optimized transactional import to finish', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(
    path.resolve(__dirname, '../components/admin/WorkbookImportModal.jsx'),
    'utf8'
  );
  expect(source).toContain('timeout: 600000');
  expect(source).toContain('Importing transaction...');
  expect(source).toContain('disabled={!canImport}');
});

test('source displays privacy-safe duplicate review details', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(
    path.resolve(__dirname, '../components/admin/WorkbookImportModal.jsx'),
    'utf8'
  );
  expect(source).toContain('duplicateReview');
  expect(source).toContain('Duplicate {item.label}: {item.value}');
  expect(source).toContain('requestError.response?.data?.duplicates');
});

test('source includes role-aware leadership reuse counters', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(
    path.resolve(__dirname, '../components/admin/WorkbookImportModal.jsx'),
    'utf8'
  );
  expect(source).toContain('Existing leadership accounts reused');
  expect(source).toContain('People receiving attendance');
});

test('expanded preview keeps metric cards compact', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(
    path.resolve(__dirname, '../components/admin/WorkbookImportModal.jsx'),
    'utf8'
  );
  expect(source).toContain('auto-rows-min');
  expect(source).not.toContain("h-[calc(100vh-2rem)]'");
});

test('source supports reviewed database attendance conflict resolution', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(
    path.resolve(__dirname, '../components/admin/WorkbookImportModal.jsx'),
    'utf8'
  );
  expect(source).toContain("import CustomSelect from '../CustomSelect'");
  expect(source).toContain('Keep all existing');
  expect(source).toContain('Use all workbook values');
  expect(source).toContain('attendanceResolutions');
  expect(source).toContain('Clear email workbook');
  expect(source).toContain('Unresolved: {unresolvedDatabaseCount}');
  expect(source).toContain('Keep existing: {keptExistingCount}');
  expect(source).toContain('Use workbook: {useWorkbookCount}');
  expect(source).toContain('setDatabaseResolutions({});');
  expect(source).not.toContain("(conflict) => [conflict.id, 'KEEP_EXISTING']");
});
