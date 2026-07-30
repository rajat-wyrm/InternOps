require('dotenv').config();
const pool = require('../src/config/db');
const argon2 = require('argon2');
const crypto = require('crypto');

const uuid = () => crypto.randomUUID();
const hash = async (pw) => await argon2.hash(pw);
const now = new Date().toISOString();
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ============================================================
    // USERS
    // ============================================================
    console.log('Seeding users...');
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@internops.com';
    const adminPass = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
    const pw = await hash(adminPass);
    const users = [
      {
        id: uuid(),
        email: adminEmail,
        role: 'ADMIN',
        full_name: 'System Admin',
      },
      {
        id: uuid(),
        email: 'priya.senior@internops.com',
        role: 'SENIOR_TL',
        full_name: 'Priya Sharma',
      },
      {
        id: uuid(),
        email: 'vikram.senior@internops.com',
        role: 'SENIOR_TL',
        full_name: 'Vikram Singh',
      },
      {
        id: uuid(),
        email: 'anita.tl@internops.com',
        role: 'TL',
        full_name: 'Anita Patel',
      },
      {
        id: uuid(),
        email: 'rahul.tl@internops.com',
        role: 'TL',
        full_name: 'Rahul Verma',
      },
      {
        id: uuid(),
        email: 'deepa.tl@internops.com',
        role: 'TL',
        full_name: 'Deepa Nair',
      },
      {
        id: uuid(),
        email: 'arjun.captain@internops.com',
        role: 'CAPTAIN',
        full_name: 'Arjun Reddy',
      },
      {
        id: uuid(),
        email: 'meera.captain@internops.com',
        role: 'CAPTAIN',
        full_name: 'Meera Joshi',
      },
      {
        id: uuid(),
        email: 'rohan.captain@internops.com',
        role: 'CAPTAIN',
        full_name: 'Rohan Gupta',
      },
      {
        id: uuid(),
        email: 'sneha.intern@internops.com',
        role: 'INTERN',
        full_name: 'Sneha Kulkarni',
      },
      {
        id: uuid(),
        email: 'aditya.intern@internops.com',
        role: 'INTERN',
        full_name: 'Aditya Deshmukh',
      },
      {
        id: uuid(),
        email: 'kriti.intern@internops.com',
        role: 'INTERN',
        full_name: 'Kriti Malhotra',
      },
      {
        id: uuid(),
        email: 'varun.intern@internops.com',
        role: 'INTERN',
        full_name: 'Varun Iyer',
      },
      {
        id: uuid(),
        email: 'nishita.intern@internops.com',
        role: 'INTERN',
        full_name: 'Nishita Rao',
      },
      {
        id: uuid(),
        email: 'karan.intern@internops.com',
        role: 'INTERN',
        full_name: 'Karan Bhatia',
      },
      {
        id: uuid(),
        email: 'pooja.intern@internops.com',
        role: 'INTERN',
        full_name: 'Pooja Agarwal',
      },
      {
        id: uuid(),
        email: 'sid.intern@internops.com',
        role: 'INTERN',
        full_name: 'Siddharth Menon',
      },
      {
        id: uuid(),
        email: 'tanya.intern@internops.com',
        role: 'INTERN',
        full_name: 'Tanya Kapoor',
      },
      {
        id: uuid(),
        email: 'nikhil.intern@internops.com',
        role: 'INTERN',
        full_name: 'Nikhil Choudhary',
      },
      {
        id: uuid(),
        email: 'isha.intern@internops.com',
        role: 'INTERN',
        full_name: 'Isha Thakur',
      },
    ];

    // First ensure admin exists
    const adminCheck = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail]
    );
    if (adminCheck.rowCount === 0) {
      await client.query(
        'INSERT INTO users (id, email, password_hash, role, full_name, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [
          users[0].id,
          users[0].email,
          pw,
          users[0].role,
          users[0].full_name,
          now,
          now,
        ]
      );
    }
    await client.query('DELETE FROM users WHERE email != $1', [adminEmail]);

    for (const u of users) {
      if (u.email === adminEmail) {
        await client.query(
          'UPDATE users SET full_name = $1, role = $2, password_hash = $3 WHERE email = $4',
          [u.full_name, u.role, pw, u.email]
        );
      } else {
        await client.query(
          'INSERT INTO users (id, email, password_hash, role, full_name, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [
            u.id,
            u.email,
            pw,
            u.role,
            u.full_name,
            daysAgo(Math.floor(Math.random() * 60)),
            now,
          ]
        );
      }
    }
    console.log(`  ${users.length} users`);

    const adminRes = await client.query(
      'SELECT id FROM users WHERE email = $1',
      ['admin@internops.com']
    );
    const adminId = adminRes.rows[0].id;

    // ============================================================
    // DEPARTMENTS
    // ============================================================
    console.log('Seeding departments...');
    const departments = [
      'Engineering',
      'Design',
      'Marketing',
      'Data Science',
      'Product',
      'Human Resources',
      'Finance',
      'Operations',
    ];
    await client.query('DELETE FROM departments');
    for (const name of departments) {
      await client.query(
        'INSERT INTO departments (id, name, created_by, created_at) VALUES ($1,$2,$3,$4)',
        [uuid(), name, adminId, now]
      );
    }
    console.log(`  ${departments.length} departments`);

    // ============================================================
    // NOTICES
    // ============================================================
    console.log('Seeding notices...');
    const notices = [
      {
        title: 'Welcome to InternOps Q3 2026',
        content:
          'Welcome all new interns! Please complete your onboarding checklist within the first week.',
        category: 'announcement',
      },
      {
        title: 'Monthly Town Hall - July 2026',
        content: 'Join us for the monthly town hall on July 15th at 3 PM IST.',
        category: 'event',
      },
      {
        title: 'New Leave Policy Update',
        content:
          'Updated leave policy effective from August 1st. Check HR portal for details.',
        category: 'policy',
      },
      {
        title: 'Hackathon Week - August 4-8',
        content:
          'Annual hackathon! Form teams of 3-5 and register by July 25th. Prizes worth $5000!',
        category: 'event',
      },
      {
        title: 'Office Holiday - Independence Day',
        content: 'August 15th will be a company holiday.',
        category: 'holiday',
      },
    ];
    await client.query('DELETE FROM notices');
    for (const n of notices) {
      await client.query(
        'INSERT INTO notices (id, title, content, category, created_by, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
        [
          uuid(),
          n.title,
          n.content,
          n.category,
          adminId,
          daysAgo(Math.floor(Math.random() * 30)),
        ]
      );
    }
    console.log(`  ${notices.length} notices`);

    // ============================================================
    // SOCIAL TASKS
    // ============================================================
    console.log('Seeding social tasks...');
    const tasks = [
      {
        title: 'Complete Profile Setup',
        description:
          'Fill in all profile fields including avatar, bio, and skills',
      },
      {
        title: 'First Pull Request',
        description: 'Submit your first PR to any project repository',
      },
      {
        title: 'Code Review Champion',
        description: 'Review 5 pull requests from teammates',
      },
      {
        title: 'Design System Contribution',
        description: 'Contribute a component to the design system',
      },
      {
        title: 'Blog Post Author',
        description: 'Write a technical blog post about your learnings',
      },
      {
        title: 'Mentor Session',
        description: 'Conduct a 1-on-1 mentoring session with a junior intern',
      },
      {
        title: 'Sprint Demo Presenter',
        description: 'Present your sprint demo to the team',
      },
      {
        title: 'Bug Bounty Hunter',
        description: 'Find and fix 3 bugs in the codebase',
      },
      {
        title: 'Documentation Hero',
        description: 'Write or improve documentation for any module',
      },
      {
        title: 'Team Building Organizer',
        description: 'Organize a team building activity',
      },
    ];
    await client.query('DELETE FROM social_tasks');
    for (const t of tasks) {
      await client.query(
        'INSERT INTO social_tasks (id, title, description, created_by, created_at) VALUES ($1,$2,$3,$4,$5)',
        [
          uuid(),
          t.title,
          t.description,
          adminId,
          daysAgo(Math.floor(Math.random() * 45)),
        ]
      );
    }
    console.log(`  ${tasks.length} social tasks`);

    // ============================================================
    // MEETINGS
    // ============================================================
    console.log('Seeding meetings...');
    const meetings = [
      {
        title: 'Sprint Planning',
        description: 'Plan the next sprint backlog',
        date: daysAgo(-1),
        start: '10:00',
        end: '11:00',
      },
      {
        title: 'Daily Standup',
        description: 'Quick sync on blockers',
        date: daysAgo(0),
        start: '09:00',
        end: '09:15',
      },
      {
        title: 'Tech Talk: React Server Components',
        description: 'Deep dive into RSC',
        date: daysAgo(-3),
        start: '14:00',
        end: '15:00',
      },
      {
        title: 'Design Review',
        description: 'Review Q3 dashboard mockups',
        date: daysAgo(-5),
        start: '11:00',
        end: '11:30',
      },
      {
        title: 'All Hands Meeting',
        description: 'Company-wide updates',
        date: daysAgo(-7),
        start: '15:00',
        end: '16:00',
      },
    ];
    await client.query('DELETE FROM meetings');
    for (const m of meetings) {
      await client.query(
        'INSERT INTO meetings (id, title, description, meeting_date, start_time, end_time, created_by, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [
          uuid(),
          m.title,
          m.description,
          m.date.split('T')[0],
          m.start,
          m.end,
          adminId,
          daysAgo(Math.floor(Math.random() * 20)),
        ]
      );
    }
    console.log(`  ${meetings.length} meetings`);

    // ============================================================
    // ATTENDANCE
    // ============================================================
    console.log('Seeding attendance...');
    const statuses = ['PRESENT', 'ABSENT', 'HALF_DAY'];
    let attendanceCount = 0;
    await client.query('DELETE FROM attendance');
    for (const u of users.slice(9)) {
      for (let d = 0; d < 5; d++) {
        await client.query(
          'INSERT INTO attendance (id, user_id, marked_by, date, status, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
          [
            uuid(),
            u.id,
            adminId,
            daysAgo(d).split('T')[0],
            randomItem(statuses),
            now,
          ]
        );
        attendanceCount++;
      }
    }
    console.log(`  ${attendanceCount} attendance records`);

    // ============================================================
    // RATINGS
    // ============================================================
    console.log('Seeding ratings...');
    let ratingCount = 0;
    await client.query('DELETE FROM ratings');
    const reviews = [
      'Great work!',
      'Excellent progress',
      'Needs improvement in communication',
      'Outstanding performance',
      'Very dedicated',
    ];
    for (const u of users.slice(9)) {
      for (let i = 0; i < 2; i++) {
        await client.query(
          'INSERT INTO ratings (id, rated_user_id, rated_by, score, remarks, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
          [
            uuid(),
            u.id,
            adminId,
            Math.floor(Math.random() * 2) + 4,
            randomItem(reviews),
            daysAgo(Math.floor(Math.random() * 30)),
          ]
        );
        ratingCount++;
      }
    }
    console.log(`  ${ratingCount} ratings`);

    // ============================================================
    // CERTIFICATE TEMPLATES
    // ============================================================
    console.log('Seeding certificate templates...');
    const tplData = [
      {
        name: 'Classic Gold',
        desc: 'Traditional gold-bordered',
        data: {
          background: '#FFFFFF',
          accent: '#b8860b',
          text: '#1a1a1a',
          border: 'double-gold',
        },
      },
      {
        name: 'Modern Blue',
        desc: 'Clean modern blue',
        data: {
          background: '#f0f4ff',
          accent: '#1e40af',
          text: '#1a1a1a',
          border: 'modern-block',
        },
      },
      {
        name: 'Corporate Silver',
        desc: 'Professional silver',
        data: {
          background: '#f8f9fa',
          accent: '#6c757d',
          text: '#212529',
          border: 'thin-script',
        },
      },
      {
        name: 'Royal Purple',
        desc: 'Luxurious purple and gold',
        data: {
          background: '#faf5ff',
          accent: '#7c3aed',
          text: '#1a1a1a',
          border: 'double-gold',
        },
      },
      {
        name: 'Forest Green',
        desc: 'Nature-inspired green',
        data: {
          background: '#f0fdf4',
          accent: '#16a34a',
          text: '#1a1a1a',
          border: 'modern-block',
        },
      },
      {
        name: 'Crimson Excellence',
        desc: 'Bold red and gold',
        data: {
          background: '#fff5f5',
          accent: '#dc2626',
          text: '#1a1a1a',
          border: 'double-gold',
        },
      },
      {
        name: 'Ocean Teal',
        desc: 'Calming teal-toned',
        data: {
          background: '#f0fdfa',
          accent: '#0d9488',
          text: '#1a1a1a',
          border: 'thin-script',
        },
      },
      {
        name: 'Midnight Dark',
        desc: 'Dark-themed modern',
        data: {
          background: '#1a1a2e',
          accent: '#e94560',
          text: '#ffffff',
          border: 'modern-block',
        },
      },
      {
        name: 'Floral Rose',
        desc: 'Elegant rose-themed',
        data: {
          background: '#fdf2f8',
          accent: '#db2777',
          text: '#1a1a1a',
          border: 'thin-script',
        },
      },
      {
        name: 'Golden Prestige',
        desc: 'Premium gold and black',
        data: {
          background: '#0f0f0f',
          accent: '#d4af37',
          text: '#ffffff',
          border: 'double-gold',
        },
      },
    ];
    await client.query('DELETE FROM certificate_templates');
    for (const t of tplData) {
      await client.query(
        'INSERT INTO certificate_templates (id, name, description, template_data, created_by, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
        [uuid(), t.name, t.desc, JSON.stringify(t.data), adminId, now]
      );
    }
    console.log(`  ${tplData.length} templates`);

    // ============================================================
    // CERTIFICATES
    // ============================================================
    console.log('Seeding certificates...');
    const domains = [
      'Web Development',
      'Data Science',
      'UI/UX Design',
      'Machine Learning',
      'Cloud Computing',
      'Mobile Development',
    ];
    let certCount = 0;
    await client.query('DELETE FROM certificates');
    for (const u of users.slice(9)) {
      const domain = randomItem(domains);
      const code = domain
        .replace(/[^a-zA-Z]/g, '')
        .substring(0, 4)
        .toUpperCase();
      const certNum = `CERT/${code}/2026/${String(certCount + 1).padStart(4, '0')}`;
      await client.query(
        `INSERT INTO certificates (id, recipient_name, recipient_email, title, body, issuer, issue_date, certificate_type, status, metadata, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          uuid(),
          u.full_name,
          u.email,
          `Certificate of ${domain} Internship`,
          `This certifies that ${u.full_name} completed a ${domain} internship at InternOps.`,
          'InternOps',
          daysAgo(Math.floor(Math.random() * 30)).split('T')[0],
          randomItem(['internship', 'achievement', 'completion']),
          'generated',
          JSON.stringify({
            certificate_number: certNum,
            domain,
            auto_generated: true,
          }),
          adminId,
          daysAgo(Math.floor(Math.random() * 30)),
        ]
      );
      certCount++;
    }
    console.log(`  ${certCount} certificates`);

    await client.query('COMMIT');
    console.log('\nDone! All seed data created.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('FAILED:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

seed()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(() => {
    pool.end().finally(() => process.exit(1));
  });
