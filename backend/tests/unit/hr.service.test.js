jest.mock('../../src/modules/hr/repository', () => ({
  getDashboard: jest.fn(),
}));
const repository = require('../../src/modules/hr/repository');
const service = require('../../src/modules/hr/service');

describe('HR service', () => {
  beforeEach(() => jest.clearAllMocks());
  it('delegates dashboard filters and returns the repository contract', async () => {
    const filters = { search: 'alex', status: 'ACTIVE' };
    const dashboard = {
      summary: { total: 1 },
      directory: [],
      roles: [],
      departments: [],
      milestones: [],
    };
    repository.getDashboard.mockResolvedValue(dashboard);
    await expect(service.getDashboard(filters)).resolves.toBe(dashboard);
    expect(repository.getDashboard).toHaveBeenCalledWith(filters);
  });
});
