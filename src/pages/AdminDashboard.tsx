import { useState, useEffect } from 'react';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BookingCalendar } from '@/components/BookingCalendar';
import { Textarea } from '@/components/ui/textarea';
import { BookingStats } from '@/components/BookingStats';
import { Leaf, LogOut, Plus, Pencil, CalendarOff, X, Settings, DollarSign, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Navigate, Link } from 'react-router-dom';
import { useI18n, LanguageSwitcher } from '@/hooks/useI18n';

const CURRENCIES = ['VND', 'USD', 'EUR', 'AUD'] as const;

const AdminDashboard = () => {
  const { user, isAdmin, loading, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useI18n();

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
  const [therapistBreakStart, setTherapistBreakStart] = useState('');
  const [therapistBreakEnd, setTherapistBreakEnd] = useState('');
  const [unavailDate, setUnavailDate] = useState<Date | undefined>();
  const [unavailTherapist, setUnavailTherapist] = useState('');
  const [holidayDate, setHolidayDate] = useState<Date | undefined>();
  const [holidayReason, setHolidayReason] = useState('');
  const [earlyCloseHour, setEarlyCloseHour] = useState('none');

  // Create booking form state
  const [bookingDialog, setBookingDialog] = useState(false);
  const [bookingServiceId, setBookingServiceId] = useState('');
  const [bookingTherapistId, setBookingTherapistId] = useState('');
  const [bookingDate, setBookingDate] = useState<Date | undefined>();
  const [bookingTime, setBookingTime] = useState('');
  const [bookingCustomerName, setBookingCustomerName] = useState('');
  const [bookingCustomerPhone, setBookingCustomerPhone] = useState('');
  const [bookingCustomerEmail, setBookingCustomerEmail] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');

  // Sales form state
  const [saleDialog, setSaleDialog] = useState(false);
  const [saleType, setSaleType] = useState<'booking' | 'walkin'>('booking');
  const [saleBookingId, setSaleBookingId] = useState('');
  const [saleServiceId, setSaleServiceId] = useState('');
  const [saleCustomerName, setSaleCustomerName] = useState('');
  const [saleAmount, setSaleAmount] = useState('');
  const [salePaymentMethod, setSalePaymentMethod] = useState<'cash' | 'card'>('cash');
  const [saleNotes, setSaleNotes] = useState('');

  // Currency settings state
  const [exchangeUSD, setExchangeUSD] = useState('');
  const [exchangeEUR, setExchangeEUR] = useState('');
  const [exchangeAUD, setExchangeAUD] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('AUD');

  // Shop info state
  const [shopPhone, setShopPhone] = useState('');
  const [shopAddress, setShopAddress] = useState('');

  // Resend email state
  const [resendApiKey, setResendApiKey] = useState('');
  const [resendFromEmail, setResendFromEmail] = useState('');

  // Card surcharge state
  const [cardSurchargePercent, setCardSurchargePercent] = useState('0');

  // OpenAI settings state
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');

  const { data: bookings } = useQuery({
    queryKey: ['admin-bookings', filterTherapist],
    queryFn: async () => {
      let query = supabase.from('bookings').select('*, services(name, duration_minutes), therapists(name)')
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

  // Sales
  const { data: sales } = useQuery({
    queryKey: ['admin-sales'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sales')
        .select('*, bookings(customer_name, customer_phone, booking_date, start_time, services(name))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createSale = useMutation({
    mutationFn: async () => {
      const baseAmount = parseFloat(saleAmount);
      const surcharge = salePaymentMethod === 'card' ? baseAmount * (parseFloat(cardSurchargeSetting || '0') / 100) : 0;
      const totalAmount = baseAmount + surcharge;
      const payload: any = {
        amount: totalAmount,
        payment_method: salePaymentMethod,
        notes: saleNotes || null,
        sale_date: format(new Date(), 'yyyy-MM-dd'),
      };
      if (saleType === 'booking' && saleBookingId && saleBookingId !== 'none') payload.booking_id = saleBookingId;
      const { error } = await supabase.from('sales').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sales'] });
      queryClient.invalidateQueries({ queryKey: ['stats-bookings'] });
      setSaleDialog(false);
      setSaleType('booking');
      setSaleBookingId('');
      setSaleServiceId('');
      setSaleCustomerName('');
      setSaleAmount('');
      setSalePaymentMethod('cash');
      setSaleNotes('');
      toast({ title: t('Đã ghi nhận thanh toán') });
    },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  const deleteSale = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sales').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sales'] });
      toast({ title: t('Đã xoá thanh toán') });
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
      const { error } = await supabase.from('app_settings').upsert({ key: 'random_therapist_enabled', value: String(enabled) });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['random-therapist-setting'] }); toast({ title: t('Đã cập nhật cài đặt') }); },
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['twilio-number-setting'] }); toast({ title: t('Đã lưu số SMS') }); },
  });

  // WhatsApp setting
  const { data: whatsappEnabled } = useQuery({
    queryKey: ['whatsapp-setting'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'whatsapp_enabled').single();
      if (error) return false;
      return data.value === 'true';
    },
  });

  const toggleWhatsapp = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.from('app_settings').upsert({ key: 'whatsapp_enabled', value: String(enabled) });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['whatsapp-setting'] }); toast({ title: t('Đã cập nhật WhatsApp') }); },
  });

  // Currency settings
  const { data: currencySettings } = useQuery({
    queryKey: ['currency-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('key, value')
        .in('key', ['exchange_rate_usd', 'exchange_rate_eur', 'exchange_rate_aud', 'default_currency']);
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach(r => { map[r.key] = r.value; });
      return map;
    },
  });

  // Shop info settings
  const { data: shopInfoSettings } = useQuery({
    queryKey: ['shop-info-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('key, value')
        .in('key', ['shop_phone', 'shop_address']);
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach(r => { map[r.key] = r.value; });
      return map;
    },
  });

  useEffect(() => {
    if (shopInfoSettings) {
      setShopPhone(shopInfoSettings['shop_phone'] || '');
      setShopAddress(shopInfoSettings['shop_address'] || '');
    }
  }, [shopInfoSettings]);

  const saveShopInfo = useMutation({
    mutationFn: async () => {
      const rows = [
        { key: 'shop_phone', value: shopPhone },
        { key: 'shop_address', value: shopAddress },
      ];
      for (const row of rows) {
        const { error } = await supabase.from('app_settings').upsert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shop-info-settings'] }); toast({ title: t('Đã lưu thông tin tiệm') }); },
  });

  // Resend email settings
  const { data: resendSettings } = useQuery({
    queryKey: ['resend-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('key, value')
        .in('key', ['resend_api_key', 'resend_from_email']);
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach(r => { map[r.key] = r.value; });
      return map;
    },
  });

  useEffect(() => {
    if (resendSettings) {
      setResendApiKey(resendSettings['resend_api_key'] || '');
      setResendFromEmail(resendSettings['resend_from_email'] || '');
    }
  }, [resendSettings]);

  const saveResendSettings = useMutation({
    mutationFn: async () => {
      const rows = [
        { key: 'resend_api_key', value: resendApiKey },
        { key: 'resend_from_email', value: resendFromEmail },
      ];
      for (const row of rows) {
        if (row.value) {
          const { error } = await supabase.from('app_settings').upsert(row);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['resend-settings'] }); toast({ title: t('Đã lưu cài đặt Resend') }); },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  // Card surcharge setting
  const { data: cardSurchargeSetting } = useQuery({
    queryKey: ['card-surcharge-setting'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'card_surcharge_percent').single();
      if (error) return '0';
      return data.value;
    },
  });

  useEffect(() => {
    if (cardSurchargeSetting) setCardSurchargePercent(cardSurchargeSetting);
  }, [cardSurchargeSetting]);

  const saveCardSurcharge = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('app_settings').upsert({ key: 'card_surcharge_percent', value: cardSurchargePercent });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['card-surcharge-setting'] }); toast({ title: t('Đã lưu phụ phí thẻ') }); },
  });

  // OpenAI settings
  const { data: openaiSettings } = useQuery({
    queryKey: ['openai-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('key, value')
        .in('key', ['openai_api_key', 'openai_base_url']);
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach(r => { map[r.key] = r.value; });
      return map;
    },
  });

  useEffect(() => {
    if (openaiSettings) {
      setOpenaiApiKey(openaiSettings['openai_api_key'] || '');
      setOpenaiBaseUrl(openaiSettings['openai_base_url'] || '');
    }
  }, [openaiSettings]);

  const saveOpenaiSettings = useMutation({
    mutationFn: async () => {
      const rows = [
        { key: 'openai_api_key', value: openaiApiKey },
        { key: 'openai_base_url', value: openaiBaseUrl || 'https://api.openai.com/v1' },
      ];
      for (const row of rows) {
        if (row.value) {
          const { error } = await supabase.from('app_settings').upsert(row);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['openai-settings'] }); toast({ title: t('Đã lưu cài đặt OpenAI') }); },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  useEffect(() => {
    if (currencySettings) {
      setExchangeUSD(currencySettings['exchange_rate_usd'] || '0.000039');
      setExchangeEUR(currencySettings['exchange_rate_eur'] || '0.000036');
      setExchangeAUD(currencySettings['exchange_rate_aud'] || '0.000061');
      setDefaultCurrency(currencySettings['default_currency'] || 'AUD');
    }
  }, [currencySettings]);

  const saveCurrencySettings = useMutation({
    mutationFn: async () => {
      const rows = [
        { key: 'exchange_rate_usd', value: exchangeUSD },
        { key: 'exchange_rate_eur', value: exchangeEUR },
        { key: 'exchange_rate_aud', value: exchangeAUD },
        { key: 'default_currency', value: defaultCurrency },
      ];
      for (const row of rows) {
        const { error } = await supabase.from('app_settings').upsert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['currency-settings'] }); toast({ title: t('Đã lưu cài đặt tiền tệ') }); },
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-unavailability'] }); toast({ title: t('Đã thêm ngày nghỉ') }); },
  });

  const removeUnavailability = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('therapist_unavailability').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-unavailability'] }); toast({ title: t('Đã xoá ngày nghỉ') }); },
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shop-holidays'] }); toast({ title: t('Đã thêm ngày nghỉ tiệm') }); },
  });

  const removeHoliday = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shop_holidays').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shop-holidays'] }); toast({ title: t('Đã xoá ngày nghỉ tiệm') }); },
  });

  const cancelBooking = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }); toast({ title: t('Đã huỷ lịch hẹn') }); },
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }); toast({ title: t('Đã dời lịch hẹn') }); },
  });

  // Create booking from admin
  const createBooking = useMutation({
    mutationFn: async () => {
      const service = services?.find(s => s.id === bookingServiceId);
      if (!service || !bookingDate || !bookingTime || !bookingTherapistId) throw new Error('Missing fields');
      const [h, m] = bookingTime.split(':').map(Number);
      const endMin = h * 60 + m + service.duration_minutes;
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
      const { error } = await supabase.from('bookings').insert({
        service_id: bookingServiceId,
        therapist_id: bookingTherapistId,
        booking_date: format(bookingDate, 'yyyy-MM-dd'),
        start_time: bookingTime,
        end_time: endTime,
        customer_name: bookingCustomerName,
        customer_phone: bookingCustomerPhone,
        customer_email: bookingCustomerEmail || null,
        notes: bookingNotes || null,
        status: 'confirmed',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      setBookingDialog(false);
      resetBookingForm();
      toast({ title: t('Đã tạo lịch hẹn') });
    },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  const resetBookingForm = () => {
    setBookingServiceId('');
    setBookingTherapistId('');
    setBookingDate(undefined);
    setBookingTime('');
    setBookingCustomerName('');
    setBookingCustomerPhone('');
    setBookingCustomerEmail('');
    setBookingNotes('');
  };

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
      toast({ title: editingService ? t('Đã cập nhật dịch vụ') : t('Đã thêm dịch vụ') });
    },
  });

  const saveTherapist = useMutation({
    mutationFn: async () => {
      const payload = {
        name: therapistName,
        phone: therapistPhone || null,
        start_hour: parseInt(therapistStartHour),
        end_hour: parseInt(therapistEndHour),
        break_start: therapistBreakStart ? parseInt(therapistBreakStart) : null,
        break_end: therapistBreakEnd ? parseInt(therapistBreakEnd) : null,
      } as any;
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
      toast({ title: editingTherapist ? t('Đã cập nhật thợ') : t('Đã thêm thợ') });
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
    setTherapistBreakStart(therapist?.break_start ? String(therapist.break_start) : '');
    setTherapistBreakEnd(therapist?.break_end ? String(therapist.break_end) : '');
    setTherapistDialog(true);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { confirmed: t('Đã xác nhận'), cancelled: t('Đã huỷ'), completed: t('Hoàn thành') };
    const variant = status === 'confirmed' ? 'default' : status === 'cancelled' ? 'destructive' : 'secondary';
    return <Badge variant={variant as any}>{map[status] || status}</Badge>;
  };

  const formatPrice = (p: number) => `A$ ${p.toLocaleString()}`;

  // Generate time slots for booking
  const getTimeSlots = () => {
    const slots: string[] = [];
    for (let h = 9; h < 18; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    return slots;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p>{t('Đang tải...')}</p></div>;
  if (!user) return <Navigate to="/admin/login" />;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center"><p className="text-destructive">{t('Bạn không có quyền truy cập.')}</p></div>;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-primary" />
            <span className="font-semibold font-serif text-primary">{t('Quản trị Spa')}</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1" /> {t('Đăng xuất')}</Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="stats">
          <TabsList className="mb-6">
            <TabsTrigger value="stats">{t('Thống kê')}</TabsTrigger>
            <TabsTrigger value="bookings">{t('Lịch hẹn')}</TabsTrigger>
            <TabsTrigger value="sales"><DollarSign className="h-4 w-4 mr-1" /> {t('Thanh toán')}</TabsTrigger>
            <TabsTrigger value="services">{t('Dịch vụ')}</TabsTrigger>
            <TabsTrigger value="therapists">{t('Thợ')}</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1" /> {t('Cài đặt')}</TabsTrigger>
          </TabsList>

          {/* Stats Tab */}
          <TabsContent value="stats">
            <BookingStats />
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>{t('Lịch hẹn')}</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={filterTherapist} onValueChange={setFilterTherapist}>
                    <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('Tất cả thợ')}</SelectItem>
                      {therapists?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Dialog open={bookingDialog} onOpenChange={(open) => { setBookingDialog(open); if (!open) resetBookingForm(); }}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus className="h-4 w-4 mr-1" /> {t('Tạo lịch')}</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>{t('Tạo lịch hẹn mới')}</DialogTitle>
                        <DialogDescription>{t('Điền thông tin để tạo lịch hẹn cho khách hàng')}</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                        <div>
                          <Label>{t('Dịch vụ')}</Label>
                          <Select value={bookingServiceId} onValueChange={setBookingServiceId}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder={t('Chọn dịch vụ')} /></SelectTrigger>
                            <SelectContent>
                              {services?.filter(s => s.is_active).map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name} ({s.duration_minutes} {t('phút')} — {formatPrice(s.price)})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>{t('Thợ')}</Label>
                          <Select value={bookingTherapistId} onValueChange={setBookingTherapistId}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder={t('Chọn thợ')} /></SelectTrigger>
                            <SelectContent>
                              {therapists?.filter(t => t.is_active).map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>{t('Ngày')}</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className={cn("w-full mt-1 justify-start", !bookingDate && "text-muted-foreground")}>
                                {bookingDate ? format(bookingDate, 'dd/MM/yyyy') : t('Chọn ngày')}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={bookingDate} onSelect={setBookingDate} className="p-3 pointer-events-auto" />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label>{t('Giờ')}</Label>
                          <Select value={bookingTime} onValueChange={setBookingTime}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder={t('Chọn giờ')} /></SelectTrigger>
                            <SelectContent>
                              {getTimeSlots().map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>{t('Tên khách hàng')}</Label>
                          <Input value={bookingCustomerName} onChange={e => setBookingCustomerName(e.target.value)} className="mt-1" placeholder={t('Họ và tên')} />
                        </div>
                        <div>
                          <Label>{t('Số điện thoại')}</Label>
                          <Input value={bookingCustomerPhone} onChange={e => setBookingCustomerPhone(e.target.value)} className="mt-1" placeholder="0912345678" />
                        </div>
                        <div>
                          <Label>{t('Email (tuỳ chọn)')}</Label>
                          <Input value={bookingCustomerEmail} onChange={e => setBookingCustomerEmail(e.target.value)} className="mt-1" placeholder="email@example.com" />
                        </div>
                        <div>
                          <Label>{t('Ghi chú')}</Label>
                          <Textarea value={bookingNotes} onChange={e => setBookingNotes(e.target.value)} className="mt-1" placeholder={t('Ghi chú thêm...')} />
                        </div>
                        <Button className="w-full" onClick={() => createBooking.mutate()}
                          disabled={!bookingServiceId || !bookingTherapistId || !bookingDate || !bookingTime || !bookingCustomerName.trim() || !bookingCustomerPhone.trim()}>
                          {t('Tạo lịch hẹn')}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
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

          {/* Sales Tab */}
          <TabsContent value="sales">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>{t('Thanh toán')}</CardTitle>
                <Dialog open={saleDialog} onOpenChange={(open) => { setSaleDialog(open); if (!open) { setSaleType('booking'); setSaleBookingId(''); setSaleServiceId(''); setSaleCustomerName(''); setSaleAmount(''); setSalePaymentMethod('cash'); setSaleNotes(''); } }}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 mr-1" /> {t('Tạo thanh toán')}</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{t('Ghi nhận thanh toán')}</DialogTitle>
                      <DialogDescription>{t('Ghi nhận thanh toán cho dịch vụ')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      {/* Sale type toggle */}
                      <div>
                        <Label>{t('Loại')}</Label>
                        <div className="flex gap-2 mt-1">
                          <Button type="button" variant={saleType === 'booking' ? 'default' : 'outline'} className="flex-1" onClick={() => { setSaleType('booking'); setSaleServiceId(''); setSaleCustomerName(''); }}>
                            📅 {t('Lịch hẹn')}
                          </Button>
                          <Button type="button" variant={saleType === 'walkin' ? 'default' : 'outline'} className="flex-1" onClick={() => { setSaleType('walkin'); setSaleBookingId(''); }}>
                            🚶 {t('Khách vãng lai')}
                          </Button>
                        </div>
                      </div>

                      {saleType === 'booking' ? (
                        <div>
                          <Label>{t('Chọn lịch hẹn')}</Label>
                          <Select value={saleBookingId} onValueChange={(v) => {
                            setSaleBookingId(v);
                            if (v && v !== 'none') {
                              const booking = bookings?.find(b => b.id === v);
                              if (booking) setSaleAmount(String((booking as any).services?.price || 0));
                            }
                          }}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder={t('Chọn lịch hẹn')} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">{t('Không liên kết')}</SelectItem>
                              {bookings?.filter(b => b.status === 'confirmed').slice(0, 20).map(b => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.booking_date} {b.start_time?.slice(0, 5)} — {b.customer_name} ({(b as any).services?.name})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <>
                          <div>
                            <Label>{t('Dịch vụ')}</Label>
                            <Select value={saleServiceId} onValueChange={(v) => {
                              setSaleServiceId(v);
                              const svc = services?.find(s => s.id === v);
                              if (svc) setSaleAmount(String(svc.price));
                            }}>
                              <SelectTrigger className="mt-1"><SelectValue placeholder={t('Chọn dịch vụ')} /></SelectTrigger>
                              <SelectContent>
                                {services?.filter(s => s.is_active).map(s => (
                                  <SelectItem key={s.id} value={s.id}>{s.name} — {formatPrice(s.price)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>{t('Tên khách hàng')}</Label>
                            <Input value={saleCustomerName} onChange={e => setSaleCustomerName(e.target.value)} className="mt-1" placeholder={t('Nhập tên khách')} />
                          </div>
                        </>
                      )}

                      <div>
                        <Label>{t('Số tiền (AUD)')}</Label>
                        <Input type="number" value={saleAmount} onChange={e => setSaleAmount(e.target.value)} className="mt-1" placeholder="0" />
                      </div>
                      <div>
                        <Label>{t('Phương thức thanh toán')}</Label>
                        <div className="flex gap-2 mt-1">
                          <Button type="button" variant={salePaymentMethod === 'cash' ? 'default' : 'outline'} className="flex-1" onClick={() => setSalePaymentMethod('cash')}>
                            💵 {t('Tiền mặt')}
                          </Button>
                          <Button type="button" variant={salePaymentMethod === 'card' ? 'default' : 'outline'} className="flex-1" onClick={() => setSalePaymentMethod('card')}>
                            💳 {t('Thẻ')}
                          </Button>
                        </div>
                        {salePaymentMethod === 'card' && parseFloat(cardSurchargeSetting || '0') > 0 && saleAmount && (
                          <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-sm text-amber-700 dark:text-amber-400">
                            ⚠️ {t('Phụ phí thẻ')}: {cardSurchargeSetting}% = <strong>A$ {(parseFloat(saleAmount) * parseFloat(cardSurchargeSetting) / 100).toFixed(2)}</strong>
                            <br />{t('Tổng')}: <strong>A$ {(parseFloat(saleAmount) * (1 + parseFloat(cardSurchargeSetting) / 100)).toFixed(2)}</strong>
                          </div>
                        )}
                      </div>
                      <div>
                        <Label>{t('Ghi chú')}</Label>
                        <Textarea value={saleNotes} onChange={e => setSaleNotes(e.target.value)} className="mt-1" placeholder={t('Ghi chú thêm...')} />
                      </div>
                      <Button className="w-full" onClick={() => createSale.mutate()}
                        disabled={!saleAmount || parseFloat(saleAmount) <= 0}>
                        {t('Ghi nhận thanh toán')}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {(!sales || sales.length === 0) ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">{t('Chưa có thanh toán')}</p>
                    <p className="text-xs mt-1">{t('Tạo thanh toán để dữ liệu xuất hiện')}</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('Ngày')}</TableHead>
                        <TableHead>{t('Khách hàng')}</TableHead>
                        <TableHead>{t('Dịch vụ')}</TableHead>
                        <TableHead>{t('Số tiền')}</TableHead>
                        <TableHead>{t('Phương thức')}</TableHead>
                        <TableHead>{t('Ghi chú')}</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-sm">{s.sale_date}</TableCell>
                          <TableCell className="text-sm">{s.bookings?.customer_name || '—'}</TableCell>
                          <TableCell className="text-sm">{s.bookings?.services?.name || '—'}</TableCell>
                          <TableCell className="font-semibold">A$ {Number(s.amount).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={s.payment_method === 'card' ? 'default' : 'secondary'}>
                              {s.payment_method === 'card' ? '💳 ' + t('Thẻ') : '💵 ' + t('Tiền mặt')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{s.notes || '—'}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteSale.mutate(s.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>{t('Quản lý dịch vụ')}</CardTitle>
                <Dialog open={serviceDialog} onOpenChange={setServiceDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => openServiceEdit()}><Plus className="h-4 w-4 mr-1" /> {t('Thêm')}</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingService ? t('Sửa dịch vụ') : t('Thêm dịch vụ')}</DialogTitle>
                      <DialogDescription>{editingService ? t('Chỉnh sửa thông tin dịch vụ') : t('Thêm dịch vụ mới vào hệ thống')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div><Label>{t('Tên')}</Label><Input value={serviceName} onChange={e => setServiceName(e.target.value)} className="mt-1" /></div>
                      <div><Label>{t('Mô tả')}</Label><Textarea value={serviceDesc} onChange={e => setServiceDesc(e.target.value)} className="mt-1" /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>{t('Thời gian (phút)')}</Label><Input type="number" value={serviceDuration} onChange={e => setServiceDuration(e.target.value)} className="mt-1" /></div>
                        <div><Label>{t('Giá (AUD)')}</Label><Input type="number" value={servicePrice} onChange={e => setServicePrice(e.target.value)} className="mt-1" /></div>
                      </div>
                      <Button className="w-full" onClick={() => saveService.mutate()} disabled={!serviceName.trim()}>
                        {editingService ? t('Cập nhật') : t('Thêm mới')}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Tên')}</TableHead>
                      <TableHead>{t('Thời gian')}</TableHead>
                      <TableHead>{t('Giá')}</TableHead>
                      <TableHead>{t('Trạng thái')}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services?.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.duration_minutes} {t('phút')}</TableCell>
                        <TableCell>{formatPrice(s.price)}</TableCell>
                        <TableCell><Badge variant={s.is_active ? 'default' : 'secondary'}>{s.is_active ? t('Hoạt động') : t('Tắt')}</Badge></TableCell>
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
            {/* Unavailability */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('Ngày nghỉ / Không khả dụng')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Select value={unavailTherapist} onValueChange={setUnavailTherapist}>
                    <SelectTrigger className="w-[160px]"><SelectValue placeholder={t('Chọn thợ')} /></SelectTrigger>
                    <SelectContent>
                      {therapists?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn(!unavailDate && "text-muted-foreground")}>
                        <CalendarOff className="h-4 w-4 mr-1" />
                        {unavailDate ? format(unavailDate, 'dd/MM/yyyy') : t('Chọn ngày')}
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
                    <Plus className="h-4 w-4 mr-1" /> {t('Thêm ngày nghỉ')}
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
                <CardTitle className="text-base">{t('Ngày nghỉ tiệm / Đóng cửa sớm')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 items-end">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn(!holidayDate && "text-muted-foreground")}>
                        <CalendarOff className="h-4 w-4 mr-1" />
                        {holidayDate ? format(holidayDate, 'dd/MM/yyyy') : t('Chọn ngày')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={holidayDate} onSelect={setHolidayDate} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <div className="flex items-center gap-1">
                    <Label className="text-xs whitespace-nowrap">{t('Đóng cửa sớm lúc')}</Label>
                    <Select value={earlyCloseHour} onValueChange={setEarlyCloseHour}>
                      <SelectTrigger className="w-[90px] h-8"><SelectValue placeholder={t('Không')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('Nghỉ cả ngày')}</SelectItem>
                        {Array.from({ length: 13 }, (_, i) => i + 10).map(h => (
                          <SelectItem key={h} value={String(h)}>{h}:00</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input placeholder={t('Lý do (tuỳ chọn)')} value={holidayReason} onChange={e => setHolidayReason(e.target.value)} className="w-[180px]" />
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
                    <Plus className="h-4 w-4 mr-1" /> {t('Thêm')}
                  </Button>
                </div>
                {shopHolidays && shopHolidays.length > 0 && (
                  <div className="space-y-1">
                    {shopHolidays.filter((h: any) => h.holiday_date >= format(new Date(), 'yyyy-MM-dd')).map((h: any) => (
                      <div key={h.id} className="flex items-center justify-between py-1.5 px-3 bg-destructive/10 rounded text-sm">
                        <span>
                          {h.early_close_hour ? '⏰' : '🏖️'} <strong>{h.holiday_date}</strong>
                          {h.early_close_hour ? ` — ${t('Đóng cửa lúc')} ${h.early_close_hour}:00` : ` — ${t('Nghỉ cả ngày')}`}
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
                <CardTitle>{t('Danh sách thợ')}</CardTitle>
                <Dialog open={therapistDialog} onOpenChange={setTherapistDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => openTherapistEdit()}><Plus className="h-4 w-4 mr-1" /> {t('Thêm')}</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingTherapist ? t('Sửa thông tin thợ') : t('Thêm thợ')}</DialogTitle>
                      <DialogDescription>{editingTherapist ? t('Chỉnh sửa thông tin thợ') : t('Thêm thợ mới vào hệ thống')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div><Label>{t('Tên')}</Label><Input value={therapistName} onChange={e => setTherapistName(e.target.value)} className="mt-1" /></div>
                      <div><Label>{t('SĐT')}</Label><Input value={therapistPhone} onChange={e => setTherapistPhone(e.target.value)} className="mt-1" /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>{t('Giờ bắt đầu')}</Label><Input type="number" min="6" max="22" value={therapistStartHour} onChange={e => setTherapistStartHour(e.target.value)} className="mt-1" /></div>
                        <div><Label>{t('Giờ kết thúc')}</Label><Input type="number" min="6" max="22" value={therapistEndHour} onChange={e => setTherapistEndHour(e.target.value)} className="mt-1" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>{t('Nghỉ trưa từ')}</Label><Input type="number" min="6" max="22" placeholder="VD: 12" value={therapistBreakStart} onChange={e => setTherapistBreakStart(e.target.value)} className="mt-1" /></div>
                        <div><Label>{t('Nghỉ trưa đến')}</Label><Input type="number" min="6" max="22" placeholder="VD: 13" value={therapistBreakEnd} onChange={e => setTherapistBreakEnd(e.target.value)} className="mt-1" /></div>
                      </div>
                      <Button className="w-full" onClick={() => saveTherapist.mutate()} disabled={!therapistName.trim()}>
                        {editingTherapist ? t('Cập nhật') : t('Thêm mới')}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Tên')}</TableHead>
                      <TableHead>{t('SĐT')}</TableHead>
                      <TableHead>{t('Giờ làm việc')}</TableHead>
                      <TableHead>{t('Trạng thái')}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {therapists?.map(th => (
                      <TableRow key={th.id}>
                        <TableCell className="font-medium">{th.name}</TableCell>
                        <TableCell>{th.phone || '—'}</TableCell>
                        <TableCell className="text-sm">
                          {th.start_hour}:00 – {th.end_hour}:00
                          {th.break_start != null && th.break_end != null && (
                            <span className="text-muted-foreground ml-1">({th.break_start}:00–{th.break_end}:00)</span>
                          )}
                        </TableCell>
                        <TableCell><Badge variant={th.is_active ? 'default' : 'secondary'}>{th.is_active ? t('Hoạt động') : t('Tắt')}</Badge></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openTherapistEdit(th)}><Pencil className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            {/* Shop Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">🏪 {t('Thông tin tiệm')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t('Số điện thoại tiệm')}</Label>
                  <Input value={shopPhone} onChange={e => setShopPhone(e.target.value)} className="mt-1" placeholder="+84 123 456 789" />
                </div>
                <div>
                  <Label>{t('Địa chỉ')}</Label>
                  <Input value={shopAddress} onChange={e => setShopAddress(e.target.value)} className="mt-1" placeholder={t('Nhập địa chỉ tiệm')} />
                </div>
                <Button size="sm" onClick={() => saveShopInfo.mutate()}>{t('Lưu thông tin')}</Button>
              </CardContent>
            </Card>

            {/* Random therapist toggle */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{t('Tự động chọn thợ ngẫu nhiên')}</p>
                  <p className="text-xs text-muted-foreground">{t('Cho phép khách chọn "bất kỳ thợ trống" khi đặt lịch')}</p>
                </div>
                <Switch checked={randomEnabled !== false} onCheckedChange={(v) => toggleRandom.mutate(v)} />
              </CardContent>
            </Card>

            {/* Currency Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">💱 {t('Cài đặt tiền tệ')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t('Đơn vị tiền mặc định (cho khách English)')}</Label>
                  <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                    <SelectTrigger className="mt-1 w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs">1 VNĐ → USD</Label>
                    <Input type="text" value={exchangeUSD} onChange={e => setExchangeUSD(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">1 VNĐ → EUR</Label>
                    <Input type="text" value={exchangeEUR} onChange={e => setExchangeEUR(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">1 VNĐ → AUD</Label>
                    <Input type="text" value={exchangeAUD} onChange={e => setExchangeAUD(e.target.value)} className="mt-1" />
                  </div>
                </div>
                <Button size="sm" onClick={() => saveCurrencySettings.mutate()}>{t('Lưu cài đặt tiền tệ')}</Button>
              </CardContent>
            </Card>

            {/* SMS & WhatsApp Notification Settings */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="font-medium text-sm">📱 {t('Nhắc lịch qua SMS & WhatsApp')}</p>
                  <p className="text-xs text-muted-foreground">{t('Gửi SMS/WhatsApp nhắc khách hàng 1 tiếng trước lịch hẹn')}</p>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder={twilioNumber || t("Số Twilio (vd: +84123456789)")}
                    value={smsNumber}
                    onChange={e => setSmsNumber(e.target.value)}
                    className="flex-1"
                  />
                  <Button size="sm" disabled={!smsNumber.trim()} onClick={() => { saveSmsNumber.mutate(smsNumber.trim()); setSmsNumber(''); }}>
                    {t('Lưu')}
                  </Button>
                </div>
                {twilioNumber && (
                  <p className="text-xs text-muted-foreground">{t('Số hiện tại')}: <strong>{twilioNumber}</strong></p>
                )}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div>
                    <p className="font-medium text-sm">💬 WhatsApp</p>
                    <p className="text-xs text-muted-foreground">{t('Gửi thêm nhắc nhở qua WhatsApp')}</p>
                  </div>
                  <Switch checked={whatsappEnabled === true} onCheckedChange={(v) => toggleWhatsapp.mutate(v)} />
                </div>
              </CardContent>
            </Card>
            {/* Resend Email Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">📧 {t('Cài đặt email')} (Resend)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t('Resend API Key')}</Label>
                  <Input
                    type="password"
                    value={resendApiKey}
                    onChange={e => setResendApiKey(e.target.value)}
                    placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="mt-1 font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('Lấy API key tại')} <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">resend.com/api-keys</a>
                  </p>
                </div>
                <div>
                  <Label>{t('Email gửi từ')} ({t('From address')})</Label>
                  <Input
                    value={resendFromEmail}
                    onChange={e => setResendFromEmail(e.target.value)}
                    placeholder="noreply@yourdomain.com"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('Dùng')} <code className="text-xs">onboarding@resend.dev</code> {t('để test, hoặc domain đã xác minh trên Resend')}
                  </p>
                </div>
                <Button size="sm" onClick={() => saveResendSettings.mutate()} disabled={!resendApiKey.trim()}>
                  {t('Lưu cài đặt email')}
                </Button>
                {resendSettings?.['resend_api_key'] && (
                  <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                    <p className="text-muted-foreground">✅ {t('Resend API key đã được cấu hình')}</p>
                    <p className="text-muted-foreground">{t('Email gửi từ')}: <strong>{resendSettings['resend_from_email'] || 'onboarding@resend.dev'}</strong></p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card Surcharge Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">💳 {t('Phụ phí thẻ tín dụng')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>{t('Phần trăm phụ phí (%)')}</Label>
                  <Input
                    type="number"
                    min="0"
                    max="20"
                    step="0.1"
                    value={cardSurchargePercent}
                    onChange={e => setCardSurchargePercent(e.target.value)}
                    className="mt-1 w-[120px]"
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('Phụ phí sẽ được tự động cộng thêm khi khách thanh toán bằng thẻ')}</p>
                </div>
                <Button size="sm" onClick={() => saveCardSurcharge.mutate()}>{t('Lưu')}</Button>
              </CardContent>
            </Card>

            {/* OpenAI Translation Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('Cài đặt dịch thuật')} (OpenAI)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t('OpenAI API Key')}</Label>
                  <Input
                    type="password"
                    value={openaiApiKey}
                    onChange={e => setOpenaiApiKey(e.target.value)}
                    placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                    className="mt-1 font-mono text-sm"
                  />
                </div>
                <div>
                  <Label>{t('Base URL')}</Label>
                  <Input
                    value={openaiBaseUrl}
                    onChange={e => setOpenaiBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="mt-1 font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('Để trống nếu dùng OpenAI mặc định')}</p>
                </div>
                <Button size="sm" onClick={() => saveOpenaiSettings.mutate()} disabled={!openaiApiKey.trim()}>
                  {t('Lưu cài đặt dịch thuật')}
                </Button>
                {openaiSettings?.['openai_api_key'] && (
                  <div className="bg-muted rounded-lg p-3 text-sm">
                    <p className="text-muted-foreground">{t('API key đã được cấu hình')}</p>
                    {openaiSettings['openai_base_url'] && (
                      <p className="text-muted-foreground">Base URL: <strong>{openaiSettings['openai_base_url']}</strong></p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
