import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface WeeklyHourRow {
  day_of_week: number; // 1=Mon..7=Sun
  is_working: boolean;
  start_minute: number;
  end_minute: number;
  break_start_minute: number | null;
  break_end_minute: number | null;
}

interface WeeklyShiftEditorProps {
  value: WeeklyHourRow[]; // exactly 7 rows, one per day_of_week 1-7
  onChange: (rows: WeeklyHourRow[]) => void;
  dayLabels: string[]; // 7 short labels, index 0 = Monday
  offLabel: string;
  workingLabel: string;
  breakLabel: string;
  doneLabel: string;
}

const formatHHMM = (mins: number) => {
  if (typeof mins !== 'number' || !Number.isFinite(mins)) return '--:--';
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
};

const minutesToTimeInput = (mins: number | null) => (mins == null ? '' : formatHHMM(mins));
const timeInputToMinutes = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
};

const sanitizeRow = (row: WeeklyHourRow): WeeklyHourRow => ({
  ...row,
  start_minute: Number.isFinite(row.start_minute) ? row.start_minute : 9 * 60,
  end_minute: Number.isFinite(row.end_minute) ? row.end_minute : 18 * 60,
  break_start_minute: Number.isFinite(row.break_start_minute) ? row.break_start_minute : null,
  break_end_minute: Number.isFinite(row.break_end_minute) ? row.break_end_minute : null,
});

// A Teams Shifts-style week strip: one card per day showing "Off" or a
// colored shift pill (time + break). Clicking a card opens a popover with
// an on/off toggle and time inputs for that single day — no drag gestures,
// just fill in the times like the Shifts app's day editor.
export function WeeklyShiftEditor({ value: rawValue, onChange, dayLabels, offLabel, workingLabel, breakLabel, doneLabel }: WeeklyShiftEditorProps) {
  const value = rawValue.map(sanitizeRow);
  const [openDay, setOpenDay] = useState<number | null>(null);

  const updateRow = (dayIdx: number, patch: Partial<WeeklyHourRow>) => {
    onChange(value.map((row, idx) => (idx === dayIdx ? { ...row, ...patch } : row)));
  };

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {dayLabels.map((label, dayIdx) => {
        const row = value[dayIdx];
        return (
          <Popover key={dayIdx} open={openDay === dayIdx} onOpenChange={(open) => setOpenDay(open ? dayIdx : null)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex flex-col rounded-lg border p-2 text-left transition-colors min-h-[72px]',
                  row.is_working ? 'border-[#006AFF]/30 bg-[#006AFF]/5 hover:bg-[#006AFF]/10' : 'border-[#E5E5E5]/60 bg-[#F5F5F5] hover:bg-[#F0F0F0]',
                )}
              >
                <span className="text-[11px] font-semibold text-[#1B1B1B]">{label}</span>
                {row.is_working ? (
                  <div className="mt-1.5">
                    <span className="inline-block rounded-full bg-[#006AFF] text-white text-[10px] font-medium px-1.5 py-0.5">
                      {formatHHMM(row.start_minute)}–{formatHHMM(row.end_minute)}
                    </span>
                    {row.break_start_minute != null && row.break_end_minute != null && (
                      <p className="text-[9px] text-muted-foreground mt-1">
                        {breakLabel} {formatHHMM(row.break_start_minute)}–{formatHHMM(row.break_end_minute)}
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground/50 mt-1.5">{offLabel}</span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{row.is_working ? workingLabel : offLabel}</span>
                    <Switch checked={row.is_working} onCheckedChange={(v) => updateRow(dayIdx, { is_working: v })} />
                  </div>
                </div>
                {row.is_working && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{workingLabel}</Label>
                        <Input type="time" value={minutesToTimeInput(row.start_minute)} onChange={e => updateRow(dayIdx, { start_minute: timeInputToMinutes(e.target.value) })} className="h-8 text-xs mt-0.5" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground opacity-0">–</Label>
                        <Input type="time" value={minutesToTimeInput(row.end_minute)} onChange={e => updateRow(dayIdx, { end_minute: timeInputToMinutes(e.target.value) })} className="h-8 text-xs mt-0.5" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{breakLabel}</Label>
                        <Input type="time" value={minutesToTimeInput(row.break_start_minute)} onChange={e => updateRow(dayIdx, { break_start_minute: e.target.value ? timeInputToMinutes(e.target.value) : null })} className="h-8 text-xs mt-0.5" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground opacity-0">–</Label>
                        <Input type="time" value={minutesToTimeInput(row.break_end_minute)} onChange={e => updateRow(dayIdx, { break_end_minute: e.target.value ? timeInputToMinutes(e.target.value) : null })} className="h-8 text-xs mt-0.5" />
                      </div>
                    </div>
                  </>
                )}
                <Button size="sm" className="w-full h-8 text-xs" onClick={() => setOpenDay(null)}>
                  {doneLabel}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
