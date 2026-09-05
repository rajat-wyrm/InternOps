const argon2 = require('argon2');
const crypto = require('crypto');
const { dbTx } = require('../../utils/dbTx');
const { createAuditLog } = require('../../utils/audit');
const {
  previewWorkbook,
  parseEmailDetailsWorkbook,
  normalizePhone,
  normalizeCode,
} = require('./parser');
const { applyEmailProfiles } = require('./service');

const hash = (buffer) =>
  crypto.createHash('sha256').update(buffer).digest('hex');
const currentStatus = (intern) =>
  String(intern.lifecycle?.status || intern.workbookStatus || '')
    .trim()
    .toUpperCase();
const normalizedEmail = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();
const normalizedText = (value) =>
  String(value || '')
    .trim()
    .toUpperCase();
const valuesSql = (rows, columns, offset = 0) =>
  rows
    .map(
      (_, rowIndex) =>
        `(${columns
          .map(
            (__, columnIndex) =>
              `$${offset + rowIndex * columns.length + columnIndex + 1}`
          )
          .join(',')})`
    )
    .join(',');
const flatten = (rows) => rows.flat();
const report = (options, stage, details = {}) => {
  options.log?.info?.({ stage, ...details }, 'Workbook import progress');
};

function maskEmail(value) {
  const [local = '', domain = ''] = normalizedEmail(value).split('@');
  if (!domain) return 'invalid email';
  return `${local.slice(0, 1) || '*'}***@${domain}`;
}

function findBatchIdentityDuplicates(active) {
  const fields = [
    {
      key: 'email',
      label: 'email address',
      get: (intern) => normalizedEmail(intern.email),
      display: (value) => maskEmail(value),
    },
    {
      key: 'phone',
      label: 'mobile number',
      get: (intern) => normalizePhone(intern.phone),
      display: (value) => `******${String(value).slice(-4)}`,
    },
    {
      key: 'internCode',
      label: 'Intern Code',
      get: (intern) => normalizeCode(intern.code),
      display: (value) => value,
    },
  ];
  const duplicates = [];
  for (const field of fields) {
    const groups = new Map();
    for (const intern of active) {
      const value = field.get(intern);
      if (!value) continue;
      const group = groups.get(value) || [];
      group.push(intern);
      groups.set(value, group);
    }
    for (const [value, interns] of groups) {
      if (interns.length < 2) continue;
      duplicates.push({
        field: field.key,
        label: field.label,
        value: field.display(value),
        interns: interns.map((intern) => ({
          name: intern.name,
          code: normalizeCode(intern.code),
          sources: intern.sources || [],
        })),
      });
    }
  }
  return duplicates;
}

function assertNoBatchIdentityDuplicates(active) {
  const duplicates = findBatchIdentityDuplicates(active);
  if (!duplicates.length) return;
  const details = duplicates
    .map(
      (item) =>
        `${item.label} ${item.value} is assigned to ${item.interns
          .map((intern) => `${intern.name} (${intern.code})`)
          .join(' and ')}`
    )
    .join('; ');
  throw Object.assign(
    new Error(
      `Import blocked because active interns share unique identifiers: ${details}. Correct the Attendance or Email Details workbook, then Preview again.`
    ),
    { statusCode: 409, code: 'BATCH_IDENTITY_DUPLICATE', duplicates }
  );
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run())
  );
  return results;
}

