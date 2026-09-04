const XLSX = require('xlsx');

const ATTENDANCE_MAP = {
  PRESENT: { status: 'PRESENT', remarks: null },
  LEAVE: { status: 'LEAVE', remarks: null },
  INFORMED: { status: 'INFORMED', remarks: null },
};
const LIFECYCLE = {
  JOINED: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  TERMINATED: 'TERMINATED',
  DISCONTINUED: 'DISCONTINUED',
  DISCOUNTINUED: 'DISCONTINUED',
};
const ATTENDANCE_SHEET = /^Attendance\s*-\s*.+$/i;

function clean(value) {
  return value == null ? '' : String(value).trim();
}
function normalized(value) {
  return clean(value).toUpperCase().replace(/\s+/g, ' ');
}
function excelDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  const text = clean(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return null;
}
function normalizeSheetName(name) {
  return clean(name).replace(/attendnace/i, 'Attendance');
}
function isAttendanceSheet(name) {
  return ATTENDANCE_SHEET.test(normalizeSheetName(name));
}
function extensionEvidenceValue(value) {
  const text = clean(value);
  if (!text || /^-?\d+(?:\.\d+)?$/.test(text)) return null;
  return text;
}
function completionSourcePeriod(source) {
  if (source.latestAttendanceDate) return source.latestAttendanceDate;
  const months = {
    JAN: '01',
    JANUARY: '01',
    FEB: '02',
    FEBRUARY: '02',
    MAR: '03',
    MARCH: '03',
    APR: '04',
    APRIL: '04',
    MAY: '05',
    JUN: '06',
    JUNE: '06',
    JUL: '07',
    JULY: '07',
    AUG: '08',
    AUGUST: '08',
    SEP: '09',
    SEPT: '09',
    SEPTEMBER: '09',
    OCT: '10',
    OCTOBER: '10',
    NOV: '11',
    NOVEMBER: '11',
    DEC: '12',
    DECEMBER: '12',
  };
  const token = normalized(source.sheet).match(
    /ATTENDANCE\s*-\s*([A-Z]+)/
  )?.[1];
  const month = months[token];
  const year = String(source.date || '').slice(0, 4);
  return month && /^\d{4}$/.test(year) ? `${year}-${month}-01` : '';
}
function normalizePhone(value) {
  const digits = clean(value).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}
