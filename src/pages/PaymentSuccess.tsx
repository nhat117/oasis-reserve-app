import { useSearchParams, Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/hooks/useI18n';
import Header from '@/components/Header';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const { t } = useI18n();

  // Payment status is updated server-side by the Stripe webhook only.
  // This page is purely informational — no client-side DB mutations.

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <Header />
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold text-[#3d2b1f]">{t('Thanh toán thành công!')}</h1>
          <p className="text-muted-foreground">
            {t('Cảm ơn bạn! Đặt lịch của bạn đã được xác nhận và thanh toán thành công.')}
          </p>
          <Link to="/">
            <Button variant="outline">{t('Về trang chủ')}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
