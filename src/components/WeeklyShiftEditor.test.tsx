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
    />,
  );

describe('WeeklyShiftEditor', () => {
  it('renders a button per day, showing only the day name — no hours or Off text', () => {
    const week = emptyWeek();
    week[1] = [{ day_of_week: 1, start_minute: 9 * 60, end_minute: 17 * 60 }];
    renderEditor(week);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(7);
    DAY_LABELS.forEach((label, i) => {
      expect(buttons[i]).toHaveTextContent(label);
    });
    expect(screen.queryByText('09:00–17:00')).not.toBeInTheDocument();
    expect(screen.queryByText(/Off/)).not.toBeInTheDocument();
  });

  it('clicking a day button calls onSelectDay with that day, without rendering any editor inline', () => {
    const onSelectDay = vi.fn();
    renderEditor(emptyWeek(), onSelectDay);
    screen.getAllByRole('button')[0].click();
    expect(onSelectDay).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('clicking the second button calls onSelectDay with day 2', () => {
    const onSelectDay = vi.fn();
    renderEditor(emptyWeek(), onSelectDay);
    screen.getAllByRole('button')[1].click();
    expect(onSelectDay).toHaveBeenCalledWith(2);
  });
});
