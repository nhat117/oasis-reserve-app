import { useState, useMemo, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventClickArg, EventDropArg, DateSelectArg, MoreLinkArg } from '@fullcalendar/core';
import { format } from 'date-fns';
import { vi as viLocale, enAU as enLocale } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/hooks/useI18n';

export interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  service_id: string;
  therapist_id: string;
  services?: { name: string } | null;
  therapists?: { name: string } | null;
  booking_services?: Array<{ service_id: string | null; service_name: string; duration_minutes: number; price: number }> | null;
  // Payment fields (available after migration)
  payment_status?: string | null;
  payment_provider?: string | null;
  payment_intent_id?: string | null;
  total_amount?: number | null;
}

export function serviceLabel(b: Booking): string {
  if (b.booking_services && b.booking_services.length > 0) {
    return b.booking_services.map(s => s.service_name).join(' + ');
  }
  return b.services?.name || '';
}

export interface ShopHoliday {
  holiday_date: string;
  early_close_hour?: number | null;
  reason?: string | null;
}

interface BookingCalendarProps {
  bookings: Booking[];
  holidays?: ShopHoliday[];
  onCancel: (id: string) => void;
  onDelete?: (id: string) => void;
  onRefund?: (id: string) => void;
  onMarkCompleted?: (id: string) => void;
  onMarkNoShow?: (id: string) => void;
  onReschedule: (id: string, newDate: string, newStartTime: string, newEndTime: string) => void;
  onDateSelect?: (date: string, startTime?: string) => void;
  onEdit?: (booking: Booking) => void;
}

const THERAPIST_COLORS = [
  '#3b82f6', '#f43f5e', '#10b981', '#f59e0b',
  '#8b5cf6', '#06b6d4', '#ec4899', '#f97316',
];

