import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from './NotFound';

describe('NotFound page', () => {
  it('renders 404 heading', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('shows descriptive message', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );
    expect(screen.getByText('Oops! Page not found')).toBeInTheDocument();
  });

  it('has a link back to home', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );
    const link = screen.getByText('Return to Home');
    expect(link).toHaveAttribute('href', '/');
  });

  it('logs the 404 error to console', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={['/some-bad-path']}>
        <NotFound />
      </MemoryRouter>,
    );
    expect(errorSpy).toHaveBeenCalledWith(
      '404 Error: User attempted to access non-existent route:',
      '/some-bad-path',
    );
    errorSpy.mockRestore();
  });
});
