import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Mock supabase before any component imports
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({}),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
        in: vi.fn().mockResolvedValue({ data: [] }),
      }),
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

// Mock all page components to isolate routing tests
vi.mock('./pages/Index', () => ({ default: () => <div data-testid="index-page">Index</div> }));
vi.mock('./pages/Services', () => ({ default: () => <div data-testid="services-page">Services</div> }));
vi.mock('./pages/Booking', () => ({ default: () => <div data-testid="booking-page">Booking</div> }));
vi.mock('./pages/AdminLogin', () => ({ default: () => <div data-testid="admin-login-page">Admin Login</div> }));
vi.mock('./pages/AdminDashboard', () => ({ default: () => <div data-testid="admin-dashboard-page">Admin Dashboard</div> }));
vi.mock('./pages/AdminResetPassword', () => ({ default: () => <div data-testid="admin-reset-page">Admin Reset</div> }));
vi.mock('./pages/About', () => ({ default: () => <div data-testid="about-page">About</div> }));
vi.mock('./pages/SoftwareTerms', () => ({ default: () => <div data-testid="terms-page">Software Terms</div> }));
vi.mock('./pages/Unsubscribe', () => ({ default: () => <div data-testid="unsubscribe-page">Unsubscribe</div> }));
vi.mock('./pages/NotFound', () => ({ default: () => <div data-testid="not-found-page">Not Found</div> }));

// Mock image imports
vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }));

let currentPath = '/';

// Mock BrowserRouter to use MemoryRouter for testing
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => {
      const { MemoryRouter } = actual as any;
      return <MemoryRouter initialEntries={[currentPath]}>{children}</MemoryRouter>;
    },
  };
});

import App from './App';

describe('App routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentPath = '/';
    localStorage.clear();
  });

  it('renders Index page on /', async () => {
    currentPath = '/';
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('index-page')).toBeInTheDocument();
    });
  });

  it('renders Services page on /services', async () => {
    currentPath = '/services';
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('services-page')).toBeInTheDocument();
    });
  });

  it('renders Booking page on /booking', async () => {
    currentPath = '/booking';
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('booking-page')).toBeInTheDocument();
    });
  });

  it('renders Admin Login on /admin/login', async () => {
    currentPath = '/admin/login';
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('admin-login-page')).toBeInTheDocument();
    });
  });

  it('renders Admin Dashboard on /admin', async () => {
    currentPath = '/admin';
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('admin-dashboard-page')).toBeInTheDocument();
    });
  });

  it('renders About page on /about', async () => {
    currentPath = '/about';
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('about-page')).toBeInTheDocument();
    });
  });

  it('renders SoftwareTerms page on /software-terms', async () => {
    currentPath = '/software-terms';
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('terms-page')).toBeInTheDocument();
    });
  });

  it('renders Unsubscribe page on /unsubscribe', async () => {
    currentPath = '/unsubscribe';
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('unsubscribe-page')).toBeInTheDocument();
    });
  });

  it('renders NotFound page for unknown routes', async () => {
    currentPath = '/this-does-not-exist';
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
    });
  });

  it('renders Admin Reset Password on /admin/reset-password', async () => {
    currentPath = '/admin/reset-password';
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('admin-reset-page')).toBeInTheDocument();
    });
  });
});
