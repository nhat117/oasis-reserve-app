import { cn } from '@/lib/utils';
import { DayBlocksMap } from '@/lib/weeklyScheduleLogic';

interface WeeklyShiftEditorProps {
  value: DayBlocksMap; // keys 1-7 always present
  dayLabels: string[]; // 7 short labels, index 0 = Monday
  /** Called when a day card is clicked — the caller owns navigating into
   * that day's schedule editor (e.g. by swapping the modal's body). */
  onSelectDay: (dayOfWeek: number) => void;
}

// Monday=1..Sunday=7 to match day_of_week; JS getDay() is Sunday=0..Saturday=6.
const todayDayOfWeek = () => {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
};

// A Teams Shifts-style week strip: one button per day showing just the day
// name — clicking hands off to the parent to show that day's schedule
// editor (no nested popover/modal).
export function WeeklyShiftEditor({
  value, dayLabels, onSelectDay,
}: WeeklyShiftEditorProps) {
  const today = todayDayOfWeek();

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {dayLabels.map((label, idx) => {
        const dayOfWeek = idx + 1;
        const blocks = value[dayOfWeek] || [];
        const isToday = dayOfWeek === today;
        return (
          <button
            key={dayOfWeek}
            type="button"
            onClick={() => onSelectDay(dayOfWeek)}
            className={cn(
              'flex h-10 items-center justify-center rounded-lg border bg-white text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shadow-sm transition-all duration-150',
              'hover:shadow-md hover:border-[#D4D4D4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006AFF]/40',
              blocks.length === 0 && 'bg-[#FAFAFA]',
              isToday ? 'border-[#006AFF]/40 bg-[#006AFF]/[0.04] text-[#006AFF]' : 'border-[#E5E5E5]/70',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
