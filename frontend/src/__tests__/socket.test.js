import { beforeEach, describe, expect, it, vi } from 'vitest';

const ioMock = vi.fn(() => ({
  connected: false,
}));

vi.mock('socket.io-client', () => ({
  io: ioMock,
}));

describe('connectSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes the token through Socket.IO auth and not the URL query', async () => {
    const { connectSocket } = await import('../lib/socket');

    const token = 'test.jwt.token';

    connectSocket(token);

    expect(ioMock).toHaveBeenCalledTimes(1);

    const [, options] = ioMock.mock.calls[0];

    expect(options.auth).toEqual({ token });
    expect(options.query).toBeUndefined();
  });
});
