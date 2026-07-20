import { Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DayBlocksMap, sortBlocks, deriveBreaks } from '@/lib/weeklyScheduleLogic';
import { formatMinutesHHMM } from '@/lib/shiftLogic';

interface WeeklyShiftEditorProps {
  value: DayBlocksMap; // keys 1-7 always present
  dayLabels: string[]; // 7 short labels, index 0 = Monday
  offLabel: string;
  breakLabel: string;
  /** Called when a day card is clicked — the caller owns navigating into
   * that day's schedule editor (e.g. by swapping the modal's body). */
  onSelectDay: (dayOfWeek: number) => void;
}

// Monday=1..Sunday=7 to match day_of_week; JS getDay() is Sunday=0..Saturday=6.
const todayDayOfWeek = () => {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
};

// A Teams Shifts-style week strip: one compact card per day showing "Off" or
// each shift block's time range (+ derived breaks, if any). Clicking a card
// hands off to the parent to show that day's schedule editor — the editor
// itself isn't rendered here, so there's no nested popover/modal.
export function WeeklyShiftEditor({
  value, dayLabels, offLabel, breakLabel, onSelectDay,
}: WeeklyShiftEditorProps) {
  const today = todayDayOfWeek();

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {dayLabels.map((label, idx) => {
        const dayOfWeek = idx + 1;
        const blocks = sortBlocks(value[dayOfWeek] || []);
        const breaks = deriveBreaks(blocks);
        const isToday = dayOfWeek === today;
        return (
          <button
            key={dayOfWeek}
            type="button"
            onClick={() => onSelectDay(dayOfWeek)}
            className={cn(
              'flex min-h-[52px] flex-col rounded-lg border bg-white px-2 py-1.5 text-left shadow-sm transition-all duration-150',
              'hover:shadow-md hover:border-[#D4D4D4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006AFF]/40',
              blocks.length === 0 && 'bg-[#FAFAFA]',
              isToday ? 'border-[#006AFF]/40 bg-[#006AFF]/[0.04]' : 'border-[#E5E5E5]/70',
            )}
          >
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">
              {label}
            </span>
            {blocks.length > 0 ? (
              <div className="mt-1 leading-none space-y-0.5">
                {blocks.map((b, i) => (
                  <p key={b.id ?? i} className="text-[12px] font-bold text-[#1B1B1B] leading-tight tabular-nums">
                    {formatMinutesHHMM(b.start_minute)}–{formatMinutesHHMM(b.end_minute)}
                  </p>
                ))}
                {breaks.length > 0 && (
                  <p className="flex items-center gap-1 text-[9px] text-muted-foreground leading-none" title={breakLabel}>
                    <Coffee className="h-2.5 w-2.5" aria-hidden="true" />
                    <span className="tabular-nums">
                      {breaks.map(b => `${formatMinutesHHMM(b.start_minute)}–${formatMinutesHHMM(b.end_minute)}`).join(', ')}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <span className="mt-1 text-[10px] text-muted-foreground/60 leading-none">{offLabel}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
