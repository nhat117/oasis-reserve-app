import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StaffScheduleDialog } from './StaffScheduleDialog';

const mutationLike = () => ({ mutate: vi.fn(), isPending: false });

const baseProps = () => ({
  open: true,
  onOpenChange: vi.fn(),
  therapists: [{ id: 't1', name: 'Alice' }, { id: 't2', name: 'Bob' }],
  unavailabilities: [],
  shopHolidays: [],
  isAdmin: true,
  onDatesSet: vi.fn(),
  openConfirm: vi.fn(),
  addUnavailability: mutationLike(),
  removeUnavailability: mutationLike(),
  addUnavailabilityRange: mutationLike(),
  addHoliday: mutationLike(),
  removeHoliday: mutationLike(),
});

describe('StaffScheduleDialog', () => {
  it('renders the all-staff mode with a therapist picker', () => {
    render(<StaffScheduleDialog {...baseProps()} mode="all-staff" />);
    expect(screen.getAllByText('Ngày nghỉ nhân viên').length).toBeGreaterThan(0);
  });

  it('renders the shop-holidays mode with its legend', () => {
    render(<StaffScheduleDialog {...baseProps()} mode="shop-holidays" />);
    expect(screen.getByText('Nghỉ cả ngày')).toBeInTheDocument();
    expect(screen.getByText('Đóng cửa sớm')).toBeInTheDocument();
  });

  it('renders the single-therapist mode scoped to one therapist', () => {
    render(<StaffScheduleDialog {...baseProps()} mode="single-therapist" therapistId="t1" />);
    expect(screen.getAllByText('Ngày nghỉ nhân viên').length).toBeGreaterThan(0);
  });

  it('does not render dialog content when closed', () => {
    render(<StaffScheduleDialog {...baseProps()} mode="all-staff" open={false} />);
    expect(screen.queryByText('Ngày nghỉ nhân viên')).not.toBeInTheDocument();
  });

  it('shows the days-off month list scoped to a single therapist', () => {
    const props = baseProps();
    props.unavailabilities = [
      { id: 'u1', therapist_id: 't1', unavailable_date: '2026-07-05', reason: 'Sick', therapists: { name: 'Alice' } },
    ];
    render(<StaffScheduleDialog {...props} mode="single-therapist" therapistId="t1" />);
    expect(screen.getAllByText('Sick').length).toBeGreaterThan(0);
  });

  it('shows the shop holidays month list', () => {
    const props = baseProps();
    props.shopHolidays = [{ id: 'h1', holiday_date: '2026-07-04', early_close_hour: null }];
    render(<StaffScheduleDialog {...props} mode="shop-holidays" />);
    expect(screen.getByText('2026-07-04')).toBeInTheDocument();
  });
});
