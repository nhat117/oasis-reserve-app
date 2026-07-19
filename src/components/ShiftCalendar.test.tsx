import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShiftCalendar } from './ShiftCalendar';

const mutationLike = () => ({ mutate: vi.fn(), isPending: false });

const baseProps = () => ({
  therapists: [{ id: 't1', name: 'Alice' }, { id: 't2', name: 'Bob' }],
  selectedTherapistId: 't1',
  onSelectTherapist: vi.fn(),
  shifts: [] as any[],
  unavailabilities: [] as any[],
  shopHolidays: [] as any[],
  onDatesSet: vi.fn(),
  addShift: mutationLike(),
  updateShift: mutationLike(),
  removeShift: mutationLike(),
  openConfirm: vi.fn(),
});

describe('ShiftCalendar', () => {
  it('prompts to pick a therapist when none is selected', () => {
    render(<ShiftCalendar {...baseProps()} selectedTherapistId={null} />);
    expect(screen.getByText('Chọn thợ để xem ca làm')).toBeInTheDocument();
  });

  it('renders the calendar once a therapist is selected', () => {
    render(<ShiftCalendar {...baseProps()} />);
    expect(screen.queryByText('Chọn thợ để xem ca làm')).not.toBeInTheDocument();
  });

  it('clicking an existing shift event opens the edit dialog pre-filled', () => {
    const props = baseProps();
    props.shifts = [{
      id: 's1', therapist_id: 't1', shift_date: '2026-07-20',
      start_minute: 9 * 60, end_minute: 17 * 60,
      break_start_minute: null, break_end_minute: null, notes: 'Cover for Bob',
    }];
    render(<ShiftCalendar {...props} />);
    fireEvent.click(screen.getByText('09:00 - 17:00'));
    expect(screen.getByText('Sửa ca làm')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Cover for Bob')).toBeInTheDocument();
  });

  it('editing and submitting a shift calls updateShift with the new times', () => {
    const props = baseProps();
    props.shifts = [{
      id: 's1', therapist_id: 't1', shift_date: '2026-07-20',
      start_minute: 9 * 60, end_minute: 17 * 60,
      break_start_minute: null, break_end_minute: null, notes: null,
    }];
    render(<ShiftCalendar {...props} />);
    fireEvent.click(screen.getByText('09:00 - 17:00'));
    const startInput = screen.getByDisplayValue('09:00');
    fireEvent.change(startInput, { target: { value: '10:00' } });
    fireEvent.click(screen.getByText('Lưu'));
    expect(props.updateShift.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1', startMinute: 10 * 60, endMinute: 17 * 60 }),
      expect.anything(),
    );
  });

  it('editing a shift with a break shows the break switch enabled and its times', () => {
    const props = baseProps();
    props.shifts = [{
      id: 's1', therapist_id: 't1', shift_date: '2026-07-20',
      start_minute: 9 * 60, end_minute: 17 * 60,
      break_start_minute: 12 * 60, break_end_minute: 12 * 60 + 30, notes: null,
    }];
    render(<ShiftCalendar {...props} />);
    fireEvent.click(screen.getByText('09:00 - 17:00'));
    expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'checked');
    expect(screen.getByDisplayValue('12:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12:30')).toBeInTheDocument();
  });

  it('deleting a shift calls openConfirm and, once confirmed, removeShift', () => {
    const props = baseProps();
    props.shifts = [{
      id: 's1', therapist_id: 't1', shift_date: '2026-07-20',
      start_minute: 9 * 60, end_minute: 17 * 60,
      break_start_minute: null, break_end_minute: null, notes: null,
    }];
    props.openConfirm = vi.fn((_title, _desc, action) => action());
    render(<ShiftCalendar {...props} />);
    fireEvent.click(screen.getByText('09:00 - 17:00'));
    const buttons = screen.getAllByRole('button');
    const deleteButton = buttons.find(b => b.querySelector('svg.lucide-trash2'));
    expect(deleteButton).toBeDefined();
    fireEvent.click(deleteButton!);
    expect(props.openConfirm).toHaveBeenCalled();
    expect(props.removeShift.mutate).toHaveBeenCalledWith('s1', expect.anything());
  });
});
