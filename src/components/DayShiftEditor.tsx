import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash2, Coffee, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  WeeklyShiftBlock, sortBlocks, deriveBreaks, summarizeDay, defaultNewBlock, resolveOverlapsForDay, DAY_END_MINUTE,
} from '@/lib/weeklyScheduleLogic';

interface DayShiftEditorProps {
  label: string; // the day name shown at the top, e.g. "Monday"
  dayOfWeek: number; // 1=Mon..7=Sun — needed even when blocks is empty (day off)
  blocks: WeeklyShiftBlock[]; // this day's blocks, any order — sorted internally for display
  onChangeBlocks: (blocks: WeeklyShiftBlock[]) => void; // full replacement of this day's block list
  onDone: () => void;
  offLabel: string;
  workingLabel: string;
  breakLabel: string;
  doneLabel: string;
  addShiftLabel: string;
  copyToDaysLabel: string;
  copyToDayShortLabels: string[]; // 7 short day pills for "copy to" targets, index 0 = Monday
  onCopyToDays: (targetDays: number[]) => void;
  shiftCountLabel: (n: number) => string;
  totalHoursLabel: (h: string) => string;
  breakHoursLabel: (h: string) => string;
  shiftNumberLabel: (n: number) => string; // e.g. n=>`Shift ${n}` / n=>`Ca ${n}`
  copyLabel: string;
}

const formatHHMM = (mins: number) => {
  if (typeof mins !== 'number' || !Number.isFinite(mins)) return '--:--';
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
};

const minutesToTimeInput = (mins: number) => (Number.isFinite(mins) ? formatHHMM(mins) : '');
const timeInputToMinutes = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
};

const formatHours = (mins: number) => (mins / 60).toFixed(1);

// A day's block list, editable in a popover: toggle the day on/off, add/
// remove/edit individual shift blocks, see derived breaks between them, and
// copy this day's schedule onto other days. Replaces the old single work-
// range + lunch-break flyout (ShiftEditFlyout) now that a day can have N
// independent blocks.
export function DayShiftEditor({
  label, dayOfWeek, blocks: rawBlocks, onChangeBlocks, onDone,
  offLabel, workingLabel, breakLabel, doneLabel, addShiftLabel, copyToDaysLabel,
  copyToDayShortLabels, onCopyToDays, shiftCountLabel, totalHoursLabel, breakHoursLabel, shiftNumberLabel, copyLabel,
}: DayShiftEditorProps) {
  const [selectedTargetDays, setSelectedTargetDays] = useState<number[]>([]);
  const blocks = sortBlocks(rawBlocks);
  const isWorking = blocks.length > 0;
  const breaks = deriveBreaks(blocks);
  const summary = summarizeDay(blocks);

  const updateBlock = (index: number, patch: Partial<WeeklyShiftBlock>) => {
    const target = { ...blocks[index], ...patch };
    const others = blocks.filter((_, i) => i !== index);
    const resolved = resolveOverlapsForDay(target, others, target.id);
    onChangeBlocks(blocks.map((b, i) => (i === index ? { ...target, ...resolved } : b)));
  };

  const removeBlock = (index: number) => {
    onChangeBlocks(blocks.filter((_, i) => i !== index));
  };

  const handleToggleWorking = (checked: boolean) => {
    if (!checked) {
      onChangeBlocks([]);
      return;
    }
    onChangeBlocks([{ day_of_week: dayOfWeek, start_minute: 9 * 60, end_minute: 18 * 60 }]);
  };

  const lastBlockEnd = blocks.length > 0 ? blocks[blocks.length - 1].end_minute : 0;
  const canAddShift = lastBlockEnd < DAY_END_MINUTE;

  const handleAddShift = () => {
    if (!canAddShift) return;
    const preview = defaultNewBlock(blocks);
    const resolved = resolveOverlapsForDay(preview, blocks);
    onChangeBlocks([...blocks, { day_of_week: dayOfWeek, ...resolved }]);
  };

  const toggleTargetDay = (day: number) => {
    setSelectedTargetDays(prev => (prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]));
  };

  const handleCopy = () => {
    if (selectedTargetDays.length === 0 || blocks.length === 0) return;
    onCopyToDays(selectedTargetDays);
    setSelectedTargetDays([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{isWorking ? workingLabel : offLabel}</span>
          <Switch checked={isWorking} onCheckedChange={handleToggleWorking} />
        </div>
      </div>

      {isWorking && (
        <>
          <p className="text-[11px] text-muted-foreground">
            {shiftCountLabel(summary.shiftCount)} · {totalHoursLabel(formatHours(summary.totalMinutes))}
            {summary.breakMinutes > 0 && <> · {breakHoursLabel(formatHours(summary.breakMinutes))}</>}
          </p>

          <div className="space-y-1.5">
            {blocks.map((block, i) => (
              <div key={block.id ?? i}>
                <div className="flex items-center gap-1.5 rounded-md border border-border/60 p-1.5">
                  <span className="text-[10px] text-muted-foreground w-10 shrink-0">{shiftNumberLabel(i + 1)}</span>
                  <Input
                    type="time"
                    value={minutesToTimeInput(block.start_minute)}
                    onChange={e => updateBlock(i, { start_minute: timeInputToMinutes(e.target.value) })}
                    className="h-7 text-xs"
                  />
                  <span className="text-muted-foreground/50">–</span>
                  <Input
                    type="time"
                    value={minutesToTimeInput(block.end_minute)}
                    onChange={e => updateBlock(i, { end_minute: timeInputToMinutes(e.target.value) })}
                    className="h-7 text-xs"
                  />
                  {blocks.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeBlock(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {breaks[i] && (
                  <div className="flex items-center gap-1.5 px-1.5 py-1 text-[10px] text-muted-foreground" title={breakLabel}>
                    <Coffee className="h-3 w-3" />
                    <span className="tabular-nums">{breakLabel} {formatHHMM(breaks[i].start_minute)}–{formatHHMM(breaks[i].end_minute)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs"
            onClick={handleAddShift}
            disabled={!canAddShift}
          >
            <Plus className="h-3 w-3 mr-1" /> {addShiftLabel}
          </Button>

          <div className="border-t pt-2 space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">{copyToDaysLabel}</Label>
            <div className="flex flex-wrap gap-1">
              {copyToDayShortLabels.map((dayLabel, i) => {
                const day = i + 1;
                if (day === dayOfWeek) return null;
                const selected = selectedTargetDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleTargetDay(day)}
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors',
                      selected ? 'bg-[#006AFF] text-white border-[#006AFF]' : 'border-border/60 text-muted-foreground hover:border-[#006AFF]/40',
                    )}
                  >
                    {dayLabel}
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs"
              disabled={selectedTargetDays.length === 0}
              onClick={handleCopy}
            >
              {copyLabel}
            </Button>
          </div>
        </>
      )}

      <Button size="sm" className="w-full h-8 text-xs" onClick={onDone}>
        {doneLabel}
      </Button>
    </div>
  );
}
