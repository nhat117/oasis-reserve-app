import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, TrendingUp, DollarSign, Clock, CalendarCheck, Users, CalendarIcon } from 'lucide-react';
import { format, subDays, addDays, startOfMonth, endOfMonth, differenceInDays, eachDayOfInterval } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';

interface StatsProps {
  className?: string;
}

type DateRange = { from: Date; to: Date };

const PRESET_RANGES = [
  { key: '7d', label: '7 ngày qua', days: 7 },
  { key: '14d', label: '14 ngày qua', days: 14 },
  { key: '30d', label: '30 ngày qua', days: 30 },
  { key: '90d', label: '90 ngày qua', days: 90 },
] as const;

export function BookingStats({ className }: StatsProps) {
  const { t } = useI18n();
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const [rangePreset, setRangePreset] = useState<string>('7d');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const dateRange: DateRange = useMemo(() => {
    if (rangePreset === 'custom' && customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    const preset = PRESET_RANGES.find(r => r.key === rangePreset) || PRESET_RANGES[0];
    return { from: subDays(today, preset.days - 1), to: today };
  }, [rangePreset, customFrom, customTo]);

  const rangeDays = differenceInDays(dateRange.to, dateRange.from) + 1;

  const { data: bookings } = useQuery({
    queryKey: ['stats-bookings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('bookings')
        .select('*, services(name, price, duration_minutes), therapists(name)')
        .order('booking_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: sales } = useQuery({
    queryKey: ['stats-sales'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sales')
        .select('*')
        .order('sale_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const formatPrice = (p: number) => `A$ ${p.toLocaleString()}`;

  const stats = useMemo(() => {
    if (!bookings) return null;

    const confirmed = bookings.filter(b => b.status === 'confirmed');
    const completed = bookings.filter(b => b.status === 'completed');
    const active = [...confirmed, ...completed];

    // ── Date range filtered bookings ──
    const fromStr = format(dateRange.from, 'yyyy-MM-dd');
    const toStr = format(dateRange.to, 'yyyy-MM-dd');
    const rangeBookings = active.filter(b => b.booking_date >= fromStr && b.booking_date <= toStr);

    // ── Sales revenue (from actual sales table) ──
    const rangeSales = (sales || []).filter(s => s.sale_date >= fromStr && s.sale_date <= toStr);
    const rangeRevenue = rangeSales.reduce((s, sale) => s + Number(sale.amount), 0);
    const rangeBookingValue = rangeBookings.reduce((s, b) => s + ((b as any).services?.price || 0), 0);

    // Chart data for range
    const allDays = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    const chartData = allDays.map(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayLabel = rangeDays <= 14 ? format(d, 'EEE d') : format(d, 'dd/MM');
      const dayBookings = active.filter(b => b.booking_date === dateStr);
      const daySales = (sales || []).filter(s => s.sale_date === dateStr);
      const salesAmount = daySales.reduce((s, sale) => s + Number(sale.amount), 0);
      return { name: dayLabel, Sales: salesAmount, Appointments: dayBookings.length };
    });

    // ── Upcoming 7 days ──
    const next7End = addDays(today, 7);
    const upcomingBookings = confirmed.filter(b => {
      const d = new Date(b.booking_date);
      return d >= today && d <= next7End;
    }).sort((a, b) => a.booking_date.localeCompare(b.booking_date) || a.start_time.localeCompare(b.start_time));

    // ── Activity (recent bookings) ──
    const recentActivity = bookings.slice(0, 10);

    // ── Today's appointments (all confirmed for today) ──
    const todayNext = confirmed.filter(b => b.booking_date === todayStr)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    // ── Top services (this month vs last month) ──
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const lastMonthStart = startOfMonth(subDays(monthStart, 1));
    const lastMonthEnd = endOfMonth(subDays(monthStart, 1));

    const thisMonthBookings = active.filter(b => {
      const d = new Date(b.booking_date);
      return d >= monthStart && d <= monthEnd;
    });
    const lastMonthBookings = active.filter(b => {
      const d = new Date(b.booking_date);
      return d >= lastMonthStart && d <= lastMonthEnd;
    });

    const serviceCountThis: Record<string, { name: string; count: number }> = {};
    const serviceCountLast: Record<string, number> = {};
    thisMonthBookings.forEach(b => {
      const name = (b as any).services?.name || 'Unknown';
      if (!serviceCountThis[b.service_id]) serviceCountThis[b.service_id] = { name, count: 0 };
      serviceCountThis[b.service_id].count++;
    });
    lastMonthBookings.forEach(b => {
      serviceCountLast[b.service_id] = (serviceCountLast[b.service_id] || 0) + 1;
    });
    const topServices = Object.entries(serviceCountThis)
      .map(([id, v]) => ({ ...v, lastMonth: serviceCountLast[id] || 0 }))
      .sort((a, b) => b.count - a.count);

    // ── Top team member ──
    const therapistRevenue: Record<string, { name: string; revenue: number; count: number }> = {};
    thisMonthBookings.forEach(b => {
      const name = (b as any).therapists?.name || 'Unknown';
      if (!therapistRevenue[b.therapist_id]) therapistRevenue[b.therapist_id] = { name, revenue: 0, count: 0 };
      therapistRevenue[b.therapist_id].revenue += (b as any).services?.price || 0;
      therapistRevenue[b.therapist_id].count++;
    });
    const topTeam = Object.values(therapistRevenue).sort((a, b) => b.revenue - a.revenue);

    return {
      rangeRevenue,
      rangeCount: rangeBookings.length,
      rangeValue: rangeBookingValue,
      chartData,
      upcomingBookings,
      recentActivity,
      todayNext,
      topServices,
      topTeam,
    };
  }, [bookings, sales, dateRange]);

  if (!stats) return null;

  const rangeLabel = PRESET_RANGES.find(r => r.key === rangePreset)?.label || 
    (customFrom && customTo ? `${format(customFrom, 'dd/MM')} – ${format(customTo, 'dd/MM')}` : '');

  return (
    <div className={className}>
      {/* Date Range Filter */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Select value={rangePreset} onValueChange={(v) => setRangePreset(v)}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder={t('Chọn khoảng thời gian')} />
          </SelectTrigger>
          <SelectContent>
            {PRESET_RANGES.map(r => (
              <SelectItem key={r.key} value={r.key}>{t(r.label)}</SelectItem>
            ))}
            <SelectItem value="custom">{t('Tuỳ chỉnh')}</SelectItem>
          </SelectContent>
        </Select>
        {rangePreset === 'custom' && (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-1", !customFrom && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {customFrom ? format(customFrom, 'dd/MM/yyyy') : t('Từ ngày')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">–</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-1", !customTo && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {customTo ? format(customTo, 'dd/MM/yyyy') : t('Đến ngày')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── Recent Sales ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              {t('Doanh thu gần đây')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t(rangeLabel)}</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-2xl font-bold">{formatPrice(stats.rangeRevenue)}</p>
                <p className="text-xs text-muted-foreground">{t('Doanh thu')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.rangeCount}</p>
                <p className="text-xs text-muted-foreground">{t('Lịch hẹn')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{formatPrice(stats.rangeValue)}</p>
                <p className="text-xs text-muted-foreground">{t('Giá trị lịch hẹn')}</p>
              </div>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" interval={rangeDays > 14 ? Math.floor(rangeDays / 7) : 0} />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend />
                  <Bar dataKey="Sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Appointments" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* ── Upcoming Appointments ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" />
              {t('Lịch hẹn sắp tới')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t('7 ngày tới')}</p>
          </CardHeader>
          <CardContent>
            {stats.upcomingBookings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">{t('Lịch trình trống')}</p>
                <p className="text-xs mt-1">{t('Tạo lịch hẹn để dữ liệu xuất hiện')}</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {stats.upcomingBookings.map(b => (
                  <div key={b.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="text-center shrink-0 bg-primary/10 rounded-lg px-2 py-1.5">
                      <p className="text-xs text-muted-foreground">{format(new Date(b.booking_date), 'EEE')}</p>
                      <p className="text-lg font-bold text-primary">{format(new Date(b.booking_date), 'd')}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{b.customer_name}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {(b as any).services?.name} · {(b as any).therapists?.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Appointments Activity ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              {t('Hoạt động lịch hẹn')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t('Chưa có dữ liệu')}</p>
            ) : (
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {stats.recentActivity.map(b => {
                  const bookDate = new Date(b.booking_date);
                  const dur = (b as any).services?.duration_minutes || 0;
                  const statusColor = b.status === 'confirmed' ? 'default' : b.status === 'cancelled' ? 'destructive' : 'secondary';
                  const statusText = b.status === 'confirmed' ? t('Đã đặt') : b.status === 'cancelled' ? t('Đã huỷ') : t('Hoàn thành');
                  return (
                    <div key={b.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="text-center shrink-0 bg-muted rounded-lg px-2 py-1.5 min-w-[48px]">
                        <p className="text-lg font-bold">{format(bookDate, 'd')}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">{format(bookDate, 'MMM')}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-xs text-muted-foreground">
                            {format(bookDate, 'EEE, d MMM yyyy')} {b.start_time?.slice(0, 5)}
                          </p>
                          <Badge variant={statusColor} className="text-[10px]">{statusText}</Badge>
                        </div>
                        <p className="text-sm font-semibold">{(b as any).services?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.customer_name}, {dur > 0 ? `${Math.floor(dur / 60)}h ${dur % 60 > 0 ? `${dur % 60}min` : ''}` : ''} {t('với')} {(b as any).therapists?.name}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Right column: Today's Next + Top Services + Top Team ── */}
        <div className="space-y-6">
          {/* Today's next appointments */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                {t('Lịch hẹn hôm nay')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.todayNext.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">{t('Không có lịch hẹn hôm nay')}</p>
                  <p className="text-xs mt-1">{t('Xem lịch để thêm lịch hẹn')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.todayNext.slice(0, 5).map(b => (
                    <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{b.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{(b as any).services?.name}</p>
                      </div>
                      <Badge variant="outline">{b.start_time?.slice(0, 5)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top services */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                {t('Dịch vụ hàng đầu')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.topServices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t('Chưa có dữ liệu')}</p>
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-3 text-xs font-medium text-muted-foreground pb-2 border-b">
                    <span>{t('Dịch vụ')}</span>
                    <span className="text-center">{t('Tháng này')}</span>
                    <span className="text-center">{t('Tháng trước')}</span>
                  </div>
                  {stats.topServices.map((s, i) => (
                    <div key={i} className="grid grid-cols-3 py-2 text-sm items-center">
                      <span className="font-medium truncate">{s.name}</span>
                      <span className="text-center font-semibold">{s.count}</span>
                      <span className="text-center text-muted-foreground">{s.lastMonth}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top team member */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                {t('Thợ hàng đầu')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.topTeam.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">{t('Chưa có doanh thu tháng này')}</p>
                  <p className="text-xs mt-1">{t('Tạo lịch hẹn để dữ liệu xuất hiện')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.topTeam.map((tm, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{tm.name}</p>
                          <p className="text-xs text-muted-foreground">{tm.count} {t('lịch hẹn')}</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold">{formatPrice(tm.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
