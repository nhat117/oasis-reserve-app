import { useState, useEffect, useRef, useMemo } from 'react';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { BookingCalendar } from '@/components/BookingCalendar';
import { LogoUpload as LogoUploadComponent } from '@/components/LogoUpload';
import { Textarea } from '@/components/ui/textarea';
import { TipTapEditor } from '@/components/TipTapEditor';
import { BookingStats } from '@/components/BookingStats';
import { Leaf, LogOut, Plus, Pencil, CalendarOff, X, Settings, DollarSign, Trash2, BarChart3, CalendarDays, Scissors, Users, AlertTriangle, Tag, Crown, UserCheck, Search, Download, FileText, Shield, Lock, Menu, ChevronLeft, ChevronRight, Store, Palette, Mail, Languages, Image, Info, Bell, MessageSquare, Loader2, Ellipsis, MoreHorizontal, Phone, CreditCard, Square, RotateCcw, BookOpen, ScrollText, Eye, Clock, Check, Bot } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ALL_I18N_KEYS } from '@/lib/i18n-keys';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  escapeHtml, validateForm,
  saleSchema, serviceSchema, therapistSchema, adminBookingSchema,
  membershipTierSchema, discountCodeSchema, holidaySchema, unavailabilitySchema, appSettingSchema,
} from '@/lib/validation';
import { useToast } from '@/hooks/use-toast';
import { Navigate, Link } from 'react-router-dom';
import { useI18n, LanguageSwitcher } from '@/hooks/useI18n';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLoadMore } from '@/hooks/useLoadMore';
import DOMPurify from 'dompurify';
import { SquareCardForm } from '@/components/SquareCardForm';
import { AdminOnboarding } from '@/components/AdminOnboarding';
import { InboxPanel } from '@/components/inbox/InboxPanel';
import { KnowledgeBaseManager } from '@/components/settings/KnowledgeBaseManager';
import { AISettingsPanel } from '@/components/settings/AISettingsPanel';

const CURRENCIES = ['VND', 'USD', 'EUR', 'AUD'] as const;

