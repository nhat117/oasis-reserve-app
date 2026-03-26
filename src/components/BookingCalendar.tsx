import { useState, useMemo } from 'react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, subDays, isSameMonth, isSameDay, addMonths, subMonths,
  addWeeks, subWeeks
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Columns3, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

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

type ViewMode = 'month' | 'week' | 'day';

interface BookingCalendarProps {
  bookings: Booking[];
  onCancel: (id: string) => void;
  onReschedule: (id: string, newDate: string, newStartTime: string, newEndTime: string) => void;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const HOURS = Array.from({ length: 10 }, (_, i) => i + 9);

// Distinct colors for therapists
const THERAPIST_COLORS = [
  { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-600' },
  { bg: 'bg-rose-500', text: 'text-white', border: 'border-rose-600' },
  { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600' },
  { bg: 'bg-amber-500', text: 'text-white', border: 'border-amber-600' },
  { bg: 'bg-violet-500', text: 'text-white', border: 'border-violet-600' },
  { bg: 'bg-cyan-500', text: 'text-white', border: 'border-cyan-600' },
  { bg: 'bg-pink-500', text: 'text-white', border: 'border-pink-600' },
  { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-600' },
];

const CANCELLED_STYLE = 'bg-muted text-muted-foreground line-through opacity-60';

const statusLabel = (status: string) => {
  const map: Record<string, string> = { confirmed: 'Đã xác nhận', cancelled: 'Đã huỷ', completed: 'Hoàn thành' };
  return map[status] || status;
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

// Compute overlap columns for bookings (Google Calendar style)
interface LayoutedBooking extends Booking {
  col: number;
  totalCols: number;
}

function layoutOverlappingBookings(bookings: Booking[]): LayoutedBooking[] {
  if (bookings.length === 0) return [];
  const sorted = [...bookings].sort((a, b) => a.start_time.localeCompare(b.start_time) || a.end_time.localeCompare(b.end_time));
  const result: LayoutedBooking[] = [];
  const groups: Booking[][] = [];

  // Group overlapping bookings
  let currentGroup: Booking[] = [sorted[0]];
  let groupEnd = timeToMinutes(sorted[0].end_time);

  for (let i = 1; i < sorted.length; i++) {
    const bStart = timeToMinutes(sorted[i].start_time);
    if (bStart < groupEnd) {
      currentGroup.push(sorted[i]);
      groupEnd = Math.max(groupEnd, timeToMinutes(sorted[i].end_time));
    } else {
      groups.push(currentGroup);
      currentGroup = [sorted[i]];
      groupEnd = timeToMinutes(sorted[i].end_time);
    }
  }
  groups.push(currentGroup);

  // Assign columns within each group
  for (const group of groups) {
    const columns: number[] = []; // end times per column
    const assignments: { booking: Booking; col: number }[] = [];
    for (const b of group) {
      const bStart = timeToMinutes(b.start_time);
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        if (bStart >= columns[c]) {
          columns[c] = timeToMinutes(b.end_time);
          assignments.push({ booking: b, col: c });
          placed = true;
          break;
        }
      }
      if (!placed) {
        assignments.push({ booking: b, col: columns.length });
        columns.push(timeToMinutes(b.end_time));
      }
    }
    const totalCols = columns.length;
    for (const a of assignments) {
      result.push({ ...a.booking, col: a.col, totalCols });
    }
  }
  return result;
}

export function BookingCalendar({ bookings, onCancel, onReschedule }: BookingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dragBooking, setDragBooking] = useState<Booking | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  // Build therapist → color map
  const therapistColorMap = useMemo(() => {
    const ids = [...new Set(bookings.map(b => b.therapist_id))];
    const map: Record<string, typeof THERAPIST_COLORS[0]> = {};
    ids.forEach((id, i) => { map[id] = THERAPIST_COLORS[i % THERAPIST_COLORS.length]; });
    return map;
  }, [bookings]);

  const getBookingStyle = (b: Booking) => {
    if (b.status === 'cancelled') return CANCELLED_STYLE;
    const color = therapistColorMap[b.therapist_id] || THERAPIST_COLORS[0];
    return `${color.bg} ${color.text}`;
  };

  const bookingsByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    bookings?.forEach(b => {
      if (!map[b.booking_date]) map[b.booking_date] = [];
      map[b.booking_date].push(b);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.start_time.localeCompare(b.start_time)));
    return map;
  }, [bookings]);

  const navigate = (dir: number) => {
    if (viewMode === 'month') setCurrentDate(d => dir > 0 ? addMonths(d, 1) : subMonths(d, 1));
    else if (viewMode === 'week') setCurrentDate(d => dir > 0 ? addWeeks(d, 1) : subWeeks(d, 1));
    else setCurrentDate(d => dir > 0 ? addDays(d, 1) : subDays(d, 1));
  };

  const headerLabel = () => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy', { locale: vi });
    if (viewMode === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      const we = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(ws, 'dd/MM')} – ${format(we, 'dd/MM/yyyy')}`;
    }
    return format(currentDate, 'EEEE, dd/MM/yyyy', { locale: vi });
  };

  const handleDragStart = (e: React.DragEvent, booking: Booking) => {
    if (booking.status !== 'confirmed') return;
    setDragBooking(booking);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', booking.id);
  };

  const handleDragOver = (e: React.DragEvent, slotKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSlot(slotKey);
  };

  const handleDragLeave = () => { setDragOverSlot(null); };

  const handleDrop = (e: React.DragEvent, date: string, hour?: number) => {
    e.preventDefault();
    setDragOverSlot(null);
    if (!dragBooking || dragBooking.status !== 'confirmed') return;
    const duration = timeToMinutes(dragBooking.end_time) - timeToMinutes(dragBooking.start_time);
    const newStartMins = hour !== undefined ? hour * 60 : timeToMinutes(dragBooking.start_time);
    const newEndMins = newStartMins + duration;
    if (newEndMins > 18 * 60) return;
    onReschedule(dragBooking.id, date, minutesToTime(newStartMins), minutesToTime(newEndMins));
    setDragBooking(null);
  };

  const handleDragEnd = () => { setDragBooking(null); setDragOverSlot(null); };
  const openBookingDetail = (booking: Booking) => { setSelectedBooking(booking); setDialogOpen(true); };

  // Legend
  const Legend = () => {
    const uniqueTherapists = [...new Map(bookings.filter(b => b.status !== 'cancelled').map(b => [b.therapist_id, b])).values()];
    if (uniqueTherapists.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2 mb-4">
        {uniqueTherapists.map(b => {
          const color = therapistColorMap[b.therapist_id];
          return (
            <div key={b.therapist_id} className="flex items-center gap-1.5 text-xs">
              <span className={cn("w-3 h-3 rounded-sm", color?.bg)} />
              <span>{b.therapists?.name || 'N/A'}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // ============ MONTH VIEW ============
  const MonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days: Date[] = [];
    let day = calStart;
    while (day <= calEnd) { days.push(day); day = addDays(day, 1); }

    return (
      <>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map(d => <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayBookings = bookingsByDate[dateStr] || [];
            const confirmedCount = dayBookings.filter(b => b.status === 'confirmed').length;
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());
            const slotKey = `month-${dateStr}`;
            return (
              <div key={i} className={cn(
                "relative min-h-[80px] p-1.5 rounded-lg border text-left transition-all cursor-pointer",
                !isCurrentMonth && "opacity-40", isToday && "border-primary bg-primary/5",
                dragOverSlot === slotKey && "ring-2 ring-primary bg-primary/10"
              )} onClick={() => { setCurrentDate(day); setViewMode('day'); }}
                onDragOver={(e) => handleDragOver(e, slotKey)} onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, dateStr)}
              >
                <span className={cn("text-sm font-medium", isToday && "text-primary")}>{format(day, 'd')}</span>
                {dayBookings.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {dayBookings.slice(0, 3).map((b, idx) => (
                      <div key={idx} draggable={b.status === 'confirmed'}
                        onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, b); }}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => { e.stopPropagation(); openBookingDetail(b); }}
                        className={cn("text-[10px] leading-tight px-1 py-0.5 rounded truncate cursor-grab active:cursor-grabbing",
                          getBookingStyle(b), dragBooking?.id === b.id && "opacity-50"
                        )}
                      >
                        {b.start_time?.slice(0, 5)} {b.customer_name?.split(' ').pop()}
                      </div>
                    ))}
                    {dayBookings.length > 3 && <div className="text-[10px] text-muted-foreground px-1">+{dayBookings.length - 3} khác</div>}
                  </div>
                )}
                {confirmedCount > 0 && (
                  <div className="absolute top-1 right-1">
                    <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">{confirmedCount}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  // ============ WEEK VIEW ============
  const WeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    return (
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-0 border-b">
            <div className="p-2 text-xs text-muted-foreground">Giờ</div>
            {days.map((day, i) => (
              <div key={i} className={cn("p-2 text-center border-l cursor-pointer hover:bg-muted/50", isSameDay(day, new Date()) && "bg-primary/5")}
                onClick={() => { setCurrentDate(day); setViewMode('day'); }}>
                <div className="text-xs text-muted-foreground">{WEEKDAYS[i]}</div>
                <div className={cn("text-sm font-semibold", isSameDay(day, new Date()) && "text-primary")}>{format(day, 'd')}</div>
              </div>
            ))}
          </div>
          {HOURS.map(hour => (
            <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] gap-0 border-b min-h-[60px]">
              <div className="p-1 text-xs text-muted-foreground text-right pr-2 pt-1">{String(hour).padStart(2, '0')}:00</div>
              {days.map((day, di) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const slotKey = `week-${dateStr}-${hour}`;
                const slotBookings = (bookingsByDate[dateStr] || []).filter(b => parseInt(b.start_time) === hour);
                return (
                  <div key={di} className={cn("border-l p-0.5 relative transition-colors", dragOverSlot === slotKey && "bg-primary/10")}
                    onDragOver={(e) => handleDragOver(e, slotKey)} onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, dateStr, hour)}>
                    {slotBookings.map(b => {
                      const durationMins = timeToMinutes(b.end_time) - timeToMinutes(b.start_time);
                      const heightPx = Math.max(20, (durationMins / 60) * 56);
                      return (
                        <div key={b.id} draggable={b.status === 'confirmed'}
                          onDragStart={(e) => handleDragStart(e, b)} onDragEnd={handleDragEnd}
                          onClick={() => openBookingDetail(b)}
                          className={cn("text-[10px] leading-tight px-1.5 py-1 rounded cursor-grab active:cursor-grabbing mb-0.5",
                            getBookingStyle(b), dragBooking?.id === b.id && "opacity-50")}
                          style={{ minHeight: `${heightPx}px` }}>
                          <div className="font-medium">{b.start_time?.slice(0, 5)}–{b.end_time?.slice(0, 5)}</div>
                          <div className="truncate">{b.customer_name}</div>
                          <div className="truncate opacity-80">{b.services?.name}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ============ DAY VIEW ============
  const DayView = () => {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const dayBookings = bookingsByDate[dateStr] || [];
    return (
      <div>
        <div className="mb-4 text-center">
          <p className="text-sm text-muted-foreground">{dayBookings.filter(b => b.status === 'confirmed').length} lịch hẹn</p>
        </div>
        <div className="space-y-0">
          {HOURS.map(hour => {
            const slotKey = `day-${dateStr}-${hour}`;
            const hourBookings = dayBookings.filter(b => parseInt(b.start_time) === hour);
            return (
              <div key={hour} className={cn("flex border-b min-h-[70px] transition-colors", dragOverSlot === slotKey && "bg-primary/10")}
                onDragOver={(e) => handleDragOver(e, slotKey)} onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, dateStr, hour)}>
                <div className="w-16 shrink-0 p-2 text-sm text-muted-foreground text-right pr-3 pt-2 border-r">{String(hour).padStart(2, '0')}:00</div>
                <div className="flex-1 p-1 space-y-1">
                  {hourBookings.map(b => {
                    const durationMins = timeToMinutes(b.end_time) - timeToMinutes(b.start_time);
                    return (
                      <div key={b.id} draggable={b.status === 'confirmed'}
                        onDragStart={(e) => handleDragStart(e, b)} onDragEnd={handleDragEnd}
                        onClick={() => openBookingDetail(b)}
                        className={cn("rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing transition-opacity",
                          getBookingStyle(b), dragBooking?.id === b.id && "opacity-50")}>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}</span>
                          <span className="text-xs opacity-80">{durationMins} phút</span>
                        </div>
                        <div className="text-sm mt-0.5">{b.customer_name} · {b.customer_phone}</div>
                        <div className="text-xs opacity-80 mt-0.5">{b.services?.name} · {b.therapists?.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-5 w-5" /></Button>
          <h3 className="text-lg font-semibold font-serif capitalize min-w-[180px] text-center">{headerLabel()}</h3>
          <Button variant="ghost" size="icon" onClick={() => navigate(1)}><ChevronRight className="h-5 w-5" /></Button>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button variant={viewMode === 'month' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('month')} className="gap-1">
            <CalIcon className="h-3.5 w-3.5" /><span className="hidden sm:inline">Tháng</span>
          </Button>
          <Button variant={viewMode === 'week' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('week')} className="gap-1">
            <Columns3 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Tuần</span>
          </Button>
          <Button variant={viewMode === 'day' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('day')} className="gap-1">
            <Clock className="h-3.5 w-3.5" /><span className="hidden sm:inline">Ngày</span>
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Hôm nay</Button>
      </div>

      {/* Legend */}
      <Legend />

      {/* Views */}
      {viewMode === 'month' && <MonthView />}
      {viewMode === 'week' && <WeekView />}
      {viewMode === 'day' && <DayView />}

      {/* Booking Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Chi tiết lịch hẹn</DialogTitle></DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{selectedBooking.start_time?.slice(0, 5)} – {selectedBooking.end_time?.slice(0, 5)}</span>
                <Badge variant={selectedBooking.status === 'confirmed' ? 'default' : selectedBooking.status === 'cancelled' ? 'destructive' : 'secondary'}>
                  {statusLabel(selectedBooking.status)}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("w-3 h-3 rounded-sm", therapistColorMap[selectedBooking.therapist_id]?.bg)} />
                <span className="text-sm font-medium">{selectedBooking.therapists?.name}</span>
              </div>
              <div className="bg-muted rounded-lg p-3 space-y-1.5 text-sm">
                <p><span className="text-muted-foreground">Ngày:</span> {selectedBooking.booking_date}</p>
                <p><span className="text-muted-foreground">Khách:</span> {selectedBooking.customer_name}</p>
                <p><span className="text-muted-foreground">SĐT:</span> {selectedBooking.customer_phone}</p>
                <p><span className="text-muted-foreground">Dịch vụ:</span> {selectedBooking.services?.name}</p>
              </div>
              {selectedBooking.status === 'confirmed' && (
                <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive"
                  onClick={() => { onCancel(selectedBooking.id); setDialogOpen(false); }}>
                  Huỷ lịch hẹn
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
