jest.mock('../../src/config/db', () => ({}));
const data = require('../../scripts/cleanup-seed-data');
describe('test-data cleanup fingerprints', () => {
  test('always protects the Admin and current actor', () => {
    expect(
      data.isProtectedUser('admin@internops.com', 'other@internops.com')
    ).toBe(true);
    expect(
      data.isProtectedUser('actor@internops.com', 'actor@internops.com')
    ).toBe(true);
    expect(data.SEEDED_USER_EMAILS).not.toContain('admin@internops.com');
  });
  test('matches generated test user emails without broad example.com matching', () => {
    expect(
      data.isGeneratedTestUserEmail('tl-rate-1786111003696@example.com')
    ).toBe(true);
    expect(
      data.isGeneratedTestUserEmail('tl-size-1785405586180@example.com')
    ).toBe(true);
    expect(data.isGeneratedTestUserEmail('real.person@example.com')).toBe(
      false
    );
  });
  test.each([
    'Test',
    'TestDept_1781106277779',
    'PassingDept_1782825531417',
    'TestBearer_1786110881906',
    'Test Dept 1 1786111026956',
    'Test Dept 2 1786111027213',
  ])('matches automated department %s', (name) => {
    expect(data.isAutomatedTestDepartment(name)).toBe(true);
  });
  test.each([
    'Neeraj Dep',
    'Testing Lab',
    'Test Department',
    'PassingDept_team',
  ])('preserves similar legitimate department %s', (name) => {
    expect(data.isAutomatedTestDepartment(name)).toBe(false);
  });
});
