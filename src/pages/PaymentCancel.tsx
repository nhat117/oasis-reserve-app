import { useSearchParams, Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/hooks/useI18n';
import Header from '@/components/Header';

const PaymentCancel = () => {
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const bookingId = searchParams.get('booking_id');

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <Header />
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <X className="h-8 w-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-semibold text-[#3d2b1f]">{t('Thanh toán bị hủy')}</h1>
          <p className="text-muted-foreground">
            {t('Thanh toán chưa hoàn tất. Đặt lịch của bạn vẫn được lưu nhưng chưa thanh toán.')}
          </p>
          <div className="flex gap-3">
            <Link to="/booking">
              <Button variant="outline">{t('Đặt lịch lại')}</Button>
            </Link>
            <Link to="/">
              <Button variant="outline">{t('Về trang chủ')}</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentCancel;
