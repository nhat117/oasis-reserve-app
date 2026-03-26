import { useState, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, CalendarIcon, Check } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import { format, addMinutes, isBefore, isToday, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { LanguageSwitcher, useI18n } from '@/hooks/useI18n';

const Booking = () => {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { formatPrice, t } = useI18n();

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

  const todayHoliday = selectedDate ? shopHolidays?.find((h: any) => h.holiday_date === format(selectedDate, 'yyyy-MM-dd')) : null;
  const isShopHoliday = todayHoliday && !todayHoliday.early_close_hour;
  const earlyCloseHour = todayHoliday?.early_close_hour as number | undefined;

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

  // Buffer time between services (in minutes)
  const BUFFER_MINUTES = 15;

  // Find available therapists for a given time slot
  const getAvailableTherapists = (timeStr: string, duration: number) => {
    if (!therapists || !selectedDate) return [];
    const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();
    const endStr = format(addMinutes(new Date(`2000-01-01T${timeStr}`), duration), 'HH:mm');

    return therapists.filter(t => {
      // Check unavailability
      if (unavailability?.includes(t.id)) return false;
      // Check working days
      if (!t.working_days.includes(dayOfWeek)) return false;
      // Check working hours
      const slotHour = parseInt(timeStr);
      const slotMin = parseInt(timeStr.split(':')[1]);
      const endHour = parseInt(endStr);
      const endMin = parseInt(endStr.split(':')[1]);
      if (slotHour < t.start_hour || endHour > t.end_hour) return false;
      // Check break time
      const tAny = t as any;
      if (tAny.break_start != null && tAny.break_end != null) {
        const breakStart = tAny.break_start * 60;
        const breakEnd = tAny.break_end * 60;
        const slotStartMin = slotHour * 60 + slotMin;
        const slotEndMin = endHour * 60 + endMin;
        // Slot overlaps with break if it starts before break ends and ends after break starts
        if (slotStartMin < breakEnd && slotEndMin > breakStart) return false;
      }
      // Check if already booked (with buffer time between services)
      const slotStartMin = parseInt(timeStr.split(':')[0]) * 60 + parseInt(timeStr.split(':')[1]);
      const slotEndMin = parseInt(endStr.split(':')[0]) * 60 + parseInt(endStr.split(':')[1]);
      const isBooked = existingBookings?.some(b => {
        if (b.therapist_id !== t.id) return false;
        const bStartParts = b.start_time.split(':');
        const bEndParts = b.end_time.split(':');
        const bStartMin = parseInt(bStartParts[0]) * 60 + parseInt(bStartParts[1]);
        const bEndMin = parseInt(bEndParts[0]) * 60 + parseInt(bEndParts[1]);
        // Add buffer: new slot must not overlap with [bStart - buffer, bEnd + buffer]
        return slotStartMin < (bEndMin + BUFFER_MINUTES) && slotEndMin > (bStartMin - BUFFER_MINUTES);
      });
      return !isBooked;
    });
  };

  const availableSlots = useMemo(() => {
    if (!currentService || !selectedDate || !therapists || isShopHoliday) return [];
    const duration = currentService.duration_minutes;
    const slots: { time: string; therapistCount: number }[] = [];
    const now = new Date();
    const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();

    // Get the widest working hours range from all therapists working that day
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

        // If specific therapist selected, check only that one
        if (selectedTherapist !== 'any') {
          const isAvail = available.some(t => t.id === selectedTherapist);
          if (isAvail) slots.push({ time: startStr, therapistCount: 1 });
        } else {
          if (available.length > 0) slots.push({ time: startStr, therapistCount: available.length });
        }
      }
    }
    return slots;
  }, [currentService, selectedDate, existingBookings, selectedTherapist, therapists, unavailability, earlyCloseHour, isShopHoliday]);

  const handleSubmit = async () => {
    if (!currentService || !selectedDate || !selectedTime) return;
    setIsSubmitting(true);

    const startTime = selectedTime + ':00';
    const endDate = addMinutes(new Date(`2000-01-01T${selectedTime}`), currentService.duration_minutes);
    const endTime = format(endDate, 'HH:mm') + ':00';

    // Determine therapist
    let therapistId = selectedTherapist;
    if (selectedTherapist === 'any') {
      const available = getAvailableTherapists(selectedTime, currentService.duration_minutes);
      if (available.length === 0) {
        toast({ title: t('Lỗi'), description: t('Không còn thợ trống. Vui lòng chọn giờ khác.'), variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }
      // Random pick
      const picked = available[Math.floor(Math.random() * available.length)];
      therapistId = picked.id;
      setAssignedTherapistName(picked.name);
    } else {
      const t = therapists?.find(t => t.id === therapistId);
      setAssignedTherapistName(t?.name || '');
    }

    const bookingId = crypto.randomUUID();
    const bookingDateStr = format(selectedDate, 'yyyy-MM-dd');
    const therapistName = therapists?.find(t => t.id === therapistId)?.name || '';

    const { error } = await supabase.from('bookings').insert({
      id: bookingId,
      service_id: selectedService,
      therapist_id: therapistId,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      customer_email: customerEmail.trim() || null,
      booking_date: bookingDateStr,
      start_time: startTime,
      end_time: endTime,
      status: 'confirmed',
    });

    setIsSubmitting(false);
    if (error) {
      toast({ title: t('Lỗi'), description: t('Không thể đặt lịch. Vui lòng thử lại.'), variant: 'destructive' });
    } else {
      setBookingComplete(true);
      // Send confirmation email if customer provided email
      if (customerEmail.trim()) {
        supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'booking-confirmation',
            recipientEmail: customerEmail.trim(),
            idempotencyKey: `booking-confirm-${bookingId}`,
            templateData: {
              customerName: customerName.trim(),
              serviceName: currentService?.name || '',
              therapistName,
              bookingDate: format(selectedDate, 'dd/MM/yyyy'),
              startTime: selectedTime,
              endTime: format(endDate, 'HH:mm'),
            },
          },
        }).catch(err => console.error('Failed to send confirmation email:', err));
      }
    }
  };

  const selectedTherapistName = selectedTherapist === 'any'
    ? (assignedTherapistName || t('Tự động chọn'))
    : therapists?.find(t => t.id === selectedTherapist)?.name || '';

  if (bookingComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">{t('Đặt lịch thành công!')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-left bg-muted rounded-lg p-4 space-y-2 text-sm">
              <p><strong>{t('Dịch vụ')}:</strong> {currentService?.name}</p>
              <p><strong>{t('Ngày')}:</strong> {selectedDate && format(selectedDate, 'dd/MM/yyyy')}</p>
              <p><strong>{t('Giờ')}:</strong> {selectedTime}</p>
              <p><strong>{t('Thợ')}:</strong> {assignedTherapistName || selectedTherapistName}</p>
              <p><strong>{t('Khách')}:</strong> {customerName}</p>
              <p><strong>{t('SĐT')}:</strong> {customerPhone}</p>
              {customerEmail && <p><strong>Email:</strong> {customerEmail}</p>}
            </div>
            <p className="text-muted-foreground text-sm">{t('Cảm ơn bạn đã đặt lịch. Chúng tôi sẽ liên hệ xác nhận.')}</p>
            <Link to="/">
              <Button className="w-full">{t('Về trang chủ')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoImg} alt="Royal Head Spa" className="h-10 w-10 object-contain" />
            <span className="text-xl font-semibold font-serif text-primary">Royal Head Spa</span>
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-xl">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> {t('Trang chủ')}
        </Link>

        <h1 className="text-3xl font-bold mb-2">{t('Đặt lịch hẹn')}</h1>
        <p className="text-muted-foreground mb-6">{t('Hoàn thành các bước bên dưới')}</p>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={cn(
              "h-2 flex-1 rounded-full transition-colors",
              s <= step ? "bg-primary" : "bg-muted"
            )} />
          ))}
        </div>

        {/* Step 1: Service */}
        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>{t('1. Chọn dịch vụ')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {services?.map(service => (
                <button
                  key={service.id}
                  onClick={() => { setSelectedService(service.id); setStep(2); }}
                  className={cn(
                    "w-full text-left p-4 rounded-lg border transition-colors",
                    selectedService === service.id ? "border-primary bg-primary/5" : "hover:border-primary/50"
                  )}
                >
                   <div className="font-medium">{service.name}</div>
                   <div className="text-sm text-muted-foreground mt-1">{service.duration_minutes} {t('phút')} · {formatPrice(service.price)}</div>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Date & Time */}
        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>{t('2. Chọn ngày & giờ')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('Ngày')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1", !selectedDate && "text-muted-foreground")}>
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
                        if (date.getDay() === 0) return true;
                        const holiday = shopHolidays?.find((h: any) => h.holiday_date === format(date, 'yyyy-MM-dd'));
                        if (holiday && !holiday.early_close_hour) return true;
                        return false;
                      }}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {isShopHoliday && (
                  <p className="text-sm text-destructive mt-2">🏖️ {t('Tiệm nghỉ ngày này. Vui lòng chọn ngày khác.')}</p>
                )}
                {earlyCloseHour && !isShopHoliday && (
                  <p className="text-sm text-amber-600 mt-2">⏰ {t('Tiệm đóng cửa sớm lúc')} {earlyCloseHour}:00 {t('ngày này.')}</p>
                )}
              </div>

              {selectedDate && (
                <div>
                  <Label>{t('Thợ phục vụ')}</Label>
                  <Select value={selectedTherapist} onValueChange={(v) => { setSelectedTherapist(v); setSelectedTime(''); }}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder={t('Chọn thợ')} /></SelectTrigger>
                    <SelectContent>
                      {randomEnabled !== false && (
                        <SelectItem value="any">🎲 {t('Tự động chọn (bất kỳ thợ trống)')}</SelectItem>
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
                  <Label>{t('Giờ')}</Label>
                  {availableSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground mt-2">{t('Không có khung giờ trống. Vui lòng chọn ngày hoặc thợ khác.')}</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {availableSlots.map(slot => (
                        <Button
                          key={slot.time}
                          variant={selectedTime === slot.time ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedTime(slot.time)}
                          className="relative"
                        >
                          {slot.time}
                          {selectedTherapist === 'any' && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 text-[9px] rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                              {slot.therapistCount}
                            </span>
                          )}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>{t('Quay lại')}</Button>
                <Button
                  className="flex-1"
                  disabled={!selectedDate || !selectedTime}
                  onClick={() => setStep(3)}
                >
                  {t('Tiếp tục')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Customer Info */}
        {step === 3 && (
          <Card>
            <CardHeader><CardTitle>{t('3. Thông tin của bạn')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">{t('Họ và tên')}</Label>
                <Input id="name" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder={t('Nhập họ tên')} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="phone">{t('Số điện thoại')}</Label>
                <Input id="phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="0901234567" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="email">{t('Email (không bắt buộc)')}</Label>
                <Input id="email" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="email@example.com" className="mt-1" />
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setStep(2)}>{t('Quay lại')}</Button>
                <Button
                  className="flex-1"
                  disabled={!customerName.trim() || !customerPhone.trim()}
                  onClick={() => setStep(4)}
                >
                  {t('Tiếp tục')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <Card>
            <CardHeader><CardTitle>{t('4. Xác nhận đặt lịch')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                <p><strong>{t('Dịch vụ')}:</strong> {currentService?.name}</p>
                <p><strong>{t('Ngày')}:</strong> {selectedDate && format(selectedDate, 'dd/MM/yyyy')}</p>
                <p><strong>{t('Giờ')}:</strong> {selectedTime}</p>
                <p><strong>{t('Thợ')}:</strong> {selectedTherapistName}</p>
                <p><strong>{t('Khách')}:</strong> {customerName}</p>
                <p><strong>{t('SĐT')}:</strong> {customerPhone}</p>
                {customerEmail && <p><strong>Email:</strong> {customerEmail}</p>}
                <p><strong>{t('Giá')}:</strong> {currentService && formatPrice(currentService.price)}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)}>{t('Quay lại')}</Button>
                <Button className="flex-1" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? t('Đang xử lý...') : t('Xác nhận đặt lịch')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Booking;
