const XLSX = require('xlsx');
const {
  previewWorkbook,
  excelDate,
  normalizeSheetName,
  normalizePhone,
  normalizeEmail,
  isAttendanceSheet,
  parseEmailDetailsWorkbook,
  parseRatingsSheets,
} = require('../../src/modules/workbook-imports/parser');

function addSheet(workbook, name, rows) {
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
}
function workbookBuffer() {
  const workbook = XLSX.utils.book_new();
  addSheet(workbook, 'Attendance - June', [
    ['NAME', 'Contact Info ', 'Status', 'Completion Date', 46174, 46175],
    ['Intern 001', '+91 90000 00001', 'Active', 46236, 'JOINED', 'PRESENT'],
  ]);
  addSheet(workbook, 'Attendance - July', [
    [
      'SRNO.',
      'NAME',
      'Status',
      'Intern Code',
      'Contact Info ',
      'Completion Date',
      46204,
      46205,
    ],
    [
      1,
      'Intern 001',
      'Active',
      'CODE-001',
      '+91 90000 00001',
      46236,
      'PRESENT',
      'LEAVE',
    ],
    [
      2,
      'Intern 002',
      'In-Active',
      'CODE-002',
      '+91 90000 00002',
      46236,
      'PRESENT',
      'Discountinued',
    ],
  ]);
  addSheet(workbook, 'Ratings - July', [
    ['NAME', 'Rating'],
    ['Intern 999', 10],
  ]);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

describe('workbook import preview parser', () => {
  test('normalizes workbook-specific values', () => {
    expect(normalizeSheetName('Attendnace - Aug')).toBe('Attendance - Aug');
    expect(isAttendanceSheet('Attendnace - Aug')).toBe(true);
    expect(isAttendanceSheet('Ratings - Aug')).toBe(false);
    expect(normalizePhone('+91 90000 00001')).toBe('9000000001');
    expect(excelDate(46235)).toMatch(/^2026-/);
  });
  test('normalizes real workbook email values without inventing fallbacks', () => {
    expect(normalizeEmail(' Person@Gmail.com ')).toBe('person@gmail.com');
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail('not-an-email')).toBeNull();
  });
  test('ignores non-attendance sheets', () => {
    const preview = previewWorkbook(workbookBuffer());
    expect(preview.summary.attendanceSheets).toBe(2);
    expect(preview.summary.ignoredSheets).toBe(1);
    expect(preview.interns.some((intern) => intern.name === 'Intern 999')).toBe(
      false
    );
  });
  test('reconciles code, phone, and name aliases across months', () => {
    const preview = previewWorkbook(workbookBuffer());
    expect(preview.summary.uniqueInterns).toBe(2);
    const first = preview.interns.find((intern) => intern.code === 'CODE-001');
    expect(first.aliases).toEqual(['phone:9000000001']);
    expect(first.sources).toHaveLength(2);
    expect(first.joinedDate).toBeTruthy();
  });

  test('accepts real intern names while rejecting report rows', () => {
    const workbook = XLSX.utils.book_new();
    addSheet(workbook, 'Attendance - August', [
      ['NAME', 'Intern Code', 'Contact Info ', 'Status', 46235, 46236],
      [
        'Sample Person',
        'REAL-001',
        '+91 98765 43210',
        'Active',
        'JOINED',
        'PRESENT',
      ],
      ['Another Person', '', '+91 98765 43211', 'Active', '', 'LEAVE'],
      ['TOTAL', '', '', '', 2, 2],
      ['NOTES', '', '', 'Internal report note', '', ''],
      ['', '', '', '', '', ''],
    ]);
    const preview = previewWorkbook(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    );
    expect(preview.summary.uniqueInterns).toBe(2);
    expect(preview.summary.attendanceRecords).toBe(2);
    expect(preview.interns.map((intern) => intern.name)).toEqual([
      'Sample Person',
      'Another Person',
    ]);
    expect(preview.interns.some((intern) => intern.name === 'TOTAL')).toBe(
      false
    );
    expect(preview.interns.some((intern) => intern.name === 'NOTES')).toBe(
      false
    );
  });

  test('does not treat lifecycle markers as attendance statuses', () => {
    const preview = previewWorkbook(workbookBuffer());
    const second = preview.interns.find((intern) => intern.code === 'CODE-002');
    expect(second.lifecycle.status).toBe('DISCONTINUED');
    expect(second.attendance).toHaveLength(1);
  });
  test('blocks import when duplicate rows disagree for one date', () => {
    const workbook = XLSX.utils.book_new();
    addSheet(workbook, 'Attendance - July', [
      ['NAME', 'Intern Code', 'Contact Info ', 46204],
      ['Intern 051', 'CODE-051', '+91 90000 00051', 'LEAVE'],
      ['Intern 051', 'CODE-051', '+91 90000 00051', 'PRESENT'],
    ]);
    const preview = previewWorkbook(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    );
    expect(preview.importBlocked).toBe(true);
    expect(preview.summary.reviewRequired).toBe(1);
    expect(preview.conflicts[0]).toMatchObject({
      resolution: 'REVIEW_REQUIRED',
      existing: 'LEAVE',
      incoming: 'PRESENT',
    });
  });
});

