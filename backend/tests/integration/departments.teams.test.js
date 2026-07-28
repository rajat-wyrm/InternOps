const crypto = require('crypto');
const argon2 = require('argon2');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const {
  SEEDED_ADMIN_EMAIL,
  SEEDED_ADMIN_PASSWORD,
  resetSeededAdminPassword,
  clearLoginAttempts,
  parseSetCookie,
  mergeCookies,
} = require('./helpers');

jest.setTimeout(30000);

const runId = Date.now();
const departmentName = `Teams Dept ${runId}`;
const adminTestEmail = `dept-admin-${runId}@internops.com`;
const nonAdminTestEmail = `dept-tl-${runId}@internops.com`;
const leadTlEmail = `dept-lead-tl-${runId}@internops.com`;
const leadCaptainEmail = `dept-lead-captain-${runId}@internops.com`;
const teamMemberEmails = [
  `dept-member-1-${runId}@internops.com`,
  `dept-member-2-${runId}@internops.com`,
  `dept-member-3-${runId}@internops.com`,
];

let departmentId;
let leadTlId;
let leadCaptainId;
let adminAccessToken;
let nonAdminAccessToken;

async function loginAs(email) {
  const cookies = {};

  const csrfRes = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/csrf-token',
  });

  const csrfToken = JSON.parse(csrfRes.body).csrfToken;
  mergeCookies(cookies, parseSetCookie(csrfRes.headers['set-cookie']));
  mergeCookies(cookies, csrfRes.cookies);

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    cookies,
    headers: {
      'X-CSRF-Token': csrfToken,
      'Content-Type': 'application/json',
    },
    payload: {
      email,
      password: SEEDED_ADMIN_PASSWORD,
    },
  });

  expect(loginRes.statusCode).toBe(200);
  return JSON.parse(loginRes.body).accessToken;
}

beforeAll(async () => {
  await app.ready();
  await resetSeededAdminPassword();
  await clearLoginAttempts();

  const passwordHash = await argon2.hash(SEEDED_ADMIN_PASSWORD);

  const deptRes = await pool.query(
    'INSERT INTO departments (name, created_by) VALUES ($1, NULL) RETURNING id',
    [departmentName]
  );
  departmentId = deptRes.rows[0].id;

  await pool.query(
    `INSERT INTO users (id, email, password_hash, role, full_name, department_id)
    VALUES ($1,$2,$3,'ADMIN',$4,$5),
      ($6,$7,$8,'SENIOR_TL',$9,$10),
      ($11,$12,$13,'CAPTAIN',$14,$15),
      ($16,$17,$18,'INTERN',$19,$20)`,
    [
      crypto.randomUUID(),
      adminTestEmail,
      passwordHash,
      'Department Admin',
      departmentId,
      crypto.randomUUID(),
      leadTlEmail,
      passwordHash,
      'TL Lead',
      departmentId,
      crypto.randomUUID(),
      leadCaptainEmail,
      passwordHash,
      'Captain Lead',
      departmentId,
      crypto.randomUUID(),
      nonAdminTestEmail,
      passwordHash,
      'Non Admin TL',
      departmentId,
    ]
  );

  const leadTlRes = await pool.query('SELECT id FROM users WHERE email = $1', [
    leadTlEmail,
  ]);
  leadTlId = leadTlRes.rows[0].id;

  const leadCaptainRes = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [leadCaptainEmail]
  );
  leadCaptainId = leadCaptainRes.rows[0].id;

  await pool.query(
    `INSERT INTO users (id, email, password_hash, role, full_name, manager_id, department_id)
     VALUES ($1,$2,$3,'INTERN',$4,$5,$6),
            ($7,$8,$9,'INTERN',$10,$11,$12),
            ($13,$14,$15,'INTERN',$16,$17,$18)`,
    [
      crypto.randomUUID(),
      teamMemberEmails[0],
      passwordHash,
      'Member One',
      leadTlId,
      departmentId,
      crypto.randomUUID(),
      teamMemberEmails[1],
      passwordHash,
      'Member Two',
      leadTlId,
      departmentId,
      crypto.randomUUID(),
      teamMemberEmails[2],
      passwordHash,
      'Member Three',
      leadCaptainId,
      departmentId,
    ]
  );

  adminAccessToken = await loginAs(SEEDED_ADMIN_EMAIL);
  nonAdminAccessToken = await loginAs(nonAdminTestEmail);
});

afterAll(async () => {
  try {
    await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [
      [
        adminTestEmail,
        nonAdminTestEmail,
        leadTlEmail,
        leadCaptainEmail,
        ...teamMemberEmails,
      ],
    ]);
    await pool.query('DELETE FROM departments WHERE id = $1', [departmentId]);
    await resetSeededAdminPassword();
  } finally {
    await app.close();
  }
});

describe('GET /api/departments/:deptId/teams', () => {
  it('returns grouped department leads for admin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/departments/${departmentId}/teams`,
      headers: {
        Authorization: `Bearer ${adminAccessToken}`,
      },
    });

    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);

    const seniorTlLead = body.find((row) => row.lead_id === leadTlId);

    expect(seniorTlLead).toMatchObject({
      lead_name: 'TL Lead',
      role: 'SENIOR_TL',
      member_count: 2,
    });
  });

  it('returns 403 for non-admin users', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/departments/${departmentId}/teams`,
      headers: {
        Authorization: `Bearer ${nonAdminAccessToken}`,
      },
    });

    expect(res.statusCode).toBe(403);
  });
});
