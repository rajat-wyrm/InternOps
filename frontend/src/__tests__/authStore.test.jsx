import { describe, it, expect, beforeEach } from 'vitest';
import useAuthStore from '../store/auth';

describe('Auth Store (Zustand) Unit Tests', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('starts with initial state values', () => {
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.hydrated).toBe(false);
    expect(state.authGeneration).toBeGreaterThanOrEqual(0);
  });

  it('updates state via setAuth', () => {
    const mockUser = { id: '1', email: 'test@example.com', role: 'ADMIN' };
    const mockToken = 'mockToken123';

    const beforeGeneration = useAuthStore.getState().authGeneration;
    useAuthStore.getState().setAuth({ accessToken: mockToken, user: mockUser });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe(mockToken);
    expect(state.user).toEqual(mockUser);
    expect(state.authGeneration).toBe(beforeGeneration + 1);
  });

  it('sets hydrated status', () => {
    useAuthStore.getState().setHydrated();
    expect(useAuthStore.getState().hydrated).toBe(true);
  });

  it('clears state on logout', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'token',
      user: { email: 'admin@internops.com' },
    });

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
  });
});
