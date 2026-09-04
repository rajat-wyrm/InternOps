require('dotenv').config();
const readline = require('readline');
const pool = require('../src/config/db');

const PROTECTED_ADMIN_EMAIL = 'admin@internops.com';
const EXTRA_TEST_USER_EMAILS = [
  'test@test.com',
  'test1@test.com',
  'test2@test.com',
  'test3@test.com',
  'test4567857456@example.com',
  'test@internops.com',
];
const EXTRA_TEST_USER_PREFIXES = ['tl-rate-', 'tl-size-'];
const SEEDED_USER_EMAILS = [
  'priya.senior@internops.com',
  'vikram.senior@internops.com',
  'anita.tl@internops.com',
  'rahul.tl@internops.com',
  'deepa.tl@internops.com',
  'arjun.captain@internops.com',
  'meera.captain@internops.com',
  'rohan.captain@internops.com',
  'sneha.intern@internops.com',
  'aditya.intern@internops.com',
  'kriti.intern@internops.com',
  'varun.intern@internops.com',
  'nishita.intern@internops.com',
  'karan.intern@internops.com',
  'pooja.intern@internops.com',
  'sid.intern@internops.com',
  'tanya.intern@internops.com',
  'nikhil.intern@internops.com',
  'isha.intern@internops.com',
];
const SEEDED_NOTICE_TITLES = [
  'Welcome to InternOps Q3 2026',
  'Monthly Town Hall - July 2026',
  'New Leave Policy Update',
  'Hackathon Week - August 4-8',
  'Office Holiday - Independence Day',
];
const SEEDED_TASK_TITLES = [
  'Complete Profile Setup',
  'First Pull Request',
  'Code Review Champion',
  'Design System Contribution',
  'Blog Post Author',
  'Mentor Session',
  'Sprint Demo Presenter',
  'Bug Bounty Hunter',
  'Documentation Hero',
  'Team Building Organizer',
];
const SEEDED_MEETING_TITLES = [
  'Sprint Planning',
  'Daily Standup',
  'Tech Talk: React Server Components',
  'Design Review',
  'All Hands Meeting',
];
const SEEDED_TEMPLATE_NAMES = [
  'Classic Gold',
  'Modern Blue',
  'Corporate Silver',
  'Royal Purple',
  'Forest Green',
  'Crimson Excellence',
  'Ocean Teal',
  'Midnight Dark',
  'Floral Rose',
  'Golden Prestige',
];
const qi = (value) => `"${String(value).replaceAll('"', '""')}"`;

async function tables(client) {
  const { rows } = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
  );
  return new Set(rows.map((row) => row.table_name));
}
async function userForeignKeys(client) {
  const { rows } = await client.query(`
    SELECT tc.table_name, kcu.column_name, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name=kcu.constraint_name AND tc.constraint_schema=kcu.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name=tc.constraint_name AND ccu.constraint_schema=tc.constraint_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name=tc.constraint_name AND rc.constraint_schema=tc.constraint_schema
    WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
      AND ccu.table_name='users' AND ccu.column_name='id'
    ORDER BY tc.table_name, kcu.column_name`);
  return rows;
}
function isGeneratedTestUserEmail(email) {
  const normalized = String(email || '').toLowerCase();
  return EXTRA_TEST_USER_PREFIXES.some(
    (prefix) =>
      normalized.startsWith(prefix) && normalized.endsWith('@example.com')
  );
}
function isProtectedUser(email, actorEmail) {
  const normalized = String(email || '').toLowerCase();
  return (
    normalized === PROTECTED_ADMIN_EMAIL ||
    normalized === String(actorEmail || '').toLowerCase()
  );
}
async function targetUsers(client, actorEmail) {
  const { rows } = await client.query(
    `SELECT id,email,role,full_name FROM users
     WHERE deleted_at IS NULL
       AND (
         LOWER(email)=ANY($1::text[])
         OR LOWER(email)=ANY($2::text[])
         OR LOWER(email) LIKE 'tl-rate-%@example.com'
         OR LOWER(email) LIKE 'tl-size-%@example.com'
       )
     ORDER BY role,email`,
    [SEEDED_USER_EMAILS, EXTRA_TEST_USER_EMAILS]
  );
  return rows.filter((user) => !isProtectedUser(user.email, actorEmail));
}
function isAutomatedTestDepartment(name) {
  const value = String(name || '');
  return (
    value === 'Test' ||
    /^(?:TestDept_|PassingDept_|TestBearer_)\d+$/.test(value) ||
    /^Test Dept [12] \d+$/.test(value)
  );
}
async function targetDepartments(client) {
  const { rows } = await client.query(`
    SELECT id,name,created_at FROM departments
    WHERE name='Test'
       OR name ~ '^(TestDept_|PassingDept_|TestBearer_)[0-9]+$'
       OR name ~ '^Test Dept [12] [0-9]+$'
    ORDER BY created_at,name`);
  return rows;
}

