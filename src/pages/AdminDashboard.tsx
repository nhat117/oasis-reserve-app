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
import { Leaf, LogOut, Plus, Pencil } from 'lucide-react';
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

  const { data: bookings } = useQuery({
    queryKey: ['admin-bookings', filterTherapist],
    queryFn: async () => {
      let query = supabase.from('bookings').select('*, services(name), therapists(name)')
        .order('booking_date', { ascending: true }).order('start_time', { ascending: true });
      if (filterTherapist !== 'all') query = query.eq('therapist_id', filterTherapist);
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
      const payload = { name: therapistName, phone: therapistPhone || null };
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
        <Tabs defaultValue="bookings">
          <TabsList className="mb-6">
            <TabsTrigger value="bookings">Lịch hẹn</TabsTrigger>
            <TabsTrigger value="services">Dịch vụ</TabsTrigger>
            <TabsTrigger value="therapists">Thợ</TabsTrigger>
          </TabsList>

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
          <TabsContent value="therapists">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Quản lý thợ</CardTitle>
                <Dialog open={therapistDialog} onOpenChange={setTherapistDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => openTherapistEdit()}><Plus className="h-4 w-4 mr-1" /> Thêm</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{editingTherapist ? 'Sửa thông tin thợ' : 'Thêm thợ'}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div><Label>Tên</Label><Input value={therapistName} onChange={e => setTherapistName(e.target.value)} className="mt-1" /></div>
                      <div><Label>SĐT</Label><Input value={therapistPhone} onChange={e => setTherapistPhone(e.target.value)} className="mt-1" /></div>
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
                      <TableHead>Trạng thái</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {therapists?.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>{t.phone || '—'}</TableCell>
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
