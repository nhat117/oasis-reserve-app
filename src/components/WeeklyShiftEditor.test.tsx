import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { WeeklyShiftEditor } from './WeeklyShiftEditor';
import { DayBlocksMap } from '@/lib/weeklyScheduleLogic';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const emptyWeek = (): DayBlocksMap => ({ 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] });

const renderEditor = (value: DayBlocksMap, onChange: (next: DayBlocksMap) => void) =>
  render(
    <WeeklyShiftEditor
      value={value}
      onChange={onChange}
      dayLabels={DAY_LABELS}
      offLabel="Off"
      workingLabel="Working"
      breakLabel="Break"
      doneLabel="Done"
      addShiftLabel="+ Add shift"
      copyToDaysLabel="Copy to days"
      shiftCountLabel={(n) => `${n} shifts`}
      totalHoursLabel={(h) => `${h}h total`}
      breakHoursLabel={(h) => `${h}h break`}
      shiftNumberLabel={(n) => `Shift ${n}`}
      copyLabel="Copy"
      shopOpenMinute={9 * 60}
      shopCloseMinute={21 * 60}
    />,
  );

describe('WeeklyShiftEditor', () => {
  it('renders a card per day, showing Off for days with no blocks', () => {
    renderEditor(emptyWeek(), vi.fn());
    expect(screen.getAllByText('Off')).toHaveLength(7);
    for (const label of DAY_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('shows a shift line with times for a day with one block', () => {
    const week = emptyWeek();
    week[1] = [{ day_of_week: 1, start_minute: 9 * 60, end_minute: 17 * 60 }];
    renderEditor(week, vi.fn());
    expect(screen.getByText('09:00–17:00')).toBeInTheDocument();
  });

  it('shows one line per block plus a derived break line for a split shift', () => {
    const week = emptyWeek();
    week[1] = [
      { day_of_week: 1, start_minute: 630, end_minute: 810 }, // 10:30-13:30
      { day_of_week: 1, start_minute: 1020, end_minute: 1290 }, // 17:00-21:30
    ];
    renderEditor(week, vi.fn());
    expect(screen.getByText('10:30–13:30')).toBeInTheDocument();
    expect(screen.getByText('17:00–21:30')).toBeInTheDocument();
    expect(screen.getByText('13:30–17:00')).toBeInTheDocument();
  });

  it('opens a popover with the day editor when a day card is clicked', () => {
    renderEditor(emptyWeek(), vi.fn());
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('toggling a day on from off seeds exactly one default block for that day only', () => {
    const onChange = vi.fn();
    renderEditor(emptyWeek(), onChange);

    fireEvent.click(screen.getAllByRole('button')[0]); // open Monday's popover
    fireEvent.click(screen.getByRole('switch'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const result = onChange.mock.calls[0][0] as DayBlocksMap;
    expect(result[1]).toEqual([{ day_of_week: 1, start_minute: 540, end_minute: 1080 }]);
    expect(result[2]).toEqual([]); // other days untouched
  });

  it('adding a shift block updates only the target day', () => {
    const week = emptyWeek();
    week[2] = [{ day_of_week: 2, start_minute: 540, end_minute: 720 }]; // Tuesday working
    const onChange = vi.fn();
    renderEditor(week, onChange);

    fireEvent.click(screen.getAllByRole('button')[1]); // open Tuesday's popover
    fireEvent.click(screen.getByText('+ Add shift'));

    const result = onChange.mock.calls[0][0] as DayBlocksMap;
    expect(result[2]).toHaveLength(2);
    expect(result[1]).toEqual([]); // Monday untouched
  });

  it('editing a start/end time input updates the correct day only', () => {
    const week = emptyWeek();
    week[2] = [{ day_of_week: 2, start_minute: 540, end_minute: 1080 }]; // Tuesday working
    const onChange = vi.fn();
    renderEditor(week, onChange);

    fireEvent.click(screen.getAllByRole('button')[1]); // open Tuesday's popover
    const timeInputs = screen.getAllByDisplayValue('09:00');
    fireEvent.change(timeInputs[0], { target: { value: '10:30' } });

    const result = onChange.mock.calls[0][0] as DayBlocksMap;
    expect(result[2][0].start_minute).toBe(10 * 60 + 30);
    expect(result[1]).toEqual([]); // Monday untouched
  });

  it('copying a day to other days replicates its blocks with the target day_of_week, leaving the source untouched', () => {
    const week = emptyWeek();
    week[1] = [{ day_of_week: 1, start_minute: 540, end_minute: 1080 }];
    const onChange = vi.fn();
    renderEditor(week, onChange);

    fireEvent.click(screen.getAllByRole('button')[0]); // open Monday's popover
    const popover = screen.getByText('Done').closest('div')!.parentElement!;
    fireEvent.click(within(popover).getByText('Tue'));
    fireEvent.click(within(popover).getByText('Wed'));
    fireEvent.click(within(popover).getByText('Copy'));

    const result = onChange.mock.calls[0][0] as DayBlocksMap;
    expect(result[1]).toEqual(week[1]); // source unchanged
    expect(result[2]).toEqual([{ start_minute: 540, end_minute: 1080, day_of_week: 2 }]);
    expect(result[3]).toEqual([{ start_minute: 540, end_minute: 1080, day_of_week: 3 }]);
  });

  it('clicking Done closes the popover', () => {
    renderEditor(emptyWeek(), vi.fn());
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.getByText('Done')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Done'));
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });

  it('renders the mini timeline bar scaled within the chip without throwing for an off day', () => {
    // Regression guard: an empty day must not attempt to render a filled
    // segment (there's nothing to scale) and must not crash.
    const { container } = renderEditor(emptyWeek(), vi.fn());
    const bars = container.querySelectorAll('.bg-\\[\\#F0F0F0\\]');
    expect(bars.length).toBe(7);
  });
});
