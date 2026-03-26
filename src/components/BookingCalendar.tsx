import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  services?: { name: string } | null;
  therapists?: { name: string } | null;
}

interface BookingCalendarProps {
  bookings: Booking[];
  onCancel: (id: string) => void;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function BookingCalendar({ bookings, onCancel }: BookingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const bookingsByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    bookings?.forEach(b => {
      if (!map[b.booking_date]) map[b.booking_date] = [];
      map[b.booking_date].push(b);
    });
    return map;
  }, [bookings]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: Date[] = [];
    let day = calStart;
    while (day <= calEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const selectedBookings = selectedDate
    ? bookingsByDate[format(selectedDate, 'yyyy-MM-dd')] || []
    : [];

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    const dateStr = format(day, 'yyyy-MM-dd');
    if (bookingsByDate[dateStr]?.length) {
      setDialogOpen(true);
    }
  };

  const statusColor = (status: string) => {
    if (status === 'confirmed') return 'bg-primary';
    if (status === 'cancelled') return 'bg-destructive';
    return 'bg-muted-foreground';
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = { confirmed: 'Đã xác nhận', cancelled: 'Đã huỷ', completed: 'Hoàn thành' };
    return map[status] || status;
  };

  return (
    <div>
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h3 className="text-lg font-semibold font-serif capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: vi })}
        </h3>
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, i) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayBookings = bookingsByDate[dateStr] || [];
          const confirmedCount = dayBookings.filter(b => b.status === 'confirmed').length;
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());
          const isSelected = selectedDate && isSameDay(day, selectedDate);

          return (
            <button
              key={i}
              onClick={() => handleDayClick(day)}
              className={cn(
                "relative min-h-[80px] p-1.5 rounded-lg border text-left transition-all hover:border-primary/50",
                !isCurrentMonth && "opacity-40",
                isToday && "border-primary bg-primary/5",
                isSelected && "ring-2 ring-primary ring-offset-1",
                dayBookings.length > 0 && "cursor-pointer"
              )}
            >
              <span className={cn(
                "text-sm font-medium",
                isToday && "text-primary"
              )}>
                {format(day, 'd')}
              </span>

              {/* Booking indicators */}
              {dayBookings.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {dayBookings.slice(0, 3).map((b, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "text-[10px] leading-tight px-1 py-0.5 rounded truncate text-primary-foreground",
                        statusColor(b.status)
                      )}
                    >
                      {b.start_time?.slice(0, 5)} {b.customer_name?.split(' ').pop()}
                    </div>
                  ))}
                  {dayBookings.length > 3 && (
                    <div className="text-[10px] text-muted-foreground px-1">
                      +{dayBookings.length - 3} khác
                    </div>
                  )}
                </div>
              )}

              {/* Count badge */}
              {confirmedCount > 0 && (
                <div className="absolute top-1 right-1">
                  <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">
                    {confirmedCount}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Booking Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Lịch hẹn ngày {selectedDate && format(selectedDate, 'dd/MM/yyyy')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {selectedBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Không có lịch hẹn</p>
            ) : (
              selectedBookings.map(b => (
                <div key={b.id} className={cn(
                  "rounded-lg border p-3 space-y-2",
                  b.status === 'cancelled' && "opacity-60"
                )}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">
                      {b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}
                    </span>
                    <Badge variant={
                      b.status === 'confirmed' ? 'default' :
                      b.status === 'cancelled' ? 'destructive' : 'secondary'
                    }>
                      {statusLabel(b.status)}
                    </Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Khách:</span> {b.customer_name}</p>
                    <p><span className="text-muted-foreground">SĐT:</span> {b.customer_phone}</p>
                    <p><span className="text-muted-foreground">Dịch vụ:</span> {b.services?.name}</p>
                    <p><span className="text-muted-foreground">Thợ:</span> {b.therapists?.name}</p>
                  </div>
                  {b.status === 'confirmed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-destructive hover:text-destructive"
                      onClick={() => onCancel(b.id)}
                    >
                      Huỷ lịch hẹn
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