function normalizeEmail(value) {
  const email = clean(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
function nameAlias(name) {
  return clean(name).toLowerCase().replace(/\s+/g, ' ');
}
const NON_INTERN_NAMES = new Set([
  'NAME',
  'TOTAL',
  'TOTALS',
  'SUMMARY',
  'NOTES',
  'NOTE',
  'REMARKS',
  'GRAND TOTAL',
]);

function isInternRow({
  name,
  code,
  phone,
  workbookStatus,
  completionDate,
  attendance,
  lifecycleEvents,
}) {
  const normalizedName = normalized(name);
  if (!normalizedName || NON_INTERN_NAMES.has(normalizedName)) return false;
  if (
    /^(SR\.?\s*NO\.?|S\.?\s*NO\.?|DATE|STATUS|ATTENDANCE)$/i.test(
      normalizedName
    )
  ) {
    return false;
  }
  return Boolean(
    code ||
    phone ||
    workbookStatus ||
    completionDate ||
    attendance.length ||
    lifecycleEvents.length
  );
}

function aliasesFor({ code, phone, name }) {
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone) return [`phone:${normalizedPhone}`];

  const normalizedCode = normalized(code);
  if (normalizedCode) return [`code:${normalizedCode}`];

  const normalizedName = normalized(name);
  if (normalizedName) return [`name:${normalizedName}`];

  return [];
}

function findHeaderRow(rows) {
  return rows.findIndex((row) =>
    row.some((cell) => normalized(cell) === 'NAME')
  );
}
function headerIndex(headers, label) {
  return headers.findIndex((header) => normalized(header) === label);
}
function ignoredSheet(sheetName, reason) {
  return {
    sheet: sheetName,
    normalizedSheet: normalizeSheetName(sheetName),
    ignored: true,
    ignoreReason: reason,
    skipped: false,
    warnings: [],
    interns: [],
    dateColumns: 0,
  };
}
function parseSheet(sheetName, sheet, sheetOrder = 0) {
  if (!isAttendanceSheet(sheetName)) {
    return ignoredSheet(sheetName, 'Not a monthly attendance sheet');
  }
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  const headerRow = findHeaderRow(rows);
  if (headerRow < 0) {
    return {
      sheet: sheetName,
      normalizedSheet: normalizeSheetName(sheetName),
      ignored: false,
      skipped: true,
      skipReason: 'NAME header not found',
      warnings: ['NAME header not found'],
      interns: [],
      dateColumns: 0,
    };
  }
  const headers = rows[headerRow];
  const nameIndex = headerIndex(headers, 'NAME');
  const statusIndex = headerIndex(headers, 'STATUS');
  const codeIndex = headerIndex(headers, 'INTERN CODE');
  const phoneIndex = headerIndex(headers, 'CONTACT INFO');
  const emailIndex = headerIndex(headers, 'EMAIL ID');
  const completionIndex = headerIndex(headers, 'COMPLETION DATE');
  const extensionIndex = headerIndex(headers, 'EXTENSION');
  const dateColumns = headers
    .map((header, index) => ({ index, date: excelDate(header) }))
    .filter((column) => column.date);
  const interns = [];
  const warnings = [];
  for (let rowIndex = headerRow + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const name = clean(row[nameIndex]);
    if (!name) continue;
    const code = codeIndex >= 0 ? clean(row[codeIndex]) || null : null;
    const phone = phoneIndex >= 0 ? normalizePhone(row[phoneIndex]) : null;
    const email = emailIndex >= 0 ? normalizeEmail(row[emailIndex]) : null;
    const completionDate =
      completionIndex >= 0 ? excelDate(row[completionIndex]) : null;
    const workbookStatus =
      statusIndex >= 0 ? clean(row[statusIndex]) || null : null;
    const extensionValue =
      extensionIndex >= 0 ? extensionEvidenceValue(row[extensionIndex]) : null;
    const attendance = [];
    const lifecycleEvents = [];
    let joinedDate = null;
    for (const column of dateColumns) {
      const marker = normalized(row[column.index]);
      if (!marker) continue;
      if (ATTENDANCE_MAP[marker]) {
        attendance.push({
          date: column.date,
          source: marker,
          ...ATTENDANCE_MAP[marker],
          sourceSheet: sheetName,
          sourceRow: rowIndex + 1,
        });
      } else if (LIFECYCLE[marker]) {
        const event = {
          status: LIFECYCLE[marker],
          date: column.date,
          source: marker,
          sourceSheet: sheetName,
          sourceRow: rowIndex + 1,
        };
        lifecycleEvents.push(event);
        if (marker === 'JOINED' && !joinedDate) joinedDate = column.date;
      } else if (!/^\d+(?:\.\d+)?$/.test(marker) && marker !== '-') {
        warnings.push(
          `Row ${rowIndex + 1}: unrecognized marker "${clean(row[column.index])}" for ${name}`
        );
      }
    }
    if (
      !isInternRow({
        name,
        code,
        phone,
        workbookStatus,
        completionDate,
        attendance,
        lifecycleEvents,
      })
    ) {
      continue;
    }
    interns.push({
      aliases: aliasesFor({ code, phone, name }),
      name,
      code,
      phone,
      email,
      workbookStatus,
      workbookStatusSource: workbookStatus
        ? {
            status: workbookStatus,
            sheet: sheetName,
            row: rowIndex + 1,
            sheetOrder,
            latestAttendanceDate: dateColumns.at(-1)?.date || null,
          }
        : null,
      completionDate,
      completionDateSource: completionDate
        ? {
            date: completionDate,
            sheet: sheetName,
            row: rowIndex + 1,
            sheetOrder,
            latestAttendanceDate: dateColumns.at(-1)?.date || null,
          }
        : null,
      extensionEvidence: extensionValue
        ? {
            value: extensionValue,
            sheet: sheetName,
            row: rowIndex + 1,
            sheetOrder,
          }
        : null,
      joinedDate,
      lifecycleEvents,
      attendance,
      sourceSheet: sheetName,
      sourceRow: rowIndex + 1,
    });
  }
  return {
    sheet: sheetName,
    normalizedSheet: normalizeSheetName(sheetName),
    ignored: false,
    skipped: false,
    headerRow: headerRow + 1,
    dateColumns: dateColumns.length,
    interns,
    warnings,
  };
}
function newCanonical(record, id) {
  return {
    id,
    aliases: new Set(record.aliases),
    name: record.name,
    code: record.code,
    phone: record.phone,
    email: record.email,
    workbookStatus: record.workbookStatus,
    workbookStatusSources: record.workbookStatusSource
      ? [record.workbookStatusSource]
      : [],
    completionDate: record.completionDate,
    completionDateSources: record.completionDateSource
      ? [record.completionDateSource]
      : [],
    extensionEvidence: record.extensionEvidence
      ? [record.extensionEvidence]
      : [],
    joinedDate: record.joinedDate,
    lifecycleEvents: [...record.lifecycleEvents],
    attendance: new Map(),
    sources: new Set([record.sourceSheet]),
    sourceRows: [{ sheet: record.sourceSheet, row: record.sourceRow }],
  };
}
function mergeCanonical(target, source, aliasMap, canonicals) {
  for (const alias of source.aliases) {
    target.aliases.add(alias);
    aliasMap.set(alias, target);
  }
  target.code ||= source.code;
  target.phone ||= source.phone;
  target.email ||= source.email;
  target.joinedDate ||= source.joinedDate;
  target.completionDate ||= source.completionDate;
  target.completionDateSources.push(...source.completionDateSources);
  target.extensionEvidence.push(...source.extensionEvidence);
  target.workbookStatus ||= source.workbookStatus;
  target.workbookStatusSources.push(...source.workbookStatusSources);
  target.lifecycleEvents.push(...source.lifecycleEvents);
  source.sources.forEach((item) => target.sources.add(item));
  target.sourceRows.push(...source.sourceRows);
  for (const [date, item] of source.attendance) {
    if (!target.attendance.has(date)) target.attendance.set(date, item);
  }
  canonicals.delete(source);
}
function mergeInterns(
  sheets,
  { asOfDate = new Date().toISOString().slice(0, 10) } = {}
) {
  const aliasMap = new Map();
  const canonicals = new Set();
  const conflicts = [];
  let nextId = 1;
  const records = sheets.flatMap((sheet) => sheet.interns);
  for (const record of records) {
    const matches = [
      ...new Set(
        record.aliases.map((alias) => aliasMap.get(alias)).filter(Boolean)
      ),
    ];
    let canonical;
    if (matches.length === 0) {
      canonical = newCanonical(record, nextId++);
      canonicals.add(canonical);
    } else {
      [canonical] = matches;
      for (const duplicate of matches.slice(1)) {
        mergeCanonical(canonical, duplicate, aliasMap, canonicals);
      }
      canonical.code ||= record.code;
      canonical.phone ||= record.phone;
      canonical.email ||= record.email;
      canonical.joinedDate ||= record.joinedDate;
      canonical.completionDate ||= record.completionDate;
      if (record.completionDateSource) {
        canonical.completionDateSources.push(record.completionDateSource);
      }
      if (record.extensionEvidence) {
        canonical.extensionEvidence.push(record.extensionEvidence);
      }
      if (record.workbookStatus)
        canonical.workbookStatus = record.workbookStatus;
      if (record.workbookStatusSource) {
        canonical.workbookStatusSources.push(record.workbookStatusSource);
      }
      canonical.lifecycleEvents.push(...record.lifecycleEvents);
      canonical.sources.add(record.sourceSheet);
      canonical.sourceRows.push({
        sheet: record.sourceSheet,
        row: record.sourceRow,
      });
    }
    for (const alias of record.aliases) {
      canonical.aliases.add(alias);
      aliasMap.set(alias, canonical);
    }
    for (const item of record.attendance) {
      const prior = canonical.attendance.get(item.date);
      if (prior && prior.source !== item.source) {
        conflicts.push({
          id: [
            canonical.code || canonical.name,
            item.date,
            prior.sourceSheet,
            prior.sourceRow,
            item.sourceSheet,
            item.sourceRow,
          ].join('|'),
          type: 'ATTENDANCE_STATUS_CONFLICT',
          resolution: 'REVIEW_REQUIRED',
          intern: canonical.code || canonical.name,
          name: canonical.name,
          code: canonical.code,
          phone: canonical.phone ? `******${canonical.phone.slice(-4)}` : null,
          date: item.date,
          existing: prior.source,
          incoming: item.source,
          existingSource: `${prior.sourceSheet} row ${prior.sourceRow}`,
          incomingSource: `${item.sourceSheet} row ${item.sourceRow}`,
          existingCompletionDate: canonical.completionDate,
          incomingCompletionDate: record.completionDate,
          allowedResolutions: [
            {
              value: 'USE_EXISTING',
              label: `Use ${prior.source} from ${prior.sourceSheet} row ${prior.sourceRow}`,
            },
            {
              value: 'USE_INCOMING',
              label: `Use ${item.source} from ${item.sourceSheet} row ${item.sourceRow}`,
            },
            {
              value: 'SKIP_DATE',
              label: `Skip ${item.date} for ${canonical.code || canonical.name}`,
            },
            {
              value: 'EXCLUDE_INTERN',
              label: `Exclude ${canonical.code || canonical.name} from import`,
            },
          ],
        });
      } else if (!prior) {
        canonical.attendance.set(item.date, item);
      }
    }
  }
  const interns = [...canonicals].map((intern) => {
    const attendance = [...intern.attendance.values()].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const lifecycleEvents = intern.lifecycleEvents.sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const workbookStatusSources = [...intern.workbookStatusSources].sort(
      (a, b) =>
        completionSourcePeriod(a).localeCompare(completionSourcePeriod(b)) ||
        a.row - b.row
    );
    const latestWorkbookStatusSource = workbookStatusSources.at(-1) || null;
    const effectiveLifecycleEvents = lifecycleEvents.filter(
      (event) => event.date <= asOfDate
    );
    const latestLifecycleEvent = effectiveLifecycleEvents.at(-1) || null;
    const authoritativeLifecycle =
      latestLifecycleEvent &&
      (!latestWorkbookStatusSource ||
        latestLifecycleEvent.date >=
          completionSourcePeriod(latestWorkbookStatusSource))
        ? latestLifecycleEvent
        : null;
    const completionDateSources = [...intern.completionDateSources].sort(
      (a, b) =>
        completionSourcePeriod(b).localeCompare(completionSourcePeriod(a)) ||
        a.row - b.row
    );
    const latestCompletionDateSource = completionDateSources[0] || null;
    const chronologicalCompletionSources = [...completionDateSources].sort(
      (a, b) =>
        completionSourcePeriod(a).localeCompare(completionSourcePeriod(b)) ||
        a.row - b.row
    );
    const distinctCompletionDates = [
      ...new Set(chronologicalCompletionSources.map((source) => source.date)),
    ];
    const extensionDetectedFromAttendance = chronologicalCompletionSources.some(
      (source, index) =>
        chronologicalCompletionSources
          .slice(0, index)
          .some(
            (older) =>
              completionSourcePeriod(source) > completionSourcePeriod(older) &&
              source.date > older.date
          )
    );
    const sameSheetCompletionConflict = chronologicalCompletionSources.some(
      (source, index) =>
        chronologicalCompletionSources
          .slice(index + 1)
          .some(
            (other) =>
              normalizeSheetName(source.sheet) ===
                normalizeSheetName(other.sheet) && source.date !== other.date
          )
    );
    const completionDateRegression = chronologicalCompletionSources.some(
      (source, index) =>
        chronologicalCompletionSources
          .slice(0, index)
          .some(
            (older) =>
              completionSourcePeriod(source) > completionSourcePeriod(older) &&
              source.date < older.date
          )
    );
    const completionReviewReasons = [];
    if (sameSheetCompletionConflict)
      completionReviewReasons.push('COMPLETION_DATE_CONFLICT');
    if (completionDateRegression)
      completionReviewReasons.push('COMPLETION_DATE_REGRESSION');
    return {
      key: intern.code
        ? `code:${intern.code.toUpperCase()}`
        : [...intern.aliases][0],
      aliases: [...intern.aliases].sort(),
      name: intern.name,
      code: intern.code,
      phone: intern.phone,
      email: intern.email,
      workbookStatus:
        latestWorkbookStatusSource?.status || intern.workbookStatus,
      workbookStatusSources,
      latestWorkbookStatusSource,
      completionDate: latestCompletionDateSource?.date || intern.completionDate,
      completionDateSources,
      completionDateHistory: chronologicalCompletionSources,
      latestCompletionDateSource,
      distinctCompletionDates,
      extensionEvidence: [...intern.extensionEvidence].sort(
        (a, b) => a.sheetOrder - b.sheetOrder || a.row - b.row
      ),
      extensionDetectedFromAttendance,
      completionReviewReasons,
      joinedDate: intern.joinedDate,
      lifecycle: authoritativeLifecycle,
      lifecycleEvents,
      attendance,
      sources: [...intern.sources],
      sourceRows: intern.sourceRows,
    };
  });
  return { interns, conflicts };
}
function flexibleHeaderIndex(headers, labels) {
  const accepted = new Set(labels.map((label) => normalized(label)));
  return headers.findIndex((header) => accepted.has(normalized(header)));
}
function normalizeCode(value) {
  return clean(value).toUpperCase().replace(/\s+/g, '');
}
function profileDate(value) {
  const excel = excelDate(value);
  if (excel) return excel;
  const text = clean(value);
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
function parseProfileSheet(workbook, sheetName, { requireCode }) {
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  const headerRow = rows.findIndex((row) =>
    row.some((cell) => ['EMAIL ID', 'EMAIL'].includes(normalized(cell)))
  );
  if (headerRow < 0)
    throw new Error(`Email header was not found in ${sheetName}`);
  const headers = rows[headerRow];
  const emailIndex = flexibleHeaderIndex(headers, [
    'EMAIL ID',
    'EMAIL',
    'EMAIL ADDRESS',
  ]);
  const phoneIndex = flexibleHeaderIndex(headers, [
    'MOBILE NO',
    'MOBILE NUM',
    'MOBILE NUMBER',
    'MOBILE NUMBER (WHATSAPP)',
    'CONTACT INFO',
  ]);
  const codeIndex = flexibleHeaderIndex(headers, ['INTERN CODE', 'INTERN ID']);
  const joiningIndex = flexibleHeaderIndex(headers, [
    'ONBOARDING DATE',
    'JOINING DATE',
    'JOINING DATE (ON OFFER LETTER)',
    'START DATE',
  ]);
  const endingIndex = flexibleHeaderIndex(headers, [
    'ENDING DATE',
    'ENDING DATE(',
    'ENDING DATE(ON OFFER LETTER)',
    'END DATE',
    'COMPLETION DATE',
  ]);
  const collegeIndex = flexibleHeaderIndex(headers, [
    'COLLEGE NAME',
    'CURRENT/LAST COLLEGE NAME',
  ]);
  const courseIndex = flexibleHeaderIndex(headers, [
    'COURSE',
    'DEGREE',
    'COURSE/STREAM',
  ]);
  const domainIndex = flexibleHeaderIndex(headers, [
    'DOMAIN',
    'DOMAIN NAME',
    'INTERNSHIP DOMAIN NAME (AS PER OFFER LETTER)',
  ]);
  const offerLetterIndex = flexibleHeaderIndex(headers, [
    'UPLOAD OFFER LETTER',
    'OFFER LETTER',
    'OFFER LETTER URL',
  ]);
  if (emailIndex < 0 || phoneIndex < 0 || (requireCode && codeIndex < 0)) {
    throw new Error(
      `${sheetName} must contain Email and Mobile${requireCode ? ' plus Intern Code' : ''}`
    );
  }
  const profiles = [];
  for (let index = headerRow + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const email = normalizeEmail(row[emailIndex]);
    const phone = normalizePhone(row[phoneIndex]);
    const code = codeIndex >= 0 ? normalizeCode(row[codeIndex]) || null : null;
    if (!email && !phone && !code) continue;
    profiles.push({
      email,
      phone,
      code,
      joiningDate: joiningIndex >= 0 ? profileDate(row[joiningIndex]) : null,
      endingDate: endingIndex >= 0 ? profileDate(row[endingIndex]) : null,
      college: collegeIndex >= 0 ? clean(row[collegeIndex]) || null : null,
      course: courseIndex >= 0 ? clean(row[courseIndex]) || null : null,
      domain: domainIndex >= 0 ? clean(row[domainIndex]) || null : null,
      offerLetterUrl:
        offerLetterIndex >= 0 ? clean(row[offerLetterIndex]) || null : null,
      sourceSheet: sheetName,
      sourceRow: index + 1,
    });
  }
  return profiles;
}

function parseActiveInternsMaster(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  const headerRow = rows.findIndex((row) =>
    row.some((cell) => normalized(cell) === 'INTERN CODE')
  );
  if (headerRow < 0) {
    throw new Error('Active Interns Master header row was not found');
  }
  const headers = rows[headerRow];
  const index = (labels) => flexibleHeaderIndex(headers, labels);
  const columns = {
    name: index(['NAME']),
    status: index(['STATUS']),
    code: index(['INTERN CODE']),
    phone: index(['MOBILE NO']),
    whatsapp: index(['WHATSAPP NO']),
    email: index(['EMAIL ID']),
    domain: index(['DOMAIN']),
    department: index(['DEPARTMENT']),
    location: index(['LOCATION']),
    college: index(['COLLEGE']),
    course: index(['COURSE']),
    year: index(['YEAR']),
    position: index(['POSITION']),
    offerLetter: index(['OFFER LETTER']),
    joiningDate: index(['JOINING DATE']),
    completionDate: index(['COMPLETION DATE']),
  };
  const required = [
    'name',
    'status',
    'code',
    'phone',
    'email',
    'domain',
    'department',
    'joiningDate',
    'completionDate',
  ];
  const missing = required.filter((field) => columns[field] < 0);
  if (missing.length) {
    throw new Error(
      `Active Interns Master is missing required columns: ${missing.join(', ')}`
    );
  }
  const profiles = [];
  const seen = { code: new Set(), phone: new Set(), email: new Set() };
  for (let rowIndex = headerRow + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const name = clean(row[columns.name]);
    if (!name) continue;
    const status = normalized(row[columns.status]);
    if (status !== 'ACTIVE') continue;
    const code = normalizeCode(row[columns.code]) || null;
    const phone = normalizePhone(row[columns.phone]);
    const email = normalizeEmail(row[columns.email]);
    if (!code || !phone || !email) {
      throw new Error(
        `Active Interns Master row ${rowIndex + 1} requires Intern Code, Mobile No, and Email ID`
      );
    }
    for (const [field, value] of Object.entries({ code, phone, email })) {
      if (seen[field].has(value)) {
        throw new Error(
          `Active Interns Master contains duplicate ${field} at row ${rowIndex + 1}`
        );
      }
      seen[field].add(value);
    }
    const joiningDate = profileDate(row[columns.joiningDate]);
    const endingDate = profileDate(row[columns.completionDate]);
    if (!joiningDate || !endingDate) {
      throw new Error(
        `Active Interns Master row ${rowIndex + 1} has an invalid Joining Date or Completion Date`
      );
    }
    if (joiningDate.slice(0, 4) < '2020' || joiningDate > endingDate) {
      throw new Error(
        `Active Interns Master row ${rowIndex + 1} has an implausible date range`
      );
    }
    profiles.push({
      name,
      status: 'ACTIVE',
      code,
      phone,
      whatsapp:
        columns.whatsapp >= 0 ? normalizePhone(row[columns.whatsapp]) : null,
      email,
      domain: clean(row[columns.domain]) || null,
      department: clean(row[columns.department]) || null,
      location:
        columns.location >= 0 ? clean(row[columns.location]) || null : null,
      college:
        columns.college >= 0 ? clean(row[columns.college]) || null : null,
      course: columns.course >= 0 ? clean(row[columns.course]) || null : null,
      yearOfStudy: columns.year >= 0 ? clean(row[columns.year]) || null : null,
      position:
        columns.position >= 0 ? clean(row[columns.position]) || null : null,
      offerLetterUrl:
        columns.offerLetter >= 0
          ? clean(row[columns.offerLetter]) || null
          : null,
      joiningDate,
      endingDate,
      sourceSheet: sheetName,
      sourceRow: rowIndex + 1,
    });
  }
  return profiles;
}
function parseInternsProfileSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  const expectedHeader = rows.findIndex((row) =>
    row.some((cell) => normalized(cell) === 'INTERN CODE')
  );
  if (expectedHeader >= 0) {
    return parseProfileSheet(workbook, sheetName, { requireCode: true });
  }
  // The live Interns export is headerless. Its stable columns are:
  // department, code, onboarding, name, email, phone, college, degree,
  // branch, enrollment, LinkedIn, domain, start, end, offer letter, address.
  const profiles = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const code = normalizeCode(row[1]) || null;
    const email = normalizeEmail(row[4]);
    const phone = normalizePhone(row[5]);
    if (!code && !email && !phone) continue;
    profiles.push({
      email,
      phone,
      code,
      joiningDate: profileDate(row[12]),
      endingDate: profileDate(row[13]),
      college: clean(row[6]) || null,
      course:
        [clean(row[7]), clean(row[8])].filter(Boolean).join(' - ') || null,
      domain: clean(row[11]) || null,
      offerLetterUrl: clean(row[14]) || null,
      sourceSheet: sheetName,
      sourceRow: index + 1,
    });
  }
  return profiles;
}

function parseEmailDetailsWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const activeMaster = workbook.SheetNames.find(
    (name) => normalized(name) === 'ACTIVE INTERNS MASTER'
  );
  const fullDetails = workbook.SheetNames.find(
    (name) => normalized(name) === 'FULL DETAILS'
  );
  const internDetails = workbook.SheetNames.find(
    (name) => normalized(name) === 'INTERN DETAILS'
  );
  const internsSheet = workbook.SheetNames.find(
    (name) => normalized(name) === 'INTERNS'
  );
  if (!activeMaster && !fullDetails) {
    throw new Error(
      'Email-details workbook must contain Active Interns Master or Full details'
    );
  }
  const masterProfiles = activeMaster
    ? parseActiveInternsMaster(workbook, activeMaster)
    : [];
  const primaryProfiles = fullDetails
    ? parseProfileSheet(workbook, fullDetails, { requireCode: true })
    : [];
  const fallbackProfiles = internDetails
    ? parseProfileSheet(workbook, internDetails, { requireCode: false })
    : [];
  const internsProfiles = internsSheet
    ? parseInternsProfileSheet(workbook, internsSheet)
    : [];
  return {
    sheet: activeMaster || fullDetails,
    masterSheet: activeMaster || null,
    fullDetailsSheet: fullDetails || null,
    fallbackSheet: internDetails || null,
    internsSheet: internsSheet || null,
    profiles: [
      ...masterProfiles.map((profile) => ({ ...profile, sourcePriority: 0 })),
      ...primaryProfiles.map((profile) => ({ ...profile, sourcePriority: 1 })),
      ...fallbackProfiles.map((profile) => ({ ...profile, sourcePriority: 2 })),
      ...internsProfiles.map((profile) => ({ ...profile, sourcePriority: 3 })),
    ],
    masterRows: masterProfiles.length,
    primaryRows: primaryProfiles.length,
    fallbackRows: fallbackProfiles.length,
    internsRows: internsProfiles.length,
  };
}
function ratingMonth(sheetName) {
  const months = {
    JAN: '01',
    JANUARY: '01',
    FEB: '02',
    FEBRUARY: '02',
    MAR: '03',
    MARCH: '03',
    APR: '04',
    APRIL: '04',
    MAY: '05',
    JUN: '06',
    JUNE: '06',
    JUL: '07',
    JULY: '07',
    AUG: '08',
    AUGUST: '08',
    SEP: '09',
    SEPT: '09',
    SEPTEMBER: '09',
    OCT: '10',
    OCTOBER: '10',
    NOV: '11',
    NOVEMBER: '11',
    DEC: '12',
    DECEMBER: '12',
  };
  const token = normalized(sheetName).match(/^RATINGS\s*-\s*([A-Z]+)/)?.[1];
  return months[token] || null;
}
function ratingPeriod(header, month, year) {
  const numbers =
    clean(header)
      .match(/\d{1,2}/g)
      ?.map(Number) || [];
  if (!month || numbers.length < 2) return null;
  const [startDay, endDay] = numbers;
  const pad = (value) => String(value).padStart(2, '0');
  const startDate = `${year}-${month}-${pad(startDay)}`;
  const endDate = `${year}-${month}-${pad(endDay)}`;
  return { startDate, endDate, ratingDate: endDate };
}
function isRatingReasonHeader(value) {
  return /reason|suggestion|improvement/i.test(clean(value));
}
function ratingReasonIndex(headers, scoreIndex) {
  if (isRatingReasonHeader(headers[scoreIndex + 1])) return scoreIndex + 1;
  if (isRatingReasonHeader(headers[scoreIndex - 1])) return scoreIndex - 1;
  return -1;
}
function parseRatingsSheets(workbook, interns) {
  const byCode = new Map();
  const byPhone = new Map();
  for (const intern of interns) {
    intern.ratings = [];
    const code = normalizeCode(intern.code);
    const phone = normalizePhone(intern.phone);
    if (code) byCode.set(code, intern);
    if (phone) byPhone.set(phone, intern);
  }
  const attendanceYears = interns
    .flatMap((intern) =>
      (intern.attendance || []).map((item) => String(item.date).slice(0, 4))
    )
    .filter((year) => /^\d{4}$/.test(year));
  const year =
    attendanceYears.sort().at(-1) || String(new Date().getUTCFullYear());
  const summary = {
    ratingSheets: 0,
    ratingRecords: 0,
    ratingScoreRecords: 0,
    ratingReasonOnlyRecords: 0,
    ratingEmptyWeekRecords: 0,
    ratingIdentityMissing: 0,
    ratingIdentityConflicts: 0,
    ratingNonNumericExcluded: 0,
    ratingAfterCompletionExcluded: 0,
    ratingUnsupportedSheets: 0,
  };
  for (const sheetName of workbook.SheetNames.filter((name) =>
    /^Ratings\s*-\s*.+$/i.test(clean(name))
  )) {
    summary.ratingSheets++;
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: null,
    });
    const head = rows.findIndex((row) =>
      row.some((cell) => normalized(cell) === 'NAME')
    );
    if (head < 0) {
      summary.ratingUnsupportedSheets++;
      continue;
    }
    const headers = rows[head];
    const codeIndex = headerIndex(headers, 'INTERN CODE');
    const phoneIndex = headerIndex(headers, 'CONTACT INFO');
    const completionIndex = flexibleHeaderIndex(headers, [
      'COMPLETION DATE',
      'COMPLITION DATE',
    ]);
    if (codeIndex < 0 || phoneIndex < 0) {
      summary.ratingUnsupportedSheets++;
      continue;
    }
    const month = ratingMonth(sheetName);
    const periods = [];
    const usedScoreColumns = new Set();
    const reasonColumns = headers
      .map((header, index) => ({
        index,
        header: clean(header),
      }))
      .filter((item) => isRatingReasonHeader(item.header));

    const firstReason = reasonColumns[0];
    const firstLeftPeriod =
      firstReason && firstReason.index > 0
        ? ratingPeriod(headers[firstReason.index - 1], month, year)
        : null;
    const firstRightPeriod =
      firstReason && firstReason.index + 1 < headers.length
        ? ratingPeriod(headers[firstReason.index + 1], month, year)
        : null;
    const preferredReasonSide = firstLeftPeriod ? 'LEFT' : 'RIGHT';

    for (
      let reasonOrder = 0;
      reasonOrder < reasonColumns.length;
      reasonOrder++
    ) {
      const reasonColumn = reasonColumns[reasonOrder];
      const candidates =
        preferredReasonSide === 'LEFT'
          ? [reasonColumn.index - 1, reasonColumn.index + 1]
          : [reasonColumn.index + 1, reasonColumn.index - 1];
      let scoreIndex = -1;
      let period = null;
      for (const candidate of candidates) {
        if (
          candidate < 0 ||
          candidate >= headers.length ||
          usedScoreColumns.has(candidate)
        ) {
          continue;
        }
        const candidatePeriod = ratingPeriod(headers[candidate], month, year);
        if (!candidatePeriod) continue;
        scoreIndex = candidate;
        period = candidatePeriod;
        break;
      }
      if (!period || scoreIndex < 0) continue;
      usedScoreColumns.add(scoreIndex);
      periods.push({
        index: scoreIndex,
        header: clean(headers[scoreIndex]),
        reasonIndex: reasonColumn.index,
        weekNumber: reasonOrder + 1,
        period,
      });
    }

    for (let index = 0; index < headers.length; index++) {
      if (usedScoreColumns.has(index) || isRatingReasonHeader(headers[index])) {
        continue;
      }
      const period = ratingPeriod(headers[index], month, year);
      if (!period) continue;
      periods.push({
        index,
        header: clean(headers[index]),
        reasonIndex: ratingReasonIndex(headers, index),
        weekNumber: periods.length + 1,
        period,
      });
    }

    periods.sort((a, b) =>
      a.period.startDate.localeCompare(b.period.startDate)
    );
    for (let rowIndex = head + 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const code = normalizeCode(row[codeIndex]);
      const phone = normalizePhone(row[phoneIndex]);
      if (!code && !phone) continue;
      if (!code || !phone) {
        summary.ratingIdentityMissing++;
        continue;
      }
      const codeMatch = byCode.get(code);
      const phoneMatch = byPhone.get(phone);
      if (!codeMatch || !phoneMatch || codeMatch !== phoneMatch) {
        summary.ratingIdentityConflicts++;
        continue;
      }
      const intern = codeMatch;
      const completionDate =
        completionIndex >= 0 ? profileDate(row[completionIndex]) : null;
      for (const item of periods) {
        const raw = row[item.index];
        const text = clean(raw);
        const numeric = typeof raw === 'number' ? raw : Number(text);
        const score =
          Number.isFinite(numeric) && numeric >= 1 && numeric <= 10
            ? Number(numeric.toFixed(1))
            : null;
        const remarks =
          item.reasonIndex >= 0 ? clean(row[item.reasonIndex]) || null : null;
        if (text && score == null && text !== '-') {
          summary.ratingNonNumericExcluded++;
        }
        const continuationEvidence = /\bextend(?:ed|ing|s|ion)?\b/i.test(
          remarks || ''
        );
        if (
          completionDate &&
          completionDate < item.period.startDate &&
          !continuationEvidence
        ) {
          summary.ratingAfterCompletionExcluded++;
          continue;
        }
        const sourceKey = [
          sheetName,
          item.period.startDate,
          item.period.endDate,
          code,
        ].join('|');
        intern.ratings.push({
          score,
          remarks,
          sourceSheet: sheetName,
          sourceRow: rowIndex + 1,
          sourceKey,
          weekNumber: item.weekNumber,
          ...item.period,
        });
        summary.ratingRecords++;
        if (score != null) summary.ratingScoreRecords++;
        else if (remarks) summary.ratingReasonOnlyRecords++;
        else summary.ratingEmptyWeekRecords++;
      }
    }
  }
  return summary;
}
function previewWorkbook(
  buffer,
  {
    includeComparisonData = false,
    asOfDate = new Date().toISOString().slice(0, 10),
  } = {}
) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheets = workbook.SheetNames.map((name, sheetOrder) =>
    parseSheet(name, workbook.Sheets[name], sheetOrder)
  );
  const merged = mergeInterns(
    sheets.filter((sheet) => !sheet.ignored && !sheet.skipped),
    { asOfDate }
  );
  const attendanceCount = merged.interns.reduce(
    (sum, intern) => sum + intern.attendance.length,
    0
  );
  const ratingSummary = parseRatingsSheets(workbook, merged.interns);
  return {
    mode: 'preview-only',
    importBlocked: merged.conflicts.length > 0,
    workbook: {
      sheets: workbook.SheetNames.length,
      sheetNames: workbook.SheetNames,
    },
    summary: {
      attendanceSheets: sheets.filter(
        (sheet) => !sheet.ignored && !sheet.skipped
      ).length,
      ignoredSheets: sheets.filter((sheet) => sheet.ignored).length,
      skippedSheets: sheets.filter((sheet) => sheet.skipped).length,
      uniqueInterns: merged.interns.length,
      attendanceRecords: attendanceCount,
      reviewRequired: merged.conflicts.length,
      warnings: sheets.reduce((sum, sheet) => sum + sheet.warnings.length, 0),
      ...ratingSummary,
    },
    sheets: sheets.map(({ interns, ...sheet }) => ({
      ...sheet,
      internRows: interns.length,
    })),
    conflicts: merged.conflicts.slice(0, 100),
    interns: merged.interns.map((intern) => ({
      ...intern,
      attendanceCount: intern.attendance.length,
      attendance: intern.attendance.slice(0, 10),
    })),
    ...(includeComparisonData
      ? {
          comparisonInterns: merged.interns,
        }
      : {}),
  };
}

module.exports = {
  previewWorkbook,
  excelDate,
  normalizeSheetName,
  normalizePhone,
  normalizeEmail,
  isAttendanceSheet,
  parseSheet,
  mergeInterns,
  isInternRow,
  aliasesFor,
  parseEmailDetailsWorkbook,
  parseRatingsSheets,
  normalizeCode,
  profileDate,
};
