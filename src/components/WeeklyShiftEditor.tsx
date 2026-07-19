import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DayShiftEditor } from '@/components/DayShiftEditor';
import { Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DayBlocksMap, sortBlocks, deriveBreaks } from '@/lib/weeklyScheduleLogic';
import { formatMinutesHHMM } from '@/lib/shiftLogic';

interface WeeklyShiftEditorProps {
  value: DayBlocksMap; // keys 1-7 always present
  onChange: (next: DayBlocksMap) => void;
  dayLabels: string[]; // 7 short labels, index 0 = Monday
  offLabel: string;
  workingLabel: string;
  breakLabel: string;
  doneLabel: string;
  addShiftLabel: string;
  copyToDaysLabel: string;
  shiftCountLabel: (n: number) => string;
  totalHoursLabel: (h: string) => string;
  breakHoursLabel: (h: string) => string;
  shiftNumberLabel: (n: number) => string;
  copyLabel: string;
  shopOpenMinute: number; // for scaling each chip's mini timeline bar
  shopCloseMinute: number;
  /** The Edit Staff dialog's scrollable content element, so the popover's
   * collision detection knows the actual visible boundary (not just the
   * browser viewport) and never overlaps the dialog's Save/Cancel buttons. */
  collisionBoundary?: HTMLElement | null;
}

// Monday=1..Sunday=7 to match day_of_week; JS getDay() is Sunday=0..Saturday=6.
const todayDayOfWeek = () => {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
};

const clampPercent = (n: number) => Math.max(0, Math.min(100, n));

// A Teams Shifts-style week strip: one compact card per day showing "Off" or
// each shift block's time range (+ derived breaks, if any). Clicking a card
// opens a popover with a DayShiftEditor for that single day — add/remove
// blocks, see derived breaks, copy to other days.
export function WeeklyShiftEditor({
  value, onChange, dayLabels, offLabel, workingLabel, breakLabel, doneLabel,
  addShiftLabel, copyToDaysLabel, shiftCountLabel, totalHoursLabel, breakHoursLabel, shiftNumberLabel, copyLabel,
  shopOpenMinute, shopCloseMinute, collisionBoundary,
}: WeeklyShiftEditorProps) {
  const [openDay, setOpenDay] = useState<number | null>(null);
  const today = todayDayOfWeek();
  const shopSpan = Math.max(1, shopCloseMinute - shopOpenMinute);

  const handleCopyToDays = (sourceDay: number, targetDays: number[]) => {
    const sourceBlocks = value[sourceDay] || [];
    const next: DayBlocksMap = { ...value };
    for (const day of targetDays) {
      next[day] = sourceBlocks.map(b => ({ start_minute: b.start_minute, end_minute: b.end_minute, day_of_week: day }));
    }
    onChange(next);
  };

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {dayLabels.map((label, idx) => {
        const dayOfWeek = idx + 1;
        const blocks = sortBlocks(value[dayOfWeek] || []);
        const breaks = deriveBreaks(blocks);
        const isToday = dayOfWeek === today;
        const isOpen = openDay === dayOfWeek;
        return (
          <Popover key={dayOfWeek} open={isOpen} onOpenChange={(open) => setOpenDay(open ? dayOfWeek : null)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex min-h-[52px] flex-col rounded-lg border bg-white px-2 py-1.5 text-left shadow-sm transition-all duration-150',
                  'hover:shadow-md hover:border-[#D4D4D4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006AFF]/40',
                  blocks.length === 0 && 'bg-[#FAFAFA]',
                  isToday ? 'border-[#006AFF]/40 bg-[#006AFF]/[0.04]' : 'border-[#E5E5E5]/70',
                  isOpen && 'ring-2 ring-[#006AFF]/30 border-[#006AFF]/50',
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
                {/* Mini timeline bar — filled segments for shift blocks, scaled to the shop's open/close window */}
                <div className="mt-1.5 relative h-[6px] w-full rounded-full bg-[#F0F0F0] overflow-hidden">
                  {blocks.map((b, i) => {
                    const left = clampPercent(((b.start_minute - shopOpenMinute) / shopSpan) * 100);
                    const right = clampPercent(((b.end_minute - shopOpenMinute) / shopSpan) * 100);
                    return (
                      <div
                        key={b.id ?? i}
                        className="absolute top-0 h-full rounded-full bg-[#006AFF]/70"
                        style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }}
                      />
                    );
                  })}
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-64 p-3"
              align="start"
              sideOffset={8}
              avoidCollisions
              collisionPadding={{ bottom: 88 }}
              collisionBoundary={collisionBoundary}
            >
              <DayShiftEditor
                label={label}
                dayOfWeek={dayOfWeek}
                blocks={blocks}
                onChangeBlocks={(next) => onChange({ ...value, [dayOfWeek]: next })}
                onDone={() => setOpenDay(null)}
                offLabel={offLabel}
                workingLabel={workingLabel}
                breakLabel={breakLabel}
                doneLabel={doneLabel}
                addShiftLabel={addShiftLabel}
                copyToDaysLabel={copyToDaysLabel}
                copyToDayShortLabels={dayLabels}
                onCopyToDays={(targets) => handleCopyToDays(dayOfWeek, targets)}
                shiftCountLabel={shiftCountLabel}
                totalHoursLabel={totalHoursLabel}
                breakHoursLabel={breakHoursLabel}
                shiftNumberLabel={shiftNumberLabel}
                copyLabel={copyLabel}
              />
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
