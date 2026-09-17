const fs = require('fs');
const path = require('path');

describe('Team member complete detail editing contract', () => {
  const repository = fs.readFileSync(
    path.resolve(__dirname, '../../src/modules/team/repository.js'),
    'utf8'
  );
  const routes = fs.readFileSync(
    path.resolve(__dirname, '../../src/modules/team/routes.js'),
    'utf8'
  );

  test.each([
    'email',
    'department_id',
    'intern_code',
    'internship_domain',
    'offer_letter_url',
  ])('persists the %s field through the Team detail update path', (field) => {
    expect(repository).toContain(`'${field}'`);
    expect(routes).toContain(`${field}:`);
  });

  test('normalizes edited email and returns specific uniqueness conflicts', () => {
    expect(repository).toContain("field === 'email'");
    expect(repository).toContain('trim().toLowerCase()');
    expect(routes).toContain("code: 'EMAIL_ALREADY_EXISTS'");
    expect(routes).toContain("'INTERN_CODE_ALREADY_EXISTS'");
  });

  test('keeps role, manager, password, and suspension on dedicated routes', () => {
    for (const route of ['/role', '/manager', '/password', '/status']) {
      expect(routes).toContain(`'/members/:id${route}'`);
    }
  });
});
