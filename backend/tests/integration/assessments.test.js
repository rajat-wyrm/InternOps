const app = require('../../src/app');
const { generateAccessToken } = require('../../src/utils/tokens');
const pool = require('../../src/config/db');

const INTERN_EMAIL = 'assessment-intern@test.internops.local';
const CAPTAIN_EMAIL = 'assessment-captain@test.internops.local';
const OTHER_INTERN_EMAIL = 'assessment-other-intern@test.internops.local';
const TEST_EMAILS = [INTERN_EMAIL, CAPTAIN_EMAIL, OTHER_INTERN_EMAIL];

describe('Assessments Integration Tests', () => {
  let internId;
  let captainId;
  let internToken;
  let captainToken;
  let otherInternToken;
  let otherInternId;

  beforeAll(async () => {
    await app.ready();

    await pool.query(
      `DELETE FROM users
       WHERE email = ANY($1::text[])`,
      [TEST_EMAILS]
    );

    const captainRes = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name)
       VALUES ($1, $2, 'CAPTAIN', 'Assessment Test Captain')
       RETURNING id`,
      [CAPTAIN_EMAIL, 'test-password-hash']
    );
    captainId = captainRes.rows[0].id;

    const internRes = await pool.query(
      `INSERT INTO users (email, password_hash, role, manager_id, full_name)
       VALUES ($1, $2, 'INTERN', $3, 'Assessment Test Intern')
       RETURNING id`,
      [INTERN_EMAIL, 'test-password-hash', captainId]
    );
    internId = internRes.rows[0].id;

    const otherRes = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name)
       VALUES ($1, $2, 'INTERN', 'Assessment Other Intern')
       RETURNING id`,
      [OTHER_INTERN_EMAIL, 'test-password-hash']
    );
    otherInternId = otherRes.rows[0].id;

    await pool.query(
      `INSERT INTO assessments (
         user_id,
         score,
         category,
         status,
         questions_count,
         key_strengths,
         improvement_areas,
         next_actions,
         feedback
       ) VALUES ($1, 85, 'Excellent', 'COMPLETED', 50, $2, $3, $4, $5)`,
      [
        internId,
        ['JavaScript Core', 'React Components', 'Problem Solving'],
        ['SQL Optimization', 'CI/CD Deployment'],
        ['Complete SQL indexing module', 'Deploy Vite to staging'],
        'Assessment integration test fixture.',
      ]
    );

    internToken = generateAccessToken({ id: internId, role: 'INTERN' });
    captainToken = generateAccessToken({ id: captainId, role: 'CAPTAIN' });
    otherInternToken = generateAccessToken({
      id: otherInternId,
      role: 'INTERN',
    });
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM users
       WHERE email = ANY($1::text[])`,
      [TEST_EMAILS]
    );
    await app.close();
  });

  describe('GET /api/v1/assessments/my-assessment', () => {
    it('should require authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/assessments/my-assessment',
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return 404 if user has no assessment', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/assessments/my-assessment',
        headers: { Authorization: `Bearer ${otherInternToken}` },
      });
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body)).toEqual({ error: 'No assessment found' });
    });

    it("should return the user's latest assessment", async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/assessments/my-assessment',
        headers: { Authorization: `Bearer ${internToken}` },
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.user_id).toBe(internId);
      expect(data.score).toBe(85);
      expect(data.category).toBe('Excellent');
    });
  });

  describe('GET /api/v1/assessments/user/:userId', () => {
    it("should allow a manager to check the intern's assessment", async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/assessments/user/${internId}`,
        headers: { Authorization: `Bearer ${captainToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).user_id).toBe(internId);
    });

    it('should allow the intern to check their own assessment', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/assessments/user/${internId}`,
        headers: { Authorization: `Bearer ${internToken}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('should forbid another intern from checking the assessment', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/assessments/user/${internId}`,
        headers: { Authorization: `Bearer ${otherInternToken}` },
      });
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body)).toEqual({ error: 'Forbidden' });
    });
  });
});
