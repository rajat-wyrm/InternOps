const rbac = require('../../src/middleware/rbac');

describe('RBAC middleware', () => {
  let reply;
  let done;

  beforeEach(() => {
    done = jest.fn();
    reply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  });

  it('allows SENIOR_TL when the requirement includes SENIOR_TL', () => {
    const req = { user: { role: 'SENIOR_TL' } };

    rbac('SENIOR_TL')(req, reply, done);

    expect(done).toHaveBeenCalled();
    expect(reply.status).not.toHaveBeenCalled();
  });

  it('denies TL when the requirement is SENIOR_TL', () => {
    const req = { user: { role: 'TL' } };

    rbac('SENIOR_TL')(req, reply, done);

    expect(done).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Forbidden' });
  });

  it('lets ADMIN bypass any requirement via all permissions', () => {
    const req = { user: { role: 'ADMIN' } };

    rbac('SENIOR_TL')(req, reply, done);

    expect(done).toHaveBeenCalled();
    expect(reply.status).not.toHaveBeenCalled();
  });
});
