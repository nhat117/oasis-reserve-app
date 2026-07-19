import { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import { EventClickArg } from '@fullcalendar/core';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Plus, X, Loader2, Lock } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { therapistColorFor } from '@/lib/therapistColors';
import { cn } from '@/lib/utils';

export type StaffScheduleMode = 'all-staff' | 'single-therapist' | 'shop-holidays';

interface MutationLike<TVars> {
  mutate: (vars: TVars, opts?: { onSuccess?: () => void }) => void;
  isPending: boolean;
}

interface StaffScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: StaffScheduleMode;
  therapistId?: string; // fixed subject in single-therapist mode
  initialStaffFilter?: string; // seeds the picker in all-staff mode ('all' or a therapist id)
  therapists: any[];
  unavailabilities: any[]; // already scoped to the visible month
  shopHolidays: any[]; // already scoped to the visible month
  isAdmin: boolean;
  onDatesSet: (arg: { view: { activeStart: Date; activeEnd: Date } }) => void;
  openConfirm: (title: string, description: string, action: () => void) => void;
  addUnavailability: MutationLike<{ therapistId: string; date: string; reason?: string }>;
  removeUnavailability: MutationLike<string>;
  addUnavailabilityRange: MutationLike<{ therapistId: string; from: string; to: string; reason?: string }>;
  addHoliday: MutationLike<{ date: string; earlyCloseHour?: number }>;
  removeHoliday: MutationLike<string>;
}

