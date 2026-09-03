const mockQuery = jest.fn();
const mockHash = jest.fn().mockResolvedValue('hash');

jest.mock('../../src/config/db', () => ({
  query: (...args) => mockQuery(...args),
}));

jest.mock('argon2', () => ({
  hash: (...args) => mockHash(...args),
}));

const repository = require('../../src/modules/team/repository');

const strongPassword =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

describe('team member credentials', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockHash.mockClear();
  });

  it('stores a trimmed lowercase email', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'member-id' }] })
      .mockResolvedValueOnce({
        rows: [{ id: 'member-id', email: 'test@stl.com' }],
      });

    const member = await repository.createMember({
      email: '  Test@STL.com  ',
      password: 'Strong@123',
      role: 'SENIOR_TL',
      manager_id: 'manager-id',
      department_id: 'department-id',
    });

    expect(mockQuery.mock.calls[0][1][0]).toBe('test@stl.com');
    expect(member.email).toBe('test@stl.com');
  });

  it.each([
    '12345678',
    'lowercase@123',
    'UPPERCASE@123',
    'NoNumber@Here',
    'NoSpecial123',
  ])('rejects weak password pattern %s', (password) => {
    expect(strongPassword.test(password)).toBe(false);
  });

  it('accepts a strong password pattern', () => {
    expect(strongPassword.test('Temporary@123')).toBe(true);
  });
});
