const app = require('../../src/app');
const { generateAccessToken } = require('../../src/utils/tokens');
const pool = require('../../src/config/db');

const TEST_EMAIL = 'otherintern@internops.com';

describe('Assessments Integration Tests', () => {
  let internId;
  let captainId;
  let internToken;
  let captainToken;
  let otherInternToken;
  let otherInternId;

  beforeAll(async () => {
    await app.ready();

    const internRes = await pool.query(
      "SELECT id FROM users WHERE email = 'intern@internops.com' AND deleted_at IS NULL"
    );
    const captainRes = await pool.query(
      "SELECT id FROM users WHERE email = 'captain@internops.com' AND deleted_at IS NULL"
    );

    if (internRes.rowCount === 0 || captainRes.rowCount === 0) {
      throw new Error(
        'Assessment test users are missing. Run the assessment seed before tests.'
      );
    }

    internId = internRes.rows[0].id;
    captainId = captainRes.rows[0].id;

    const existingOther = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [TEST_EMAIL]
    );

    if (existingOther.rowCount > 0) {
      otherInternId = existingOther.rows[0].id;
    } else {
      const otherRes = await pool.query(
        "INSERT INTO users (email, password_hash, role, full_name) VALUES ($1, $2, 'INTERN', 'Other Intern') RETURNING id",
        [TEST_EMAIL, 'test-password-hash']
      );
      otherInternId = otherRes.rows[0].id;
    }

    internToken = generateAccessToken({ id: internId, role: 'INTERN' });
    captainToken = generateAccessToken({ id: captainId, role: 'CAPTAIN' });
    otherInternToken = generateAccessToken({
      id: otherInternId,
      role: 'INTERN',
    });
  });

  afterAll(async () => {
    if (otherInternId) {
      await pool.query('DELETE FROM assessments WHERE user_id = $1', [
        otherInternId,
      ]);
      await pool.query('DELETE FROM users WHERE id = $1', [otherInternId]);
    }
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
