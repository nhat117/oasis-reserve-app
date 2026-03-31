import { useState, useMemo, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase, TENANT_ID } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, CalendarIcon, Check, Loader2 } from 'lucide-react';
import { format, addMinutes, isBefore, isToday, startOfDay } from 'date-fns';
import { vi as viLocale, enAU } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/useI18n';
import Header from '@/components/Header';
import { bookingCustomerSchema, validateField, escapeHtml } from '@/lib/validation';

const Booking = () => {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { formatPrice, t, lang } = useI18n();
  const dateLocale = lang === 'vi' ? viLocale : enAU;

  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState(searchParams.get('service') || '');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedTherapist, setSelectedTherapist] = useState('any');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [assignedTherapistName, setAssignedTherapistName] = useState('');
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [redirectingToPayment, setRedirectingToPayment] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleBlur = useCallback((field: 'customerName' | 'customerPhone' | 'customerEmail', value: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setFieldErrors(prev => ({ ...prev, [field]: validateField(bookingCustomerSchema, field, value) }));
  }, []);

  const handleFieldChange = useCallback((field: 'customerName' | 'customerPhone' | 'customerEmail', value: string) => {
    if (touched[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: validateField(bookingCustomerSchema, field, value) }));
    }
  }, [touched]);

  const isStep3Valid = useMemo(() => {
    return bookingCustomerSchema.safeParse({ customerName, customerPhone, customerEmail }).success;
  }, [customerName, customerPhone, customerEmail]);

  // Check if Stripe online payment is enabled
  const { data: stripeEnabled } = useQuery({
    queryKey: ['stripe-enabled-public'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'stripe_payment_enabled').single();
      return data?.value === 'true';
    },
  });

  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('*').eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  const { data: therapists } = useQuery({
    queryKey: ['therapists'],
    queryFn: async () => {
      const { data, error } = await supabase.from('therapists').select('*').eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  const { data: randomEnabled } = useQuery({
    queryKey: ['random-therapist-setting'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'random_therapist_enabled').single();
      if (error) return true;
      return data.value === 'true';
    },
  });

  const { data: unavailability } = useQuery({
    queryKey: ['therapist-unavailability', selectedDate?.toISOString()],
    queryFn: async () => {
      if (!selectedDate) return [];
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data, error } = await supabase.from('therapist_unavailability').select('therapist_id').eq('unavailable_date', dateStr);
      if (error) throw error;
      return data.map(d => d.therapist_id);
    },
    enabled: !!selectedDate,
  });

  const { data: shopHolidays } = useQuery({
    queryKey: ['shop-holidays-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shop_holidays').select('*');
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch holiday settings and public holidays for the region
  const { data: holidaySettings } = useQuery({
    queryKey: ['holiday-booking-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('key, value').in('key', ['show_holiday_closed', 'shop_state', 'open_days']);
      const map: Record<string, string> = {};
      data?.forEach(r => { map[r.key] = r.value; });
      return map;
    },
  });

  const blockPublicHolidays = holidaySettings?.show_holiday_closed === 'true';
  const shopState = holidaySettings?.shop_state || 'VIC';
  const openDays: number[] = holidaySettings?.open_days ? JSON.parse(holidaySettings.open_days) : [1, 2, 3, 4, 5, 6];

  const { data: publicHolidays } = useQuery({
    queryKey: ['public-holidays-booking', shopState],
    queryFn: async () => {
      const year = new Date().getFullYear();
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/AU`);
      if (!res.ok) return [];
      const holidays: Array<{ date: string; localName: string; name: string; counties: string[] | null }> = await res.json();
      const stateCode = `AU-${shopState}`;
      return holidays.filter(h => !h.counties || h.counties.includes(stateCode));
    },
    enabled: blockPublicHolidays,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const publicHolidayDates = useMemo(() => {
    if (!publicHolidays) return new Set<string>();
    return new Set(publicHolidays.map(h => h.date));
  }, [publicHolidays]);

  const todayHoliday = selectedDate ? shopHolidays?.find((h: any) => h.holiday_date === format(selectedDate, 'yyyy-MM-dd')) : null;
  const isShopHoliday = todayHoliday && !todayHoliday.early_close_hour;
  const earlyCloseHour = todayHoliday?.early_close_hour as number | undefined;
  const isPublicHoliday = selectedDate ? publicHolidayDates.has(format(selectedDate, 'yyyy-MM-dd')) : false;
  const publicHolidayName = selectedDate && isPublicHoliday ? publicHolidays?.find(h => h.date === format(selectedDate, 'yyyy-MM-dd'))?.localName : '';

  const { data: existingBookings } = useQuery({
    queryKey: ['bookings-availability', selectedDate?.toISOString()],
    queryFn: async () => {
      if (!selectedDate) return [];
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data, error } = await supabase.from('bookings').select('*')
        .eq('booking_date', dateStr)
        .neq('status', 'cancelled');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedDate,
  });

  const currentService = services?.find(s => s.id === selectedService);
  const addOnServices = services?.filter(s => selectedAddOns.includes(s.id)) || [];
  const totalDuration = (currentService?.duration_minutes || 0) + addOnServices.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalPrice = (currentService?.price || 0) + addOnServices.reduce((sum, s) => sum + s.price, 0);

  const BUFFER_MINUTES = 15;

  const getAvailableTherapists = (timeStr: string, duration: number) => {
    if (!therapists || !selectedDate) return [];
    const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();
    const endStr = format(addMinutes(new Date(`2000-01-01T${timeStr}`), duration), 'HH:mm');

    return therapists.filter(t => {
      if (unavailability?.includes(t.id)) return false;
      if (!t.working_days.includes(dayOfWeek)) return false;
      const slotHour = parseInt(timeStr);
      const slotMin = parseInt(timeStr.split(':')[1]);
      const endHour = parseInt(endStr);
      const endMin = parseInt(endStr.split(':')[1]);
      const endTotalMin = endHour * 60 + endMin;
      const therapistEndMin = t.end_hour * 60;
      if (slotHour < t.start_hour || endTotalMin > therapistEndMin) return false;
      const tAny = t as any;
      if (tAny.break_start != null && tAny.break_end != null) {
        const breakStart = tAny.break_start * 60;
        const breakEnd = tAny.break_end * 60;
        const slotStartMin = slotHour * 60 + slotMin;
        const slotEndMin = endHour * 60 + endMin;
        if (slotStartMin < breakEnd && slotEndMin > breakStart) return false;
      }
      const slotStartMin = parseInt(timeStr.split(':')[0]) * 60 + parseInt(timeStr.split(':')[1]);
      const slotEndMin = parseInt(endStr.split(':')[0]) * 60 + parseInt(endStr.split(':')[1]);
      const isBooked = existingBookings?.some(b => {
        if (b.therapist_id !== t.id) return false;
        const bStartParts = b.start_time.split(':');
        const bEndParts = b.end_time.split(':');
        const bStartMin = parseInt(bStartParts[0]) * 60 + parseInt(bStartParts[1]);
        const bEndMin = parseInt(bEndParts[0]) * 60 + parseInt(bEndParts[1]);
        return slotStartMin < (bEndMin + BUFFER_MINUTES) && slotEndMin > (bStartMin - BUFFER_MINUTES);
      });
      return !isBooked;
    });
  };

  const availableSlots = useMemo(() => {
    if (!currentService || !selectedDate || !therapists || isShopHoliday) return [];
    const duration = totalDuration;
    const slots: { time: string; therapistCount: number }[] = [];
    const now = new Date();
    const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();

    const workingTherapists = therapists.filter(t => t.working_days.includes(dayOfWeek));
    if (workingTherapists.length === 0) return [];

    const minStart = Math.min(...workingTherapists.map(t => t.start_hour));
    const maxEnd = Math.max(...workingTherapists.map(t => t.end_hour));

    for (let h = minStart; h < maxEnd; h++) {
      for (let m = 0; m < 60; m += 30) {
        const slotStart = new Date(selectedDate);
        slotStart.setHours(h, m, 0, 0);
        const slotEnd = addMinutes(slotStart, duration);

        const effectiveMaxEnd = earlyCloseHour ? Math.min(maxEnd, earlyCloseHour) : maxEnd;
        if (slotEnd.getHours() > effectiveMaxEnd || (slotEnd.getHours() === effectiveMaxEnd && slotEnd.getMinutes() > 0)) continue;
        if (isToday(selectedDate) && isBefore(slotStart, now)) continue;

        const startStr = format(slotStart, 'HH:mm');
        const available = getAvailableTherapists(startStr, duration);

        if (selectedTherapist !== 'any') {
          const isAvail = available.some(t => t.id === selectedTherapist);
          if (isAvail) slots.push({ time: startStr, therapistCount: 1 });
        } else {
          if (available.length > 0) slots.push({ time: startStr, therapistCount: available.length });
        }
      }
    }
    return slots;
  }, [currentService, selectedDate, existingBookings, selectedTherapist, therapists, unavailability, earlyCloseHour, isShopHoliday, totalDuration]);

  const handleSubmit = async () => {
    if (!currentService || !selectedDate || !selectedTime) return;
    setIsSubmitting(true);

    const startTime = selectedTime + ':00';
    const endDate = addMinutes(new Date(`2000-01-01T${selectedTime}`), totalDuration);
    const endTime = format(endDate, 'HH:mm') + ':00';

    let therapistId = selectedTherapist;
    if (selectedTherapist === 'any') {
      const available = getAvailableTherapists(selectedTime, currentService.duration_minutes);
      if (available.length === 0) {
        toast({ title: t('Lỗi'), description: t('Không còn thợ trống. Vui lòng chọn giờ khác.'), variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }
      // Round-robin: pick the available therapist with fewest bookings today
      const bookingCounts: Record<string, number> = {};
      existingBookings?.forEach(b => {
        if (b.status !== 'cancelled') {
          bookingCounts[b.therapist_id] = (bookingCounts[b.therapist_id] || 0) + 1;
        }
      });
      const sorted = [...available].sort((a, b) => {
        const countDiff = (bookingCounts[a.id] || 0) - (bookingCounts[b.id] || 0);
        if (countDiff !== 0) return countDiff;
        return a.id.localeCompare(b.id); // stable tie-break
      });
      const picked = sorted[0];
      therapistId = picked.id;
      setAssignedTherapistName(picked.name);
    } else {
      const th = therapists?.find(t => t.id === therapistId);
      setAssignedTherapistName(th?.name || '');
    }

    const bookingId = crypto.randomUUID();
    const bookingDateStr = format(selectedDate, 'yyyy-MM-dd');
    const therapistName = therapists?.find(t => t.id === therapistId)?.name || '';

    const addOnNames = addOnServices.map(s => s.name).join(', ');
    const notesText = addOnNames ? `Add-ons: ${addOnNames}` : null;

    const { error } = await supabase.from('bookings').insert({
      id: bookingId,
      service_id: selectedService,
      therapist_id: therapistId,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      customer_email: customerEmail.trim(),
      booking_date: bookingDateStr,
      start_time: startTime,
      end_time: endTime,
      status: 'confirmed',
      notes: notesText,
      ...(TENANT_ID ? { tenant_id: TENANT_ID } : {}),
    });

    setIsSubmitting(false);
    if (error) {
      toast({ title: t('Lỗi'), description: t('Không thể đặt lịch. Vui lòng thử lại.'), variant: 'destructive' });
    } else {
      // If Stripe is configured and there's a price, redirect to payment
      if (stripeEnabled && totalPrice > 0) {
        setRedirectingToPayment(true);
        try {
          const origin = window.location.origin;
          const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-stripe-checkout', {
            body: {
              booking_id: bookingId,
              service_name: currentService?.name || 'Booking',
              total_amount: totalPrice,
              customer_email: customerEmail.trim() || undefined,
              customer_name: customerName.trim(),
              success_url: `${origin}/booking/success`,
              cancel_url: `${origin}/booking/cancel`,
            },
          });

          if (checkoutError || !checkoutData?.url) {
            console.error('Stripe checkout error:', checkoutError || checkoutData);
            // Fall back to normal confirmation if payment fails
            setRedirectingToPayment(false);
            setBookingComplete(true);
            toast({ title: t('Đặt lịch thành công'), description: t('Nhưng không thể chuyển đến trang thanh toán. Vui lòng thanh toán tại quầy.') });
          } else {
            const checkoutUrl = checkoutData.url;
            if (typeof checkoutUrl !== 'string' || !checkoutUrl.startsWith('https://checkout.stripe.com/')) {
              console.error('Invalid Stripe checkout URL');
              setRedirectingToPayment(false);
              setBookingComplete(true);
              toast({ title: t('Đặt lịch thành công'), description: t('Nhưng không thể chuyển đến trang thanh toán. Vui lòng thanh toán tại quầy.') });
              return;
            }
            window.location.href = checkoutUrl;
            return;
          }
        } catch (err) {
          console.error('Failed to create checkout:', err);
          setRedirectingToPayment(false);
          setBookingComplete(true);
        }
      } else {
        setBookingComplete(true);
      }

      // Send confirmation email
      if (customerEmail.trim()) {
        const esc = escapeHtml;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1a1a1a; font-size: 22px;">Booking Confirmed!</h1>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">Hi <strong>${esc(customerName.trim())}</strong>, your booking has been confirmed.</p>
            <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 4px 0;"><strong>Service:</strong> ${esc(currentService?.name || '')}</p>
              <p style="margin: 4px 0;"><strong>Date:</strong> ${format(selectedDate, 'dd/MM/yyyy')}</p>
              <p style="margin: 4px 0;"><strong>Time:</strong> ${selectedTime} - ${format(endDate, 'HH:mm')}</p>
              <p style="margin: 4px 0;"><strong>Therapist:</strong> ${esc(therapistName)}</p>
            </div>
            <p style="color: #555; font-size: 14px;">Thank you for choosing Oasis Reserve. We look forward to seeing you!</p>
          </div>
        `;
        supabase.functions.invoke('send-email-resend', {
          body: {
            to: customerEmail.trim(),
            subject: `Booking Confirmed - ${currentService?.name || 'Oasis Reserve'}`,
            html: emailHtml,
          },
        }).catch(err => console.error('Failed to send confirmation email:', err));
      }
    }
  };

  const selectedTherapistName = selectedTherapist === 'any'
    ? (assignedTherapistName || t('Tự động chọn'))
    : therapists?.find(t => t.id === selectedTherapist)?.name || '';

  const stepLabels = [
    t('Dịch vụ'),
    t('Ngày & Giờ'),
    t('Thông tin'),
    t('Xác nhận'),
  ];

  if (redirectingToPayment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <Loader2 className="h-8 w-8 animate-spin text-[#6b4c3b] mx-auto" />
          <div className="space-y-2">
            <h1 className="text-2xl font-light">{t('Đang chuyển đến trang thanh toán...')}</h1>
            <p className="text-muted-foreground text-sm">{t('Vui lòng chờ trong giây lát')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (bookingComplete) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="mx-auto w-16 h-16 rounded-full border-2 border-primary/20 flex items-center justify-center">
            <Check className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-light">{t('Đặt lịch thành công!')}</h1>
            <p className="text-muted-foreground text-sm">{t('Cảm ơn bạn đã đặt lịch. Chúng tôi sẽ liên hệ xác nhận.')}</p>
          </div>
          <div className="text-left border border-border/60 p-5 space-y-3 text-sm">
            <p className="flex justify-between"><span className="text-muted-foreground">{t('Dịch vụ')}</span> <span className="font-medium">{currentService?.name}</span></p>
            <div className="h-px bg-border/40" />
            <p className="flex justify-between"><span className="text-muted-foreground">{t('Ngày')}</span> <span className="font-medium">{selectedDate && format(selectedDate, 'dd/MM/yyyy')}</span></p>
            <div className="h-px bg-border/40" />
            <p className="flex justify-between"><span className="text-muted-foreground">{t('Giờ')}</span> <span className="font-medium">{selectedTime}</span></p>
            <div className="h-px bg-border/40" />
            <p className="flex justify-between"><span className="text-muted-foreground">{t('Thợ')}</span> <span className="font-medium">{assignedTherapistName || selectedTherapistName}</span></p>
            <div className="h-px bg-border/40" />
            <p className="flex justify-between"><span className="text-muted-foreground">{t('Khách')}</span> <span className="font-medium">{customerName}</span></p>
            {customerEmail && (
              <>
                <div className="h-px bg-border/40" />
                <p className="flex justify-between"><span className="text-muted-foreground">Email</span> <span className="font-medium">{customerEmail}</span></p>
              </>
            )}
          </div>
          <Link to="/">
            <Button className="rounded-none text-xs tracking-[0.15em] uppercase px-10 h-11">
              {t('Về trang chủ')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="pt-20 sm:pt-24 pb-12 sm:pb-16 max-w-lg mx-auto px-4 sm:px-6">
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground transition-colors mb-8 sm:mb-12">
          <ArrowLeft className="h-3.5 w-3.5" /> {t('Trang chủ')}
        </Link>

        {/* Title */}
        <div className="mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl font-light leading-tight mb-2">{t('Đặt lịch hẹn')}</h1>
          <p className="text-muted-foreground text-sm">{t('Hoàn thành các bước bên dưới')}</p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-1 mb-8 sm:mb-12">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div className={cn(
                "h-0.5 w-full transition-colors duration-300",
                i + 1 <= step ? "bg-foreground" : "bg-border"
              )} />
              <span className={cn(
                "text-[9px] sm:text-[10px] tracking-[0.15em] uppercase transition-colors",
                i + 1 <= step ? "text-foreground" : "text-muted-foreground/50"
              )}>{label}</span>
            </div>
          ))}
        </div>

        {/* Step 1: Service */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <p className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">{t('Dịch vụ chính')}</p>
              <div className="space-y-2">
                {services?.map(service => (
                  <button
                    key={service.id}
                    onClick={() => { setSelectedService(service.id); setSelectedAddOns(prev => prev.filter(id => id !== service.id)); }}
                    className={cn(
                      "w-full text-left p-4 sm:p-5 border transition-all duration-200",
                      selectedService === service.id
                        ? "border-foreground bg-foreground/[0.02]"
                        : "border-border/60 hover:border-foreground/30"
                    )}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="space-y-1">
                        <div className="text-sm sm:text-base font-light">{service.name}</div>
                        {service.description && <div className="text-xs text-muted-foreground leading-relaxed">{service.description}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-light">{formatPrice(service.price)}</div>
                        <div className="text-[10px] text-muted-foreground">{service.duration_minutes} {t('phút')}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedService && services && services.filter(s => s.id !== selectedService).length > 0 && (
              <div>
                <p className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">{t('Dịch vụ thêm (không bắt buộc)')}</p>
                <div className="space-y-2">
                  {services.filter(s => s.id !== selectedService).map(service => {
                    const isSelected = selectedAddOns.includes(service.id);
                    return (
                      <button
                        key={service.id}
                        onClick={() => setSelectedAddOns(prev => isSelected ? prev.filter(id => id !== service.id) : [...prev, service.id])}
                        className={cn(
                          "w-full text-left p-3 sm:p-4 border transition-all duration-200 flex items-center gap-3",
                          isSelected
                            ? "border-foreground bg-foreground/[0.02]"
                            : "border-border/60 hover:border-foreground/30"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 border flex items-center justify-center shrink-0",
                          isSelected ? "border-foreground bg-foreground" : "border-muted-foreground/30"
                        )}>
                          {isSelected && <Check className="h-2.5 w-2.5 text-background" />}
                        </div>
                        <div className="flex-1 flex justify-between items-center gap-2">
                          <div>
                            <div className="text-sm font-light">{service.name}</div>
                            {service.description && <div className="text-xs text-muted-foreground">{service.description}</div>}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-light">{formatPrice(service.price)}</div>
                            <div className="text-[10px] text-muted-foreground">{service.duration_minutes} {t('phút')}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedService && (
              <div className="flex items-center justify-between pt-4 border-t border-border/40">
                <div className="text-sm text-muted-foreground">
                  {totalDuration} {t('phút')} · {formatPrice(totalPrice)}
                </div>
                <Button onClick={() => setStep(2)} className="rounded-none text-xs tracking-[0.15em] uppercase px-6 h-10">
                  {t('Tiếp tục')}
                  <ArrowRight className="ml-2 h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Date & Time */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <p className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">{t('Ngày')}</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-light rounded-none h-11 border-border/60", !selectedDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : t('Chọn ngày')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => { setSelectedDate(d); setSelectedTime(''); }}
                    disabled={(date) => {
                      if (isBefore(startOfDay(date), startOfDay(new Date()))) return true;
                      const dateStr = format(date, 'yyyy-MM-dd');
                      // Shop-specific holidays
                      const holiday = shopHolidays?.find((h: any) => h.holiday_date === dateStr);
                      if (holiday && !holiday.early_close_hour) return true;
                      // Public holidays (when toggle is on)
                      if (blockPublicHolidays && publicHolidayDates.has(dateStr)) return true;
                      // Closed days from settings
                      const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
                      if (!openDays.includes(dayOfWeek)) return true;
                      // No working therapists
                      if (therapists) {
                        const hasWorkingTherapist = therapists.some(th => th.working_days.includes(dayOfWeek));
                        if (!hasWorkingTherapist) return true;
                      }
                      return false;
                    }}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {(isShopHoliday || (blockPublicHolidays && isPublicHoliday)) && (
                <p className="text-sm text-destructive mt-2">
                  {t('Tiệm nghỉ ngày này.')} {publicHolidayName && `(${publicHolidayName})`} {t('Vui lòng chọn ngày khác.')}
                </p>
              )}
              {earlyCloseHour && !isShopHoliday && (
                <p className="text-sm text-amber-600 mt-2">{t('Tiệm đóng cửa sớm lúc')} {earlyCloseHour}:00 {t('ngày này.')}</p>
              )}
            </div>

            {selectedDate && (
              <div>
                <p className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">{t('Thợ phục vụ')}</p>
                <Select value={selectedTherapist} onValueChange={(v) => { setSelectedTherapist(v); setSelectedTime(''); }}>
                  <SelectTrigger className="rounded-none h-11 border-border/60 font-light"><SelectValue placeholder={t('Chọn thợ')} /></SelectTrigger>
                  <SelectContent>
                    {randomEnabled !== false && (
                      <SelectItem value="any">{t('Tự động chọn (bất kỳ thợ trống)')}</SelectItem>
                    )}
                    {therapists?.filter(t => !unavailability?.includes(t.id)).map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.start_hour}:00–{t.end_hour}:00)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedDate && (
              <div>
                <p className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">{t('Giờ')}</p>
                {availableSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('Không có khung giờ trống. Vui lòng chọn ngày hoặc thợ khác.')}</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {availableSlots.map(slot => (
                      <button
                        key={slot.time}
                        onClick={() => setSelectedTime(slot.time)}
                        className={cn(
                          "h-10 text-sm font-light border transition-all duration-200 relative",
                          selectedTime === slot.time
                            ? "border-foreground bg-foreground text-background"
                            : "border-border/60 hover:border-foreground/30"
                        )}
                      >
                        {slot.time}
                        {selectedTherapist === 'any' && (
                          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 text-[8px] bg-muted text-muted-foreground flex items-center justify-center rounded-full">
                            {slot.therapistCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-border/40">
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-none text-xs tracking-[0.15em] uppercase h-10 border-border/60">
                {t('Quay lại')}
              </Button>
              <Button
                className="flex-1 rounded-none text-xs tracking-[0.15em] uppercase h-10"
                disabled={!selectedDate || !selectedTime}
                onClick={() => setStep(3)}
              >
                {t('Tiếp tục')}
                <ArrowRight className="ml-2 h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Customer Info */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <p className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">{t('Họ và tên')} <span className="text-destructive">*</span></p>
              <Input
                value={customerName}
                onChange={e => { setCustomerName(e.target.value); handleFieldChange('customerName', e.target.value); }}
                onBlur={() => handleBlur('customerName', customerName)}
                placeholder={t('Nhập họ tên')}
                className={cn("rounded-none h-11 border-border/60 font-light", touched.customerName && fieldErrors.customerName && "border-destructive focus-visible:ring-destructive")}
              />
              {touched.customerName && fieldErrors.customerName && (
                <p className="text-xs text-destructive mt-1.5">{t(fieldErrors.customerName)}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">{t('Số điện thoại')} <span className="text-destructive">*</span></p>
              <Input
                value={customerPhone}
                onChange={e => { setCustomerPhone(e.target.value); handleFieldChange('customerPhone', e.target.value); }}
                onBlur={() => handleBlur('customerPhone', customerPhone)}
                placeholder="0901234567"
                className={cn("rounded-none h-11 border-border/60 font-light", touched.customerPhone && fieldErrors.customerPhone && "border-destructive focus-visible:ring-destructive")}
              />
              {touched.customerPhone && fieldErrors.customerPhone && (
                <p className="text-xs text-destructive mt-1.5">{t(fieldErrors.customerPhone)}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">Email <span className="text-destructive">*</span></p>
              <Input
                type="email"
                value={customerEmail}
                onChange={e => { setCustomerEmail(e.target.value); handleFieldChange('customerEmail', e.target.value); }}
                onBlur={() => handleBlur('customerEmail', customerEmail)}
                placeholder="email@example.com"
                className={cn("rounded-none h-11 border-border/60 font-light", touched.customerEmail && fieldErrors.customerEmail && "border-destructive focus-visible:ring-destructive")}
              />
              {touched.customerEmail && fieldErrors.customerEmail && (
                <p className="text-xs text-destructive mt-1.5">{t(fieldErrors.customerEmail)}</p>
              )}
            </div>
            <div className="flex gap-3 pt-4 border-t border-border/40">
              <Button variant="outline" onClick={() => setStep(2)} className="rounded-none text-xs tracking-[0.15em] uppercase h-10 border-border/60">
                {t('Quay lại')}
              </Button>
              <Button
                className="flex-1 rounded-none text-xs tracking-[0.15em] uppercase h-10"
                disabled={!isStep3Valid}
                onClick={() => {
                  const result = bookingCustomerSchema.safeParse({ customerName, customerPhone, customerEmail });
                  if (!result.success) {
                    const errors: Record<string, string | null> = {};
                    const allTouched: Record<string, boolean> = {};
                    result.error.errors.forEach(err => {
                      const field = err.path[0] as string;
                      errors[field] = err.message;
                      allTouched[field] = true;
                    });
                    setFieldErrors(prev => ({ ...prev, ...errors }));
                    setTouched(prev => ({ ...prev, ...allTouched }));
                    return;
                  }
                  setStep(4);
                }}
              >
                {t('Tiếp tục')}
                <ArrowRight className="ml-2 h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="border border-border/60 p-5 space-y-3 text-sm">
              <p className="flex justify-between"><span className="text-muted-foreground">{t('Dịch vụ')}</span> <span className="font-light">{currentService?.name}</span></p>
              {addOnServices.length > 0 && (
                <>
                  <div className="h-px bg-border/40" />
                  <p className="flex justify-between"><span className="text-muted-foreground">{t('Dịch vụ thêm')}</span> <span className="font-light text-right">{addOnServices.map(s => s.name).join(', ')}</span></p>
                </>
              )}
              <div className="h-px bg-border/40" />
              <p className="flex justify-between"><span className="text-muted-foreground">{t('Ngày')}</span> <span className="font-light">{selectedDate && format(selectedDate, 'dd/MM/yyyy')}</span></p>
              <div className="h-px bg-border/40" />
              <p className="flex justify-between"><span className="text-muted-foreground">{t('Giờ')}</span> <span className="font-light">{selectedTime}</span></p>
              <div className="h-px bg-border/40" />
              <p className="flex justify-between"><span className="text-muted-foreground">{t('Thời lượng')}</span> <span className="font-light">{totalDuration} {t('phút')}</span></p>
              <div className="h-px bg-border/40" />
              <p className="flex justify-between"><span className="text-muted-foreground">{t('Thợ')}</span> <span className="font-light">{selectedTherapistName}</span></p>
              <div className="h-px bg-border/40" />
              <p className="flex justify-between"><span className="text-muted-foreground">{t('Khách')}</span> <span className="font-light">{customerName}</span></p>
              <div className="h-px bg-border/40" />
              <p className="flex justify-between"><span className="text-muted-foreground">{t('SĐT')}</span> <span className="font-light">{customerPhone}</span></p>
              {customerEmail && (
                <>
                  <div className="h-px bg-border/40" />
                  <p className="flex justify-between"><span className="text-muted-foreground">Email</span> <span className="font-light">{customerEmail}</span></p>
                </>
              )}
              <div className="h-px bg-border/40" />
              <p className="flex justify-between"><span className="text-muted-foreground">{t('Giá')}</span> <span className="font-medium">{formatPrice(totalPrice)}</span></p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(3)} className="rounded-none text-xs tracking-[0.15em] uppercase h-10 border-border/60">
                {t('Quay lại')}
              </Button>
              <Button
                className="flex-1 rounded-none text-xs tracking-[0.15em] uppercase h-10"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? t('Đang xử lý...') : t('Xác nhận đặt lịch')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Booking;
