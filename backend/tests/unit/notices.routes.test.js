const Fastify = require('fastify');

const repo = require('../../src/modules/notices/repository');
const noticesRoutes = require('../../src/modules/notices/routes');

jest.mock('../../src/modules/notices/repository');

jest.mock('../../src/middleware/auth', () =>
  jest.fn(async (req) => {
    req.user = {
      id: 'test-user-id',
      role: 'ADMIN',
    };
  })
);

jest.mock('../../src/middleware/rbac', () => jest.fn(() => async () => {}));

describe('Notice Routes', () => {
  let app;

  beforeAll(async () => {
    app = Fastify();

    app.register(noticesRoutes, {
      prefix: '/api/v1',
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 500 when creating a notice fails in the repository', async () => {
    repo.createNotice.mockRejectedValue(new Error('Database error'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/notices',
      payload: {
        title: 'Test Notice',
        content: 'Testing notice creation',
        category: 'ALERT',
        is_featured: false,
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: 'Failed to create notice',
    });
  });

  it('creates a notice successfully', async () => {
    const createdNotice = {
      id: 'notice-123',
      title: 'Test Notice',
      content: 'Testing notice creation',
      category: 'ALERT',
      is_featured: false,
    };

    repo.createNotice.mockResolvedValue(createdNotice);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/notices',
      payload: {
        title: 'Test Notice',
        content: 'Testing notice creation',
        category: 'ALERT',
        is_featured: false,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(createdNotice);
    expect(repo.createNotice).toHaveBeenCalledWith({
      title: 'Test Notice',
      content: 'Testing notice creation',
      category: 'ALERT',
      image_url: undefined,
      action_button_text: undefined,
      action_button_link: undefined,
      is_featured: false,
      createdBy: 'test-user-id',
    });
  });
});
