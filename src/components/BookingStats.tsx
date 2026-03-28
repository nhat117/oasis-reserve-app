import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, TrendingUp, TrendingDown, DollarSign, Clock, CalendarCheck, Users, CalendarIcon, Crown } from 'lucide-react';
import { format, subDays, addDays, startOfMonth, endOfMonth, differenceInDays, eachDayOfInterval } from 'date-fns';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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

    const fromStr = format(dateRange.from, 'yyyy-MM-dd');
    const toStr = format(dateRange.to, 'yyyy-MM-dd');
    const rangeBookings = active.filter(b => b.booking_date >= fromStr && b.booking_date <= toStr);

    const rangeSales = (sales || []).filter(s => s.sale_date >= fromStr && s.sale_date <= toStr);
    const rangeRevenue = rangeSales.reduce((s, sale) => s + Number(sale.amount), 0);
    const rangeBookingValue = rangeBookings.reduce((s, b) => s + ((b as any).services?.price || 0), 0);

    // Previous period for comparison
    const prevFrom = subDays(dateRange.from, rangeDays);
    const prevTo = subDays(dateRange.from, 1);
    const prevFromStr = format(prevFrom, 'yyyy-MM-dd');
    const prevToStr = format(prevTo, 'yyyy-MM-dd');
    const prevBookings = active.filter(b => b.booking_date >= prevFromStr && b.booking_date <= prevToStr);
    const prevSales = (sales || []).filter(s => s.sale_date >= prevFromStr && s.sale_date <= prevToStr);
    const prevRevenue = prevSales.reduce((s, sale) => s + Number(sale.amount), 0);
    const prevBookingValue = prevBookings.reduce((s, b) => s + ((b as any).services?.price || 0), 0);

    // Trend percentages
    const revenueTrend = prevRevenue > 0 ? ((rangeRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const countTrend = prevBookings.length > 0 ? ((rangeBookings.length - prevBookings.length) / prevBookings.length) * 100 : 0;
    const valueTrend = prevBookingValue > 0 ? ((rangeBookingValue - prevBookingValue) / prevBookingValue) * 100 : 0;

    const allDays = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    const rawChartData = allDays.map((d, idx) => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayLabel = rangeDays <= 14 ? format(d, 'EEE d') : format(d, 'dd/MM');
      const dayBookings = active.filter(b => b.booking_date === dateStr);
      const daySales = (sales || []).filter(s => s.sale_date === dateStr);
      const salesAmount = daySales.reduce((s, sale) => s + Number(sale.amount), 0);
      return { name: dayLabel, Revenue: salesAmount, Bookings: dayBookings.length, idx };
    });

    // Linear regression for revenue prediction
    const n = rawChartData.length;
    const sumX = rawChartData.reduce((s, d) => s + d.idx, 0);
    const sumY = rawChartData.reduce((s, d) => s + d.Revenue, 0);
    const sumXY = rawChartData.reduce((s, d) => s + d.idx * d.Revenue, 0);
    const sumX2 = rawChartData.reduce((s, d) => s + d.idx * d.idx, 0);
    const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;
    const intercept = n > 0 ? (sumY - slope * sumX) / n : 0;

    const chartData = rawChartData.map(d => ({
      ...d,
      Trend: Math.max(0, Math.round(intercept + slope * d.idx)),
    }));

    const next7End = addDays(today, 7);
    const upcomingBookings = confirmed.filter(b => {
      const d = new Date(b.booking_date);
      return d >= today && d <= next7End;
    }).sort((a, b) => a.booking_date.localeCompare(b.booking_date) || a.start_time.localeCompare(b.start_time));

    const recentActivity = bookings.slice(0, 10);

    const todayNext = confirmed.filter(b => b.booking_date === todayStr)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    const todayBookings = active.filter(b => b.booking_date === todayStr);
    const todayCustomers = todayBookings.length;
    const todayRevenue = todayBookings.reduce((sum, b) => sum + ((b as any).services?.price || 0), 0);

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
      revenueTrend,
      countTrend,
      valueTrend,
      chartData,
      upcomingBookings,
      recentActivity,
      todayNext,
      todayCustomers,
      todayRevenue,
      topServices,
      topTeam,
    };
  }, [bookings, sales, dateRange]);

  if (!stats) return null;

  const rangeLabel = PRESET_RANGES.find(r => r.key === rangePreset)?.label || 
    (customFrom && customTo ? `${format(customFrom, 'dd/MM')} – ${format(customTo, 'dd/MM')}` : '');

  const TrendIndicator = ({ value }: { value: number }) => {
    if (value === 0) return null;
    const isUp = value > 0;
    return (
      <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", isUp ? "text-emerald-600" : "text-red-500")}>
        {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  const maxServiceCount = Math.max(...stats.topServices.map(s => s.count), 1);
  const maxTeamRevenue = Math.max(...stats.topTeam.map(t => t.revenue), 1);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-border/40 bg-card px-4 py-3 shadow-lg">
        <p className="text-xs font-medium text-foreground mb-1.5">{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-semibold text-foreground">
              {entry.dataKey === 'Revenue' || entry.dataKey === 'Trend' ? formatPrice(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={className}>
      {/* Date Range Filter */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Select value={rangePreset} onValueChange={(v) => setRangePreset(v)}>
          <SelectTrigger className="w-[160px] h-9 rounded-lg border-border/60">
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
                <Button variant="outline" size="sm" className={cn("gap-1 rounded-lg", !customFrom && "text-muted-foreground")}>
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
                <Button variant="outline" size="sm" className={cn("gap-1 rounded-lg", !customTo && "text-muted-foreground")}>
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

      {/* ── Today Highlight Cards ── */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card className="card-hover border-border/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-4.5 w-4.5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('Khách hôm nay')}</p>
            </div>
            <p className="text-3xl font-semibold font-serif tracking-tight text-foreground">{stats.todayCustomers}</p>
          </CardContent>
        </Card>
        <Card className="card-hover border-border/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-4.5 w-4.5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('Doanh thu hôm nay')}</p>
            </div>
            <p className="text-3xl font-semibold font-serif tracking-tight text-foreground">{formatPrice(stats.todayRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          {
            icon: DollarSign,
            label: t('Doanh thu'),
            value: formatPrice(stats.rangeRevenue),
            trend: stats.revenueTrend,
            sub: t(rangeLabel),
          },
          {
            icon: CalendarCheck,
            label: t('Lịch hẹn'),
            value: stats.rangeCount.toString(),
            trend: stats.countTrend,
            sub: t(rangeLabel),
          },
          {
            icon: TrendingUp,
            label: t('Giá trị lịch hẹn'),
            value: formatPrice(stats.rangeValue),
            trend: stats.valueTrend,
            sub: t(rangeLabel),
          },
        ].map((kpi, i) => (
          <Card key={i} className="card-hover border-border/50">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center">
                  <kpi.icon className="h-5 w-5 text-primary/70" />
                </div>
                <TrendIndicator value={kpi.trend} />
              </div>
              <p className="text-3xl font-semibold font-serif tracking-tight text-foreground">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.label} · {kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── Revenue Chart ── */}
        <Card className="card-hover border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary/60" />
                {t('Doanh thu gần đây')}
              </CardTitle>
              {stats.revenueTrend !== 0 && (
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", stats.revenueTrend > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500")}>
                  {stats.revenueTrend > 0 ? '+' : ''}{stats.revenueTrend.toFixed(1)}% {t('vs trước')}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stats.chartData} barCategoryGap="20%">
                  <defs>
                    <linearGradient id="bookingGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={rangeDays > 14 ? Math.floor(rangeDays / 7) : 0} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', radius: 6 }} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Bar yAxisId="left" dataKey="Bookings" fill="url(#bookingGrad)" radius={[6, 6, 0, 0]} name={t('Lịch hẹn')} />
                  <Line yAxisId="right" type="monotone" dataKey="Revenue" stroke="hsl(28, 60%, 50%)" strokeWidth={2.5} dot={{ r: 3, fill: 'hsl(var(--card))', stroke: 'hsl(28, 60%, 50%)', strokeWidth: 2 }} activeDot={{ r: 5 }} name={t('Doanh thu')} />
                  <Line yAxisId="right" type="monotone" dataKey="Trend" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="6 3" dot={false} name={t('Xu hướng')} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* ── Upcoming Appointments ── */}
        <Card className="card-hover border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary/60" />
              {t('Lịch hẹn sắp tới')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t('7 ngày tới')}</p>
          </CardHeader>
          <CardContent>
            {stats.upcomingBookings.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">{t('Lịch trình trống')}</p>
                <p className="text-xs mt-1 opacity-70">{t('Tạo lịch hẹn để dữ liệu xuất hiện')}</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                {stats.upcomingBookings.map(b => (
                  <div key={b.id} className="flex items-start gap-3 p-3 rounded-xl border-l-2 border-primary/20 hover:bg-muted/40 transition-all duration-200">
                    <div className="text-center shrink-0 bg-primary/5 rounded-lg px-2.5 py-1.5 min-w-[48px]">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{format(new Date(b.booking_date), 'EEE')}</p>
                      <p className="text-lg font-bold text-primary">{format(new Date(b.booking_date), 'd')}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate text-foreground">{b.customer_name}</p>
                        <span className="text-[11px] text-primary/70 font-medium shrink-0">
                          {b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {(b as any).services?.name} · {(b as any).therapists?.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Activity Timeline ── */}
        <Card className="card-hover border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary/60" />
              {t('Hoạt động lịch hẹn')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t('Chưa có dữ liệu')}</p>
            ) : (
              <div className="relative max-h-[340px] overflow-y-auto pr-1">
                {/* Timeline line */}
                <div className="absolute left-[23px] top-0 bottom-0 w-px bg-border/60" />
                <div className="space-y-0">
                  {stats.recentActivity.map(b => {
                    const bookDate = new Date(b.booking_date);
                    const dur = (b as any).services?.duration_minutes || 0;
                    const statusColor = b.status === 'confirmed'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : b.status === 'cancelled'
                      ? 'bg-red-50 text-red-600 border-red-200'
                      : 'bg-primary/5 text-primary border-primary/20';
                    const statusText = b.status === 'confirmed' ? t('Đã đặt') : b.status === 'cancelled' ? t('Đã huỷ') : t('Hoàn thành');
                    return (
                      <div key={b.id} className="relative flex items-start gap-3 py-3 pl-2">
                        {/* Timeline dot */}
                        <div className="relative z-10 mt-1.5 h-3 w-3 rounded-full border-2 border-primary/40 bg-card shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] text-muted-foreground font-medium">
                              {format(bookDate, 'EEE, d MMM')} · {b.start_time?.slice(0, 5)}
                            </span>
                            <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", statusColor)}>
                              {statusText}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-foreground">{(b as any).services?.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {b.customer_name} · {dur > 0 ? `${Math.floor(dur / 60)}h${dur % 60 > 0 ? ` ${dur % 60}min` : ''}` : ''} {t('với')} {(b as any).therapists?.name}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Right column: Today + Top Services + Top Team ── */}
        <div className="space-y-6">
          {/* Today's appointments */}
          <Card className="card-hover border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary/60" />
                {t('Lịch hẹn hôm nay')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.todayNext.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-medium">{t('Không có lịch hẹn hôm nay')}</p>
                  <p className="text-xs mt-1 opacity-70">{t('Xem lịch để thêm lịch hẹn')}</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {stats.todayNext.slice(0, 5).map(b => (
                    <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-all duration-200 border-l-2 border-primary/15">
                      <span className="text-xs font-semibold text-primary bg-primary/5 rounded-lg px-2.5 py-1.5 shrink-0 tabular-nums">
                        {b.start_time?.slice(0, 5)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{b.customer_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{(b as any).services?.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top services with progress bars */}
          <Card className="card-hover border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary/60" />
                {t('Dịch vụ hàng đầu')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.topServices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t('Chưa có dữ liệu')}</p>
              ) : (
                <div className="space-y-4">
                  {stats.topServices.map((s, i) => {
                    const diff = s.count - s.lastMonth;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-foreground truncate">{s.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-semibold tabular-nums">{s.count}</span>
                            {diff !== 0 && (
                              <span className={cn("text-[10px] font-medium flex items-center gap-0.5", diff > 0 ? "text-emerald-600" : "text-red-500")}>
                                {diff > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                {diff > 0 ? '+' : ''}{diff}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-primary/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/50 transition-all duration-500"
                            style={{ width: `${(s.count / maxServiceCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top team members with avatars */}
          <Card className="card-hover border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-primary/60" />
                {t('Thợ hàng đầu')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.topTeam.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">{t('Chưa có doanh thu tháng này')}</p>
                  <p className="text-xs mt-1 opacity-70">{t('Tạo lịch hẹn để dữ liệu xuất hiện')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stats.topTeam.map((tm, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <div className={cn(
                            "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                            i === 0 ? "bg-amber-50 text-amber-700 ring-2 ring-amber-200" : "bg-primary/5 text-primary"
                          )}>
                            {i === 0 ? <Crown className="h-4 w-4" /> : tm.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{tm.name}</p>
                            <p className="text-[11px] text-muted-foreground">{tm.count} {t('lịch hẹn')}</p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-foreground">{formatPrice(tm.revenue)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-primary/10 overflow-hidden" style={{ marginLeft: '46px', maxWidth: 'calc(100% - 46px)' }}>
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", i === 0 ? "bg-amber-400/70" : "bg-primary/40")}
                          style={{ width: `${(tm.revenue / maxTeamRevenue) * 100}%` }}
                        />
                      </div>
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
