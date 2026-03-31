import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/hooks/useI18n';
import {
  Scissors, Users, CreditCard, Settings, CalendarDays,
  ArrowRight, Check, Sparkles, Store, Bell, Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminOnboardingProps {
  userId: string;
  onComplete: () => void;
}

const STEPS = [
  {
    icon: Sparkles,
    titleKey: 'Chào mừng đến Admin Dashboard!',
    descKey: 'Hãy cùng thiết lập cửa hàng của bạn trong vài bước đơn giản.',
    color: '#006AFF',
    settingsKey: null,
  },
  {
    icon: Scissors,
    titleKey: 'Thêm dịch vụ',
    descKey: 'Tạo danh sách dịch vụ với giá, thời lượng và hình ảnh để khách hàng đặt lịch.',
    color: '#006AFF',
    settingsKey: 'services',
  },
  {
    icon: Users,
    titleKey: 'Thêm nhân viên',
    descKey: 'Thêm thợ và nhân viên, thiết lập lịch làm việc và ngày nghỉ.',
    color: '#00D632',
    settingsKey: 'therapists',
  },
  {
    icon: Store,
    titleKey: 'Cấu hình cửa hàng',
    descKey: 'Đặt tên cửa hàng, giờ mở cửa, ngày nghỉ và thông tin liên hệ.',
    color: '#FF9500',
    settingsKey: 'general',
  },
  {
    icon: CreditCard,
    titleKey: 'Thiết lập thanh toán',
    descKey: 'Kết nối Square hoặc Stripe để nhận thanh toán online và tại quầy.',
    color: '#1B1B1B',
    settingsKey: 'payments',
  },
  {
    icon: Bell,
    titleKey: 'Thông báo & Email',
    descKey: 'Cấu hình SMS và email để gửi xác nhận và nhắc hẹn tự động.',
    color: '#CD3D3D',
    settingsKey: 'notifications',
  },
  {
    icon: Globe,
    titleKey: 'Website & Đặt lịch',
    descKey: 'Tuỳ chỉnh trang chủ, About, Terms và mở hệ thống đặt lịch online.',
    color: '#8B5CF6',
    settingsKey: 'website',
  },
];

export function AdminOnboarding({ userId, onComplete }: AdminOnboardingProps) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [entering, setEntering] = useState(true);
  const totalSteps = STEPS.length;
  const current = STEPS[step];
  const Icon = current.icon;

  useEffect(() => {
    setEntering(true);
    const timer = setTimeout(() => setEntering(false), 400);
    return () => clearTimeout(timer);
  }, [step]);

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(s => s + 1);
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = async () => {
    setExiting(true);
    // Save to DB
    await supabase.from('app_settings').upsert({
      key: `onboarding_completed_${userId}`,
      value: 'true',
    }).then(() => {});
    setTimeout(() => onComplete(), 300);
  };

  return (
    <div className={cn(
      'fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300',
      exiting ? 'opacity-0' : 'opacity-100'
    )}>
      <div className={cn(
        'relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-300',
        exiting ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
      )}>
        {/* Progress bar */}
        <div className="h-1 bg-[#F5F5F5]">
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{
              width: `${((step + 1) / totalSteps) * 100}%`,
              backgroundColor: current.color,
            }}
          />
        </div>

        {/* Content */}
        <div className="px-8 pt-10 pb-8">
          {/* Icon */}
          <div className={cn(
            'mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-8 transition-all duration-500',
            entering ? 'scale-75 opacity-0 translate-y-4' : 'scale-100 opacity-100 translate-y-0'
          )} style={{ backgroundColor: `${current.color}10` }}>
            <Icon className="h-9 w-9 transition-all duration-500" style={{ color: current.color }} />
          </div>

          {/* Text */}
          <div className={cn(
            'text-center space-y-3 transition-all duration-500 delay-100',
            entering ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'
          )}>
            <h2 className="text-xl font-semibold text-[#1B1B1B]">{t(current.titleKey)}</h2>
            <p className="text-sm text-[#737373] leading-relaxed">{t(current.descKey)}</p>
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-2 mt-8">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={cn(
                  'rounded-full transition-all duration-300',
                  i === step ? 'w-8 h-2' : 'w-2 h-2',
                  i <= step ? '' : 'bg-[#E5E5E5]'
                )}
                style={i <= step ? { backgroundColor: current.color } : undefined}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className={cn(
            'flex gap-3 mt-8 transition-all duration-500 delay-200',
            entering ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
          )}>
            {step < totalSteps - 1 ? (
              <>
                <Button
                  variant="ghost"
                  className="flex-1 h-12 text-[#737373] hover:text-[#1B1B1B]"
                  onClick={handleSkip}
                >
                  {t('Bỏ qua')}
                </Button>
                <Button
                  className="flex-1 h-12 text-white font-medium rounded-xl"
                  style={{ backgroundColor: current.color }}
                  onClick={handleNext}
                >
                  {t('Tiếp tục')}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </>
            ) : (
              <Button
                className="w-full h-12 text-white font-medium rounded-xl"
                style={{ backgroundColor: current.color }}
                onClick={handleFinish}
              >
                <Check className="h-4 w-4 mr-2" />
                {t('Bắt đầu sử dụng')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
