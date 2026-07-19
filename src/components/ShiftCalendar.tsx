import { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { EventResizeDoneArg } from '@fullcalendar/interaction';
import { EventClickArg, EventDropArg, DateSelectArg } from '@fullcalendar/core';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Trash2 } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { therapistColorFor } from '@/lib/therapistColors';

export interface ShiftRow {
  id: string;
  therapist_id: string;
  shift_date: string;
  start_minute: number;
  end_minute: number;
  break_start_minute: number | null;
  break_end_minute: number | null;
  notes: string | null;
}

interface UnavailabilityRow {
  therapist_id: string;
  unavailable_date: string;
  reason: string | null;
}

interface ShopHolidayRow {
  holiday_date: string;
  early_close_hour: number | null;
}

interface Therapist {
  id: string;
  name: string;
}

interface MutationLike<TVars> {
  mutate: (vars: TVars, opts?: { onSuccess?: () => void; onError?: (e: any) => void }) => void;
  isPending: boolean;
}

interface ShiftCalendarProps {
  therapists: Therapist[];
  selectedTherapistId: string | null;
  onSelectTherapist: (id: string) => void;
  shifts: ShiftRow[];
  unavailabilities: UnavailabilityRow[];
  shopHolidays: ShopHolidayRow[];
  onDatesSet: (arg: { view: { activeStart: Date; activeEnd: Date } }) => void;
  addShift: MutationLike<{ therapistId: string; date: string; startMinute: number; endMinute: number; breakStartMinute?: number | null; breakEndMinute?: number | null; notes?: string }>;
  updateShift: MutationLike<{ id: string; therapistId: string; date: string; startMinute: number; endMinute: number; breakStartMinute?: number | null; breakEndMinute?: number | null; notes?: string }>;
  removeShift: MutationLike<string>;
  openConfirm: (title: string, description: string, action: () => void) => void;
}

const toDateTimeMinutes = (date: Date) => date.getHours() * 60 + date.getMinutes();
const minutesToTimeInput = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
const timeInputToMinutes = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
};

