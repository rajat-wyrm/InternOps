const {
  parseEmailDetailsWorkbook,
} = require('../../src/modules/workbook-imports/parser');
const XLSX = require('xlsx');

describe('Active Interns Master', () => {
  it('is the highest-priority complete active profile source', () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        [
          'S. No.',
          'Name',
          'Status',
          'Intern Code',
          'Mobile No',
          'WhatsApp No',
          'Email ID',
          'Domain',
          'Department',
          'Location',
          'College',
          'Course',
          'Year',
          'Position',
          'Offer Letter',
          'Joining Date',
          'Completion Date',
        ],
        [
          1,
          'Master Person',
          'Active',
          'MASTER1',
          '919999999999',
          '919999999999',
          'master@example.com',
          'MERN Stack',
          'AI Tutor',
          'Delhi',
          'Master College',
          'B.Tech',
          '2026',
          'Developer',
          'https://example.com/offer',
          '2026-04-17',
          '2026-10-17',
        ],
      ]),
      'Active Interns Master'
    );
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        ['Intern Code', 'Email ID', 'Mobile No', 'College Name', 'Start Date'],
        [
          'MASTER1',
          'master@example.com',
          '919999999999',
          'Old College',
          '2026-04-22',
        ],
      ]),
      'Full details'
    );
    const parsed = parseEmailDetailsWorkbook(
      XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })
    );
    expect(parsed.masterRows).toBe(1);
    expect(
      parsed.profiles.find((row) => row.sourcePriority === 0)
    ).toMatchObject({
      name: 'Master Person',
      phone: '9999999999',
      joiningDate: '2026-04-17',
      endingDate: '2026-10-17',
      location: 'Delhi',
      yearOfStudy: '2026',
      position: 'Developer',
      department: 'AI Tutor',
    });
  });
  it('rejects duplicate master identities and implausible date ranges', () => {
    const makeBook = (rows) => {
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.aoa_to_sheet(rows),
        'Active Interns Master'
      );
      return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
    };
    const header = [
      'Name',
      'Status',
      'Intern Code',
      'Mobile No',
      'Email ID',
      'Domain',
      'Department',
      'Joining Date',
      'Completion Date',
    ];
    expect(() =>
      parseEmailDetailsWorkbook(
        makeBook([
          header,
          [
            'One',
            'Active',
            'DUP1',
            '919000000001',
            'one@example.com',
            'MERN',
            'AI Tutor',
            '2026-04-01',
            '2026-10-01',
          ],
          [
            'Two',
            'Active',
            'DUP1',
            '919000000002',
            'two@example.com',
            'MERN',
            'AI Tutor',
            '2026-04-02',
            '2026-10-02',
          ],
        ])
      )
    ).toThrow(/duplicate code/);
    expect(() =>
      parseEmailDetailsWorkbook(
        makeBook([
          header,
          [
            'Bad Date',
            'Active',
            'DATE1',
            '919000000003',
            'date@example.com',
            'MERN',
            'AI Tutor',
            '2004-07-29',
            '2026-10-20',
          ],
        ])
      )
    ).toThrow(/implausible date range/);
  });
});
describe('workbook profile enrichment parser', () => {
  it('parses approved profile fields from Intern Details', () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        [
          'Intern Code',
          'Email ID',
          'Mobile No',
          'Domain Name',
          'Start Date',
          'End Date',
        ],
        [
          'CODE1',
          'a@example.com',
          '9999999999',
          'MERN Stack',
          '2026-06-01',
          '2026-09-01',
        ],
      ]),
      'Full details'
    );
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        [
          'Email',
          'Mobile Number (Whatsapp)',
          'College Name',
          'Course',
          'Domain',
          'Joining Date (On offer letter)',
          'Ending Date(On offer letter)',
          'Upload Offer letter',
        ],
        [
          'a@example.com',
          '9999999999',
          'Example College',
          'BTech CSE',
          'MERN Stack',
          '2026-06-01',
          '2026-09-01',
          'https://example.com/offer',
        ],
      ]),
      'Intern Details'
    );
    const parsed = parseEmailDetailsWorkbook(
      XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })
    );
    const fallback = parsed.profiles.find((row) => row.sourcePriority === 2);
    expect(fallback).toMatchObject({
      college: 'Example College',
      course: 'BTech CSE',
      domain: 'MERN Stack',
      offerLetterUrl: 'https://example.com/offer',
    });
  });
});

const {
  applyEmailProfiles,
} = require('../../src/modules/workbook-imports/service');