// Consolidates what used to be three near-identical FullCalendar dialogs
// (staff day-offs, shop holidays, per-therapist info panel) into one
// component parameterized by `mode`. This is a bulk review/edit surface for
// Days Off and Shop Holidays only — actual shift scheduling happens in
// ShiftCalendar (the "Ca làm" sub-tab), which reads the day-off/holiday
// records this dialog manages to block/mark shift dates accordingly.
export function StaffScheduleDialog({
  open, onOpenChange, mode, therapistId, initialStaffFilter,
  therapists, unavailabilities, shopHolidays, isAdmin,
  onDatesSet, openConfirm,
  addUnavailability, removeUnavailability, addUnavailabilityRange,
  addHoliday, removeHoliday,
}: StaffScheduleDialogProps) {
  const { t, lang } = useI18n();

  const [staffFilter, setStaffFilter] = useState(initialStaffFilter || therapistId || 'all');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [earlyCloseHour, setEarlyCloseHour] = useState('none');

  useEffect(() => {
    if (open) setStaffFilter(initialStaffFilter || therapistId || 'all');
  }, [open, initialStaffFilter, therapistId]);

  const resetDayPanel = () => setSelectedDate(undefined);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      resetDayPanel();
      setRangeMode(false);
      setRangeFrom('');
      setRangeTo('');
      setEarlyCloseHour('none');
    }
  };

  const effectiveTherapistId = mode === 'single-therapist' ? therapistId! : staffFilter;
  const isSingleStaffView = mode !== 'shop-holidays' && effectiveTherapistId !== 'all';

  const AdminOnlyButton = ({ children, onClick, className = '' }: { children: React.ReactNode; onClick: () => void; className?: string }) => {
    if (isAdmin) {
      return <Button variant="ghost" size="icon" className={className} onClick={onClick}>{children}</Button>;
    }
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="ghost" size="icon" className={cn(className, 'opacity-40 cursor-not-allowed')} disabled>
                <Lock className="h-3 w-3" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('Chỉ admin có quyền thực hiện thao tác này')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const therapistColor = (id: string) => therapistColorFor(id, therapists);

  const unavailEvents = unavailabilities
    .filter((u: any) => mode === 'shop-holidays' ? false : (effectiveTherapistId === 'all' || u.therapist_id === effectiveTherapistId))
    .map((u: any) => ({
      start: u.unavailable_date,
      allDay: true,
      display: 'list-item',
      title: effectiveTherapistId === 'all' ? `${u.therapists?.name || t('Ngày nghỉ')} — ${t('Nghỉ')}` : (u.reason || t('Ngày nghỉ')),
      color: effectiveTherapistId === 'all' ? therapistColor(u.therapist_id) : '#ef4444',
    }));

  const holidayEvents = mode === 'shop-holidays'
    ? shopHolidays.map((h: any) => ({
        start: h.holiday_date,
        allDay: true,
        display: 'list-item',
        title: h.early_close_hour ? `${t('Đóng cửa lúc')} ${h.early_close_hour}:00` : t('Nghỉ cả ngày'),
        color: h.early_close_hour ? '#f59e0b' : '#ef4444',
      }))
    : [];

  const events = [...unavailEvents, ...holidayEvents];

  const title = mode === 'shop-holidays' ? t('Ngày nghỉ tiệm / Đóng cửa sớm') : t('Ngày nghỉ nhân viên');
  const description = mode === 'shop-holidays' ? t('Chọn ngày trên lịch để thêm ngày nghỉ') : t('Chọn ngày trên lịch để thêm ngày nghỉ cho nhân viên');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {mode === 'all-staff' && (
          <div className="flex items-center justify-between gap-2">
            <Select value={staffFilter} onValueChange={(v) => { setStaffFilter(v); resetDayPanel(); }}>
              <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm rounded-full bg-[#F5F5F5] border-[#E5E5E5]/50"><SelectValue placeholder={t('Chọn thợ')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('Tất cả thợ')}</SelectItem>
                {therapists.map(th => <SelectItem key={th.id} value={th.id}>{th.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {staffFilter !== 'all' && (
              <Button size="sm" variant={rangeMode ? 'default' : 'outline'} className="h-9 rounded-full text-xs shrink-0" onClick={() => setRangeMode(v => !v)}>
                {t('Chọn nhiều ngày')}
              </Button>
            )}
          </div>
        )}

        {mode === 'single-therapist' && (
          <div className="flex items-center justify-end">
            <Button size="sm" variant={rangeMode ? 'default' : 'outline'} className="h-9 rounded-full text-xs shrink-0" onClick={() => setRangeMode(v => !v)}>
              {t('Chọn nhiều ngày')}
            </Button>
          </div>
        )}

        {isSingleStaffView && rangeMode && (
          <div className="flex flex-col gap-2 p-3 bg-[#F5F5F5] rounded-xl border border-[#E5E5E5]/60">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-muted-foreground">{t('Từ ngày')}</span>
                <Input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} className="mt-0.5 bg-white border-[#E5E5E5]/60 h-9" />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">{t('Đến ngày')}</span>
                <Input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)} className="mt-0.5 bg-white border-[#E5E5E5]/60 h-9" />
              </div>
            </div>
            <Button
              size="sm" className="h-9 w-fit rounded-full"
              disabled={!rangeFrom || !rangeTo || addUnavailabilityRange.isPending}
              onClick={() => {
                addUnavailabilityRange.mutate({ therapistId: effectiveTherapistId, from: rangeFrom, to: rangeTo }, {
                  onSuccess: () => { setRangeFrom(''); setRangeTo(''); },
                });
              }}
            >
              {addUnavailabilityRange.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />} {t('Thêm ngày nghỉ')}
            </Button>
          </div>
        )}

        <div className="fc-custom fc-mini shrink-0">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
            locale={lang === 'vi' ? 'vi' : 'en-au'}
            height="auto"
            dayMaxEvents={effectiveTherapistId === 'all' ? 3 : 1}
            selectable={false}
            datesSet={onDatesSet}
            dateClick={(info: DateClickArg) => (mode === 'shop-holidays' || effectiveTherapistId !== 'all') && setSelectedDate(info.date)}
            eventClick={(info: EventClickArg) => (mode === 'shop-holidays' || effectiveTherapistId !== 'all') && setSelectedDate(info.event.start || undefined)}
            dayCellClassNames={(arg) => {
              const ds = format(arg.date, 'yyyy-MM-dd');
              if (selectedDate && format(selectedDate, 'yyyy-MM-dd') === ds) return ['fc-day-selected'];
              return [];
            }}
            events={events}
            buttonText={{ today: t('Hôm nay') }}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {mode === 'shop-holidays' && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground/70 pb-1">
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />{t('Nghỉ cả ngày')}</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{t('Đóng cửa sớm')}</span>
            </div>
          )}

          {/* Selected day detail / interaction panel */}
          {mode === 'shop-holidays' ? (
            <div className="border-t border-[#E5E5E5]/30 pt-4">
              {!selectedDate ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : (() => {
                const ds = format(selectedDate, 'yyyy-MM-dd');
                const existing = shopHolidays.find((h: any) => h.holiday_date === ds);
                return (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-[#1B1B1B]">{format(selectedDate, 'dd/MM/yyyy')}</p>
                    {existing ? (
                      <div className="flex items-center justify-between py-2.5 px-4 bg-red-50/60 rounded-full text-sm border border-red-100/50">
                        <span className="text-[13px] text-muted-foreground">
                          {existing.early_close_hour ? `${t('Đóng cửa lúc')} ${existing.early_close_hour}:00` : t('Nghỉ cả ngày')}
                        </span>
                        <AdminOnlyButton className="h-7 w-7 rounded-full text-muted-foreground/40 hover:text-destructive" onClick={() => openConfirm(t('Xoá ngày nghỉ'), t('Xoá ngày nghỉ tiệm này?'), () => { removeHoliday.mutate(existing.id); setSelectedDate(undefined); })}>
                          <X className="h-3.5 w-3.5" />
                        </AdminOnlyButton>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground/70 whitespace-nowrap">{t('Đóng cửa sớm lúc')}</span>
                          <Select value={earlyCloseHour} onValueChange={setEarlyCloseHour}>
                            <SelectTrigger className="w-[100px] h-9 text-sm rounded-full bg-[#F5F5F5] border-[#E5E5E5]/50"><SelectValue placeholder={t('Không')} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">{t('Nghỉ cả ngày')}</SelectItem>
                              {Array.from({ length: 13 }, (_, i) => i + 10).map(h => (
                                <SelectItem key={h} value={String(h)}>{h}:00</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button size="sm" className="h-9 rounded-full" disabled={addHoliday.isPending}
                          onClick={() => {
                            addHoliday.mutate({ date: ds, earlyCloseHour: earlyCloseHour !== 'none' ? parseInt(earlyCloseHour) : undefined });
                            setSelectedDate(undefined);
                            setEarlyCloseHour('none');
                          }}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> {t('Thêm')}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            isSingleStaffView && (
              <div className="border-t border-[#E5E5E5]/30 pt-4">
                {!selectedDate ? (
                  <p className="text-sm text-muted-foreground">{description}</p>
                ) : (() => {
                  const ds = format(selectedDate, 'yyyy-MM-dd');
                  const dayOff = unavailabilities.find((u: any) => u.therapist_id === effectiveTherapistId && u.unavailable_date === ds);
                  return (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-medium text-[#1B1B1B]">{format(selectedDate, 'dd/MM/yyyy')}</p>
                      {dayOff ? (
                        <div className="flex items-center justify-between py-2.5 px-4 bg-red-50/60 rounded-full text-sm border border-red-100/50">
                          <span className="text-[13px] text-muted-foreground">{dayOff.reason || t('Ngày nghỉ')}</span>
                          <AdminOnlyButton className="h-7 w-7 rounded-full text-muted-foreground/40 hover:text-destructive" onClick={() => openConfirm(t('Xoá ngày nghỉ'), t('Xoá ngày nghỉ này?'), () => { removeUnavailability.mutate(dayOff.id); setSelectedDate(undefined); })}>
                            <X className="h-3.5 w-3.5" />
                          </AdminOnlyButton>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="h-9 w-fit rounded-full" disabled={addUnavailability.isPending}
                          onClick={() => { addUnavailability.mutate({ therapistId: effectiveTherapistId, date: ds }); setSelectedDate(undefined); }}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> {t('Thêm ngày nghỉ')}
                        </Button>
                      )}
                    </div>
                  );
                })()}
              </div>
            )
          )}

          {/* Month list — always matches the calendar above, never a separate "all upcoming" view */}
          {mode === 'shop-holidays' ? (() => {
            const monthList = shopHolidays.slice().sort((a: any, b: any) => a.holiday_date.localeCompare(b.holiday_date));
            if (!monthList.length) return null;
            return (
              <div className="border-t border-[#E5E5E5]/30 pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t('Ngày nghỉ')} ({monthList.length})</p>
                <div className="space-y-1.5 pr-1">
                  {monthList.map((h: any) => (
                    <div key={h.id} className="flex items-center justify-between py-2 px-4 bg-red-50/60 rounded-full text-sm border border-red-100/50">
                      <span className="text-[13px]">
                        <span className="font-medium text-[#1B1B1B]">{h.holiday_date}</span>
                        <span className="text-muted-foreground ml-2">{h.early_close_hour ? `${t('Đóng cửa lúc')} ${h.early_close_hour}:00` : t('Nghỉ cả ngày')}</span>
                      </span>
                      <AdminOnlyButton className="h-7 w-7 rounded-full text-muted-foreground/40 hover:text-destructive" onClick={() => openConfirm(t('Xoá ngày nghỉ'), t('Xoá ngày nghỉ tiệm này?'), () => { removeHoliday.mutate(h.id); if (selectedDate && format(selectedDate, 'yyyy-MM-dd') === h.holiday_date) setSelectedDate(undefined); })}>
                        <X className="h-3.5 w-3.5" />
                      </AdminOnlyButton>
                    </div>
                  ))}
                </div>
              </div>
            );
          })() : (() => {
            const monthList = unavailabilities
              .filter((u: any) => effectiveTherapistId === 'all' || u.therapist_id === effectiveTherapistId)
              .slice()
              .sort((a: any, b: any) => a.unavailable_date.localeCompare(b.unavailable_date));
            if (!monthList.length) return null;
            return (
              <div className="border-t border-[#E5E5E5]/30 pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t('Ngày nghỉ')} ({monthList.length})</p>
                <div className="space-y-1.5 pr-1">
                  {monthList.map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between py-2 px-4 bg-red-50/60 rounded-full text-sm border border-red-100/50">
                      <span className="text-[13px]">
                        <span className="font-medium text-[#1B1B1B]">{format(new Date(`${u.unavailable_date}T00:00:00`), 'dd/MM/yyyy')}</span>
                        {effectiveTherapistId === 'all' && <span className="text-muted-foreground ml-2">{u.therapists?.name}</span>}
                        {u.reason && <span className="text-muted-foreground ml-2">{u.reason}</span>}
                      </span>
                      <AdminOnlyButton className="h-7 w-7 rounded-full text-muted-foreground/40 hover:text-destructive" onClick={() => openConfirm(t('Xoá ngày nghỉ'), t('Xoá ngày nghỉ này?'), () => { removeUnavailability.mutate(u.id); if (selectedDate && format(selectedDate, 'yyyy-MM-dd') === u.unavailable_date) setSelectedDate(undefined); })}>
                        <X className="h-3.5 w-3.5" />
                      </AdminOnlyButton>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