// Drag-and-drop per-date shift scheduling for one staff member at a time —
// mirrors BookingCalendar.tsx's editable/select/eventDrop pattern exactly,
// plus a real eventResize handler (BookingCalendar sets
// eventResizableFromStart={false} but never actually wires eventResize).
// Editing here only ever touches the clicked/dragged date's therapist_shifts
// row — the recurring weekly template is never written to.
export function ShiftCalendar({
  therapists, selectedTherapistId, onSelectTherapist,
  shifts, unavailabilities, shopHolidays, onDatesSet,
  addShift, updateShift, removeShift, openConfirm,
}: ShiftCalendarProps) {
  const { t, lang } = useI18n();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftRow | null>(null);
  const [formDate, setFormDate] = useState('');
  const [formStart, setFormStart] = useState('09:00');
  const [formEnd, setFormEnd] = useState('18:00');
  const [hasBreak, setHasBreak] = useState(false);
  const [formBreakStart, setFormBreakStart] = useState('12:00');
  const [formBreakEnd, setFormBreakEnd] = useState('12:30');
  const [formNotes, setFormNotes] = useState('');

  const accent = selectedTherapistId ? therapistColorFor(selectedTherapistId, therapists) : '#006AFF';

  const ownShifts = useMemo(
    () => shifts.filter(s => s.therapist_id === selectedTherapistId),
    [shifts, selectedTherapistId],
  );
  const ownUnavailDates = useMemo(
    () => new Set(unavailabilities.filter(u => u.therapist_id === selectedTherapistId).map(u => u.unavailable_date)),
    [unavailabilities, selectedTherapistId],
  );

  const shiftEvents = useMemo(() => ownShifts.map(s => ({
    id: s.id,
    start: `${s.shift_date}T${minutesToTimeInput(s.start_minute)}`,
    end: `${s.shift_date}T${minutesToTimeInput(s.end_minute)}`,
    backgroundColor: accent,
    borderColor: accent,
    textColor: '#ffffff',
    extendedProps: { shift: s },
  })), [ownShifts, accent]);

  const breakEvents = useMemo(() => ownShifts
    .filter(s => s.break_start_minute != null && s.break_end_minute != null)
    .map(s => ({
      id: `break-${s.id}`,
      start: `${s.shift_date}T${minutesToTimeInput(s.break_start_minute!)}`,
      end: `${s.shift_date}T${minutesToTimeInput(s.break_end_minute!)}`,
      display: 'background',
      color: '#00000022',
      editable: false,
      extendedProps: { isBreak: true },
    })), [ownShifts]);

  const dayOffEvents = useMemo(() => [...ownUnavailDates].map(date => ({
    id: `dayoff-${date}`,
    start: date,
    allDay: true,
    display: 'list-item',
    editable: false,
    color: '#ef4444',
    title: t('Nghỉ'),
    extendedProps: { isDayOff: true },
  })), [ownUnavailDates, t]);

  const holidayEvents = useMemo(() => shopHolidays.map(h => ({
    id: `holiday-${h.holiday_date}`,
    start: h.holiday_date,
    allDay: true,
    display: 'list-item',
    editable: false,
    color: h.early_close_hour ? '#f59e0b' : '#ef4444',
    title: h.early_close_hour ? `${t('Đóng cửa lúc')} ${h.early_close_hour}:00` : t('Nghỉ cả ngày'),
    extendedProps: { isHoliday: true },
  })), [shopHolidays, t]);

  const events = useMemo(() => [...dayOffEvents, ...holidayEvents, ...shiftEvents, ...breakEvents],
    [dayOffEvents, holidayEvents, shiftEvents, breakEvents]);

  const resetForm = () => {
    setEditingShift(null);
    setFormStart('09:00');
    setFormEnd('18:00');
    setHasBreak(false);
    setFormBreakStart('12:00');
    setFormBreakEnd('12:30');
    setFormNotes('');
  };

  const openAddDialog = (date: string, startMinute?: number, endMinute?: number) => {
    if (!selectedTherapistId) return;
    if (ownUnavailDates.has(date)) {
      openConfirm(t('Nhân viên đang nghỉ'), t('Nhân viên đang nghỉ ngày này, không thể thêm ca làm.'), () => {});
      return;
    }
    resetForm();
    setFormDate(date);
    if (startMinute != null) setFormStart(minutesToTimeInput(startMinute));
    if (endMinute != null) setFormEnd(minutesToTimeInput(endMinute));
    setDialogOpen(true);
  };

  const openEditDialog = (shift: ShiftRow) => {
    setEditingShift(shift);
    setFormDate(shift.shift_date);
    setFormStart(minutesToTimeInput(shift.start_minute));
    setFormEnd(minutesToTimeInput(shift.end_minute));
    const shiftHasBreak = shift.break_start_minute != null && shift.break_end_minute != null;
    setHasBreak(shiftHasBreak);
    setFormBreakStart(shiftHasBreak ? minutesToTimeInput(shift.break_start_minute!) : '12:00');
    setFormBreakEnd(shiftHasBreak ? minutesToTimeInput(shift.break_end_minute!) : '12:30');
    setFormNotes(shift.notes || '');
    setDialogOpen(true);
  };

  const handleDateSelect = (info: DateSelectArg) => {
    if (!selectedTherapistId) return;
    const date = format(info.start, 'yyyy-MM-dd');
    if (info.view.type.includes('timeGrid')) {
      openAddDialog(date, toDateTimeMinutes(info.start), toDateTimeMinutes(info.end));
    } else {
      openAddDialog(date);
    }
  };

  const handleEventClick = (info: EventClickArg) => {
    const shift = info.event.extendedProps.shift as ShiftRow | undefined;
    if (!shift) return; // day-off / holiday / break markers aren't editable
    openEditDialog(shift);
  };

  const handleEventDrop = (info: EventDropArg) => {
    const shift = info.event.extendedProps.shift as ShiftRow | undefined;
    if (!shift || !info.event.start || !info.event.end) { info.revert(); return; }
    const newDate = format(info.event.start, 'yyyy-MM-dd');
    if (ownUnavailDates.has(newDate)) { info.revert(); return; }
    updateShift.mutate({
      id: shift.id,
      therapistId: shift.therapist_id,
      date: newDate,
      startMinute: toDateTimeMinutes(info.event.start),
      endMinute: toDateTimeMinutes(info.event.end),
      breakStartMinute: shift.break_start_minute,
      breakEndMinute: shift.break_end_minute,
      notes: shift.notes || undefined,
    }, { onError: () => info.revert() });
  };

  const handleEventResize = (info: EventResizeDoneArg) => {
    const shift = info.event.extendedProps.shift as ShiftRow | undefined;
    if (!shift || !info.event.start || !info.event.end) { info.revert(); return; }
    const newStart = toDateTimeMinutes(info.event.start);
    const newEnd = toDateTimeMinutes(info.event.end);
    // A break that no longer fits inside the resized shift is dropped rather
    // than silently left invalid.
    const breakStillFits = shift.break_start_minute != null && shift.break_end_minute != null
      && shift.break_start_minute >= newStart && shift.break_end_minute <= newEnd;
    updateShift.mutate({
      id: shift.id,
      therapistId: shift.therapist_id,
      date: shift.shift_date,
      startMinute: newStart,
      endMinute: newEnd,
      breakStartMinute: breakStillFits ? shift.break_start_minute : null,
      breakEndMinute: breakStillFits ? shift.break_end_minute : null,
      notes: shift.notes || undefined,
    }, { onError: () => info.revert() });
  };

  const submitForm = () => {
    if (!selectedTherapistId) return;
    const startMinute = timeInputToMinutes(formStart);
    const endMinute = timeInputToMinutes(formEnd);
    const breakStartMinute = hasBreak ? timeInputToMinutes(formBreakStart) : null;
    const breakEndMinute = hasBreak ? timeInputToMinutes(formBreakEnd) : null;
    const onSuccess = () => setDialogOpen(false);
    if (editingShift) {
      updateShift.mutate({ id: editingShift.id, therapistId: selectedTherapistId, date: formDate, startMinute, endMinute, breakStartMinute, breakEndMinute, notes: formNotes }, { onSuccess });
    } else {
      addShift.mutate({ therapistId: selectedTherapistId, date: formDate, startMinute, endMinute, breakStartMinute, breakEndMinute, notes: formNotes }, { onSuccess });
    }
  };

  return (
    <div className="space-y-3">
      <Select value={selectedTherapistId || undefined} onValueChange={onSelectTherapist}>
        <SelectTrigger className="w-full sm:w-[240px] h-9 text-sm rounded-full bg-[#F5F5F5] border-[#E5E5E5]/50">
          <SelectValue placeholder={t('Chọn thợ')} />
        </SelectTrigger>
        <SelectContent>
          {therapists.map(th => <SelectItem key={th.id} value={th.id}>{th.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {!selectedTherapistId ? (
        <p className="text-sm text-muted-foreground py-10 text-center">{t('Chọn thợ để xem ca làm')}</p>
      ) : (
        <div className="fc-custom">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' }}
            locale={lang === 'vi' ? 'vi' : 'en-au'}
            events={events}
            editable={true}
            selectable={true}
            selectMirror={true}
            select={handleDateSelect}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            datesSet={onDatesSet}
            slotDuration="00:15:00"
            snapDuration="00:15:00"
            allDaySlot={true}
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            height="calc(100vh - 320px)"
            nowIndicator={true}
            buttonText={{ today: t('Hôm nay'), week: t('Tuần'), day: t('Ngày') }}
          />
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingShift ? t('Sửa ca làm') : t('Thêm ca làm')}</DialogTitle>
            <DialogDescription>{formDate}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">{t('Giờ bắt đầu')}</Label>
                <Input type="time" value={formStart} onChange={e => setFormStart(e.target.value)} className="h-9 mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t('Giờ kết thúc')}</Label>
                <Input type="time" value={formEnd} onChange={e => setFormEnd(e.target.value)} className="h-9 mt-1" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">{t('Nghỉ giữa ca')}</Label>
              <Switch checked={hasBreak} onCheckedChange={setHasBreak} />
            </div>
            {hasBreak && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">{t('Bắt đầu nghỉ')}</Label>
                  <Input type="time" value={formBreakStart} onChange={e => setFormBreakStart(e.target.value)} className="h-9 mt-1" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">{t('Kết thúc nghỉ')}</Label>
                  <Input type="time" value={formBreakEnd} onChange={e => setFormBreakEnd(e.target.value)} className="h-9 mt-1" />
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground">{t('Ghi chú')}</Label>
              <Input value={formNotes} onChange={e => setFormNotes(e.target.value)} className="h-9 mt-1" placeholder={t('Không bắt buộc')} />
            </div>

            <div className="flex gap-2 pt-1">
              <Button className="flex-1 h-9" disabled={addShift.isPending || updateShift.isPending} onClick={submitForm}>
                {(addShift.isPending || updateShift.isPending) && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                {editingShift ? t('Lưu') : t('Thêm')}
              </Button>
              {editingShift && (
                <Button
                  variant="outline"
                  className="h-9 text-destructive hover:text-destructive"
                  onClick={() => openConfirm(t('Xoá ca làm'), t('Xoá ca làm này?'), () => {
                    removeShift.mutate(editingShift.id, { onSuccess: () => setDialogOpen(false) });
                  })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
