import { useState, useMemo, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventClickArg, EventDropArg, DateSelectArg } from '@fullcalendar/core';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
}

interface BookingCalendarProps {
  bookings: Booking[];
  onCancel: (id: string) => void;
  onDelete?: (id: string) => void;
  onReschedule: (id: string, newDate: string, newStartTime: string, newEndTime: string) => void;
  onDateSelect?: (date: string, startTime?: string) => void;
}

const THERAPIST_COLORS = [
  '#3b82f6', '#f43f5e', '#10b981', '#f59e0b',
  '#8b5cf6', '#06b6d4', '#ec4899', '#f97316',
];

export function BookingCalendar({ bookings, onCancel, onDelete, onReschedule, onDateSelect }: BookingCalendarProps) {
  const { t, lang } = useI18n();
  const calendarRef = useRef<FullCalendar>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const statusLabel = (status: string) => {
    const map: Record<string, string> = { confirmed: t('Đã xác nhận'), cancelled: t('Đã huỷ'), completed: t('Hoàn thành') };
    return map[status] || status;
  };

  // Build therapist color map
  const therapistColorMap = useMemo(() => {
    const ids = [...new Set(bookings.map(b => b.therapist_id))];
    const map: Record<string, string> = {};
    ids.forEach((id, i) => { map[id] = THERAPIST_COLORS[i % THERAPIST_COLORS.length]; });
    return map;
  }, [bookings]);

  // Convert bookings to FullCalendar events
  const events = useMemo(() => {
    return bookings.map(b => {
      const color = therapistColorMap[b.therapist_id] || THERAPIST_COLORS[0];
      const isCancelled = b.status === 'cancelled';
      return {
        id: b.id,
        title: `${b.customer_name} · ${b.services?.name || ''}`,
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
          height="auto"
          dayMaxEvents={3}
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
                <Badge variant={selectedBooking.status === 'confirmed' ? 'default' : selectedBooking.status === 'cancelled' ? 'destructive' : 'secondary'}>
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
                <p><span className="text-muted-foreground">{t('Dịch vụ')}:</span> {selectedBooking.services?.name}</p>
              </div>
              {selectedBooking.status === 'confirmed' && (
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
    </div>
  );
}