const resizeImage = (file: File, maxW = 800, maxH = 600, quality = 0.85): Promise<File> =>
  new Promise((resolve) => {
    const img = new window.Image() as HTMLImageElement;
    img.onload = () => {
      let { width, height } = img;
      if (width > maxW || height > maxH) {
        const ratio = Math.min(maxW / width, maxH / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(new File([blob!], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' })),
        'image/webp',
        quality
      );
    };
    img.src = URL.createObjectURL(file);
  });

const AdminDashboard = () => {
  const { user, isAdmin, isEmployee, isStaff, userRole, loading, signOut, logActivity } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const canAccessSettings = isAdmin;
  const requireAdmin = () => {
    if (!isAdmin) throw new Error('Admin only');
  };

  // Onboarding: show only once for new admin accounts
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { data: onboardingDone } = useQuery({
    queryKey: ['onboarding-check', user?.id],
    queryFn: async () => {
      if (!user?.id) return true;
      const { data } = await supabase.from('app_settings').select('value').eq('key', `onboarding_completed_${user.id}`).single();
      return data?.value === 'true';
    },
    enabled: !!user?.id && isAdmin,
  });
  useEffect(() => {
    if (onboardingDone === false && isAdmin) setShowOnboarding(true);
  }, [onboardingDone, isAdmin]);

  // Real-time notification for new bookings
  useEffect(() => {
    if (!isStaff) return;
    const channel = supabase
      .channel('new-bookings')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, async (payload) => {
        const b = payload.new as any;
        toast({
          title: t('Lịch hẹn mới!'),
          description: `${b.customer_name} — ${b.booking_date} ${b.start_time}`,
        });
        queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
        queryClient.invalidateQueries({ queryKey: ['stats-bookings'] });

        // Trigger SMS notification to shop owner
        try {
          await supabase.functions.invoke('notify-new-booking', { body: { record: b } });
        } catch (_) { /* silent — notification is best-effort */ }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isStaff]);

  const AdminOnlyButton = ({ children, onClick, variant = 'ghost', size = 'sm', className = '' }: {
    children: React.ReactNode;
    onClick: () => void;
    variant?: 'ghost' | 'destructive' | 'outline' | 'default';
    size?: 'sm' | 'icon' | 'default';
    className?: string;
  }) => {
    if (isAdmin) {
      return <Button variant={variant} size={size} className={className} onClick={onClick}>{children}</Button>;
    }
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant={variant} size={size} className={cn(className, 'opacity-40 cursor-not-allowed')} disabled>
                <Lock className="h-3 w-3 mr-1" />{children}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{t('Chỉ admin có quyền thực hiện thao tác này')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const [filterTherapist, setFilterTherapist] = useState('all');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [spaName, setSpaName] = useState('Oasis Reserve');
  const [settingsModal, setSettingsModal] = useState<string | null>(null);

  // Service form state
  const [serviceDialog, setServiceDialog] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [serviceName, setServiceName] = useState('');
  const [serviceDesc, setServiceDesc] = useState('');
  const [serviceDuration, setServiceDuration] = useState('60');
  const [servicePrice, setServicePrice] = useState('0');
  const [serviceImageFile, setServiceImageFile] = useState<File | null>(null);
  const [serviceImagePreview, setServiceImagePreview] = useState<string | null>(null);
  const serviceImageRef = useRef<HTMLInputElement>(null);

  // Therapist form state
  const [therapistDialog, setTherapistDialog] = useState(false);
  const [therapistInfoDialog, setTherapistInfoDialog] = useState(false);
  const [viewingTherapist, setViewingTherapist] = useState<any>(null);
  const [unavailMonthFilter, setUnavailMonthFilter] = useState(format(new Date(), 'yyyy-MM'));
  const [editingTherapist, setEditingTherapist] = useState<any>(null);
  const [therapistName, setTherapistName] = useState('');
  const [therapistPhone, setTherapistPhone] = useState('');
  const [therapistEmail, setTherapistEmail] = useState('');
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
  const [posTab, setPosTab] = useState<'appointments' | 'library'>('appointments');
  const [saleBookingId, setSaleBookingId] = useState('');
  const [saleServiceId, setSaleServiceId] = useState('');
  const [saleCustomerName, setSaleCustomerName] = useState('');
  const [saleCustomerPhone, setSaleCustomerPhone] = useState('');
  const [saleAmount, setSaleAmount] = useState('');
  const [salePaymentMethod, setSalePaymentMethod] = useState<'cash' | 'card' | 'square'>('cash');
  const [squareCheckoutPending, setSquareCheckoutPending] = useState(false);
  const [saleNotes, setSaleNotes] = useState('');
  const [saleAddOns, setSaleAddOns] = useState<string[]>([]);
  const [saleCouponCode, setSaleCouponCode] = useState('');
  const [saleCouponDiscount, setSaleCouponDiscount] = useState<{ percent: number; amount: number } | null>(null);
  const [saleCouponError, setSaleCouponError] = useState('');
  const [saleCouponLoading, setSaleCouponLoading] = useState(false);
  const [saleServiceSearch, setSaleServiceSearch] = useState('');
  const [saleAddOnSearch, setSaleAddOnSearch] = useState('');
  const [saleBookingSearch, setSaleBookingSearch] = useState('');

  // Create admin state
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'admin' | 'employee'>('employee');
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [accountDialog, setAccountDialog] = useState(false);
  const [editAccountDialog, setEditAccountDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [editAccountPassword, setEditAccountPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingAdminId, setDeletingAdminId] = useState<string | null>(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; action: () => void } | null>(null);
  const openConfirm = (title: string, description: string, action: () => void) => setConfirmDialog({ title, description, action });

  // Currency settings state
  const [exchangeUSD, setExchangeUSD] = useState('');
  const [exchangeEUR, setExchangeEUR] = useState('');
  const [exchangeAUD, setExchangeAUD] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('AUD');

  // Shop info state
  const [shopPhone, setShopPhone] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [openDays, setOpenDays] = useState<number[]>([1, 2, 3, 4, 5, 6]); // Mon=1..Sun=7
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('18:00');
  const [shopState, setShopState] = useState('VIC');
  const [shopTimezone, setShopTimezone] = useState('Australia/Melbourne');

  const STATE_TIMEZONE_MAP: Record<string, string> = {
    NSW: 'Australia/Sydney',
    VIC: 'Australia/Melbourne',
    QLD: 'Australia/Brisbane',
    SA: 'Australia/Adelaide',
    WA: 'Australia/Perth',
    TAS: 'Australia/Hobart',
    NT: 'Australia/Darwin',
    ACT: 'Australia/Sydney',
  };
  const [showHolidayClosed, setShowHolidayClosed] = useState(true);
  const [heroMode, setHeroMode] = useState<'video' | 'image'>('video');
  const [heroMediaFile, setHeroMediaFile] = useState<File | null>(null);
  const [heroMediaPreview, setHeroMediaPreview] = useState<string | null>(null);
  const [heroMediaPath, setHeroMediaPath] = useState('');
  const [savingHero, setSavingHero] = useState(false);
  const heroMediaRef = useRef<HTMLInputElement>(null);

  // Resend email state
  const [resendApiKey, setResendApiKey] = useState('');
  const [resendFromEmail, setResendFromEmail] = useState('');

  // Card surcharge state
  const [cardSurchargePercent, setCardSurchargePercent] = useState('0');

  // Employee visible tabs — default all visible
  const EMPLOYEE_TABS = ['stats', 'bookings', 'customers', 'sales', 'services', 'therapists'] as const;
  type EmployeeTab = typeof EMPLOYEE_TABS[number];
  const [employeeVisibleTabs, setEmployeeVisibleTabs] = useState<EmployeeTab[]>([...EMPLOYEE_TABS]);

  // Sales filter state
  const [salesFilterMethod, setSalesFilterMethod] = useState('all');
  const [salesFilterDateFrom, setSalesFilterDateFrom] = useState('');
  const [salesFilterDateTo, setSalesFilterDateTo] = useState('');
  const [salesFilterSearch, setSalesFilterSearch] = useState('');

  // OpenAI settings state
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');

  // Translation populate state
  const [populatingLang, setPopulatingLang] = useState<'vi' | 'en' | null>(null);
  const [populateProgress, setPopulateProgress] = useState({ done: 0, total: 0 });

  const populateTranslations = async (lang: 'vi' | 'en') => {
    setPopulatingLang(lang);
    const BATCH_SIZE = 25;
    const total = Math.ceil(ALL_I18N_KEYS.length / BATCH_SIZE);
    setPopulateProgress({ done: 0, total });

    let translated = 0;
    let errors = 0;
    for (let i = 0; i < ALL_I18N_KEYS.length; i += BATCH_SIZE) {
      const batch = ALL_I18N_KEYS.slice(i, i + BATCH_SIZE);
      try {
        const { error } = await supabase.functions.invoke('translate', {
          body: { keys: batch, lang },
        });
        if (error) errors++;
      } catch {
        errors++;
      }
      translated++;
      setPopulateProgress({ done: translated, total });
    }

    setPopulatingLang(null);
    toast({
      title: errors === 0
        ? t('Đã dịch tất cả') + ` (${ALL_I18N_KEYS.length} ${t('mã')})`
        : `${t('Hoàn thành')} (${errors} ${t('lỗi')})`,
    });
  };

  // Twilio credentials state
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('');

  // Stripe credentials state
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');
  const [stripePaymentEnabled, setStripePaymentEnabled] = useState(false);

  // Square credentials state
  const [squareAccessToken, setSquareAccessToken] = useState('');
  const [squareLocationId, setSquareLocationId] = useState('');
  const [squareEnvironment, setSquareEnvironment] = useState('sandbox');
  const [squareTerminalEnabled, setSquareTerminalEnabled] = useState(false);
  const [squareApplicationId, setSquareApplicationId] = useState('');
  const [squareOnlineEnabled, setSquareOnlineEnabled] = useState(false);
  const [squareDeviceId, setSquareDeviceId] = useState('');
  const [showSquareCardForm, setShowSquareCardForm] = useState(false);

  // Payments modal sub-section expansion
  const [paymentSection, setPaymentSection] = useState<'stripe' | 'square' | null>(null);

  // Reminder settings state
  const [reminderEmailEnabled, setReminderEmailEnabled] = useState(false);
  const [reminderSmsEnabled, setReminderSmsEnabled] = useState(false);
  const [reminder1stHours, setReminder1stHours] = useState('24');
  const [reminder2ndHours, setReminder2ndHours] = useState('1');

  // New booking SMS notification state
  const [notifySmsEnabled, setNotifySmsEnabled] = useState(false);
  const [notifyPhone, setNotifyPhone] = useState('');

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

  // Gift card batch state
  const [giftCardDialog, setGiftCardDialog] = useState(false);
  const [giftCardCount, setGiftCardCount] = useState('5');
  const [giftCardAmount, setGiftCardAmount] = useState('50');
  const [giftCardPrefix, setGiftCardPrefix] = useState('GIFT');
  const [giftCardMaxUses, setGiftCardMaxUses] = useState('1');
  const [giftCardValidTo, setGiftCardValidTo] = useState('');

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
        .select('*, bookings(customer_name, customer_phone, booking_date, start_time, services(name)), is_refunded')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const applyCoupon = async () => {
    const code = saleCouponCode.trim().toUpperCase();
    if (!code) { setSaleCouponDiscount(null); setSaleCouponError(''); return; }
    setSaleCouponLoading(true);
    setSaleCouponError('');
    setSaleCouponDiscount(null);
    const { data, error } = await supabase.from('discount_codes').select('*').eq('code', code).eq('is_active', true).single();
    setSaleCouponLoading(false);
    if (error || !data) { setSaleCouponError(t('Mã không hợp lệ')); return; }
    const today = format(new Date(), 'yyyy-MM-dd');
    if (data.valid_from && today < data.valid_from) { setSaleCouponError(t('Mã chưa có hiệu lực')); return; }
    if (data.valid_to && today > data.valid_to) { setSaleCouponError(t('Mã đã hết hạn')); return; }
    if (data.max_uses && data.current_uses >= data.max_uses) { setSaleCouponError(t('Mã đã hết lượt sử dụng')); return; }
    setSaleCouponDiscount({ percent: Number(data.discount_percent) || 0, amount: Number(data.discount_amount) || 0 });
  };

  const createSale = useMutation({
    mutationFn: async () => {
      const addOnTotal = saleAddOns.reduce((sum, id) => {
        const svc = services?.find(s => s.id === id);
        return sum + (svc?.price || 0);
      }, 0);
      let baseAmount = parseFloat(saleAmount) + addOnTotal;
      // Apply coupon discount
      if (saleCouponDiscount) {
        if (saleCouponDiscount.percent > 0) baseAmount -= baseAmount * (saleCouponDiscount.percent / 100);
        if (saleCouponDiscount.amount > 0) baseAmount -= saleCouponDiscount.amount;
        baseAmount = Math.max(0, baseAmount);
      }
      const surcharge = salePaymentMethod === 'card' ? baseAmount * (parseFloat(cardSurchargeSetting || '0') / 100) : 0;
      const totalAmount = baseAmount + surcharge;

      const vErr = validateForm(saleSchema, {
        amount: totalAmount,
        customerName: saleCustomerName || '',
        customerPhone: saleCustomerPhone || '',
        notes: saleNotes || '',
        paymentMethod: salePaymentMethod === 'square' ? 'card' : salePaymentMethod,
      });
      if (vErr) throw new Error(vErr);

      const payload: any = {
        amount: totalAmount,
        payment_method: salePaymentMethod === 'square' ? 'card' : salePaymentMethod,
        notes: saleNotes || null,
        sale_date: format(new Date(), 'yyyy-MM-dd'),
        customer_phone: saleCustomerPhone || null,
        customer_name: saleCustomerName || null,
      };
      if (saleType === 'booking' && saleBookingId && saleBookingId !== 'none') payload.booking_id = saleBookingId;
      if (saleCouponCode.trim()) payload.notes = `${payload.notes || ''} [Coupon: ${saleCouponCode.trim().toUpperCase()}]`.trim();
      const { data: saleData, error } = await supabase.from('sales').insert(payload).select('id').single();
      if (error) throw error;

      // Increment coupon usage
      if (saleCouponDiscount && saleCouponCode.trim()) {
        const code = saleCouponCode.trim().toUpperCase();
        const { data: dc } = await supabase.from('discount_codes').select('id, current_uses').eq('code', code).single();
        if (dc) await supabase.from('discount_codes').update({ current_uses: (dc.current_uses || 0) + 1 }).eq('id', dc.id);
      }

      // If Square Terminal (not card form), trigger terminal checkout
      if (salePaymentMethod === 'square' && !showSquareCardForm && saleData?.id) {
        setSquareCheckoutPending(true);
        const { error: sqErr } = await supabase.functions.invoke('create-square-terminal-checkout', {
          body: {
            sale_id: saleData.id,
            booking_id: (saleType === 'booking' && saleBookingId && saleBookingId !== 'none') ? saleBookingId : undefined,
            amount: totalAmount,
            note: `${saleCustomerName || 'Customer'} - ${saleNotes || 'Payment'}`,
          },
        });
        setSquareCheckoutPending(false);
        if (sqErr) {
          toast({ title: t('Đã ghi nhận nhưng lỗi Square Terminal'), description: String(sqErr), variant: 'destructive' });
        } else {
          toast({ title: t('Đã gửi đến Square Terminal'), description: t('Khách hàng có thể thanh toán trên máy POS') });
        }
      }
    },
    onSuccess: () => {
      logActivity('create_sale', `Amount: ${saleAmount}, Method: ${salePaymentMethod}, Customer: ${saleCustomerName || saleCustomerPhone || 'N/A'}`);
      // Print receipt if enabled
      if (printReceiptEnabled) {
        const svc = services?.find(s => s.id === saleServiceId);
        const addOnDetails = saleAddOns.map(id => {
          const a = services?.find(s => s.id === id);
          return a ? { name: a.name, price: a.price } : { name: '', price: 0 };
        }).filter(a => a.name);
        printReceipt({
          amount: parseFloat(saleAmount) || 0,
          customerName: saleCustomerName,
          customerPhone: saleCustomerPhone,
          serviceName: svc?.name || '',
          addOns: addOnDetails,
          paymentMethod: salePaymentMethod,
          discount: saleCouponDiscount ? (saleCouponDiscount.discount_amount || 0) : 0,
          surcharge: 0,
          coupon: saleCouponCode || undefined,
          date: format(new Date(), 'dd/MM/yyyy HH:mm'),
        });
      }
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
      setSaleCouponCode('');
      setSaleCouponDiscount(null);
      setSaleCouponError('');
      setShowSquareCardForm(false);
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      toast({ title: t('Đã ghi nhận thanh toán') });
    },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  const deleteSale = useMutation({
    mutationFn: async (id: string) => {
      if (!isAdmin) throw new Error('Admin only');
      const { error } = await supabase.from('sales').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      logActivity('delete_sale', `Sale ID: ${id}`);
      queryClient.invalidateQueries({ queryKey: ['admin-sales'] });
      toast({ title: t('Đã xoá thanh toán') });
    },
  });

  const refundSale = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sales').update({ is_refunded: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      logActivity('refund_sale', `Sale ID: ${id}`);
      queryClient.invalidateQueries({ queryKey: ['admin-sales'] });
      toast({ title: t('Đã đánh dấu hoàn tiền') });
    },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  // Employee visible tabs setting
  const { data: employeeTabsSetting } = useQuery({
    queryKey: ['employee-visible-tabs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'employee_visible_tabs').single();
      if (error) return [...EMPLOYEE_TABS];
      try { return JSON.parse(data.value) as EmployeeTab[]; } catch { return [...EMPLOYEE_TABS]; }
    },
  });

  useEffect(() => {
    if (employeeTabsSetting) setEmployeeVisibleTabs(employeeTabsSetting);
  }, [employeeTabsSetting]);

  const saveEmployeeTabs = useMutation({
    mutationFn: async (tabs: EmployeeTab[]) => {
      requireAdmin();
      const { error } = await supabase.from('app_settings').upsert({ key: 'employee_visible_tabs', value: JSON.stringify(tabs) });
      if (error) throw error;
    },
    onSuccess: () => {
      logActivity('update_employee_tabs', `Visible tabs: ${employeeVisibleTabs.join(', ')}`);
      queryClient.invalidateQueries({ queryKey: ['employee-visible-tabs'] });
      toast({ title: t('Đã lưu quyền nhân viên') });
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

  // Spa name from DB
  useQuery({
    queryKey: ['spa-name-setting'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'spa_name').single();
      if (!error && data?.value) setSpaName(data.value);
      return data?.value || 'Oasis Reserve';
    },
  });

  const toggleRandom = useMutation({
    mutationFn: async (enabled: boolean) => {
      requireAdmin();
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
  useEffect(() => { if (twilioNumber) setSmsNumber(twilioNumber); }, [twilioNumber]);

  const saveSmsNumber = useMutation({
    mutationFn: async () => {
      requireAdmin();
      const { error } = await supabase.from('app_settings').upsert({ key: 'twilio_from_number', value: smsNumber });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['twilio-number-setting'] }); toast({ title: t('Đã lưu số SMS') }); },
  });

  // Twilio credentials
  const { data: twilioSettings } = useQuery({
    queryKey: ['twilio-credentials'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('key, value')
        .in('key', ['twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number']);
      const map: Record<string, string> = {};
      data?.forEach((r: any) => { map[r.key] = r.value; });
      return map;
    },
  });

  useEffect(() => {
    if (twilioSettings) {
      if (twilioSettings.twilio_account_sid) setTwilioAccountSid(twilioSettings.twilio_account_sid);
      if (twilioSettings.twilio_auth_token) setTwilioAuthToken(twilioSettings.twilio_auth_token);
      if (twilioSettings.twilio_phone_number) setTwilioPhoneNumber(twilioSettings.twilio_phone_number);
    }
  }, [twilioSettings]);

  const saveTwilioCredentials = useMutation({
    mutationFn: async () => {
      requireAdmin();
      const settings = [
        { key: 'twilio_account_sid', value: twilioAccountSid.trim() },
        { key: 'twilio_auth_token', value: twilioAuthToken.trim() },
        { key: 'twilio_phone_number', value: twilioPhoneNumber.trim() },
      ];
      for (const s of settings) {
        const { error } = await supabase.from('app_settings').upsert(s);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['twilio-credentials'] });
      toast({ title: t('Đã lưu cấu hình Twilio') });
    },
  });

  // Stripe credentials
  const { data: stripeSettings } = useQuery({
    queryKey: ['stripe-credentials'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('key, value')
        .in('key', ['stripe_publishable_key', 'stripe_secret_key', 'stripe_webhook_secret', 'stripe_payment_enabled']);
      const map: Record<string, string> = {};
      data?.forEach((r: any) => { map[r.key] = r.value; });
      return map;
    },
  });

  useEffect(() => {
    if (stripeSettings) {
      if (stripeSettings.stripe_publishable_key) setStripePublishableKey(stripeSettings.stripe_publishable_key);
      if (stripeSettings.stripe_secret_key) setStripeSecretKey(stripeSettings.stripe_secret_key);
      if (stripeSettings.stripe_webhook_secret) setStripeWebhookSecret(stripeSettings.stripe_webhook_secret);
      setStripePaymentEnabled(stripeSettings.stripe_payment_enabled === 'true');
    }
  }, [stripeSettings]);

  const saveStripeCredentials = useMutation({
    mutationFn: async () => {
      requireAdmin();
      const settings = [
        { key: 'stripe_publishable_key', value: stripePublishableKey.trim() },
        { key: 'stripe_secret_key', value: stripeSecretKey.trim() },
        { key: 'stripe_webhook_secret', value: stripeWebhookSecret.trim() },
        { key: 'stripe_payment_enabled', value: String(stripePaymentEnabled) },
      ];
      for (const s of settings) {
        if (s.value) {
          const { error } = await supabase.from('app_settings').upsert(s);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stripe-credentials'] });
      toast({ title: t('Đã lưu cấu hình Stripe') });
    },
  });

  // Square credentials
  const { data: squareSettings } = useQuery({
    queryKey: ['square-credentials'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('key, value')
        .in('key', ['square_access_token', 'square_location_id', 'square_environment', 'square_terminal_enabled', 'square_application_id', 'square_online_enabled', 'square_device_id']);
      const map: Record<string, string> = {};
      data?.forEach((r: any) => { map[r.key] = r.value; });
      return map;
    },
  });

  useEffect(() => {
    if (squareSettings) {
      if (squareSettings.square_access_token) setSquareAccessToken(squareSettings.square_access_token);
      if (squareSettings.square_location_id) setSquareLocationId(squareSettings.square_location_id);
      if (squareSettings.square_environment) setSquareEnvironment(squareSettings.square_environment);
      setSquareTerminalEnabled(squareSettings.square_terminal_enabled === 'true');
      if (squareSettings.square_application_id) setSquareApplicationId(squareSettings.square_application_id);
      setSquareOnlineEnabled(squareSettings.square_online_enabled === 'true');
      if (squareSettings.square_device_id) setSquareDeviceId(squareSettings.square_device_id);
    }
  }, [squareSettings]);

  const saveSquareCredentials = useMutation({
    mutationFn: async () => {
      requireAdmin();
      const settings = [
        { key: 'square_access_token', value: squareAccessToken.trim() },
        { key: 'square_location_id', value: squareLocationId.trim() },
        { key: 'square_environment', value: squareEnvironment },
        { key: 'square_terminal_enabled', value: String(squareTerminalEnabled) },
        { key: 'square_application_id', value: squareApplicationId.trim() },
        { key: 'square_online_enabled', value: String(squareOnlineEnabled) },
        { key: 'square_device_id', value: squareDeviceId.trim() },
      ];
      for (const s of settings) {
        if (s.value) {
          const { error } = await supabase.from('app_settings').upsert(s);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['square-credentials'] });
      toast({ title: t('Đã lưu cấu hình Square') });
    },
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
      requireAdmin();
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
        .in('key', ['shop_phone', 'shop_address', 'opening_hours', 'open_days', 'open_time', 'close_time', 'shop_state', 'shop_timezone', 'show_holiday_closed', 'hero_mode', 'hero_media_path']);
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
      setOpeningHours(shopInfoSettings['opening_hours'] || '');
      if (shopInfoSettings['open_days']) setOpenDays(JSON.parse(shopInfoSettings['open_days']));
      if (shopInfoSettings['open_time']) setOpenTime(shopInfoSettings['open_time']);
      if (shopInfoSettings['close_time']) setCloseTime(shopInfoSettings['close_time']);
      if (shopInfoSettings['shop_state']) setShopState(shopInfoSettings['shop_state']);
      if (shopInfoSettings['shop_timezone']) setShopTimezone(shopInfoSettings['shop_timezone']);
      if (shopInfoSettings['show_holiday_closed'] !== undefined) setShowHolidayClosed(shopInfoSettings['show_holiday_closed'] === 'true');
      if (shopInfoSettings['hero_mode']) setHeroMode(shopInfoSettings['hero_mode'] as 'video' | 'image');
      if (shopInfoSettings['hero_media_path']) {
        setHeroMediaPath(shopInfoSettings['hero_media_path']);
        const { data } = supabase.storage.from('hero-media').getPublicUrl(shopInfoSettings['hero_media_path']);
        setHeroMediaPreview(data.publicUrl);
      }
    }
  }, [shopInfoSettings]);

  const saveShopInfo = useMutation({
    mutationFn: async () => {
      requireAdmin();
      const rows = [
        { key: 'spa_name', value: spaName },
        { key: 'shop_phone', value: shopPhone },
        { key: 'shop_address', value: shopAddress },
        { key: 'opening_hours', value: openingHours },
        { key: 'open_days', value: JSON.stringify(openDays) },
        { key: 'open_time', value: openTime },
        { key: 'close_time', value: closeTime },
        { key: 'shop_state', value: shopState },
        { key: 'shop_timezone', value: shopTimezone },
        { key: 'show_holiday_closed', value: String(showHolidayClosed) },
      ];
      for (const row of rows) {
        const { error } = await supabase.from('app_settings').upsert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => { logActivity('update_shop_info', 'Updated shop contact info'); queryClient.invalidateQueries({ queryKey: ['shop-info-settings'] }); queryClient.invalidateQueries({ queryKey: ['spa-name-setting'] }); toast({ title: t('Đã lưu thông tin tiệm') }); },
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
      requireAdmin();
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
      requireAdmin();
      const { error } = await supabase.from('app_settings').upsert({ key: 'card_surcharge_percent', value: cardSurchargePercent });
      if (error) throw error;
    },
    onSuccess: () => { logActivity('update_card_surcharge', `Surcharge: ${cardSurchargePercent}%`); queryClient.invalidateQueries({ queryKey: ['card-surcharge-setting'] }); toast({ title: t('Đã lưu phụ phí thẻ') }); },
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

  // AI Reply toggle (quick toggle from settings list — salons without AI stay on booking-only)
  const { data: aiReplyConfig } = useQuery({
    queryKey: ['ai-reply-config', TENANT_ID],
    queryFn: async () => {
      const { data } = await supabase.from('ai_config').select('id, ai_enabled').eq('tenant_id', TENANT_ID).single();
      return data as { id: string; ai_enabled: boolean } | null;
    },
  });

  const toggleAiReply = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (aiReplyConfig?.id) {
        const { error } = await supabase.from('ai_config').update({ ai_enabled: enabled, updated_at: new Date().toISOString() }).eq('id', aiReplyConfig.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-reply-config'] });
      queryClient.invalidateQueries({ queryKey: ['ai-config'] });
      toast({ title: aiReplyConfig?.ai_enabled ? t('AI Reply disabled') : t('AI Reply enabled') });
    },
  });

  const saveOpenaiSettings = useMutation({
    mutationFn: async () => {
      requireAdmin();
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

  // About & Terms content
  const [aboutContent, setAboutContent] = useState('');
  const [termsContent, setTermsContent] = useState('');
  const { data: pageContents } = useQuery({
    queryKey: ['page-contents'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('key, value').in('key', ['about_content', 'terms_content']);
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach(r => { map[r.key] = r.value; });
      return map;
    },
  });
  useEffect(() => {
    if (pageContents) {
      setAboutContent(pageContents['about_content'] || '');
      setTermsContent(pageContents['terms_content'] || '');
    }
  }, [pageContents]);
  const saveAboutContent = useMutation({
    mutationFn: async () => {
      requireAdmin();
      const { error } = await supabase.from('app_settings').upsert({ key: 'about_content', value: aboutContent });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['page-contents'] }); queryClient.invalidateQueries({ queryKey: ['about-settings'] }); toast({ title: t('Đã lưu nội dung Về chúng tôi') }); },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });
  const saveTermsContent = useMutation({
    mutationFn: async () => {
      requireAdmin();
      const { error } = await supabase.from('app_settings').upsert({ key: 'terms_content', value: termsContent });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['page-contents'] }); queryClient.invalidateQueries({ queryKey: ['terms-content'] }); toast({ title: t('Đã lưu nội dung Điều khoản') }); },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  // Reminder & notification settings
  const { data: reminderSettings } = useQuery({
    queryKey: ['reminder-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('key, value')
        .in('key', ['reminder_email_enabled', 'reminder_sms_enabled', 'reminder_1st_hours', 'reminder_2nd_hours', 'notify_sms_enabled', 'notify_phone']);
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
      setNotifySmsEnabled(reminderSettings['notify_sms_enabled'] === 'true');
      setNotifyPhone(reminderSettings['notify_phone'] || '');
    }
  }, [reminderSettings]);

  const saveReminderSettings = useMutation({
    mutationFn: async () => {
      requireAdmin();
      const rows = [
        { key: 'reminder_email_enabled', value: String(reminderEmailEnabled) },
        { key: 'reminder_sms_enabled', value: String(reminderSmsEnabled) },
        { key: 'reminder_1st_hours', value: reminder1stHours },
        { key: 'reminder_2nd_hours', value: reminder2ndHours },
        { key: 'notify_sms_enabled', value: String(notifySmsEnabled) },
        { key: 'notify_phone', value: notifyPhone },
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
      requireAdmin();
      const payload = { name: tierName, min_visits: parseInt(tierMinVisits), discount_percent: parseFloat(tierDiscountPercent) };
      const vErr = validateForm(membershipTierSchema, payload);
      if (vErr) throw new Error(vErr);
      if (editingTier) {
        const { error } = await supabase.from('membership_tiers').update(payload).eq('id', editingTier.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('membership_tiers').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { logActivity('save_membership_tier', `Tier: ${tierName}`); queryClient.invalidateQueries({ queryKey: ['membership-tiers'] }); setMembershipDialog(false); setEditingTier(null); toast({ title: t('Đã lưu hạng thành viên') }); },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  const deleteTier = useMutation({
    mutationFn: async (id: string) => { if (!isAdmin) throw new Error('Admin only'); const { error } = await supabase.from('membership_tiers').delete().eq('id', id); if (error) throw error; },
    onSuccess: (_d, id) => { logActivity('delete_membership_tier', `Tier ID: ${id}`); queryClient.invalidateQueries({ queryKey: ['membership-tiers'] }); toast({ title: t('Đã xoá') }); },
  });

  const toggleTierActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      requireAdmin();
      const { error } = await supabase.from('membership_tiers').update({ is_active: active }).eq('id', id);
      if (error) throw error;
    },
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
      requireAdmin();
      const vErr = validateForm(discountCodeSchema, {
        code: discountCode.toUpperCase().trim(),
        discount_percent: parseFloat(discountPercent),
        discount_amount: parseFloat(discountAmount),
        valid_from: discountValidFrom || '',
        valid_to: discountValidTo || '',
        max_uses: discountMaxUses ? parseInt(discountMaxUses) : null,
      });
      if (vErr) throw new Error(vErr);
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
    onSuccess: () => { logActivity('save_discount_code', `Code: ${discountCode}`); queryClient.invalidateQueries({ queryKey: ['discount-codes'] }); setDiscountDialog(false); setEditingDiscount(null); toast({ title: t('Đã lưu mã giảm giá') }); },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  const deleteDiscount = useMutation({
    mutationFn: async (id: string) => { if (!isAdmin) throw new Error('Admin only'); const { error } = await supabase.from('discount_codes').delete().eq('id', id); if (error) throw error; },
    onSuccess: (_d, id) => { logActivity('delete_discount_code', `Code ID: ${id}`); queryClient.invalidateQueries({ queryKey: ['discount-codes'] }); toast({ title: t('Đã xoá') }); },
  });

  const toggleDiscountActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      requireAdmin();
      const { error } = await supabase.from('discount_codes').update({ is_active: active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['discount-codes'] }); },
  });

  const createGiftCardBatch = useMutation({
    mutationFn: async () => {
      requireAdmin();
      const count = parseInt(giftCardCount);
      const amount = parseFloat(giftCardAmount);
      const maxUses = parseInt(giftCardMaxUses) || 1;
      const prefix = giftCardPrefix.trim().toUpperCase() || 'GIFT';
      if (count < 1 || count > 100) throw new Error('Batch size must be 1-100');
      if (amount <= 0) throw new Error('Amount must be positive');
      const codes = Array.from({ length: count }, () => {
        const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `${prefix}-${rand}`;
      });
      const rows = codes.map(code => ({
        code,
        discount_percent: 0,
        discount_amount: amount,
        valid_from: format(new Date(), 'yyyy-MM-dd'),
        valid_to: giftCardValidTo || null,
        max_uses: maxUses,
        is_active: true,
      }));
      const { error } = await supabase.from('discount_codes').insert(rows);
      if (error) throw error;
      return codes;
    },
    onSuccess: (codes) => {
      logActivity('create_gift_cards', `Created ${codes.length} gift cards: ${codes.slice(0, 3).join(', ')}...`);
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      setGiftCardDialog(false);
      toast({ title: t('Đã tạo phiếu quà tặng'), description: `${codes.length} ${t('mã đã được tạo')}` });
    },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
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
    mutationFn: async (enabled: boolean) => {
      requireAdmin();
      const { error } = await supabase.from('app_settings').upsert({ key: 'membership_enabled', value: String(enabled) });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['membership-enabled'] }); toast({ title: t('Đã cập nhật') }); },
  });

  const toggleDiscountCodes = useMutation({
    mutationFn: async (enabled: boolean) => {
      requireAdmin();
      const { error } = await supabase.from('app_settings').upsert({ key: 'discount_codes_enabled', value: String(enabled) });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['discount-codes-enabled'] }); toast({ title: t('Đã cập nhật') }); },
  });

  // Receipt printing
  const { data: printReceiptEnabled } = useQuery({
    queryKey: ['print-receipt-enabled'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'print_receipt_enabled').single();
      if (error) return false;
      return data.value === 'true';
    },
  });

  const togglePrintReceipt = useMutation({
    mutationFn: async (enabled: boolean) => {
      requireAdmin();
      const { error } = await supabase.from('app_settings').upsert({ key: 'print_receipt_enabled', value: String(enabled) });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['print-receipt-enabled'] }); toast({ title: t('Đã cập nhật') }); },
  });

  const printReceipt = (sale: { amount: number; customerName: string; customerPhone: string; serviceName: string; addOns: { name: string; price: number }[]; paymentMethod: string; discount?: number; surcharge?: number; coupon?: string; date: string }) => {
    const win = window.open('', '_blank', 'width=320,height=600');
    if (!win) return;
    const addOnLines = sale.addOns.map(a => `<tr><td style="padding:2px 0">&nbsp;&nbsp;${a.name}</td><td style="text-align:right;padding:2px 0">A$ ${a.price.toLocaleString()}</td></tr>`).join('');
    const subtotal = sale.amount + (sale.discount || 0) - (sale.surcharge || 0);
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title><style>
      body{font-family:'Courier New',monospace;font-size:12px;width:280px;margin:0 auto;padding:16px;color:#000}
      h2{text-align:center;font-size:14px;margin:0 0 4px}
      .center{text-align:center}
      .line{border-top:1px dashed #000;margin:8px 0}
      table{width:100%;border-collapse:collapse}
      td{padding:3px 0;vertical-align:top}
      .right{text-align:right}
      .bold{font-weight:bold}
      .total{font-size:14px;font-weight:bold}
      @media print{body{margin:0;padding:8px}}
    </style></head><body>
      <h2>${spaName}</h2>
      <p class="center" style="font-size:10px;color:#666">${sale.date}</p>
      <div class="line"></div>
      ${sale.customerName ? `<p><b>${sale.customerName}</b>${sale.customerPhone ? ` · ${sale.customerPhone}` : ''}</p>` : ''}
      <div class="line"></div>
      <table>
        <tr><td class="bold">${sale.serviceName}</td><td class="right">A$ ${subtotal.toLocaleString()}</td></tr>
        ${addOnLines}
        ${(sale.discount || 0) > 0 ? `<tr><td>${sale.coupon ? `Discount (${sale.coupon})` : 'Discount'}</td><td class="right" style="color:#16a34a">-A$ ${(sale.discount || 0).toLocaleString()}</td></tr>` : ''}
        ${(sale.surcharge || 0) > 0 ? `<tr><td>Card surcharge</td><td class="right">A$ ${(sale.surcharge || 0).toLocaleString()}</td></tr>` : ''}
      </table>
      <div class="line"></div>
      <table><tr><td class="total">TOTAL</td><td class="total right">A$ ${sale.amount.toLocaleString()}</td></tr></table>
      <p style="margin-top:4px;font-size:10px;color:#666">Paid by: ${sale.paymentMethod === 'card' ? 'Card' : sale.paymentMethod === 'square' ? 'Square' : 'Cash'}</p>
      <p style="font-size:10px;color:#666">GST included</p>
      <div class="line"></div>
      <p class="center" style="font-size:10px;color:#666">Thank you for visiting!</p>
      <script>window.onload=function(){window.print();}</script>
    </body></html>`);
    win.document.close();
  };

  // Delete all data
  const handleDeleteAllData = async () => {
    if (!isAdmin) {
      toast({ title: t('Lỗi'), description: t('Chỉ admin có quyền thực hiện thao tác này'), variant: 'destructive' });
      return;
    }
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

  const filteredSales = useMemo(() => (sales || []).filter((s: any) => {
    if (salesFilterMethod !== 'all' && s.payment_method !== salesFilterMethod) return false;
    if (salesFilterDateFrom && s.sale_date < salesFilterDateFrom) return false;
    if (salesFilterDateTo && s.sale_date > salesFilterDateTo) return false;
    if (salesFilterSearch) {
      const q = salesFilterSearch.toLowerCase();
      const name = (s.customer_name || s.bookings?.customer_name || '').toLowerCase();
      const phone = (s.customer_phone || s.bookings?.customer_phone || '').toLowerCase();
      const note = (s.notes || '').toLowerCase();
      if (!name.includes(q) && !note.includes(q) && !phone.includes(q)) return false;
    }
    return true;
  }), [sales, salesFilterMethod, salesFilterDateFrom, salesFilterDateTo, salesFilterSearch]);

  // Progressive rendering for large lists
  const { visibleItems: visibleCustomers, hasMore: hasMoreCustomers, sentinelRef: customerSentinelRef } = useLoadMore(filteredCustomers);
  const { visibleItems: visibleSales, hasMore: hasMoreSales, sentinelRef: salesSentinelRef } = useLoadMore(filteredSales);
  

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
      requireAdmin();
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
    onSuccess: () => { logActivity('update_currency', 'Updated currency settings'); queryClient.invalidateQueries({ queryKey: ['currency-settings'] }); toast({ title: t('Đã lưu cài đặt tiền tệ') }); },
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
      const vErr = validateForm(unavailabilitySchema, { therapistId, date, reason: reason || '' });
      if (vErr) throw new Error(vErr);
      const { error } = await supabase.from('therapist_unavailability').insert({ therapist_id: therapistId, unavailable_date: date, reason });
      if (error) throw error;
    },
    onSuccess: () => { logActivity('add_unavailability', 'Added therapist unavailability'); queryClient.invalidateQueries({ queryKey: ['admin-unavailability'] }); toast({ title: t('Đã thêm ngày nghỉ') }); },
  });

  const removeUnavailability = useMutation({
    mutationFn: async (id: string) => {
      requireAdmin();
      const { error } = await supabase.from('therapist_unavailability').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => { logActivity('delete_unavailability', `ID: ${id}`); queryClient.invalidateQueries({ queryKey: ['admin-unavailability'] }); toast({ title: t('Đã xoá ngày nghỉ') }); },
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
      if (!s?.access_token) throw new Error('No session');
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-admins`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${s.access_token}`,
          },
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed');
      return result.admins as { id: string; email: string; role: string; created_at: string; is_current: boolean }[];
    },
  });

  // Activity logs (admin only)
  const { data: activityLogs, refetch: refetchLogs } = useQuery({
    queryKey: ['activity-logs'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('activity_logs' as any).select('*').order('created_at', { ascending: false }).limit(200) as any);
      if (error) throw error;
      return data as { id: string; user_id: string; user_email: string; action: string; details: string | null; created_at: string }[];
    },
    enabled: isAdmin,
  });

  const addHoliday = useMutation({
    mutationFn: async ({ date, reason, earlyCloseHour }: { date: string; reason?: string; earlyCloseHour?: number }) => {
      const vErr = validateForm(holidaySchema, { date, reason: reason || '', earlyCloseHour: earlyCloseHour ?? null });
      if (vErr) throw new Error(vErr);
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
      requireAdmin();
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
    onSuccess: (_d, id) => { logActivity('cancel_booking', `Booking ID: ${id}`); queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }); toast({ title: t('Đã huỷ lịch hẹn') }); },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  const updateBookingStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, { id, status }) => {
      logActivity('update_booking_status', `Booking ID: ${id}, Status: ${status}`);
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['stats-bookings'] });
      const labels: Record<string, string> = { completed: t('Đã đánh dấu hoàn thành'), no_show: t('Đã đánh dấu không đến') };
      toast({ title: labels[status] || t('Đã cập nhật trạng thái') });
    },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  const deleteBooking = useMutation({
    mutationFn: async (id: string) => {
      if (!isAdmin) throw new Error('Admin only');
      // Delete associated sales first
      await supabase.from('sales').delete().eq('booking_id', id);
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      logActivity('delete_booking', `Booking ID: ${id}`);
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-sales'] });
      toast({ title: t('Đã xoá lịch hẹn') });
    },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  const [refundingBookingId, setRefundingBookingId] = useState<string | null>(null);
  const refundBooking = useMutation({
    mutationFn: async (id: string) => {
      setRefundingBookingId(id);
      const { data, error } = await supabase.functions.invoke('create-stripe-refund', {
        body: { booking_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_d, id) => {
      setRefundingBookingId(null);
      logActivity('refund_booking', `Booking ID: ${id}`);
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      toast({ title: t('Đã hoàn tiền thành công') });
    },
    onError: (e) => {
      setRefundingBookingId(null);
      toast({ title: t('Lỗi hoàn tiền'), description: e.message, variant: 'destructive' });
    },
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
    onSuccess: () => { logActivity('reschedule_booking', 'Rescheduled a booking'); queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }); toast({ title: t('Đã dời lịch hẹn') }); },
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
      
      const vErr = validateForm(adminBookingSchema, {
        customerName: bookingCustomerName,
        customerPhone: bookingCustomerPhone,
        customerEmail: bookingCustomerEmail || '',
        notes: bookingNotes || '',
      });
      if (vErr) throw new Error(vErr);

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
      logActivity('create_booking', `Customer: ${bookingCustomerName}, Phone: ${bookingCustomerPhone}`);
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      // Send confirmation email if customer email provided
      if (bookingCustomerEmail?.trim()) {
        const service = services?.find(s => s.id === bookingServiceId);
        const therapist = therapists?.find(t => t.id === bookingTherapistId);
        const esc = escapeHtml;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
            <div style="background: hsl(30, 35%, 28%); border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
              <h1 style="color: #fff; margin: 0; font-size: 22px;">Booking Confirmed!</h1>
            </div>
            <div style="padding: 20px;">
              <p style="font-size: 16px;">Hi <strong>${esc(bookingCustomerName)}</strong>,</p>
              <p style="font-size: 14px; color: #666;">Your booking has been confirmed.</p>
              <div style="background: hsl(35, 30%, 95%); border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 4px 0;">📋 <strong>Service:</strong> ${esc(service?.name || '')}</p>
                <p style="margin: 4px 0;">👤 <strong>Staff:</strong> ${esc(therapist?.name || '')}</p>
                <p style="margin: 4px 0;">📅 <strong>Date:</strong> ${bookingDate ? format(bookingDate, 'dd/MM/yyyy') : ''}</p>
                <p style="margin: 4px 0;">🕐 <strong>Time:</strong> ${esc(bookingTime || '')}</p>
              </div>
              <p style="font-size: 14px; color: #666;">Thank you for choosing us. We look forward to seeing you!</p>
            </div>
          </div>
        `;
        supabase.functions.invoke('send-email-resend', {
          body: {
            to: bookingCustomerEmail.trim(),
            subject: `Booking Confirmed - ${service?.name || 'Oasis Reserve'}`,
            html: emailHtml,
          },
        }).catch(err => console.error('Failed to send confirmation email:', err));
      }
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
      if (editingService) requireAdmin();
      let imagePath = editingService?.image_path || null;

      // Upload image if a new file is selected
      if (serviceImageFile) {
        const ext = serviceImageFile.name.split('.').pop();
        const path = `service-${Date.now()}.${ext}`;
        // Remove old image if replacing
        if (imagePath) {
          await supabase.storage.from('service-images').remove([imagePath]);
        }
        const { error: uploadErr } = await supabase.storage.from('service-images').upload(path, serviceImageFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        imagePath = path;
      }

      const payload = { name: serviceName, description: serviceDesc || null, duration_minutes: parseInt(serviceDuration), price: parseInt(servicePrice), image_path: imagePath };
      const vErr = validateForm(serviceSchema, { name: payload.name, description: payload.description || '', duration_minutes: payload.duration_minutes, price: payload.price });
      if (vErr) throw new Error(vErr);
      if (editingService) {
        const { error } = await supabase.from('services').update(payload).eq('id', editingService.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('services').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      logActivity(editingService ? 'update_service' : 'create_service', `Service: ${serviceName}`);
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setServiceDialog(false);
      setServiceImageFile(null);
      setServiceImagePreview(null);
      toast({ title: editingService ? t('Đã cập nhật dịch vụ') : t('Đã thêm dịch vụ') });
    },
  });

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      if (!isAdmin) throw new Error('Admin only');
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      logActivity('delete_service', `Service ID: ${id}`);
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      toast({ title: t('Đã xoá dịch vụ') });
    },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  const saveTherapist = useMutation({
    mutationFn: async () => {
      if (editingTherapist) requireAdmin();
      const payload = {
        name: therapistName,
        phone: therapistPhone || null,
        email: therapistEmail || null,
        start_hour: parseInt(therapistStartHour),
        end_hour: parseInt(therapistEndHour),
        break_start: therapistBreakStart ? parseInt(therapistBreakStart) : null,
        break_end: therapistBreakEnd ? parseInt(therapistBreakEnd) : null,
      } as any;
      const vErr = validateForm(therapistSchema, {
        name: payload.name,
        phone: payload.phone || '',
        email: payload.email || '',
        start_hour: payload.start_hour,
        end_hour: payload.end_hour,
        break_start: payload.break_start,
        break_end: payload.break_end,
      });
      if (vErr) throw new Error(vErr);
      if (editingTherapist) {
        const { error } = await supabase.from('therapists').update(payload).eq('id', editingTherapist.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('therapists').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      logActivity(editingTherapist ? 'update_therapist' : 'create_therapist', `Therapist: ${therapistName}`);
      queryClient.invalidateQueries({ queryKey: ['admin-therapists'] });
      setTherapistDialog(false);
      toast({ title: editingTherapist ? t('Đã cập nhật thợ') : t('Đã thêm thợ') });
    },
  });

  const deleteTherapist = useMutation({
    mutationFn: async (id: string) => {
      if (!isAdmin) throw new Error('Admin only');
      const { error } = await supabase.from('therapists').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      logActivity('delete_therapist', `Therapist ID: ${id}`);
      queryClient.invalidateQueries({ queryKey: ['admin-therapists'] });
      toast({ title: t('Đã xoá thợ') });
    },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });


  const openServiceEdit = (service?: any) => {
    setEditingService(service || null);
    setServiceName(service?.name || '');
    setServiceDesc(service?.description || '');
    setServiceDuration(String(service?.duration_minutes || 60));
    setServicePrice(String(service?.price || 0));
    setServiceImageFile(null);
    if (service?.image_path) {
      const { data } = supabase.storage.from('service-images').getPublicUrl(service.image_path);
      setServiceImagePreview(data.publicUrl);
    } else {
      setServiceImagePreview(null);
    }
    setServiceDialog(true);
  };

  const openTherapistEdit = (therapist?: any) => {
    setEditingTherapist(therapist || null);
    setTherapistName(therapist?.name || '');
    setTherapistPhone(therapist?.phone || '');
    setTherapistEmail(therapist?.email || '');
    setTherapistStartHour(String(therapist?.start_hour || 9));
    setTherapistEndHour(String(therapist?.end_hour || 18));
    setTherapistBreakStart(therapist?.break_start ? String(therapist.break_start) : '');
    setTherapistBreakEnd(therapist?.break_end ? String(therapist.break_end) : '');
    setTherapistDialog(true);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { confirmed: t('Đã xác nhận'), cancelled: t('Đã huỷ'), completed: t('Hoàn thành'), no_show: t('Không đến') };
    const variant = status === 'confirmed' ? 'default' : status === 'cancelled' ? 'destructive' : status === 'no_show' ? 'outline' : 'secondary';
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

  if (loading) return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-700 to-yellow-800 flex items-center justify-center animate-pulse">
          <Leaf className="h-5 w-5 text-white" />
        </div>
        <p className="text-sm text-gray-400">{t('Đang tải...')}</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/admin/login" />;
  if (!isStaff) return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
      <div className="text-center space-y-2">
        <Shield className="h-10 w-10 text-gray-300 mx-auto" />
        <p className="text-sm text-gray-500 font-medium">{t('Bạn không có quyền truy cập.')}</p>
      </div>
    </div>
  );

  const allNavItems = [
    { value: 'stats', icon: BarChart3, label: t('Thống kê') },
    { value: 'bookings', icon: CalendarDays, label: t('Lịch hẹn') },
    { value: 'customers', icon: UserCheck, label: t('Khách hàng') },
    { value: 'sales', icon: DollarSign, label: t('Thanh toán') },
    { value: 'services', icon: Scissors, label: t('Dịch vụ') },
    { value: 'therapists', icon: Users, label: t('Thợ') },
    // Inbox only visible when AI Reply is enabled
    ...(aiReplyConfig?.ai_enabled ? [{ value: 'inbox', icon: MessageSquare, label: t('Hộp thư') }] : []),
  ];

  const sidebarNavItems = [
    ...allNavItems.filter(item => isAdmin || employeeVisibleTabs.includes(item.value as EmployeeTab)),
    ...(canAccessSettings ? [{ value: 'settings', icon: Settings, label: t('Cài đặt') }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5] admin-shell">
      {showOnboarding && user?.id && (
        <AdminOnboarding userId={user.id} onComplete={() => setShowOnboarding(false)} />
      )}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Desktop Sidebar */}
        <aside className={cn(
          "hidden sm:flex fixed inset-y-0 left-0 z-40 flex-col bg-[#FAFAFA] border-r border-[#E5E5E5] transition-all duration-300 ease-in-out",
          sidebarOpen ? "w-[220px]" : "w-[68px]"
        )}>
          {/* Floating toggle on sidebar edge */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute -right-3 top-7 z-50 h-6 w-6 rounded-full bg-white border border-[#E5E5E5] shadow-sm flex items-center justify-center text-[#737373] hover:text-[#1B1B1B] hover:bg-[#F5F5F5] transition-all hover:scale-110"
          >
            {sidebarOpen ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>

          {/* Sidebar header / brand */}
          <div className={cn("border-b border-[#E5E5E5]", sidebarOpen ? "px-3 py-4" : "px-2 py-4 flex flex-col items-center")}>
            <Link to="/" className={cn("flex items-center overflow-hidden", sidebarOpen ? "gap-2.5" : "justify-center")}>
              <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-amber-700 to-yellow-800 flex items-center justify-center">
                <Leaf className="h-4 w-4 text-white" />
              </div>
              {sidebarOpen && <span className="font-semibold text-[15px] text-[#1B1B1B] tracking-tight whitespace-nowrap truncate">{spaName}</span>}
            </Link>
          </div>

          {/* Sidebar nav */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
            <TabsList className="flex flex-col h-auto w-full bg-transparent p-0 gap-0.5">
              {sidebarNavItems.map(item => (
                <TooltipProvider key={item.value} delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger
                        value={item.value}
                        style={activeTab === item.value ? {
                          background: '#fff',
                          border: '1.5px solid #006AFF',
                          boxShadow: '0 2px 8px rgba(90, 61, 46, 0.15)',
                          color: '#1B1B1B',
                          fontWeight: 600,
                        } : {}}
                        className={cn(
                          "group relative w-full justify-start gap-3 rounded-lg py-2.5 text-[13px] font-medium text-[#737373] border border-transparent hover:text-[#1B1B1B] hover:bg-[#F5F5F5] transition-all",
                          sidebarOpen ? "px-3" : "px-2 justify-center"
                        )}
                      >
                        {activeTab === item.value && (
                          <div className={cn(
                            "absolute top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-[#006AFF]",
                            sidebarOpen ? "left-0 h-6" : "left-0 h-5"
                          )} />
                        )}
                        <item.icon className={cn(
                          "shrink-0 transition-all",
                          activeTab === item.value ? "scale-110 text-[#1B1B1B]" : "",
                          sidebarOpen ? "h-[18px] w-[18px]" : "h-5 w-5"
                        )} />
                        {sidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
                      </TabsTrigger>
                    </TooltipTrigger>
                    {!sidebarOpen && (
                      <TooltipContent side="right" className="text-xs">
                        {item.label}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              ))}
            </TabsList>
          </nav>

          {/* Sidebar footer - user info */}
          <div className={cn("border-t border-[#E5E5E5] transition-all duration-300", sidebarOpen ? "p-4" : "p-2 flex flex-col items-center")}>
            {isEmployee && !isAdmin && sidebarOpen && (
              <div className="mb-3 flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700 border border-amber-100">
                <Lock className="h-3 w-3 shrink-0" />
                {t('Quyền hạn chế')}
              </div>
            )}
            <div className={cn("flex items-center", sidebarOpen ? "gap-2.5" : "justify-center")}>
              <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-amber-600 to-yellow-700 flex items-center justify-center text-white text-xs font-semibold">
                {(user?.email || '?').charAt(0).toUpperCase()}
              </div>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-gray-900 truncate">{user?.email}</p>
                  <p className={cn('text-[10px] font-medium', isAdmin ? 'text-amber-700' : 'text-amber-600')}>
                    {isAdmin ? 'Admin' : 'Employee'}
                  </p>
                </div>
              )}
            </div>
            {sidebarOpen ? (
              <div className="mt-3 flex items-center gap-2">
                <LanguageSwitcher />
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600 text-[11px] gap-1 h-7 px-2" onClick={signOut}>
                  <LogOut className="h-3 w-3" /> {t('Đăng xuất')}
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="icon" className="mt-2 h-7 w-7 text-gray-400 hover:text-gray-600" onClick={signOut}>
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </aside>

        {/* Mobile top header — minimal, just brand + hamburger */}
        <header className="sm:hidden sticky top-0 z-50 bg-[#F5F5F5]/95 backdrop-blur-md border-b border-[#E5E5E5]/60">
          <div className="px-4 py-2.5 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-700 to-yellow-800 flex items-center justify-center">
                <Leaf className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-semibold text-[13px] text-[#1B1B1B] tracking-tight">{spaName}</span>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-[#737373] hover:bg-[#F0F0F0] transition-colors"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Mobile slide-down menu overlay */}
        {mobileMenuOpen && (
          <div className="sm:hidden fixed inset-0 z-[60]" onClick={() => setMobileMenuOpen(false)}>
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
            <div
              className="absolute top-0 left-0 right-0 bg-[#F5F5F5] shadow-xl rounded-b-2xl overflow-hidden animate-[slideDown_0.2s_ease-out]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header inside overlay */}
              <div className="px-4 py-2.5 flex items-center justify-between border-b border-[#E5E5E5]/40">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-700 to-yellow-800 flex items-center justify-center">
                    <Leaf className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="font-semibold text-[13px] text-[#1B1B1B] tracking-tight">{spaName}</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-[#737373] hover:bg-[#F0F0F0] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* User info */}
              <div className="px-4 py-3 flex items-center gap-3 border-b border-[#E5E5E5]/30">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-600 to-yellow-700 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                  {(user?.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[#1B1B1B] truncate">{user?.email}</p>
                  <p className={cn('text-[10px] font-semibold', isAdmin ? 'text-amber-700' : 'text-amber-600')}>
                    {isAdmin ? 'Admin' : 'Employee'}
                  </p>
                </div>
                <LanguageSwitcher />
              </div>

              {/* Menu actions */}
              <div className="px-2 py-2">
                <button
                  onClick={() => { signOut(); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-gray-500 hover:bg-[#F5F5F5] hover:text-[#1B1B1B] transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  {t('Đăng xuất')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile bottom nav — Apple-style, 5 items max */}
        {(() => {
          const primaryTabs = [
            { value: 'stats', icon: BarChart3, label: t('Thống kê') },
            { value: 'bookings', icon: CalendarDays, label: t('Lịch hẹn') },
            { value: 'customers', icon: UserCheck, label: t('Khách') },
            { value: 'services', icon: Scissors, label: t('Dịch vụ') },
          ];
          const moreTabs = [
            { value: 'sales', icon: DollarSign, label: t('Thanh toán') },
            { value: 'therapists', icon: Users, label: t('Thợ') },
            ...(canAccessSettings ? [{ value: 'settings', icon: Settings, label: t('Cài đặt') }] : []),
          ];
          const isMoreActive = moreTabs.some(t => t.value === activeTab);

          return (
            <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden safe-bottom">
              <div className="bg-[#F5F5F5]/80 backdrop-blur-xl border-t border-[#E5E5E5]/50">
                <div className="grid grid-cols-5 px-2 pt-2 pb-1">
                  {primaryTabs.map(tab => {
                    const isActive = activeTab === tab.value;
                    return (
                      <button
                        key={tab.value}
                        onClick={() => setActiveTab(tab.value)}
                        className="flex flex-col items-center gap-[3px] py-1 transition-all duration-200"
                      >
                        <div className={`transition-all duration-200 ${isActive ? 'scale-105' : 'scale-100'}`}>
                          <tab.icon
                            className={`h-[22px] w-[22px] transition-colors duration-200 ${
                              isActive ? 'text-[#1B1B1B]' : 'text-[#BDBDBD]'
                            }`}
                            strokeWidth={isActive ? 2 : 1.5}
                          />
                        </div>
                        <span className={`text-[10px] leading-none transition-all duration-200 ${
                          isActive
                            ? 'text-[#1B1B1B] font-medium opacity-100'
                            : 'text-[#BDBDBD] font-normal opacity-80'
                        }`}>
                          {tab.label}
                        </span>
                      </button>
                    );
                  })}

                  {/* More button */}
                  <button
                    onClick={() => setMoreSheetOpen(true)}
                    className="flex flex-col items-center gap-[3px] py-1 transition-all duration-200"
                  >
                    <div className={`transition-all duration-200 ${isMoreActive ? 'scale-105' : 'scale-100'}`}>
                      <Ellipsis
                        className={`h-[22px] w-[22px] transition-colors duration-200 ${
                          isMoreActive ? 'text-[#1B1B1B]' : 'text-[#BDBDBD]'
                        }`}
                        strokeWidth={isMoreActive ? 2 : 1.5}
                      />
                    </div>
                    <span className={`text-[10px] leading-none transition-all duration-200 ${
                      isMoreActive
                        ? 'text-[#1B1B1B] font-medium opacity-100'
                        : 'text-[#BDBDBD] font-normal opacity-80'
                    }`}>
                      {t('Thêm')}
                    </span>
                  </button>
                </div>
              </div>

              {/* More sheet overlay */}
              {moreSheetOpen && (
                <div className="fixed inset-0 z-[70]" onClick={() => setMoreSheetOpen(false)}>
                  <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px] transition-opacity" />
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-[#F5F5F5] rounded-t-2xl shadow-2xl animate-[sheetUp_0.25s_ease-out]"
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Handle bar */}
                    <div className="flex justify-center pt-3 pb-1">
                      <div className="w-9 h-1 rounded-full bg-[#CCCCCC]" />
                    </div>

                    <div className="px-5 pb-2">
                      <p className="text-[11px] tracking-[0.1em] uppercase text-[#9E9E9E] font-medium mb-3">{t('Thêm')}</p>
                    </div>

                    <div className="px-3 pb-6 safe-bottom space-y-0.5">
                      {moreTabs.map(tab => {
                        const isActive = activeTab === tab.value;
                        return (
                          <button
                            key={tab.value}
                            onClick={() => { setActiveTab(tab.value); setMoreSheetOpen(false); }}
                            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-150 ${
                              isActive
                                ? 'bg-[#F0F0F0] text-[#1B1B1B]'
                                : 'text-[#737373] hover:bg-[#F5F5F5]'
                            }`}
                          >
                            <tab.icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.5} />
                            <span className={`text-[14px] ${isActive ? 'font-medium' : 'font-normal'}`}>
                              {tab.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Main content area */}
        <main className={cn("min-h-screen transition-all duration-300 ease-in-out", sidebarOpen ? "sm:ml-[220px]" : "sm:ml-[68px]")}>
          <div className="px-4 sm:px-8 py-6 pb-24 sm:pb-8">

          {/* Inbox Tab */}
          <TabsContent value="inbox">
            <InboxPanel />
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats">
            <BookingStats />
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[#1B1B1B] tracking-tight">{t('Khách hàng')}</h2>
                  <p className="text-sm text-muted-foreground/70 mt-0.5">{filteredCustomers.length} {t('khách hàng')}{hasMoreCustomers ? ` (${visibleCustomers.length} ${t('hiển thị')})` : ''}</p>
                </div>
                <div className="relative w-full sm:w-[280px]">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                  <Input
                    placeholder={t('Tìm theo tên hoặc SĐT...')}
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    className="pl-9 h-10 text-sm bg-[#F5F5F5] border-[#E5E5E5]/50 rounded-xl focus:bg-white"
                  />
                </div>
              </div>

              {/* Customer list */}
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-15" />
                  <p className="text-sm font-medium">{t('Chưa có khách hàng')}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">{t('Khách hàng sẽ được theo dõi tự động khi hoàn thành lịch hẹn')}</p>
                </div>
              ) : (
                <>
                  {/* Desktop rows */}
                  <div className="hidden sm:block rounded-xl border border-[#E5E5E5]/50 bg-white overflow-hidden">
                    {/* Column headers */}
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-6 px-5 py-3 text-[11px] font-medium tracking-wider uppercase text-muted-foreground/50 border-b border-[#E5E5E5]/30 bg-[#F5F5F5]/50">
                      <span>{t('Khách hàng')}</span>
                      <span className="w-16 text-center">{t('Lần ghé')}</span>
                      <span className="w-32">{t('Hạng thành viên')}</span>
                      <span className="w-20 text-right">{t('Cập nhật')}</span>
                    </div>

                    <div className="space-y-1">
                      {visibleCustomers.map(g => {
                        const tier = (g as any).membership_tiers;
                        return (
                          <div
                            key={g.id}
                            className="group grid grid-cols-[1fr_auto_auto_auto] gap-6 items-center px-5 py-4 rounded-xl transition-colors hover:bg-[#F5F5F5]/60"
                          >
                            {/* Avatar + name + phone stacked */}
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-[#F0F0F0] flex items-center justify-center text-[13px] font-semibold text-[#737373] shrink-0">
                                {(g.customer_name || '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[14px] font-medium text-[#1B1B1B] truncate">{g.customer_name || '—'}</p>
                                <p className="text-[12px] text-muted-foreground/60 font-mono mt-0.5">{g.customer_phone}</p>
                              </div>
                            </div>

                            {/* Visit count */}
                            <div className="w-16 flex justify-center">
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#F0F0F0] text-[12px] font-medium text-[#737373] tabular-nums">
                                {g.visit_count}
                              </span>
                            </div>

                            {/* Membership tier + discount */}
                            <div className="w-32">
                              {tier ? (
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50/80 text-amber-700/90 border border-amber-200/50">
                                    <Crown className="h-3 w-3" />
                                    {tier.name}
                                  </span>
                                  {tier.discount_percent > 0 && (
                                    <span className="text-[11px] font-medium text-emerald-600/80">-{tier.discount_percent}%</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted-foreground/40">—</span>
                              )}
                            </div>

                            {/* Last updated */}
                            <div className="w-20 text-right">
                              <span className="text-[11px] text-muted-foreground/40">{new Date(g.updated_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mobile cards */}
                  <div className="sm:hidden space-y-2">
                    {visibleCustomers.map(g => {
                      const tier = (g as any).membership_tiers;
                      return (
                        <div key={g.id} className="bg-white rounded-xl border border-[#E5E5E5]/40 p-4 transition-colors hover:border-[#CCCCCC]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-[#F0F0F0] flex items-center justify-center text-[13px] font-semibold text-[#737373] shrink-0">
                                {(g.customer_name || '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[14px] font-medium text-[#1B1B1B] truncate">{g.customer_name || '—'}</p>
                                <p className="text-[12px] text-muted-foreground/60 font-mono mt-0.5">{g.customer_phone}</p>
                              </div>
                            </div>
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#F0F0F0] text-[12px] font-medium text-[#737373] tabular-nums shrink-0">
                              {g.visit_count}
                            </span>
                          </div>
                          {tier && (
                            <div className="flex items-center gap-2 mt-3 ml-[52px]">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50/80 text-amber-700/90 border border-amber-200/50">
                                <Crown className="h-2.5 w-2.5" />
                                {tier.name}
                              </span>
                              {tier.discount_percent > 0 && (
                                <span className="text-[10px] font-medium text-emerald-600/80">-{tier.discount_percent}% {t('giảm')}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {hasMoreCustomers && <div ref={customerSentinelRef} className="py-4 text-center text-xs text-muted-foreground/50"><Loader2 className="h-4 w-4 animate-spin inline mr-1.5" />{t('Đang tải thêm...')}</div>}
                </>
              )}
            </div>
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[#1B1B1B] tracking-tight">{t('Lịch hẹn')}</h2>
                  <p className="text-sm text-muted-foreground/70 mt-0.5">{t('Quản lý lịch hẹn và đặt chỗ')}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <Select value={filterTherapist} onValueChange={setFilterTherapist}>
                    <SelectTrigger className="w-[160px] h-9 text-sm bg-[#F5F5F5] border-[#E5E5E5]/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('Tất cả thợ')}</SelectItem>
                      {therapists?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Dialog open={bookingDialog} onOpenChange={(open) => { setBookingDialog(open); if (!open) resetBookingForm(); }}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="h-9 px-4"><Plus className="h-4 w-4 mr-1.5" /> {t('Tạo lịch')}</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[460px] max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-[#1B1B1B]">{t('Tạo lịch hẹn mới')}</DialogTitle>
                        <DialogDescription className="text-muted-foreground/60">{t('Điền thông tin để tạo lịch hẹn cho khách hàng')}</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1 pt-1">
                        {/* Service & Therapist */}
                        <div className="space-y-4">
                          <div>
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Dịch vụ')}</Label>
                            <Select value={bookingServiceId} onValueChange={setBookingServiceId}>
                              <SelectTrigger className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60"><SelectValue placeholder={t('Chọn dịch vụ')} /></SelectTrigger>
                              <SelectContent>
                                {services?.filter(s => s.is_active).map(s => (
                                  <SelectItem key={s.id} value={s.id}>{s.name} ({s.duration_minutes} {t('phút')} — {formatPrice(s.price)})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Thợ')}</Label>
                            <Select value={bookingTherapistId} onValueChange={(v) => { setBookingTherapistId(v); setBookingTime(''); }}>
                              <SelectTrigger className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60"><SelectValue placeholder={t('Chọn thợ')} /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="random">{t('Tự động (ai rảnh)')}</SelectItem>
                                {therapists?.filter(t => t.is_active).map(t => (
                                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Date & Time */}
                        <div className="border-t border-[#E5E5E5]/30 pt-4 space-y-4">
                          <div>
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Ngày')}</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full mt-1.5 justify-start bg-[#F5F5F5] border-[#E5E5E5]/60", !bookingDate && "text-muted-foreground")}>
                                  {bookingDate ? format(bookingDate, 'dd/MM/yyyy') : t('Chọn ngày')}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={bookingDate} onSelect={(d) => { setBookingDate(d); setBookingTime(''); }} className="p-3 pointer-events-auto" />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div>
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Giờ')}</Label>
                            {!bookingServiceId || !bookingDate ? (
                              <p className="text-sm text-muted-foreground/50 mt-1.5 italic">{t('Chọn dịch vụ và ngày trước')}</p>
                            ) : availableSlots.length === 0 && bookingTherapistId && bookingTherapistId !== 'random' && (unavailabilities || []).some(u => u.therapist_id === bookingTherapistId && u.unavailable_date === format(bookingDate, 'yyyy-MM-dd')) ? (
                              <p className="text-sm text-destructive mt-1.5">{t('Thợ nghỉ ngày này')} - {(unavailabilities || []).find(u => u.therapist_id === bookingTherapistId && u.unavailable_date === format(bookingDate, 'yyyy-MM-dd'))?.reason || t('Không có lý do')}</p>
                            ) : availableSlots.length === 0 ? (
                              <p className="text-sm text-destructive mt-1.5">{t('Không có khung giờ trống')}</p>
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
                                      "px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all",
                                      slot.available && bookingTime !== slot.time && "border-[#E5E5E5]/60 hover:border-[#737373] hover:bg-[#F5F5F5] cursor-pointer",
                                      slot.available && bookingTime === slot.time && "border-[#006AFF] bg-[#006AFF] text-white",
                                      !slot.available && "border-border/30 bg-muted/30 text-muted-foreground/40 line-through cursor-not-allowed"
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
                        </div>

                        {/* Customer info */}
                        <div className="border-t border-[#E5E5E5]/30 pt-4 space-y-4">
                          <div>
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Tên khách hàng')}</Label>
                            <Input value={bookingCustomerName} onChange={e => setBookingCustomerName(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60 focus:border-[#737373] focus:ring-[#737373]/20" placeholder={t('Họ và tên')} />
                          </div>
                          <div>
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Số điện thoại')}</Label>
                            <Input value={bookingCustomerPhone} onChange={e => setBookingCustomerPhone(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60 focus:border-[#737373] focus:ring-[#737373]/20" placeholder="04xx xxx xxx" />
                          </div>
                          <div>
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Email (tuỳ chọn)')}</Label>
                            <Input value={bookingCustomerEmail} onChange={e => setBookingCustomerEmail(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60 focus:border-[#737373] focus:ring-[#737373]/20" placeholder="email@example.com" />
                          </div>
                          <div>
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Ghi chú')}</Label>
                            <Textarea value={bookingNotes} onChange={e => setBookingNotes(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60 focus:border-[#737373] focus:ring-[#737373]/20 min-h-[60px]" placeholder={t('Ghi chú thêm...')} />
                          </div>
                        </div>

                        <Button className="w-full h-10 bg-[#006AFF] hover:bg-[#1B1B1B] text-white" onClick={() => createBooking.mutate()}
                          disabled={!bookingServiceId || !bookingTherapistId || !bookingDate || !bookingTime || !bookingCustomerName.trim() || !bookingCustomerPhone.trim() || createBooking.isPending}>
                          {createBooking.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang tạo...')}</> : t('Tạo lịch hẹn')}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              {/* Calendar */}
              <div className="rounded-xl border border-[#E5E5E5]/40 bg-white overflow-hidden">
                <BookingCalendar
                  bookings={(bookings as any) || []}
                  onCancel={(id) => cancelBooking.mutate(id)}
                  onDelete={isAdmin ? (id) => openConfirm(t('Xoá lịch hẹn'), t('Bạn có chắc muốn xoá lịch hẹn này? Dữ liệu thanh toán liên quan cũng sẽ bị xoá.'), () => deleteBooking.mutate(id)) : undefined}
                  onMarkCompleted={(id) => updateBookingStatus.mutate({ id, status: 'completed' })}
                  onMarkNoShow={(id) => updateBookingStatus.mutate({ id, status: 'no_show' })}
                  onRefund={(id) => openConfirm(t('Hoàn tiền'), t('Bạn có chắc muốn hoàn tiền cho lịch hẹn này? Hành động không thể hoàn tác.'), () => refundBooking.mutate(id))}
                  onReschedule={(id, newDate, newStartTime, newEndTime) =>
                    rescheduleBooking.mutate({ id, newDate, newStartTime, newEndTime })
                  }
                  onDateSelect={(date, startTime) => {
                    setBookingDate(new Date(date + 'T00:00:00'));
                    if (startTime) setBookingTime(startTime);
                    setBookingDialog(true);
                  }}
                />
              </div>
            </div>
          </TabsContent>

          {/* Sales Tab */}
          <TabsContent value="sales">
            <div className="space-y-6">
              {/* POS Checkout Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] rounded-xl border border-[#E5E5E5]/40 bg-white overflow-hidden" style={{ minHeight: 'min(calc(100vh - 260px), 680px)' }}>
                {/* LEFT PANEL — Appointments / Library */}
                <div className="border-r border-[#E5E5E5]/40 flex flex-col">
                  {/* Sub-tabs */}
                  <div className="flex items-center border-b border-[#E5E5E5]/40 px-1">
                    <button type="button" onClick={() => setPosTab('appointments')} className={cn('px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors', posTab === 'appointments' ? 'border-[#006AFF] text-[#006AFF]' : 'border-transparent text-muted-foreground hover:text-foreground')}>{t('Lịch hẹn')}</button>
                    <button type="button" onClick={() => setPosTab('library')} className={cn('px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors', posTab === 'library' ? 'border-[#006AFF] text-[#006AFF]' : 'border-transparent text-muted-foreground hover:text-foreground')}>{t('Dịch vụ')}</button>
                    <div className="ml-auto pr-3">
                      <button type="button" onClick={() => setPosTab('library')} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"><Plus className="h-4 w-4" /></button>
                    </div>
                  </div>

                  {/* Search */}
                  <div className="px-4 py-3 border-b border-[#E5E5E5]/20">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                      <Input
                        value={posTab === 'appointments' ? saleBookingSearch : saleServiceSearch}
                        onChange={e => posTab === 'appointments' ? setSaleBookingSearch(e.target.value) : setSaleServiceSearch(e.target.value)}
                        className="pl-10 h-10 bg-[#F5F5F5] border-0 focus-visible:ring-1"
                        placeholder={posTab === 'appointments' ? t('Tìm theo tên, dịch vụ...') : t('Tìm dịch vụ...')}
                      />
                    </div>
                  </div>

                  {/* Scrollable list */}
                  <div className="flex-1 overflow-y-auto">
                    {posTab === 'appointments' ? (
                      <div>
                        {(() => {
                          const today = format(new Date(), 'yyyy-MM-dd');
                          const now = new Date();
                          const confirmed = (bookings || []).filter(b => b.status === 'confirmed' || b.status === 'completed');
                          const q = saleBookingSearch.toLowerCase().trim();
                          const filtered = q ? confirmed.filter(b => (b.customer_name || '').toLowerCase().includes(q) || ((b as any).services?.name || '').toLowerCase().includes(q)) : confirmed;

                          const finishing = filtered.filter(b => {
                            if (b.booking_date !== today || b.status !== 'confirmed') return false;
                            const [h, m] = (b.end_time || '').split(':').map(Number);
                            const endMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime();
                            return endMs > now.getTime() && endMs - now.getTime() < 60 * 60 * 1000;
                          });

                          const recent = filtered.filter(b => {
                            if (b.booking_date !== today) return false;
                            if (b.status === 'completed') return true;
                            const [h, m] = (b.end_time || '').split(':').map(Number);
                            const endMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime();
                            return endMs <= now.getTime();
                          });

                          const upcoming = filtered.filter(b => {
                            if (b.status !== 'confirmed') return false;
                            if (b.booking_date > today) return true;
                            if (b.booking_date === today) {
                              const [h, m] = (b.start_time || '').split(':').map(Number);
                              const startMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime();
                              return startMs > now.getTime();
                            }
                            return false;
                          });

                          const renderGroup = (label: string, items: typeof filtered) => items.length === 0 ? null : (
                            <div key={label}>
                              <div className="px-4 py-2 bg-[#F5F5F5]/80 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{label}</div>
                              {items.map(b => {
                                const isSelected = saleBookingId === b.id;
                                return (
                                  <button type="button" key={b.id} className={cn('w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-b border-[#E5E5E5]/20', isSelected ? 'bg-[#006AFF]/5' : 'hover:bg-muted/30')} onClick={() => {
                                    setSaleType('booking');
                                    setSaleBookingId(b.id);
                                    setSaleAmount(String((b as any).services?.price || 0));
                                    setSaleCustomerPhone(b.customer_phone || '');
                                    setSaleCustomerName(b.customer_name || '');
                                    setSaleServiceId((b as any).service_id || '');
                                  }}>
                                    <div className={cn('h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0', isSelected ? 'bg-[#006AFF] text-white' : 'bg-muted text-muted-foreground')}>
                                      {isSelected ? <Check className="h-4 w-4" /> : (b.customer_name || 'W').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{b.customer_name}</p>
                                      <p className="text-xs text-muted-foreground truncate">{(b as any).services?.name}</p>
                                    </div>
                                    <span className="text-sm font-medium tabular-nums shrink-0">{formatPrice((b as any).services?.price || 0)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          );

                          return (
                            <>
                              {renderGroup(t('Sắp xong'), finishing)}
                              {renderGroup(t('Vừa xong'), recent)}
                              {renderGroup(t('Sắp tới'), upcoming)}
                              {filtered.length === 0 && (
                                <div className="text-center py-16 text-muted-foreground/40">
                                  <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                  <p className="text-sm">{t('Không có lịch hẹn')}</p>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      /* Service library */
                      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {services?.filter(s => s.is_active).filter(s => {
                          if (!saleServiceSearch.trim()) return true;
                          return s.name.toLowerCase().includes(saleServiceSearch.toLowerCase());
                        }).map(s => {
                          const isSelected = saleServiceId === s.id || saleAddOns.includes(s.id);
                          const imgUrl = s.image_path ? supabase.storage.from('service-images').getPublicUrl(s.image_path).data.publicUrl : null;
                          return (
                            <button type="button" key={s.id} className={cn('flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all active:scale-[0.98]', isSelected ? 'border-[#006AFF] bg-[#006AFF]/5' : 'border-border/50 hover:border-border hover:bg-muted/30')} onClick={() => {
                              if (saleServiceId === s.id) {
                                // Unselect the primary service
                                setSaleServiceId('');
                                setSaleAmount('');
                                setSaleType('booking');
                              } else if (saleServiceId && saleServiceId !== s.id) {
                                setSaleAddOns(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]);
                              } else {
                                setSaleType('walkin');
                                setSaleServiceId(s.id);
                                setSaleAmount(String(s.price));
                              }
                            }}>
                              {imgUrl ? (
                                <div className="relative h-11 w-11 rounded-lg overflow-hidden shrink-0">
                                  <img src={imgUrl} alt={s.name} className="h-full w-full object-cover" />
                                  {isSelected && <div className="absolute inset-0 bg-[#006AFF]/30 flex items-center justify-center"><Check className="h-4 w-4 text-white" /></div>}
                                </div>
                              ) : (
                                <div className={cn('flex items-center justify-center h-11 w-11 rounded-lg shrink-0', isSelected ? 'bg-[#006AFF]/10' : 'bg-muted')}>
                                  {isSelected ? <Check className="h-4 w-4 text-[#006AFF]" /> : <Scissors className="h-3.5 w-3.5 text-muted-foreground" />}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{s.name}</p>
                                <p className="text-xs text-muted-foreground">{s.duration_minutes ? `${s.duration_minutes} min` : ''}</p>
                              </div>
                              <span className="text-sm font-semibold tabular-nums shrink-0">{formatPrice(s.price)}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT PANEL — Current Sale */}
                <div className="flex flex-col bg-white">
                  {/* Cart header */}
                  <div className="px-5 py-3.5 border-b border-[#E5E5E5]/40 flex items-center justify-between">
                    <h3 className="text-base font-semibold">{t('Thanh toán hiện tại')} {(saleServiceId || saleAddOns.length > 0) ? <span className="text-muted-foreground font-normal">({1 + saleAddOns.length})</span> : ''}</h3>
                    {(saleServiceId || saleBookingId) && (
                      <button type="button" className="text-xs text-destructive hover:text-destructive/80 font-medium transition-colors" onClick={() => { setSaleBookingId(''); setSaleServiceId(''); setSaleCustomerName(''); setSaleCustomerPhone(''); setSaleAmount(''); setSaleAddOns([]); setSaleCouponCode(''); setSaleCouponDiscount(null); setSaleCouponError(''); setSaleNotes(''); }}>
                        {t('Xoá')}
                      </button>
                    )}
                  </div>

                  {/* Customer card */}
                  {(saleCustomerName || saleBookingId) && (
                    <div className="px-5 py-3 border-b border-[#E5E5E5]/20">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-[#006AFF] flex items-center justify-center text-white text-sm font-semibold shrink-0">
                          {(saleCustomerName || 'W').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{saleCustomerName || t('Khách vãng lai')}</p>
                          {saleCustomerPhone && <p className="text-xs text-muted-foreground">{saleCustomerPhone}</p>}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                      </div>
                    </div>
                  )}

                  {/* Walk-in customer inputs (no booking selected) */}
                  {saleType === 'walkin' && saleServiceId && !saleCustomerName && (
                    <div className="px-5 py-3 border-b border-[#E5E5E5]/20 space-y-2">
                      <Input value={saleCustomerName} onChange={e => setSaleCustomerName(e.target.value)} className="h-9 text-sm" placeholder={t('Tên khách (tuỳ chọn)')} />
                      <Input value={saleCustomerPhone} onChange={e => setSaleCustomerPhone(e.target.value)} className="h-9 text-sm" placeholder="04xxxxxxxx" />
                    </div>
                  )}

                  {/* Line items */}
                  <div className="flex-1 px-5 py-4 overflow-y-auto">
                    {saleServiceId ? (
                      <div className="space-y-3">
                        {(() => {
                          const svc = services?.find(s => s.id === saleServiceId);
                          return svc ? (
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-medium text-[#006AFF]">{svc.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{svc.duration_minutes ? `${svc.duration_minutes} min` : ''}</p>
                              </div>
                              <span className="text-sm font-medium tabular-nums">{formatPrice(svc.price)}</span>
                            </div>
                          ) : null;
                        })()}

                        {saleAddOns.map(id => {
                          const svc = services?.find(s => s.id === id);
                          return svc ? (
                            <div key={id} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <p className="text-sm">{svc.name}</p>
                                <button type="button" className="text-muted-foreground/40 hover:text-destructive" onClick={() => setSaleAddOns(prev => prev.filter(a => a !== id))}><X className="h-3 w-3" /></button>
                              </div>
                              <span className="text-sm tabular-nums">{formatPrice(svc.price)}</span>
                            </div>
                          ) : null;
                        })}

                        <div className="pt-2 border-t border-[#E5E5E5]/30">
                          <p className="text-sm text-muted-foreground">GST ({t('Đã bao gồm')})</p>
                        </div>

                        {/* Discount */}
                        {discountCodesEnabled && !saleCouponDiscount && (
                          <div>
                            <div className="flex gap-2">
                              <Input
                                value={saleCouponCode}
                                onChange={e => { setSaleCouponCode(e.target.value.toUpperCase()); setSaleCouponDiscount(null); setSaleCouponError(''); }}
                                className="flex-1 h-9 text-sm font-mono bg-[#F5F5F5] border-0"
                                placeholder={t('Mã giảm giá')}
                              />
                              <Button type="button" variant="outline" size="sm" className="h-9 px-3" onClick={applyCoupon} disabled={!saleCouponCode.trim() || saleCouponLoading}>
                                {saleCouponLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : t('Áp dụng')}
                              </Button>
                            </div>
                            {saleCouponError && <p className="text-xs text-destructive mt-1">{saleCouponError}</p>}
                          </div>
                        )}
                        {saleCouponDiscount && (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 text-xs">
                              <Tag className="h-3 w-3 mr-1" />
                              {saleCouponDiscount.percent > 0 && `${saleCouponDiscount.percent}%`}
                              {saleCouponDiscount.percent > 0 && saleCouponDiscount.amount > 0 && ' + '}
                              {saleCouponDiscount.amount > 0 && `A$ ${saleCouponDiscount.amount}`}
                              {' '}{t('giảm')}
                            </Badge>
                            <button type="button" className="p-1 text-muted-foreground hover:text-destructive" onClick={() => { setSaleCouponCode(''); setSaleCouponDiscount(null); }}><X className="h-3 w-3" /></button>
                          </div>
                        )}

                        {/* Notes */}
                        <Input value={saleNotes} onChange={e => setSaleNotes(e.target.value)} className="h-9 text-sm bg-[#F5F5F5] border-0" placeholder={t('Ghi chú...')} />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground/30">
                        <DollarSign className="h-10 w-10 mb-2" />
                        <p className="text-sm">{t('Chọn lịch hẹn hoặc dịch vụ')}</p>
                      </div>
                    )}
                  </div>

                  {/* Footer — Payment method + Charge */}
                  {saleServiceId && (
                    <div className="border-t border-[#E5E5E5]/40 px-5 py-4 space-y-3">
                      {/* Payment method pills */}
                      <div className="flex gap-2">
                        <button type="button" className={cn('flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all', salePaymentMethod === 'cash' ? 'bg-[#006AFF] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80')} onClick={() => setSalePaymentMethod('cash')}>
                          <DollarSign className="h-3.5 w-3.5" /> {t('Tiền mặt')}
                        </button>
                        <button type="button" className={cn('flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all', salePaymentMethod === 'card' ? 'bg-[#006AFF] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80')} onClick={() => setSalePaymentMethod('card')}>
                          <CreditCard className="h-3.5 w-3.5" /> {t('Thẻ')}
                        </button>
                        {(squareTerminalEnabled || squareOnlineEnabled) && squareSettings?.square_access_token && (
                          <button type="button" className={cn('flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all', salePaymentMethod === 'square' ? 'bg-[#006AFF] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80')} onClick={() => { setSalePaymentMethod('square'); setShowSquareCardForm(false); }}>
                            <Square className="h-3.5 w-3.5" /> Square
                          </button>
                        )}
                      </div>

                      {/* Square sub-options */}
                      {salePaymentMethod === 'square' && (
                        <div className="flex gap-2">
                          {squareTerminalEnabled && (
                            <button type="button" className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all', !showSquareCardForm ? 'border-[#006AFF] bg-[#006AFF]/5 text-[#006AFF]' : 'border-border text-muted-foreground')} onClick={() => setShowSquareCardForm(false)}>
                              <Store className="h-3.5 w-3.5" /> Terminal
                            </button>
                          )}
                          {squareOnlineEnabled && squareApplicationId && (
                            <button type="button" className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all', showSquareCardForm ? 'border-[#006AFF] bg-[#006AFF]/5 text-[#006AFF]' : 'border-border text-muted-foreground')} onClick={() => setShowSquareCardForm(true)}>
                              <CreditCard className="h-3.5 w-3.5" /> {t('Nhập thẻ')}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Square Card Form */}
                      {salePaymentMethod === 'square' && showSquareCardForm && squareApplicationId && squareLocationId && (
                        <SquareCardForm
                          applicationId={squareApplicationId}
                          locationId={squareLocationId}
                          environment={squareEnvironment as 'sandbox' | 'production'}
                          amount={parseFloat(saleAmount || '0')}
                          onTokenize={async (nonce) => {
                            try {
                              const { data, error } = await supabase.functions.invoke('create-square-payment', {
                                body: { source_nonce: nonce, amount: parseFloat(saleAmount || '0'), note: `${saleCustomerName || 'Customer'} - ${saleNotes || 'Payment'}`, customer_name: saleCustomerName || undefined },
                              });
                              if (error) throw error;
                              toast({ title: t('Thanh toán thành công'), description: `Payment ID: ${data.payment_id}` });
                              createSale.mutate();
                            } catch (err: any) {
                              toast({ title: t('Lỗi thanh toán'), description: String(err.message || err), variant: 'destructive' });
                            }
                          }}
                          onCancel={() => setShowSquareCardForm(false)}
                          disabled={!saleAmount || parseFloat(saleAmount) <= 0}
                          labels={{ pay: t('Thanh toán'), cancel: t('Hủy'), loading: t('Đang tải form thanh toán...'), processing: t('Đang xử lý...'), enterCard: t('Nhập thông tin thẻ'), tapToPay: t('Thẻ, Apple Pay & Google Pay') }}
                        />
                      )}

                      {/* Price breakdown */}
                      {(() => {
                        const addOnTotal = saleAddOns.reduce((sum, id) => sum + (services?.find(s => s.id === id)?.price || 0), 0);
                        let base = parseFloat(saleAmount || '0') + addOnTotal;
                        let discountAmt = 0;
                        if (saleCouponDiscount) {
                          if (saleCouponDiscount.percent > 0) discountAmt += base * (saleCouponDiscount.percent / 100);
                          if (saleCouponDiscount.amount > 0) discountAmt += saleCouponDiscount.amount;
                          discountAmt = Math.min(discountAmt, base);
                        }
                        const afterDiscount = Math.max(0, base - discountAmt);
                        const surchargeRate = parseFloat(cardSurchargeSetting || '0');
                        const surchargeAmt = afterDiscount * surchargeRate / 100;
                        const grandTotal = afterDiscount + (salePaymentMethod === 'card' ? surchargeAmt : 0);
                        return base > 0 ? (
                          <div className="text-sm space-y-1">
                            {addOnTotal > 0 && <div className="flex justify-between text-muted-foreground"><span>{t('Dịch vụ chính')}</span><span>{formatPrice(parseFloat(saleAmount || '0'))}</span></div>}
                            {addOnTotal > 0 && <div className="flex justify-between text-muted-foreground"><span>{t('Dịch vụ thêm')}</span><span>+{formatPrice(addOnTotal)}</span></div>}
                            {discountAmt > 0 && <div className="flex justify-between text-green-700"><span>{t('Giảm giá')}</span><span>-{formatPrice(discountAmt)}</span></div>}
                            {salePaymentMethod === 'card' && surchargeRate > 0 && <div className="flex justify-between text-muted-foreground"><span>{t('Phụ phí thẻ')} ({surchargeRate}%)</span><span>{formatPrice(surchargeAmt)}</span></div>}
                          </div>
                        ) : null;
                      })()}

                      {/* Charge button */}
                      {(() => {
                        const addOnTotal = saleAddOns.reduce((sum, id) => sum + (services?.find(s => s.id === id)?.price || 0), 0);
                        let base = parseFloat(saleAmount || '0') + addOnTotal;
                        let discountAmt = 0;
                        if (saleCouponDiscount) {
                          if (saleCouponDiscount.percent > 0) discountAmt += base * (saleCouponDiscount.percent / 100);
                          if (saleCouponDiscount.amount > 0) discountAmt += saleCouponDiscount.amount;
                          discountAmt = Math.min(discountAmt, base);
                        }
                        const afterDiscount = Math.max(0, base - discountAmt);
                        const surchargeRate = parseFloat(cardSurchargeSetting || '0');
                        const surchargeAmt = afterDiscount * surchargeRate / 100;
                        const grandTotal = afterDiscount + (salePaymentMethod === 'card' ? surchargeAmt : 0);
                        return (
                          <Button
                            className="w-full h-14 text-lg font-semibold bg-[#006AFF] hover:bg-[#0055CC] rounded-xl"
                            onClick={() => createSale.mutate()}
                            disabled={!saleAmount || parseFloat(saleAmount) <= 0 || createSale.isPending || (salePaymentMethod === 'square' && showSquareCardForm)}
                          >
                            {createSale.isPending ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />{t('Đang xử lý...')}</> : <>{t('Thanh toán')} {grandTotal > 0 ? formatPrice(grandTotal) : ''}</>}
                          </Button>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Sale history header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#1B1B1B] tracking-tight">{t('Lịch sử thanh toán')}</h2>
                </div>
              </div>
              {/* Filters bar */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-[#F5F5F5] rounded-xl border border-[#E5E5E5]/50">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                  <Input
                    placeholder={t('Tìm khách hàng...')}
                    value={salesFilterSearch}
                    onChange={e => setSalesFilterSearch(e.target.value)}
                    className="pl-9 h-9 text-sm bg-white border-[#E5E5E5]/60"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Input type="date" value={salesFilterDateFrom} onChange={e => setSalesFilterDateFrom(e.target.value)} className="w-[140px] h-9 text-sm bg-white border-[#E5E5E5]/60" />
                  <span className="text-xs text-muted-foreground/50">→</span>
                  <Input type="date" value={salesFilterDateTo} onChange={e => setSalesFilterDateTo(e.target.value)} className="w-[140px] h-9 text-sm bg-white border-[#E5E5E5]/60" />
                </div>
                <Select value={salesFilterMethod} onValueChange={setSalesFilterMethod}>
                  <SelectTrigger className="w-[120px] h-9 text-sm bg-white border-[#E5E5E5]/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('Tất cả')}</SelectItem>
                    <SelectItem value="cash">{t('Tiền mặt')}</SelectItem>
                    <SelectItem value="card">{t('Thẻ')}</SelectItem>
                  </SelectContent>
                </Select>
                {(salesFilterSearch || salesFilterDateFrom || salesFilterDateTo || salesFilterMethod !== 'all') && (
                  <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground hover:text-foreground" onClick={() => { setSalesFilterSearch(''); setSalesFilterDateFrom(''); setSalesFilterDateTo(''); setSalesFilterMethod('all'); }}>
                    <X className="h-3 w-3 mr-1" />{t('Xóa lọc')}
                  </Button>
                )}
              </div>

              {/* Payment list */}
              {filteredSales.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">{sales?.length ? t('Không tìm thấy kết quả') : t('Chưa có thanh toán')}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{t('Tạo thanh toán đầu tiên để bắt đầu')}</p>
                  </div>
              ) : (
                  <>
                    {/* Mobile card layout */}
                    <div className="space-y-2 sm:hidden">
                      {visibleSales.map((s: any) => {
                        const customerName = s.customer_name || s.bookings?.customer_name || '—';
                        const customerPhone = s.customer_phone || s.bookings?.customer_phone || '';
                        return (
                          <div key={s.id} className="bg-white rounded-xl border border-[#E5E5E5]/40 p-4 space-y-2.5 transition-colors hover:border-[#CCCCCC]">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-[15px] font-semibold text-[#1B1B1B]">{formatPrice(Number(s.amount))}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{s.sale_date}</p>
                              </div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide ${
                                s.payment_method === 'card'
                                  ? 'bg-blue-50 text-blue-600'
                                  : 'bg-emerald-50 text-emerald-600'
                              }`}>
                                {s.payment_method === 'card' ? t('Thẻ') : t('Tiền mặt')}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <p className="text-sm text-[#1B1B1B]">{customerName}</p>
                                {customerPhone && <p className="text-xs text-muted-foreground font-mono">{customerPhone}</p>}
                                <p className="text-xs text-muted-foreground">{s.bookings?.services?.name || '—'}</p>
                              </div>
                              {isAdmin && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/40">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {!s.is_refunded && (
                                      <DropdownMenuItem className="text-amber-600" onClick={() => openConfirm(t('Hoàn tiền'), t('Xác nhận đánh dấu hoàn tiền?'), () => refundSale.mutate(s.id))}>
                                        <RotateCcw className="h-3.5 w-3.5 mr-2" /> {t('Hoàn tiền')}
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem className="text-destructive" onClick={() => openConfirm(t('Xoá thanh toán'), t('Bạn có chắc muốn xoá thanh toán này?'), () => deleteSale.mutate(s.id))}>
                                      <Trash2 className="h-3.5 w-3.5 mr-2" /> {t('Xóa')}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                            {s.is_refunded && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-600">{t('Đã hoàn tiền')}</span>
                            )}
                            {s.notes && <p className="text-xs text-muted-foreground/70 truncate">{s.notes}</p>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop row layout */}
                    <div className="hidden sm:block rounded-xl border border-[#E5E5E5]/50 bg-white overflow-hidden">
                      {/* Column headers */}
                      <div className="grid grid-cols-[1fr_1fr_auto_auto_44px] gap-4 px-5 py-3 text-[11px] font-medium tracking-wider uppercase text-muted-foreground/60 border-b border-[#E5E5E5]/30 bg-[#F5F5F5]/50">
                        <span>{t('Khách hàng')}</span>
                        <span>{t('Dịch vụ')}</span>
                        <span className="text-right w-24">{t('Số tiền')}</span>
                        <span className="text-center w-20">{t('Phương thức')}</span>
                        <span></span>
                      </div>

                      {/* Rows */}
                      <div className="space-y-1">
                        {visibleSales.map((s: any) => {
                          const customerName = s.customer_name || s.bookings?.customer_name || '—';
                          const customerPhone = s.customer_phone || s.bookings?.customer_phone || '';
                          return (
                            <div
                              key={s.id}
                              className="group grid grid-cols-[1fr_1fr_auto_auto_44px] gap-4 items-center px-5 py-3.5 rounded-xl transition-colors hover:bg-[#F5F5F5]/60"
                            >
                              {/* Customer + phone stacked */}
                              <div className="min-w-0">
                                <p className="text-[13px] font-medium text-[#1B1B1B] truncate">{customerName}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {customerPhone && <span className="text-[11px] text-muted-foreground/60 font-mono">{customerPhone}</span>}
                                  <span className="text-[11px] text-muted-foreground/40">{s.sale_date}</span>
                                </div>
                              </div>

                              {/* Service + notes stacked */}
                              <div className="min-w-0">
                                <p className="text-[13px] text-[#555555] truncate">{s.bookings?.services?.name || '—'}</p>
                                {s.notes && <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5">{s.notes}</p>}
                              </div>

                              {/* Amount */}
                              <div className="text-right w-24">
                                <span className="text-[14px] font-semibold text-[#1B1B1B] tabular-nums">{formatPrice(Number(s.amount))}</span>
                              </div>

                              {/* Method badge */}
                              <div className="text-center w-20">
                                {s.is_refunded ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium tracking-wide bg-amber-50 text-amber-600">{t('Đã hoàn tiền')}</span>
                                ) : (
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium tracking-wide ${
                                    s.payment_method === 'card'
                                      ? 'bg-blue-50 text-blue-600'
                                      : 'bg-emerald-50 text-emerald-600'
                                  }`}>
                                    {s.payment_method === 'card' ? t('Thẻ') : t('Tiền mặt')}
                                  </span>
                                )}
                              </div>

                              {/* Actions — visible on hover */}
                              <div className="flex justify-end">
                                {isAdmin && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-muted-foreground"
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-36">
                                      {!s.is_refunded && (
                                        <DropdownMenuItem className="text-amber-600 text-xs" onClick={() => openConfirm(t('Hoàn tiền'), t('Xác nhận đánh dấu hoàn tiền?'), () => refundSale.mutate(s.id))}>
                                          <RotateCcw className="h-3.5 w-3.5 mr-2" /> {t('Hoàn tiền')}
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem className="text-destructive text-xs" onClick={() => openConfirm(t('Xoá thanh toán'), t('Bạn có chắc muốn xoá thanh toán này?'), () => deleteSale.mutate(s.id))}>
                                        <Trash2 className="h-3.5 w-3.5 mr-2" /> {t('Xóa')}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {hasMoreSales && <div ref={salesSentinelRef} className="py-4 text-center text-xs text-muted-foreground/50"><Loader2 className="h-4 w-4 animate-spin inline mr-1.5" />{t('Đang tải thêm...')}</div>}
                  </>
              )}
            </div>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[#1B1B1B] tracking-tight">{t('Quản lý dịch vụ')}</h2>
                  <p className="text-sm text-muted-foreground/70 mt-0.5">{services?.length || 0} {t('dịch vụ')}</p>
                </div>
                <Dialog open={serviceDialog} onOpenChange={setServiceDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full sm:w-auto h-9 px-4" onClick={() => openServiceEdit()}><Plus className="h-4 w-4 mr-1.5" /> {t('Thêm dịch vụ')}</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                      <DialogTitle className="text-[#1B1B1B]">{editingService ? t('Sửa dịch vụ') : t('Thêm dịch vụ')}</DialogTitle>
                      <DialogDescription className="text-muted-foreground/60">{editingService ? t('Chỉnh sửa thông tin dịch vụ') : t('Thêm dịch vụ mới vào hệ thống')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 pt-1">
                      <div className="space-y-4">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Tên')}</Label>
                          <Input value={serviceName} onChange={e => setServiceName(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60 focus:border-[#737373] focus:ring-[#737373]/20" placeholder={t('Tên dịch vụ')} />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Mô tả')}</Label>
                          <Textarea value={serviceDesc} onChange={e => setServiceDesc(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60 focus:border-[#737373] focus:ring-[#737373]/20 min-h-[80px]" placeholder={t('Mô tả ngắn về dịch vụ...')} />
                        </div>
                      </div>
                      <div className="border-t border-[#E5E5E5]/30 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Thời gian (phút)')}</Label>
                            <Input type="number" value={serviceDuration} onChange={e => setServiceDuration(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60 focus:border-[#737373] focus:ring-[#737373]/20" />
                          </div>
                          <div>
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Giá (AUD)')}</Label>
                            <Input type="number" value={servicePrice} onChange={e => setServicePrice(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60 focus:border-[#737373] focus:ring-[#737373]/20" />
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-[#E5E5E5]/30 pt-4">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Hình ảnh')}</Label>
                        <div className="mt-2 space-y-2">
                          {serviceImagePreview && (
                            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-[#E5E5E5]/60 shadow-sm">
                              <img src={serviceImagePreview} alt="Preview" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => { setServiceImageFile(null); setServiceImagePreview(null); }}
                                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center text-xs hover:bg-black/60 transition-colors"
                              >×</button>
                            </div>
                          )}
                          <input
                            ref={serviceImageRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async e => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const resized = await resizeImage(file);
                                setServiceImageFile(resized);
                                setServiceImagePreview(URL.createObjectURL(resized));
                              }
                            }}
                          />
                          <Button type="button" variant="outline" size="sm" className="border-[#E5E5E5]/60 hover:bg-[#F5F5F5]" onClick={() => serviceImageRef.current?.click()}>
                            <Image className="h-3.5 w-3.5 mr-1.5" />
                            {serviceImagePreview ? t('Đổi ảnh') : t('Chọn ảnh')}
                          </Button>
                        </div>
                      </div>
                      <Button className="w-full h-10 bg-[#006AFF] hover:bg-[#1B1B1B] text-white" onClick={() => saveService.mutate()} disabled={!serviceName.trim() || saveService.isPending}>
                        {saveService.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang lưu...')}</> : (editingService ? t('Cập nhật') : t('Thêm mới'))}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Service list */}
              {!services?.length ? (
                <div className="text-center py-20 text-muted-foreground">
                  <Scissors className="h-10 w-10 mx-auto mb-3 opacity-15" />
                  <p className="text-sm font-medium">{t('Chưa có dịch vụ')}</p>
                </div>
              ) : (
                <div className="rounded-xl border border-[#E5E5E5]/50 bg-white overflow-hidden divide-y divide-[#E5E5E5]/20">
                  {services.map(s => (
                    <div
                      key={s.id}
                      className="group flex items-center justify-between px-5 py-4 transition-colors hover:bg-[#F5F5F5]/40"
                    >
                      {/* Left: name + details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5">
                          <p className="text-[14px] font-medium text-[#1B1B1B] truncate">{s.name}</p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            s.is_active
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-gray-100 text-gray-400'
                          }`}>
                            {s.is_active ? t('Hoạt động') : t('Tắt')}
                          </span>
                        </div>
                        <p className="text-[12px] text-muted-foreground/60 mt-0.5">
                          {s.duration_minutes} {t('phút')} · {formatPrice(s.price)}
                        </p>
                      </div>

                      {/* Right: actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:text-[#1B1B1B]" onClick={() => openServiceEdit(s)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-muted-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem className="text-destructive text-xs" onClick={() => openConfirm(t('Xoá dịch vụ'), t('Xoá dịch vụ này?'), () => deleteService.mutate(s.id))}>
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> {t('Xóa')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Therapists Tab */}
          <TabsContent value="therapists">
            <div className="space-y-8">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[#1B1B1B] tracking-tight">{t('Nhân viên & Lịch nghỉ')}</h2>
                  <p className="text-sm text-muted-foreground/70 mt-0.5">{therapists?.length || 0} {t('nhân viên')}</p>
                </div>
                <Dialog open={therapistDialog} onOpenChange={setTherapistDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full sm:w-auto h-9 px-4" onClick={() => openTherapistEdit()}><Plus className="h-4 w-4 mr-1.5" /> {t('Thêm nhân viên')}</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                      <DialogTitle className="text-[#1B1B1B]">{editingTherapist ? t('Sửa thông tin thợ') : t('Thêm thợ')}</DialogTitle>
                      <DialogDescription className="text-muted-foreground/60">{editingTherapist ? t('Chỉnh sửa thông tin thợ') : t('Thêm thợ mới vào hệ thống')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 pt-1">
                      <div className="space-y-4">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Tên')}</Label>
                          <Input value={therapistName} onChange={e => setTherapistName(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60 focus:border-[#737373] focus:ring-[#737373]/20" placeholder={t('Họ và tên')} />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Email')}</Label>
                          <Input type="email" value={therapistEmail} onChange={e => setTherapistEmail(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60 focus:border-[#737373] focus:ring-[#737373]/20" placeholder="staff@example.com" />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('SĐT')}</Label>
                          <Input value={therapistPhone} onChange={e => setTherapistPhone(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60 focus:border-[#737373] focus:ring-[#737373]/20" placeholder="04xx xxx xxx" />
                        </div>
                      </div>
                      <div className="border-t border-[#E5E5E5]/30 pt-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t('Giờ làm việc')}</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">{t('Giờ bắt đầu')}</Label>
                            <Input type="number" min="6" max="22" value={therapistStartHour} onChange={e => setTherapistStartHour(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60 focus:border-[#737373] focus:ring-[#737373]/20" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">{t('Giờ kết thúc')}</Label>
                            <Input type="number" min="6" max="22" value={therapistEndHour} onChange={e => setTherapistEndHour(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60 focus:border-[#737373] focus:ring-[#737373]/20" />
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-[#E5E5E5]/30 pt-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t('Nghỉ trưa')}</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">{t('Nghỉ trưa từ')}</Label>
                            <Input type="number" min="6" max="22" placeholder="12" value={therapistBreakStart} onChange={e => setTherapistBreakStart(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60 focus:border-[#737373] focus:ring-[#737373]/20" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">{t('Nghỉ trưa đến')}</Label>
                            <Input type="number" min="6" max="22" placeholder="13" value={therapistBreakEnd} onChange={e => setTherapistBreakEnd(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60 focus:border-[#737373] focus:ring-[#737373]/20" />
                          </div>
                        </div>
                      </div>
                      <Button className="w-full h-10 bg-[#006AFF] hover:bg-[#1B1B1B] text-white" onClick={() => saveTherapist.mutate()} disabled={!therapistName.trim() || saveTherapist.isPending}>
                        {saveTherapist.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang lưu...')}</> : (editingTherapist ? t('Cập nhật') : t('Thêm mới'))}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Scheduling section — Day off + Shop holidays merged */}
              <div className="rounded-xl border border-[#E5E5E5]/40 bg-white overflow-hidden">
                {/* Day off controls */}
                <div className="p-5 sm:p-6">
                  <p className="text-[13px] font-semibold text-[#1B1B1B] mb-3">{t('Ngày nghỉ nhân viên')}</p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <Select value={unavailTherapist} onValueChange={setUnavailTherapist}>
                      <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-[#F5F5F5] border-[#E5E5E5]/50"><SelectValue placeholder={t('Chọn thợ')} /></SelectTrigger>
                      <SelectContent>
                        {therapists?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("h-9 text-sm", !unavailDate && "text-muted-foreground")}>
                          <CalendarOff className="h-3.5 w-3.5 mr-1.5" />
                          {unavailDate ? format(unavailDate, 'dd/MM/yyyy') : t('Chọn ngày')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={unavailDate} onSelect={setUnavailDate} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    <Button size="sm" className="h-9" disabled={!unavailTherapist || !unavailDate || addUnavailability.isPending}
                      onClick={() => {
                        if (unavailTherapist && unavailDate) {
                          addUnavailability.mutate({ therapistId: unavailTherapist, date: format(unavailDate, 'yyyy-MM-dd') });
                          setUnavailDate(undefined);
                        }
                      }}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> {t('Thêm ngày nghỉ')}
                    </Button>
                  </div>
                  {/* Staff day-off pills */}
                  {therapists && unavailabilities && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {therapists.map(th => {
                        const todayStr = format(new Date(), 'yyyy-MM-dd');
                        const count = unavailabilities.filter((u: any) => u.therapist_id === th.id && u.unavailable_date >= todayStr).length;
                        if (!count) return null;
                        return (
                          <button
                            key={th.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F5F5F5] border border-[#E5E5E5]/60 text-xs text-[#737373] hover:bg-[#F5F5F5] transition-colors"
                            onClick={() => { setViewingTherapist(th); setUnavailMonthFilter(format(new Date(), 'yyyy-MM')); setTherapistInfoDialog(true); }}
                          >
                            <span className="font-medium">{th.name}</span>
                            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-[#F0F0F0] text-[10px] font-semibold text-[#1B1B1B]">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-[#E5E5E5]/30" />

                {/* Shop holidays */}
                <div className="p-5 sm:p-6">
                  <p className="text-[13px] font-semibold text-[#1B1B1B] mb-3">{t('Ngày nghỉ tiệm / Đóng cửa sớm')}</p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("h-9 text-sm", !holidayDate && "text-muted-foreground")}>
                          <CalendarOff className="h-3.5 w-3.5 mr-1.5" />
                          {holidayDate ? format(holidayDate, 'dd/MM/yyyy') : t('Chọn ngày')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={holidayDate} onSelect={setHolidayDate} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground/70 whitespace-nowrap">{t('Đóng cửa sớm lúc')}</span>
                      <Select value={earlyCloseHour} onValueChange={setEarlyCloseHour}>
                        <SelectTrigger className="w-[100px] h-9 text-sm bg-[#F5F5F5] border-[#E5E5E5]/50"><SelectValue placeholder={t('Không')} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('Nghỉ cả ngày')}</SelectItem>
                          {Array.from({ length: 13 }, (_, i) => i + 10).map(h => (
                            <SelectItem key={h} value={String(h)}>{h}:00</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button size="sm" className="h-9" disabled={!holidayDate || addHoliday.isPending}
                      onClick={() => {
                        if (holidayDate) {
                          addHoliday.mutate({
                            date: format(holidayDate, 'yyyy-MM-dd'),
                            earlyCloseHour: earlyCloseHour !== 'none' ? parseInt(earlyCloseHour) : undefined,
                          });
                          setHolidayDate(undefined);
                          setEarlyCloseHour('none');
                        }
                      }}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> {t('Thêm')}
                    </Button>
                  </div>
                  {shopHolidays && shopHolidays.length > 0 && (
                    <div className="space-y-1.5 mt-3">
                      {shopHolidays.filter((h: any) => h.holiday_date >= format(new Date(), 'yyyy-MM-dd')).map((h: any) => (
                        <div key={h.id} className="flex items-center justify-between py-2.5 px-4 bg-red-50/60 rounded-lg text-sm border border-red-100/50">
                          <span className="text-[13px]">
                            <span className="font-medium text-[#1B1B1B]">{h.holiday_date}</span>
                            <span className="text-muted-foreground ml-2">
                              {h.early_close_hour ? `${t('Đóng cửa lúc')} ${h.early_close_hour}:00` : t('Nghỉ cả ngày')}
                            </span>
                          </span>
                          <AdminOnlyButton variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/40 hover:text-destructive" onClick={() => openConfirm(t('Xoá ngày nghỉ'), t('Xoá ngày nghỉ tiệm này?'), () => removeHoliday.mutate(h.id))}>
                            <X className="h-3.5 w-3.5" />
                          </AdminOnlyButton>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Staff list */}
              {!therapists?.length ? (
                <div className="text-center py-20 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-15" />
                  <p className="text-sm font-medium">{t('Chưa có nhân viên')}</p>
                </div>
              ) : (
                <>
                  {/* Desktop rows */}
                  <div className="hidden sm:block rounded-xl border border-[#E5E5E5]/50 bg-white overflow-hidden">
                    <div className="grid grid-cols-[1fr_1fr_auto_auto_44px] gap-4 px-5 py-3 text-[11px] font-medium tracking-wider uppercase text-muted-foreground/50 border-b border-[#E5E5E5]/30 bg-[#F5F5F5]/50">
                      <span>{t('Nhân viên')}</span>
                      <span>{t('Giờ làm việc')}</span>
                      <span className="w-24">{t('Trạng thái')}</span>
                      <span className="w-16"></span>
                      <span></span>
                    </div>
                    <div className="divide-y divide-[#E5E5E5]/20">
                      {therapists.map(th => (
                        <div
                          key={th.id}
                          className="group grid grid-cols-[1fr_1fr_auto_auto_44px] gap-4 items-center px-5 py-4 rounded-xl transition-colors hover:bg-[#F5F5F5]/60"
                        >
                          {/* Name + contact stacked */}
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-[#F0F0F0] flex items-center justify-center text-[13px] font-semibold text-[#737373] shrink-0">
                              {(th.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <button
                                className="text-[14px] font-medium text-[#1B1B1B] truncate block text-left hover:text-[#006AFF] transition-colors"
                                onClick={() => { setViewingTherapist(th); setTherapistInfoDialog(true); }}
                              >{th.name}</button>
                              <div className="flex items-center gap-2 mt-0.5">
                                {(th as any).email && <span className="text-[11px] text-muted-foreground/60 truncate">{(th as any).email}</span>}
                                {th.phone && <span className="text-[11px] text-muted-foreground/50 font-mono">{th.phone}</span>}
                              </div>
                            </div>
                          </div>

                          {/* Working hours */}
                          <div className="min-w-0">
                            <p className="text-[13px] text-[#555555]">
                              {th.start_hour}:00 – {th.end_hour}:00
                            </p>
                            {th.break_start != null && th.break_end != null && (
                              <p className="text-[11px] text-muted-foreground/50 mt-0.5">{t('Nghỉ trưa')} {th.break_start}:00–{th.break_end}:00</p>
                            )}
                          </div>

                          {/* Status badge */}
                          <div className="w-24">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium ${
                              th.is_active
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'bg-gray-100 text-gray-400'
                            }`}>
                              {th.is_active ? t('Hoạt động') : t('Tắt')}
                            </span>
                          </div>

                          {/* Day off count */}
                          <div className="w-16 flex justify-center">
                            {(() => {
                              const todayStr = format(new Date(), 'yyyy-MM-dd');
                              const count = (unavailabilities || []).filter((u: any) => u.therapist_id === th.id && u.unavailable_date >= todayStr).length;
                              return count > 0 ? (
                                <button
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50/80 text-amber-700/80 text-[10px] font-medium border border-amber-200/40 hover:bg-amber-100/60 transition-colors"
                                  onClick={() => { setViewingTherapist(th); setUnavailMonthFilter(format(new Date(), 'yyyy-MM')); setTherapistInfoDialog(true); }}
                                >
                                  <CalendarOff className="h-3 w-3" /> {count}
                                </button>
                              ) : null;
                            })()}
                          </div>

                          {/* Actions — visible on hover */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:text-[#1B1B1B]" onClick={() => openTherapistEdit(th)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {isAdmin && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-muted-foreground">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-36">
                                  <DropdownMenuItem className="text-destructive text-xs" onClick={() => openConfirm(t('Xoá thợ'), t('Xoá thợ này?'), () => deleteTherapist.mutate(th.id))}>
                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> {t('Xóa')}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mobile cards */}
                  <div className="sm:hidden space-y-2">
                    {therapists.map(th => (
                      <div key={th.id} className="bg-white rounded-xl border border-[#E5E5E5]/40 p-4 transition-colors hover:border-[#CCCCCC]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-[#F0F0F0] flex items-center justify-center text-[13px] font-semibold text-[#737373] shrink-0">
                              {(th.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <button
                                className="text-[14px] font-medium text-[#1B1B1B] truncate block text-left"
                                onClick={() => { setViewingTherapist(th); setTherapistInfoDialog(true); }}
                              >{th.name}</button>
                              <p className="text-[11px] text-muted-foreground/60 mt-0.5">{th.start_hour}:00 – {th.end_hour}:00</p>
                            </div>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
                            th.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {th.is_active ? t('Hoạt động') : t('Tắt')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-3 ml-[52px]">
                          <div className="flex items-center gap-2">
                            {(th as any).email && <span className="text-[11px] text-muted-foreground/60 truncate">{(th as any).email}</span>}
                            {th.phone && <span className="text-[11px] text-muted-foreground/50 font-mono">{th.phone}</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50" onClick={() => openTherapistEdit(th)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            {isAdmin && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/40">
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem className="text-destructive text-xs" onClick={() => openConfirm(t('Xoá thợ'), t('Xoá thợ này?'), () => deleteTherapist.mutate(th.id))}>
                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> {t('Xóa')}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* Therapist Info Dialog */}
          <Dialog open={therapistInfoDialog} onOpenChange={setTherapistInfoDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{viewingTherapist?.name}</DialogTitle>
                <DialogDescription>{t('Thông tin và ngày nghỉ')}</DialogDescription>
              </DialogHeader>
              {viewingTherapist && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">{t('Email')}</p>
                      <p>{(viewingTherapist as any).email || '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t('SĐT')}</p>
                      <p>{viewingTherapist.phone || '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t('Giờ làm việc')}</p>
                      <p>{viewingTherapist.start_hour}:00 – {viewingTherapist.end_hour}:00</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t('Trạng thái')}</p>
                      <Badge variant={viewingTherapist.is_active ? 'default' : 'secondary'}>
                        {viewingTherapist.is_active ? t('Hoạt động') : t('Tắt')}
                      </Badge>
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">{t('Ngày nghỉ')}</p>
                      <Input
                        type="month"
                        value={unavailMonthFilter}
                        onChange={e => setUnavailMonthFilter(e.target.value)}
                        className="w-[160px] h-8 text-xs"
                      />
                    </div>
                    {(() => {
                      const filtered = unavailabilities?.filter(
                        (u: any) => u.therapist_id === viewingTherapist.id && u.unavailable_date.startsWith(unavailMonthFilter)
                      ) || [];
                      if (!filtered.length) return <p className="text-sm text-muted-foreground italic">{t('Không có ngày nghỉ trong tháng này')}</p>;
                      return (
                        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                          {filtered.map((u: any) => (
                            <div key={u.id} className="flex items-center justify-between py-1.5 px-3 bg-muted/50 rounded text-sm">
                              <span>{u.unavailable_date}{u.reason ? ` — ${u.reason}` : ''}</span>
                              {isAdmin && (
                                <button className="text-destructive hover:text-destructive/80 ml-2 shrink-0" onClick={() => openConfirm(t('Xoá ngày nghỉ'), t('Xoá ngày nghỉ này?'), () => removeUnavailability.mutate(u.id))}>
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Settings Tab */}
          {isAdmin && (
          <TabsContent value="settings" className="space-y-2">
            {/* Settings menu rows */}
            {[
              { key: 'shop', icon: Store, label: t('Thông tin tiệm'), desc: t('Tên, địa chỉ, giờ mở cửa, ngày lễ') },
              { key: 'display', icon: Palette, label: t('Hiển thị & Giao diện'), desc: t('Logo, hero, thợ ngẫu nhiên, phụ phí thẻ') },
              { key: 'accounts', icon: Users, label: t('Quản lý tài khoản'), desc: `${adminAccounts?.length || 0} ${t('tài khoản')}` },
              { key: 'employee_permissions', icon: Eye, label: t('Quyền nhân viên'), desc: t('Bật/tắt các tab nhân viên có thể xem') },
              { key: 'payments', icon: CreditCard, label: t('Thanh toán'), desc: stripePaymentEnabled || squareTerminalEnabled ? t('Đã bật') : t('Chưa bật') },
              { key: 'twilio', icon: Phone, label: t('Cấu hình Twilio'), desc: twilioSettings?.twilio_account_sid ? t('Đã cấu hình') : t('Chưa cấu hình') },
              { key: 'notifications', icon: Bell, label: t('Thông báo & Nhắc lịch'), desc: t('SMS, WhatsApp, email nhắc lịch') },
              { key: 'email', icon: Mail, label: t('Cài đặt email'), desc: resendSettings?.['resend_api_key'] ? t('Đã cấu hình') : t('Chưa cấu hình') },
              { key: 'translation', icon: Languages, label: t('Cài đặt dịch thuật'), desc: openaiSettings?.['openai_api_key'] ? t('Đã cấu hình') : t('Chưa cấu hình') },
              { key: 'membership', icon: Crown, label: t('Hạng thành viên'), desc: `${membershipTiers?.length || 0} ${t('hạng')}` },
              { key: 'discounts', icon: Tag, label: t('Mã giảm giá'), desc: `${discountCodes?.length || 0} ${t('mã')}` },
              { key: 'about', icon: BookOpen, label: t('Về chúng tôi'), desc: t('Chỉnh sửa nội dung trang Về chúng tôi') },
              { key: 'ai_assistant', icon: Bot, label: t('AI & Knowledge Base'), desc: aiReplyConfig ? (aiReplyConfig.ai_enabled ? t('AI Reply ON') : t('AI Reply OFF — booking only')) : t('Not configured') },
              { key: 'terms', icon: ScrollText, label: t('Điều khoản'), desc: t('Chỉnh sửa nội dung trang Điều khoản') },
              ...(isAdmin ? [{ key: 'logs', icon: FileText, label: t('Nhật ký hoạt động'), desc: t('Tải xuống CSV') }] : []),
              { key: 'software', icon: Info, label: t('Thông tin phần mềm'), desc: 'v1.0.0 · Olive Marketing' },
              ...(isAdmin ? [{ key: 'danger', icon: AlertTriangle, label: t('Vùng nguy hiểm'), desc: t('Xoá tất cả dữ liệu') }] : []),
            ].map(item => (
              <button
                key={item.key}
                type="button"
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-lg border text-left transition-colors hover:bg-muted/50',
                  item.key === 'danger' ? 'border-destructive/30 hover:bg-destructive/5' : 'border-border/60'
                )}
                onClick={() => setSettingsModal(item.key)}
              >
                <item.icon className={cn('h-5 w-5 shrink-0', item.key === 'danger' ? 'text-destructive' : 'text-muted-foreground')} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', item.key === 'danger' && 'text-destructive')}>{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                </div>
                {item.key === 'ai_assistant' && aiReplyConfig?.id ? (
                  <Switch
                    checked={aiReplyConfig.ai_enabled}
                    onCheckedChange={(checked) => {
                      toggleAiReply.mutate(checked);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    disabled={toggleAiReply.isPending}
                    aria-label="Toggle AI Reply"
                  />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                )}
              </button>
            ))}

            {/* ── Shop Info Modal ── */}
            <Dialog open={settingsModal === 'shop'} onOpenChange={(open) => !open && setSettingsModal(null)}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t('Thông tin tiệm')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>{t('Tên tiệm')}</Label>
                    <Input value={spaName} onChange={e => setSpaName(e.target.value)} className="mt-1" placeholder="Oasis Reserve" />
                  </div>
                  <div>
                    <Label>{t('Số điện thoại tiệm')}</Label>
                    <Input value={shopPhone} onChange={e => setShopPhone(e.target.value)} className="mt-1" placeholder="+84 123 456 789" />
                  </div>
                  <div>
                    <Label>{t('Địa chỉ')}</Label>
                    <Input value={shopAddress} onChange={e => setShopAddress(e.target.value)} className="mt-1" placeholder={t('Nhập địa chỉ tiệm')} />
                  </div>
                  <div>
                    <Label>{t('Ngày mở cửa')}</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {[
                        { day: 1, label: t('T2') },
                        { day: 2, label: t('T3') },
                        { day: 3, label: t('T4') },
                        { day: 4, label: t('T5') },
                        { day: 5, label: t('T6') },
                        { day: 6, label: t('T7') },
                        { day: 7, label: t('CN') },
                      ].map(({ day, label }) => (
                        <button
                          key={day}
                          type="button"
                          className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                            openDays.includes(day)
                              ? 'bg-[#006AFF] text-white border-[#006AFF]'
                              : 'bg-white text-muted-foreground border-border hover:border-[#737373]'
                          }`}
                          onClick={() => setOpenDays(prev =>
                            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t('Giờ mở cửa')}</Label>
                      <Input type="time" value={openTime} onChange={e => setOpenTime(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label>{t('Giờ đóng cửa')}</Label>
                      <Input type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label>{t('Bang/Tiểu bang')}</Label>
                    <select
                      value={shopState}
                      onChange={e => { setShopState(e.target.value); setShopTimezone(STATE_TIMEZONE_MAP[e.target.value] || 'Australia/Melbourne'); }}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('Dùng để hiển thị ngày lễ công cộng')} · {t('Múi giờ')}: {shopTimezone}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t('Hiển thị "Đóng cửa" ngày lễ')}</p>
                      <p className="text-xs text-muted-foreground">{t('Tự động hiển thị trạng thái đóng cửa vào ngày lễ công cộng')}</p>
                    </div>
                    <Switch checked={showHolidayClosed} onCheckedChange={setShowHolidayClosed} />
                  </div>
                  <Button size="sm" onClick={() => { saveShopInfo.mutate(); setSettingsModal(null); }} disabled={saveShopInfo.isPending}>
                    {saveShopInfo.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang lưu...')}</> : t('Lưu thông tin')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* ── Display & Appearance Modal ── */}
            <Dialog open={settingsModal === 'display'} onOpenChange={(open) => !open && setSettingsModal(null)}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t('Hiển thị & Giao diện')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 pt-2">
                  {/* Random therapist */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{t('Tự động chọn thợ ngẫu nhiên')}</p>
                      <p className="text-xs text-muted-foreground">{t('Cho phép khách chọn "bất kỳ thợ trống" khi đặt lịch')}</p>
                    </div>
                    <Switch checked={randomEnabled !== false} onCheckedChange={(v) => toggleRandom.mutate(v)} disabled={toggleRandom.isPending} />
                  </div>
                  <div className="border-t border-border/40" />

                  {/* Logo */}
                  <div className="space-y-3">
                    <p className="font-medium text-sm">{t('Logo cửa hàng')}</p>
                    <LogoUploadComponent t={t} />
                  </div>
                  <div className="border-t border-border/40" />

                  {/* Hero media */}
                  <div className="space-y-4">
                    <p className="font-medium text-sm">{t('Hero trang chủ')}</p>
                    <div>
                      <Label>{t('Chế độ hiển thị')}</Label>
                      <div className="flex gap-2 mt-1.5">
                        <Button type="button" variant={heroMode === 'video' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => setHeroMode('video')}>
                          Video
                        </Button>
                        <Button type="button" variant={heroMode === 'image' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => setHeroMode('image')}>
                          {t('Hình ảnh')}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>{heroMode === 'video' ? t('Upload video') : t('Upload hình ảnh')}</Label>
                      <div className="mt-1.5 space-y-2">
                        {heroMediaPreview && (
                          <div className="relative w-full h-32 rounded-lg overflow-hidden border border-[#E5E5E5]">
                            {heroMode === 'video' && (heroMediaPreview.match(/\.(mp4|webm|mov)/) || heroMediaFile?.type.startsWith('video')) ? (
                              <video src={heroMediaPreview} className="w-full h-full object-cover" muted />
                            ) : (
                              <img src={heroMediaPreview} alt="Hero preview" className="w-full h-full object-cover" />
                            )}
                            <button
                              type="button"
                              onClick={() => { setHeroMediaFile(null); setHeroMediaPreview(null); setHeroMediaPath(''); }}
                              className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center text-xs hover:bg-black/70"
                            >×</button>
                          </div>
                        )}
                        <input
                          ref={heroMediaRef}
                          type="file"
                          accept={heroMode === 'video' ? 'video/*' : 'image/*'}
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setHeroMediaFile(file);
                              setHeroMediaPreview(URL.createObjectURL(file));
                            }
                          }}
                        />
                        <Button type="button" variant="outline" size="sm" onClick={() => heroMediaRef.current?.click()}>
                          {heroMediaPreview ? t('Đổi file') : t('Chọn file')}
                        </Button>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={savingHero}
                      onClick={async () => {
                        setSavingHero(true);
                        try {
                          let path = heroMediaPath;
                          if (heroMediaFile) {
                            const ext = heroMediaFile.name.split('.').pop();
                            const newPath = `hero-${Date.now()}.${ext}`;
                            if (path) await supabase.storage.from('hero-media').remove([path]);
                            const { error: uploadErr } = await supabase.storage.from('hero-media').upload(newPath, heroMediaFile, { upsert: true });
                            if (uploadErr) throw uploadErr;
                            path = newPath;
                            setHeroMediaPath(path);
                          }
                          await supabase.from('app_settings').upsert({ key: 'hero_mode', value: heroMode });
                          await supabase.from('app_settings').upsert({ key: 'hero_media_path', value: path });
                          toast({ title: t('Đã lưu hero') });
                          setHeroMediaFile(null);
                        } catch (err: any) {
                          toast({ title: t('Lỗi'), description: err.message, variant: 'destructive' });
                        } finally {
                          setSavingHero(false);
                        }
                      }}
                    >
                      {savingHero ? t('Đang lưu...') : t('Lưu hero')}
                    </Button>
                    <p className="text-xs text-muted-foreground">{t('Nếu không upload, hệ thống sẽ dùng ảnh/video mặc định')}</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* ── Accounts Modal ── */}
            <Dialog open={settingsModal === 'accounts'} onOpenChange={(open) => !open && setSettingsModal(null)}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <DialogTitle>{t('Quản lý tài khoản')}</DialogTitle>
                    {isAdmin && (
                      <Button size="sm" variant="outline" onClick={() => setAccountDialog(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> {t('Tạo tài khoản')}
                      </Button>
                    )}
                  </div>
                </DialogHeader>
                <div className="space-y-2 pt-2">
                  {adminAccounts && adminAccounts.length > 0 && adminAccounts.map(admin => (
                    <div key={admin.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{admin.email}</p>
                          <Badge variant={admin.role === 'admin' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                            {admin.role === 'admin' ? 'Admin' : 'Employee'}
                          </Badge>
                          {admin.is_current && <span className="text-[10px] text-muted-foreground">({t('Bạn')})</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t('Tạo')} {new Date(admin.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => { setEditingAccount(admin); setEditAccountPassword(''); setEditAccountDialog(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {!admin.is_current && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              disabled={deletingAdminId === admin.id}
                              onClick={() => openConfirm(t('Xoá tài khoản'), `${t('Xoá tài khoản')} ${admin.email}?`, async () => {
                                setDeletingAdminId(admin.id);
                                try {
                                  const { data: { session: s } } = await supabase.auth.getSession();
                                  if (!s?.access_token) throw new Error('Session expired. Please log out and log back in.');
                                  const res = await fetch(
                                    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-admins`,
                                    {
                                      method: 'DELETE',
                                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s.access_token}` },
                                      body: JSON.stringify({ user_id: admin.id }),
                                    }
                                  );
                                  const result = await res.json();
                                  if (!res.ok) throw new Error(result.error || 'Failed');
                                  logActivity('delete_account', `Deleted: ${admin.email} (${admin.role})`);
                                  toast({ title: t('Đã xoá tài khoản'), description: admin.email });
                                  refetchAdmins();
                                } catch (err: any) {
                                  const msg = err.message === 'Failed to fetch'
                                    ? t('Không thể kết nối đến server. Vui lòng kiểm tra kết nối hoặc deploy lại edge function.')
                                    : err.message;
                                  toast({ title: t('Lỗi'), description: msg, variant: 'destructive' });
                                } finally {
                                  setDeletingAdminId(null);
                                }
                              })}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            {/* Create Account Dialog (standalone, not nested) */}
            <Dialog open={accountDialog} onOpenChange={(open) => { setAccountDialog(open); if (!open) { setNewAdminEmail(''); setNewAdminPassword(''); setNewAdminRole('employee'); } }}>
              <DialogContent className="max-w-[100vw] sm:max-w-[480px] p-0 gap-0 rounded-none sm:rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border/60">
                  <DialogHeader>
                    <DialogTitle className="text-[#1B1B1B] text-lg">{t('Tạo tài khoản mới')}</DialogTitle>
                    <DialogDescription className="text-sm">{t('Tạo tài khoản cho nhân viên hoặc quản trị viên')}</DialogDescription>
                  </DialogHeader>
                </div>
                <div className="px-5 py-5 space-y-5">
                  <div>
                    <Label className="text-sm font-medium">{t('Loại tài khoản')}</Label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <button type="button" className={cn('flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all active:scale-[0.98]', newAdminRole === 'employee' ? 'border-[#006AFF] bg-[#006AFF]/5' : 'border-border hover:bg-muted/30')} onClick={() => setNewAdminRole('employee')}>
                        <UserCheck className={cn('h-6 w-6', newAdminRole === 'employee' ? 'text-[#006AFF]' : 'text-muted-foreground')} />
                        <span className={cn('text-sm font-medium', newAdminRole === 'employee' ? 'text-[#006AFF]' : 'text-foreground')}>Employee</span>
                      </button>
                      <button type="button" className={cn('flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all active:scale-[0.98]', newAdminRole === 'admin' ? 'border-[#006AFF] bg-[#006AFF]/5' : 'border-border hover:bg-muted/30')} onClick={() => setNewAdminRole('admin')}>
                        <Crown className={cn('h-6 w-6', newAdminRole === 'admin' ? 'text-[#006AFF]' : 'text-muted-foreground')} />
                        <span className={cn('text-sm font-medium', newAdminRole === 'admin' ? 'text-[#006AFF]' : 'text-foreground')}>Admin</span>
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {newAdminRole === 'employee'
                        ? t('Employee: có thể xem và tạo, không thể xoá hoặc xem nhật ký')
                        : t('Admin: toàn quyền quản lý hệ thống')}
                    </p>
                  </div>
                  <div className="border-t border-border/40 pt-4 space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Email</Label>
                      <Input type="email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="staff@example.com" className="mt-1.5 h-11 text-base" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">{t('Mật khẩu')}</Label>
                      <Input type="password" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} placeholder={t('Tối thiểu 6 ký tự')} className="mt-1.5 h-11 text-base" />
                    </div>
                  </div>
                </div>
                <div className="px-5 py-4 border-t border-border/60">
                  <Button
                    className="w-full h-12 text-base font-medium bg-[#006AFF] hover:bg-[#1B1B1B] text-white"
                    disabled={creatingAdmin || !newAdminEmail.trim() || newAdminPassword.length < 6}
                    onClick={async () => {
                      setCreatingAdmin(true);
                      try {
                        const { data: { session: s } } = await supabase.auth.getSession();
                        if (!s?.access_token) throw new Error('Session expired. Please log out and log back in.');
                        const res = await fetch(
                          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-admin`,
                          {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s.access_token}` },
                            body: JSON.stringify({ email: newAdminEmail.trim(), password: newAdminPassword, role: newAdminRole }),
                          }
                        );
                        const result = await res.json();
                        if (!res.ok) throw new Error(result.error || 'Failed');
                        logActivity('create_account', `Created ${newAdminRole}: ${newAdminEmail}`);
                        toast({ title: t('Đã tạo tài khoản'), description: `${newAdminRole === 'admin' ? 'Admin' : 'Employee'}: ${newAdminEmail}` });
                        setNewAdminEmail('');
                        setNewAdminPassword('');
                        setAccountDialog(false);
                        refetchAdmins();
                      } catch (err: any) {
                        toast({ title: t('Lỗi'), description: err.message, variant: 'destructive' });
                      } finally {
                        setCreatingAdmin(false);
                      }
                    }}
                  >
                    {creatingAdmin ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />{t('Đang tạo...')}</> : <><Plus className="h-5 w-5 mr-2" />{t('Tạo tài khoản')}</>}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Account Dialog */}
            <Dialog open={editAccountDialog} onOpenChange={(open) => { setEditAccountDialog(open); if (!open) { setEditingAccount(null); setEditAccountPassword(''); } }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('Chỉnh sửa tài khoản')}</DialogTitle>
                </DialogHeader>
                {editingAccount && (
                  <div className="space-y-4 pt-2">
                    <div>
                      <Label className="text-sm">Email</Label>
                      <p className="text-sm mt-1 text-muted-foreground">{editingAccount.email}</p>
                    </div>
                    <div>
                      <Label className="text-sm">{t('Vai trò')}</Label>
                      <p className="text-sm mt-1">
                        <Badge variant={editingAccount.role === 'admin' ? 'default' : 'secondary'}>
                          {editingAccount.role === 'admin' ? 'Admin' : 'Employee'}
                        </Badge>
                      </p>
                    </div>
                    <div className="border-t pt-4">
                      <Label className="text-sm">{t('Đổi mật khẩu')}</Label>
                      <Input
                        type="password"
                        value={editAccountPassword}
                        onChange={e => setEditAccountPassword(e.target.value)}
                        placeholder={t('Mật khẩu mới (tối thiểu 6 ký tự)')}
                        className="mt-1"
                      />
                    </div>
                    <Button
                      className="w-full"
                      disabled={savingPassword || editAccountPassword.length < 6}
                      onClick={async () => {
                        setSavingPassword(true);
                        try {
                          const { data: { session: s } } = await supabase.auth.getSession();
                          if (!s?.access_token) throw new Error('Session expired.');
                          const res = await fetch(
                            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-admins`,
                            {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s.access_token}` },
                              body: JSON.stringify({ user_id: editingAccount.id, password: editAccountPassword }),
                            }
                          );
                          const result = await res.json();
                          if (!res.ok) throw new Error(result.error || 'Failed');
                          logActivity('update_password', `Changed password for: ${editingAccount.email}`);
                          toast({ title: t('Đã đổi mật khẩu'), description: editingAccount.email });
                          setEditAccountDialog(false);
                        } catch (err: any) {
                          toast({ title: t('Lỗi'), description: err.message, variant: 'destructive' });
                        } finally {
                          setSavingPassword(false);
                        }
                      }}
                    >
                      {savingPassword ? t('Đang lưu...') : t('Lưu mật khẩu')}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* ── Employee Permissions Modal ── */}
            <Dialog open={settingsModal === 'employee_permissions'} onOpenChange={(open) => !open && setSettingsModal(null)}>
              <DialogContent className="max-w-[100vw] sm:max-w-[480px] p-0 gap-0 rounded-none sm:rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border/60">
                  <DialogHeader>
                    <DialogTitle className="text-lg">{t('Quyền nhân viên')}</DialogTitle>
                    <DialogDescription className="text-sm">{t('Chọn các tab mà nhân viên có thể xem khi đăng nhập')}</DialogDescription>
                  </DialogHeader>
                </div>
                <div className="px-5 py-4 space-y-2">
                  {([
                    { value: 'stats' as EmployeeTab, icon: BarChart3, label: t('Thống kê') },
                    { value: 'bookings' as EmployeeTab, icon: CalendarDays, label: t('Lịch hẹn') },
                    { value: 'customers' as EmployeeTab, icon: UserCheck, label: t('Khách hàng') },
                    { value: 'sales' as EmployeeTab, icon: DollarSign, label: t('Thanh toán') },
                    { value: 'services' as EmployeeTab, icon: Scissors, label: t('Dịch vụ') },
                    { value: 'therapists' as EmployeeTab, icon: Users, label: t('Thợ') },
                  ]).map(tab => {
                    const checked = employeeVisibleTabs.includes(tab.value);
                    return (
                      <button
                        key={tab.value}
                        type="button"
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-4 rounded-xl border-2 transition-all text-left active:scale-[0.98]',
                          checked ? 'border-[#006AFF] bg-[#006AFF]/5' : 'border-border hover:bg-muted/30'
                        )}
                        onClick={() => {
                          setEmployeeVisibleTabs(prev =>
                            checked ? prev.filter(v => v !== tab.value) : [...prev, tab.value]
                          );
                        }}
                      >
                        <div className={cn('flex items-center justify-center h-10 w-10 rounded-lg shrink-0', checked ? 'bg-[#006AFF]/10' : 'bg-muted')}>
                          {checked ? <Check className="h-5 w-5 text-[#006AFF]" /> : <tab.icon className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <span className={cn('text-sm flex-1 font-medium', checked ? 'text-[#1B1B1B]' : 'text-muted-foreground')}>{tab.label}</span>
                        <Switch checked={checked} onCheckedChange={() => {
                          setEmployeeVisibleTabs(prev =>
                            checked ? prev.filter(v => v !== tab.value) : [...prev, tab.value]
                          );
                        }} />
                      </button>
                    );
                  })}
                </div>
                <div className="px-5 py-4 border-t border-border/60">
                  <Button
                    className="w-full h-12 text-base font-medium"
                    onClick={() => saveEmployeeTabs.mutate(employeeVisibleTabs)}
                    disabled={saveEmployeeTabs.isPending}
                  >
                    {saveEmployeeTabs.isPending ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />{t('Đang lưu...')}</> : t('Lưu quyền')}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">{t('Admin luôn có quyền truy cập tất cả')}</p>
                </div>
              </DialogContent>
            </Dialog>

            {/* ── Email Settings Modal ── */}
            <Dialog open={settingsModal === 'email'} onOpenChange={(open) => !open && setSettingsModal(null)}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t('Cài đặt email')} (Resend)</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
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
                  <Button size="sm" onClick={() => { saveResendSettings.mutate(); setSettingsModal(null); }} disabled={!resendApiKey.trim() || saveResendSettings.isPending}>
                    {saveResendSettings.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang lưu...')}</> : t('Lưu cài đặt email')}
                  </Button>
                  {resendSettings?.['resend_api_key'] && (
                    <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                      <p className="text-muted-foreground">{t('Resend API key đã được cấu hình')}</p>
                      <p className="text-muted-foreground">{t('Email gửi từ')}: <strong>{resendSettings['resend_from_email'] || 'onboarding@resend.dev'}</strong></p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* ── Translation Settings Modal ── */}
            <Dialog open={settingsModal === 'translation'} onOpenChange={(open) => !open && setSettingsModal(null)}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t('Cài đặt dịch thuật')} (OpenAI)</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
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
                  <Button size="sm" onClick={() => { saveOpenaiSettings.mutate(); setSettingsModal(null); }} disabled={!openaiApiKey.trim() || saveOpenaiSettings.isPending}>
                    {saveOpenaiSettings.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang lưu...')}</> : t('Lưu cài đặt dịch thuật')}
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

                  {/* Populate Translations */}
                  {openaiSettings?.['openai_api_key'] && (
                    <div className="border-t border-border/50 pt-4 space-y-3">
                      <div>
                        <Label className="text-sm font-medium">{t('Dịch tất cả')}</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t('Dịch')} {ALL_I18N_KEYS.length} {t('mã')} {t('sang ngôn ngữ đã chọn')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!!populatingLang}
                          onClick={() => populateTranslations('vi')}
                        >
                          {populatingLang === 'vi' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                          Tiếng Việt
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!!populatingLang}
                          onClick={() => populateTranslations('en')}
                        >
                          {populatingLang === 'en' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                          English
                        </Button>
                      </div>
                      {populatingLang && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {t('Đang dịch...')} {populateProgress.done}/{populateProgress.total} {t('batch')}
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all"
                              style={{ width: `${populateProgress.total ? (populateProgress.done / populateProgress.total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* ── Membership Tiers Modal ── */}
            <Dialog open={settingsModal === 'membership'} onOpenChange={(open) => !open && setSettingsModal(null)}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <DialogTitle>{t('Hạng thành viên')}</DialogTitle>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{t('Bật/Tắt')}</span>
                        <Switch checked={membershipEnabled === true} onCheckedChange={(v) => toggleMembership.mutate(v)} disabled={toggleMembership.isPending} />
                      </div>
                      <Button size="sm" variant="outline" onClick={() => { setEditingTier(null); setTierName(''); setTierMinVisits('0'); setTierDiscountPercent('0'); setMembershipDialog(true); }}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> {t('Thêm')}
                      </Button>
                    </div>
                  </div>
                </DialogHeader>
                <div className="pt-2">
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
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => openConfirm(t('Xoá hạng'), t('Xoá hạng này?'), () => deleteTier.mutate(tier.id))}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Add/Edit Membership Tier Dialog */}
            <Dialog open={membershipDialog} onOpenChange={setMembershipDialog}>
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
                  <Button onClick={() => saveTier.mutate()} disabled={!tierName.trim() || saveTier.isPending}>
                    {saveTier.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang lưu...')}</> : (editingTier ? t('Cập nhật') : t('Tạo'))}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* ── Discount Codes Modal ── */}
            <Dialog open={settingsModal === 'discounts'} onOpenChange={(open) => !open && setSettingsModal(null)}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <DialogTitle>{t('Mã giảm giá')}</DialogTitle>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{t('Bật/Tắt')}</span>
                        <Switch checked={discountCodesEnabled === true} onCheckedChange={(v) => toggleDiscountCodes.mutate(v)} disabled={toggleDiscountCodes.isPending} />
                      </div>
                      <Button size="sm" variant="outline" onClick={() => {
                        if (!discountCodes?.length) return;
                        const header = 'Code,Type,Discount %,Discount Amount,Valid From,Valid To,Max Uses,Used,Active\n';
                        const rows = discountCodes.map(dc => `${dc.code},${Number(dc.discount_amount) > 0 && Number(dc.discount_percent) === 0 ? 'Gift Card' : 'Discount'},${dc.discount_percent},${dc.discount_amount},${dc.valid_from || ''},${dc.valid_to || ''},${dc.max_uses || ''},${dc.current_uses || 0},${dc.is_active}`).join('\n');
                        const blob = new Blob([header + rows], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = `gift-cards-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
                        URL.revokeObjectURL(url);
                      }} disabled={!discountCodes?.length}>
                        <Download className="h-3.5 w-3.5 mr-1" /> CSV
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setGiftCardDialog(true)}>
                        <Crown className="h-3.5 w-3.5 mr-1" /> {t('Phiếu quà tặng')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditingDiscount(null); setDiscountCode(''); setDiscountPercent('0'); setDiscountAmount('0'); setDiscountValidFrom(''); setDiscountValidTo(''); setDiscountMaxUses(''); setDiscountDialog(true);
                      }}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> {t('Thêm')}
                      </Button>
                    </div>
                  </div>
                </DialogHeader>
                <div className="pt-2">
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
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => openConfirm(t('Xoá mã giảm giá'), t('Xoá mã này?'), () => deleteDiscount.mutate(dc.id))}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Add/Edit Discount Code Dialog */}
            <Dialog open={discountDialog} onOpenChange={setDiscountDialog}>
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
                  <Button onClick={() => saveDiscount.mutate()} disabled={!discountCode.trim() || saveDiscount.isPending}>
                    {saveDiscount.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang lưu...')}</> : (editingDiscount ? t('Cập nhật') : t('Tạo'))}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* ── Gift Card Batch Dialog ── */}
            <Dialog open={giftCardDialog} onOpenChange={setGiftCardDialog}>
              <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                  <DialogTitle className="text-[#1B1B1B]">{t('Tạo phiếu quà tặng hàng loạt')}</DialogTitle>
                  <DialogDescription className="text-muted-foreground/60">{t('Tạo nhiều mã quà tặng cùng lúc')}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Số lượng')}</Label>
                      <Input type="number" min="1" max="100" value={giftCardCount} onChange={e => setGiftCardCount(e.target.value)} className="mt-1 bg-[#F5F5F5] border-[#E5E5E5]/60" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Giá trị (A$)')}</Label>
                      <Input type="number" min="1" value={giftCardAmount} onChange={e => setGiftCardAmount(e.target.value)} className="mt-1 bg-[#F5F5F5] border-[#E5E5E5]/60" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Tiền tố mã')}</Label>
                      <Input value={giftCardPrefix} onChange={e => setGiftCardPrefix(e.target.value.toUpperCase())} className="mt-1 font-mono bg-[#F5F5F5] border-[#E5E5E5]/60" placeholder="GIFT" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Số lần dùng / mã')}</Label>
                      <Input type="number" min="1" value={giftCardMaxUses} onChange={e => setGiftCardMaxUses(e.target.value)} className="mt-1 bg-[#F5F5F5] border-[#E5E5E5]/60" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Hết hạn')} ({t('tuỳ chọn')})</Label>
                    <Input type="date" value={giftCardValidTo} onChange={e => setGiftCardValidTo(e.target.value)} className="mt-1 bg-[#F5F5F5] border-[#E5E5E5]/60" />
                  </div>
                  <div className="p-3 bg-[#F5F5F5] rounded-lg border border-[#E5E5E5]/40 text-sm text-muted-foreground">
                    {t('Sẽ tạo')} <strong className="text-[#1B1B1B]">{giftCardCount}</strong> {t('mã có dạng')} <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border">{giftCardPrefix || 'GIFT'}-XXXXXX</code> {t('trị giá')} <strong className="text-[#1B1B1B]">A$ {giftCardAmount}</strong>
                  </div>
                  <Button className="w-full bg-[#006AFF] hover:bg-[#1B1B1B]" onClick={() => createGiftCardBatch.mutate()} disabled={createGiftCardBatch.isPending || parseInt(giftCardCount) < 1 || parseFloat(giftCardAmount) <= 0}>
                    {createGiftCardBatch.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang tạo...')}</> : <><Crown className="h-4 w-4 mr-2" />{t('Tạo phiếu quà tặng')}</>}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* ── Activity Logs Modal ── */}
            <Dialog open={settingsModal === 'logs'} onOpenChange={(open) => !open && setSettingsModal(null)}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{t('Nhật ký hoạt động')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-muted-foreground">{t('Tất cả hoạt động được ghi lại tự động. Tải xuống để xem chi tiết.')}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!activityLogs?.length}
                    onClick={() => {
                      if (!activityLogs?.length) return;
                      const csv = ['Thời gian,Email,Hành động,Chi tiết']
                        .concat(activityLogs.map(l =>
                          `"${new Date(l.created_at).toLocaleString()}","${l.user_email || ''}","${l.action}","${(l.details || '').replace(/"/g, '""')}"`
                        ))
                        .join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `activity-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" /> {t('Tải CSV')}
                  </Button>
                  {!activityLogs?.length && <p className="text-xs text-muted-foreground">{t('Chưa có nhật ký nào')}</p>}
                </div>
              </DialogContent>
            </Dialog>

            {/* ── About Us Content Editor ── */}
            <Dialog open={settingsModal === 'about'} onOpenChange={(open) => !open && setSettingsModal(null)}>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t('Về chúng tôi')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-muted-foreground">{t('Sử dụng trình soạn thảo bên dưới để chỉnh sửa nội dung trang Về chúng tôi.')}</p>
                  <TipTapEditor content={aboutContent} onChange={setAboutContent} />
                  <Button size="sm" onClick={() => { saveAboutContent.mutate(); setSettingsModal(null); }} disabled={saveAboutContent.isPending}>
                    {saveAboutContent.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang lưu...')}</> : t('Lưu nội dung')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* ── AI & Knowledge Base ── */}
            <Dialog open={settingsModal === 'ai_assistant'} onOpenChange={(open) => !open && setSettingsModal(null)}>
              <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>AI & Knowledge Base</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 pt-2">
                  <AISettingsPanel />
                  <div className="border-t border-[#E5E5E5] pt-4">
                    <KnowledgeBaseManager />
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* ── Terms Content Editor ── */}
            <Dialog open={settingsModal === 'terms'} onOpenChange={(open) => !open && setSettingsModal(null)}>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t('Điều khoản')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-muted-foreground">{t('Nhập HTML để hiển thị trên trang Điều khoản. Hỗ trợ thẻ h2, p, ul, li, strong, em.')}</p>
                  <textarea
                    className="w-full min-h-[300px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={termsContent}
                    onChange={(e) => setTermsContent(e.target.value)}
                    placeholder="<h2>1. Introduction</h2>\n<p>Terms content here...</p>"
                  />
                  <div className="border rounded-md p-4 max-h-[200px] overflow-y-auto">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{t('Xem trước')}</p>
                    <div
                      className="prose prose-sm max-w-none text-muted-foreground [&_h2]:text-base [&_h2]:font-medium [&_h2]:text-foreground [&_h2]:mb-2 [&_h2]:mt-4 [&_p]:leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(termsContent, { ALLOWED_TAGS: ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'br'], ALLOWED_ATTR: ['href', 'target', 'rel'] }) }}
                    />
                  </div>
                  <Button size="sm" onClick={() => { saveTermsContent.mutate(); setSettingsModal(null); }} disabled={saveTermsContent.isPending}>
                    {saveTermsContent.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang lưu...')}</> : t('Lưu nội dung')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* ── Software Info Modal ── */}
            <Dialog open={settingsModal === 'software'} onOpenChange={(open) => !open && setSettingsModal(null)}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>{t('Thông tin phần mềm')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t('Phiên bản')}</span>
                    <span className="text-sm font-mono">1.0.0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t('Nhà phát triển')}</span>
                    <span className="text-sm font-medium">Olive Marketing</span>
                  </div>
                  <div className="text-center pt-3 border-t border-border/40">
                    <p className="text-xs text-muted-foreground">
                      Crafted with <span className="text-red-400">&#9829;</span> in Melbourne
                    </p>
                  </div>
                  <div className="pt-2">
                    <Link to="/software-terms" className="text-xs text-primary hover:underline">{t('Xem điều khoản phần mềm')}</Link>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* ── Twilio Configuration Modal ── */}
            <Dialog open={settingsModal === 'twilio'} onOpenChange={(open) => !open && setSettingsModal(null)}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t('Cấu hình Twilio')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="rounded-lg bg-muted/50 border border-border/40 p-3">
                    <p className="text-xs text-muted-foreground">{t('Nhập thông tin tài khoản Twilio để gửi SMS và WhatsApp. Bạn có thể tìm thông tin này tại')} <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="text-[#006AFF] underline">console.twilio.com</a></p>
                  </div>
                  <div>
                    <Label>Account SID</Label>
                    <Input
                      value={twilioAccountSid}
                      onChange={e => setTwilioAccountSid(e.target.value)}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="mt-1 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label>Auth Token</Label>
                    <Input
                      type="password"
                      value={twilioAuthToken}
                      onChange={e => setTwilioAuthToken(e.target.value)}
                      placeholder="••••••••••••••••••••••••••••••••"
                      className="mt-1 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label>{t('Số điện thoại Twilio')}</Label>
                    <Input
                      value={twilioPhoneNumber}
                      onChange={e => setTwilioPhoneNumber(e.target.value)}
                      placeholder="+1 234 567 8900"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{t('Số điện thoại Twilio dùng để gửi SMS/WhatsApp')}</p>
                  </div>
                  {twilioSettings?.twilio_account_sid && (
                    <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                      <p className="text-xs text-green-700 font-medium">{t('Đã cấu hình')}</p>
                      <p className="text-xs text-green-600 mt-0.5">SID: {twilioSettings.twilio_account_sid.slice(0, 8)}...{twilioSettings.twilio_account_sid.slice(-4)}</p>
                      {twilioSettings.twilio_phone_number && <p className="text-xs text-green-600">{t('Số')}: {twilioSettings.twilio_phone_number}</p>}
                    </div>
                  )}
                  <Button size="sm" onClick={() => { saveTwilioCredentials.mutate(); setSettingsModal(null); }} disabled={saveTwilioCredentials.isPending}>
                    {saveTwilioCredentials.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang lưu...')}</> : t('Lưu cấu hình Twilio')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* ── Payments Configuration Modal ── */}
            <Dialog open={settingsModal === 'payments'} onOpenChange={(open) => { if (!open) { setSettingsModal(null); setPaymentSection(null); } }}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t('Thanh toán')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 pt-2">

                  {/* ── Stripe: Online Payment ── */}
                  <div className="rounded-lg border border-border/60 overflow-hidden">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Stripe — {t('Thanh toán trực tuyến')}</p>
                          <p className="text-xs text-muted-foreground">{t('Khách hàng sẽ thanh toán qua Stripe khi đặt lịch')}</p>
                        </div>
                      </div>
                      <Switch checked={stripePaymentEnabled} onCheckedChange={setStripePaymentEnabled} />
                    </div>
                    {stripePaymentEnabled && (
                      <div className="border-t border-border/40">
                        <button
                          type="button"
                          className="w-full flex items-center justify-between p-3 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                          onClick={() => setPaymentSection(paymentSection === 'stripe' ? null : 'stripe')}
                        >
                          <span>{stripeSettings?.stripe_publishable_key ? `${t('Đã cấu hình')} · ${stripeSettings.stripe_publishable_key.slice(0, 12)}...` : t('Chưa cấu hình — nhấn để thiết lập')}</span>
                          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', paymentSection === 'stripe' && 'rotate-90')} />
                        </button>
                        {paymentSection === 'stripe' && (
                          <div className="space-y-3 p-4 pt-0">
                            <div className="rounded-lg bg-muted/50 border border-border/40 p-3">
                              <p className="text-xs text-muted-foreground">{t('Nhập thông tin tài khoản Stripe để nhận thanh toán trực tuyến. Bạn có thể tìm thông tin này tại')} <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-[#006AFF] underline">dashboard.stripe.com</a></p>
                            </div>
                            <div>
                              <Label>Publishable Key</Label>
                              <Input value={stripePublishableKey} onChange={e => setStripePublishableKey(e.target.value)} placeholder="pk_live_xxxxxxxxxxxxxxxxxxxxxxxx" className="mt-1 font-mono text-xs" />
                              <p className="text-xs text-muted-foreground mt-1">{t('Khóa công khai, dùng ở phía khách hàng')}</p>
                            </div>
                            <div>
                              <Label>Secret Key</Label>
                              <Input type="password" value={stripeSecretKey} onChange={e => setStripeSecretKey(e.target.value)} placeholder="sk_live_xxxxxxxxxxxxxxxxxxxxxxxx" className="mt-1 font-mono text-xs" />
                              <p className="text-xs text-muted-foreground mt-1">{t('Khóa bí mật, chỉ dùng ở server')}</p>
                            </div>
                            <div>
                              <Label>Webhook Secret ({t('tùy chọn')})</Label>
                              <Input type="password" value={stripeWebhookSecret} onChange={e => setStripeWebhookSecret(e.target.value)} placeholder="whsec_xxxxxxxxxxxxxxxxxxxxxxxx" className="mt-1 font-mono text-xs" />
                              <p className="text-xs text-muted-foreground mt-1">{t('Dùng để xác minh webhook từ Stripe')}</p>
                            </div>
                            <Button size="sm" onClick={() => { saveStripeCredentials.mutate(); }} disabled={saveStripeCredentials.isPending}>
                              {saveStripeCredentials.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang lưu...')}</> : t('Lưu cấu hình Stripe')}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Square Payments ── */}
                  <div className="rounded-lg border border-border/60 overflow-hidden">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <Square className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Square Payments</p>
                          <p className="text-xs text-muted-foreground">{t('Terminal POS & thanh toán qua thẻ/điện thoại')}</p>
                        </div>
                      </div>
                      <Switch checked={squareTerminalEnabled || squareOnlineEnabled} onCheckedChange={(v) => { if (!v) { setSquareTerminalEnabled(false); setSquareOnlineEnabled(false); } else { setSquareTerminalEnabled(true); } }} />
                    </div>
                    {(squareTerminalEnabled || squareOnlineEnabled) && (
                      <div className="border-t border-border/40">
                        <button
                          type="button"
                          className="w-full flex items-center justify-between p-3 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                          onClick={() => setPaymentSection(paymentSection === 'square' ? null : 'square')}
                        >
                          <span>{squareSettings?.square_access_token ? `${t('Đã cấu hình')} · ${squareSettings.square_location_id || 'N/A'}` : t('Chưa cấu hình — nhấn để thiết lập')}</span>
                          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', paymentSection === 'square' && 'rotate-90')} />
                        </button>
                        {paymentSection === 'square' && (
                          <div className="space-y-3 p-4 pt-0">
                            <div className="rounded-lg bg-muted/50 border border-border/40 p-3">
                              <p className="text-xs text-muted-foreground">{t('Nhập thông tin tài khoản Square. Bạn có thể tìm thông tin này tại')} <a href="https://developer.squareup.com/apps" target="_blank" rel="noopener noreferrer" className="text-[#006AFF] underline">developer.squareup.com</a></p>
                            </div>
                            {/* Payment mode toggles */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">{t('Máy POS Terminal')}</Label>
                                <Switch checked={squareTerminalEnabled} onCheckedChange={setSquareTerminalEnabled} />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">{t('Thanh toán qua thẻ / Tap to Pay')}</Label>
                                <Switch checked={squareOnlineEnabled} onCheckedChange={setSquareOnlineEnabled} />
                              </div>
                            </div>
                            <div>
                              <Label>Access Token</Label>
                              <Input type="password" value={squareAccessToken} onChange={e => setSquareAccessToken(e.target.value)} placeholder="EAAAxxxxxxxxxxxxxxxxxxxxxxxx" className="mt-1 font-mono text-xs" />
                            </div>
                            <div>
                              <Label>Location ID</Label>
                              <Input value={squareLocationId} onChange={e => setSquareLocationId(e.target.value)} placeholder="Lxxxxxxxxxxxxxxx" className="mt-1 font-mono text-xs" />
                              <p className="text-xs text-muted-foreground mt-1">{t('ID địa điểm Square của bạn')}</p>
                            </div>
                            {squareTerminalEnabled && (
                              <div>
                                <Label>Terminal Device ID</Label>
                                <Input value={squareDeviceId} onChange={e => setSquareDeviceId(e.target.value)} placeholder="9fa747a2-25ff-48ee-b078-04381f7c828f" className="mt-1 font-mono text-xs" />
                                <p className="text-xs text-muted-foreground mt-1">{t('Mã thiết bị Square Terminal (tìm trong Settings > Device Code trên máy)')}</p>
                              </div>
                            )}
                            {squareOnlineEnabled && (
                              <div>
                                <Label>Application ID</Label>
                                <Input value={squareApplicationId} onChange={e => setSquareApplicationId(e.target.value)} placeholder="sandbox-sq0idb-xxxxxxxxxxxx" className="mt-1 font-mono text-xs" />
                                <p className="text-xs text-muted-foreground mt-1">{t('ID ứng dụng Square cho Web Payments SDK')}</p>
                              </div>
                            )}
                            <div>
                              <Label>{t('Môi trường')}</Label>
                              <Select value={squareEnvironment} onValueChange={setSquareEnvironment}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sandbox">Sandbox ({t('thử nghiệm')})</SelectItem>
                                  <SelectItem value="production">Production ({t('chính thức')})</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button size="sm" onClick={() => { saveSquareCredentials.mutate(); }} disabled={saveSquareCredentials.isPending}>
                              {saveSquareCredentials.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang lưu...')}</> : t('Lưu cấu hình Square')}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Card Surcharge ── */}
                  <div className="border-t border-border/40 pt-4">
                    <div className="space-y-3">
                      <p className="font-medium text-sm">{t('Phụ phí thẻ tín dụng')}</p>
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
                      <Button size="sm" onClick={() => saveCardSurcharge.mutate()} disabled={saveCardSurcharge.isPending}>
                        {saveCardSurcharge.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang lưu...')}</> : t('Lưu')}
                      </Button>
                    </div>
                  </div>

                  {/* ── Print Receipt Toggle ── */}
                  <div className="border-t border-border/40 pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{t('In hoá đơn')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t('Tự động in hoá đơn cho khách sau khi thanh toán')}</p>
                      </div>
                      <Switch checked={printReceiptEnabled === true} onCheckedChange={(v) => togglePrintReceipt.mutate(v)} disabled={togglePrintReceipt.isPending} />
                    </div>
                  </div>

                </div>
              </DialogContent>
            </Dialog>

            {/* ── Notifications & Reminders Modal ── */}
            <Dialog open={settingsModal === 'notifications'} onOpenChange={(open) => !open && setSettingsModal(null)}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t('Thông báo & Nhắc lịch')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 pt-2">
                  {/* Twilio SMS */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium text-sm">SMS (Twilio)</p>
                    </div>
                    <div>
                      <Label>{t('Số điện thoại gửi SMS')} (Twilio)</Label>
                      <Input
                        value={smsNumber}
                        onChange={e => setSmsNumber(e.target.value)}
                        placeholder="+61 400 000 000"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">{t('Số Twilio dùng để gửi SMS nhắc lịch cho khách')}</p>
                    </div>
                    <Button size="sm" onClick={() => saveSmsNumber.mutate()} disabled={saveSmsNumber.isPending}>
                      {saveSmsNumber.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang lưu...')}</> : t('Lưu số SMS')}
                    </Button>
                    {twilioNumber && (
                      <div className="bg-muted rounded-lg p-3 text-sm">
                        <p className="text-muted-foreground">{t('Số SMS hiện tại')}: <strong>{twilioNumber}</strong></p>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-border/40" />

                  {/* WhatsApp */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{t('Gửi qua WhatsApp')}</p>
                      <p className="text-xs text-muted-foreground">{t('Gửi thêm tin nhắn WhatsApp cùng với SMS')}</p>
                    </div>
                    <Switch checked={whatsappEnabled === true} onCheckedChange={(v) => toggleWhatsapp.mutate(v)} disabled={toggleWhatsapp.isPending} />
                  </div>
                  <div className="border-t border-border/40" />

                  {/* Reminder toggles */}
                  <div className="space-y-4">
                    <p className="font-medium text-sm">{t('Nhắc lịch tự động')}</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">{t('Nhắc qua Email')}</p>
                        <p className="text-xs text-muted-foreground">{t('Gửi email nhắc lịch trước giờ hẹn')}</p>
                      </div>
                      <Switch checked={reminderEmailEnabled} onCheckedChange={setReminderEmailEnabled} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">{t('Nhắc qua SMS')}</p>
                        <p className="text-xs text-muted-foreground">{t('Gửi SMS nhắc lịch trước giờ hẹn')}</p>
                      </div>
                      <Switch checked={reminderSmsEnabled} onCheckedChange={setReminderSmsEnabled} />
                    </div>
                  </div>
                  <div className="border-t border-border/40" />

                  {/* Reminder intervals */}
                  <div className="space-y-3">
                    <p className="font-medium text-sm">{t('Thời gian nhắc')}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>{t('Nhắc lần 1 (giờ)')}</Label>
                        <Input
                          type="number"
                          min="1"
                          max="72"
                          value={reminder1stHours}
                          onChange={e => setReminder1stHours(e.target.value)}
                          className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">{t('VD: 24 = nhắc trước 24 giờ')}</p>
                      </div>
                      <div>
                        <Label>{t('Nhắc lần 2 (giờ)')}</Label>
                        <Input
                          type="number"
                          min="0"
                          max="24"
                          value={reminder2ndHours}
                          onChange={e => setReminder2ndHours(e.target.value)}
                          className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">{t('VD: 1 = nhắc trước 1 giờ')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border/40" />

                  {/* New booking SMS notification to owner */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium text-sm">{t('Thông báo lịch hẹn mới')}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">{t('SMS khi có lịch mới')}</p>
                        <p className="text-xs text-muted-foreground">{t('Gửi SMS đến chủ tiệm khi khách đặt lịch mới')}</p>
                      </div>
                      <Switch checked={notifySmsEnabled} onCheckedChange={setNotifySmsEnabled} />
                    </div>
                    {notifySmsEnabled && (
                      <div>
                        <Label>{t('Số điện thoại nhận thông báo')}</Label>
                        <Input
                          value={notifyPhone}
                          onChange={e => setNotifyPhone(e.target.value)}
                          placeholder="+61 400 000 000"
                          className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">{t('Số điện thoại chủ tiệm nhận SMS khi có lịch hẹn mới')}</p>
                      </div>
                    )}
                  </div>

                  <Button size="sm" onClick={() => { saveReminderSettings.mutate(); setSettingsModal(null); }} disabled={saveReminderSettings.isPending}>
                    {saveReminderSettings.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang lưu...')}</> : t('Lưu cài đặt thông báo')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* ── Danger Zone Modal ── */}
            <Dialog open={settingsModal === 'danger'} onOpenChange={(open) => !open && setSettingsModal(null)}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-destructive">{t('Vùng nguy hiểm')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground">{t('Xoá tất cả dữ liệu lịch hẹn, thanh toán, ngày nghỉ. Hành động không thể hoàn tác.')}</p>
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
                          <Button variant="destructive" onClick={() => { handleDeleteAllData(); logActivity('delete_all_data', 'Wiped all bookings, sales, visits'); }} disabled={deleting || !deletePassword.trim()} className="flex-1">
                            {deleting ? t('Đang xoá...') : t('Xoá tất cả')}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>
          )}
          </div>
        </main>
        </Tabs>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Huỷ')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { confirmDialog?.action(); setConfirmDialog(null); }}>{t('Xác nhận')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDashboard;