function resolveExistingAccounts(active, rows, department, manager) {
  const byEmail = new Map();
  const byPhone = new Map();
  const byCode = new Map();
  for (const row of rows) {
    const email = normalizedEmail(row.email);
    const phone = normalizePhone(row.phone);
    const code = normalizeCode(row.intern_code);
    if (email) byEmail.set(email, row);
    if (phone) byPhone.set(phone, row);
    if (code) byCode.set(code, row);
  }
  return active.map((intern) => {
    const email = normalizedEmail(intern.email);
    const phone = normalizePhone(intern.phone);
    const code = normalizeCode(intern.code);
    const emailMatch = email ? byEmail.get(email) || null : null;
    const phoneMatch = phone ? byPhone.get(phone) || null : null;
    const codeMatch = code ? byCode.get(code) || null : null;

    if (emailMatch && phoneMatch && emailMatch.id !== phoneMatch.id) {
      throw Object.assign(
        new Error(
          `Email and mobile match different existing accounts for ${intern.name}`
        ),
        { statusCode: 409, code: 'IDENTITY_MATCH_CONFLICT' }
      );
    }

    const identityMatch = emailMatch || phoneMatch || null;
    if (identityMatch && codeMatch && identityMatch.id !== codeMatch.id) {
      throw Object.assign(
        new Error(
          `${intern.name} corrected Intern Code is already assigned to another account`
        ),
        { statusCode: 409, code: 'INTERN_CODE_ALREADY_USED' }
      );
    }

    const existing = identityMatch || codeMatch || null;
    let internCodeCorrection = null;
    if (existing) {
      const reusableRoles = new Set(['INTERN', 'CAPTAIN', 'TL', 'SENIOR_TL']);
      if (!reusableRoles.has(existing.role)) {
        throw Object.assign(
          new Error(
            `${intern.name} uses an identifier already assigned to a ${existing.role} account`
          ),
          { statusCode: 409, code: 'IDENTIFIER_USED_BY_OTHER_ROLE' }
        );
      }
      if (
        existing.role !== 'INTERN' &&
        existing.department_id !== department.id
      ) {
        throw Object.assign(
          new Error(
            `${intern.name} matches a ${existing.role} account from another project group`
          ),
          { statusCode: 409, code: 'CROSS_DEPARTMENT_LEADER' }
        );
      }
      const conflicts = [];
      if (existing.department_id !== department.id)
        conflicts.push('project group');
      if (existing.role === 'INTERN' && existing.manager_id) {
        const validManagerRoles = new Set(['CAPTAIN', 'TL', 'SENIOR_TL']);
        if (
          !validManagerRoles.has(existing.current_manager_role) ||
          existing.current_manager_department_id !== department.id
        ) {
          conflicts.push('current manager hierarchy');
        }
      }
      if (normalizedEmail(existing.email) !== email) conflicts.push('email');
      if (existing.phone && phone && normalizePhone(existing.phone) !== phone)
        conflicts.push('phone');

      const existingCode = normalizeCode(existing.intern_code);
      if (existingCode && code && existingCode !== code) {
        const exactEmailAndPhone =
          emailMatch?.id === existing.id && phoneMatch?.id === existing.id;
        if (exactEmailAndPhone) {
          internCodeCorrection = { oldCode: existingCode, newCode: code };
        } else {
          conflicts.push('Intern Code');
        }
      }
      if (conflicts.length) {
        throw Object.assign(
          new Error(
            `${intern.name} already exists but ${conflicts.join(', ')} do not match the reviewed import`
          ),
          { statusCode: 409 }
        );
      }
    }
    return { intern, email, phone, code, existing, internCodeCorrection };
  });
}
async function execute(workbookBuffer, emailBuffer, options) {
  const workbookFingerprint = hash(workbookBuffer);
  const emailWorkbookFingerprint = hash(emailBuffer);
  if (
    options.previewFingerprint !== workbookFingerprint ||
    options.emailPreviewFingerprint !== emailWorkbookFingerprint
  ) {
    throw Object.assign(
      new Error('Workbooks changed after preview. Preview again.'),
      { statusCode: 409 }
    );
  }

  report(options, 'PARSING_WORKBOOKS');
  const asOfDate = options.asOfDate || new Date().toISOString().slice(0, 10);
  const parsed = previewWorkbook(workbookBuffer, {
    includeComparisonData: true,
    asOfDate,
  });
  if (parsed.importBlocked) {
    throw Object.assign(
      new Error('Workbook conflicts must be resolved first'),
      { statusCode: 409 }
    );
  }
  const profiles = parseEmailDetailsWorkbook(emailBuffer).profiles;
  const interns = applyEmailProfiles(
    parsed.comparisonInterns,
    profiles
  ).interns;
  const activeCandidates = interns.filter(
    (intern) => currentStatus(intern) === 'ACTIVE'
  );
  const incompleteIdentitySkipped = activeCandidates.filter(
    (intern) =>
      !intern.email &&
      !normalizePhone(intern.phone) &&
      !normalizeCode(intern.code)
  );
  const active = activeCandidates.filter(
    (intern) => !incompleteIdentitySkipped.includes(intern)
  );
  const unsafeActive = active.filter(
    (intern) =>
      !intern.email || !intern.code || intern.emailMatch === 'IDENTITY_CONFLICT'
  );
  if (unsafeActive.length) {
    throw Object.assign(
      new Error(
        `${unsafeActive.length} active intern record(s) require email or identity review`
      ),
      { statusCode: 409 }
    );
  }
  assertNoBatchIdentityDuplicates(active);

  return dbTx(async (client) => {
    report(options, 'VALIDATING_SCOPE');
    const department = (
      await client.query(
        'SELECT id,name FROM departments WHERE id=$1 AND deleted_at IS NULL',
        [options.departmentId]
      )
    ).rows[0];
    const manager = (
      await client.query(
        "SELECT id,role,email,phone,intern_code,department_id,manager_id FROM users WHERE id=$1 AND role IN ('CAPTAIN','TL','SENIOR_TL') AND deleted_at IS NULL",
        [options.managerId]
      )
    ).rows[0];
    if (!department || !manager || manager.department_id !== department.id) {
      throw Object.assign(new Error('Invalid project group or manager'), {
        statusCode: 400,
      });
    }
    const normalizedDepartment = (value) =>
      String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
    const wrongDepartment = active.find(
      (intern) =>
        intern.department &&
        normalizedDepartment(intern.department) !==
          normalizedDepartment(department.name)
    );
    if (wrongDepartment) {
      throw Object.assign(
        new Error(
          `${wrongDepartment.name} belongs to ${wrongDepartment.department} in Active Interns Master, not ${department.name}`
        ),
        { statusCode: 409, code: 'MASTER_DEPARTMENT_MISMATCH' }
      );
    }
    if (
      options.requesterRole !== 'ADMIN' &&
      (options.requesterId !== manager.id ||
        options.requesterDepartmentId !== department.id)
    ) {
      throw Object.assign(
        new Error('Senior TL can import only into their own project group'),
        { statusCode: 403 }
      );
    }

    const lockKey = [
      workbookFingerprint,
      emailWorkbookFingerprint,
      department.id,
      manager.id,
    ].join(':');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      lockKey,
    ]);
    const priorBatch = (
      await client.query(
        "SELECT id,status FROM workbook_import_batches WHERE workbook_fingerprint=$1 AND email_workbook_fingerprint=$2 AND department_id=$3 AND manager_id=$4 AND status IN ('RUNNING','COMPLETED') ORDER BY created_at DESC LIMIT 1",
        [
          workbookFingerprint,
          emailWorkbookFingerprint,
          department.id,
          manager.id,
        ]
      )
    ).rows[0];
    if (priorBatch?.status === 'COMPLETED') {
      report(options, 'REIMPORTING_COMPLETED_WORKBOOK', {
        priorBatchId: priorBatch.id,
      });
    }
    if (priorBatch?.status === 'RUNNING') {
      throw Object.assign(new Error('This exact import is already running'), {
        statusCode: 409,
      });
    }

    const batch =
      priorBatch?.status === 'COMPLETED'
        ? priorBatch
        : (
            await client.query(
              'INSERT INTO workbook_import_batches(workbook_fingerprint,email_workbook_fingerprint,department_id,manager_id,requested_by) VALUES($1,$2,$3,$4,$5) RETURNING id',
              [
                workbookFingerprint,
                emailWorkbookFingerprint,
                department.id,
                manager.id,
                options.requesterId,
              ]
            )
          ).rows[0];
    const summary = {
      activeInterns: active.length,
      incompleteIdentitySkipped: incompleteIdentitySkipped.length,
      nonActiveExcluded:
        interns.length - active.length - incompleteIdentitySkipped.length,
      accountsCreated: 0,
      existingAccounts: 0,
      existingInternAccountsReused: 0,
      existingLeadershipAccountsReused: 0,
      peopleReceivingAttendance: 0,
      attendanceCreated: 0,
      attendanceUnchanged: 0,
      attendanceKeptExisting: 0,
      attendanceUpdatedFromWorkbook: 0,
      internCodesCorrected: 0,
      ratingsCreated: 0,
      ratingsUnchanged: 0,
      ratingsFilled: 0,
      ratingsConflicting: 0,
    };

    report(options, 'CHECKING_EXISTING_ACCOUNTS', { count: active.length });
    const emails = [
      ...new Set(active.map((intern) => normalizedEmail(intern.email))),
    ];
    const phones = [
      ...new Set(
        active.map((intern) => normalizePhone(intern.phone)).filter(Boolean)
      ),
    ];
    const codes = [
      ...new Set(active.map((intern) => normalizeCode(intern.code))),
    ];
    const existingRows = (
      await client.query(
        `SELECT u.id,u.role,u.email,u.phone,u.intern_code,u.department_id,u.manager_id,
                u.password_hash,u.must_change_password,u.suspended,u.full_name,u.college,
                u.course,u.year_of_study,u.location,u.internship_domain,u.position,
                u.joining_date::text,u.completion_date::text,u.internship_status,
                u.offer_letter_url,current_manager.role AS current_manager_role,
                current_manager.department_id AS current_manager_department_id
         FROM users u
         LEFT JOIN users current_manager
           ON current_manager.id=u.manager_id AND current_manager.deleted_at IS NULL
         WHERE u.deleted_at IS NULL
           AND (LOWER(u.email)=ANY($1::text[]) OR u.phone=ANY($2::text[])
             OR UPPER(u.intern_code)=ANY($3::text[]))
         FOR UPDATE OF u`,
        [emails, phones, codes]
      )
    ).rows;
    const plans = resolveExistingAccounts(
      active,
      existingRows,
      department,
      manager
    );
    summary.existingAccounts = plans.filter((plan) => plan.existing).length;
    summary.existingInternAccountsReused = plans.filter(
      (plan) => plan.existing?.role === 'INTERN'
    ).length;
    summary.existingLeadershipAccountsReused = plans.filter((plan) =>
      ['CAPTAIN', 'TL', 'SENIOR_TL'].includes(plan.existing?.role)
    ).length;
    summary.peopleReceivingAttendance = plans.length;
    for (const plan of plans.filter((item) => item.internCodeCorrection)) {
      const owner = await client.query(
        'SELECT id FROM users WHERE UPPER(intern_code)=$1 AND deleted_at IS NULL AND id<>$2 LIMIT 1 FOR UPDATE',
        [plan.internCodeCorrection.newCode, plan.existing.id]
      );
      if (owner.rowCount > 0) {
        throw Object.assign(
          new Error(
            `${plan.intern.name} corrected Intern Code is already assigned to another account`
          ),
          { statusCode: 409, code: 'INTERN_CODE_ALREADY_USED' }
        );
      }
      await client.query(
        'UPDATE users SET intern_code=$1,updated_at=NOW() WHERE id=$2 AND deleted_at IS NULL',
        [plan.internCodeCorrection.newCode, plan.existing.id]
      );
      await createAuditLog(
        {
          userId: options.requesterId,
          action: 'WORKBOOK_INTERN_CODE_CORRECTED',
          resourceType: 'user',
          resourceId: plan.existing.id,
          details: {
            source: 'Active Interns Master',
            oldCode: plan.internCodeCorrection.oldCode,
            newCode: plan.internCodeCorrection.newCode,
          },
        },
        client
      );
      plan.existing.intern_code = plan.internCodeCorrection.newCode;
      summary.internCodesCorrected++;
    }
    summary.profilePhonesEnriched = 0;
    summary.profileFieldsEnriched = 0;
    summary.profileFieldsCorrected = 0;
    summary.profileValuesAlreadyCorrect = 0;

    const normalizedComparable = (value) =>
      String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
    const profileValue = (plan, field) => {
      const intern = plan.intern;
      if (field === 'intern_code') return plan.code;
      if (field === 'full_name') return intern.name || null;
      if (field === 'college') return intern.college || null;
      if (field === 'course') return intern.course || null;
      if (field === 'year_of_study') return intern.yearOfStudy || null;
      if (field === 'location') return intern.location || null;
      if (field === 'internship_domain') return intern.domain || null;
      if (field === 'position') return intern.position || intern.domain || null;
      if (field === 'joining_date')
        return intern.profileJoiningDate || intern.joinedDate || null;
      if (field === 'completion_date')
        return intern.completionDate || intern.profileEndingDate || null;
      if (field === 'internship_status') return currentStatus(intern) || null;
      if (field === 'offer_letter_url') return intern.offerLetterUrl || null;
      return null;
    };
    const profileFields = [
      'intern_code',
      'full_name',
      'college',
      'course',
      'year_of_study',
      'location',
      'internship_domain',
      'position',
      'joining_date',
      'completion_date',
      'internship_status',
      'offer_letter_url',
    ];

    const masterAuthoritativeFields = new Set([
      'full_name',
      'college',
      'course',
      'year_of_study',
      'location',
      'internship_domain',
      'position',
      'joining_date',
      'completion_date',
      'offer_letter_url',
    ]);
    for (const plan of plans.filter((item) => item.existing)) {
      const sets = [];
      const params = [];
      const enriched = [];
      const corrected = [];
      const exactEmailAndPhone =
        normalizedEmail(plan.existing.email) === plan.email &&
        normalizePhone(plan.existing.phone) === plan.phone;
      for (const field of profileFields) {
        const incoming = profileValue(plan, field);
        if (!incoming) continue;
        const current = plan.existing[field];
        if (current == null || String(current).trim() === '') {
          params.push(incoming);
          sets.push(`${field}=$${params.length}`);
          enriched.push(field);
        } else if (
          normalizedComparable(current) === normalizedComparable(incoming)
        ) {
          summary.profileValuesAlreadyCorrect++;
        } else if (masterAuthoritativeFields.has(field) && exactEmailAndPhone) {
          params.push(incoming);
          sets.push(`${field}=$${params.length}`);
          corrected.push({ field, oldValue: current, newValue: incoming });
        } else if (field !== 'internship_status') {
          throw Object.assign(
            new Error(
              `${plan.intern.name} ${field} conflicts with the reviewed import`
            ),
            { statusCode: 409, code: 'PROFILE_VALUE_CONFLICT', field }
          );
        }
      }
      if (sets.length) {
        params.push(plan.existing.id);
        await client.query(
          `UPDATE users SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length} AND deleted_at IS NULL`,
          params
        );
        summary.profileFieldsEnriched += enriched.length;
        summary.profileFieldsCorrected += corrected.length;
        await createAuditLog(
          {
            userId: options.requesterId,
            action: corrected.length
              ? 'WORKBOOK_MASTER_PROFILE_SYNCED'
              : 'WORKBOOK_PROFILE_ENRICHED',
            resourceType: 'user',
            resourceId: plan.existing.id,
            details: {
              source: 'Active Interns Master',
              enrichedFields: enriched,
              correctedFields: corrected,
            },
          },
          client
        );
      }
    }

    summary.profilePhonesEnriched = 0;
    for (const plan of plans.filter(
      (item) =>
        item.existing && !normalizePhone(item.existing.phone) && item.phone
    )) {
      const phoneOwner = await client.query(
        'SELECT id FROM users WHERE phone=$1 AND deleted_at IS NULL AND id<>$2 LIMIT 1',
        [plan.phone, plan.existing.id]
      );
      if (phoneOwner.rowCount > 0) {
        throw Object.assign(
          new Error(
            `${plan.intern.name} phone is already assigned to another account`
          ),
          { statusCode: 409, code: 'PHONE_ALREADY_USED' }
        );
      }
      await client.query(
        'UPDATE users SET phone=$1,updated_at=NOW() WHERE id=$2 AND phone IS NULL AND deleted_at IS NULL',
        [plan.phone, plan.existing.id]
      );
      await createAuditLog(
        {
          userId: options.requesterId,
          action: 'PROFILE_PHONE_ENRICHED',
          resourceType: 'user',
          resourceId: plan.existing.id,
          details: { source: 'reviewed workbook import' },
        },
        client
      );
      plan.existing.phone = plan.phone;
      summary.profilePhonesEnriched++;
    }
    const newPlans = plans.filter((plan) => !plan.existing);
    summary.newInternAccounts = newPlans.length;

    report(options, 'HASHING_PASSWORDS', { count: newPlans.length });
    const hashedPlans = await mapWithConcurrency(newPlans, 4, async (plan) => ({
      ...plan,
      passwordHash: await argon2.hash(plan.code),
    }));

    if (hashedPlans.length) {
      report(options, 'CREATING_ACCOUNTS', { count: hashedPlans.length });
      const columns = 17;
      const sql = `INSERT INTO users(email,password_hash,role,manager_id,department_id,full_name,phone,joining_date,completion_date,internship_status,intern_code,college,course,year_of_study,location,internship_domain,position,offer_letter_url,must_change_password,email_verified)
        SELECT v.email,v.password_hash,'INTERN',v.manager_id::uuid,v.department_id::uuid,v.full_name,v.phone,v.joining_date::date,v.completion_date::date,'ACTIVE',v.intern_code,v.college,v.course,v.year_of_study,v.location,v.internship_domain,v.position,v.offer_letter_url,TRUE,TRUE
        FROM (VALUES ${valuesSql(hashedPlans, Array(columns).fill(null))}) AS v(email,password_hash,manager_id,department_id,full_name,phone,joining_date,completion_date,intern_code,college,course,year_of_study,location,internship_domain,position,offer_letter_url,plan_index)
        RETURNING id,intern_code`;
      const params = flatten(
        hashedPlans.map((plan, index) => [
          plan.email,
          plan.passwordHash,
          manager.id,
          department.id,
          plan.intern.name,
          plan.phone,
          plan.intern.profileJoiningDate || plan.intern.joinedDate || null,
          plan.intern.completionDate || plan.intern.profileEndingDate || null,
          plan.code,
          plan.intern.college || null,
          plan.intern.course || null,
          plan.intern.yearOfStudy || null,
          plan.intern.location || null,
          plan.intern.domain || null,
          plan.intern.position || plan.intern.domain || null,
          plan.intern.offerLetterUrl || null,
          index,
        ])
      );
      const inserted = (await client.query(sql, params)).rows;
      const byCode = new Map(
        inserted.map((row) => [normalizeCode(row.intern_code), row.id])
      );
      for (const plan of hashedPlans) plan.userId = byCode.get(plan.code);
      summary.accountsCreated = inserted.length;
    }

    for (const plan of plans) {
      if (plan.existing) plan.userId = plan.existing.id;
      else {
        const hashed = hashedPlans.find((item) => item.code === plan.code);
        plan.userId = hashed?.userId;
      }
      if (!plan.userId) {
        throw new Error(`Could not resolve account for ${plan.intern.name}`);
      }
    }

    const attendanceRows = plans.flatMap((plan) =>
      (plan.intern.attendance || []).map((item) => ({
        userId: plan.userId,
        name: plan.intern.name,
        date: item.date,
        status: item.status,
        remarks: item.remarks || null,
        sourceSheet: item.sourceSheet || null,
        sourceRow: item.sourceRow || null,
      }))
    );
    report(options, 'CHECKING_EXISTING_ATTENDANCE', {
      count: attendanceRows.length,
    });
    const pairColumns = 2;
    const existingAttendance = attendanceRows.length
      ? (
          await client.query(
            `SELECT a.user_id,a.date::text,a.status,a.remarks
             FROM attendance a
             JOIN (VALUES ${valuesSql(attendanceRows, Array(pairColumns).fill(null))}) AS wanted(user_id,date)
               ON a.user_id=wanted.user_id::uuid AND a.date=wanted.date::date
             WHERE a.deleted_at IS NULL
             FOR UPDATE`,
            flatten(attendanceRows.map((row) => [row.userId, row.date]))
          )
        ).rows
      : [];
    const existingAttendanceMap = new Map(
      existingAttendance.map((row) => [
        `${row.user_id}:${String(row.date).slice(0, 10)}`,
        row,
      ])
    );
    const toInsert = [];
    for (const row of attendanceRows) {
      const old = existingAttendanceMap.get(`${row.userId}:${row.date}`);
      if (!old) {
        toInsert.push(row);
      } else if (
        normalizedText(old.status) === normalizedText(row.status) &&
        String(old.remarks || '') === String(row.remarks || '')
      ) {
        summary.attendanceUnchanged++;
      } else {
        const conflictId = `DATABASE_ATTENDANCE|${row.userId}|${row.date}`;
        const resolution = options.attendanceResolutions?.[conflictId];
        if (resolution === 'KEEP_EXISTING') {
          summary.attendanceKeptExisting++;
          continue;
        }
        if (resolution !== 'USE_WORKBOOK') {
          throw Object.assign(
            new Error(
              `Attendance resolution required for ${row.name} on ${row.date}`
            ),
            { statusCode: 409, code: 'ATTENDANCE_RESOLUTION_REQUIRED' }
          );
        }
        const updatedAttendance = (
          await client.query(
            `UPDATE attendance
             SET status=$1,remarks=$2,marked_by=$3
             WHERE user_id=$4 AND date=$5::date AND deleted_at IS NULL
             RETURNING id`,
            [row.status, row.remarks, options.requesterId, row.userId, row.date]
          )
        ).rows[0];
        if (!updatedAttendance) {
          throw Object.assign(
            new Error(
              `Attendance changed after preview for ${row.name} on ${row.date}`
            ),
            { statusCode: 409, code: 'ATTENDANCE_CHANGED_AFTER_PREVIEW' }
          );
        }
        await createAuditLog(
          {
            userId: options.requesterId,
            action: 'WORKBOOK_ATTENDANCE_REPLACED',
            resourceType: 'attendance',
            resourceId: updatedAttendance.id,
            details: {
              date: row.date,
              oldStatus: old.status,
              oldRemarks: old.remarks || null,
              newStatus: row.status,
              newRemarks: row.remarks || null,
              sourceSheet: row.sourceSheet || null,
              sourceRow: row.sourceRow || null,
            },
          },
          client
        );
        summary.attendanceUpdatedFromWorkbook++;
      }
    }

    if (toInsert.length) {
      report(options, 'CREATING_ATTENDANCE', { count: toInsert.length });
      const columns = 5;
      await client.query(
        `INSERT INTO attendance(user_id,marked_by,date,status,remarks) VALUES ${valuesSql(toInsert, Array(columns).fill(null))}`,
        flatten(
          toInsert.map((row) => [
            row.userId,
            options.requesterId,
            row.date,
            row.status,
            row.remarks,
          ])
        )
      );
      summary.attendanceCreated = toInsert.length;
    }

    const parsedRatingRows = plans.flatMap((plan) =>
      (plan.intern.ratings || []).map((rating) => ({
        ...rating,
        userId: plan.userId,
        name: plan.intern.name,
      }))
    );
    const ratingRowsBySource = new Map();
    for (const row of parsedRatingRows) {
      const current = ratingRowsBySource.get(row.sourceKey);
      if (!current) {
        ratingRowsBySource.set(row.sourceKey, row);
        continue;
      }
      ratingRowsBySource.set(row.sourceKey, {
        ...current,
        score: current.score ?? row.score ?? null,
        remarks: current.remarks || row.remarks || null,
      });
    }
    const ratingRows = [...ratingRowsBySource.values()];
    if (ratingRows.length) {
      report(options, 'CHECKING_EXISTING_RATINGS', {
        count: ratingRows.length,
      });
      const existingRatings = (
        await client.query(
          `SELECT rated_user_id,score::text,remarks,source_key
           FROM ratings
           WHERE source_key=ANY($1::text[]) AND deleted_at IS NULL
           FOR UPDATE`,
          [[...new Set(ratingRows.map((row) => row.sourceKey))]]
        )
      ).rows;
      const existingBySource = new Map(
        existingRatings.map((row) => [row.source_key, row])
      );
      const ratingsToInsert = [];
      const ratingsToFill = [];
      for (const row of ratingRows) {
        const old = existingBySource.get(row.sourceKey);
        if (!old) {
          ratingsToInsert.push(row);
          continue;
        }
        const oldScoreEmpty =
          old.score == null || String(old.score).trim() === '';
        const oldRemarksEmpty = String(old.remarks || '').trim() === '';
        const scoreToFill =
          oldScoreEmpty && row.score != null ? row.score : null;
        const remarksToFill =
          oldRemarksEmpty && String(row.remarks || '').trim()
            ? row.remarks
            : null;
        if (scoreToFill != null || remarksToFill != null) {
          ratingsToFill.push({
            sourceKey: row.sourceKey,
            score: scoreToFill,
            remarks: remarksToFill,
          });
        } else {
          summary.ratingsUnchanged++;
        }
      }
      for (const row of ratingsToFill) {
        await client.query(
          `UPDATE ratings
           SET score=CASE WHEN score IS NULL THEN $1::numeric ELSE score END,
               remarks=CASE
                 WHEN COALESCE(BTRIM(remarks),'')='' THEN $2
                 ELSE remarks
               END
           WHERE source_key=$3 AND deleted_at IS NULL`,
          [row.score, row.remarks, row.sourceKey]
        );
      }
      summary.ratingsFilled = ratingsToFill.length;
      if (ratingsToInsert.length) {
        const columns = 10;
        await client.query(
          `INSERT INTO ratings(rated_user_id,rated_by,score,remarks,created_at,rating_period_start,rating_period_end,source_sheet,source_row,source_key)
           SELECT v.rated_user_id::uuid,v.rated_by::uuid,v.score::numeric,v.remarks,v.created_at::timestamptz,v.period_start::date,v.period_end::date,v.source_sheet,v.source_row::integer,v.source_key
           FROM (VALUES ${valuesSql(ratingsToInsert, Array(columns).fill(null))}) AS v(rated_user_id,rated_by,score,remarks,created_at,period_start,period_end,source_sheet,source_row,source_key)`,
          flatten(
            ratingsToInsert.map((row) => [
              row.userId,
              options.requesterId,
              row.score,
              row.remarks,
              `${row.ratingDate}T12:00:00Z`,
              row.startDate,
              row.endDate,
              row.sourceSheet,
              row.sourceRow,
              row.sourceKey,
            ])
          )
        );
        summary.ratingsCreated = ratingsToInsert.length;
      }
    }
    await client.query(
      "UPDATE workbook_import_batches SET status='COMPLETED',summary=$1,completed_at=NOW() WHERE id=$2",
      [summary, batch.id]
    );
    await createAuditLog(
      {
        userId: options.requesterId,
        action: 'WORKBOOK_IMPORT_COMPLETED',
        resourceType: 'workbook_import',
        resourceId: batch.id,
        details: summary,
      },
      client
    );
    report(options, 'COMPLETED', summary);
    return { success: true, batchId: batch.id, summary };
  });
}

module.exports = {
  execute,
  hash,
  mapWithConcurrency,
  resolveExistingAccounts,
  findBatchIdentityDuplicates,
  assertNoBatchIdentityDuplicates,
};