async function countExact(client, knownTables, table, column, values) {
  if (!knownTables.has(table)) return 0;
  const { rows } = await client.query(
    `SELECT COUNT(*)::int count FROM ${qi(table)} WHERE ${qi(column)}=ANY($1::text[])`,
    [values]
  );
  return rows[0].count;
}
async function preview(client, actorEmail) {
  const knownTables = await tables(client);
  const users = await targetUsers(client, actorEmail);
  const departments = await targetDepartments(client);
  const ids = users.map((user) => user.id);
  const dependencies = [];
  if (ids.length) {
    for (const fk of await userForeignKeys(client)) {
      const { rows } = await client.query(
        `SELECT COUNT(*)::int count FROM ${qi(fk.table_name)} WHERE ${qi(fk.column_name)}=ANY($1::uuid[])`,
        [ids]
      );
      dependencies.push({ ...fk, count: rows[0].count });
    }
  }
  return {
    users,
    ids,
    departments,
    dependencies,
    exact: {
      notices: await countExact(
        client,
        knownTables,
        'notices',
        'title',
        SEEDED_NOTICE_TITLES
      ),
      tasks: await countExact(
        client,
        knownTables,
        'social_tasks',
        'title',
        SEEDED_TASK_TITLES
      ),
      meetings: await countExact(
        client,
        knownTables,
        'meetings',
        'title',
        SEEDED_MEETING_TITLES
      ),
      templates: await countExact(
        client,
        knownTables,
        'certificate_templates',
        'name',
        SEEDED_TEMPLATE_NAMES
      ),
    },
  };
}
function printPreview(data) {
  console.log('\nSeed-data cleanup preview\n=========================');
  console.log(`Matched test users: ${data.users.length}`);
  data.users.forEach((u) =>
    console.log(`  - ${u.email} | ${u.role} | ${u.full_name || ''}`)
  );
  console.log(`Matched test departments: ${data.departments.length}`);
  data.departments.forEach((d) => console.log(`  - department: ${d.name}`));
  console.log('\nUser-linked records:');
  const linked = data.dependencies.filter((item) => item.count > 0);
  if (!linked.length) console.log('  (none)');
  linked.forEach((item) =>
    console.log(
      `  - ${item.table_name}.${item.column_name}: ${item.count} (FK ${item.delete_rule})`
    )
  );
  console.log('\nExact shared seed records:');
  Object.entries(data.exact).forEach(([name, count]) =>
    console.log(`  - ${name}: ${count}`)
  );
}
function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    })
  );
}
async function deleteLinked(client, data) {
  if (!data.ids.length) return;
  await client.query(
    `UPDATE users SET manager_id=NULL,updated_at=NOW()
     WHERE manager_id=ANY($1::uuid[]) AND NOT(id=ANY($1::uuid[]))`,
    [data.ids]
  );
  for (const fk of await userForeignKeys(client)) {
    if (
      fk.table_name === 'users' ||
      ['CASCADE', 'SET NULL'].includes(fk.delete_rule)
    )
      continue;
    await client.query(
      `DELETE FROM ${qi(fk.table_name)} WHERE ${qi(fk.column_name)}=ANY($1::uuid[])`,
      [data.ids]
    );
  }
  await client.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [data.ids]);
}
async function deleteDepartments(client, data) {
  const ids = data.departments.map((department) => department.id);
  if (!ids.length) return;
  const knownTables = await tables(client);
  const { rows: fks } = await client.query(`
    SELECT tc.table_name,kcu.column_name,rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name=kcu.constraint_name AND tc.constraint_schema=kcu.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name=tc.constraint_name AND ccu.constraint_schema=tc.constraint_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name=tc.constraint_name AND rc.constraint_schema=tc.constraint_schema
    WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
      AND ccu.table_name='departments' AND ccu.column_name='id'`);
  if (knownTables.has('users')) {
    await client.query(
      'UPDATE users SET department_id=NULL,updated_at=NOW() WHERE department_id=ANY($1::uuid[])',
      [ids]
    );
  }
  for (const fk of fks) {
    if (
      fk.table_name === 'users' ||
      ['CASCADE', 'SET NULL'].includes(fk.delete_rule)
    )
      continue;
    await client.query(
      `DELETE FROM ${qi(fk.table_name)} WHERE ${qi(fk.column_name)}=ANY($1::uuid[])`,
      [ids]
    );
  }
  await client.query('DELETE FROM departments WHERE id=ANY($1::uuid[])', [ids]);
}
async function deleteExact(client) {
  const knownTables = await tables(client);
  const jobs = [
    ['notices', 'title', SEEDED_NOTICE_TITLES],
    ['social_tasks', 'title', SEEDED_TASK_TITLES],
    ['meetings', 'title', SEEDED_MEETING_TITLES],
    ['certificate_templates', 'name', SEEDED_TEMPLATE_NAMES],
  ];
  for (const [table, column, values] of jobs) {
    if (knownTables.has(table)) {
      await client.query(
        `DELETE FROM ${qi(table)} WHERE ${qi(column)}=ANY($1::text[])`,
        [values]
      );
    }
  }
  if (knownTables.has('attendance_exemptions')) {
    await client.query(`DELETE FROM attendance_exemptions WHERE user_id IS NULL
      AND exemption_type='PUBLIC_HOLIDAY' AND description='National Day Holiday'`);
  }
}
async function audit(client, data, actorEmail) {
  const knownTables = await tables(client);
  if (!knownTables.has('audit_logs')) return;
  const actor = await client.query(
    'SELECT id FROM users WHERE LOWER(email)=LOWER($1) AND deleted_at IS NULL',
    [actorEmail]
  );
  await client.query(
    `INSERT INTO audit_logs(user_id,action,resource_type,details)
     VALUES($1,'SEED_DATA_CLEANED','seed_data',$2::jsonb)`,
    [
      actor.rows[0]?.id || null,
      JSON.stringify({
        deletedUserEmails: data.users.map((user) => user.email),
        deletedDepartments: data.departments.map(
          (department) => department.name
        ),
        dependencyCounts: data.dependencies,
        exactSeedCounts: data.exact,
      }),
    ]
  );
}
async function main() {
  const apply = process.argv.includes('--apply');
  const actorArg = process.argv.find((arg) => arg.startsWith('--actor='));
  const actorEmail = actorArg?.slice(8) || process.env.SEED_ADMIN_EMAIL;
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (apply && !actorEmail)
    throw new Error('Use --actor=<admin email> or set SEED_ADMIN_EMAIL');
  const client = await pool.connect();
  try {
    const data = await preview(client, actorEmail);
    printPreview(data);
    if (!apply) {
      console.log('\nPreview only. No records were changed.');
      return;
    }
    if (
      data.users.some((u) => u.email.toLowerCase() === actorEmail.toLowerCase())
    ) {
      throw new Error('Cleanup actor is in the deletion selection');
    }
    const answer = await ask('\nType DELETE SEED DATA to continue: ');
    if (answer !== 'DELETE SEED DATA') {
      console.log('Cancelled. No records were changed.');
      return;
    }
    await client.query('BEGIN');
    try {
      await deleteLinked(client, data);
      await deleteDepartments(client, data);
      await deleteExact(client);
      await audit(client, data, actorEmail);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    console.log('\n[OK] Seeded user accounts removed.');
    console.log('[OK] User-linked seeded records removed.');
    console.log('[OK] Automated test departments removed.');
    console.log('[OK] Exact shared seed records removed.');
    console.log('[OK] Admin account and unrelated data preserved.');
    console.log('[OK] Cleanup audit entry recorded when available.');
  } finally {
    client.release();
    await pool.end();
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(`Cleanup failed: ${error.message}`);
    process.exitCode = 1;
  });
module.exports = {
  PROTECTED_ADMIN_EMAIL,
  EXTRA_TEST_USER_EMAILS,
  SEEDED_USER_EMAILS,
  SEEDED_NOTICE_TITLES,
  SEEDED_TASK_TITLES,
  SEEDED_MEETING_TITLES,
  SEEDED_TEMPLATE_NAMES,
  isGeneratedTestUserEmail,
  isProtectedUser,
  isAutomatedTestDepartment,
};
