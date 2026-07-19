import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DayShiftEditor } from './DayShiftEditor';
import { WeeklyShiftBlock } from '@/lib/weeklyScheduleLogic';

const DAY_SHORT_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const renderDay = (blocks: WeeklyShiftBlock[], overrides: Partial<Record<string, unknown>> = {}) => {
  const onChangeBlocks = vi.fn();
  const onDone = vi.fn();
  const onCopyToDays = vi.fn();
  render(
    <DayShiftEditor
      label="Monday"
      dayOfWeek={1}
      blocks={blocks}
      onChangeBlocks={onChangeBlocks}
      onDone={onDone}
      offLabel="Off"
      workingLabel="Working"
      breakLabel="Break"
      doneLabel="Done"
      addShiftLabel="+ Add shift"
      copyToDaysLabel="Copy to days"
      copyToDayShortLabels={DAY_SHORT_LABELS}
      onCopyToDays={onCopyToDays}
      shiftCountLabel={(n) => `${n} shifts`}
      totalHoursLabel={(h) => `${h}h total`}
      breakHoursLabel={(h) => `${h}h break`}
      shiftNumberLabel={(n) => `Shift ${n}`}
      copyLabel="Copy"
      {...overrides}
    />,
  );
  return { onChangeBlocks, onDone, onCopyToDays };
};

describe('DayShiftEditor', () => {
  it('shows Off and the switch unchecked for an empty day', () => {
    renderDay([]);
    expect(screen.getByText('Off')).toBeInTheDocument();
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('shows the summary line for a working day with one block', () => {
    renderDay([{ day_of_week: 1, start_minute: 540, end_minute: 1020 }]);
    expect(screen.getByText(/1 shifts/)).toBeInTheDocument();
    expect(screen.getByText(/8\.0h total/)).toBeInTheDocument();
  });

  it('shows a derived break line between two blocks with a gap', () => {
    renderDay([
      { day_of_week: 1, start_minute: 630, end_minute: 810 }, // 10:30-13:30
      { day_of_week: 1, start_minute: 1020, end_minute: 1290 }, // 17:00-21:30
    ]);
    expect(screen.getByText(/2 shifts/)).toBeInTheDocument();
    expect(screen.getByText(/3\.5h break/)).toBeInTheDocument();
    expect(screen.getByText(/13:30–17:00/)).toBeInTheDocument();
  });

  it('toggling the switch on from empty seeds one default block', () => {
    const { onChangeBlocks } = renderDay([]);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChangeBlocks).toHaveBeenCalledWith([{ day_of_week: 1, start_minute: 540, end_minute: 1080 }]);
  });

  it('toggling the switch off clears all blocks', () => {
    const { onChangeBlocks } = renderDay([
      { day_of_week: 1, start_minute: 540, end_minute: 720 },
      { day_of_week: 1, start_minute: 780, end_minute: 900 },
    ]);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChangeBlocks).toHaveBeenCalledWith([]);
  });

  it('does not show a delete icon when only one block exists', () => {
    renderDay([{ day_of_week: 1, start_minute: 540, end_minute: 1020 }]);
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument();
  });

  it('clicking + Add shift appends a block starting where the last one ends', () => {
    const { onChangeBlocks } = renderDay([{ day_of_week: 1, start_minute: 540, end_minute: 720 }]);
    fireEvent.click(screen.getByText('+ Add shift'));
    const result = onChangeBlocks.mock.calls[0][0] as WeeklyShiftBlock[];
    expect(result).toHaveLength(2);
    expect(result[1].start_minute).toBe(720);
  });

  it('disables + Add shift when the day has no room left', () => {
    renderDay([{ day_of_week: 1, start_minute: 0, end_minute: 1440 }]);
    expect(screen.getByText('+ Add shift').closest('button')).toBeDisabled();
  });

  it('editing a block start time updates only that block', () => {
    const { onChangeBlocks } = renderDay([
      { day_of_week: 1, id: 'a', start_minute: 540, end_minute: 720 },
      { day_of_week: 1, id: 'b', start_minute: 900, end_minute: 1080 },
    ]);
    const startInputs = screen.getAllByDisplayValue('09:00');
    fireEvent.change(startInputs[0], { target: { value: '10:00' } });
    const result = onChangeBlocks.mock.calls[0][0] as WeeklyShiftBlock[];
    expect(result[0].start_minute).toBe(10 * 60);
    expect(result[1].start_minute).toBe(900); // second block untouched
  });

  it('excludes the current day from the copy-to-days pill row', () => {
    renderDay([{ day_of_week: 1, start_minute: 540, end_minute: 1020 }]);
    // Monday (index 0, day_of_week 1) should not appear as a pill target
    const pills = screen.getAllByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/);
    expect(pills.map(p => p.textContent)).not.toContain('Mon');
    expect(pills.map(p => p.textContent)).toContain('Tue');
  });

  it('selecting target days and clicking Copy calls onCopyToDays with the selected days', () => {
    const { onCopyToDays } = renderDay([{ day_of_week: 1, start_minute: 540, end_minute: 1020 }]);
    fireEvent.click(screen.getByText('Tue'));
    fireEvent.click(screen.getByText('Wed'));
    fireEvent.click(screen.getByText('Copy'));
    expect(onCopyToDays).toHaveBeenCalledWith([2, 3]);
  });

  it('Copy button is disabled until a target day is selected', () => {
    renderDay([{ day_of_week: 1, start_minute: 540, end_minute: 1020 }]);
    expect(screen.getByText('Copy').closest('button')).toBeDisabled();
  });

  it('clicking Done calls onDone', () => {
    const { onDone } = renderDay([]);
    fireEvent.click(screen.getByText('Done'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