describe('workbook conflict resolution validation', () => {
  const {
    fingerprint,
    validateConflictResolutions,
  } = require('../../src/modules/workbook-imports/service');

  test('creates a deterministic fingerprint for the uploaded workbook', () => {
    const buffer = workbookBuffer();
    expect(fingerprint(buffer)).toBe(fingerprint(buffer));
    expect(fingerprint(buffer)).toHaveLength(64);
  });

  test('requires one supported resolution for every conflict', () => {
    const preview = {
      conflicts: [{ id: 'CODE-051|2026-07-25|84|94' }],
    };

    expect(validateConflictResolutions(preview, {})).toMatchObject({
      valid: false,
      required: 1,
      resolved: 0,
    });

    expect(
      validateConflictResolutions(preview, {
        'CODE-051|2026-07-25|84|94': 'USE_EXISTING',
      })
    ).toMatchObject({
      valid: true,
      required: 1,
      resolved: 1,
    });
  });

  test('rejects unsupported and foreign conflict resolutions', () => {
    const preview = { conflicts: [{ id: 'known' }] };
    const result = validateConflictResolutions(preview, {
      known: 'DELETE_EVERYTHING',
      foreign: 'USE_EXISTING',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});

describe('workbook read-only database comparison', () => {
  const {
    compareWithDatabase,
  } = require('../../src/modules/workbook-imports/service');

  test('classifies new, matched, unchanged, and conflicting records without writes', () => {
    const preview = {
      interns: [
        {
          key: 'code:CODE-001',
          name: 'Intern 001',
          phone: '9000000001',
          joinedDate: '2026-06-01',
          workbookStatus: 'ACTIVE',
          lifecycle: null,
          attendance: [
            { date: '2026-07-01', status: 'PRESENT' },
            { date: '2026-07-02', status: 'ABSENT' },
            { date: '2026-07-03', status: 'PRESENT' },
          ],
        },
        {
          key: 'code:CODE-002',
          name: 'Intern 002',
          phone: '9000000002',
          attendance: [{ date: '2026-07-01', status: 'PRESENT' }],
        },
      ],
    };
    const users = [
      {
        id: 'user-1',
        full_name: 'Intern 001',
        phone: '9000000001',
        joining_date: '2026-06-01',
        internship_status: 'ACTIVE',
      },
    ];
    const attendance = [
      { user_id: 'user-1', date: '2026-07-01', status: 'PRESENT' },
      { user_id: 'user-1', date: '2026-07-02', status: 'PRESENT' },
    ];
    const result = compareWithDatabase(preview, users, attendance);
    expect(result).toMatchObject({
      enabled: true,
      mode: 'read-only',
      writesAllowed: false,
      counts: {
        databaseMatched: 1,
        databaseNewCandidates: 1,
        databaseNewAttendance: 1,
        databaseUnchangedAttendance: 1,
        databaseAttendanceConflicts: 1,
        databaseUnmatchedAttendance: 1,
      },
    });
  });

  test('uses profile joining date instead of the Attendance JOINED marker', () => {
    const result = compareWithDatabase(
      {
        interns: [
          {
            key: 'code:DATE-001',
            name: 'Joining Date Person',
            phone: '9000000024',
            joinedDate: '2026-04-27',
            profileJoiningDate: '2026-04-24',
            workbookStatus: 'ACTIVE',
            lifecycle: null,
            attendance: [],
          },
        ],
      },
      [
        {
          id: 'date-user-1',
          full_name: 'Joining Date Person',
          phone: '9000000024',
          joining_date: '2026-04-24',
          internship_status: 'ACTIVE',
        },
      ],
      []
    );
    expect(result.interns[0].profileDifferences).toEqual([]);
    expect(result.interns[0].status).toBe('MATCHED');
  });
  test('counts attendance beyond the ten-row browser sample', () => {
    const fullAttendance = Array.from({ length: 14 }, (_, index) => ({
      date: `2026-07-${String(index + 1).padStart(2, '0')}`,
      status: 'PRESENT',
    }));
    const result = compareWithDatabase(
      {
        interns: [
          {
            key: 'code:CODE-014',
            name: 'Intern 014',
            phone: '9000000014',
            attendance: fullAttendance,
          },
        ],
      },
      [],
      []
    );
    expect(result.counts.databaseNewCandidates).toBe(1);
    expect(result.counts.databaseUnmatchedAttendance).toBe(14);
  });

  test('requires review when a normalized identity matches more than one Neon user', () => {
    const preview = {
      interns: [
        {
          key: 'name:intern 001',
          name: 'Intern 001',
          phone: null,
          attendance: [],
        },
      ],
    };
    const users = [
      { id: 'one', full_name: 'Intern 001', phone: null },
      { id: 'two', full_name: ' Intern 001 ', phone: null },
    ];
    const result = compareWithDatabase(preview, users, []);
    expect(result.counts.databaseAmbiguous).toBe(1);
    expect(result.interns[0].status).toBe('REVIEW_REQUIRED');
  });
});

describe('workbook identity aliases', () => {
  const { aliasesFor } = require('../../src/modules/workbook-imports/parser');

  test('uses phone as the primary identity alias', () => {
    expect(
      aliasesFor({
        code: 'RECENT-001',
        phone: '+91 98765 43210',
        name: 'Sample Person',
      })
    ).toEqual(['phone:9876543210']);
  });

  test('falls back to code and then name only when phone is missing', () => {
    expect(
      aliasesFor({ code: 'RECENT-001', phone: '', name: 'Sample Person' })
    ).toEqual(['code:RECENT-001']);
    expect(aliasesFor({ code: '', phone: '', name: 'Sample Person' })).toEqual([
      'name:SAMPLE PERSON',
    ]);
  });

  test('keeps different phone numbers as different interns even when names repeat', () => {
    const workbook = XLSX.utils.book_new();
    addSheet(workbook, 'Attendance - June', [
      ['NAME', 'Intern Code', 'Contact Info ', 'Status', 46290],
      ['Repeated Name', '', '+91 98765 43210', 'Active', 'INFORMED'],
      ['Repeated Name', '', '+91 98765 43211', 'Active', 'PRESENT'],
    ]);
    const preview = previewWorkbook(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    );
    expect(preview.summary.uniqueInterns).toBe(2);
    expect(preview.summary.reviewRequired).toBe(0);
  });
});

describe('active intern account dry run', () => {
  const {
    buildActiveAccountPlan,
  } = require('../../src/modules/workbook-imports/service');

  test('builds an active-only account dry run without attendance writes', () => {
    const interns = [
      {
        key: 'phone:9000000001',
        name: 'Active Intern',
        code: 'INT-001',
        phone: '9000000001',
        email: 'active@gmail.com',
        workbookStatus: 'Active',
        lifecycle: null,
        attendance: [{ date: '2026-08-01', status: 'PRESENT' }],
      },
      {
        key: 'phone:9000000002',
        name: 'Completed Intern',
        code: 'INT-002',
        phone: '9000000002',
        email: 'completed@gmail.com',
        workbookStatus: 'Completed',
        lifecycle: null,
        attendance: [{ date: '2026-08-01', status: 'PRESENT' }],
      },
      {
        key: 'phone:9000000003',
        name: 'Missing Email',
        code: 'INT-003',
        phone: '9000000003',
        email: null,
        workbookStatus: 'Active',
        lifecycle: null,
        attendance: [],
      },
    ];
    const plan = buildActiveAccountPlan(
      interns,
      {
        department: { id: 'department-1', name: 'AI Tutor' },
        manager: { id: 'manager-1', full_name: 'Senior TL' },
        existingInterns: [],
      },
      { departmentId: 'department-1', managerId: 'manager-1' }
    );
    expect(plan).toMatchObject({
      mode: 'active-account-dry-run',
      writesAllowed: false,
      attendanceImportEnabled: false,
      passwordChangeEnforcementReady: false,
      counts: {
        accountPlanTotal: 3,
        accountPlanActive: 2,
        accountPlanEligible: 1,
        accountPlanNonActiveExcluded: 1,
        accountPlanMissingEmail: 1,
        accountPlanManualReview: 1,
        accountPlanAttendanceExcluded: 2,
      },
    });
  });
});

describe('incomplete active identity handling', () => {
  const {
    buildActiveAccountPlan,
  } = require('../../src/modules/workbook-imports/service');
  test('skips a row when email, mobile, and Intern Code are all missing', () => {
    const plan = buildActiveAccountPlan(
      [
        {
          key: 'name:new intern',
          name: 'New Intern',
          code: null,
          phone: null,
          email: null,
          emailMatch: 'UNMATCHED',
          workbookStatus: 'Active',
          lifecycle: null,
          attendance: [{ date: '2026-08-26', status: 'PRESENT' }],
          sourceRows: [{ sheet: 'Attendance - Aug', row: 84 }],
        },
      ],
      {
        department: { id: 'department-1', name: 'AI Tutor' },
        manager: { id: 'manager-1', full_name: 'Manager' },
        existingInterns: [],
      },
      { departmentId: 'department-1', managerId: 'manager-1' }
    );
    expect(plan.counts).toMatchObject({
      accountPlanIncompleteIdentitySkipped: 1,
      accountPlanManualReview: 0,
    });
    expect(plan.manualReview).toEqual([]);
  });
  test('still requires review when only some identity fields are missing', () => {
    const plan = buildActiveAccountPlan(
      [
        {
          key: 'phone:9000000084',
          name: 'Partial Identity',
          code: null,
          phone: '9000000084',
          email: null,
          emailMatch: 'UNMATCHED',
          workbookStatus: 'Active',
          lifecycle: null,
          attendance: [],
          sourceRows: [{ sheet: 'Attendance - Aug', row: 84 }],
        },
      ],
      {
        department: { id: 'department-1', name: 'AI Tutor' },
        manager: { id: 'manager-1', full_name: 'Manager' },
        existingInterns: [],
      },
      { departmentId: 'department-1', managerId: 'manager-1' }
    );
    expect(plan.counts.accountPlanIncompleteIdentitySkipped).toBe(0);
    expect(plan.counts.accountPlanManualReview).toBe(1);
  });
});
describe('email details workbook matching', () => {
  const {
    applyEmailProfiles,
  } = require('../../src/modules/workbook-imports/service');
  test('parses Full details email profiles and matches phone before code', () => {
    const workbook = XLSX.utils.book_new();
    addSheet(workbook, 'Full details', [
      ['Intern Code', 'Name', 'Email ID', 'Mobile No'],
      ['INT-001', 'One', 'one@gmail.com', '+91 90000 00001'],
      ['INT-002', 'Two', 'two@gmail.com', '+91 90000 00002'],
    ]);
    const parsed = parseEmailDetailsWorkbook(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    );
    const result = applyEmailProfiles(
      [
        { code: 'OTHER', phone: '9000000001', workbookStatus: 'Active' },
        { code: 'INT-002', phone: null, workbookStatus: 'Active' },
      ],
      parsed.profiles
    );
    expect(result.counts.emailMatchedByPhone).toBe(1);
    expect(result.counts.emailMatchedByCode).toBe(1);
    expect(result.interns.map((intern) => intern.email)).toEqual([
      'one@gmail.com',
      'two@gmail.com',
    ]);
  });
  test('never matches an active intern by name alone', () => {
    const result = applyEmailProfiles(
      [
        {
          name: 'Same Name',
          phone: null,
          code: null,
          workbookStatus: 'Active',
        },
      ],
      [{ email: 'same@gmail.com', phone: null, code: null }]
    );
    expect(result.counts.emailUnmatchedActive).toBe(1);
    expect(result.interns[0].email).toBeNull();
  });
});

describe('active account manual-review privacy', () => {
  const {
    buildActiveAccountPlan,
  } = require('../../src/modules/workbook-imports/service');

  test('returns only privacy-safe manual-review details', () => {
    const plan = buildActiveAccountPlan(
      [
        {
          key: 'phone:9000000099',
          name: 'Private Person',
          code: null,
          phone: '9000000099',
          email: 'private@example.com',
          emailMatch: 'UNMATCHED',
          workbookStatus: 'Active',
          lifecycle: null,
          attendance: [],
          sourceRows: [{ sheet: 'Attendance - Aug', row: 81 }],
        },
      ],
      {
        department: { id: 'department-1', name: 'AI Tutor' },
        manager: { id: 'manager-1', full_name: 'Manager' },
        existingInterns: [],
      },
      { departmentId: 'department-1', managerId: 'manager-1' }
    );
    expect(plan.records).toBeUndefined();
    expect(plan.manualReview).toHaveLength(1);
    expect(plan.manualReview[0].reasons).toEqual(
      expect.arrayContaining(['MISSING_INTERN_CODE'])
    );
    expect(plan.manualReview[0]).toMatchObject({
      name: 'Private Person',
      maskedPhone: '******0099',
      sources: [{ sheet: 'Attendance - Aug', row: 81 }],
    });
    const serialized = JSON.stringify(plan.manualReview);
    expect(serialized).not.toContain('private@example.com');
    expect(serialized).not.toContain('9000000099');
  });
});

describe('active account email validation', () => {
  const {
    buildActiveAccountPlan,
    isValidAccountEmail,
  } = require('../../src/modules/workbook-imports/service');

  test('accepts valid college and organization email addresses', () => {
    expect(isValidAccountEmail('student@college.edu')).toBe(true);
    expect(isValidAccountEmail('student@university.ac.in')).toBe(true);
    expect(isValidAccountEmail('student@company.org')).toBe(true);
    expect(isValidAccountEmail('student@gmail.com')).toBe(true);
    expect(isValidAccountEmail('not-an-email')).toBe(false);
  });

  test('keeps a valid college-email active intern eligible', () => {
    const plan = buildActiveAccountPlan(
      [
        {
          key: 'phone:9000000077',
          name: 'College Email Intern',
          code: 'INT-077',
          phone: '9000000077',
          email: 'student@college.edu',
          emailMatch: 'PHONE',
          workbookStatus: 'Active',
          lifecycle: null,
          attendance: [],
        },
      ],
      {
        department: { id: 'department-1', name: 'AI Tutor' },
        manager: { id: 'manager-1', full_name: 'Manager' },
        existingInterns: [],
      },
      { departmentId: 'department-1', managerId: 'manager-1' }
    );
    expect(plan.counts.accountPlanEligible).toBe(1);
    expect(plan.counts.accountPlanInvalidGmail).toBe(0);
    expect(plan.counts.accountPlanManualReview).toBe(0);
  });
});

describe('manual-review source location', () => {
  const {
    buildActiveAccountPlan,
  } = require('../../src/modules/workbook-imports/service');

  test('shows the exact name, attendance source, and masked phone for review', () => {
    const plan = buildActiveAccountPlan(
      [
        {
          key: 'phone:9123456789',
          name: 'Review Intern',
          code: null,
          phone: '9123456789',
          email: null,
          emailMatch: 'UNMATCHED',
          workbookStatus: 'Active',
          lifecycle: null,
          attendance: [],
          sourceRows: [
            { sheet: 'Attendance - July', row: 44 },
            { sheet: 'Attendance - Aug', row: 81 },
          ],
        },
      ],
      {
        department: { id: 'department-1', name: 'AI Tutor' },
        manager: { id: 'manager-1', full_name: 'Manager' },
        existingInterns: [],
      },
      { departmentId: 'department-1', managerId: 'manager-1' }
    );
    expect(plan.manualReview[0]).toMatchObject({
      name: 'Review Intern',
      maskedPhone: '******6789',
      sources: [
        { sheet: 'Attendance - July', row: 44 },
        { sheet: 'Attendance - Aug', row: 81 },
      ],
      reasons: expect.arrayContaining(['MISSING_EMAIL', 'MISSING_INTERN_CODE']),
    });
    const serialized = JSON.stringify(plan.manualReview[0]);
    expect(serialized).not.toContain('9123456789');
  });
});

describe('Intern Details email fallback', () => {
  const {
    applyEmailProfiles,
    buildActiveAccountPlan,
  } = require('../../src/modules/workbook-imports/service');

  test('uses Intern Details only as a mobile fallback', () => {
    const profiles = [
      {
        email: 'primary@example.com',
        phone: '9000000001',
        code: 'INT-001',
        sourceSheet: 'Full details',
        sourceRow: 2,
        sourcePriority: 1,
        joiningDate: '2026-07-01',
        endingDate: '2026-10-01',
      },
      {
        email: 'fallback@example.com',
        phone: '9000000001',
        code: null,
        sourceSheet: 'Intern Details',
        sourceRow: 180,
        sourcePriority: 2,
        joiningDate: '2026-07-02',
        endingDate: '2026-10-02',
      },
      {
        email: 'second@example.com',
        phone: '9000000002',
        code: null,
        sourceSheet: 'Intern Details',
        sourceRow: 183,
        sourcePriority: 2,
        joiningDate: '2026-08-11',
        endingDate: '2026-11-11',
      },
    ];
    const result = applyEmailProfiles(
      [
        { code: 'INT-001', phone: '9000000001', workbookStatus: 'Active' },
        { code: null, phone: '9000000002', workbookStatus: 'Active' },
      ],
      profiles
    );
    expect(result.interns[0]).toMatchObject({
      email: 'primary@example.com',
      emailProfileSource: 'Full details',
    });
    expect(result.interns[1]).toMatchObject({
      email: 'second@example.com',
      emailProfileSource: 'Intern Details',
    });
    expect(result.counts.emailMatchedFromInternDetails).toBe(1);
  });

  test('does not use email profile dates for eligibility', () => {
    const plan = buildActiveAccountPlan(
      [
        {
          key: 'phone:9000000003',
          name: 'Email Only',
          code: 'INT-003',
          phone: '9000000003',
          email: 'student@college.edu',
          workbookStatus: 'Active',
          lifecycle: null,
          attendance: [],
          completionDate: null,
          profileEndingDate: '2026-06-05',
        },
      ],
      {
        department: { id: 'department-1' },
        manager: { id: 'manager-1' },
        existingInterns: [],
      },
      {
        departmentId: 'department-1',
        managerId: 'manager-1',
        asOfDate: '2026-08-23',
      }
    );
    expect(plan.counts.accountPlanEligible).toBe(1);
    expect(plan.counts.accountPlanStatusVerification).toBe(0);
  });
});

describe('email profile date parsing', () => {
  test('parses Intern Details profile dates', () => {
    const workbook = XLSX.utils.book_new();
    addSheet(workbook, 'Full details', [
      ['Intern Code', 'Email ID', 'Mobile No'],
      ['INT-001', 'primary@example.com', '9000000001'],
    ]);
    addSheet(workbook, 'Intern Details', [
      [
        'Time Stamp',
        'Name',
        'Domain',
        'Mobile Number (Whatsapp)',
        'Joining Date (On offer letter)',
        'Ending Date(On offer letter)',
        'Email',
      ],
      [
        '14/08/2026 20:11:49',
        'Fallback Intern',
        'Web development',
        '9000000002',
        '11/08/2026',
        '11/11/2026',
        'fallback@example.com',
      ],
    ]);
    const parsed = parseEmailDetailsWorkbook(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    );
    expect(parsed.primaryRows).toBe(1);
    expect(parsed.fallbackRows).toBe(1);
    expect(
      parsed.profiles.find(
        (profile) => profile.sourceSheet === 'Intern Details'
      )
    ).toMatchObject({
      joiningDate: '2026-08-11',
      endingDate: '2026-11-11',
      sourcePriority: 2,
    });
  });
});

describe('effective completion date extensions', () => {
  const {
    buildActiveAccountPlan,
  } = require('../../src/modules/workbook-imports/service');

  test('uses the newest attendance sheet completion date for extensions', () => {
    const workbook = XLSX.utils.book_new();
    addSheet(workbook, 'Attendance - June', [
      ['NAME', 'Intern Code', 'Contact Info ', 'Status', 'Completion Date'],
      ['Extended Intern', 'INT-900', '9000000900', 'Active', '2026-07-13'],
    ]);
    addSheet(workbook, 'Attendance - August', [
      ['NAME', 'Intern Code', 'Contact Info ', 'Status', 'Completion Date'],
      ['Extended Intern', 'INT-900', '9000000900', 'Active', '2026-10-13'],
    ]);
    const preview = previewWorkbook(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    );
    const intern = preview.interns[0];
    expect(intern.completionDate).toBe('2026-10-13');
    expect(intern.latestCompletionDateSource).toMatchObject({
      sheet: 'Attendance - August',
      row: 2,
      date: '2026-10-13',
    });

    const plan = buildActiveAccountPlan(
      [
        {
          ...intern,
          email: 'extended@college.edu',
          profileEndingDate: '2026-07-13',
        },
      ],
      {
        department: { id: 'department-1', name: 'AI Tutor' },
        manager: { id: 'manager-1', full_name: 'Manager' },
        existingInterns: [],
      },
      {
        departmentId: 'department-1',
        managerId: 'manager-1',
        asOfDate: '2026-08-23',
      }
    );
    expect(plan.counts.accountPlanStatusVerification).toBe(0);
    expect(plan.counts.accountPlanEligible).toBe(1);
  });

  test('does not fall back to an email profile ending date', () => {
    const plan = buildActiveAccountPlan(
      [
        {
          key: 'phone:9000000901',
          name: 'Profile Only',
          code: 'INT-901',
          phone: '9000000901',
          email: 'profile@college.edu',
          workbookStatus: 'Active',
          lifecycle: null,
          attendance: [],
          completionDate: null,
          profileEndingDate: '2026-07-01',
        },
      ],
      {
        department: { id: 'department-1' },
        manager: { id: 'manager-1' },
        existingInterns: [],
      },
      {
        departmentId: 'department-1',
        managerId: 'manager-1',
        asOfDate: '2026-08-23',
      }
    );
    expect(plan.counts.accountPlanEligible).toBe(1);
    expect(plan.counts.accountPlanStatusVerification).toBe(0);
  });
});

describe('completion history safety', () => {
  const {
    buildActiveAccountPlan,
  } = require('../../src/modules/workbook-imports/service');

  test('detects extensions from attendance history without a profile ending date', () => {
    const workbook = XLSX.utils.book_new();
    addSheet(workbook, 'Attendance - June', [
      ['NAME', 'Intern Code', 'Contact Info ', 'Status', 'Completion Date'],
      ['Extended Intern', 'INT-910', '9000000910', 'Active', '2026-07-13'],
    ]);
    addSheet(workbook, 'Attendance - August', [
      ['NAME', 'Intern Code', 'Contact Info ', 'Status', 'Completion Date'],
      ['Extended Intern', 'INT-910', '9000000910', 'Active', '2026-10-13'],
    ]);
    const intern = previewWorkbook(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    ).interns[0];
    expect(intern.extensionDetectedFromAttendance).toBe(true);
    expect(intern.completionDateHistory.map((source) => source.date)).toEqual([
      '2026-07-13',
      '2026-10-13',
    ]);
    const plan = buildActiveAccountPlan(
      [{ ...intern, email: 'extended@college.edu' }],
      {
        department: { id: 'department-1', name: 'AI Tutor' },
        manager: { id: 'manager-1', full_name: 'Manager' },
        existingInterns: [],
      },
      {
        departmentId: 'department-1',
        managerId: 'manager-1',
        asOfDate: '2026-08-23',
      }
    );
    expect(plan.counts.accountPlanEligible).toBe(1);
    expect(plan.counts.accountPlanStatusVerification).toBe(0);
  });

  test('requires completion review when duplicate rows in one month disagree', () => {
    const workbook = XLSX.utils.book_new();
    addSheet(workbook, 'Attendance - August', [
      ['NAME', 'Intern Code', 'Contact Info ', 'Status', 'Completion Date'],
      ['Duplicate Intern', 'INT-911', '9000000911', 'Active', '2026-10-13'],
      ['Duplicate Intern', 'INT-911', '9000000911', 'Active', '2026-11-13'],
    ]);
    const intern = previewWorkbook(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    ).interns[0];
    expect(intern.completionReviewReasons).toContain(
      'COMPLETION_DATE_CONFLICT'
    );
    const plan = buildActiveAccountPlan(
      [{ ...intern, email: 'duplicate@college.edu' }],
      {
        department: { id: 'department-1', name: 'AI Tutor' },
        manager: { id: 'manager-1', full_name: 'Manager' },
        existingInterns: [],
      },
      {
        departmentId: 'department-1',
        managerId: 'manager-1',
        asOfDate: '2026-08-23',
      }
    );
    expect(plan.counts.accountPlanEligible).toBe(0);
    expect(plan.counts.accountPlanManualReview).toBe(1);
    expect(plan.manualReview[0].reasons).toContain('COMPLETION_DATE_CONFLICT');
  });

  test('ignores numeric Extension cells as calculation metadata', () => {
    const workbook = XLSX.utils.book_new();
    addSheet(workbook, 'Attendance - August', [
      [
        'NAME',
        'Intern Code',
        'Contact Info ',
        'Status',
        'Completion Date',
        'Extension',
      ],
      [
        'Extension Calculation',
        'INT-912',
        '9000000912',
        'Active',
        '2026-10-15',
        12,
      ],
    ]);
    const intern = previewWorkbook(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    ).interns[0];
    expect(intern.extensionEvidence).toEqual([]);
    expect(intern.completionReviewReasons).not.toContain(
      'EXTENSION_DATE_MISSING'
    );
  });

  test('masks phone numbers in attendance conflicts', () => {
    const workbook = XLSX.utils.book_new();
    addSheet(workbook, 'Attendance - August', [
      ['NAME', 'Intern Code', 'Contact Info ', 46235],
      ['Private Conflict', 'INT-913', '9000000913', 'PRESENT'],
      ['Private Conflict', 'INT-913', '9000000913', 'LEAVE'],
    ]);
    const preview = previewWorkbook(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    );
    expect(preview.conflicts[0].phone).toBe('******0913');
    expect(JSON.stringify(preview.conflicts)).not.toContain('9000000913');
  });
});

describe('attendance sheet calendar authority', () => {
  test('a newer Active month overrides an older Completed lifecycle marker', () => {
    const workbook = XLSX.utils.book_new();
    addSheet(workbook, 'Attendance - June', [
      [
        'NAME',
        'Intern Code',
        'Contact Info ',
        'Status',
        'Completion Date',
        '2026-06-01',
        '2026-06-06',
      ],
      [
        'Reactivated Leader',
        'INT-919',
        '9000000919',
        'In-Active',
        '2026-06-06',
        'PRESENT',
        'COMPLETED',
      ],
    ]);
    addSheet(workbook, 'Attendance - July', [
      [
        'NAME',
        'Intern Code',
        'Contact Info ',
        'Status',
        'Completion Date',
        '2026-07-01',
      ],
      [
        'Reactivated Leader',
        'INT-919',
        '9000000919',
        'Active',
        '2026-09-06',
        'PRESENT',
      ],
    ]);
    addSheet(workbook, 'Attendance - Aug', [
      [
        'NAME',
        'Intern Code',
        'Contact Info ',
        'Status',
        'Completion Date',
        '2026-08-01',
      ],
      [
        'Reactivated Leader',
        'INT-919',
        '9000000919',
        'Active',
        '2026-09-06',
        'PRESENT',
      ],
    ]);
    const intern = previewWorkbook(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    ).interns[0];
    expect(intern.workbookStatus).toBe('Active');
    expect(intern.latestWorkbookStatusSource.sheet).toBe('Attendance - Aug');
    expect(intern.lifecycle).toBeNull();
    expect(intern.lifecycleEvents).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: 'COMPLETED' })])
    );
  });
  test('a newer lifecycle marker still overrides an older Active row', () => {
    const workbook = XLSX.utils.book_new();
    addSheet(workbook, 'Attendance - June', [
      ['NAME', 'Intern Code', 'Contact Info ', 'Status', '2026-06-01'],
      ['Later Completed', 'INT-918', '9000000918', 'Active', 'PRESENT'],
    ]);
    addSheet(workbook, 'Attendance - Aug', [
      [
        'NAME',
        'Intern Code',
        'Contact Info ',
        'Status',
        '2026-08-01',
        '2026-08-20',
      ],
      [
        'Later Completed',
        'INT-918',
        '9000000918',
        'In-Active',
        'PRESENT',
        'COMPLETED',
      ],
    ]);
    const intern = previewWorkbook(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    ).interns[0];
    expect(intern.lifecycle).toMatchObject({
      status: 'COMPLETED',
      date: '2026-08-20',
    });
  });
  test('uses calendar month when workbook tabs are newest first', () => {
    const workbook = XLSX.utils.book_new();
    addSheet(workbook, 'Attendance - Aug', [
      [
        'NAME',
        'Intern Code',
        'Contact Info ',
        'Status',
        'Completion Date',
        '2026-08-01',
      ],
      [
        'Reverse Tab Intern',
        'INT-920',
        '9000000920',
        'Active',
        '2026-10-17',
        'PRESENT',
      ],
    ]);
    addSheet(workbook, 'Attendance - June', [
      [
        'NAME',
        'Intern Code',
        'Contact Info ',
        'Status',
        'Completion Date',
        '2026-06-01',
      ],
      [
        'Reverse Tab Intern',
        'INT-920',
        '9000000920',
        'Active',
        '2026-07-17',
        'PRESENT',
      ],
    ]);
    const intern = previewWorkbook(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    ).interns[0];
    expect(intern.completionDate).toBe('2026-10-17');
    expect(intern.latestCompletionDateSource.sheet).toBe('Attendance - Aug');
    expect(intern.extensionDetectedFromAttendance).toBe(true);
  });
});

