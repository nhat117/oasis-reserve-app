import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, TENANT_ID } from '@/integrations/supabase/client';
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
import { NotificationBell } from '@/components/NotificationBell';
import { LogoUpload as LogoUploadComponent } from '@/components/LogoUpload';
import { Textarea } from '@/components/ui/textarea';
import { TipTapEditor } from '@/components/TipTapEditor';
import { BookingStats } from '@/components/BookingStats';
import { Leaf, LogOut, Plus, Pencil, CalendarOff, X, Settings, DollarSign, Trash2, BarChart3, CalendarDays, Scissors, Users, AlertTriangle, Tag, Crown, UserCheck, Search, Download, FileText, Shield, Lock, Menu, ChevronLeft, ChevronRight, Store, Palette, Mail, Languages, Image, Info, Bell, MessageSquare, Loader2, Ellipsis, MoreHorizontal, Phone, CreditCard, Square, RotateCcw, BookOpen, ScrollText, Eye, Clock, Check, Bot, FileSpreadsheet, Printer, History, Bug, ShoppingBag, DatabaseBackup, Upload, Gift } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ALL_I18N_KEYS } from '@/lib/i18n-keys';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import { EventClickArg } from '@fullcalendar/core';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  escapeHtml, validateForm,
  saleSchema, serviceSchema, productSchema, therapistSchema, therapistWeeklyHourSchema, adminBookingSchema,
  membershipTierSchema, holidaySchema, unavailabilitySchema, appSettingSchema,
} from '@/lib/validation';
import { computeSaleTotals, computeDiscountedSubtotal, computeTipAmount, computeBaseAmount, applyGiftCardToTotal, TipMethod } from '@/lib/checkoutMath';
import { EMPLOYEE_TABS, EmployeeTab, filterVisibleTabs, resolveActiveTab } from '@/lib/employeeTabs';
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
import { PricingManager } from '@/components/settings/PricingManager';
import { BranchesManager } from '@/components/settings/BranchesManager';
import { GiftCardsPanel } from '@/components/gift-cards/GiftCardsPanel';
import { DiscountCodesPanel } from '@/components/gift-cards/DiscountCodesPanel';
import { WeeklyShiftEditor } from '@/components/WeeklyShiftEditor';

const CURRENCIES = ['VND', 'USD', 'EUR', 'AUD'] as const;

