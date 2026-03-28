import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NavLink } from './NavLink';

describe('NavLink', () => {
  it('renders a link with text', () => {
    render(
      <MemoryRouter>
        <NavLink to="/test">Test Link</NavLink>
      </MemoryRouter>,
    );
    expect(screen.getByText('Test Link')).toBeInTheDocument();
  });

  it('renders with base className', () => {
    render(
      <MemoryRouter>
        <NavLink to="/test" className="base-class">Link</NavLink>
      </MemoryRouter>,
    );
    expect(screen.getByText('Link')).toHaveClass('base-class');
  });

  it('applies activeClassName when route is active', () => {
    render(
      <MemoryRouter initialEntries={['/active']}>
        <NavLink to="/active" className="base" activeClassName="active-class">
          Active
        </NavLink>
      </MemoryRouter>,
    );
    const link = screen.getByText('Active');
    expect(link).toHaveClass('active-class');
  });

  it('does not apply activeClassName when route is not active', () => {
    render(
      <MemoryRouter initialEntries={['/other']}>
        <NavLink to="/target" className="base" activeClassName="active-class">
          Inactive
        </NavLink>
      </MemoryRouter>,
    );
    const link = screen.getByText('Inactive');
    expect(link).not.toHaveClass('active-class');
  });

  it('links to the correct path', () => {
    render(
      <MemoryRouter>
        <NavLink to="/booking">Book Now</NavLink>
      </MemoryRouter>,
    );
    const link = screen.getByText('Book Now');
    expect(link.closest('a')).toHaveAttribute('href', '/booking');
  });

  it('has correct displayName', () => {
    expect(NavLink.displayName).toBe('NavLink');
  });
});
