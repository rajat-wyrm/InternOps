import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDisconnect, mockRemoveAllListeners, ioMock } = vi.hoisted(() => ({
  mockDisconnect: vi.fn(),
  mockRemoveAllListeners: vi.fn(),
  ioMock: vi.fn(() => ({
    connected: false,
    active: false,
    disconnect: mockDisconnect,
    removeAllListeners: mockRemoveAllListeners,
  })),
}));

vi.mock('socket.io-client', () => ({
  io: ioMock,
}));

import { connectSocket, disconnectSocket } from '../lib/socket';

describe('connectSocket', () => {
  beforeEach(() => {
    disconnectSocket();
    vi.clearAllMocks();
  });

  it('passes the token through Socket.IO auth and not the URL query', () => {
    const token = 'test.jwt.token';

    connectSocket(token);

    expect(ioMock).toHaveBeenCalledTimes(1);

    const [, options] = ioMock.mock.calls[0];

    expect(options.auth).toEqual({ token });
    expect(options.query).toBeUndefined();
  });
});

describe('socket lifecycle', () => {
  beforeEach(() => {
    disconnectSocket();
    vi.clearAllMocks();
  });

  it('does not abandon an inactive existing socket', () => {
    const firstSocket = connectSocket('token-1');

    expect(ioMock).toHaveBeenCalledTimes(1);

    const secondSocket = connectSocket('token-2');

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(ioMock).toHaveBeenCalledTimes(2);
    expect(secondSocket).not.toBe(firstSocket);
  });

  it('removes listeners and disconnects the socket during cleanup', () => {
    connectSocket('token');

    disconnectSocket();

    expect(mockRemoveAllListeners).toHaveBeenCalledTimes(1);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});
