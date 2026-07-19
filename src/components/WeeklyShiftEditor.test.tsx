import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { WeeklyShiftEditor, WeeklyHourRow } from './WeeklyShiftEditor';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const emptyWeek = (): WeeklyHourRow[] =>
  [1, 2, 3, 4, 5, 6, 7].map(day => ({
    day_of_week: day,
    is_working: false,
    start_minute: 9 * 60,
    end_minute: 18 * 60,
    break_start_minute: null,
    break_end_minute: null,
  }));

const renderEditor = (value: WeeklyHourRow[], onChange: (rows: WeeklyHourRow[]) => void) =>
  render(
    <WeeklyShiftEditor
      value={value}
      onChange={onChange}
      dayLabels={DAY_LABELS}
      offLabel="Off"
      workingLabel="Working"
      breakLabel="Break"
      doneLabel="Done"
    />,
  );

describe('WeeklyShiftEditor', () => {
  it('renders a card per day, showing Off for days not working', () => {
    renderEditor(emptyWeek(), vi.fn());
    expect(screen.getAllByText('Off')).toHaveLength(7);
    for (const label of DAY_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('shows a shift pill with times for a working day', () => {
    const week = emptyWeek();
    week[0] = { ...week[0], is_working: true, start_minute: 9 * 60, end_minute: 17 * 60 };
    renderEditor(week, vi.fn());
    expect(screen.getByText('09:00–17:00')).toBeInTheDocument();
  });

  it('shows break time under the pill when set', () => {
    const week = emptyWeek();
    week[0] = { ...week[0], is_working: true, break_start_minute: 12 * 60, break_end_minute: 13 * 60 };
    renderEditor(week, vi.fn());
    expect(screen.getByText(/Break 12:00–13:00/)).toBeInTheDocument();
  });

  it('opens a popover with time inputs when a day card is clicked', () => {
    renderEditor(emptyWeek(), vi.fn());
    fireEvent.click(screen.getAllByRole('button')[0]);
    // Toggling on reveals the working/break time inputs
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('toggling the switch on in the popover marks the day as working', () => {
    const onChange = vi.fn();
    renderEditor(emptyWeek(), onChange);

    fireEvent.click(screen.getAllByRole('button')[0]); // open Monday's popover
    const switchEl = screen.getByRole('switch');
    fireEvent.click(switchEl);

    expect(onChange).toHaveBeenCalledTimes(1);
    const result = onChange.mock.calls[0][0] as WeeklyHourRow[];
    expect(result[0].is_working).toBe(true);
    expect(result[0].day_of_week).toBe(1);
    // Other days untouched
    expect(result[1].is_working).toBe(false);
  });

  it('editing start/end time inputs updates the correct day only', () => {
    const week = emptyWeek();
    week[1] = { ...week[1], is_working: true }; // Tuesday working
    const onChange = vi.fn();
    renderEditor(week, onChange);

    fireEvent.click(screen.getAllByRole('button')[1]); // open Tuesday's popover
    const timeInputs = screen.getAllByDisplayValue('09:00');
    fireEvent.change(timeInputs[0], { target: { value: '10:30' } });

    const result = onChange.mock.calls[0][0] as WeeklyHourRow[];
    expect(result[1].start_minute).toBe(10 * 60 + 30);
    expect(result[0].is_working).toBe(false); // Monday untouched
  });

  it('falls back to sane default hours instead of NaN for malformed minute fields', () => {
    // A stale/partial row (e.g. from before a field rename) should never
    // render "NaN:NaN" — sanitizeRow replaces bad values with 9:00-18:00.
    const week = emptyWeek();
    week[0] = {
      day_of_week: 1,
      is_working: true,
      start_minute: undefined as unknown as number,
      end_minute: NaN,
      break_start_minute: null,
      break_end_minute: null,
    };
    renderEditor(week, vi.fn());
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.getByText('09:00–18:00')).toBeInTheDocument();
  });

  it('clicking Done closes the popover', () => {
    renderEditor(emptyWeek(), vi.fn());
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.getByText('Done')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Done'));
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });
});
