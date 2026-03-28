import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

const mockRpc = vi.fn().mockResolvedValue({ data: false });
const mockSignInWithPassword = vi.fn().mockResolvedValue({ error: null });
const mockSignOut = vi.fn().mockResolvedValue({});
const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
const mockOnAuthStateChange = vi.fn().mockReturnValue({
  data: { subscription: { unsubscribe: vi.fn() } },
});
const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: (...args: any[]) => mockGetSession(...args),
      onAuthStateChange: (...args: any[]) => mockOnAuthStateChange(...args),
      signInWithPassword: (...args: any[]) => mockSignInWithPassword(...args),
      signOut: (...args: any[]) => mockSignOut(...args),
    },
    rpc: (...args: any[]) => mockRpc(...args),
    from: () => ({
      insert: (...args: any[]) => mockInsert(...args),
    }),
  },
}));

import { AuthProvider, useAuth } from './useAuth';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockRpc.mockResolvedValue({ data: false });
  });

  it('throws if used outside AuthProvider', () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within AuthProvider');
  });

  it('starts with no user after loading', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isEmployee).toBe(false);
    expect(result.current.isStaff).toBe(false);
    expect(result.current.userRole).toBeNull();
  });

  it('calls signIn with email and password', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const { error } = await result.current.signIn('test@example.com', 'password');
      expect(error).toBeNull();
    });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password',
    });
  });

  it('returns error on failed signIn', async () => {
    const mockError = new Error('Invalid credentials');
    mockSignInWithPassword.mockResolvedValue({ error: mockError });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const { error } = await result.current.signIn('bad@example.com', 'wrong');
      expect(error).toBe(mockError);
    });
  });

  it('calls signOut', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('sets admin role when session has admin user', async () => {
    const mockSession = {
      user: { id: 'user-1', email: 'admin@test.com' },
      access_token: 'token',
    };

    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
    mockRpc
      .mockResolvedValueOnce({ data: true })   // admin
      .mockResolvedValueOnce({ data: false });  // employee

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isEmployee).toBe(false);
    expect(result.current.isStaff).toBe(true);
    expect(result.current.userRole).toBe('admin');
  });

  it('sets employee role correctly', async () => {
    const mockSession = {
      user: { id: 'user-2', email: 'emp@test.com' },
      access_token: 'token',
    };

    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
    mockRpc
      .mockResolvedValueOnce({ data: false })  // admin
      .mockResolvedValueOnce({ data: true });   // employee

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isEmployee).toBe(true);
    expect(result.current.isStaff).toBe(true);
    expect(result.current.userRole).toBe('employee');
  });

  it('logActivity does nothing when no user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.logActivity('test');
    });

    expect(mockInsert).not.toHaveBeenCalled();
  });
});
