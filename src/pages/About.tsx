import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLogo } from '@/hooks/useLogo';
import { useI18n } from '@/hooks/useI18n';
import { ArrowLeft } from 'lucide-react';

const About = () => {
  const logoImg = useLogo();
  const { t } = useI18n();

  const { data: settings } = useQuery({
    queryKey: ['about-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('key, value').in('key', ['spa_name']);
      const map: Record<string, string> = {};
      data?.forEach(r => { map[r.key] = r.value; });
      return map;
    },
  });

  const spaName = settings?.spa_name || 'Oasis Reserve';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground transition-colors mb-10">
          <ArrowLeft className="h-3.5 w-3.5" /> {t('Trang chủ')}
        </Link>

        <div className="text-center mb-12 sm:mb-16">
          <img src={logoImg} alt={spaName} className="h-16 w-16 mx-auto mb-4 object-contain opacity-70" />
          <h1 className="text-2xl sm:text-3xl font-light">{spaName}</h1>
        </div>

        <div className="text-sm text-muted-foreground space-y-6 leading-relaxed">
          <section>
            <h2 className="text-base font-medium text-foreground mb-2">{t('Đặt lịch và hủy lịch')}</h2>
            <p>{t('Quý khách có thể đặt lịch trực tuyến hoặc qua điện thoại. Vui lòng hủy lịch ít nhất 2 giờ trước giờ hẹn để tránh ảnh hưởng đến lịch phục vụ.')}</p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">{t('Thanh toán')}</h2>
            <p>{t('Chúng tôi chấp nhận thanh toán bằng tiền mặt và thẻ. Phụ phí có thể áp dụng khi thanh toán bằng thẻ tín dụng.')}</p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">{t('Chính sách hoàn tiền')}</h2>
            <p>{t('Nếu quý khách không hài lòng với dịch vụ, vui lòng thông báo ngay cho nhân viên. Chúng tôi sẽ cố gắng giải quyết trong khả năng tốt nhất.')}</p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">{t('Bảo mật thông tin')}</h2>
            <p>{t('Thông tin cá nhân của quý khách được bảo mật và chỉ sử dụng cho mục đích đặt lịch và liên lạc. Chúng tôi không chia sẻ thông tin cho bên thứ ba.')}</p>
          </section>
        </div>

        <div className="text-center pt-10 mt-10 border-t border-border/40 space-y-1">
          <p className="text-xs text-muted-foreground/50">
            Crafted with <span className="text-red-400">&#9829;</span> in Melbourne
          </p>
          <p className="text-xs text-muted-foreground/40">
            &copy; {new Date().getFullYear()} Olive Marketing. {t('Mọi quyền được bảo lưu.')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default About;