describe('lifecycle status as-of date', () => {
  function lifecycleWorkbook(markerDate, marker) {
    const workbook = XLSX.utils.book_new();
    addSheet(workbook, 'Attendance - Aug', [
      [
        'NAME',
        'Intern Code',
        'Contact Info ',
        'Status',
        'Completion Date',
        markerDate,
      ],
      [
        'Lifecycle Boundary Intern',
        'INT-BOUNDARY',
        '9000000999',
        'Active',
        '2026-08-31',
        marker,
      ],
    ]);
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  test.each(['COMPLETED', 'TERMINATED', 'DISCONTINUED'])(
    'ignores future %s events when resolving current status',
    (marker) => {
      const intern = previewWorkbook(lifecycleWorkbook('2026-08-31', marker), {
        asOfDate: '2026-08-26',
      }).interns[0];

      expect(intern.workbookStatus).toBe('Active');
      expect(intern.lifecycle).toBeNull();
      expect(intern.lifecycleEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: marker, date: '2026-08-31' }),
        ])
      );
    }
  );

  test('applies a lifecycle event on its effective date', () => {
    const intern = previewWorkbook(
      lifecycleWorkbook('2026-08-31', 'COMPLETED'),
      { asOfDate: '2026-08-31' }
    ).interns[0];

    expect(intern.lifecycle).toMatchObject({
      status: 'COMPLETED',
      date: '2026-08-31',
    });
  });

  test('applies a lifecycle event after its effective date', () => {
    const intern = previewWorkbook(
      lifecycleWorkbook('2026-08-25', 'COMPLETED'),
      { asOfDate: '2026-08-26' }
    ).interns[0];

    expect(intern.lifecycle).toMatchObject({
      status: 'COMPLETED',
      date: '2026-08-25',
    });
  });
});