const THERAPIST_COLORS = [
  '#3b82f6', '#f43f5e', '#10b981', '#f59e0b',
  '#8b5cf6', '#06b6d4', '#ec4899', '#f97316',
];

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
  const { t, lang } = useI18n();
  const canAccessSettings = isAdmin;
  const requireAdmin = () => {
    if (!isAdmin) throw new Error('Admin only');
  };
  // app_settings is keyed by (tenant_id, key) — always upsert through this
  // helper so writes never collide with another tenant's row for the same key.
  const upsertSetting = (key: string, value: string) =>
    supabase.from('app_settings').upsert({ key, value, tenant_id: TENANT_ID }, { onConflict: 'tenant_id,key' });

  // Resolves the configured tax type into its display label — "Custom" falls back
  // to the free-text label the tenant typed, or the literal word "Custom" if blank.
  const resolveTaxLabel = (type: string, customLabel: string) => type === 'Custom' ? (customLabel.trim() || 'Custom') : type;

  // A gift card payment is either the sole tender (payment_method='gift_card')
  // or a split with whatever cash/card tender covered the remainder
  // (gift_card_amount > 0 but payment_method stays 'cash'/'card') — see the
  // split-tender convention documented in the gift_cards migration.
  const paymentMethodLabel = (sale: { payment_method: string; gift_card_amount?: number | null; amount: number }) => {
    const base = sale.payment_method === 'card' ? t('Thẻ') : t('Tiền mặt');
    const gcAmt = Number(sale.gift_card_amount || 0);
    if (sale.payment_method === 'gift_card' || (gcAmt > 0 && gcAmt >= Number(sale.amount))) return t('Thẻ quà tặng');
    if (gcAmt > 0) return `${t('Thẻ quà tặng')} + ${base}`;
    return base;
  };

  const paymentMethodBadgeClass = (sale: { payment_method: string; gift_card_amount?: number | null; amount: number }) => {
    const gcAmt = Number(sale.gift_card_amount || 0);
    if (sale.payment_method === 'gift_card' || gcAmt > 0) return 'bg-purple-50 text-purple-600';
    return sale.payment_method === 'card' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600';
  };

  // Onboarding: show only once for new admin accounts
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { data: onboardingDone } = useQuery({
    queryKey: ['onboarding-check', user?.id],
    queryFn: async () => {
      if (!user?.id) return true;
      const { data, error } = await supabase.from('app_settings')
        .select('value')
        .eq('tenant_id', TENANT_ID)
        .eq('key', `onboarding_completed_${user.id}`)
        .maybeSingle();
      if (error) {
        // Don't force onboarding back onto an existing user just because
        // the check itself failed (network blip, RLS hiccup, etc).
        console.error('Failed to check onboarding status', error);
        return true;
      }
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
        queryClient.invalidateQueries({ queryKey: ['notifications'] });

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
  const [giftCardsSubTab, setGiftCardsSubTab] = useState<'gift_cards' | 'discount_codes'>('gift_cards');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [spaName, setSpaName] = useState('Oasis Reserve');
  const [settingsModal, setSettingsModal] = useState<string | null>(null);

  // Excel export state
  const [exportRangePreset, setExportRangePreset] = useState<'this_month' | 'last_month' | 'this_year' | 'custom'>('this_month');
  const [exportCustomFrom, setExportCustomFrom] = useState<Date | undefined>(undefined);
  const [exportCustomTo, setExportCustomTo] = useState<Date | undefined>(undefined);
  const [isExporting, setIsExporting] = useState(false);

  // Business config backup (export/import JSON) state
  const [isBackupExporting, setIsBackupExporting] = useState(false);
  const [isBackupImporting, setIsBackupImporting] = useState(false);
  const [backupImportResult, setBackupImportResult] = useState<{ table: string; count: number }[] | null>(null);
  const [backupImportFile, setBackupImportFile] = useState<File | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

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
  const [viewingUnavailDate, setViewingUnavailDate] = useState<Date | undefined>();
  const [editingTherapist, setEditingTherapist] = useState<any>(null);
  const [transferDialog, setTransferDialog] = useState(false);
  const [transferTherapist, setTransferTherapist] = useState<any>(null);
  const [transferAssignments, setTransferAssignments] = useState<Record<string, string>>({});
  const [therapistName, setTherapistName] = useState('');
  const [therapistPhone, setTherapistPhone] = useState('');
  const [therapistEmail, setTherapistEmail] = useState('');
  type WeeklyHourRow = { day_of_week: number; is_working: boolean; start_minute: number; end_minute: number; break_start_minute: number | null; break_end_minute: number | null };
  const [therapistWeeklyHours, setTherapistWeeklyHours] = useState<WeeklyHourRow[]>([]);
  const [unavailDate, setUnavailDate] = useState<Date | undefined>();
  const [unavailTherapist, setUnavailTherapist] = useState('');
  const [unavailCalendarOpen, setUnavailCalendarOpen] = useState(false);
  const [unavailRangeMode, setUnavailRangeMode] = useState(false);
  const [unavailRangeFrom, setUnavailRangeFrom] = useState('');
  const [unavailRangeTo, setUnavailRangeTo] = useState('');
  const [viewingUnavailRangeMode, setViewingUnavailRangeMode] = useState(false);
  const [viewingUnavailRangeFrom, setViewingUnavailRangeFrom] = useState('');
  const [viewingUnavailRangeTo, setViewingUnavailRangeTo] = useState('');
  const [holidayDate, setHolidayDate] = useState<Date | undefined>();
  const [holidayReason, setHolidayReason] = useState('');
  const [earlyCloseHour, setEarlyCloseHour] = useState('none');
  const [holidayCalendarOpen, setHolidayCalendarOpen] = useState(false);

  // Create booking form state
  const [bookingDialog, setBookingDialog] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [bookingServiceIds, setBookingServiceIds] = useState<string[]>([]);
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
  const [posTab, setPosTab] = useState<'appointments' | 'library' | 'products'>('appointments');
  const [saleProductSearch, setSaleProductSearch] = useState('');
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
  const [giftCardCodeInput, setGiftCardCodeInput] = useState('');
  const [appliedGiftCard, setAppliedGiftCard] = useState<{ id: string; code: string; balanceAtValidation: number } | null>(null);
  const [giftCardValidating, setGiftCardValidating] = useState(false);
  const [giftCardError, setGiftCardError] = useState('');
  const [saleServiceSearch, setSaleServiceSearch] = useState('');
  const [saleAddOnSearch, setSaleAddOnSearch] = useState('');
  const [saleBookingSearch, setSaleBookingSearch] = useState('');
  const [visibleServiceCount, setVisibleServiceCount] = useState(24);
  const [saleTherapistId, setSaleTherapistId] = useState('');
  const [tipMethod, setTipMethod] = useState<TipMethod | null>(null);
  const [tipPercent, setTipPercent] = useState(15);
  const [tipCustomAmount, setTipCustomAmount] = useState('');

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
  const [shopAbn, setShopAbn] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [openDays, setOpenDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]); // Mon=1..Sun=7
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

  // Tax rate state
  const [taxRatePercent, setTaxRatePercent] = useState('0');
  const [taxType, setTaxType] = useState('GST');
  const [taxTypeCustomLabel, setTaxTypeCustomLabel] = useState('');

  // Products admin CRUD state — mirrors service* state below
  const [productDialog, setProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productName, setProductName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [productPrice, setProductPrice] = useState('0');
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const productImageRef = useRef<HTMLInputElement>(null);

  // Checkout product picker — products have no "primary" slot, always additive
  const [saleProductIds, setSaleProductIds] = useState<string[]>([]);

  // Employee visible tabs — default all visible
  const [employeeVisibleTabs, setEmployeeVisibleTabs] = useState<EmployeeTab[]>([...EMPLOYEE_TABS]);

  // Sales filter state
  const [salesFilterMethod, setSalesFilterMethod] = useState('all');
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<any>(null);
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

  // Upgrade key state
  const [upgradeKey, setUpgradeKey] = useState('');
  const [upgradeStatus, setUpgradeStatus] = useState<'idle' | 'success' | 'error'>('idle');

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

  // New booking SMS/email notification state
  const [notifySmsEnabled, setNotifySmsEnabled] = useState(false);
  const [notifyPhone, setNotifyPhone] = useState('');
  const [notifyEmailEnabled, setNotifyEmailEnabled] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');

  // Membership & discount state
  const [membershipDialog, setMembershipDialog] = useState(false);
  const [editingTier, setEditingTier] = useState<any>(null);
  const [tierName, setTierName] = useState('');
  const [tierMinVisits, setTierMinVisits] = useState('0');
  const [tierDiscountPercent, setTierDiscountPercent] = useState('0');

  // Delete all data state
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Customer list state
  const [customerSearch, setCustomerSearch] = useState('');

  const { data: bookings } = useQuery({
    queryKey: ['admin-bookings', filterTherapist],
    queryFn: async () => {
      let query = supabase.from('bookings').select('*, services(name, duration_minutes, price), therapists(name), booking_services(service_id, service_name, duration_minutes, price)')
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

  const { data: products } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('created_at');
      if (error) throw error;
      return data;
    },
  });

  const { data: therapists } = useQuery({
    queryKey: ['admin-therapists'],
    queryFn: async () => {
      const { data, error } = await supabase.from('therapists').select('*, therapist_weekly_hours(*)').order('created_at');
      if (error) throw error;
      return data;
    },
  });

  const DAYS_OF_WEEK = [
    { value: 1, label: t('Thứ 2') },
    { value: 2, label: t('Thứ 3') },
    { value: 3, label: t('Thứ 4') },
    { value: 4, label: t('Thứ 5') },
    { value: 5, label: t('Thứ 6') },
    { value: 6, label: t('Thứ 7') },
    { value: 7, label: t('Chủ nhật') },
  ];

  const defaultWeeklyHours = () => DAYS_OF_WEEK.map(d => ({
    day_of_week: d.value, is_working: d.value >= 1 && d.value <= 6, start_minute: 9 * 60, end_minute: 18 * 60, break_start_minute: null as number | null, break_end_minute: null as number | null,
  }));

  // Single source of truth for "is this therapist working on this weekday, and
  // during what hours" — used by both admin booking creation and the transfer
  // dialog's availability lookup, so they can't drift apart.
  const getTherapistDayHours = (therapist: any, dayOfWeek: number) => {
    const rows = therapist?.therapist_weekly_hours as any[] | undefined;
    return (rows || []).find(r => r.day_of_week === dayOfWeek) || null;
  };

  const formatMinutesHHMM = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

  // Sales
  const { data: sales } = useQuery({
    queryKey: ['admin-sales'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sales')
        .select('*, bookings(customer_name, customer_phone, booking_date, start_time, services(name)), is_refunded, sale_items(service_name, price, is_addon, item_type), therapists(name)')
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

  // Read-only validation, mirroring applyCoupon — the actual balance
  // deduction only happens via the redeem_gift_card RPC inside createSale,
  // never here. Stores the card's raw balance (not a pre-computed applied
  // amount) so later tip/discount edits don't leave a stale split.
  const checkGiftCard = async () => {
    const code = giftCardCodeInput.trim().toUpperCase();
    if (!code) { setAppliedGiftCard(null); setGiftCardError(''); return; }
    setGiftCardValidating(true);
    setGiftCardError('');
    setAppliedGiftCard(null);
    const { data, error } = await supabase.from('gift_cards').select('*').eq('code', code).eq('tenant_id', TENANT_ID).maybeSingle();
    setGiftCardValidating(false);
    if (error || !data) { setGiftCardError(t('Không tìm thấy thẻ')); return; }
    if (data.status === 'disabled') { setGiftCardError(t('Thẻ đã bị khoá')); return; }
    if (data.status === 'redeemed' || Number(data.balance) <= 0) { setGiftCardError(t('Thẻ đã hết số dư')); return; }
    if (data.expiry_date < format(new Date(), 'yyyy-MM-dd')) { setGiftCardError(t('Thẻ đã hết hạn')); return; }
    setAppliedGiftCard({ id: data.id, code: data.code, balanceAtValidation: Number(data.balance) });
  };

  const clearGiftCard = () => {
    setAppliedGiftCard(null);
    setGiftCardCodeInput('');
    setGiftCardError('');
  };

  const createSale = useMutation({
    mutationFn: async () => {
      const mainService = services?.find(sv => sv.id === saleServiceId);
      const addOnServices = saleAddOns.map(id => services?.find(sv => sv.id === id)).filter((s): s is NonNullable<typeof s> => !!s);
      const saleProducts = saleProductIds.map(id => products?.find(pr => pr.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
      const addOnTotal = addOnServices.reduce((sum, s) => sum + s.price, 0);
      const baseAmount = computeBaseAmount([
        ...(mainService ? [{ price: mainService.price }] : []),
        ...addOnServices.map(s => ({ price: s.price })),
        ...saleProducts.map(p => ({ price: p.price })),
      ]);
      const selectedBooking = saleType === 'booking' && saleBookingId && saleBookingId !== 'none'
        ? bookings?.find(b => b.id === saleBookingId)
        : undefined;
      const therapistId = selectedBooking?.therapist_id || saleTherapistId || null;
      const therapistName = selectedBooking
        ? (selectedBooking as any).therapists?.name || null
        : therapists?.find(th => th.id === saleTherapistId)?.name || null;
      const { afterDiscount } = computeDiscountedSubtotal(baseAmount, saleCouponDiscount);
      const tipAmt = tipMethod ? computeTipAmount(tipMethod, tipMethod === 'percent' ? tipPercent : parseFloat(tipCustomAmount || '0'), afterDiscount) : 0;
      const taxRate = parseFloat(taxRateSetting || '0');
      const taxLabel = resolveTaxLabel(taxType, taxTypeCustomLabel);
      const totals = computeSaleTotals({
        baseAmount,
        coupon: saleCouponDiscount,
        surchargeRatePercent: parseFloat(cardSurchargeSetting || '0'),
        applySurcharge: salePaymentMethod === 'card',
        taxRatePercent: taxRate,
        tipAmount: tipAmt,
      });
      const totalAmount = totals.grandTotal;
      const giftCardSplit = appliedGiftCard
        ? applyGiftCardToTotal(totalAmount, appliedGiftCard.balanceAtValidation)
        : null;

      const vErr = validateForm(saleSchema, {
        amount: totalAmount,
        customerName: saleCustomerName || '',
        customerPhone: saleCustomerPhone || '',
        notes: saleNotes || '',
        paymentMethod: salePaymentMethod === 'square' ? 'card' : salePaymentMethod,
        tipAmount: totals.tipAmt,
      });
      if (vErr) throw new Error(vErr);

      // Gift-card fields are deliberately omitted here and only written after
      // the redeem_gift_card RPC confirms success below — a failed
      // redemption must never leave a sales row claiming money was deducted
      // that wasn't. If the RPC fails, this row stands as a plain cash/card
      // sale for the full amount, matching what actually happens at the
      // register when a gift card can't be used.
      const payload: any = {
        amount: totalAmount,
        tip_amount: totals.tipAmt,
        tip_method: tipMethod || null,
        tax_amount: totals.taxAmt,
        tax_rate_percent: taxRate,
        tax_label: taxLabel,
        therapist_id: therapistId,
        therapist_name: therapistName,
        payment_method: salePaymentMethod === 'square' ? 'card' : salePaymentMethod,
        notes: saleNotes || null,
        sale_date: format(new Date(), 'yyyy-MM-dd'),
        customer_phone: saleCustomerPhone || null,
        customer_name: saleCustomerName || null,
        tenant_id: TENANT_ID,
      };
      if (saleType === 'booking' && saleBookingId && saleBookingId !== 'none') payload.booking_id = saleBookingId;
      if (saleCouponCode.trim()) payload.notes = `${payload.notes || ''} [Coupon: ${saleCouponCode.trim().toUpperCase()}]`.trim();
      const { data: saleData, error } = await supabase.from('sales').insert(payload).select('id').single();
      if (error) throw error;

      // Record each service/add-on/product as its own line item for a real itemized breakdown
      const lineItems = [
        ...(mainService ? [{ service_id: mainService.id, product_id: null, service_name: mainService.name, price: mainService.price, is_addon: false, item_type: 'service' as const }] : []),
        ...addOnServices.map(s => ({ service_id: s.id, product_id: null, service_name: s.name, price: s.price, is_addon: true, item_type: 'service' as const })),
        ...saleProducts.map(p => ({ service_id: null, product_id: p.id, service_name: p.name, price: p.price, is_addon: true, item_type: 'product' as const })),
      ];
      if (lineItems.length > 0 && saleData?.id) {
        const { error: itemsError } = await supabase.from('sale_items').insert(
          lineItems.map(item => ({ ...item, sale_id: saleData.id, tenant_id: TENANT_ID }))
        );
        if (itemsError) console.error('Failed to record sale items', itemsError);
      }

      // Staff can add extra services to a booking's cart at checkout (beyond what
      // was originally scheduled) — sync booking_services to match what was actually
      // charged, so appointment history reflects the services really performed.
      if (payload.booking_id && (mainService || addOnServices.length > 0)) {
        const { error: delBsError } = await supabase.from('booking_services').delete().eq('booking_id', payload.booking_id);
        if (delBsError) console.error('Failed to sync booking services', delBsError);
        const bookingServiceRows = [
          ...(mainService ? [{ service: mainService, isPrimary: true }] : []),
          ...addOnServices.map(s => ({ service: s, isPrimary: false })),
        ];
        const { error: bsError } = await supabase.from('booking_services').insert(
          bookingServiceRows.map(({ service, isPrimary }) => ({
            booking_id: payload.booking_id,
            service_id: service.id,
            service_name: service.name,
            duration_minutes: service.duration_minutes,
            price: service.price,
            is_primary: isPrimary,
            tenant_id: TENANT_ID,
          })),
        );
        if (bsError) console.error('Failed to sync booking services', bsError);
      }

      // Increment coupon usage
      if (saleCouponDiscount && saleCouponCode.trim()) {
        const code = saleCouponCode.trim().toUpperCase();
        const { data: dc } = await supabase.from('discount_codes').select('id, current_uses').eq('code', code).single();
        if (dc) await supabase.from('discount_codes').update({ current_uses: (dc.current_uses || 0) + 1 }).eq('id', dc.id);
      }

      // Redeem the gift card only after the sale row exists (the ledger
      // needs a real sale_id to link to) and only for the amount actually
      // applied. The RPC re-validates status/expiry/balance server-side and
      // atomically deducts + logs — this is the only place balance moves.
      let giftCardApplied = 0;
      let giftCardRemainingBalance: number | null = null;
      if (appliedGiftCard && giftCardSplit && giftCardSplit.giftCardApplied > 0 && saleData?.id) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('redeem_gift_card', {
          p_code: appliedGiftCard.code,
          p_amount: giftCardSplit.giftCardApplied,
          p_sale_id: saleData.id,
        });
        if (rpcError) throw rpcError;
        const rpcResult = rpcData as { success: boolean; error?: string; applied_amount?: number; new_balance?: number };
        if (!rpcResult.success) {
          const messages: Record<string, string> = {
            expired: t('Thẻ đã hết hạn'),
            disabled: t('Thẻ đã bị khoá'),
            empty: t('Thẻ đã hết số dư'),
            not_found: t('Không tìm thấy thẻ'),
          };
          throw new Error(messages[rpcResult.error || ''] || t('Không thể trừ thẻ quà tặng'));
        }
        giftCardApplied = rpcResult.applied_amount ?? 0;
        giftCardRemainingBalance = rpcResult.new_balance ?? null;
        const fullyCovered = giftCardApplied >= totalAmount;
        const { error: updateError } = await supabase.from('sales').update({
          gift_card_id: appliedGiftCard.id,
          gift_card_code: appliedGiftCard.code,
          gift_card_amount: giftCardApplied,
          ...(fullyCovered ? { payment_method: 'gift_card' } : {}),
        }).eq('id', saleData.id);
        if (updateError) throw updateError;
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

      // Return exactly what was charged/stored so onSuccess prints a receipt that
      // matches the DB row, even if the cashier changes tip/coupon/add-on state
      // while this mutation's network calls are still in flight.
      return {
        mainServiceName: mainService?.name || '',
        mainServiceAmount: mainService?.price || 0,
        addOnDetails: lineItems.filter(i => i.is_addon && i.item_type === 'service').map(i => ({ name: i.service_name, price: i.price })),
        productDetails: lineItems.filter(i => i.item_type === 'product').map(i => ({ name: i.service_name, price: i.price })),
        discountAmt: totals.discountAmt,
        surchargeAmt: totals.surchargeAmt,
        taxAmt: totals.taxAmt,
        taxRatePercent: taxRate,
        taxLabel,
        tipAmt: totals.tipAmt,
        customerName: saleCustomerName,
        customerPhone: saleCustomerPhone,
        paymentMethod: giftCardApplied >= totalAmount && giftCardApplied > 0 ? 'gift_card' : salePaymentMethod,
        couponCode: saleCouponCode || undefined,
        giftCardCode: giftCardApplied > 0 ? appliedGiftCard?.code : undefined,
        giftCardApplied: giftCardApplied > 0 ? giftCardApplied : undefined,
        giftCardRemainingBalance,
      };
    },
    onSuccess: (result) => {
      logActivity('create_sale', `Amount: ${saleAmount}, Method: ${salePaymentMethod}, Customer: ${saleCustomerName || saleCustomerPhone || 'N/A'}`);
      // Print receipt if enabled — uses what mutationFn actually charged/stored,
      // not live component state (which may have changed while the mutation awaited).
      if (printReceiptEnabled && result) {
        printReceipt({
          amount: result.mainServiceAmount,
          customerName: result.customerName,
          customerPhone: result.customerPhone,
          serviceName: result.mainServiceName,
          addOns: result.addOnDetails,
          products: result.productDetails,
          paymentMethod: result.paymentMethod,
          discount: result.discountAmt,
          surcharge: result.surchargeAmt,
          tax: result.taxAmt,
          taxRatePercent: result.taxRatePercent,
          taxLabel: result.taxLabel,
          tip: result.tipAmt,
          coupon: result.couponCode,
          giftCardCode: result.giftCardCode,
          giftCardApplied: result.giftCardApplied,
          giftCardRemainingBalance: result.giftCardRemainingBalance ?? undefined,
          date: format(new Date(), 'dd/MM/yyyy HH:mm'),
        });
      }
      queryClient.invalidateQueries({ queryKey: ['admin-sales'] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['stats-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] });
      queryClient.invalidateQueries({ queryKey: ['gift-card-liability'] });
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
      setSaleProductIds([]);
      setSaleCouponCode('');
      setSaleCouponDiscount(null);
      setSaleCouponError('');
      setShowSquareCardForm(false);
      setSaleTherapistId('');
      setTipMethod(null);
      setTipPercent(15);
      setTipCustomAmount('');
      clearGiftCard();
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      toast(result?.giftCardApplied
        ? { title: t('Đã ghi nhận thanh toán'), description: `${t('Đã trừ thẻ quà tặng')}: A$ ${result.giftCardApplied.toLocaleString()}${result.giftCardRemainingBalance != null ? ` · ${t('Số dư còn lại')}: A$ ${result.giftCardRemainingBalance.toLocaleString()}` : ''}` }
        : { title: t('Đã ghi nhận thanh toán') });
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

  useEffect(() => {
    const resolved = resolveActiveTab(activeTab, isAdmin, employeeVisibleTabs);
    if (resolved !== activeTab) setActiveTab(resolved);
  }, [isAdmin, employeeVisibleTabs, activeTab]);

  const saveEmployeeTabs = useMutation({
    mutationFn: async (tabs: EmployeeTab[]) => {
      requireAdmin();
      const { error } = await upsertSetting('employee_visible_tabs', JSON.stringify(tabs));
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
      const { error } = await upsertSetting('random_therapist_enabled', String(enabled));
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
      const { error } = await upsertSetting('twilio_from_number', smsNumber);
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
        const { error } = await upsertSetting(s.key, s.value);
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
          const { error } = await upsertSetting(s.key, s.value);
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
          const { error } = await upsertSetting(s.key, s.value);
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
      const { error } = await upsertSetting('whatsapp_enabled', String(enabled));
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
        .in('key', ['shop_phone', 'shop_address', 'shop_abn', 'opening_hours', 'open_days', 'open_time', 'close_time', 'shop_state', 'shop_timezone', 'show_holiday_closed', 'hero_mode', 'hero_media_path']);
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
      setShopAbn(shopInfoSettings['shop_abn'] || '');
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
        { key: 'shop_abn', value: shopAbn },
        { key: 'opening_hours', value: openingHours },
        { key: 'open_days', value: JSON.stringify(openDays) },
        { key: 'open_time', value: openTime },
        { key: 'close_time', value: closeTime },
        { key: 'shop_state', value: shopState },
        { key: 'shop_timezone', value: shopTimezone },
        { key: 'show_holiday_closed', value: String(showHolidayClosed) },
      ];
      for (const row of rows) {
        const { error } = await upsertSetting(row.key, row.value);
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
          const { error } = await upsertSetting(row.key, row.value);
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
      const { error } = await upsertSetting('card_surcharge_percent', cardSurchargePercent);
      if (error) throw error;
    },
    onSuccess: () => { logActivity('update_card_surcharge', `Surcharge: ${cardSurchargePercent}%`); queryClient.invalidateQueries({ queryKey: ['card-surcharge-setting'] }); toast({ title: t('Đã lưu phụ phí thẻ') }); },
  });

  // Tax rate setting
  const { data: taxRateSetting } = useQuery({
    queryKey: ['tax-rate-setting'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'tax_rate_percent').single();
      if (error) return '0';
      return data.value;
    },
  });

  useEffect(() => {
    if (taxRateSetting) setTaxRatePercent(taxRateSetting);
  }, [taxRateSetting]);

  // Tax type — the tenant's chosen tax name (GST/VAT/Sales Tax/Custom), snapshotted
  // per sale as tax_label so historical receipts keep showing what was actually
  // charged even if this setting changes later.
  const { data: taxTypeSetting } = useQuery({
    queryKey: ['tax-type-setting'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('key, value')
        .in('key', ['tax_type', 'tax_type_custom_label']);
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach(r => { map[r.key] = r.value; });
      return map;
    },
  });

  useEffect(() => {
    if (taxTypeSetting?.tax_type) setTaxType(taxTypeSetting.tax_type);
    if (taxTypeSetting?.tax_type_custom_label) setTaxTypeCustomLabel(taxTypeSetting.tax_type_custom_label);
  }, [taxTypeSetting]);

  const saveTaxSettings = useMutation({
    mutationFn: async () => {
      requireAdmin();
      const { error: e1 } = await upsertSetting('tax_rate_percent', taxRatePercent);
      if (e1) throw e1;
      const { error: e2 } = await upsertSetting('tax_type', taxType);
      if (e2) throw e2;
      const { error: e3 } = await upsertSetting('tax_type_custom_label', taxTypeCustomLabel);
      if (e3) throw e3;
    },
    onSuccess: () => {
      logActivity('update_tax_rate', `Tax: ${resolveTaxLabel(taxType, taxTypeCustomLabel)} ${taxRatePercent}%`);
      queryClient.invalidateQueries({ queryKey: ['tax-rate-setting'] });
      queryClient.invalidateQueries({ queryKey: ['tax-type-setting'] });
      toast({ title: t('Đã lưu thuế') });
    },
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

  // AI License key — gates AI Chat & Inbox features
  const { data: aiLicenseKey } = useQuery({
    queryKey: ['ai-license-key', TENANT_ID],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'ai_license_key').eq('tenant_id', TENANT_ID).single();
      return data?.value || '';
    },
  });

  const isAiLicensed = !!aiLicenseKey && aiLicenseKey.length >= 8;

  const [licenseValidating, setLicenseValidating] = useState(false);
  const [licenseError, setLicenseError] = useState('');

  const saveAiLicense = useMutation({
    mutationFn: async (key: string) => {
      requireAdmin();
      setLicenseError('');
      setLicenseValidating(true);
      try {
        const { data, error } = await supabase.functions.invoke('validate-upgrade-key', {
          body: { key: key.trim() },
        });
        if (error) throw new Error(error.message);
        if (!data?.valid) {
          throw new Error(data?.reason || 'Invalid key');
        }
        return data;
      } finally {
        setLicenseValidating(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-license-key'] });
      setUpgradeKey('');
      toast({ title: t('Mã bản quyền hợp lệ — đã kích hoạt!') });
    },
    onError: (err: Error) => {
      setLicenseError(err.message);
    },
  });

  // Inbox visibility toggle — persisted in app_settings
  const { data: inboxEnabled } = useQuery({
    queryKey: ['inbox-enabled', TENANT_ID],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'inbox_enabled').eq('tenant_id', TENANT_ID).single();
      return data?.value === 'true';
    },
  });

  const toggleInboxVisible = useMutation({
    mutationFn: async (enabled: boolean) => {
      requireAdmin();
      const { error } = await upsertSetting('inbox_enabled', String(enabled));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-enabled'] });
      toast({ title: inboxEnabled ? t('Đã ẩn hộp thư') : t('Đã hiện hộp thư') });
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
          const { error } = await upsertSetting(row.key, row.value);
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
      const { error } = await upsertSetting('about_content', aboutContent);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['page-contents'] }); queryClient.invalidateQueries({ queryKey: ['about-settings'] }); toast({ title: t('Đã lưu nội dung Về chúng tôi') }); },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });
  const saveTermsContent = useMutation({
    mutationFn: async () => {
      requireAdmin();
      const { error } = await upsertSetting('terms_content', termsContent);
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
        .in('key', ['reminder_email_enabled', 'reminder_sms_enabled', 'reminder_1st_hours', 'reminder_2nd_hours', 'notify_sms_enabled', 'notify_phone', 'notify_email_enabled', 'notify_email']);
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
      setNotifyEmailEnabled(reminderSettings['notify_email_enabled'] === 'true');
      setNotifyEmail(reminderSettings['notify_email'] || '');
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
        { key: 'notify_email_enabled', value: String(notifyEmailEnabled) },
        { key: 'notify_email', value: notifyEmail },
      ];
      for (const row of rows) {
        const { error } = await upsertSetting(row.key, row.value);
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
        const { error } = await supabase.from('membership_tiers').insert({ ...payload, tenant_id: TENANT_ID });
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
      const { error } = await upsertSetting('membership_enabled', String(enabled));
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['membership-enabled'] }); toast({ title: t('Đã cập nhật') }); },
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
      const { error } = await upsertSetting('print_receipt_enabled', String(enabled));
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['print-receipt-enabled'] }); toast({ title: t('Đã cập nhật') }); },
  });

  const printReceipt = (sale: { amount: number; customerName: string; customerPhone: string; serviceName: string; addOns: { name: string; price: number }[]; products?: { name: string; price: number }[]; paymentMethod: string; discount?: number; surcharge?: number; tax?: number; taxRatePercent?: number; taxLabel?: string; tip?: number; coupon?: string; giftCardCode?: string; giftCardApplied?: number; giftCardRemainingBalance?: number; date: string }) => {
    const win = window.open('about:blank', '_blank');
    if (!win) {
      toast({
        title: t('Trình duyệt đã chặn cửa sổ in hoá đơn'),
        description: t('Vui lòng cho phép popup cho trang này trong cài đặt trình duyệt, rồi thử lại.'),
        variant: 'destructive',
      });
      return;
    }
    const esc = escapeHtml;
    const addOnLines = sale.addOns.map(a => `<tr><td style="padding:2px 0">&nbsp;&nbsp;${esc(a.name)}</td><td style="text-align:right;padding:2px 0">A$ ${a.price.toLocaleString()}</td></tr>`).join('');
    const productLines = (sale.products || []).map(p => `<tr><td style="padding:2px 0">&nbsp;&nbsp;${esc(p.name)}</td><td style="text-align:right;padding:2px 0">A$ ${p.price.toLocaleString()}</td></tr>`).join('');
    const subtotal = sale.amount + (sale.discount || 0) - (sale.surcharge || 0) - (sale.tax || 0) - (sale.tip || 0);
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
      <h2>${esc(spaName)}</h2>
      ${shopAddress ? `<p class="center" style="font-size:10px;color:#666">${esc(shopAddress)}</p>` : ''}
      ${shopAbn ? `<p class="center" style="font-size:10px;color:#666">ABN ${esc(shopAbn)}</p>` : ''}
      <p class="center" style="font-size:10px;color:#666">${esc(sale.date)}</p>
      <div class="line"></div>
      ${sale.customerName ? `<p><b>${esc(sale.customerName)}</b>${sale.customerPhone ? ` · ${esc(sale.customerPhone)}` : ''}</p>` : ''}
      <div class="line"></div>
      <table>
        <tr><td class="bold">${esc(sale.serviceName)}</td><td class="right">A$ ${subtotal.toLocaleString()}</td></tr>
        ${addOnLines}
        ${productLines}
        ${(sale.discount || 0) > 0 ? `<tr><td>${sale.coupon ? `Discount (${esc(sale.coupon)})` : 'Discount'}</td><td class="right" style="color:#16a34a">-A$ ${(sale.discount || 0).toLocaleString()}</td></tr>` : ''}
        ${(sale.surcharge || 0) > 0 ? `<tr><td>Card surcharge</td><td class="right">A$ ${(sale.surcharge || 0).toLocaleString()}</td></tr>` : ''}
        ${(sale.tax || 0) > 0 ? `<tr><td>${esc(sale.taxLabel || 'Tax')}${sale.taxRatePercent ? ` (${sale.taxRatePercent}%)` : ''}</td><td class="right">A$ ${(sale.tax || 0).toLocaleString()}</td></tr>` : ''}
        ${(sale.tip || 0) > 0 ? `<tr><td>Tip</td><td class="right">A$ ${(sale.tip || 0).toLocaleString()}</td></tr>` : ''}
        ${(sale.giftCardApplied || 0) > 0 ? `<tr><td>Gift card${sale.giftCardCode ? ` (${esc(sale.giftCardCode)})` : ''}</td><td class="right" style="color:#16a34a">-A$ ${(sale.giftCardApplied || 0).toLocaleString()}</td></tr>` : ''}
      </table>
      <div class="line"></div>
      <table><tr><td class="total">TOTAL</td><td class="total right">A$ ${sale.amount.toLocaleString()}</td></tr></table>
      <p style="margin-top:4px;font-size:10px;color:#666">Paid by: ${
        sale.paymentMethod === 'gift_card' ? 'Gift Card'
        : (sale.giftCardApplied || 0) > 0 ? `Gift Card + ${sale.paymentMethod === 'card' ? 'Card' : 'Cash'}`
        : sale.paymentMethod === 'card' ? 'Card'
        : sale.paymentMethod === 'square' ? 'Square'
        : 'Cash'
      }</p>
      ${sale.giftCardRemainingBalance != null ? `<p style="font-size:10px;color:#666;margin-top:2px">Gift card remaining balance: A$ ${sale.giftCardRemainingBalance.toLocaleString()}</p>` : ''}
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

  // Filtered active services for POS service picker
  const filteredActiveServices = useMemo(() => (services || []).filter(s => s.is_active).filter(s => {
    if (!saleServiceSearch.trim()) return true;
    return s.name.toLowerCase().includes(saleServiceSearch.toLowerCase());
  }), [services, saleServiceSearch]);
  const visibleServices = filteredActiveServices.slice(0, visibleServiceCount);
  const hasMoreServices = visibleServiceCount < filteredActiveServices.length;
  const serviceSentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset visible service count whenever the search term changes
  useEffect(() => {
    setVisibleServiceCount(24);
  }, [saleServiceSearch]);

  // IntersectionObserver sentinel for the service library "load more"
  useEffect(() => {
    const el = serviceSentinelRef.current;
    if (!el || !hasMoreServices) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleServiceCount(prev => Math.min(prev + 24, filteredActiveServices.length));
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMoreServices, filteredActiveServices.length]);


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
        const { error } = await upsertSetting(row.key, row.value);
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
      const { error } = await supabase.from('therapist_unavailability').insert({ therapist_id: therapistId, unavailable_date: date, reason, tenant_id: TENANT_ID });
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

  // therapist_unavailability is one row per day (unique per therapist+date), so a
  // multi-day leave request is inserted as N rows here rather than a start/end range column.
  const addUnavailabilityRange = useMutation({
    mutationFn: async ({ therapistId, from, to, reason }: { therapistId: string; from: string; to: string; reason?: string }) => {
      requireAdmin();
      const start = new Date(`${from}T00:00:00`);
      const end = new Date(`${to}T00:00:00`);
      if (end < start) throw new Error(t('Ngày kết thúc phải sau ngày bắt đầu'));
      const dates: string[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) dates.push(format(d, 'yyyy-MM-dd'));
      if (dates.length > 90) throw new Error(t('Khoảng ngày quá dài (tối đa 90 ngày)'));
      for (const date of dates) {
        const vErr = validateForm(unavailabilitySchema, { therapistId, date, reason: reason || '' });
        if (vErr) throw new Error(vErr);
      }
      const { error } = await supabase.from('therapist_unavailability')
        .upsert(dates.map(date => ({ therapist_id: therapistId, unavailable_date: date, reason, tenant_id: TENANT_ID })), { onConflict: 'therapist_id,unavailable_date', ignoreDuplicates: true });
      if (error) throw error;
      return dates.length;
    },
    onSuccess: (count) => {
      logActivity('add_unavailability_range', `Added ${count} days off`);
      queryClient.invalidateQueries({ queryKey: ['admin-unavailability'] });
      toast({ title: t('Đã thêm ngày nghỉ'), description: `${count} ${t('ngày đã được thêm')}` });
    },
    onError: (e: any) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
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
        tenant_id: TENANT_ID,
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
      const selectedServices = bookingServiceIds
        .map(id => services?.find(s => s.id === id))
        .filter((s): s is NonNullable<typeof s> => !!s);
      if (selectedServices.length === 0 || !bookingDate || !bookingTime) throw new Error('Missing fields');
      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0);

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
      const endMin = h * 60 + m + totalDuration;
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
      const bookingId = crypto.randomUUID();
      const { error } = await supabase.from('bookings').insert({
        id: bookingId,
        service_id: selectedServices[0].id,
        therapist_id: therapistId,
        booking_date: format(bookingDate, 'yyyy-MM-dd'),
        start_time: bookingTime,
        end_time: endTime,
        customer_name: bookingCustomerName,
        customer_phone: bookingCustomerPhone,
        customer_email: bookingCustomerEmail || null,
        notes: bookingNotes || null,
        status: 'confirmed',
        tenant_id: TENANT_ID,
      });
      if (error) throw error;

      const { error: bsError } = await supabase.from('booking_services').insert(
        selectedServices.map((s, i) => ({
          booking_id: bookingId,
          service_id: s.id,
          service_name: s.name,
          duration_minutes: s.duration_minutes,
          price: s.price,
          is_primary: i === 0,
          tenant_id: TENANT_ID,
        })),
      );
      if (bsError) throw bsError;
    },
    onSuccess: () => {
      logActivity('create_booking', `Customer: ${bookingCustomerName}, Phone: ${bookingCustomerPhone}`);
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      // Send confirmation email if customer email provided
      if (bookingCustomerEmail?.trim()) {
        const selectedServices = bookingServiceIds
          .map(id => services?.find(s => s.id === id))
          .filter((s): s is NonNullable<typeof s> => !!s);
        const serviceLabel = selectedServices.map(s => s.name).join(' + ');
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
                <p style="margin: 4px 0;">📋 <strong>Service:</strong> ${esc(serviceLabel)}</p>
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
            subject: `Booking Confirmed - ${serviceLabel || 'Oasis Reserve'}`,
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

  // Update an existing booking's services/date/time/therapist (edit flow)
  const updateBooking = useMutation({
    mutationFn: async () => {
      if (!editingBookingId) throw new Error('Missing booking id');
      const selectedServices = bookingServiceIds
        .map(id => services?.find(s => s.id === id))
        .filter((s): s is NonNullable<typeof s> => !!s);
      if (selectedServices.length === 0 || !bookingDate || !bookingTime) throw new Error('Missing fields');
      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0);

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
      const endMin = h * 60 + m + totalDuration;
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

      const { error } = await supabase.from('bookings').update({
        service_id: selectedServices[0].id,
        therapist_id: therapistId,
        booking_date: format(bookingDate, 'yyyy-MM-dd'),
        start_time: bookingTime,
        end_time: endTime,
        customer_name: bookingCustomerName,
        customer_phone: bookingCustomerPhone,
        customer_email: bookingCustomerEmail || null,
        notes: bookingNotes || null,
      }).eq('id', editingBookingId);
      if (error) throw error;

      const { error: delError } = await supabase.from('booking_services').delete().eq('booking_id', editingBookingId);
      if (delError) throw delError;

      const { error: bsError } = await supabase.from('booking_services').insert(
        selectedServices.map((s, i) => ({
          booking_id: editingBookingId,
          service_id: s.id,
          service_name: s.name,
          duration_minutes: s.duration_minutes,
          price: s.price,
          is_primary: i === 0,
          tenant_id: TENANT_ID,
        })),
      );
      if (bsError) throw bsError;
    },
    onSuccess: () => {
      logActivity('update_booking', `Updated booking ${editingBookingId}`);
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      setBookingDialog(false);
      resetBookingForm();
      toast({ title: t('Đã lưu lịch hẹn') });
    },
    onError: (e) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  const resetBookingForm = () => {
    setEditingBookingId(null);
    setBookingServiceIds([]);
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
        const { error } = await supabase.from('services').insert({ ...payload, tenant_id: TENANT_ID });
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

  const saveProduct = useMutation({
    mutationFn: async () => {
      if (editingProduct) requireAdmin();
      let imagePath = editingProduct?.image_path || null;

      if (productImageFile) {
        const ext = productImageFile.name.split('.').pop();
        const path = `product-${Date.now()}.${ext}`;
        if (imagePath) {
          await supabase.storage.from('product-images').remove([imagePath]);
        }
        const { error: uploadErr } = await supabase.storage.from('product-images').upload(path, productImageFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        imagePath = path;
      }

      const payload = { name: productName, description: productDesc || null, price: parseFloat(productPrice), image_path: imagePath };
      const vErr = validateForm(productSchema, { name: payload.name, description: payload.description || '', price: payload.price });
      if (vErr) throw new Error(vErr);
      if (editingProduct) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert({ ...payload, tenant_id: TENANT_ID });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      logActivity(editingProduct ? 'update_product' : 'create_product', `Product: ${productName}`);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setProductDialog(false);
      setProductImageFile(null);
      setProductImagePreview(null);
      toast({ title: editingProduct ? t('Đã cập nhật sản phẩm') : t('Đã thêm sản phẩm') });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      if (!isAdmin) throw new Error('Admin only');
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      logActivity('delete_product', `Product ID: ${id}`);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast({ title: t('Đã xoá sản phẩm') });
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
      } as any;
      const vErr = validateForm(therapistSchema, {
        name: payload.name,
        phone: payload.phone || '',
        email: payload.email || '',
      });
      if (vErr) throw new Error(vErr);
      for (const row of therapistWeeklyHours) {
        const rowErr = validateForm(therapistWeeklyHourSchema, row);
        if (rowErr) throw new Error(rowErr);
      }

      let therapistId = editingTherapist?.id;
      if (editingTherapist) {
        const { error } = await supabase.from('therapists').update(payload).eq('id', editingTherapist.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('therapists').insert({ ...payload, tenant_id: TENANT_ID }).select('id').single();
        if (error) throw error;
        therapistId = data.id;
      }

      // Weekly hours are fully replaced each save — simpler than diffing
      // per-day rows, and this dialog is the only place they're edited.
      const { error: delError } = await supabase.from('therapist_weekly_hours').delete().eq('therapist_id', therapistId);
      if (delError) throw delError;
      const { error: hoursError } = await supabase.from('therapist_weekly_hours').insert(
        therapistWeeklyHours.map(row => ({ ...row, therapist_id: therapistId, tenant_id: TENANT_ID }))
      );
      if (hoursError) throw hoursError;
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
      if (error) {
        // 23503 = foreign key violation — staff has bookings/sales history, can't hard-delete
        if (error.code === '23503') {
          const { error: deactivateError } = await supabase.from('therapists').update({ is_active: false }).eq('id', id);
          if (deactivateError) throw deactivateError;
          return { deactivated: true };
        }
        throw error;
      }
      return { deactivated: false };
    },
    onSuccess: (result, id) => {
      logActivity(result?.deactivated ? 'deactivate_therapist' : 'delete_therapist', `Therapist ID: ${id}`);
      queryClient.invalidateQueries({ queryKey: ['admin-therapists'] });
      toast(result?.deactivated
        ? { title: t('Đã ẩn nhân viên'), description: t('Nhân viên này có lịch sử đặt lịch nên không thể xoá hoàn toàn. Đã chuyển sang trạng thái ẩn, dữ liệu cũ vẫn được giữ lại.') }
        : { title: t('Đã xoá thợ') });
    },
    onError: (e: any) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  const reactivateTherapist = useMutation({
    mutationFn: async (id: string) => {
      if (!isAdmin) throw new Error('Admin only');
      const { error } = await supabase.from('therapists').update({ is_active: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      logActivity('reactivate_therapist', `Therapist ID: ${id}`);
      queryClient.invalidateQueries({ queryKey: ['admin-therapists'] });
      toast({ title: t('Đã kích hoạt lại nhân viên') });
    },
    onError: (e: any) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  // Upcoming (not-yet-started, non-cancelled) bookings currently assigned to a therapist —
  // these are the ones that need a new staff member before the therapist can be hidden/deleted.
  const getUpcomingBookingsForTherapist = (therapistId: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const now = new Date();
    return (bookings || []).filter((b: any) => {
      if (b.therapist_id !== therapistId) return false;
      if (b.status !== 'confirmed') return false;
      if (b.booking_date > today) return true;
      if (b.booking_date === today) {
        const [h, m] = (b.start_time || '').split(':').map(Number);
        const startMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime();
        return startMs > now.getTime();
      }
      return false;
    });
  };

  // Other active staff free to take over a given booking's date/time slot —
  // same working_days/hours/break/conflict checks used when creating a booking,
  // just evaluated for one already-scheduled slot instead of a full day's grid.
  const getAvailableTherapistsForBooking = (booking: any, excludeTherapistId: string) => {
    const dateStr = booking.booking_date;
    const bookingDate = new Date(`${dateStr}T00:00:00`);
    const dayOfWeek = bookingDate.getDay() === 0 ? 7 : bookingDate.getDay();
    const startMins = timeToMins(booking.start_time);
    const endMins = timeToMins(booking.end_time);
    const TRANSFER_BUFFER = 15;
    const unavailableIds = new Set((unavailabilities || []).filter((u: any) => u.unavailable_date === dateStr).map((u: any) => u.therapist_id));
    const dayBookings = (bookings || []).filter((b: any) => b.booking_date === dateStr && b.status === 'confirmed' && b.id !== booking.id);

    return (therapists || []).filter((th: any) => {
      if (th.id === excludeTherapistId || !th.is_active) return false;
      if (unavailableIds.has(th.id)) return false;
      const dayHours = getTherapistDayHours(th, dayOfWeek);
      if (!dayHours || !dayHours.is_working) return false;
      if (startMins < dayHours.start_minute || endMins > dayHours.end_minute) return false;
      if (dayHours.break_start_minute != null && dayHours.break_end_minute != null) {
        if (startMins < dayHours.break_end_minute && endMins > dayHours.break_start_minute) return false;
      }
      return !dayBookings.some((b: any) => {
        if (b.therapist_id !== th.id) return false;
        const bStart = timeToMins(b.start_time);
        const bEnd = timeToMins(b.end_time);
        return startMins < (bEnd + TRANSFER_BUFFER) && endMins > (bStart - TRANSFER_BUFFER);
      });
    });
  };

  const openDeleteTherapist = (th: any) => {
    const upcoming = getUpcomingBookingsForTherapist(th.id);
    if (upcoming.length === 0) {
      openConfirm(t('Xoá thợ'), t('Xoá thợ này? Nếu nhân viên đã có lịch hẹn hoặc lịch sử bán hàng, hệ thống sẽ ẩn thay vì xoá hoàn toàn để giữ dữ liệu cũ.'), () => deleteTherapist.mutate(th.id));
      return;
    }
    const initialAssignments: Record<string, string> = {};
    upcoming.forEach((b: any) => {
      const suggestion = getAvailableTherapistsForBooking(b, th.id)[0];
      if (suggestion) initialAssignments[b.id] = suggestion.id;
    });
    setTransferAssignments(initialAssignments);
    setTransferTherapist(th);
    setTransferDialog(true);
  };

  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const confirmTransferAndDelete = async () => {
    if (!transferTherapist) return;
    const upcoming = getUpcomingBookingsForTherapist(transferTherapist.id);
    setTransferSubmitting(true);
    try {
      for (const b of upcoming) {
        const newTherapistId = transferAssignments[b.id];
        if (!newTherapistId) continue;
        const { error } = await supabase.from('bookings').update({ therapist_id: newTherapistId }).eq('id', b.id);
        if (error) throw error;
      }
      logActivity('transfer_bookings', `From therapist ID: ${transferTherapist.id}, Count: ${upcoming.length}`);
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      setTransferDialog(false);
      deleteTherapist.mutate(transferTherapist.id);
      setTransferTherapist(null);
      setTransferAssignments({});
    } catch (e: any) {
      toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' });
    } finally {
      setTransferSubmitting(false);
    }
  };


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

  const openProductEdit = (product?: any) => {
    setEditingProduct(product || null);
    setProductName(product?.name || '');
    setProductDesc(product?.description || '');
    setProductPrice(String(product?.price || 0));
    setProductImageFile(null);
    if (product?.image_path) {
      const { data } = supabase.storage.from('product-images').getPublicUrl(product.image_path);
      setProductImagePreview(data.publicUrl);
    } else {
      setProductImagePreview(null);
    }
    setProductDialog(true);
  };

  const openTherapistEdit = (therapist?: any) => {
    setEditingTherapist(therapist || null);
    setTherapistName(therapist?.name || '');
    setTherapistPhone(therapist?.phone || '');
    setTherapistEmail(therapist?.email || '');
    if (therapist) {
      const existing: any[] = therapist.therapist_weekly_hours || [];
      setTherapistWeeklyHours(DAYS_OF_WEEK.map(d => {
        const row = existing.find(r => r.day_of_week === d.value);
        return row
          ? { day_of_week: d.value, is_working: row.is_working, start_minute: row.start_minute, end_minute: row.end_minute, break_start_minute: row.break_start_minute, break_end_minute: row.break_end_minute }
          : { day_of_week: d.value, is_working: false, start_minute: 9 * 60, end_minute: 18 * 60, break_start_minute: null, break_end_minute: null };
      }));
    } else {
      setTherapistWeeklyHours(defaultWeeklyHours());
    }
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
    if (!bookingDate || bookingServiceIds.length === 0) return [];
    const selectedServices = bookingServiceIds
      .map(id => services?.find(s => s.id === id))
      .filter((s): s is NonNullable<typeof s> => !!s);
    if (selectedServices.length === 0) return [];
    const dateStr = format(bookingDate, 'yyyy-MM-dd');
    const duration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0);
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

    const dayBookings = (bookings || []).filter(b => b.booking_date === dateStr && b.status === 'confirmed' && b.id !== editingBookingId);

    const shopOpenHour = Number(openTime.split(':')[0]);
    const shopCloseHour = Number(closeTime.split(':')[0]);

    const allSlots: string[] = [];
    for (let h = shopOpenHour; h < shopCloseHour; h++) {
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

      if (endMins > (holiday?.early_close_hour || shopCloseHour) * 60) {
        result.push({ time: slot, available: false });
        continue;
      }

      // Find first available therapist for this slot
      let foundTherapist: { id: string; name: string } | null = null;
      for (const th of candidateTherapists) {
        if (unavailableTherapistIds.has(th.id)) continue;
        const dayOfWeek = bookingDate.getDay() === 0 ? 7 : bookingDate.getDay();
        const dayHours = getTherapistDayHours(th, dayOfWeek);
        if (!dayHours || !dayHours.is_working) continue;
        if (startMins < dayHours.start_minute || endMins > dayHours.end_minute) continue;
        if (dayHours.break_start_minute != null && dayHours.break_end_minute != null) {
          if (startMins < dayHours.break_end_minute && endMins > dayHours.break_start_minute) continue;
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

  // Single source of truth for the checkout panel's tip/discount/surcharge math —
  // computed once per render and shared by the tip picker, price breakdown, and
  // charge button so they can never disagree with each other or with createSale.
  const checkoutTotals = useMemo(() => {
    const addOnTotal = saleAddOns.reduce((sum, id) => sum + (services?.find(s => s.id === id)?.price || 0), 0);
    const productTotal = saleProductIds.reduce((sum, id) => sum + (products?.find(p => p.id === id)?.price || 0), 0);
    const base = computeBaseAmount([{ price: parseFloat(saleAmount || '0') }, { price: addOnTotal }, { price: productTotal }]);
    const { afterDiscount } = computeDiscountedSubtotal(base, saleCouponDiscount);
    const tipAmt = tipMethod ? computeTipAmount(tipMethod, tipMethod === 'percent' ? tipPercent : parseFloat(tipCustomAmount || '0'), afterDiscount) : 0;
    const totals = computeSaleTotals({
      baseAmount: base,
      coupon: saleCouponDiscount,
      surchargeRatePercent: parseFloat(cardSurchargeSetting || '0'),
      applySurcharge: salePaymentMethod === 'card',
      taxRatePercent: parseFloat(taxRateSetting || '0'),
      tipAmount: tipAmt,
    });
    // Recomputed live off the card's raw balance (not a snapshotted applied
    // amount) so it stays correct if tip/discount change after the card was
    // applied — the actual RPC call at charge time independently
    // re-validates the true balance server-side regardless.
    const giftCardSplit = appliedGiftCard
      ? applyGiftCardToTotal(totals.grandTotal, appliedGiftCard.balanceAtValidation)
      : { giftCardApplied: 0, remainingDue: totals.grandTotal };
    return { addOnTotal, productTotal, base, tipAmt, ...totals, ...giftCardSplit };
  }, [saleAddOns, services, saleAmount, saleProductIds, products, saleCouponDiscount, tipMethod, tipPercent, tipCustomAmount, cardSurchargeSetting, taxRateSetting, salePaymentMethod, appliedGiftCard]);

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
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
    <div className="min-h-screen bg-white flex items-center justify-center">
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
    { value: 'payment_history', icon: History, label: t('Lịch sử thanh toán') },
    { value: 'gift_cards', icon: Gift, label: t('Thẻ quà tặng') },
    { value: 'services', icon: Scissors, label: t('Dịch vụ') },
    { value: 'products', icon: ShoppingBag, label: t('Sản phẩm') },
    { value: 'therapists', icon: Users, label: t('Thợ') },
    ...(isAiLicensed && inboxEnabled ? [{ value: 'inbox', icon: MessageSquare, label: t('Hộp thư') }] : []),
  ];

  const adminContentNavItems = canAccessSettings
    ? [
        { value: 'pricing', icon: DollarSign, label: t('Bảng giá') },
        { value: 'locations', icon: Store, label: t('Chi nhánh') },
      ]
    : [];

  const sidebarNavItems = [
    ...filterVisibleTabs(allNavItems, isAdmin, employeeVisibleTabs),
    ...adminContentNavItems,
    ...(canAccessSettings ? [{ value: 'settings', icon: Settings, label: t('Cài đặt') }] : []),
  ];

  return (
    <div className="min-h-screen bg-white admin-shell">
      {showOnboarding && user?.id && (
        <AdminOnboarding userId={user.id} onComplete={() => setShowOnboarding(false)} />
      )}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Desktop Sidebar */}
        <aside className={cn(
          "hidden sm:flex fixed inset-y-0 left-0 z-40 flex-col bg-white border-r border-[#E5E5E5] transition-all duration-300 ease-in-out",
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
          <div className={cn("border-b border-[#E5E5E5]", sidebarOpen ? "px-3 py-4 flex items-center justify-between" : "px-2 py-4 flex flex-col items-center gap-2")}>
            <Link to="/" className={cn("flex items-center overflow-hidden", sidebarOpen ? "gap-2.5" : "justify-center")}>
              <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-amber-700 to-yellow-800 flex items-center justify-center">
                <Leaf className="h-4 w-4 text-white" />
              </div>
              {sidebarOpen && <span className="font-semibold text-[15px] text-[#1B1B1B] tracking-tight whitespace-nowrap truncate uppercase">{spaName}</span>}
            </Link>
            {isStaff && <NotificationBell />}
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
              <>
                <div className="mt-3 flex items-center gap-2">
                  <LanguageSwitcher />
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600 text-[11px] gap-1 h-7 px-2" onClick={signOut}>
                    <LogOut className="h-3 w-3" /> {t('Đăng xuất')}
                  </Button>
                </div>
                <a
                  href="https://forms.gle/YdkQ6yPZDGvuV9E58"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center gap-1 text-gray-400 hover:text-gray-600 text-[11px] px-2"
                >
                  <Bug className="h-3 w-3" /> {t('Báo lỗi')}
                </a>
              </>
            ) : (
              <>
                <Button variant="ghost" size="icon" className="mt-2 h-7 w-7 text-gray-400 hover:text-gray-600" onClick={signOut}>
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
                <a
                  href="https://forms.gle/YdkQ6yPZDGvuV9E58"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center justify-center h-7 w-7 text-gray-400 hover:text-gray-600"
                  title={t('Báo lỗi')}
                >
                  <Bug className="h-3.5 w-3.5" />
                </a>
              </>
            )}
          </div>
        </aside>

        {/* Mobile top header — minimal, just brand + hamburger */}
        <header className="sm:hidden sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#E5E5E5]/60">
          <div className="px-4 py-2.5 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-700 to-yellow-800 flex items-center justify-center">
                <Leaf className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-semibold text-[13px] text-[#1B1B1B] tracking-tight">{spaName}</span>
            </Link>
            <div className="flex items-center gap-1">
              {isStaff && <NotificationBell />}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-[#737373] hover:bg-[#F0F0F0] transition-colors"
                aria-label="Menu"
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </header>

        {/* Mobile slide-down menu overlay */}
        {mobileMenuOpen && (
          <div className="sm:hidden fixed inset-0 z-[60]" onClick={() => setMobileMenuOpen(false)}>
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
            <div
              className="absolute top-0 left-0 right-0 bg-white shadow-xl rounded-b-2xl overflow-hidden animate-[slideDown_0.2s_ease-out]"
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
                <a
                  href="https://forms.gle/YdkQ6yPZDGvuV9E58"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-gray-500 hover:bg-[#F5F5F5] hover:text-[#1B1B1B] transition-colors"
                >
                  <Bug className="h-4 w-4" />
                  {t('Báo lỗi')}
                </a>
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
          const primaryTabs = filterVisibleTabs([
            { value: 'stats', icon: BarChart3, label: t('Thống kê') },
            { value: 'bookings', icon: CalendarDays, label: t('Lịch hẹn') },
            { value: 'customers', icon: UserCheck, label: t('Khách') },
            { value: 'services', icon: Scissors, label: t('Dịch vụ') },
          ], isAdmin, employeeVisibleTabs);
          const moreTabs = filterVisibleTabs([
            { value: 'sales', icon: DollarSign, label: t('Thanh toán') },
            { value: 'payment_history', icon: History, label: t('Lịch sử thanh toán') },
            { value: 'therapists', icon: Users, label: t('Thợ') },
            ...(canAccessSettings ? [{ value: 'settings', icon: Settings, label: t('Cài đặt') }] : []),
          ], isAdmin, employeeVisibleTabs, ['settings']);
          const isMoreActive = moreTabs.some(t => t.value === activeTab);

          return (
            <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden safe-bottom">
              <div className="bg-white/80 backdrop-blur-xl border-t border-[#E5E5E5]/50">
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
                    className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl animate-[sheetUp_0.25s_ease-out]"
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
                        <DialogTitle className="text-[#1B1B1B]">{editingBookingId ? t('Sửa lịch hẹn') : t('Tạo lịch hẹn mới')}</DialogTitle>
                        <DialogDescription className="text-muted-foreground/60">{t('Điền thông tin để tạo lịch hẹn cho khách hàng')}</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1 pt-1">
                        {/* Service & Therapist */}
                        <div className="space-y-4">
                          <div>
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              {t('Dịch vụ')} {bookingServiceIds.length > 0 && <span className="text-muted-foreground/60">({bookingServiceIds.length})</span>}
                            </Label>
                            <div className="mt-1.5 max-h-[220px] overflow-y-auto rounded-md border border-[#E5E5E5]/60 bg-[#F5F5F5] divide-y divide-[#E5E5E5]/40">
                              {services?.filter(s => s.is_active).map(s => {
                                const isSelected = bookingServiceIds.includes(s.id);
                                return (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => setBookingServiceIds(prev =>
                                      isSelected ? prev.filter(id => id !== s.id) : [...prev, s.id]
                                    )}
                                    className={cn(
                                      "w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                                      isSelected ? "bg-[#006AFF]/10" : "hover:bg-white/60"
                                    )}
                                  >
                                    <div className={cn(
                                      "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                                      isSelected ? "border-[#006AFF] bg-[#006AFF]" : "border-[#D4D4D4]"
                                    )}>
                                      {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                                    </div>
                                    <span className="flex-1 truncate">{s.name}</span>
                                    <span className="text-xs text-muted-foreground shrink-0">{s.duration_minutes} {t('phút')} — {formatPrice(s.price)}</span>
                                  </button>
                                );
                              })}
                            </div>
                            {bookingServiceIds.length > 0 && (
                              <div className="flex items-center justify-between mt-1.5 px-1 text-xs">
                                <span className="text-muted-foreground">{t('Tổng cộng')}</span>
                                <span className="font-semibold text-[#1B1B1B]">{formatPrice(bookingServiceIds.reduce((sum, id) => sum + (services?.find(s => s.id === id)?.price || 0), 0))}</span>
                              </div>
                            )}
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
                            {bookingServiceIds.length === 0 || !bookingDate ? (
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

                        <Button className="w-full h-10 bg-[#006AFF] hover:bg-[#1B1B1B] text-white" onClick={() => editingBookingId ? updateBooking.mutate() : createBooking.mutate()}
                          disabled={bookingServiceIds.length === 0 || !bookingTherapistId || !bookingDate || !bookingTime || !bookingCustomerName.trim() || !bookingCustomerPhone.trim() || createBooking.isPending || updateBooking.isPending}>
                          {createBooking.isPending || updateBooking.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang lưu...')}</> : editingBookingId ? t('Lưu thay đổi') : t('Tạo lịch hẹn')}
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
                  holidays={(shopHolidays as any) || []}
                  openTime={openTime}
                  closeTime={closeTime}
                  openDays={openDays}
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
                  onEdit={(booking: any) => {
                    setEditingBookingId(booking.id);
                    const svcIds: string[] = booking.booking_services?.length
                      ? booking.booking_services.map((bs: any) => bs.service_id).filter((id: string | null): id is string => !!id)
                      : [];
                    setBookingServiceIds(svcIds.length > 0 ? svcIds : [booking.service_id]);
                    setBookingTherapistId(booking.therapist_id);
                    setBookingDate(new Date(booking.booking_date + 'T00:00:00'));
                    setBookingTime(booking.start_time.slice(0, 5));
                    setBookingCustomerName(booking.customer_name);
                    setBookingCustomerPhone(booking.customer_phone);
                    setBookingCustomerEmail(booking.customer_email || '');
                    setBookingNotes(booking.notes || '');
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
                    <button type="button" onClick={() => setPosTab('products')} className={cn('px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors', posTab === 'products' ? 'border-[#006AFF] text-[#006AFF]' : 'border-transparent text-muted-foreground hover:text-foreground')}>{t('Sản phẩm')}</button>
                    <div className="ml-auto pr-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSaleBookingId('');
                          setSaleServiceId('');
                          setSaleCustomerName('');
                          setSaleCustomerPhone('');
                          setSaleAmount('');
                          setSaleAddOns([]);
                          setSaleProductIds([]);
                          setSaleCouponCode('');
                          setSaleCouponDiscount(null);
                          setSaleCouponError('');
                          setSaleNotes('');
                          setSaleType('walkin');
                          setPosTab('library');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#006AFF] text-white hover:bg-[#006AFF]/90 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t('Thanh toán mới')}
                      </button>
                    </div>
                  </div>

                  {/* Search */}
                  <div className="px-4 py-3 border-b border-[#E5E5E5]/20">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                      <Input
                        value={posTab === 'appointments' ? saleBookingSearch : posTab === 'products' ? saleProductSearch : saleServiceSearch}
                        onChange={e => posTab === 'appointments' ? setSaleBookingSearch(e.target.value) : posTab === 'products' ? setSaleProductSearch(e.target.value) : setSaleServiceSearch(e.target.value)}
                        className="pl-10 h-10 bg-[#F5F5F5] border-0 focus-visible:ring-1"
                        placeholder={posTab === 'appointments' ? t('Tìm theo tên, dịch vụ...') : posTab === 'products' ? t('Tìm sản phẩm...') : t('Tìm dịch vụ...')}
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
                                    // A booking may carry extra services added after creation (booking_services),
                                    // not just the single primary service_id — charge for all of them at checkout.
                                    const bs: any[] = (b as any).booking_services || [];
                                    const primaryServiceId = (b as any).service_id || bs.find(s => s.service_id)?.service_id || '';
                                    const addOnServiceIds = bs.map(s => s.service_id).filter((id: string | null) => !!id && id !== primaryServiceId);
                                    const primaryPrice = services?.find(sv => sv.id === primaryServiceId)?.price ?? (b as any).services?.price ?? 0;
                                    setSaleType('booking');
                                    setSaleBookingId(b.id);
                                    setSaleAmount(String(primaryPrice));
                                    setSaleAddOns(addOnServiceIds);
                                    setSaleCustomerPhone(b.customer_phone || '');
                                    setSaleCustomerName(b.customer_name || '');
                                    setSaleServiceId(primaryServiceId);
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
                    ) : posTab === 'products' ? (
                      /* Product library — always additive, no "primary" slot like services */
                      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(products || []).filter(p => p.is_active).filter(p => !saleProductSearch.trim() || p.name.toLowerCase().includes(saleProductSearch.toLowerCase())).map(p => {
                          const isSelected = saleProductIds.includes(p.id);
                          const imgUrl = p.image_path ? supabase.storage.from('product-images').getPublicUrl(p.image_path).data.publicUrl : null;
                          return (
                            <button type="button" key={p.id} className={cn('flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all active:scale-[0.98]', isSelected ? 'border-[#006AFF] bg-[#006AFF]/5' : 'border-border/50 hover:border-border hover:bg-muted/30')} onClick={() => {
                              if (!saleServiceId) setSaleType('walkin');
                              setSaleProductIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                            }}>
                              {imgUrl ? (
                                <div className="relative h-11 w-11 rounded-lg overflow-hidden shrink-0">
                                  <img src={imgUrl} alt={p.name} className="h-full w-full object-cover" />
                                  {isSelected && <div className="absolute inset-0 bg-[#006AFF]/30 flex items-center justify-center"><Check className="h-4 w-4 text-white" /></div>}
                                </div>
                              ) : (
                                <div className={cn('flex items-center justify-center h-11 w-11 rounded-lg shrink-0', isSelected ? 'bg-[#006AFF]/10' : 'bg-muted')}>
                                  {isSelected ? <Check className="h-4 w-4 text-[#006AFF]" /> : <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{p.name}</p>
                              </div>
                              <span className="text-sm font-semibold tabular-nums shrink-0">{formatPrice(p.price)}</span>
                            </button>
                          );
                        })}
                        {!products?.some(p => p.is_active) && (
                          <div className="col-span-full text-center py-16 text-muted-foreground/40">
                            <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-40" />
                            <p className="text-sm">{t('Chưa có sản phẩm')}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Service library */
                      <div>
                      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {visibleServices.map(s => {
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
                      {hasMoreServices && <div ref={serviceSentinelRef} className="py-4 text-center text-xs text-muted-foreground/50"><Loader2 className="h-4 w-4 animate-spin inline mr-1.5" />{t('Đang tải thêm...')}</div>}
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT PANEL — Current Sale */}
                <div className="flex flex-col bg-white">
                  {/* Cart header */}
                  <div className="px-5 py-3.5 border-b border-[#E5E5E5]/40 flex items-center justify-between">
                    <h3 className="text-base font-semibold">{t('Thanh toán hiện tại')} {(saleServiceId || saleAddOns.length > 0 || saleProductIds.length > 0) ? <span className="text-muted-foreground font-normal">({(saleServiceId ? 1 : 0) + saleAddOns.length + saleProductIds.length})</span> : ''}</h3>
                    {(saleServiceId || saleBookingId || saleProductIds.length > 0) && (
                      <button type="button" className="text-xs text-destructive hover:text-destructive/80 font-medium transition-colors" onClick={() => { setSaleBookingId(''); setSaleServiceId(''); setSaleCustomerName(''); setSaleCustomerPhone(''); setSaleAmount(''); setSaleAddOns([]); setSaleProductIds([]); setSaleCouponCode(''); setSaleCouponDiscount(null); setSaleCouponError(''); setSaleNotes(''); clearGiftCard(); }}>
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
                  {saleType === 'walkin' && (saleServiceId || saleProductIds.length > 0) && !saleCustomerName && (
                    <div className="px-5 py-3 border-b border-[#E5E5E5]/20 space-y-2">
                      <Input value={saleCustomerName} onChange={e => setSaleCustomerName(e.target.value)} className="h-9 text-sm" placeholder={t('Tên khách (tuỳ chọn)')} />
                      <Input value={saleCustomerPhone} onChange={e => setSaleCustomerPhone(e.target.value)} className="h-9 text-sm" placeholder="04xxxxxxxx" />
                    </div>
                  )}

                  {/* Staff who performed the service — needed for tip/commission attribution on walk-in sales */}
                  {saleType === 'walkin' && (saleServiceId || saleProductIds.length > 0) && (
                    <div className="px-5 py-3 border-b border-[#E5E5E5]/20">
                      <Select value={saleTherapistId} onValueChange={setSaleTherapistId}>
                        <SelectTrigger className="h-9 text-sm bg-[#F5F5F5] border-0"><SelectValue placeholder={t('Chọn thợ (tuỳ chọn)')} /></SelectTrigger>
                        <SelectContent>
                          {therapists?.filter(th => th.is_active).map(th => (
                            <SelectItem key={th.id} value={th.id}>{th.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Line items */}
                  <div className="flex-1 px-5 py-4 overflow-y-auto">
                    {(saleServiceId || saleProductIds.length > 0) ? (
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

                        {saleProductIds.map(id => {
                          const p = products?.find(pr => pr.id === id);
                          return p ? (
                            <div key={id} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <p className="text-sm">{p.name}</p>
                                <button type="button" className="text-muted-foreground/40 hover:text-destructive" onClick={() => setSaleProductIds(prev => prev.filter(a => a !== id))}><X className="h-3 w-3" /></button>
                              </div>
                              <span className="text-sm tabular-nums">{formatPrice(p.price)}</span>
                            </div>
                          ) : null;
                        })}

                        {/* Add another service before charging — surfaces the flow for adding
                            on-the-spot add-ons to a booking (e.g. customer wants an extra
                            treatment) without requiring staff to already know the Library tab exists. */}
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-xs font-medium text-[#006AFF] hover:text-[#006AFF]/80 transition-colors"
                          onClick={() => setPosTab('library')}
                        >
                          <Plus className="h-3.5 w-3.5" /> {t('Thêm dịch vụ')}
                        </button>

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
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground/30">
                        <DollarSign className="h-10 w-10 mb-2" />
                        <p className="text-sm">{t('Chọn lịch hẹn hoặc dịch vụ')}</p>
                      </div>
                    )}
                  </div>

                  {/* Footer — Payment method + Charge */}
                  {(saleServiceId || saleProductIds.length > 0) && (
                    <div className="border-t border-[#E5E5E5]/40 px-5 py-4 space-y-3">
                      {/* Notes */}
                      <Input value={saleNotes} onChange={e => setSaleNotes(e.target.value)} className="h-9 text-sm bg-[#F5F5F5] border-0" placeholder={t('Ghi chú...')} />

                      {/* Payment method pills */}
                      <div className="flex gap-2">
                        <button type="button" className={cn('flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all', salePaymentMethod === 'cash' ? 'bg-[#006AFF] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80')} onClick={() => setSalePaymentMethod('cash')}>
                          <DollarSign className="h-3.5 w-3.5" /> {t('Tiền mặt')}
                        </button>
                        <button type="button" className={cn('flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all', salePaymentMethod === 'card' ? 'bg-[#006AFF] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80')} onClick={() => setSalePaymentMethod('card')}>
                          <CreditCard className="h-3.5 w-3.5" /> {t('Thẻ')}
                        </button>
                        {/* Square checkout is temporarily disabled at the POS — the in-browser
                            card form charges the pre-tip/pre-discount base amount while the
                            sale record now includes tips, and the Terminal's own tip prompt can
                            double-charge on top of a tip already collected here. Re-enable once
                            both integrations send/reconcile the real totals.amount. */}
                      </div>

                      {/* Gift card — layers on top of the selected tender above, not a tender itself */}
                      {appliedGiftCard ? (
                        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-purple-50 border border-purple-200/60 text-xs">
                          <div className="min-w-0">
                            <p className="font-medium text-purple-700 font-mono truncate">{appliedGiftCard.code}</p>
                            <p className="text-purple-600/80">
                              -{formatPrice(checkoutTotals.giftCardApplied)} {t('đã áp dụng')} · {formatPrice(appliedGiftCard.balanceAtValidation - checkoutTotals.giftCardApplied)} {t('còn lại')}
                            </p>
                          </div>
                          <button type="button" className="p-1 text-purple-500/60 hover:text-destructive shrink-0" onClick={clearGiftCard}><X className="h-3.5 w-3.5" /></button>
                        </div>
                      ) : (
                        <div>
                          <div className="flex gap-2">
                            <Input
                              value={giftCardCodeInput}
                              onChange={e => { setGiftCardCodeInput(e.target.value.toUpperCase()); setGiftCardError(''); }}
                              className="flex-1 h-9 text-sm font-mono bg-[#F5F5F5] border-0"
                              placeholder={t('Mã thẻ quà tặng')}
                            />
                            <Button type="button" variant="outline" size="sm" className="h-9 px-3" onClick={checkGiftCard} disabled={!giftCardCodeInput.trim() || giftCardValidating}>
                              {giftCardValidating ? <Loader2 className="h-3 w-3 animate-spin" /> : t('Áp dụng')}
                            </Button>
                          </div>
                          {giftCardError && <p className="text-xs text-destructive mt-1">{giftCardError}</p>}
                        </div>
                      )}

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
                          disabled={checkoutTotals.base <= 0}
                          labels={{ pay: t('Thanh toán'), cancel: t('Hủy'), loading: t('Đang tải form thanh toán...'), processing: t('Đang xử lý...'), enterCard: t('Nhập thông tin thẻ'), tapToPay: t('Thẻ, Apple Pay & Google Pay') }}
                        />
                      )}

                      {/* Tip picker */}
                      {checkoutTotals.base > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Tiền tip')}</p>
                          <div className="flex gap-1.5">
                            <button type="button" className={cn('flex-1 py-2 rounded-lg text-xs font-medium transition-all', tipMethod === null ? 'bg-[#006AFF] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80')} onClick={() => { setTipMethod(null); }}>
                              {t('Không tip')}
                            </button>
                            {[10, 15, 20].map(pct => (
                              <button key={pct} type="button" className={cn('flex-1 py-2 rounded-lg text-xs font-medium transition-all', tipMethod === 'percent' && tipPercent === pct ? 'bg-[#006AFF] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80')} onClick={() => { setTipMethod('percent'); setTipPercent(pct); }}>
                                {pct}%
                              </button>
                            ))}
                            <button type="button" className={cn('flex-1 py-2 rounded-lg text-xs font-medium transition-all', tipMethod === 'custom' ? 'bg-[#006AFF] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80')} onClick={() => setTipMethod('custom')}>
                              {t('Khác')}
                            </button>
                          </div>
                          {tipMethod === 'percent' && (
                            <p className="text-xs text-muted-foreground">{tipPercent}% = {formatPrice(computeTipAmount('percent', tipPercent, checkoutTotals.afterDiscount))}</p>
                          )}
                          {tipMethod === 'custom' && (
                            <Input type="number" min="0" step="0.5" value={tipCustomAmount} onChange={e => setTipCustomAmount(e.target.value)} className="h-9 text-sm bg-[#F5F5F5] border-0" placeholder={t('Số tiền tip')} />
                          )}
                        </div>
                      )}

                      {/* Price breakdown */}
                      {checkoutTotals.base > 0 && (
                        <div className="text-sm space-y-1">
                          {checkoutTotals.addOnTotal > 0 && <div className="flex justify-between text-muted-foreground"><span>{t('Dịch vụ chính')}</span><span>{formatPrice(parseFloat(saleAmount || '0'))}</span></div>}
                          {checkoutTotals.addOnTotal > 0 && <div className="flex justify-between text-muted-foreground"><span>{t('Dịch vụ thêm')}</span><span>+{formatPrice(checkoutTotals.addOnTotal)}</span></div>}
                          {checkoutTotals.productTotal > 0 && <div className="flex justify-between text-muted-foreground"><span>{t('Sản phẩm')}</span><span>+{formatPrice(checkoutTotals.productTotal)}</span></div>}
                          {checkoutTotals.discountAmt > 0 && <div className="flex justify-between text-green-700"><span>{t('Giảm giá')}</span><span>-{formatPrice(checkoutTotals.discountAmt)}</span></div>}
                          {checkoutTotals.surchargeAmt > 0 && <div className="flex justify-between text-muted-foreground"><span>{t('Phụ phí thẻ')} ({cardSurchargeSetting}%)</span><span>{formatPrice(checkoutTotals.surchargeAmt)}</span></div>}
                          {checkoutTotals.taxAmt > 0 && <div className="flex justify-between text-muted-foreground"><span>{resolveTaxLabel(taxType, taxTypeCustomLabel)} ({taxRateSetting}%)</span><span>{formatPrice(checkoutTotals.taxAmt)}</span></div>}
                          {checkoutTotals.tipAmt > 0 && <div className="flex justify-between text-muted-foreground"><span>{t('Tiền tip')}</span><span>+{formatPrice(checkoutTotals.tipAmt)}</span></div>}
                          {checkoutTotals.giftCardApplied > 0 && <div className="flex justify-between text-purple-700"><span>{t('Thẻ quà tặng')}</span><span>-{formatPrice(checkoutTotals.giftCardApplied)}</span></div>}
                        </div>
                      )}

                      {/* Charge button — shows what's actually owed via the selected
                          cash/card tender once a gift card covers part of the total;
                          the full grand total is still what gets recorded/charged. */}
                      <Button
                        className="w-full h-14 text-lg font-semibold bg-[#006AFF] hover:bg-[#0055CC] rounded-xl"
                        onClick={() => createSale.mutate()}
                        disabled={checkoutTotals.base <= 0 || createSale.isPending || (salePaymentMethod === 'square' && showSquareCardForm)}
                      >
                        {createSale.isPending ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />{t('Đang xử lý...')}</> : <>{t('Thanh toán')} {checkoutTotals.grandTotal > 0 ? formatPrice(checkoutTotals.remainingDue) : ''}</>}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Payment History Tab */}
          <TabsContent value="payment_history">
            <div className="space-y-6">
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
                        const customerName = s.customer_name || s.bookings?.customer_name || t('Khách vãng lai');
                        const customerPhone = s.customer_phone || s.bookings?.customer_phone || '';
                        return (
                          <div key={s.id} className="bg-white rounded-xl border border-[#E5E5E5]/40 p-4 space-y-2.5 transition-colors hover:border-[#CCCCCC] cursor-pointer" onClick={() => setSelectedSaleDetail(s)}>
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-[15px] font-semibold text-[#1B1B1B]">{formatPrice(Number(s.amount))}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{s.sale_date}</p>
                              </div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide ${paymentMethodBadgeClass(s)}`}>
                                {paymentMethodLabel(s)}
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
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/40" onClick={(e) => e.stopPropagation()}>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuItem onClick={() => printReceipt({
                                      amount: Number(s.amount),
                                      customerName: s.customer_name || s.bookings?.customer_name || '',
                                      customerPhone: s.customer_phone || s.bookings?.customer_phone || '',
                                      serviceName: s.bookings?.services?.name || '',
                                      addOns: [],
                                      products: (s.sale_items || []).filter((i: any) => i.item_type === 'product').map((i: any) => ({ name: i.service_name, price: Number(i.price) })),
                                      paymentMethod: s.payment_method,
                                      discount: 0,
                                      surcharge: 0,
                                      tax: Number(s.tax_amount || 0),
                                      taxRatePercent: Number(s.tax_rate_percent || 0),
                                      taxLabel: s.tax_label,
                                      tip: Number(s.tip_amount || 0),
                                      coupon: undefined,
                                      giftCardCode: s.gift_card_code || undefined,
                                      giftCardApplied: Number(s.gift_card_amount || 0) || undefined,
                                      date: s.sale_date,
                                    })}>
                                      <Printer className="h-3.5 w-3.5 mr-2" /> {t('In lại hoá đơn')}
                                    </DropdownMenuItem>
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
                      <div className="grid grid-cols-[1fr_auto_auto_44px] gap-4 px-5 py-3 text-[11px] font-medium tracking-wider uppercase text-muted-foreground/60 border-b border-[#E5E5E5]/30 bg-[#F5F5F5]/50">
                        <span>{t('Khách hàng')}</span>
                        <span className="text-right w-24">{t('Số tiền')}</span>
                        <span className="text-center w-20">{t('Phương thức')}</span>
                        <span></span>
                      </div>

                      {/* Rows */}
                      <div className="space-y-1">
                        {visibleSales.map((s: any) => {
                          const customerName = s.customer_name || s.bookings?.customer_name || t('Khách vãng lai');
                          const customerPhone = s.customer_phone || s.bookings?.customer_phone || '';
                          return (
                            <div
                              key={s.id}
                              className="group grid grid-cols-[1fr_auto_auto_44px] gap-4 items-center px-5 py-3.5 rounded-xl transition-colors hover:bg-[#F5F5F5]/60 cursor-pointer"
                              onClick={() => setSelectedSaleDetail(s)}
                            >
                              {/* Customer + phone stacked */}
                              <div className="min-w-0">
                                <p className="text-[13px] font-medium text-[#1B1B1B] truncate">{customerName}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {customerPhone && <span className="text-[11px] text-muted-foreground/60 font-mono">{customerPhone}</span>}
                                  <span className="text-[11px] text-muted-foreground/40">{s.sale_date}</span>
                                </div>
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
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium tracking-wide ${paymentMethodBadgeClass(s)}`}>
                                    {paymentMethodLabel(s)}
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
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-36" onClick={(e) => e.stopPropagation()}>
                                      <DropdownMenuItem className="text-xs" onClick={() => printReceipt({
                                        amount: Number(s.amount),
                                        customerName: s.customer_name || s.bookings?.customer_name || '',
                                        customerPhone: s.customer_phone || s.bookings?.customer_phone || '',
                                        serviceName: s.bookings?.services?.name || '',
                                        addOns: [],
                                        products: (s.sale_items || []).filter((i: any) => i.item_type === 'product').map((i: any) => ({ name: i.service_name, price: Number(i.price) })),
                                        paymentMethod: s.payment_method,
                                        discount: 0,
                                        surcharge: 0,
                                        tax: Number(s.tax_amount || 0),
                                        taxRatePercent: Number(s.tax_rate_percent || 0),
                                        taxLabel: s.tax_label,
                                        tip: Number(s.tip_amount || 0),
                                        coupon: undefined,
                                        giftCardCode: s.gift_card_code || undefined,
                                        giftCardApplied: Number(s.gift_card_amount || 0) || undefined,
                                        date: s.sale_date,
                                      })}>
                                        <Printer className="h-3.5 w-3.5 mr-2" /> {t('In lại hoá đơn')}
                                      </DropdownMenuItem>
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

          {/* Payment Detail Dialog */}
          <Dialog open={!!selectedSaleDetail} onOpenChange={(open) => !open && setSelectedSaleDetail(null)}>
            <DialogContent className="max-w-md">
              {selectedSaleDetail && (() => {
                const s = selectedSaleDetail;
                const customerName = s.customer_name || s.bookings?.customer_name || t('Khách vãng lai');
                const customerPhone = s.customer_phone || s.bookings?.customer_phone || '';
                const items: { service_name: string; price: number; is_addon: boolean }[] = s.sale_items?.length
                  ? s.sale_items
                  : [{ service_name: s.bookings?.services?.name || '—', price: Number(s.amount), is_addon: false }];
                return (
                  <>
                    <DialogHeader>
                      <DialogTitle>{t('Chi tiết thanh toán')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium">{customerName}</p>
                          {customerPhone && <p className="text-xs text-muted-foreground font-mono mt-0.5">{customerPhone}</p>}
                        </div>
                        <span className="text-lg font-semibold tabular-nums">{formatPrice(Number(s.amount))}</span>
                      </div>

                      {/* Services table */}
                      <div className="rounded-lg border border-border/50 overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="h-8 text-xs">{t('Dịch vụ')}</TableHead>
                              <TableHead className="h-8 text-xs text-right">{t('Số tiền')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((item, i) => (
                              <TableRow key={i}>
                                <TableCell className="py-2 text-sm font-medium">{item.service_name}</TableCell>
                                <TableCell className="py-2 text-sm text-right tabular-nums">{formatPrice(Number(item.price))}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {Number(s.tax_amount || 0) > 0 && (
                        <div className="flex items-center justify-between text-sm px-1">
                          <span className="text-muted-foreground">{s.tax_label || 'GST'} ({Number(s.tax_rate_percent || 0)}%)</span>
                          <span className="font-medium">{formatPrice(Number(s.tax_amount))}</span>
                        </div>
                      )}
                      {Number(s.tip_amount || 0) > 0 && (
                        <div className="flex items-center justify-between text-sm px-1">
                          <span className="text-muted-foreground">{t('Tiền tip')}</span>
                          <span className="font-medium">{formatPrice(Number(s.tip_amount))}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">{t('Ngày')}</p>
                          <p className="font-medium mt-0.5">{s.sale_date}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t('Phương thức')}</p>
                          <p className="font-medium mt-0.5">{paymentMethodLabel(s)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t('Trạng thái')}</p>
                          <p className="font-medium mt-0.5">{s.is_refunded ? t('Đã hoàn tiền') : t('Đã thanh toán')}</p>
                        </div>
                      </div>
                      {(s.therapists?.name || s.therapist_name) && (
                        <div>
                          <p className="text-xs text-muted-foreground">{t('Thợ')}</p>
                          <p className="text-sm font-medium mt-0.5">{s.therapists?.name || s.therapist_name}</p>
                        </div>
                      )}
                      {s.notes && (
                        <div>
                          <p className="text-xs text-muted-foreground">{t('Ghi chú')}</p>
                          <p className="text-sm mt-0.5">{s.notes}</p>
                        </div>
                      )}
                      {isAdmin && (
                        <div className="flex gap-2 pt-2 border-t border-border/40">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => printReceipt({
                              amount: Number(s.amount),
                              customerName: s.customer_name || s.bookings?.customer_name || '',
                              customerPhone: s.customer_phone || s.bookings?.customer_phone || '',
                              serviceName: s.bookings?.services?.name || '',
                              addOns: [],
                              products: (s.sale_items || []).filter((i: any) => i.item_type === 'product').map((i: any) => ({ name: i.service_name, price: Number(i.price) })),
                              paymentMethod: s.payment_method,
                              discount: 0,
                              surcharge: 0,
                              tax: Number(s.tax_amount || 0),
                              taxRatePercent: Number(s.tax_rate_percent || 0),
                              taxLabel: s.tax_label,
                              tip: Number(s.tip_amount || 0),
                              coupon: undefined,
                              giftCardCode: s.gift_card_code || undefined,
                              giftCardApplied: Number(s.gift_card_amount || 0) || undefined,
                              date: s.sale_date,
                            })}
                          >
                            <Printer className="h-3.5 w-3.5 mr-1.5" /> {t('In lại hoá đơn')}
                          </Button>
                          {!s.is_refunded && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 text-amber-600 hover:text-amber-600"
                              onClick={() => { setSelectedSaleDetail(null); openConfirm(t('Hoàn tiền'), t('Xác nhận đánh dấu hoàn tiền?'), () => refundSale.mutate(s.id)); }}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> {t('Hoàn tiền')}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-destructive hover:text-destructive"
                            onClick={() => { setSelectedSaleDetail(null); openConfirm(t('Xoá thanh toán'), t('Bạn có chắc muốn xoá thanh toán này?'), () => deleteSale.mutate(s.id)); }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> {t('Xóa')}
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </DialogContent>
          </Dialog>

          {/* Gift Cards & Discount Codes Tab */}
          <TabsContent value="gift_cards">
            <Tabs value={giftCardsSubTab} onValueChange={(v) => setGiftCardsSubTab(v as 'gift_cards' | 'discount_codes')}>
              <TabsList>
                <TabsTrigger value="gift_cards"><Gift className="h-3.5 w-3.5 mr-1.5" /> {t('Thẻ quà tặng')}</TabsTrigger>
                <TabsTrigger value="discount_codes"><Tag className="h-3.5 w-3.5 mr-1.5" /> {t('Mã giảm giá')}</TabsTrigger>
              </TabsList>
              <TabsContent value="gift_cards" className="pt-4">
                <GiftCardsPanel />
              </TabsContent>
              <TabsContent value="discount_codes" className="pt-4">
                <DiscountCodesPanel />
              </TabsContent>
            </Tabs>
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

          {/* Products Tab */}
          <TabsContent value="products">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[#1B1B1B] tracking-tight">{t('Quản lý sản phẩm')}</h2>
                  <p className="text-sm text-muted-foreground/70 mt-0.5">{products?.length || 0} {t('sản phẩm')}</p>
                </div>
                <Dialog open={productDialog} onOpenChange={setProductDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full sm:w-auto h-9 px-4" onClick={() => openProductEdit()}><Plus className="h-4 w-4 mr-1.5" /> {t('Thêm sản phẩm')}</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                      <DialogTitle className="text-[#1B1B1B]">{editingProduct ? t('Sửa sản phẩm') : t('Thêm sản phẩm')}</DialogTitle>
                      <DialogDescription className="text-muted-foreground/60">{editingProduct ? t('Chỉnh sửa thông tin sản phẩm') : t('Thêm sản phẩm mới vào hệ thống')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 pt-1">
                      <div className="space-y-4">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Tên')}</Label>
                          <Input value={productName} onChange={e => setProductName(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60 focus:border-[#737373] focus:ring-[#737373]/20" placeholder={t('Tên sản phẩm')} />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Mô tả')}</Label>
                          <Textarea value={productDesc} onChange={e => setProductDesc(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60 focus:border-[#737373] focus:ring-[#737373]/20 min-h-[80px]" placeholder={t('Mô tả ngắn về sản phẩm...')} />
                        </div>
                      </div>
                      <div className="border-t border-[#E5E5E5]/30 pt-4">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Giá (AUD)')}</Label>
                        <Input type="number" value={productPrice} onChange={e => setProductPrice(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60 focus:border-[#737373] focus:ring-[#737373]/20" />
                      </div>
                      <div className="border-t border-[#E5E5E5]/30 pt-4">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Hình ảnh')}</Label>
                        <div className="mt-2 space-y-2">
                          {productImagePreview && (
                            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-[#E5E5E5]/60 shadow-sm">
                              <img src={productImagePreview} alt="Preview" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => { setProductImageFile(null); setProductImagePreview(null); }}
                                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center text-xs hover:bg-black/60 transition-colors"
                              >×</button>
                            </div>
                          )}
                          <input
                            ref={productImageRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async e => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const resized = await resizeImage(file);
                                setProductImageFile(resized);
                                setProductImagePreview(URL.createObjectURL(resized));
                              }
                            }}
                          />
                          <Button type="button" variant="outline" size="sm" className="border-[#E5E5E5]/60 hover:bg-[#F5F5F5]" onClick={() => productImageRef.current?.click()}>
                            <Image className="h-3.5 w-3.5 mr-1.5" />
                            {productImagePreview ? t('Đổi ảnh') : t('Chọn ảnh')}
                          </Button>
                        </div>
                      </div>
                      <Button className="w-full h-10 bg-[#006AFF] hover:bg-[#1B1B1B] text-white" onClick={() => saveProduct.mutate()} disabled={!productName.trim() || saveProduct.isPending}>
                        {saveProduct.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang lưu...')}</> : (editingProduct ? t('Cập nhật') : t('Thêm mới'))}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Product list */}
              {!products?.length ? (
                <div className="text-center py-20 text-muted-foreground">
                  <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-15" />
                  <p className="text-sm font-medium">{t('Chưa có sản phẩm')}</p>
                </div>
              ) : (
                <div className="rounded-xl border border-[#E5E5E5]/50 bg-white overflow-hidden divide-y divide-[#E5E5E5]/20">
                  {products.map(p => (
                    <div
                      key={p.id}
                      className="group flex items-center justify-between px-5 py-4 transition-colors hover:bg-[#F5F5F5]/40"
                    >
                      {/* Left: name + details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5">
                          <p className="text-[14px] font-medium text-[#1B1B1B] truncate">{p.name}</p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            p.is_active
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-gray-100 text-gray-400'
                          }`}>
                            {p.is_active ? t('Hoạt động') : t('Tắt')}
                          </span>
                        </div>
                        <p className="text-[12px] text-muted-foreground/60 mt-0.5">
                          {formatPrice(p.price)}
                        </p>
                      </div>

                      {/* Right: actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:text-[#1B1B1B]" onClick={() => openProductEdit(p)}>
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
                              <DropdownMenuItem className="text-destructive text-xs" onClick={() => openConfirm(t('Xoá sản phẩm'), t('Xoá sản phẩm này?'), () => deleteProduct.mutate(p.id))}>
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
                  <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
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
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t('Giờ làm việc theo ngày')}</p>
                        <WeeklyShiftEditor
                          value={therapistWeeklyHours}
                          onChange={setTherapistWeeklyHours}
                          dayLabels={DAYS_OF_WEEK.map(d => d.label)}
                          offLabel={t('Nghỉ')}
                          workingLabel={t('Làm việc')}
                          breakLabel={t('Nghỉ trưa')}
                          doneLabel={t('Xong')}
                        />
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
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[13px] font-semibold text-[#1B1B1B]">{t('Ngày nghỉ nhân viên')}</p>
                    <Button variant="outline" size="sm" className="h-9 text-sm rounded-full" onClick={() => { setUnavailTherapist('all'); setUnavailCalendarOpen(true); }}>
                      <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                      {t('Xem lịch')}
                    </Button>
                  </div>
                  {/* Staff day-off pills — one per staff, bounded by staff count regardless of how many days off exist */}
                  {therapists && unavailabilities && therapists.some(th => unavailabilities.filter((u: any) => u.therapist_id === th.id && u.unavailable_date >= format(new Date(), 'yyyy-MM-dd')).length > 0) ? (
                    <div className="flex flex-wrap gap-2">
                      {therapists.map(th => {
                        const todayStr = format(new Date(), 'yyyy-MM-dd');
                        const count = unavailabilities.filter((u: any) => u.therapist_id === th.id && u.unavailable_date >= todayStr).length;
                        if (!count) return null;
                        return (
                          <button
                            key={th.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F5F5F5] border border-[#E5E5E5]/60 text-xs text-[#737373] hover:bg-[#F5F5F5] transition-colors"
                            onClick={() => { setUnavailTherapist(th.id); setUnavailCalendarOpen(true); }}
                          >
                            <span className="font-medium">{th.name}</span>
                            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-[#F0F0F0] text-[10px] font-semibold text-[#1B1B1B]">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('Không có ngày nghỉ trong tháng này')}</p>
                  )}
                </div>

                {/* Staff days-off calendar dialog */}
                <Dialog open={unavailCalendarOpen} onOpenChange={(open) => { setUnavailCalendarOpen(open); if (!open) { setUnavailDate(undefined); setUnavailRangeMode(false); setUnavailRangeFrom(''); setUnavailRangeTo(''); } }}>
                  <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                    <DialogHeader>
                      <DialogTitle>{t('Ngày nghỉ nhân viên')}</DialogTitle>
                      <DialogDescription>{t('Chọn ngày trên lịch để thêm ngày nghỉ cho nhân viên')}</DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center justify-between gap-2">
                      <Select value={unavailTherapist} onValueChange={(v) => { setUnavailTherapist(v); setUnavailDate(undefined); }}>
                        <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm rounded-full bg-[#F5F5F5] border-[#E5E5E5]/50"><SelectValue placeholder={t('Chọn thợ')} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('Tất cả thợ')}</SelectItem>
                          {therapists?.map(th => <SelectItem key={th.id} value={th.id}>{th.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {unavailTherapist !== 'all' && (
                        <Button size="sm" variant={unavailRangeMode ? 'default' : 'outline'} className="h-9 rounded-full text-xs shrink-0" onClick={() => setUnavailRangeMode(v => !v)}>
                          {t('Chọn nhiều ngày')}
                        </Button>
                      )}
                    </div>
                    {unavailTherapist && unavailTherapist !== 'all' && unavailRangeMode && (
                      <div className="flex flex-col gap-2 p-3 bg-[#F5F5F5] rounded-xl border border-[#E5E5E5]/60">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-muted-foreground">{t('Từ ngày')}</span>
                            <Input type="date" value={unavailRangeFrom} onChange={e => setUnavailRangeFrom(e.target.value)} className="mt-0.5 bg-white border-[#E5E5E5]/60 h-9" />
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground">{t('Đến ngày')}</span>
                            <Input type="date" value={unavailRangeTo} onChange={e => setUnavailRangeTo(e.target.value)} className="mt-0.5 bg-white border-[#E5E5E5]/60 h-9" />
                          </div>
                        </div>
                        <Button
                          size="sm" className="h-9 w-fit rounded-full"
                          disabled={!unavailRangeFrom || !unavailRangeTo || addUnavailabilityRange.isPending}
                          onClick={() => {
                            addUnavailabilityRange.mutate({ therapistId: unavailTherapist, from: unavailRangeFrom, to: unavailRangeTo }, {
                              onSuccess: () => { setUnavailRangeFrom(''); setUnavailRangeTo(''); },
                            });
                          }}
                        >
                          {addUnavailabilityRange.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />} {t('Thêm ngày nghỉ')}
                        </Button>
                      </div>
                    )}
                    <div className="fc-custom fc-mini shrink-0">
                      <FullCalendar
                        plugins={[dayGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
                        locale={lang === 'vi' ? 'vi' : 'en-au'}
                        height="auto"
                        dayMaxEvents={unavailTherapist === 'all' ? 3 : 1}
                        selectable={false}
                        dateClick={(info: DateClickArg) => unavailTherapist !== 'all' && setUnavailDate(info.date)}
                        eventClick={(info: EventClickArg) => unavailTherapist !== 'all' && setUnavailDate(info.event.start || undefined)}
                        dayCellClassNames={(arg) => {
                          const ds = format(arg.date, 'yyyy-MM-dd');
                          if (unavailDate && format(unavailDate, 'yyyy-MM-dd') === ds) return ['fc-day-selected'];
                          return [];
                        }}
                        events={(unavailabilities || [])
                          .filter((u: any) => unavailTherapist === 'all' || u.therapist_id === unavailTherapist)
                          .map((u: any) => ({
                            start: u.unavailable_date,
                            allDay: true,
                            display: 'list-item',
                            title: unavailTherapist === 'all' ? (u.therapists?.name || t('Ngày nghỉ')) : (u.reason || t('Ngày nghỉ')),
                            color: unavailTherapist === 'all'
                              ? THERAPIST_COLORS[Math.max(0, therapists?.findIndex(th => th.id === u.therapist_id) ?? 0) % THERAPIST_COLORS.length]
                              : '#ef4444',
                          }))}
                        buttonText={{ today: t('Hôm nay') }}
                      />
                    </div>

                    {/* Scrollable region: interaction panel + upcoming list. Calendar above stays fully visible/clickable. */}
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      {/* Selected day detail / interaction panel — hidden in "all staff" overview mode, which is view-only */}
                      {unavailTherapist !== 'all' && (
                        <div className="border-t border-[#E5E5E5]/30 pt-4">
                          {!unavailTherapist ? (
                            <p className="text-sm text-muted-foreground">{t('Chọn thợ')}</p>
                          ) : !unavailDate ? (
                            <p className="text-sm text-muted-foreground">{t('Chọn ngày trên lịch để thêm ngày nghỉ cho nhân viên')}</p>
                          ) : (() => {
                            const ds = format(unavailDate, 'yyyy-MM-dd');
                            const existing = (unavailabilities || []).find((u: any) => u.therapist_id === unavailTherapist && u.unavailable_date === ds);
                            return (
                              <div className="flex flex-col gap-3">
                                <p className="text-sm font-medium text-[#1B1B1B]">{format(unavailDate, 'dd/MM/yyyy')}</p>
                                {existing ? (
                                  <div className="flex items-center justify-between py-2.5 px-4 bg-red-50/60 rounded-full text-sm border border-red-100/50">
                                    <span className="text-[13px] text-muted-foreground">{existing.reason || t('Ngày nghỉ')}</span>
                                    <AdminOnlyButton variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground/40 hover:text-destructive" onClick={() => openConfirm(t('Xoá ngày nghỉ'), t('Xoá ngày nghỉ này?'), () => { removeUnavailability.mutate(existing.id); setUnavailDate(undefined); })}>
                                      <X className="h-3.5 w-3.5" />
                                    </AdminOnlyButton>
                                  </div>
                                ) : (
                                  <Button size="sm" className="h-9 w-fit rounded-full" disabled={addUnavailability.isPending}
                                    onClick={() => {
                                      addUnavailability.mutate({ therapistId: unavailTherapist, date: ds });
                                      setUnavailDate(undefined);
                                    }}>
                                    <Plus className="h-3.5 w-3.5 mr-1" /> {t('Thêm ngày nghỉ')}
                                  </Button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Upcoming days off — scrollable list so staff with many entries can be reviewed/removed without flipping through months */}
                      {unavailTherapist && (() => {
                        const todayStr = format(new Date(), 'yyyy-MM-dd');
                        const upcoming = (unavailabilities || [])
                          .filter((u: any) => (unavailTherapist === 'all' || u.therapist_id === unavailTherapist) && u.unavailable_date >= todayStr)
                          .sort((a: any, b: any) => a.unavailable_date.localeCompare(b.unavailable_date));
                        if (!upcoming.length) return null;
                        return (
                          <div className="border-t border-[#E5E5E5]/30 pt-4">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                              {t('Ngày nghỉ')} ({upcoming.length})
                            </p>
                            <div className="space-y-1.5 pr-1">
                              {upcoming.map((u: any) => (
                                <div key={u.id} className="flex items-center justify-between py-2 px-4 bg-red-50/60 rounded-full text-sm border border-red-100/50">
                                  <span className="text-[13px]">
                                    <span className="font-medium text-[#1B1B1B]">{format(new Date(`${u.unavailable_date}T00:00:00`), 'dd/MM/yyyy')}</span>
                                    {unavailTherapist === 'all' && <span className="text-muted-foreground ml-2">{u.therapists?.name}</span>}
                                    {u.reason && <span className="text-muted-foreground ml-2">{u.reason}</span>}
                                  </span>
                                  <AdminOnlyButton variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground/40 hover:text-destructive" onClick={() => openConfirm(t('Xoá ngày nghỉ'), t('Xoá ngày nghỉ này?'), () => { removeUnavailability.mutate(u.id); if (unavailDate && format(unavailDate, 'yyyy-MM-dd') === u.unavailable_date) setUnavailDate(undefined); })}>
                                    <X className="h-3.5 w-3.5" />
                                  </AdminOnlyButton>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Divider */}
                <div className="border-t border-[#E5E5E5]/30" />

                {/* Shop holidays */}
                <div className="p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[13px] font-semibold text-[#1B1B1B]">{t('Ngày nghỉ tiệm / Đóng cửa sớm')}</p>
                    <Button variant="outline" size="sm" className="h-9 text-sm rounded-full" onClick={() => setHolidayCalendarOpen(true)}>
                      <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                      {t('Xem lịch')}
                    </Button>
                  </div>
                  {(() => {
                    const upcoming = (shopHolidays || [])
                      .filter((h: any) => h.holiday_date >= format(new Date(), 'yyyy-MM-dd'))
                      .sort((a: any, b: any) => a.holiday_date.localeCompare(b.holiday_date));
                    if (!upcoming.length) return <p className="text-sm text-muted-foreground">{t('Chưa có ngày nghỉ tiệm nào')}</p>;
                    const PREVIEW_LIMIT = 3;
                    const preview = upcoming.slice(0, PREVIEW_LIMIT);
                    const remaining = upcoming.length - preview.length;
                    return (
                      <div className="space-y-1.5">
                        {preview.map((h: any) => (
                          <div key={h.id} className="flex items-center justify-between py-2.5 px-4 bg-red-50/60 rounded-full text-sm border border-red-100/50">
                            <span className="text-[13px]">
                              <span className="font-medium text-[#1B1B1B]">{h.holiday_date}</span>
                              <span className="text-muted-foreground ml-2">
                                {h.early_close_hour ? `${t('Đóng cửa lúc')} ${h.early_close_hour}:00` : t('Nghỉ cả ngày')}
                              </span>
                            </span>
                            <AdminOnlyButton variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground/40 hover:text-destructive" onClick={() => openConfirm(t('Xoá ngày nghỉ'), t('Xoá ngày nghỉ tiệm này?'), () => removeHoliday.mutate(h.id))}>
                              <X className="h-3.5 w-3.5" />
                            </AdminOnlyButton>
                          </div>
                        ))}
                        {remaining > 0 && (
                          <button
                            className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-1.5"
                            onClick={() => setHolidayCalendarOpen(true)}
                          >
                            +{remaining} {t('Xem lịch')}
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Shop holiday calendar dialog */}
              <Dialog open={holidayCalendarOpen} onOpenChange={(open) => { setHolidayCalendarOpen(open); if (!open) { setHolidayDate(undefined); setEarlyCloseHour('none'); } }}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                  <DialogHeader>
                    <DialogTitle>{t('Ngày nghỉ tiệm / Đóng cửa sớm')}</DialogTitle>
                    <DialogDescription>{t('Chọn ngày trên lịch để thêm ngày nghỉ')}</DialogDescription>
                  </DialogHeader>
                  <div className="fc-custom fc-mini shrink-0">
                    <FullCalendar
                      plugins={[dayGridPlugin, interactionPlugin]}
                      initialView="dayGridMonth"
                      headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
                      locale={lang === 'vi' ? 'vi' : 'en-au'}
                      height="auto"
                      dayMaxEvents={1}
                      selectable={false}
                      dateClick={(info: DateClickArg) => {
                        const date = info.date;
                        setHolidayDate(date);
                        const ds = format(date, 'yyyy-MM-dd');
                        const existing = (shopHolidays || []).find((h: any) => h.holiday_date === ds);
                        setEarlyCloseHour(existing?.early_close_hour ? String(existing.early_close_hour) : 'none');
                      }}
                      eventClick={(info: EventClickArg) => {
                        const date = info.event.start;
                        if (!date) return;
                        setHolidayDate(date);
                        const ds = format(date, 'yyyy-MM-dd');
                        const existing = (shopHolidays || []).find((h: any) => h.holiday_date === ds);
                        setEarlyCloseHour(existing?.early_close_hour ? String(existing.early_close_hour) : 'none');
                      }}
                      dayCellClassNames={(arg) => {
                        const ds = format(arg.date, 'yyyy-MM-dd');
                        if (holidayDate && format(holidayDate, 'yyyy-MM-dd') === ds) return ['fc-day-selected'];
                        return [];
                      }}
                      events={(shopHolidays || []).map((h: any) => ({
                        start: h.holiday_date,
                        allDay: true,
                        display: 'list-item',
                        title: h.early_close_hour ? `${t('Đóng cửa lúc')} ${h.early_close_hour}:00` : t('Nghỉ cả ngày'),
                        color: h.early_close_hour ? '#f59e0b' : '#ef4444',
                      }))}
                      buttonText={{ today: t('Hôm nay') }}
                    />
                  </div>
                  {/* Scrollable region: legend + interaction panel + upcoming list. Calendar above stays fully visible/clickable. */}
                  <div className="flex-1 min-h-0 overflow-y-auto">
                  {/* Legend */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground/70 pb-1">
                    <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />{t('Nghỉ cả ngày')}</span>
                    <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{t('Đóng cửa sớm')}</span>
                  </div>

                  {/* Selected day detail / interaction panel */}
                  <div className="border-t border-[#E5E5E5]/30 pt-4">
                    {!holidayDate ? (
                      <p className="text-sm text-muted-foreground">{t('Chọn ngày trên lịch để thêm ngày nghỉ')}</p>
                    ) : (() => {
                      const ds = format(holidayDate, 'yyyy-MM-dd');
                      const existing = (shopHolidays || []).find((h: any) => h.holiday_date === ds);
                      return (
                        <div className="flex flex-col gap-3">
                          <p className="text-sm font-medium text-[#1B1B1B]">{format(holidayDate, 'dd/MM/yyyy')}</p>
                          {existing ? (
                            <div className="flex items-center justify-between py-2.5 px-4 bg-red-50/60 rounded-full text-sm border border-red-100/50">
                              <span className="text-[13px] text-muted-foreground">
                                {existing.early_close_hour ? `${t('Đóng cửa lúc')} ${existing.early_close_hour}:00` : t('Nghỉ cả ngày')}
                              </span>
                              <AdminOnlyButton variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground/40 hover:text-destructive" onClick={() => openConfirm(t('Xoá ngày nghỉ'), t('Xoá ngày nghỉ tiệm này?'), () => { removeHoliday.mutate(existing.id); setHolidayDate(undefined); })}>
                                <X className="h-3.5 w-3.5" />
                              </AdminOnlyButton>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground/70 whitespace-nowrap">{t('Đóng cửa sớm lúc')}</span>
                                <Select value={earlyCloseHour} onValueChange={setEarlyCloseHour}>
                                  <SelectTrigger className="w-[100px] h-9 text-sm rounded-full bg-[#F5F5F5] border-[#E5E5E5]/50"><SelectValue placeholder={t('Không')} /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">{t('Nghỉ cả ngày')}</SelectItem>
                                    {Array.from({ length: 13 }, (_, i) => i + 10).map(h => (
                                      <SelectItem key={h} value={String(h)}>{h}:00</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button size="sm" className="h-9 rounded-full" disabled={addHoliday.isPending}
                                onClick={() => {
                                  addHoliday.mutate({
                                    date: ds,
                                    earlyCloseHour: earlyCloseHour !== 'none' ? parseInt(earlyCloseHour) : undefined,
                                  });
                                  setHolidayDate(undefined);
                                  setEarlyCloseHour('none');
                                }}>
                                <Plus className="h-3.5 w-3.5 mr-1" /> {t('Thêm')}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Upcoming holidays — scrollable list so shops with many entries can be reviewed/removed without flipping through months */}
                  {(() => {
                    const todayStr = format(new Date(), 'yyyy-MM-dd');
                    const upcoming = (shopHolidays || [])
                      .filter((h: any) => h.holiday_date >= todayStr)
                      .sort((a: any, b: any) => a.holiday_date.localeCompare(b.holiday_date));
                    if (!upcoming.length) return null;
                    return (
                      <div className="border-t border-[#E5E5E5]/30 pt-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                          {t('Ngày nghỉ')} ({upcoming.length})
                        </p>
                        <div className="space-y-1.5 pr-1">
                          {upcoming.map((h: any) => (
                            <div key={h.id} className="flex items-center justify-between py-2 px-4 bg-red-50/60 rounded-full text-sm border border-red-100/50">
                              <span className="text-[13px]">
                                <span className="font-medium text-[#1B1B1B]">{h.holiday_date}</span>
                                <span className="text-muted-foreground ml-2">
                                  {h.early_close_hour ? `${t('Đóng cửa lúc')} ${h.early_close_hour}:00` : t('Nghỉ cả ngày')}
                                </span>
                              </span>
                              <AdminOnlyButton variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground/40 hover:text-destructive" onClick={() => openConfirm(t('Xoá ngày nghỉ'), t('Xoá ngày nghỉ tiệm này?'), () => { removeHoliday.mutate(h.id); if (holidayDate && format(holidayDate, 'yyyy-MM-dd') === h.holiday_date) setHolidayDate(undefined); })}>
                                <X className="h-3.5 w-3.5" />
                              </AdminOnlyButton>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  </div>
                </DialogContent>
              </Dialog>

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
                            {(() => {
                              const workingRows = (th.therapist_weekly_hours || []).filter((r: any) => r.is_working);
                              if (!workingRows.length) return <p className="text-[13px] text-muted-foreground/50">{t('Chưa cài giờ làm việc')}</p>;
                              return <p className="text-[13px] text-[#555555]">{workingRows.length} {t('ngày/tuần')}</p>;
                            })()}
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
                                  onClick={() => { setViewingTherapist(th); setTherapistInfoDialog(true); }}
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
                                  {th.is_active ? (
                                    <DropdownMenuItem className="text-destructive text-xs" onClick={() => openDeleteTherapist(th)}>
                                      <Trash2 className="h-3.5 w-3.5 mr-2" /> {t('Xóa')}
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem className="text-xs" onClick={() => reactivateTherapist.mutate(th.id)}>
                                      <Users className="h-3.5 w-3.5 mr-2" /> {t('Kích hoạt lại')}
                                    </DropdownMenuItem>
                                  )}
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
                              <p className="text-[11px] text-muted-foreground/60 mt-0.5">{(th.therapist_weekly_hours || []).filter((r: any) => r.is_working).length} {t('ngày/tuần')}</p>
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
                                  {th.is_active ? (
                                    <DropdownMenuItem className="text-destructive text-xs" onClick={() => openDeleteTherapist(th)}>
                                      <Trash2 className="h-3.5 w-3.5 mr-2" /> {t('Xóa')}
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem className="text-xs" onClick={() => reactivateTherapist.mutate(th.id)}>
                                      <Users className="h-3.5 w-3.5 mr-2" /> {t('Kích hoạt lại')}
                                    </DropdownMenuItem>
                                  )}
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

          {/* Transfer bookings before deleting/hiding a staff member */}
          <Dialog open={transferDialog} onOpenChange={(open) => { setTransferDialog(open); if (!open) { setTransferTherapist(null); setTransferAssignments({}); } }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{t('Chuyển lịch hẹn trước khi xoá')}</DialogTitle>
                <DialogDescription>
                  {t('Nhân viên này còn lịch hẹn sắp tới. Chọn nhân viên khác đang rảnh cho từng lịch hẹn trước khi xoá.')}
                </DialogDescription>
              </DialogHeader>
              {transferTherapist && (
                <div className="space-y-3 pt-2 max-h-[60vh] overflow-y-auto">
                  {getUpcomingBookingsForTherapist(transferTherapist.id).map((b: any) => {
                    const options = getAvailableTherapistsForBooking(b, transferTherapist.id);
                    return (
                      <div key={b.id} className="rounded-lg border border-[#E5E5E5]/60 p-3 space-y-2">
                        <div className="text-sm">
                          <p className="font-medium">{b.customer_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(`${b.booking_date}T00:00:00`), 'dd/MM/yyyy')} · {b.start_time?.slice(0, 5)}–{b.end_time?.slice(0, 5)} · {b.services?.name}
                          </p>
                        </div>
                        <Select
                          value={transferAssignments[b.id] || ''}
                          onValueChange={(v) => setTransferAssignments(prev => ({ ...prev, [b.id]: v }))}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder={t('Chọn nhân viên thay thế')} />
                          </SelectTrigger>
                          <SelectContent>
                            {options.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-muted-foreground">{t('Không có nhân viên nào rảnh cho lịch hẹn này')}</div>
                            ) : options.map((opt: any) => (
                              <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                  <Button
                    className="w-full h-10 bg-[#006AFF] hover:bg-[#1B1B1B] text-white"
                    disabled={transferSubmitting || getUpcomingBookingsForTherapist(transferTherapist.id).some((b: any) => !transferAssignments[b.id])}
                    onClick={confirmTransferAndDelete}
                  >
                    {transferSubmitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang xử lý...')}</>) : t('Xác nhận chuyển & xoá')}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Therapist Info Dialog */}
          <Dialog open={therapistInfoDialog} onOpenChange={(open) => { setTherapistInfoDialog(open); if (!open) { setViewingUnavailDate(undefined); setViewingUnavailRangeMode(false); setViewingUnavailRangeFrom(''); setViewingUnavailRangeTo(''); } }}>
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
                      <p className="text-muted-foreground text-xs">{t('Trạng thái')}</p>
                      <Badge variant={viewingTherapist.is_active ? 'default' : 'secondary'}>
                        {viewingTherapist.is_active ? t('Hoạt động') : t('Tắt')}
                      </Badge>
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <p className="text-muted-foreground text-xs mb-1.5">{t('Giờ làm việc theo ngày')}</p>
                    <div className="space-y-1">
                      {DAYS_OF_WEEK.map(d => {
                        const row = (viewingTherapist.therapist_weekly_hours || []).find((r: any) => r.day_of_week === d.value);
                        return (
                          <div key={d.value} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{d.label}</span>
                            <span>{row?.is_working ? `${formatMinutesHHMM(row.start_minute)} – ${formatMinutesHHMM(row.end_minute)}` : t('Nghỉ')}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">{t('Ngày nghỉ')}</p>
                      <Button size="sm" variant={viewingUnavailRangeMode ? 'default' : 'outline'} className="h-8 rounded-full text-xs" onClick={() => setViewingUnavailRangeMode(v => !v)}>
                        {t('Chọn nhiều ngày')}
                      </Button>
                    </div>
                    {viewingUnavailRangeMode && (
                      <div className="flex flex-col gap-2 p-3 mb-3 bg-[#F5F5F5] rounded-xl border border-[#E5E5E5]/60">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-muted-foreground">{t('Từ ngày')}</span>
                            <Input type="date" value={viewingUnavailRangeFrom} onChange={e => setViewingUnavailRangeFrom(e.target.value)} className="mt-0.5 bg-white border-[#E5E5E5]/60 h-9" />
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground">{t('Đến ngày')}</span>
                            <Input type="date" value={viewingUnavailRangeTo} onChange={e => setViewingUnavailRangeTo(e.target.value)} className="mt-0.5 bg-white border-[#E5E5E5]/60 h-9" />
                          </div>
                        </div>
                        <Button
                          size="sm" className="h-9 w-fit rounded-full"
                          disabled={!viewingUnavailRangeFrom || !viewingUnavailRangeTo || addUnavailabilityRange.isPending}
                          onClick={() => {
                            addUnavailabilityRange.mutate({ therapistId: viewingTherapist.id, from: viewingUnavailRangeFrom, to: viewingUnavailRangeTo }, {
                              onSuccess: () => { setViewingUnavailRangeFrom(''); setViewingUnavailRangeTo(''); },
                            });
                          }}
                        >
                          {addUnavailabilityRange.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />} {t('Thêm ngày nghỉ')}
                        </Button>
                      </div>
                    )}
                    <div className="fc-custom fc-mini shrink-0">
                      <FullCalendar
                        plugins={[dayGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
                        locale={lang === 'vi' ? 'vi' : 'en-au'}
                        height="auto"
                        dayMaxEvents={1}
                        selectable={false}
                        dateClick={(info: DateClickArg) => setViewingUnavailDate(info.date)}
                        eventClick={(info: EventClickArg) => setViewingUnavailDate(info.event.start || undefined)}
                        dayCellClassNames={(arg) => {
                          const ds = format(arg.date, 'yyyy-MM-dd');
                          if (viewingUnavailDate && format(viewingUnavailDate, 'yyyy-MM-dd') === ds) return ['fc-day-selected'];
                          return [];
                        }}
                        events={(unavailabilities || [])
                          .filter((u: any) => u.therapist_id === viewingTherapist.id)
                          .map((u: any) => ({
                            start: u.unavailable_date,
                            allDay: true,
                            display: 'list-item',
                            title: u.reason || t('Ngày nghỉ'),
                            color: '#ef4444',
                          }))}
                        buttonText={{ today: t('Hôm nay') }}
                      />
                    </div>

                    {/* Selected day detail / interaction panel */}
                    <div className="border-t border-[#E5E5E5]/30 pt-4 mt-4">
                      {!viewingUnavailDate ? (
                        <p className="text-sm text-muted-foreground">{t('Chọn ngày trên lịch để thêm ngày nghỉ cho nhân viên')}</p>
                      ) : (() => {
                        const ds = format(viewingUnavailDate, 'yyyy-MM-dd');
                        const existing = (unavailabilities || []).find((u: any) => u.therapist_id === viewingTherapist.id && u.unavailable_date === ds);
                        return (
                          <div className="flex flex-col gap-3">
                            <p className="text-sm font-medium text-[#1B1B1B]">{format(viewingUnavailDate, 'dd/MM/yyyy')}</p>
                            {existing ? (
                              <div className="flex items-center justify-between py-2.5 px-4 bg-red-50/60 rounded-full text-sm border border-red-100/50">
                                <span className="text-[13px] text-muted-foreground">{existing.reason || t('Ngày nghỉ')}</span>
                                {isAdmin && (
                                  <AdminOnlyButton variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground/40 hover:text-destructive" onClick={() => openConfirm(t('Xoá ngày nghỉ'), t('Xoá ngày nghỉ này?'), () => { removeUnavailability.mutate(existing.id); setViewingUnavailDate(undefined); })}>
                                    <X className="h-3.5 w-3.5" />
                                  </AdminOnlyButton>
                                )}
                              </div>
                            ) : (
                              <Button size="sm" className="h-9 w-fit rounded-full" disabled={addUnavailability.isPending}
                                onClick={() => {
                                  addUnavailability.mutate({ therapistId: viewingTherapist.id, date: ds });
                                  setViewingUnavailDate(undefined);
                                }}>
                                <Plus className="h-3.5 w-3.5 mr-1" /> {t('Thêm ngày nghỉ')}
                              </Button>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Upcoming days off — scrollable list so staff with many entries can be reviewed/removed without flipping through months */}
                    {(() => {
                      const todayStr = format(new Date(), 'yyyy-MM-dd');
                      const upcoming = (unavailabilities || [])
                        .filter((u: any) => u.therapist_id === viewingTherapist.id && u.unavailable_date >= todayStr)
                        .sort((a: any, b: any) => a.unavailable_date.localeCompare(b.unavailable_date));
                      if (!upcoming.length) return null;
                      return (
                        <div className="border-t border-[#E5E5E5]/30 pt-4 mt-4">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                            {t('Ngày nghỉ')} ({upcoming.length})
                          </p>
                          <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                            {upcoming.map((u: any) => (
                              <div key={u.id} className="flex items-center justify-between py-2 px-4 bg-red-50/60 rounded-full text-sm border border-red-100/50">
                                <span className="text-[13px]">
                                  <span className="font-medium text-[#1B1B1B]">{format(new Date(`${u.unavailable_date}T00:00:00`), 'dd/MM/yyyy')}</span>
                                  {u.reason && <span className="text-muted-foreground ml-2">{u.reason}</span>}
                                </span>
                                {isAdmin && (
                                  <AdminOnlyButton variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground/40 hover:text-destructive" onClick={() => openConfirm(t('Xoá ngày nghỉ'), t('Xoá ngày nghỉ này?'), () => { removeUnavailability.mutate(u.id); if (viewingUnavailDate && format(viewingUnavailDate, 'yyyy-MM-dd') === u.unavailable_date) setViewingUnavailDate(undefined); })}>
                                    <X className="h-3.5 w-3.5" />
                                  </AdminOnlyButton>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Pricing Tab */}
          {isAdmin && (
          <TabsContent value="pricing">
            <PricingManager />
          </TabsContent>
          )}

          {/* Locations Tab */}
          {isAdmin && (
          <TabsContent value="locations">
            <BranchesManager />
          </TabsContent>
          )}

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
              { key: 'ai_assistant', icon: Bot, label: t('AI, Dịch thuật & Knowledge Base'), desc: isAiLicensed ? (aiReplyConfig?.ai_enabled ? t('AI Reply ON') : t('AI Reply OFF — booking only')) : t('Chưa kích hoạt — cần mã bản quyền') },
              { key: 'membership', icon: Crown, label: t('Hạng thành viên'), desc: `${membershipTiers?.length || 0} ${t('hạng')}` },
              { key: 'about', icon: BookOpen, label: t('Về chúng tôi'), desc: t('Chỉnh sửa nội dung trang Về chúng tôi') },
              { key: 'terms', icon: ScrollText, label: t('Điều khoản'), desc: t('Chỉnh sửa nội dung trang Điều khoản') },
              ...(isAdmin ? [{ key: 'logs', icon: FileText, label: t('Nhật ký hoạt động'), desc: t('Tải xuống CSV') }] : []),
              ...(isAdmin ? [{ key: 'export_excel', icon: FileSpreadsheet, label: t('Xuất báo cáo Excel'), desc: t('Doanh thu, lịch hẹn, dịch vụ, nhân viên') }] : []),
              ...(isAdmin ? [{ key: 'data_backup', icon: DatabaseBackup, label: t('Sao lưu & Khôi phục dữ liệu'), desc: t('Xuất/nhập dịch vụ, giá, nhân viên, sản phẩm dạng JSON') }] : []),
              { key: 'upgrade', icon: Crown, label: t('Nâng cấp hệ thống'), desc: t('Nhập mã nâng cấp để mở khoá tính năng') },
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
                    <Label>ABN</Label>
                    <Input value={shopAbn} onChange={e => setShopAbn(e.target.value)} className="mt-1" placeholder="12 345 678 901" />
                    <p className="text-xs text-muted-foreground mt-1">{t('Hiển thị trên hoá đơn in cho khách')}</p>
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
                          await upsertSetting('hero_mode', heroMode);
                          await upsertSetting('hero_media_path', path);
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
                    { value: 'payment_history' as EmployeeTab, icon: History, label: t('Lịch sử thanh toán') },
                    { value: 'services' as EmployeeTab, icon: Scissors, label: t('Dịch vụ') },
                    { value: 'products' as EmployeeTab, icon: ShoppingBag, label: t('Sản phẩm') },
                    { value: 'therapists' as EmployeeTab, icon: Users, label: t('Thợ') },
                    { value: 'inbox' as EmployeeTab, icon: MessageSquare, label: t('Hộp thư') },
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

            {/* Translation modal removed — merged into AI & Knowledge Base */}

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

            {/* ── Export Excel Modal ── */}
            <Dialog open={settingsModal === 'export_excel'} onOpenChange={(open) => !open && setSettingsModal(null)}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{t('Xuất báo cáo Excel')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground">
                    {t('Tạo file Excel gồm Doanh thu, Lịch hẹn, Dịch vụ và Nhân viên — phù hợp để gửi cho kế toán.')}
                  </p>

                  <div className="space-y-2">
                    <Label>{t('Khoảng thời gian')}</Label>
                    <Select value={exportRangePreset} onValueChange={(v) => setExportRangePreset(v as typeof exportRangePreset)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="this_month">{t('Tháng này')}</SelectItem>
                        <SelectItem value="last_month">{t('Tháng trước')}</SelectItem>
                        <SelectItem value="this_year">{t('Năm này')}</SelectItem>
                        <SelectItem value="custom">{t('Tuỳ chọn')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {exportRangePreset === 'custom' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t('Từ ngày')}</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="w-full justify-start font-normal">
                              <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                              {exportCustomFrom ? format(exportCustomFrom, 'dd/MM/yyyy') : t('Chọn ngày')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={exportCustomFrom} onSelect={setExportCustomFrom} className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t('Đến ngày')}</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="w-full justify-start font-normal">
                              <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                              {exportCustomTo ? format(exportCustomTo, 'dd/MM/yyyy') : t('Chọn ngày')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={exportCustomTo} onSelect={setExportCustomTo} className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                    <p className="text-xs font-medium">{t('File sẽ gồm 5 trang tính:')}</p>
                    <p className="text-xs text-muted-foreground">Summary · Sales · Appointments · Services · Staff</p>
                  </div>

                  <Button
                    className="w-full bg-[#006AFF] hover:bg-[#006AFF]/90"
                    disabled={isExporting || (exportRangePreset === 'custom' && (!exportCustomFrom || !exportCustomTo))}
                    onClick={async () => {
                      const now = new Date();
                      let from: Date;
                      let to: Date;
                      let label: string;
                      if (exportRangePreset === 'this_month') {
                        from = startOfMonth(now);
                        to = endOfMonth(now);
                        label = format(now, 'MMMM yyyy');
                      } else if (exportRangePreset === 'last_month') {
                        const lastMonth = subMonths(now, 1);
                        from = startOfMonth(lastMonth);
                        to = endOfMonth(lastMonth);
                        label = format(lastMonth, 'MMMM yyyy');
                      } else if (exportRangePreset === 'this_year') {
                        from = startOfYear(now);
                        to = endOfYear(now);
                        label = format(now, 'yyyy');
                      } else {
                        from = exportCustomFrom!;
                        to = exportCustomTo!;
                        label = `${format(from, 'dd/MM/yyyy')} - ${format(to, 'dd/MM/yyyy')}`;
                      }
                      // Include the full end day
                      to = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);

                      setIsExporting(true);
                      try {
                        const { exportBusinessReport, downloadWorkbook } = await import('@/lib/excelExport');
                        const workbook = exportBusinessReport({
                          spaName,
                          sales: sales || [],
                          bookings: (bookings || []) as any,
                          services: services || [],
                          products: products || [],
                          therapists: therapists || [],
                          range: { from, to, label },
                        });
                        await downloadWorkbook(workbook, `${spaName.replace(/\s+/g, '-').toLowerCase()}-financial-report`);
                        toast({ title: t('Xuất file thành công') });
                        setSettingsModal(null);
                      } catch (err) {
                        console.error('Excel export failed', err);
                        toast({ title: t('Lỗi'), description: t('Không thể tạo file Excel. Vui lòng thử lại.'), variant: 'destructive' });
                      } finally {
                        setIsExporting(false);
                      }
                    }}
                  >
                    {isExporting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang tạo file...')}</> : <><FileSpreadsheet className="h-4 w-4 mr-2" />{t('Tải xuống Excel')}</>}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* ── Data Backup (Export/Import Business Config) Modal ── */}
            <Dialog open={settingsModal === 'data_backup'} onOpenChange={(open) => { if (!open) { setSettingsModal(null); setBackupImportResult(null); setBackupImportFile(null); } }}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{t('Sao lưu & Khôi phục dữ liệu')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 pt-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{t('Xuất dữ liệu')}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('Tải xuống dịch vụ, nhân viên, sản phẩm, giá, hạng thành viên, mã giảm giá và chi nhánh dạng file JSON.')}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBackupExporting}
                      onClick={async () => {
                        setIsBackupExporting(true);
                        try {
                          const { exportBusinessConfig, downloadBackupJson } = await import('@/lib/dataBackup');
                          const backup = await exportBusinessConfig();
                          downloadBackupJson(backup, `${spaName.replace(/\s+/g, '-').toLowerCase()}-business-config`);
                          toast({ title: t('Xuất file thành công') });
                        } catch (err) {
                          console.error('Business config export failed', err);
                          toast({ title: t('Lỗi'), description: t('Không thể xuất dữ liệu. Vui lòng thử lại.'), variant: 'destructive' });
                        } finally {
                          setIsBackupExporting(false);
                        }
                      }}
                    >
                      {isBackupExporting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang xuất...')}</> : <><Download className="h-3.5 w-3.5 mr-1.5" />{t('Tải xuống JSON')}</>}
                    </Button>
                  </div>

                  <div className="border-t border-border/40 pt-4 space-y-2">
                    <p className="text-sm font-medium">{t('Nhập dữ liệu')}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('Chọn file JSON đã xuất trước đó. Dữ liệu trùng ID sẽ được ghi đè, dữ liệu mới sẽ được thêm vào.')}
                    </p>
                    <input
                      ref={backupFileInputRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={(e) => {
                        setBackupImportResult(null);
                        setBackupImportFile(e.target.files?.[0] || null);
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => backupFileInputRef.current?.click()} disabled={isBackupImporting}>
                        <Upload className="h-3.5 w-3.5 mr-1.5" />{t('Chọn file')}
                      </Button>
                      {backupImportFile && <span className="text-xs text-muted-foreground truncate">{backupImportFile.name}</span>}
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={!backupImportFile || isBackupImporting}
                      onClick={async () => {
                        if (!backupImportFile) return;
                        setIsBackupImporting(true);
                        setBackupImportResult(null);
                        try {
                          const { parseBackupFile, importBusinessConfig } = await import('@/lib/dataBackup');
                          const text = await backupImportFile.text();
                          const backup = parseBackupFile(text);
                          const result = await importBusinessConfig(backup);
                          setBackupImportResult(result);
                          logActivity('import_business_config', `Imported ${result.map(r => `${r.table}:${r.count}`).join(', ')}`);
                          queryClient.invalidateQueries({ queryKey: ['admin-services'] });
                          queryClient.invalidateQueries({ queryKey: ['admin-products'] });
                          queryClient.invalidateQueries({ queryKey: ['admin-therapists'] });
                          queryClient.invalidateQueries({ queryKey: ['membership-tiers'] });
                          queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
                          queryClient.invalidateQueries({ queryKey: ['shop-holidays'] });
                          toast({ title: t('Nhập dữ liệu thành công') });
                        } catch (err: any) {
                          console.error('Business config import failed', err);
                          toast({ title: t('Lỗi'), description: err?.message || t('Không thể nhập dữ liệu. Kiểm tra lại file.'), variant: 'destructive' });
                        } finally {
                          setIsBackupImporting(false);
                        }
                      }}
                    >
                      {isBackupImporting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang nhập...')}</> : t('Nhập dữ liệu')}
                    </Button>
                    {backupImportResult && (
                      <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                        <p className="text-xs font-medium">{t('Đã nhập:')}</p>
                        {backupImportResult.map(r => (
                          <p key={r.table} className="text-xs text-muted-foreground">{r.table}: {r.count}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* ── Upgrade Key Modal ── */}
            <Dialog open={settingsModal === 'upgrade'} onOpenChange={(open) => { if (!open) { setSettingsModal(null); setUpgradeKey(''); setUpgradeStatus('idle'); } }}>
              <DialogContent className="max-w-[100vw] sm:max-w-[440px] p-0 gap-0 rounded-none sm:rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border/60">
                  <DialogHeader>
                    <DialogTitle className="text-lg">{t('Nâng cấp hệ thống')}</DialogTitle>
                    <DialogDescription className="text-sm">{t('Nhập mã nâng cấp để mở khoá tính năng cao cấp')}</DialogDescription>
                  </DialogHeader>
                </div>
                <div className="px-5 py-6 space-y-4">
                  <div className="flex items-center justify-center">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center">
                      <Crown className="h-8 w-8 text-amber-600" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Mã nâng cấp')}</Label>
                    <Input
                      value={upgradeKey}
                      onChange={e => { setUpgradeKey(e.target.value.toUpperCase()); setUpgradeStatus('idle'); }}
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      className="mt-1.5 font-mono text-center text-lg tracking-widest h-12"
                    />
                  </div>
                  {upgradeStatus === 'success' && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
                      <Check className="h-4 w-4 shrink-0" />
                      {t('Nâng cấp thành công! Tính năng đã được mở khoá.')}
                    </div>
                  )}
                  {upgradeStatus === 'error' && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {t('Mã không hợp lệ hoặc đã được sử dụng. Vui lòng thử lại.')}
                    </div>
                  )}
                </div>
                <div className="px-5 py-4 border-t border-border/60">
                  <Button
                    className="w-full h-12 text-base font-medium bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                    disabled={!upgradeKey.trim()}
                    onClick={async () => {
                      try {
                        const { data, error } = await supabase.functions.invoke('validate-upgrade-key', {
                          body: { key: upgradeKey.trim() },
                        });
                        if (error || !data?.valid) {
                          setUpgradeStatus('error');
                        } else {
                          setUpgradeStatus('success');
                          queryClient.invalidateQueries();
                        }
                      } catch {
                        setUpgradeStatus('error');
                      }
                    }}
                  >
                    <Crown className="h-5 w-5 mr-2" />
                    {t('Kích hoạt nâng cấp')}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-3">{t('Liên hệ nhà cung cấp để nhận mã nâng cấp')}</p>
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

            {/* ── AI, Translation & Knowledge Base (unified) ── */}
            <Dialog open={settingsModal === 'ai_assistant'} onOpenChange={(open) => !open && setSettingsModal(null)}>
              <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <DialogTitle>{t('AI, Dịch thuật & Knowledge Base')}</DialogTitle>
                    <div className="flex items-center gap-3">
                      {isAiLicensed && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{t('Hộp thư')}</span>
                          <Switch
                            checked={inboxEnabled === true}
                            onCheckedChange={(checked) => toggleInboxVisible.mutate(checked)}
                            disabled={toggleInboxVisible.isPending}
                          />
                        </div>
                      )}
                      {aiReplyConfig?.id && isAiLicensed && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{t('AI Reply')}</span>
                          <Switch
                            checked={aiReplyConfig.ai_enabled}
                            onCheckedChange={(checked) => toggleAiReply.mutate(checked)}
                            disabled={toggleAiReply.isPending}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <DialogDescription className="text-xs">
                    {t('Cấu hình AI tự động trả lời, dịch thuật giao diện, và cơ sở kiến thức')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 pt-2">
                  {/* ── License Key Section ── */}
                  <div className={cn('p-4 rounded-xl border-2', isAiLicensed ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/50')}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Lock className="h-4 w-4" /> {t('Mã bản quyền AI')}
                      </h3>
                      {isAiLicensed && (
                        <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="h-3 w-3" /> {t('Đã kích hoạt')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      {isAiLicensed ? t('Tính năng AI & Hộp thư đã được mở khoá') : t('Nhập mã bản quyền để mở khoá AI Chat, Hộp thư và Knowledge Base')}
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        value={upgradeKey || (isAiLicensed ? (aiLicenseKey || '') : '')}
                        onChange={e => { setUpgradeKey(e.target.value.toUpperCase()); setLicenseError(''); }}
                        placeholder="XXXX-XXXX-XXXX-XXXX"
                        className={cn('font-mono text-sm tracking-wider flex-1', licenseError && 'border-red-400')}
                        disabled={isAiLicensed}
                      />
                      {!isAiLicensed && (
                        <Button
                          size="sm"
                          onClick={() => saveAiLicense.mutate(upgradeKey)}
                          disabled={licenseValidating || !upgradeKey.trim()}
                        >
                          {licenseValidating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Lock className="h-3.5 w-3.5 mr-1" />}
                          {t('Kích hoạt')}
                        </Button>
                      )}
                    </div>
                    {licenseError && (
                      <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {licenseError}
                      </p>
                    )}
                  </div>

                  {/* ── Translation Settings Section ── */}
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                      <Languages className="h-4 w-4" /> {t('Dịch thuật giao diện')}
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">{t('OpenAI API Key')}</Label>
                        <Input
                          type="password"
                          value={openaiApiKey}
                          onChange={e => setOpenaiApiKey(e.target.value)}
                          placeholder={openaiSettings?.['openai_api_key'] ? '••••••• (saved)' : 'sk-...'}
                          className="mt-1 h-9 font-mono text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t('Model')}</Label>
                        <Input
                          value={openaiModel}
                          onChange={e => setOpenaiModel(e.target.value)}
                          placeholder="gpt-4o-mini"
                          className="mt-1 h-9 font-mono text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t('Base URL')}</Label>
                        <Input
                          value={openaiBaseUrl}
                          onChange={e => setOpenaiBaseUrl(e.target.value)}
                          placeholder="https://api.openai.com/v1"
                          className="mt-1 h-9 font-mono text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Button size="sm" onClick={() => saveOpenaiSettings.mutate()} disabled={!openaiApiKey.trim() || saveOpenaiSettings.isPending}>
                        {saveOpenaiSettings.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                        {t('Lưu dịch thuật')}
                      </Button>
                      {openaiSettings?.['openai_api_key'] && (
                        <>
                          <Button size="sm" variant="outline" disabled={!!populatingLang} onClick={() => populateTranslations('vi')}>
                            {populatingLang === 'vi' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                            {t('Dịch → Tiếng Việt')}
                          </Button>
                          <Button size="sm" variant="outline" disabled={!!populatingLang} onClick={() => populateTranslations('en')}>
                            {populatingLang === 'en' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                            {t('Dịch → English')}
                          </Button>
                        </>
                      )}
                    </div>
                    {populatingLang && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t('Đang dịch...')} {populateProgress.done}/{populateProgress.total} {t('batch')}
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${populateProgress.total ? (populateProgress.done / populateProgress.total) * 100 : 0}%` }} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[#E5E5E5] pt-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                      <Bot className="h-4 w-4" /> {t('AI Chat & Tự động trả lời')}
                    </h3>
                    {isAiLicensed ? (
                      <AISettingsPanel />
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Lock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm font-medium">{t('Tính năng bị khoá')}</p>
                        <p className="text-xs mt-1">{t('Nhập mã bản quyền ở trên để mở khoá AI Chat & Hộp thư')}</p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[#E5E5E5] pt-4">
                    {isAiLicensed ? (
                      <KnowledgeBaseManager />
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Lock className="h-6 w-6 mx-auto mb-2 opacity-40" />
                        <p className="text-xs">{t('Knowledge Base — cần mã bản quyền')}</p>
                      </div>
                    )}
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

                  {/* ── Tax Rate ── */}
                  <div className="border-t border-border/40 pt-4">
                    <div className="space-y-3">
                      <p className="font-medium text-sm">{t('Thuế')}</p>
                      <div>
                        <Label>{t('Loại thuế')}</Label>
                        <Select value={taxType} onValueChange={setTaxType}>
                          <SelectTrigger className="mt-1 w-[160px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GST">GST</SelectItem>
                            <SelectItem value="VAT">VAT</SelectItem>
                            <SelectItem value="Sales Tax">Sales Tax</SelectItem>
                            <SelectItem value="Custom">{t('Tuỳ chỉnh')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {taxType === 'Custom' && (
                        <div>
                          <Label>{t('Tên thuế tuỳ chỉnh')}</Label>
                          <Input
                            value={taxTypeCustomLabel}
                            onChange={e => setTaxTypeCustomLabel(e.target.value)}
                            className="mt-1 w-[200px]"
                            placeholder="e.g. HST"
                          />
                        </div>
                      )}
                      <div>
                        <Label>{t('Phần trăm thuế (%)')}</Label>
                        <Input
                          type="number"
                          min="0"
                          max="30"
                          step="0.1"
                          value={taxRatePercent}
                          onChange={e => setTaxRatePercent(e.target.value)}
                          className="mt-1 w-[120px]"
                          placeholder="0"
                        />
                        <p className="text-xs text-muted-foreground mt-1">{t('Thuế sẽ được tự động cộng thêm vào mọi giao dịch thanh toán')}</p>
                      </div>
                      <Button size="sm" onClick={() => saveTaxSettings.mutate()} disabled={saveTaxSettings.isPending}>
                        {saveTaxSettings.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang lưu...')}</> : t('Lưu')}
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

                  {/* New booking SMS/email notification to owner */}
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
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">{t('Email khi có lịch mới')}</p>
                        <p className="text-xs text-muted-foreground">{t('Gửi email đến chủ tiệm khi khách đặt lịch mới')}</p>
                      </div>
                      <Switch checked={notifyEmailEnabled} onCheckedChange={setNotifyEmailEnabled} />
                    </div>
                    {notifyEmailEnabled && (
                      <div>
                        <Label>{t('Email nhận thông báo')}</Label>
                        <Input
                          value={notifyEmail}
                          onChange={e => setNotifyEmail(e.target.value)}
                          placeholder="owner@example.com"
                          className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">{t('Email chủ tiệm nhận thông báo khi có lịch hẹn mới. Cần cấu hình Resend trong Cài đặt email.')}</p>
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
