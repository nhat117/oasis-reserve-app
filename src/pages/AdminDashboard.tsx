import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BookingCalendar } from '@/components/BookingCalendar';
import { Textarea } from '@/components/ui/textarea';
import { BookingStats } from '@/components/BookingStats';
import { Leaf, LogOut, Plus, Pencil, CalendarOff, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Navigate, Link } from 'react-router-dom';

const AdminDashboard = () => {
  const { user, isAdmin, loading, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filterTherapist, setFilterTherapist] = useState('all');

  // Service form state
  const [serviceDialog, setServiceDialog] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [serviceName, setServiceName] = useState('');
  const [serviceDesc, setServiceDesc] = useState('');
  const [serviceDuration, setServiceDuration] = useState('60');
  const [servicePrice, setServicePrice] = useState('0');

  // Therapist form state
  const [therapistDialog, setTherapistDialog] = useState(false);
  const [editingTherapist, setEditingTherapist] = useState<any>(null);
  const [therapistName, setTherapistName] = useState('');
  const [therapistPhone, setTherapistPhone] = useState('');
  const [therapistStartHour, setTherapistStartHour] = useState('9');
  const [therapistEndHour, setTherapistEndHour] = useState('18');
  const [unavailDate, setUnavailDate] = useState<Date | undefined>();
  const [unavailTherapist, setUnavailTherapist] = useState('');
  const [holidayDate, setHolidayDate] = useState<Date | undefined>();
  const [holidayReason, setHolidayReason] = useState('');
  const [earlyCloseHour, setEarlyCloseHour] = useState('none');

  const { data: bookings } = useQuery({
    queryKey: ['admin-bookings', filterTherapist],
    queryFn: async () => {
      let query = supabase.from('bookings').select('*, services(name), therapists(name)')
        .order('booking_date', { ascending: true }).order('start_time', { ascending: true });
      if (filterTherapist !== 'all') query = query.eq('therapist_id', filterTherapist);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: services } = useQuery({
    queryKey: ['admin-services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('*').order('created_at');
      if (error) throw error;
      return data;
    },
  });

  const { data: therapists } = useQuery({
    queryKey: ['admin-therapists'],
    queryFn: async () => {
      const { data, error } = await supabase.from('therapists').select('*').order('created_at');
      if (error) throw error;
      return data;
    },
  });

  // Random therapist setting
  const { data: randomEnabled } = useQuery({
    queryKey: ['random-therapist-setting'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'random_therapist_enabled').single();
      if (error) return true;
      return data.value === 'true';
    },
  });

  const toggleRandom = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.from('app_settings').update({ value: String(enabled) }).eq('key', 'random_therapist_enabled');
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['random-therapist-setting'] }); toast({ title: 'Đã cập nhật cài đặt' }); },
  });

  // Twilio SMS setting
  const { data: twilioNumber } = useQuery({
    queryKey: ['twilio-number-setting'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'twilio_from_number').single();
      if (error) return '';
      return data.value;
    },
  });

  const [smsNumber, setSmsNumber] = useState('');

  const saveSmsNumber = useMutation({
    mutationFn: async (num: string) => {
      const { error } = await supabase.from('app_settings').upsert({ key: 'twilio_from_number', value: num });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['twilio-number-setting'] }); toast({ title: 'Đã lưu số SMS' }); },
  });

  // Therapist unavailability
  const { data: unavailabilities } = useQuery({
    queryKey: ['admin-unavailability'],
    queryFn: async () => {
      const { data, error } = await supabase.from('therapist_unavailability').select('*, therapists(name)').order('unavailable_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addUnavailability = useMutation({
    mutationFn: async ({ therapistId, date, reason }: { therapistId: string; date: string; reason?: string }) => {
      const { error } = await supabase.from('therapist_unavailability').insert({ therapist_id: therapistId, unavailable_date: date, reason });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-unavailability'] }); toast({ title: 'Đã thêm ngày nghỉ' }); },
  });

  const removeUnavailability = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('therapist_unavailability').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-unavailability'] }); toast({ title: 'Đã xoá ngày nghỉ' }); },
  });

  // Shop holidays
  const { data: shopHolidays } = useQuery({
    queryKey: ['shop-holidays'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shop_holidays').select('*').order('holiday_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addHoliday = useMutation({
    mutationFn: async ({ date, reason, earlyCloseHour }: { date: string; reason?: string; earlyCloseHour?: number }) => {
      const { error } = await supabase.from('shop_holidays').insert({
        holiday_date: date,
        reason,
        early_close_hour: earlyCloseHour ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shop-holidays'] }); toast({ title: 'Đã thêm ngày nghỉ tiệm' }); },
  });

  const removeHoliday = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shop_holidays').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shop-holidays'] }); toast({ title: 'Đã xoá ngày nghỉ tiệm' }); },
  });

  const cancelBooking = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }); toast({ title: 'Đã huỷ lịch hẹn' }); },
  });

  const rescheduleBooking = useMutation({
    mutationFn: async ({ id, newDate, newStartTime, newEndTime }: { id: string; newDate: string; newStartTime: string; newEndTime: string }) => {
      const { error } = await supabase.from('bookings').update({
        booking_date: newDate,
        start_time: newStartTime,
        end_time: newEndTime,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }); toast({ title: 'Đã dời lịch hẹn' }); },
  });

  const saveService = useMutation({
    mutationFn: async () => {
      const payload = { name: serviceName, description: serviceDesc || null, duration_minutes: parseInt(serviceDuration), price: parseInt(servicePrice) };
      if (editingService) {
        const { error } = await supabase.from('services').update(payload).eq('id', editingService.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('services').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      setServiceDialog(false);
      toast({ title: editingService ? 'Đã cập nhật dịch vụ' : 'Đã thêm dịch vụ' });
    },
  });

  const saveTherapist = useMutation({
    mutationFn: async () => {
      const payload = { name: therapistName, phone: therapistPhone || null, start_hour: parseInt(therapistStartHour), end_hour: parseInt(therapistEndHour) };
      if (editingTherapist) {
        const { error } = await supabase.from('therapists').update(payload).eq('id', editingTherapist.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('therapists').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-therapists'] });
      setTherapistDialog(false);
      toast({ title: editingTherapist ? 'Đã cập nhật thợ' : 'Đã thêm thợ' });
    },
  });

  const openServiceEdit = (service?: any) => {
    setEditingService(service || null);
    setServiceName(service?.name || '');
    setServiceDesc(service?.description || '');
    setServiceDuration(String(service?.duration_minutes || 60));
    setServicePrice(String(service?.price || 0));
    setServiceDialog(true);
  };

  const openTherapistEdit = (therapist?: any) => {
    setEditingTherapist(therapist || null);
    setTherapistName(therapist?.name || '');
    setTherapistPhone(therapist?.phone || '');
    setTherapistStartHour(String(therapist?.start_hour || 9));
    setTherapistEndHour(String(therapist?.end_hour || 18));
    setTherapistDialog(true);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { confirmed: 'Đã xác nhận', cancelled: 'Đã huỷ', completed: 'Hoàn thành' };
    const variant = status === 'confirmed' ? 'default' : status === 'cancelled' ? 'destructive' : 'secondary';
    return <Badge variant={variant as any}>{map[status] || status}</Badge>;
  };

  const formatPrice = (p: number) => new Intl.NumberFormat('vi-VN').format(p) + 'đ';

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p>Đang tải...</p></div>;
  if (!user) return <Navigate to="/admin/login" />;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center"><p className="text-destructive">Bạn không có quyền truy cập.</p></div>;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-primary" />
            <span className="font-semibold font-serif text-primary">Quản trị Spa</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1" /> Đăng xuất</Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="stats">
          <TabsList className="mb-6">
            <TabsTrigger value="stats">Thống kê</TabsTrigger>
            <TabsTrigger value="bookings">Lịch hẹn</TabsTrigger>
            <TabsTrigger value="services">Dịch vụ</TabsTrigger>
            <TabsTrigger value="therapists">Thợ</TabsTrigger>
          </TabsList>

          {/* Stats Tab */}
          <TabsContent value="stats">
            <BookingStats />
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Lịch hẹn</CardTitle>
                <Select value={filterTherapist} onValueChange={setFilterTherapist}>
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả thợ</SelectItem>
                    {therapists?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <BookingCalendar
                  bookings={(bookings as any) || []}
                  onCancel={(id) => cancelBooking.mutate(id)}
                  onReschedule={(id, newDate, newStartTime, newEndTime) =>
                    rescheduleBooking.mutate({ id, newDate, newStartTime, newEndTime })
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Quản lý dịch vụ</CardTitle>
                <Dialog open={serviceDialog} onOpenChange={setServiceDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => openServiceEdit()}><Plus className="h-4 w-4 mr-1" /> Thêm</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{editingService ? 'Sửa dịch vụ' : 'Thêm dịch vụ'}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div><Label>Tên</Label><Input value={serviceName} onChange={e => setServiceName(e.target.value)} className="mt-1" /></div>
                      <div><Label>Mô tả</Label><Textarea value={serviceDesc} onChange={e => setServiceDesc(e.target.value)} className="mt-1" /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Thời gian (phút)</Label><Input type="number" value={serviceDuration} onChange={e => setServiceDuration(e.target.value)} className="mt-1" /></div>
                        <div><Label>Giá (VNĐ)</Label><Input type="number" value={servicePrice} onChange={e => setServicePrice(e.target.value)} className="mt-1" /></div>
                      </div>
                      <Button className="w-full" onClick={() => saveService.mutate()} disabled={!serviceName.trim()}>
                        {editingService ? 'Cập nhật' : 'Thêm mới'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên</TableHead>
                      <TableHead>Thời gian</TableHead>
                      <TableHead>Giá</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services?.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.duration_minutes} phút</TableCell>
                        <TableCell>{formatPrice(s.price)}</TableCell>
                        <TableCell><Badge variant={s.is_active ? 'default' : 'secondary'}>{s.is_active ? 'Hoạt động' : 'Tắt'}</Badge></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openServiceEdit(s)}><Pencil className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Therapists Tab */}
          <TabsContent value="therapists" className="space-y-6">
            {/* Random therapist toggle */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Tự động chọn thợ ngẫu nhiên</p>
                  <p className="text-xs text-muted-foreground">Cho phép khách chọn "bất kỳ thợ trống" khi đặt lịch</p>
                </div>
                <Switch checked={randomEnabled !== false} onCheckedChange={(v) => toggleRandom.mutate(v)} />
              </CardContent>
            </Card>

            {/* Unavailability */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ngày nghỉ / Không khả dụng</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Select value={unavailTherapist} onValueChange={setUnavailTherapist}>
                    <SelectTrigger className="w-[160px]"><SelectValue placeholder="Chọn thợ" /></SelectTrigger>
                    <SelectContent>
                      {therapists?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn(!unavailDate && "text-muted-foreground")}>
                        <CalendarOff className="h-4 w-4 mr-1" />
                        {unavailDate ? format(unavailDate, 'dd/MM/yyyy') : 'Chọn ngày'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={unavailDate} onSelect={setUnavailDate} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <Button size="sm" disabled={!unavailTherapist || !unavailDate}
                    onClick={() => {
                      if (unavailTherapist && unavailDate) {
                        addUnavailability.mutate({ therapistId: unavailTherapist, date: format(unavailDate, 'yyyy-MM-dd') });
                        setUnavailDate(undefined);
                      }
                    }}>
                    <Plus className="h-4 w-4 mr-1" /> Thêm ngày nghỉ
                  </Button>
                </div>
                {unavailabilities && unavailabilities.length > 0 && (
                  <div className="space-y-1">
                    {unavailabilities.filter(u => u.unavailable_date >= format(new Date(), 'yyyy-MM-dd')).map(u => (
                      <div key={u.id} className="flex items-center justify-between py-1.5 px-3 bg-muted rounded text-sm">
                        <span><strong>{(u as any).therapists?.name}</strong> — {u.unavailable_date}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeUnavailability.mutate(u.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Shop Holidays & Early Close */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ngày nghỉ tiệm / Đóng cửa sớm</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 items-end">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn(!holidayDate && "text-muted-foreground")}>
                        <CalendarOff className="h-4 w-4 mr-1" />
                        {holidayDate ? format(holidayDate, 'dd/MM/yyyy') : 'Chọn ngày'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={holidayDate} onSelect={setHolidayDate} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <div className="flex items-center gap-1">
                    <Label className="text-xs whitespace-nowrap">Đóng cửa sớm lúc</Label>
                    <Select value={earlyCloseHour} onValueChange={setEarlyCloseHour}>
                      <SelectTrigger className="w-[90px] h-8"><SelectValue placeholder="Không" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nghỉ cả ngày</SelectItem>
                        {Array.from({ length: 13 }, (_, i) => i + 10).map(h => (
                          <SelectItem key={h} value={String(h)}>{h}:00</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input placeholder="Lý do (tuỳ chọn)" value={holidayReason} onChange={e => setHolidayReason(e.target.value)} className="w-[180px]" />
                  <Button size="sm" disabled={!holidayDate}
                    onClick={() => {
                      if (holidayDate) {
                        addHoliday.mutate({
                          date: format(holidayDate, 'yyyy-MM-dd'),
                          reason: holidayReason || undefined,
                          earlyCloseHour: earlyCloseHour !== 'none' ? parseInt(earlyCloseHour) : undefined,
                        });
                        setHolidayDate(undefined);
                        setHolidayReason('');
                        setEarlyCloseHour('none');
                      }
                    }}>
                    <Plus className="h-4 w-4 mr-1" /> Thêm
                  </Button>
                </div>
                {shopHolidays && shopHolidays.length > 0 && (
                  <div className="space-y-1">
                    {shopHolidays.filter((h: any) => h.holiday_date >= format(new Date(), 'yyyy-MM-dd')).map((h: any) => (
                      <div key={h.id} className="flex items-center justify-between py-1.5 px-3 bg-destructive/10 rounded text-sm">
                        <span>
                          {h.early_close_hour ? '⏰' : '🏖️'} <strong>{h.holiday_date}</strong>
                          {h.early_close_hour ? ` — Đóng cửa lúc ${h.early_close_hour}:00` : ' — Nghỉ cả ngày'}
                          {h.reason ? ` (${h.reason})` : ''}
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeHoliday.mutate(h.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Therapist list */}
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Danh sách thợ</CardTitle>
                <Dialog open={therapistDialog} onOpenChange={setTherapistDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => openTherapistEdit()}><Plus className="h-4 w-4 mr-1" /> Thêm</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{editingTherapist ? 'Sửa thông tin thợ' : 'Thêm thợ'}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div><Label>Tên</Label><Input value={therapistName} onChange={e => setTherapistName(e.target.value)} className="mt-1" /></div>
                      <div><Label>SĐT</Label><Input value={therapistPhone} onChange={e => setTherapistPhone(e.target.value)} className="mt-1" /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Giờ bắt đầu</Label><Input type="number" min="6" max="22" value={therapistStartHour} onChange={e => setTherapistStartHour(e.target.value)} className="mt-1" /></div>
                        <div><Label>Giờ kết thúc</Label><Input type="number" min="6" max="22" value={therapistEndHour} onChange={e => setTherapistEndHour(e.target.value)} className="mt-1" /></div>
                      </div>
                      <Button className="w-full" onClick={() => saveTherapist.mutate()} disabled={!therapistName.trim()}>
                        {editingTherapist ? 'Cập nhật' : 'Thêm mới'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên</TableHead>
                      <TableHead>SĐT</TableHead>
                      <TableHead>Giờ làm việc</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {therapists?.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>{t.phone || '—'}</TableCell>
                        <TableCell className="text-sm">{t.start_hour}:00 – {t.end_hour}:00</TableCell>
                        <TableCell><Badge variant={t.is_active ? 'default' : 'secondary'}>{t.is_active ? 'Hoạt động' : 'Tắt'}</Badge></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openTherapistEdit(t)}><Pencil className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