describe('secure weekly ratings parsing', () => {
  test('matches by Intern Code plus phone, preserves decimals, and skips text scores', () => {
    const workbook = XLSX.utils.book_new();
    addSheet(workbook, 'Ratings - Aug', [
      [
        'Sno',
        'NAME',
        'Intern Code',
        'Contact Info',
        'Completion Date',
        'Reasons (Week 1)',
        '10th-15th',
      ],
      [
        1,
        'Current Intern',
        'INT-001',
        '+91 90000 00001',
        '2026-08-18',
        'Good work',
        8.5,
      ],
      [2, 'Leader', 'INT-002', '+91 90000 00002', '2026-08-18', 'STL', '-'],
    ]);
    const interns = [
      {
        name: 'Current Intern',
        code: 'INT-001',
        phone: '9000000001',
        attendance: [{ date: '2026-08-01' }],
      },
      {
        name: 'Leader',
        code: 'INT-002',
        phone: '9000000002',
        attendance: [{ date: '2026-08-01' }],
      },
    ];
    const summary = parseRatingsSheets(workbook, interns);
    expect(summary).toMatchObject({
      ratingRecords: 2,
      ratingScoreRecords: 1,
      ratingReasonOnlyRecords: 1,
    });

    expect(interns[0].ratings[0]).toMatchObject({
      score: 8.5,
      remarks: 'Good work',
      ratingDate: '2026-08-15',
    });

    expect(interns[1].ratings[0]).toMatchObject({
      score: null,
      remarks: 'STL',
      ratingDate: '2026-08-15',
    });
  });
  test('imports the completion week but skips periods starting after completion', () => {
    const workbook = XLSX.utils.book_new();
    addSheet(workbook, 'Ratings - Aug', [
      [
        'NAME',
        'Intern Code',
        'Contact Info',
        'Completion Date',
        'Reasons (Week 1)',
        '10th-15th',
        'Reasons (Week 2)',
        '17th-22th',
      ],
      [
        'Current Intern',
        'INT-001',
        '9000000001',
        '2026-08-18',
        'Earlier',
        8,
        'Final week',
        9,
      ],
    ]);
    const interns = [
      {
        name: 'Current Intern',
        code: 'INT-001',
        phone: '9000000001',
        attendance: [{ date: '2026-08-01' }],
      },
    ];
    parseRatingsSheets(workbook, interns);
    expect(interns[0].ratings).toHaveLength(2);
    expect(interns[0].ratings[1].remarks).toBe('Final week');
  });
});
