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

const Booking = () => {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

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

  // Find available therapists for a given time slot
  const getAvailableTherapists = (timeStr: string, duration: number) => {
    if (!therapists || !selectedDate) return [];
    const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();
    const endStr = format(addMinutes(new Date(`2000-01-01T${timeStr}`), duration), 'HH:mm');

    return therapists.filter(t => {
      // Check working days
      if (!t.working_days.includes(dayOfWeek)) return false;
      // Check working hours
      const slotHour = parseInt(timeStr);
      const endHour = parseInt(endStr);
      if (slotHour < t.start_hour || endHour > t.end_hour) return false;
      // Check if already booked
      const isBooked = existingBookings?.some(b =>
        b.therapist_id === t.id &&
        b.start_time < endStr + ':00' && b.end_time > timeStr + ':00'
      );
      return !isBooked;
    });
  };

  const availableSlots = useMemo(() => {
    if (!currentService || !selectedDate || !therapists) return [];
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

        if (slotEnd.getHours() > maxEnd || (slotEnd.getHours() === maxEnd && slotEnd.getMinutes() > 0)) continue;
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
  }, [currentService, selectedDate, existingBookings, selectedTherapist, therapists]);

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
        toast({ title: 'Lỗi', description: 'Không còn thợ trống. Vui lòng chọn giờ khác.', variant: 'destructive' });
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

    const { error } = await supabase.from('bookings').insert({
      service_id: selectedService,
      therapist_id: therapistId,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      customer_email: customerEmail.trim() || null,
      booking_date: format(selectedDate, 'yyyy-MM-dd'),
      start_time: startTime,
      end_time: endTime,
      status: 'confirmed',
    });

    setIsSubmitting(false);
    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể đặt lịch. Vui lòng thử lại.', variant: 'destructive' });
    } else {
      setBookingComplete(true);
    }
  };

  const selectedTherapistName = selectedTherapist === 'any'
    ? (assignedTherapistName || 'Tự động chọn')
    : therapists?.find(t => t.id === selectedTherapist)?.name || '';

  if (bookingComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Đặt lịch thành công!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-left bg-muted rounded-lg p-4 space-y-2 text-sm">
              <p><strong>Dịch vụ:</strong> {currentService?.name}</p>
              <p><strong>Ngày:</strong> {selectedDate && format(selectedDate, 'dd/MM/yyyy')}</p>
              <p><strong>Giờ:</strong> {selectedTime}</p>
              <p><strong>Thợ:</strong> {assignedTherapistName || selectedTherapistName}</p>
              <p><strong>Khách:</strong> {customerName}</p>
              <p><strong>SĐT:</strong> {customerPhone}</p>
            </div>
            <p className="text-muted-foreground text-sm">Cảm ơn bạn đã đặt lịch. Chúng tôi sẽ liên hệ xác nhận.</p>
            <Link to="/">
              <Button className="w-full">Về trang chủ</Button>
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
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-xl">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Trang chủ
        </Link>

        <h1 className="text-3xl font-bold mb-2">Đặt lịch hẹn</h1>
        <p className="text-muted-foreground mb-6">Hoàn thành các bước bên dưới</p>

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
            <CardHeader><CardTitle>1. Chọn dịch vụ</CardTitle></CardHeader>
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
                  <div className="text-sm text-muted-foreground mt-1">{service.duration_minutes} phút · {new Intl.NumberFormat('vi-VN').format(service.price)}đ</div>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Date & Time */}
        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>2. Chọn ngày & giờ</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Ngày</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1", !selectedDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Chọn ngày'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(d) => { setSelectedDate(d); setSelectedTime(''); }}
                      disabled={(date) => isBefore(startOfDay(date), startOfDay(new Date())) || date.getDay() === 0}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {selectedDate && (
                <div>
                  <Label>Thợ phục vụ</Label>
                  <Select value={selectedTherapist} onValueChange={(v) => { setSelectedTherapist(v); setSelectedTime(''); }}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Chọn thợ" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">🎲 Tự động chọn (bất kỳ thợ trống)</SelectItem>
                      {therapists?.map(t => (
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
                  <Label>Giờ</Label>
                  {availableSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground mt-2">Không có khung giờ trống. Vui lòng chọn ngày hoặc thợ khác.</p>
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
                <Button variant="outline" onClick={() => setStep(1)}>Quay lại</Button>
                <Button
                  className="flex-1"
                  disabled={!selectedDate || !selectedTime}
                  onClick={() => setStep(3)}
                >
                  Tiếp tục
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Customer Info */}
        {step === 3 && (
          <Card>
            <CardHeader><CardTitle>3. Thông tin của bạn</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Họ và tên</Label>
                <Input id="name" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nhập họ tên" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input id="phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="0901234567" className="mt-1" />
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setStep(2)}>Quay lại</Button>
                <Button
                  className="flex-1"
                  disabled={!customerName.trim() || !customerPhone.trim()}
                  onClick={() => setStep(4)}
                >
                  Tiếp tục
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <Card>
            <CardHeader><CardTitle>4. Xác nhận đặt lịch</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                <p><strong>Dịch vụ:</strong> {currentService?.name}</p>
                <p><strong>Ngày:</strong> {selectedDate && format(selectedDate, 'dd/MM/yyyy')}</p>
                <p><strong>Giờ:</strong> {selectedTime}</p>
                <p><strong>Thợ:</strong> {selectedTherapistName}</p>
                <p><strong>Khách:</strong> {customerName}</p>
                <p><strong>SĐT:</strong> {customerPhone}</p>
                <p><strong>Giá:</strong> {currentService && new Intl.NumberFormat('vi-VN').format(currentService.price)}đ</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)}>Quay lại</Button>
                <Button className="flex-1" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? 'Đang xử lý...' : 'Xác nhận đặt lịch'}
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