describe('workbook profile source merge', () => {
  it('merges Intern Details fields into a primary Full details match', () => {
    const profiles = [
      {
        email: 'person@example.com',
        phone: '9999999999',
        code: 'CODE1',
        domain: 'MERN Stack',
        sourceSheet: 'Full details',
        sourceRow: 2,
        sourcePriority: 1,
      },
      {
        email: 'person@example.com',
        phone: '9999999999',
        code: null,
        college: 'Example College',
        course: 'BTech CSE',
        offerLetterUrl: 'https://example.com/offer',
        sourceSheet: 'Intern Details',
        sourceRow: 9,
        sourcePriority: 2,
      },
    ];
    const result = applyEmailProfiles(
      [
        {
          name: 'Example Person',
          code: 'CODE1',
          phone: '9999999999',
          workbookStatus: 'Active',
        },
      ],
      profiles
    );
    expect(result.interns[0]).toMatchObject({
      email: 'person@example.com',
      college: 'Example College',
      course: 'BTech CSE',
      domain: 'MERN Stack',
      offerLetterUrl: 'https://example.com/offer',
      emailProfileSource: 'Full details',
      emailProfileSupplementSource: 'Intern Details',
    });
    expect(result.counts.emailProfilesSupplemented).toBe(1);
  });

  it('does not merge ambiguous Intern Details rows', () => {
    const profiles = [
      {
        email: 'person@example.com',
        phone: '9999999999',
        code: 'CODE1',
        sourceSheet: 'Full details',
        sourceRow: 2,
        sourcePriority: 1,
      },
      ...[3, 4].map((row) => ({
        email: 'person@example.com',
        phone: '9999999999',
        code: null,
        college: `College ${row}`,
        sourceSheet: 'Intern Details',
        sourceRow: row,
        sourcePriority: 2,
      })),
    ];
    const result = applyEmailProfiles(
      [{ code: 'CODE1', phone: '9999999999', workbookStatus: 'Active' }],
      profiles
    );
    expect(result.interns[0].college).toBeNull();
    expect(result.counts.emailSupplementAmbiguous).toBe(1);
  });
});

describe('Interns third profile source', () => {
  it('parses the verified headerless Interns columns', () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        ['Intern Code', 'Email ID', 'Mobile No'],
        ['CODE1', 'person@example.com', '9999999999'],
      ]),
      'Full details'
    );
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        [
          'AI TUTOR',
          'CODE1',
          '7/20/2026',
          'Person',
          'person@example.com',
          '9999999999',
          'Interns College',
          'B.Tech',
          'CSE',
          'ENR1',
          'https://linkedin.example',
          'MERN Stack',
          '7/17/2026',
          '10/17/2026',
          'https://example.com/offer',
        ],
      ]),
      'Interns'
    );
    const parsed = parseEmailDetailsWorkbook(
      XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })
    );
    expect(parsed.internsRows).toBe(1);
    expect(
      parsed.profiles.find((row) => row.sourcePriority === 3)
    ).toMatchObject({
      code: 'CODE1',
      email: 'person@example.com',
      phone: '9999999999',
      college: 'Interns College',
      course: 'B.Tech - CSE',
      domain: 'MERN Stack',
      offerLetterUrl: 'https://example.com/offer',
      sourceSheet: 'Interns',
    });
  });
  it('fills only still-missing fields from Interns', () => {
    const profiles = [
      {
        code: 'CODE1',
        email: 'person@example.com',
        phone: '9999999999',
        domain: 'MERN Stack',
        sourceSheet: 'Full details',
        sourceRow: 2,
        sourcePriority: 1,
      },
      {
        code: null,
        email: 'person@example.com',
        phone: '9999999999',
        college: 'Details College',
        sourceSheet: 'Intern Details',
        sourceRow: 5,
        sourcePriority: 2,
      },
      {
        code: 'CODE1',
        email: 'person@example.com',
        phone: '9999999999',
        college: 'Lower Priority College',
        course: 'B.Tech - CSE',
        offerLetterUrl: 'https://example.com/offer',
        sourceSheet: 'Interns',
        sourceRow: 1,
        sourcePriority: 3,
      },
    ];
    const result = applyEmailProfiles(
      [{ code: 'CODE1', phone: '9999999999', workbookStatus: 'Active' }],
      profiles
    );
    expect(result.interns[0]).toMatchObject({
      college: 'Details College',
      course: 'B.Tech - CSE',
      domain: 'MERN Stack',
      offerLetterUrl: 'https://example.com/offer',
    });
    expect(result.counts.emailInternsProfilesSupplemented).toBe(1);
  });
  it('can use Interns as the final identity source without name matching', () => {
    const result = applyEmailProfiles(
      [{ code: 'CODE1', phone: '9999999999', workbookStatus: 'Active' }],
      [
        {
          code: 'CODE1',
          email: 'person@example.com',
          phone: '9999999999',
          college: 'Interns College',
          sourceSheet: 'Interns',
          sourceRow: 1,
          sourcePriority: 3,
        },
      ]
    );
    expect(result.interns[0]).toMatchObject({
      email: 'person@example.com',
      college: 'Interns College',
      emailProfileSource: 'Interns',
    });
    expect(result.counts.emailMatchedFromInterns).toBe(1);
  });
});
