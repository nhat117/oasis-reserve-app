import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
        in: vi.fn().mockResolvedValue({ data: [] }),
      }),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { translations: {} }, error: null }),
    },
  },
}));

import { I18nProvider, useI18n, LanguageSwitcher } from './useI18n';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider>{children}</I18nProvider>
);

describe('useI18n', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('defaults to English', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.lang).toBe('en');
  });

  it('restores language from localStorage', () => {
    localStorage.setItem('app-lang', 'vi');
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.lang).toBe('vi');
  });

  it('setLang updates language and persists to localStorage', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => {
      result.current.setLang('vi');
    });
    expect(result.current.lang).toBe('vi');
    expect(localStorage.getItem('app-lang')).toBe('vi');
  });

  it('t() returns the key when no translation is loaded', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t('Hello')).toBe('Hello');
  });

  it('formatPrice formats as AUD currency', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    const formatted = result.current.formatPrice(99.5);
    expect(formatted).toContain('$');
    expect(formatted).toContain('99.50');
  });

  it('formatPrice handles zero', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.formatPrice(0)).toContain('0.00');
  });

  it('formatPrice handles large numbers', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    const formatted = result.current.formatPrice(1234567.89);
    expect(formatted).toContain('1,234,567.89');
  });

  it('loading starts as false', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.loading).toBe(false);
  });
});

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders without crashing', () => {
    render(
      <I18nProvider>
        <LanguageSwitcher />
      </I18nProvider>,
    );
    expect(screen.getByText('English')).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    const { container } = render(
      <I18nProvider>
        <LanguageSwitcher className="custom-class" />
      </I18nProvider>,
    );
    expect(container.querySelector('.custom-class')).toBeTruthy();
  });
});
