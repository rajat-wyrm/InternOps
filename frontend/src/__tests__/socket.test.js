import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDisconnect = vi.fn();
const mockRemoveAllListeners = vi.fn();

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    connected: false,
    active: false,
    disconnect: mockDisconnect,
    removeAllListeners: mockRemoveAllListeners,
  })),
}));

import { io } from 'socket.io-client';
import { connectSocket, disconnectSocket } from '../lib/socket';

describe('socket lifecycle', () => {
  beforeEach(() => {
    disconnectSocket();
    vi.clearAllMocks();
  });
  it('does not abandon an inactive existing socket', () => {
    const firstSocket = connectSocket('token-1');

    expect(io).toHaveBeenCalledTimes(1);

    const secondSocket = connectSocket('token-2');

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(io).toHaveBeenCalledTimes(2);
    expect(secondSocket).not.toBe(firstSocket);
  });

  it('removes listeners and disconnects the socket during cleanup', () => {
    connectSocket('token');

    disconnectSocket();

    expect(mockRemoveAllListeners).toHaveBeenCalledTimes(1);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});