export function BookingCalendar({ bookings, holidays = [], onCancel, onDelete, onRefund, onMarkCompleted, onMarkNoShow, onReschedule, onDateSelect, onEdit }: BookingCalendarProps) {
  const { t, lang } = useI18n();
  const calendarRef = useRef<FullCalendar>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dayDrawerDate, setDayDrawerDate] = useState<Date | null>(null);
  const [dayDrawerOpen, setDayDrawerOpen] = useState(false);

  const statusLabel = (status: string) => {
    const map: Record<string, string> = { confirmed: t('Đã xác nhận'), cancelled: t('Đã huỷ'), completed: t('Hoàn thành'), no_show: t('Không đến') };
    return map[status] || status;
  };

  const statusVariant = (status: string): 'default' | 'destructive' | 'outline' | 'secondary' =>
    status === 'confirmed' ? 'default' : status === 'cancelled' ? 'destructive' : status === 'no_show' ? 'outline' : 'secondary';

  // Build therapist color map
  const therapistColorMap = useMemo(() => {
    const ids = [...new Set(bookings.map(b => b.therapist_id))];
    const map: Record<string, string> = {};
    ids.forEach((id, i) => { map[id] = THERAPIST_COLORS[i % THERAPIST_COLORS.length]; });
    return map;
  }, [bookings]);

  // Convert bookings to FullCalendar events
  const bookingEvents = useMemo(() => {
    return bookings.map(b => {
      const color = therapistColorMap[b.therapist_id] || THERAPIST_COLORS[0];
      const isCancelled = b.status === 'cancelled';
      return {
        id: b.id,
        title: `${b.customer_name} · ${serviceLabel(b)}`,
        start: `${b.booking_date}T${b.start_time}`,
        end: `${b.booking_date}T${b.end_time}`,
        backgroundColor: isCancelled ? '#9ca3af' : color,
        borderColor: isCancelled ? '#6b7280' : color,
        textColor: '#ffffff',
        editable: !isCancelled,
        classNames: isCancelled ? ['opacity-50', 'line-through'] : [],
        extendedProps: { booking: b },
      };
    });
  }, [bookings, therapistColorMap]);

  // Shop closed / early-close days shown as all-day markers
  const holidayEvents = useMemo(() => {
    return holidays.map(h => {
      const isFullDayOff = !h.early_close_hour;
      return {
        id: `holiday-${h.holiday_date}`,
        title: isFullDayOff ? t('Nghỉ cả ngày') : `${t('Đóng cửa lúc')} ${h.early_close_hour}:00`,
        start: h.holiday_date,
        allDay: true,
        display: 'list-item',
        editable: false,
        color: isFullDayOff ? '#ef4444' : '#f59e0b',
        extendedProps: { isHoliday: true },
      };
    });
  }, [holidays, t]);

  const events = useMemo(() => [...holidayEvents, ...bookingEvents], [holidayEvents, bookingEvents]);

  // Handle event drop (drag and drop reschedule)
  const handleEventDrop = (info: EventDropArg) => {
    const booking = info.event.extendedProps.booking as Booking;
    if (booking.status !== 'confirmed') {
      info.revert();
      return;
    }
    const newStart = info.event.start;
    const newEnd = info.event.end;
    if (!newStart || !newEnd) { info.revert(); return; }

    const newDate = format(newStart, 'yyyy-MM-dd');
    const newStartTime = format(newStart, 'HH:mm:ss');
    const newEndTime = format(newEnd, 'HH:mm:ss');

    onReschedule(booking.id, newDate, newStartTime, newEndTime);
  };

  // Handle event click
  const handleEventClick = (info: EventClickArg) => {
    if (info.event.extendedProps.isHoliday) return;
    const booking = info.event.extendedProps.booking as Booking;
    setSelectedBooking(booking);
    setDialogOpen(true);
  };

  // Handle date/time selection (click on empty slot)
  const handleDateSelect = (info: DateSelectArg) => {
    if (!onDateSelect) return;
    const dateStr = format(info.start, 'yyyy-MM-dd');
    // If in time grid, also pass the start time
    if (info.view.type.includes('timeGrid')) {
      const timeStr = format(info.start, 'HH:mm');
      onDateSelect(dateStr, timeStr);
    } else {
      onDateSelect(dateStr);
    }
    const calApi = calendarRef.current?.getApi();
    calApi?.unselect();
  };

  // Bookings for the day drawer, sorted by start time
  const dayDrawerBookings = useMemo(() => {
    if (!dayDrawerDate) return [];
    const dateStr = format(dayDrawerDate, 'yyyy-MM-dd');
    return bookings
      .filter(b => b.booking_date === dateStr)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [bookings, dayDrawerDate]);

  const openDayDrawer = (date: Date) => {
    setDayDrawerDate(date);
    setDayDrawerOpen(true);
  };

  // "+N more" link click — open the day drawer instead of FullCalendar's built-in popover
  const handleMoreLinkClick = (info: MoreLinkArg) => {
    openDayDrawer(info.date);
    return 'popover-disabled';
  };

  const handleDayDrawerBookingClick = (booking: Booking) => {
    setDayDrawerOpen(false);
    setSelectedBooking(booking);
    setDialogOpen(true);
  };

  const handleDayDrawerNewBooking = () => {
    if (!dayDrawerDate || !onDateSelect) return;
    setDayDrawerOpen(false);
    onDateSelect(format(dayDrawerDate, 'yyyy-MM-dd'));
  };

  // Legend
  const uniqueTherapists = useMemo(() => {
    return [...new Map(
      bookings.filter(b => b.status !== 'cancelled').map(b => [b.therapist_id, b])
    ).values()];
  }, [bookings]);

  return (
    <div>
      {/* Legend */}
      {uniqueTherapists.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {uniqueTherapists.map(b => (
            <div key={b.therapist_id} className="flex items-center gap-1.5 text-xs">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: therapistColorMap[b.therapist_id] }} />
              <span>{b.therapists?.name || 'N/A'}</span>
            </div>
          ))}
        </div>
      )}

      {/* FullCalendar */}
      <div className="fc-custom">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          locale={lang === 'vi' ? 'vi' : 'en-au'}
          events={events}
          editable={true}
          selectable={true}
          selectMirror={true}
          select={handleDateSelect}
          droppable={true}
          eventDrop={handleEventDrop}
          eventClick={handleEventClick}
          slotMinTime="09:00:00"
          slotMaxTime="19:00:00"
          slotDuration="00:15:00"
          snapDuration="00:15:00"
          allDaySlot={false}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          height="calc(100vh - 280px)"
          dayMaxEvents={3}
          moreLinkClick={handleMoreLinkClick}
          nowIndicator={true}
          eventResizableFromStart={false}
          buttonText={{
            today: t('Hôm nay'),
            month: t('Tháng'),
            week: t('Tuần'),
            day: t('Ngày'),
          }}
        />
      </div>

      {/* Booking Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader><DialogTitle>{t('Chi tiết lịch hẹn')}</DialogTitle></DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{selectedBooking.start_time?.slice(0, 5)} – {selectedBooking.end_time?.slice(0, 5)}</span>
                <Badge variant={selectedBooking.status === 'confirmed' ? 'default' : selectedBooking.status === 'cancelled' ? 'destructive' : selectedBooking.status === 'no_show' ? 'outline' : 'secondary'}>
                  {statusLabel(selectedBooking.status)}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: therapistColorMap[selectedBooking.therapist_id] }} />
                <span className="text-sm font-medium">{selectedBooking.therapists?.name}</span>
              </div>
              <div className="bg-muted rounded-lg p-3 space-y-1.5 text-sm">
                <p><span className="text-muted-foreground">{t('Ngày')}:</span> {selectedBooking.booking_date}</p>
                <p><span className="text-muted-foreground">{t('Khách')}:</span> {selectedBooking.customer_name}</p>
                <p><span className="text-muted-foreground">{t('SĐT')}:</span> {selectedBooking.customer_phone}</p>
                <p><span className="text-muted-foreground">{t('Dịch vụ')}:</span> {serviceLabel(selectedBooking)}</p>
                {selectedBooking.payment_status && selectedBooking.payment_status !== 'unpaid' && (
                  <p>
                    <span className="text-muted-foreground">{t('Thanh toán')}:</span>{' '}
                    <Badge variant={
                      selectedBooking.payment_status === 'paid' ? 'default' :
                      selectedBooking.payment_status === 'refunded' ? 'secondary' :
                      selectedBooking.payment_status === 'pending' ? 'outline' : 'destructive'
                    } className="text-[10px] ml-1">
                      {selectedBooking.payment_status === 'paid' ? t('Đã thanh toán') :
                       selectedBooking.payment_status === 'refunded' ? t('Đã hoàn tiền') :
                       selectedBooking.payment_status === 'pending' ? t('Đang chờ') :
                       selectedBooking.payment_status === 'failed' ? t('Thất bại') :
                       selectedBooking.payment_status}
                    </Badge>
                    {selectedBooking.payment_provider && (
                      <span className="text-muted-foreground text-xs ml-1">({selectedBooking.payment_provider})</span>
                    )}
                  </p>
                )}
              </div>
              {selectedBooking.status === 'confirmed' && (
                <div className="space-y-2">
                  {onEdit && (
                    <Button variant="outline" size="sm" className="w-full gap-1.5"
                      onClick={() => { onEdit(selectedBooking); setDialogOpen(false); }}>
                      <Pencil className="h-3.5 w-3.5" /> {t('Sửa lịch hẹn')}
                    </Button>
                  )}
                  <div className="flex gap-2">
                    {onMarkCompleted && (
                      <Button variant="default" size="sm" className="flex-1"
                        onClick={() => { onMarkCompleted(selectedBooking.id); setDialogOpen(false); }}>
                        {t('Hoàn thành')}
                      </Button>
                    )}
                    {onMarkNoShow && (
                      <Button variant="outline" size="sm" className="flex-1 text-amber-600 hover:text-amber-700 border-amber-300 hover:border-amber-400"
                        onClick={() => { onMarkNoShow(selectedBooking.id); setDialogOpen(false); }}>
                        {t('Không đến')}
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive"
                      onClick={() => { onCancel(selectedBooking.id); setDialogOpen(false); }}>
                      {t('Huỷ lịch hẹn')}
                    </Button>
                    {onDelete && (
                      <Button variant="destructive" size="sm" className="flex-1"
                        onClick={() => { onDelete(selectedBooking.id); setDialogOpen(false); }}>
                        {t('Xoá')}
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {/* Refund button for paid Stripe bookings */}
              {selectedBooking.payment_status === 'paid' && selectedBooking.payment_provider === 'stripe' && onRefund && (
                <Button variant="outline" size="sm" className="w-full text-amber-600 hover:text-amber-700 border-amber-300 hover:border-amber-400"
                  onClick={() => { onRefund(selectedBooking.id); setDialogOpen(false); }}>
                  {t('Hoàn tiền qua Stripe')}
                </Button>
              )}
              {selectedBooking.status === 'cancelled' && onDelete && (
                <Button variant="destructive" size="sm" className="w-full"
                  onClick={() => { onDelete(selectedBooking.id); setDialogOpen(false); }}>
                  {t('Xoá lịch hẹn')}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Day Drawer — full appointment list for a day, replaces FullCalendar's built-in "+N more" popover */}
      <Sheet open={dayDrawerOpen} onOpenChange={setDayDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[400px] p-0 flex flex-col">
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle>
              {dayDrawerDate && format(dayDrawerDate, 'EEEE, d MMMM yyyy', { locale: lang === 'vi' ? viLocale : enLocale })}
            </SheetTitle>
            <p className="text-sm text-muted-foreground">
              {dayDrawerBookings.length} {t('lịch hẹn')}
            </p>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {dayDrawerBookings.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">{t('Không có lịch hẹn')}</p>
              )}
              {dayDrawerBookings.map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleDayDrawerBookingClick(b)}
                  className={cn(
                    'w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60',
                    b.status === 'cancelled' && 'opacity-60',
                  )}
                >
                  <span className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: therapistColorMap[b.therapist_id] }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}</span>
                      <Badge variant={statusVariant(b.status)} className="text-[10px]">{statusLabel(b.status)}</Badge>
                    </div>
                    <p className={cn('text-sm font-medium truncate', b.status === 'cancelled' && 'line-through')}>{b.customer_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{serviceLabel(b)} · {b.therapists?.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>

          {onDateSelect && (
            <div className="p-4 border-t">
              <Button className="w-full" onClick={handleDayDrawerNewBooking}>
                <Plus className="h-4 w-4 mr-1.5" />
                {t('Tạo lịch hẹn mới')}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
