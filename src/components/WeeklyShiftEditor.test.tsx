import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeeklyShiftEditor } from './WeeklyShiftEditor';
import { DayBlocksMap } from '@/lib/weeklyScheduleLogic';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const emptyWeek = (): DayBlocksMap => ({ 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] });

const renderEditor = (value: DayBlocksMap, onSelectDay: (dayOfWeek: number) => void = vi.fn()) =>
  render(
    <WeeklyShiftEditor
      value={value}
      onSelectDay={onSelectDay}
      dayLabels={DAY_LABELS}
      offLabel="Off"
      breakLabel="Break"
    />,
  );

describe('WeeklyShiftEditor', () => {
  it('renders a card per day, showing Off for days with no blocks', () => {
    renderEditor(emptyWeek());
    expect(screen.getAllByText('Off')).toHaveLength(7);
    for (const label of DAY_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('shows a shift line with times for a day with one block', () => {
    const week = emptyWeek();
    week[1] = [{ day_of_week: 1, start_minute: 9 * 60, end_minute: 17 * 60 }];
    renderEditor(week);
    expect(screen.getByText('09:00–17:00')).toBeInTheDocument();
  });

  it('shows one line per block plus a derived break line for a split shift', () => {
    const week = emptyWeek();
    week[1] = [
      { day_of_week: 1, start_minute: 630, end_minute: 810 }, // 10:30-13:30
      { day_of_week: 1, start_minute: 1020, end_minute: 1290 }, // 17:00-21:30
    ];
    renderEditor(week);
    expect(screen.getByText('10:30–13:30')).toBeInTheDocument();
    expect(screen.getByText('17:00–21:30')).toBeInTheDocument();
    expect(screen.getByText('13:30–17:00')).toBeInTheDocument();
  });

  it('clicking a day card calls onSelectDay with that day, without rendering any editor inline', () => {
    const onSelectDay = vi.fn();
    renderEditor(emptyWeek(), onSelectDay);
    screen.getAllByRole('button')[0].click();
    expect(onSelectDay).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('clicking the second card calls onSelectDay with day 2', () => {
    const onSelectDay = vi.fn();
    renderEditor(emptyWeek(), onSelectDay);
    screen.getAllByRole('button')[1].click();
    expect(onSelectDay).toHaveBeenCalledWith(2);
  });
});
