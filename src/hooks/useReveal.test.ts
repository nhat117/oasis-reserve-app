import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReveal } from './useReveal';

describe('useReveal', () => {
  let mockObserve: ReturnType<typeof vi.fn>;
  let mockUnobserve: ReturnType<typeof vi.fn>;
  let mockDisconnect: ReturnType<typeof vi.fn>;
  let observerCallback: IntersectionObserverCallback;

  beforeEach(() => {
    mockObserve = vi.fn();
    mockUnobserve = vi.fn();
    mockDisconnect = vi.fn();

    // Use Object.defineProperty to override the read-only property from setup.ts
    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: vi.fn((callback: IntersectionObserverCallback) => {
        observerCallback = callback;
        return {
          observe: mockObserve,
          unobserve: mockUnobserve,
          disconnect: mockDisconnect,
          root: null,
          rootMargin: '',
          thresholds: [],
          takeRecords: () => [],
        };
      }),
    });
  });

  it('observes elements with reveal classes', () => {
    const el = document.createElement('div');
    el.className = 'reveal';
    document.body.appendChild(el);

    renderHook(() => useReveal());

    expect(mockObserve).toHaveBeenCalledWith(el);
    document.body.removeChild(el);
  });

  it('adds visible class when element intersects', () => {
    const el = document.createElement('div');
    el.className = 'reveal';
    document.body.appendChild(el);

    renderHook(() => useReveal());

    observerCallback(
      [{ isIntersecting: true, target: el } as unknown as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

    expect(el.classList.contains('visible')).toBe(true);
    expect(mockUnobserve).toHaveBeenCalledWith(el);
    document.body.removeChild(el);
  });

  it('does not add visible class when not intersecting', () => {
    const el = document.createElement('div');
    el.className = 'reveal-left';
    document.body.appendChild(el);

    renderHook(() => useReveal());

    observerCallback(
      [{ isIntersecting: false, target: el } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

    expect(el.classList.contains('visible')).toBe(false);
    document.body.removeChild(el);
  });

  it('disconnects observer on unmount', () => {
    const el = document.createElement('div');
    el.className = 'reveal-scale';
    document.body.appendChild(el);

    const { unmount } = renderHook(() => useReveal());
    unmount();

    expect(mockDisconnect).toHaveBeenCalled();
    document.body.removeChild(el);
  });

  it('handles no matching elements gracefully', () => {
    renderHook(() => useReveal());
    expect(mockObserve).not.toHaveBeenCalled();
  });

  it('observes multiple reveal class variants', () => {
    const classes = ['reveal', 'reveal-left', 'reveal-right', 'reveal-scale', 'stagger-children'];
    const elements = classes.map(cls => {
      const el = document.createElement('div');
      el.className = cls;
      document.body.appendChild(el);
      return el;
    });

    renderHook(() => useReveal());

    expect(mockObserve).toHaveBeenCalledTimes(5);
    elements.forEach(el => document.body.removeChild(el));
  });
});
