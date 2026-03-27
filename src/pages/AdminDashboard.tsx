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
import { Leaf, LogOut, Plus, Pencil, CalendarOff, X, Settings, DollarSign, Trash2, BarChart3, CalendarDays, Scissors, Users, AlertTriangle, Tag, Crown, UserCheck, Search } from 'lucide-react';
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
  const [saleCustomerPhone, setSaleCustomerPhone] = useState('');
  const [saleAmount, setSaleAmount] = useState('');
  const [salePaymentMethod, setSalePaymentMethod] = useState<'cash' | 'card'>('cash');
  const [saleNotes, setSaleNotes] = useState('');
  const [saleAddOns, setSaleAddOns] = useState<string[]>([]);

  // Create admin state
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [deletingAdminId, setDeletingAdminId] = useState<string | null>(null);

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

  // Sales filter state
  const [salesFilterMethod, setSalesFilterMethod] = useState('all');
  const [salesFilterDateFrom, setSalesFilterDateFrom] = useState('');
  const [salesFilterDateTo, setSalesFilterDateTo] = useState('');
  const [salesFilterSearch, setSalesFilterSearch] = useState('');

  // OpenAI settings state
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');

  // Reminder settings state
  const [reminderEmailEnabled, setReminderEmailEnabled] = useState(false);
  const [reminderSmsEnabled, setReminderSmsEnabled] = useState(false);
  const [reminder1stHours, setReminder1stHours] = useState('24');
  const [reminder2ndHours, setReminder2ndHours] = useState('1');

  // Membership & discount state
  const [membershipDialog, setMembershipDialog] = useState(false);
  const [editingTier, setEditingTier] = useState<any>(null);
  const [tierName, setTierName] = useState('');
  const [tierMinVisits, setTierMinVisits] = useState('0');
  const [tierDiscountPercent, setTierDiscountPercent] = useState('0');

  const [discountDialog, setDiscountDialog] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<any>(null);
  const [discountCode, setDiscountCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [discountValidFrom, setDiscountValidFrom] = useState('');
  const [discountValidTo, setDiscountValidTo] = useState('');
  const [discountMaxUses, setDiscountMaxUses] = useState('');

  // Delete all data state
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Customer list state
  const [customerSearch, setCustomerSearch] = useState('');

  const { data: bookings } = useQuery({
    queryKey: ['admin-bookings', filterTherapist],
    queryFn: async () => {
      let query = supabase.from('bookings').select('*, services(name, duration_minutes, price), therapists(name)')
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
      return data as any[];
    },
  });

  const createSale = useMutation({
    mutationFn: async () => {
      const addOnTotal = saleAddOns.reduce((sum, id) => {
        const svc = services?.find(s => s.id === id);
        return sum + (svc?.price || 0);
      }, 0);
      const baseAmount = parseFloat(saleAmount) + addOnTotal;
      const surcharge = salePaymentMethod === 'card' ? baseAmount * (parseFloat(cardSurchargeSetting || '0') / 100) : 0;
      const totalAmount = baseAmount + surcharge;
      const payload: any = {
        amount: totalAmount,
        payment_method: salePaymentMethod,
        notes: saleNotes || null,
        sale_date: format(new Date(), 'yyyy-MM-dd'),
        customer_phone: saleCustomerPhone || null,
        customer_name: saleCustomerName || null,
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
      setSaleCustomerPhone('');
      setSaleAmount('');
      setSalePaymentMethod('cash');
      setSaleNotes('');
      setSaleAddOns([]);
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
        .in('key', ['openai_api_key', 'openai_base_url', 'openai_model']);
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
      setOpenaiModel(openaiSettings['openai_model'] || 'gpt-4o-mini');
    }
  }, [openaiSettings]);

  const saveOpenaiSettings = useMutation({
    mutationFn: async () => {
      const rows = [
        { key: 'openai_api_key', value: openaiApiKey },
        { key: 'openai_base_url', value: openaiBaseUrl || 'https://api.openai.com/v1' },
        { key: 'openai_model', value: openaiModel || 'gpt-4o-mini' },
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

  // Reminder settings
  const { data: reminderSettings } = useQuery({
    queryKey: ['reminder-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('key, value')
        .in('key', ['reminder_email_enabled', 'reminder_sms_enabled', 'reminder_1st_hours', 'reminder_2nd_hours']);
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach(r => { map[r.key] = r.value; });
      return map;
    },
  });

  useEffect(() => {
    if (reminderSettings) {
      setReminderEmailEnabled(reminderSettings['reminder_email_enabled'] === 'true');
      setReminderSmsEnabled(reminderSettings['reminder_sms_enabled'] === 'true');
      setReminder1stHours(reminderSettings['reminder_1st_hours'] || '24');
      setReminder2ndHours(reminderSettings['reminder_2nd_hours'] || '1');
    }
  }, [reminderSettings]);

  const saveReminderSettings = useMutation({
    mutationFn: async () => {
      const rows = [
        { key: 'reminder_email_enabled', value: String(reminderEmailEnabled) },
        { key: 'reminder_sms_enabled', value: String(reminderSmsEnabled) },
        { key: 'reminder_1st_hours', value: reminder1stHours },
        { key: 'reminder_2nd_hours', value: reminder2ndHours },
      ];
      for (const row of rows) {
        const { error } = await supabase.from('app_settings').upsert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['reminder-settings'] }); toast({ title: t('Đã lưu cài đặt nhắc lịch') }); },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  // Membership tiers
  const { data: membershipTiers } = useQuery({
    queryKey: ['membership-tiers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('membership_tiers').select('*').order('min_visits');
      if (error) throw error;
      return data;
    },
  });

  const saveTier = useMutation({
    mutationFn: async () => {
      const payload = { name: tierName, min_visits: parseInt(tierMinVisits), discount_percent: parseFloat(tierDiscountPercent) };
      if (editingTier) {
        const { error } = await supabase.from('membership_tiers').update(payload).eq('id', editingTier.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('membership_tiers').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['membership-tiers'] }); setMembershipDialog(false); setEditingTier(null); toast({ title: t('Đã lưu hạng thành viên') }); },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  const deleteTier = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('membership_tiers').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['membership-tiers'] }); toast({ title: t('Đã xoá') }); },
  });

  const toggleTierActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => { const { error } = await supabase.from('membership_tiers').update({ is_active: active }).eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['membership-tiers'] }); },
  });

  // Discount codes
  const { data: discountCodes } = useQuery({
    queryKey: ['discount-codes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveDiscount = useMutation({
    mutationFn: async () => {
      const payload: any = {
        code: discountCode.toUpperCase().trim(),
        discount_percent: parseFloat(discountPercent),
        discount_amount: parseFloat(discountAmount),
        valid_from: discountValidFrom || null,
        valid_to: discountValidTo || null,
        max_uses: discountMaxUses ? parseInt(discountMaxUses) : null,
      };
      if (editingDiscount) {
        const { error } = await supabase.from('discount_codes').update(payload).eq('id', editingDiscount.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('discount_codes').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['discount-codes'] }); setDiscountDialog(false); setEditingDiscount(null); toast({ title: t('Đã lưu mã giảm giá') }); },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  const deleteDiscount = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('discount_codes').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['discount-codes'] }); toast({ title: t('Đã xoá') }); },
  });

  const toggleDiscountActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => { const { error } = await supabase.from('discount_codes').update({ is_active: active }).eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['discount-codes'] }); },
  });

  // Membership & discount enabled toggles
  const { data: membershipEnabled } = useQuery({
    queryKey: ['membership-enabled'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'membership_enabled').single();
      if (error) return false;
      return data.value === 'true';
    },
  });

  const { data: discountCodesEnabled } = useQuery({
    queryKey: ['discount-codes-enabled'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'discount_codes_enabled').single();
      if (error) return false;
      return data.value === 'true';
    },
  });

  const toggleMembership = useMutation({
    mutationFn: async (enabled: boolean) => { const { error } = await supabase.from('app_settings').upsert({ key: 'membership_enabled', value: String(enabled) }); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['membership-enabled'] }); toast({ title: t('Đã cập nhật') }); },
  });

  const toggleDiscountCodes = useMutation({
    mutationFn: async (enabled: boolean) => { const { error } = await supabase.from('app_settings').upsert({ key: 'discount_codes_enabled', value: String(enabled) }); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['discount-codes-enabled'] }); toast({ title: t('Đã cập nhật') }); },
  });

  // Delete all data
  const handleDeleteAllData = async () => {
    if (!deletePassword.trim()) return;
    setDeleting(true);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-all-data`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s?.access_token}` },
          body: JSON.stringify({ password: deletePassword }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed');
      toast({ title: t('Đã xoá tất cả dữ liệu') });
      setDeleteDialog(false);
      setDeletePassword('');
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast({ title: t('Lỗi'), description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  // Guest visits / customers
  const { data: guestVisits } = useQuery({
    queryKey: ['guest-visits'],
    queryFn: async () => {
      const { data, error } = await supabase.from('guest_visits').select('*, membership_tiers(name, discount_percent)').order('visit_count', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredCustomers = (guestVisits || []).filter(g => {
    if (!customerSearch.trim()) return true;
    const s = customerSearch.toLowerCase();
    return g.customer_phone?.toLowerCase().includes(s) || g.customer_name?.toLowerCase().includes(s);
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

  // Admin accounts list
  const { data: adminAccounts, refetch: refetchAdmins } = useQuery({
    queryKey: ['admin-accounts'],
    queryFn: async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-admins`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${s?.access_token}`,
          },
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed');
      return result.admins as { id: string; email: string; created_at: string; is_current: boolean }[];
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

  const deleteBooking = useMutation({
    mutationFn: async (id: string) => {
      // Delete associated sales first
      await supabase.from('sales').delete().eq('booking_id', id);
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-sales'] });
      toast({ title: t('Đã xoá lịch hẹn') });
    },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
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
      if (!service || !bookingDate || !bookingTime) throw new Error('Missing fields');
      
      // Resolve therapist: if still "random", find from available slots
      let therapistId = bookingTherapistId;
      if (therapistId === 'random') {
        const slot = availableSlots.find(s => s.time === bookingTime && s.available);
        if (!slot?.therapistId) throw new Error('No available therapist');
        therapistId = slot.therapistId;
      }
      if (!therapistId) throw new Error('Missing therapist');
      
      const [h, m] = bookingTime.split(':').map(Number);
      const endMin = h * 60 + m + service.duration_minutes;
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
      const { error } = await supabase.from('bookings').insert({
        service_id: bookingServiceId,
        therapist_id: therapistId,
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

  // Generate available time slots for admin booking
  const getAvailableTimeSlots = () => {
    if (!bookingDate || !bookingServiceId) return [];
    const service = services?.find(s => s.id === bookingServiceId);
    if (!service) return [];
    const dateStr = format(bookingDate, 'yyyy-MM-dd');
    const duration = service.duration_minutes;
    const BUFFER = 15;

    // Get candidate therapists
    const candidateTherapists = bookingTherapistId && bookingTherapistId !== 'random'
      ? therapists?.filter(t => t.id === bookingTherapistId) || []
      : therapists?.filter(t => t.is_active) || [];

    // Check unavailability for the date
    const unavailableTherapistIds = new Set(
      (unavailabilities || []).filter(u => u.unavailable_date === dateStr).map(u => u.therapist_id)
    );

    // If specific therapist selected and they're unavailable, return empty
    if (bookingTherapistId && bookingTherapistId !== 'random' && unavailableTherapistIds.has(bookingTherapistId)) {
      return [];
    }

    // Check shop holidays
    const holiday = (shopHolidays || []).find(h => h.holiday_date === dateStr);
    if (holiday && !holiday.early_close_hour) return []; // full day off

    const dayBookings = (bookings || []).filter(b => b.booking_date === dateStr && b.status === 'confirmed');

    const allSlots: string[] = [];
    for (let h = 9; h < 18; h++) {
      allSlots.push(`${String(h).padStart(2, '0')}:00`);
      allSlots.push(`${String(h).padStart(2, '0')}:15`);
      allSlots.push(`${String(h).padStart(2, '0')}:30`);
      allSlots.push(`${String(h).padStart(2, '0')}:45`);
    }

    type SlotInfo = { time: string; available: boolean; therapistId?: string; therapistName?: string };
    const result: SlotInfo[] = [];

    for (const slot of allSlots) {
      const [sh, sm] = slot.split(':').map(Number);
      const startMins = sh * 60 + sm;
      const endMins = startMins + duration;

      if (endMins > (holiday?.early_close_hour || 18) * 60) {
        result.push({ time: slot, available: false });
        continue;
      }

      // Find first available therapist for this slot
      let foundTherapist: { id: string; name: string } | null = null;
      for (const th of candidateTherapists) {
        if (unavailableTherapistIds.has(th.id)) continue;
        const dayOfWeek = bookingDate.getDay() === 0 ? 7 : bookingDate.getDay();
        if (!th.working_days.includes(dayOfWeek)) continue;
        if (sh < th.start_hour || endMins > th.end_hour * 60) continue;
        if (th.break_start && th.break_end) {
          const breakStartMin = th.break_start * 60;
          const breakEndMin = th.break_end * 60;
          if (startMins < breakEndMin && endMins > breakStartMin) continue;
        }

        // Check conflicts with existing bookings for this therapist
        const hasConflict = dayBookings.some(b => {
          if (b.therapist_id !== th.id) return false;
          const bStart = timeToMins(b.start_time);
          const bEnd = timeToMins(b.end_time) + BUFFER;
          return startMins < bEnd && endMins > bStart - BUFFER;
        });
        if (!hasConflict) {
          foundTherapist = { id: th.id, name: th.name };
          break;
        }
      }

      result.push({
        time: slot,
        available: !!foundTherapist,
        therapistId: foundTherapist?.id,
        therapistName: foundTherapist?.name,
      });
    }

    return result;
  };

  const timeToMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const availableSlots = getAvailableTimeSlots();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p>{t('Đang tải...')}</p></div>;
  if (!user) return <Navigate to="/admin/login" />;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center"><p className="text-destructive">{t('Bạn không có quyền truy cập.')}</p></div>;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <Leaf className="h-5 w-5 text-primary/70" />
            <span className="font-semibold font-serif text-primary tracking-wide">{t('Quản trị Spa')}</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs gap-1.5" onClick={signOut}>
              <LogOut className="h-3.5 w-3.5" /> {t('Đăng xuất')}
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 pb-24 sm:pb-6">
        <Tabs defaultValue="stats">
          {/* Desktop tabs - hidden on mobile */}
          <TabsList className="mb-6 hidden sm:inline-flex h-11 bg-muted/50 p-1 rounded-xl gap-1">
            <TabsTrigger value="stats" className="rounded-lg px-4 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-foreground">{t('Thống kê')}</TabsTrigger>
            <TabsTrigger value="bookings" className="rounded-lg px-4 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-foreground">{t('Lịch hẹn')}</TabsTrigger>
            <TabsTrigger value="customers" className="rounded-lg px-4 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-foreground">{t('Khách hàng')}</TabsTrigger>
            <TabsTrigger value="sales" className="rounded-lg px-4 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-foreground">{t('Thanh toán')}</TabsTrigger>
            <TabsTrigger value="services" className="rounded-lg px-4 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-foreground">{t('Dịch vụ')}</TabsTrigger>
            <TabsTrigger value="therapists" className="rounded-lg px-4 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-foreground">{t('Thợ')}</TabsTrigger>
            <TabsTrigger value="settings" className="rounded-lg px-4 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-foreground">{t('Cài đặt')}</TabsTrigger>
          </TabsList>

          {/* Mobile bottom nav */}
          <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-card/95 backdrop-blur-md border-t border-border/40 safe-bottom">
            <TabsList className="w-full h-auto bg-transparent rounded-none grid grid-cols-7 gap-0 p-0">
              {[
                { value: 'stats', icon: BarChart3, label: t('Thống kê') },
                { value: 'bookings', icon: CalendarDays, label: t('Lịch') },
                { value: 'customers', icon: UserCheck, label: t('Khách') },
                { value: 'sales', icon: DollarSign, label: t('Thu') },
                { value: 'services', icon: Scissors, label: t('Dịch vụ') },
                { value: 'therapists', icon: Users, label: t('Thợ') },
                { value: 'settings', icon: Settings, label: t('Cài đặt') },
              ].map(tab => (
                <TabsTrigger key={tab.value} value={tab.value} className="flex-col gap-1 py-2.5 px-1 rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none h-auto text-xs text-muted-foreground transition-colors">
                  <tab.icon className="h-5 w-5" />
                  <span className="text-[10px] leading-tight">{tab.label}</span>
                  <div className="h-1 w-1 rounded-full data-[state=active]:bg-primary bg-transparent" />
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Stats Tab */}
          <TabsContent value="stats">
            <BookingStats />
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers">
            <Card>
              <CardHeader className="space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-primary/70" />
                    {t('Khách hàng')}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{filteredCustomers.length} {t('khách hàng')}</p>
                </div>
                <div className="relative w-full sm:w-[250px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('Tìm theo tên hoặc SĐT...')}
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {filteredCustomers.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">{t('Chưa có khách hàng')}</p>
                    <p className="text-xs mt-1">{t('Khách hàng sẽ được theo dõi tự động khi hoàn thành lịch hẹn')}</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('Khách hàng')}</TableHead>
                            <TableHead>{t('Số điện thoại')}</TableHead>
                            <TableHead className="text-center">{t('Lần ghé')}</TableHead>
                            <TableHead>{t('Hạng thành viên')}</TableHead>
                            <TableHead>{t('Giảm giá')}</TableHead>
                            <TableHead>{t('Cập nhật')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCustomers.map(g => (
                            <TableRow key={g.id}>
                              <TableCell className="font-medium">{g.customer_name || '—'}</TableCell>
                              <TableCell className="font-mono text-sm">{g.customer_phone}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className="tabular-nums">{g.visit_count}</Badge>
                              </TableCell>
                              <TableCell>
                                {(g as any).membership_tiers ? (
                                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 border">
                                    <Crown className="h-3 w-3 mr-1" />
                                    {(g as any).membership_tiers.name}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">{t('Chưa có')}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {(g as any).membership_tiers?.discount_percent ? (
                                  <span className="text-sm font-medium text-emerald-600">{(g as any).membership_tiers.discount_percent}%</span>
                                ) : '—'}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(g.updated_at).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile cards */}
                    <div className="sm:hidden space-y-2">
                      {filteredCustomers.map(g => (
                        <div key={g.id} className="p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-full bg-primary/5 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                                {(g.customer_name || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{g.customer_name || '—'}</p>
                                <p className="text-xs text-muted-foreground font-mono">{g.customer_phone}</p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="tabular-nums">{g.visit_count} {t('lần')}</Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-2 pl-[46px]">
                            {(g as any).membership_tiers ? (
                              <Badge className="bg-amber-50 text-amber-700 border-amber-200 border text-[10px]">
                                <Crown className="h-2.5 w-2.5 mr-0.5" />
                                {(g as any).membership_tiers.name} · {(g as any).membership_tiers.discount_percent}% {t('giảm')}
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">{t('Chưa có hạng')}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings">
            <Card>
              <CardHeader className="space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>{t('Lịch hẹn')}</CardTitle>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Select value={filterTherapist} onValueChange={setFilterTherapist}>
                    <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('Tất cả thợ')}</SelectItem>
                      {therapists?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Dialog open={bookingDialog} onOpenChange={(open) => { setBookingDialog(open); if (!open) resetBookingForm(); }}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-1" /> {t('Tạo lịch')}</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
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
                          <Select value={bookingTherapistId} onValueChange={(v) => { setBookingTherapistId(v); setBookingTime(''); }}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder={t('Chọn thợ')} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="random">{t('Tự động (ai rảnh)')}</SelectItem>
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
                              <Calendar mode="single" selected={bookingDate} onSelect={(d) => { setBookingDate(d); setBookingTime(''); }} className="p-3 pointer-events-auto" />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label>{t('Giờ')}</Label>
                          {!bookingServiceId || !bookingDate ? (
                            <p className="text-sm text-muted-foreground mt-1">{t('Chọn dịch vụ và ngày trước')}</p>
                          ) : availableSlots.length === 0 && bookingTherapistId && bookingTherapistId !== 'random' && (unavailabilities || []).some(u => u.therapist_id === bookingTherapistId && u.unavailable_date === format(bookingDate, 'yyyy-MM-dd')) ? (
                            <p className="text-sm text-destructive mt-1">{t('Thợ nghỉ ngày này')} - {(unavailabilities || []).find(u => u.therapist_id === bookingTherapistId && u.unavailable_date === format(bookingDate, 'yyyy-MM-dd'))?.reason || t('Không có lý do')}</p>
                          ) : availableSlots.length === 0 ? (
                            <p className="text-sm text-destructive mt-1">{t('Không có khung giờ trống')}</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 mt-2 max-h-[200px] overflow-y-auto">
                              {availableSlots.filter((_, i) => i % 2 === 0).map(slot => (
                                <button key={slot.time} type="button" disabled={!slot.available}
                                  onClick={() => {
                                    setBookingTime(slot.time);
                                    if (slot.therapistId && (bookingTherapistId === 'random' || !bookingTherapistId)) {
                                      setBookingTherapistId(slot.therapistId);
                                    }
                                  }}
                                  className={cn(
                                    "px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all",
                                    slot.available && bookingTime !== slot.time && "border-border hover:border-primary hover:bg-primary/5 cursor-pointer",
                                    slot.available && bookingTime === slot.time && "border-primary bg-primary text-primary-foreground",
                                    !slot.available && "border-border bg-muted text-muted-foreground line-through opacity-50 cursor-not-allowed"
                                  )}
                                  title={slot.available ? (slot.therapistName || '') : t('Đã đặt')}
                                >
                                  {slot.time}
                                  {slot.available && bookingTherapistId === 'random' && slot.therapistName && (
                                    <span className="block text-[9px] opacity-70">{slot.therapistName.split(' ').pop()}</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
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
                  onDelete={(id) => deleteBooking.mutate(id)}
                  onReschedule={(id, newDate, newStartTime, newEndTime) =>
                    rescheduleBooking.mutate({ id, newDate, newStartTime, newEndTime })
                  }
                  onDateSelect={(date, startTime) => {
                    setBookingDate(new Date(date + 'T00:00:00'));
                    if (startTime) setBookingTime(startTime);
                    setBookingDialog(true);
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sales Tab */}
          <TabsContent value="sales">
            <Card>
              <CardHeader className="space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>{t('Thanh toán')}</CardTitle>
                <Dialog open={saleDialog} onOpenChange={(open) => { setSaleDialog(open); if (!open) { setSaleType('booking'); setSaleBookingId(''); setSaleServiceId(''); setSaleCustomerName(''); setSaleCustomerPhone(''); setSaleAmount(''); setSalePaymentMethod('cash'); setSaleNotes(''); setSaleAddOns([]); } }}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-1" /> {t('Tạo thanh toán')}</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
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
                            {t('Lịch hẹn')}
                          </Button>
                          <Button type="button" variant={saleType === 'walkin' ? 'default' : 'outline'} className="flex-1" onClick={() => { setSaleType('walkin'); setSaleBookingId(''); }}>
                            {t('Khách vãng lai')}
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
                              if (booking) {
                                setSaleAmount(String((booking as any).services?.price || 0));
                                setSaleCustomerPhone(booking.customer_phone || '');
                                setSaleCustomerName(booking.customer_name || '');
                              }
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
                          {/* Phone for booking type */}
                          <div>
                            <Label>{t('Số điện thoại')}</Label>
                            <Input value={saleCustomerPhone} onChange={e => setSaleCustomerPhone(e.target.value)} className="mt-1" placeholder="04xxxxxxxx" />
                          </div>
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
                            <Label>{t('Tên khách hàng')} ({t('tuỳ chọn')})</Label>
                            <Input value={saleCustomerName} onChange={e => setSaleCustomerName(e.target.value)} className="mt-1" placeholder={t('Nhập tên khách')} />
                          </div>
                          <div>
                            <Label>{t('Số điện thoại')}</Label>
                            <Input value={saleCustomerPhone} onChange={e => setSaleCustomerPhone(e.target.value)} className="mt-1" placeholder="04xxxxxxxx" />
                          </div>
                        </>
                      )}

                      {/* Add-on services */}
                      <div>
                        <Label>{t('Dịch vụ thêm')}</Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {services?.filter(s => s.is_active).map(s => {
                            const isSelected = saleAddOns.includes(s.id);
                            return (
                              <Button
                                key={s.id}
                                type="button"
                                size="sm"
                                variant={isSelected ? 'default' : 'outline'}
                                onClick={() => setSaleAddOns(prev => isSelected ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                              >
                                {s.name} +{formatPrice(s.price)}
                              </Button>
                            );
                          })}
                        </div>
                        {saleAddOns.length > 0 && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            {t('Tổng thêm')}: {formatPrice(saleAddOns.reduce((sum, id) => sum + (services?.find(s => s.id === id)?.price || 0), 0))}
                          </div>
                        )}
                      </div>

                      <div>
                        <Label>{t('Số tiền (AUD)')}</Label>
                        <Input type="number" value={saleAmount} onChange={e => setSaleAmount(e.target.value)} className="mt-1" placeholder="0" />
                      </div>
                      <div>
                        <Label>{t('Phương thức thanh toán')}</Label>
                        <div className="flex gap-2 mt-1">
                          <Button type="button" variant={salePaymentMethod === 'cash' ? 'default' : 'outline'} className="flex-1" onClick={() => setSalePaymentMethod('cash')}>
                            {t('Tiền mặt')}
                          </Button>
                          <Button type="button" variant={salePaymentMethod === 'card' ? 'default' : 'outline'} className="flex-1" onClick={() => setSalePaymentMethod('card')}>
                            {t('Thẻ')}
                          </Button>
                        </div>
                        {(() => {
                          const addOnTotal = saleAddOns.reduce((sum, id) => sum + (services?.find(s => s.id === id)?.price || 0), 0);
                          const base = parseFloat(saleAmount || '0') + addOnTotal;
                          const surchargeRate = parseFloat(cardSurchargeSetting || '0');
                          const surchargeAmt = base * surchargeRate / 100;
                          const grandTotal = base + (salePaymentMethod === 'card' ? surchargeAmt : 0);
                          return (base > 0) ? (
                            <div className="mt-2 p-2 bg-muted rounded text-sm">
                              {addOnTotal > 0 && <div>{t('Dịch vụ chính')}: {formatPrice(parseFloat(saleAmount || '0'))} + {t('Thêm')}: {formatPrice(addOnTotal)}</div>}
                              {salePaymentMethod === 'card' && surchargeRate > 0 && (
                                <div>{t('Phụ phí thẻ')}: {surchargeRate}% = <strong>{formatPrice(surchargeAmt)}</strong></div>
                              )}
                              <div className="font-semibold">{t('Tổng')}: {formatPrice(grandTotal)}</div>
                            </div>
                          ) : null;
                        })()}
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
                {/* Sales filters */}
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-4">
                  <Input placeholder={t('Tìm khách hàng...')} value={salesFilterSearch} onChange={e => setSalesFilterSearch(e.target.value)} className="w-full sm:w-40 h-8 text-sm" />
                  <div className="flex gap-2 items-center">
                    <Input type="date" value={salesFilterDateFrom} onChange={e => setSalesFilterDateFrom(e.target.value)} className="flex-1 sm:w-36 h-8 text-sm" />
                    <span className="text-xs text-muted-foreground">—</span>
                    <Input type="date" value={salesFilterDateTo} onChange={e => setSalesFilterDateTo(e.target.value)} className="flex-1 sm:w-36 h-8 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <Select value={salesFilterMethod} onValueChange={setSalesFilterMethod}>
                      <SelectTrigger className="flex-1 sm:w-28 h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('Tất cả')}</SelectItem>
                        <SelectItem value="cash">{t('Tiền mặt')}</SelectItem>
                        <SelectItem value="card">{t('Thẻ')}</SelectItem>
                      </SelectContent>
                    </Select>
                    {(salesFilterSearch || salesFilterDateFrom || salesFilterDateTo || salesFilterMethod !== 'all') && (
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => { setSalesFilterSearch(''); setSalesFilterDateFrom(''); setSalesFilterDateTo(''); setSalesFilterMethod('all'); }}>
                        <X className="h-3 w-3 mr-1" />{t('Xóa lọc')}
                      </Button>
                    )}
                  </div>
                </div>
                {(() => {
                  const filtered = (sales || []).filter((s: any) => {
                    if (salesFilterMethod !== 'all' && s.payment_method !== salesFilterMethod) return false;
                    if (salesFilterDateFrom && s.sale_date < salesFilterDateFrom) return false;
                    if (salesFilterDateTo && s.sale_date > salesFilterDateTo) return false;
                    if (salesFilterSearch) {
                      const q = salesFilterSearch.toLowerCase();
                      const name = (s.bookings?.customer_name || '').toLowerCase();
                      const note = (s.notes || '').toLowerCase();
                      if (!name.includes(q) && !note.includes(q)) return false;
                    }
                    return true;
                  });
                  if (filtered.length === 0) return (
                    <div className="text-center py-12 text-muted-foreground">
                      <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-medium">{sales?.length ? t('Không tìm thấy kết quả') : t('Chưa có thanh toán')}</p>
                    </div>
                  );
                  return (
                    <>
                      {/* Mobile card layout */}
                      <div className="space-y-3 sm:hidden">
                        {filtered.map((s: any) => (
                          <div key={s.id} className="border rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold">{formatPrice(Number(s.amount))}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant={s.payment_method === 'card' ? 'default' : 'secondary'} className="text-xs">
                                  {s.payment_method === 'card' ? t('Thẻ') : t('Tiền mặt')}
                                </Badge>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteSale.mutate(s.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              <p>{s.sale_date} · {s.bookings?.customer_name || '—'}</p>
                              <p>{s.bookings?.services?.name || '—'}</p>
                              {s.notes && <p className="truncate">{s.notes}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Desktop table layout */}
                      <div className="hidden sm:block">
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
                            {filtered.map((s: any) => (
                              <TableRow key={s.id}>
                                <TableCell className="text-sm">{s.sale_date}</TableCell>
                                <TableCell className="text-sm">{s.bookings?.customer_name || '—'}</TableCell>
                                <TableCell className="text-sm">{s.bookings?.services?.name || '—'}</TableCell>
                                <TableCell className="font-semibold">{formatPrice(Number(s.amount))}</TableCell>
                                <TableCell>
                                  <Badge variant={s.payment_method === 'card' ? 'default' : 'secondary'}>
                                    {s.payment_method === 'card' ? t('Thẻ') : t('Tiền mặt')}
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
                      </div>
                    </>
                  );
                })()}
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
                          <strong>{h.holiday_date}</strong>
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
                <CardTitle className="text-base">{t('Thông tin tiệm')}</CardTitle>
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
                <CardTitle className="text-base">{t('Cài đặt tiền tệ')}</CardTitle>
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
                  <p className="font-medium text-sm">{t('Nhắc lịch qua SMS & WhatsApp')}</p>
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
                    <p className="font-medium text-sm">WhatsApp</p>
                    <p className="text-xs text-muted-foreground">{t('Gửi thêm nhắc nhở qua WhatsApp')}</p>
                  </div>
                  <Switch checked={whatsappEnabled === true} onCheckedChange={(v) => toggleWhatsapp.mutate(v)} />
                </div>
              </CardContent>
            </Card>

            {/* Auto Reminder Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('Nhắc lịch tự động')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{t('Nhắc qua Email')}</p>
                    <p className="text-xs text-muted-foreground">{t('Gửi email nhắc lịch tự động cho khách có email')}</p>
                  </div>
                  <Switch checked={reminderEmailEnabled} onCheckedChange={setReminderEmailEnabled} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{t('Nhắc qua SMS')}</p>
                    <p className="text-xs text-muted-foreground">{t('Gửi SMS nhắc lịch tự động (cần cấu hình Twilio)')}</p>
                  </div>
                  <Switch checked={reminderSmsEnabled} onCheckedChange={setReminderSmsEnabled} />
                </div>
                <div className="border-t pt-3 space-y-3">
                  <p className="text-sm font-medium">{t('Thời gian nhắc')}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">{t('Lần 1 (giờ trước lịch hẹn)')}</Label>
                      <Select value={reminder1stHours} onValueChange={setReminder1stHours}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="48">48h (2 {t('ngày')})</SelectItem>
                          <SelectItem value="24">24h (1 {t('ngày')})</SelectItem>
                          <SelectItem value="12">12h</SelectItem>
                          <SelectItem value="6">6h</SelectItem>
                          <SelectItem value="3">3h</SelectItem>
                          <SelectItem value="2">2h</SelectItem>
                          <SelectItem value="0">{t('Tắt')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">{t('Lần 2 (giờ trước lịch hẹn)')}</Label>
                      <Select value={reminder2ndHours} onValueChange={setReminder2ndHours}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3h</SelectItem>
                          <SelectItem value="2">2h</SelectItem>
                          <SelectItem value="1">1h</SelectItem>
                          <SelectItem value="0">{t('Tắt')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <Button size="sm" onClick={() => saveReminderSettings.mutate()}>{t('Lưu cài đặt nhắc lịch')}</Button>
              </CardContent>
            </Card>

            {/* Resend Email Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('Cài đặt email')} (Resend)</CardTitle>
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
                    <p className="text-muted-foreground">{t('Resend API key đã được cấu hình')}</p>
                    <p className="text-muted-foreground">{t('Email gửi từ')}: <strong>{resendSettings['resend_from_email'] || 'onboarding@resend.dev'}</strong></p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card Surcharge Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('Phụ phí thẻ tín dụng')}</CardTitle>
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

            {/* Admin Accounts Management */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Admin Accounts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Existing admin list */}
                {adminAccounts && adminAccounts.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Current Admins</Label>
                    <div className="space-y-2">
                      {adminAccounts.map(admin => (
                        <div key={admin.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{admin.email}</p>
                            <p className="text-xs text-muted-foreground">
                              {admin.is_current ? '(You)' : `Added ${new Date(admin.created_at).toLocaleDateString()}`}
                            </p>
                          </div>
                          {!admin.is_current && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                              disabled={deletingAdminId === admin.id}
                              onClick={async () => {
                                if (!confirm(`Remove admin account ${admin.email}? This cannot be undone.`)) return;
                                setDeletingAdminId(admin.id);
                                try {
                                  const { data: { session: s } } = await supabase.auth.getSession();
                                  const res = await fetch(
                                    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-admins`,
                                    {
                                      method: 'DELETE',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${s?.access_token}`,
                                      },
                                      body: JSON.stringify({ user_id: admin.id }),
                                    }
                                  );
                                  const result = await res.json();
                                  if (!res.ok) throw new Error(result.error || 'Failed');
                                  toast({ title: 'Admin removed', description: admin.email });
                                  refetchAdmins();
                                } catch (err: any) {
                                  toast({ title: 'Error', description: err.message, variant: 'destructive' });
                                } finally {
                                  setDeletingAdminId(null);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Create new admin */}
                <div className="border-t pt-4 space-y-3">
                  <Label className="text-sm font-medium">Create New Admin</Label>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input
                      type="email"
                      value={newAdminEmail}
                      onChange={e => setNewAdminEmail(e.target.value)}
                      placeholder="admin@example.com"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Password</Label>
                    <Input
                      type="password"
                      value={newAdminPassword}
                      onChange={e => setNewAdminPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="mt-1"
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={creatingAdmin || !newAdminEmail.trim() || newAdminPassword.length < 6}
                    onClick={async () => {
                      setCreatingAdmin(true);
                      try {
                        const { data: { session: s } } = await supabase.auth.getSession();
                        const res = await fetch(
                          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-admin`,
                          {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${s?.access_token}`,
                            },
                            body: JSON.stringify({ email: newAdminEmail.trim(), password: newAdminPassword }),
                          }
                        );
                        const result = await res.json();
                        if (!res.ok) throw new Error(result.error || 'Failed');
                        toast({ title: 'Admin account created', description: `Welcome email sent to ${newAdminEmail}` });
                        setNewAdminEmail('');
                        setNewAdminPassword('');
                        refetchAdmins();
                      } catch (err: any) {
                        toast({ title: 'Error', description: err.message, variant: 'destructive' });
                      } finally {
                        setCreatingAdmin(false);
                      }
                    }}
                  >
                    {creatingAdmin ? 'Creating...' : 'Create Admin Account'}
                  </Button>
                </div>
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
                  <Label>{t('Model')}</Label>
                  <Input
                    value={openaiModel}
                    onChange={e => setOpenaiModel(e.target.value)}
                    placeholder="gpt-4o-mini"
                    className="mt-1 font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('VD: gpt-4o-mini, gpt-4o, gpt-3.5-turbo')}</p>
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
                    <p className="text-muted-foreground">Model: <strong>{openaiSettings['openai_model'] || 'gpt-4o-mini'}</strong></p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Membership Tiers ── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Crown className="h-4 w-4 text-primary" />
                    {t('Hạng thành viên')}
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{t('Bật/Tắt')}</span>
                      <Switch checked={membershipEnabled === true} onCheckedChange={(v) => toggleMembership.mutate(v)} />
                    </div>
                    <Dialog open={membershipDialog} onOpenChange={setMembershipDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => { setEditingTier(null); setTierName(''); setTierMinVisits('0'); setTierDiscountPercent('0'); }}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> {t('Thêm')}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{editingTier ? t('Sửa hạng thành viên') : t('Thêm hạng thành viên')}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 pt-2">
                          <div>
                            <Label>{t('Tên hạng')}</Label>
                            <Input value={tierName} onChange={e => setTierName(e.target.value)} placeholder="VIP Gold" className="mt-1" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>{t('Số lần ghé tối thiểu')}</Label>
                              <Input type="number" min="0" value={tierMinVisits} onChange={e => setTierMinVisits(e.target.value)} className="mt-1" />
                            </div>
                            <div>
                              <Label>{t('Giảm giá (%)')}</Label>
                              <Input type="number" min="0" max="100" step="0.5" value={tierDiscountPercent} onChange={e => setTierDiscountPercent(e.target.value)} className="mt-1" />
                            </div>
                          </div>
                          <Button onClick={() => saveTier.mutate()} disabled={!tierName.trim()}>{editingTier ? t('Cập nhật') : t('Tạo')}</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!membershipTiers?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{t('Chưa có hạng thành viên nào')}</p>
                ) : (
                  <div className="space-y-2">
                    {membershipTiers.map(tier => (
                      <div key={tier.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <Switch checked={tier.is_active} onCheckedChange={(v) => toggleTierActive.mutate({ id: tier.id, active: v })} />
                          <div>
                            <p className="text-sm font-semibold">{tier.name}</p>
                            <p className="text-xs text-muted-foreground">{tier.min_visits}+ {t('lần ghé')} · {tier.discount_percent}% {t('giảm')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                            setEditingTier(tier); setTierName(tier.name); setTierMinVisits(String(tier.min_visits)); setTierDiscountPercent(String(tier.discount_percent)); setMembershipDialog(true);
                          }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm(t('Xoá hạng này?'))) deleteTier.mutate(tier.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Discount Codes ── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" />
                    {t('Mã giảm giá')}
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{t('Bật/Tắt')}</span>
                      <Switch checked={discountCodesEnabled === true} onCheckedChange={(v) => toggleDiscountCodes.mutate(v)} />
                    </div>
                    <Dialog open={discountDialog} onOpenChange={setDiscountDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => {
                          setEditingDiscount(null); setDiscountCode(''); setDiscountPercent('0'); setDiscountAmount('0'); setDiscountValidFrom(''); setDiscountValidTo(''); setDiscountMaxUses('');
                        }}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> {t('Thêm')}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{editingDiscount ? t('Sửa mã giảm giá') : t('Thêm mã giảm giá')}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 pt-2">
                          <div>
                            <Label>{t('Mã')}</Label>
                            <Input value={discountCode} onChange={e => setDiscountCode(e.target.value.toUpperCase())} placeholder="WELCOME10" className="mt-1 font-mono" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>{t('Giảm giá (%)')}</Label>
                              <Input type="number" min="0" max="100" value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} className="mt-1" />
                            </div>
                            <div>
                              <Label>{t('Giảm cố định (A$)')}</Label>
                              <Input type="number" min="0" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} className="mt-1" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>{t('Từ ngày')}</Label>
                              <Input type="date" value={discountValidFrom} onChange={e => setDiscountValidFrom(e.target.value)} className="mt-1" />
                            </div>
                            <div>
                              <Label>{t('Đến ngày')}</Label>
                              <Input type="date" value={discountValidTo} onChange={e => setDiscountValidTo(e.target.value)} className="mt-1" />
                            </div>
                          </div>
                          <div>
                            <Label>{t('Giới hạn sử dụng')} ({t('để trống = không giới hạn')})</Label>
                            <Input type="number" min="0" value={discountMaxUses} onChange={e => setDiscountMaxUses(e.target.value)} className="mt-1" placeholder={t('Không giới hạn')} />
                          </div>
                          <Button onClick={() => saveDiscount.mutate()} disabled={!discountCode.trim()}>{editingDiscount ? t('Cập nhật') : t('Tạo')}</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!discountCodes?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{t('Chưa có mã giảm giá nào')}</p>
                ) : (
                  <div className="space-y-2">
                    {discountCodes.map(dc => (
                      <div key={dc.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <Switch checked={dc.is_active} onCheckedChange={(v) => toggleDiscountActive.mutate({ id: dc.id, active: v })} />
                          <div>
                            <p className="text-sm font-mono font-semibold">{dc.code}</p>
                            <p className="text-xs text-muted-foreground">
                              {Number(dc.discount_percent) > 0 && `${dc.discount_percent}%`}
                              {Number(dc.discount_percent) > 0 && Number(dc.discount_amount) > 0 && ' + '}
                              {Number(dc.discount_amount) > 0 && `A$ ${dc.discount_amount}`}
                              {dc.max_uses && ` · ${dc.current_uses}/${dc.max_uses} ${t('đã dùng')}`}
                              {dc.valid_to && ` · ${t('hết hạn')} ${dc.valid_to}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                            setEditingDiscount(dc); setDiscountCode(dc.code); setDiscountPercent(String(dc.discount_percent)); setDiscountAmount(String(dc.discount_amount));
                            setDiscountValidFrom(dc.valid_from || ''); setDiscountValidTo(dc.valid_to || ''); setDiscountMaxUses(dc.max_uses ? String(dc.max_uses) : ''); setDiscountDialog(true);
                          }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm(t('Xoá mã này?'))) deleteDiscount.mutate(dc.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Danger Zone: Delete All Data ── */}
            <Card className="border-destructive/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {t('Vùng nguy hiểm')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{t('Xoá tất cả dữ liệu lịch hẹn, thanh toán, ngày nghỉ. Hành động không thể hoàn tác.')}</p>
                <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> {t('Xoá tất cả dữ liệu')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="text-destructive flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" /> {t('Xác nhận xoá tất cả dữ liệu')}
                      </DialogTitle>
                      <DialogDescription>
                        {t('Nhập mật khẩu admin để xác nhận. Tất cả lịch hẹn, thanh toán, ngày nghỉ sẽ bị xoá vĩnh viễn.')}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div>
                        <Label>{t('Mật khẩu admin')}</Label>
                        <Input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} placeholder={t('Nhập mật khẩu')} className="mt-1" />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setDeleteDialog(false)} className="flex-1">{t('Huỷ')}</Button>
                        <Button variant="destructive" onClick={handleDeleteAllData} disabled={deleting || !deletePassword.trim()} className="flex-1">
                          {deleting ? t('Đang xoá...') : t('Xoá tất cả')}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
