import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, Users, DollarSign, TrendingUp, Clock } from 'lucide-react';

interface StatsProps {
  className?: string;
}

export function BookingStats({ className }: StatsProps) {
  const { data: bookings } = useQuery({
    queryKey: ['stats-bookings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('bookings')
        .select('*, services(name, price), therapists(name)')
        .order('booking_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    if (!bookings) return null;

    const confirmed = bookings.filter(b => b.status === 'confirmed');
    const completed = bookings.filter(b => b.status === 'completed');
    const cancelled = bookings.filter(b => b.status === 'cancelled');
    const active = [...confirmed, ...completed];

    // Revenue (from confirmed + completed)
    const totalRevenue = active.reduce((sum, b) => sum + ((b as any).services?.price || 0), 0);

    // Today's bookings
    const today = new Date().toISOString().split('T')[0];
    const todayBookings = confirmed.filter(b => b.booking_date === today);

    // This week
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];
    const weekBookings = confirmed.filter(b => b.booking_date >= weekStartStr && b.booking_date <= weekEndStr);

    // By therapist
    const byTherapist: Record<string, { name: string; count: number; revenue: number }> = {};
    active.forEach(b => {
      const name = (b as any).therapists?.name || 'Không rõ';
      if (!byTherapist[b.therapist_id]) byTherapist[b.therapist_id] = { name, count: 0, revenue: 0 };
      byTherapist[b.therapist_id].count++;
      byTherapist[b.therapist_id].revenue += (b as any).services?.price || 0;
    });

    // Popular services
    const byService: Record<string, { name: string; count: number }> = {};
    active.forEach(b => {
      const name = (b as any).services?.name || 'Không rõ';
      if (!byService[b.service_id]) byService[b.service_id] = { name, count: 0 };
      byService[b.service_id].count++;
    });

    return {
      total: bookings.length,
      confirmed: confirmed.length,
      completed: completed.length,
      cancelled: cancelled.length,
      totalRevenue,
      todayCount: todayBookings.length,
      weekCount: weekBookings.length,
      byTherapist: Object.values(byTherapist).sort((a, b) => b.count - a.count),
      byService: Object.values(byService).sort((a, b) => b.count - a.count),
    };
  }, [bookings]);

  const formatPrice = (p: number) => new Intl.NumberFormat('vi-VN').format(p) + 'đ';

  if (!stats) return null;

  return (
    <div className={className}>
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.todayCount}</p>
                <p className="text-xs text-muted-foreground">Hôm nay</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.weekCount}</p>
                <p className="text-xs text-muted-foreground">Tuần này</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.confirmed}</p>
                <p className="text-xs text-muted-foreground">Đang chờ</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold">{formatPrice(stats.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Tổng doanh thu</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* By therapist */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Theo thợ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.byTherapist.map((t, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.count} lịch hẹn</p>
                  </div>
                  <span className="text-sm font-semibold">{formatPrice(t.revenue)}</span>
                </div>
              ))}
              {stats.byTherapist.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">Chưa có dữ liệu</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Popular services */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dịch vụ phổ biến</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.byService.map((s, i) => {
                const maxCount = stats.byService[0]?.count || 1;
                const pct = (s.count / maxCount) * 100;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm">{s.name}</p>
                      <span className="text-xs text-muted-foreground">{s.count} lượt</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {stats.byService.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">Chưa có dữ liệu</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary row */}
      <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
        <span>Tổng cộng: <strong className="text-foreground">{stats.total}</strong> lịch hẹn</span>
        <span>·</span>
        <span>Hoàn thành: <strong className="text-foreground">{stats.completed}</strong></span>
        <span>·</span>
        <span>Đã huỷ: <strong className="text-foreground">{stats.cancelled}</strong></span>
      </div>
    </div>
  );
}
