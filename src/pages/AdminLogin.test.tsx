import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock supabase before importing components
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({}),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
        in: vi.fn().mockResolvedValue({ data: [] }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: false }),
    storage: {
      from: vi.fn().mockReturnValue({
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/logo.png' } }),
      }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { translations: {} }, error: null }),
    },
  },
}));

import { AuthProvider } from '@/hooks/useAuth';
import { I18nProvider } from '@/hooks/useI18n';
import AdminLogin from './AdminLogin';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderAdminLogin() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <I18nProvider>
          <MemoryRouter>
            <AdminLogin />
          </MemoryRouter>
        </I18nProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('AdminLogin page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders login form', () => {
    renderAdminLogin();
    expect(screen.getByText('Admin Login')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('shows forgot password link', () => {
    renderAdminLogin();
    expect(screen.getByText('Forgot password?')).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    renderAdminLogin();
    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleBtn = passwordInput.parentElement!.querySelector('button')!;
    await userEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');

    await userEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('allows typing into email and password fields', async () => {
    renderAdminLogin();
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');

    await userEvent.type(emailInput, 'admin@test.com');
    await userEvent.type(passwordInput, 'secret123');

    expect(emailInput).toHaveValue('admin@test.com');
    expect(passwordInput).toHaveValue('secret123');
  });

  it('switches to forgot password mode', async () => {
    renderAdminLogin();
    await userEvent.click(screen.getByText('Forgot password?'));

    expect(screen.getByText('Reset Password')).toBeInTheDocument();
    expect(screen.getByText('Send Reset Link')).toBeInTheDocument();
    expect(screen.getByText('Back to login')).toBeInTheDocument();
  });

  it('switches back from forgot password mode', async () => {
    renderAdminLogin();
    await userEvent.click(screen.getByText('Forgot password?'));
    expect(screen.getByText('Reset Password')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Back to login'));
    expect(screen.getByText('Admin Login')).toBeInTheDocument();
  });

  it('renders admin description text', () => {
    renderAdminLogin();
    expect(screen.getByText('Enter your admin credentials')).toBeInTheDocument();
  });
});
