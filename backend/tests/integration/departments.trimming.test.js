const pool = require('../../src/config/db');
const deptRepo = require('../../src/modules/departments/repository');

jest.setTimeout(30000);

const runId = Date.now();

describe('Department trimming and duplicate handling', () => {
  it('stores " Engineering " as the trimmed name', async () => {
    const base = `Engineering ${runId}`;
    const spaced = ` ${base} `;

    const result = await deptRepo.createDepartment(spaced, null);

    expect(result.name).toBe(base);

    await pool.query('DELETE FROM departments WHERE id = $1', [result.id]);
  });

  it('does not allow duplicate when trimmed variant exists', async () => {
    const base = `UniqueDept ${runId} ${Date.now()}`;
    const spaced = `${base} `;

    // create the base entry
    const first = await deptRepo.createDepartment(base, null);
    expect(first.name).toBe(base);

    // attempt to create duplicate with trailing space
    let caught;
    try {
      await deptRepo.createDepartment(spaced, null);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeDefined();
    expect(caught.status).toBe(409);

    await pool.query('DELETE FROM departments WHERE id = $1', [first.id]);
  });
});
