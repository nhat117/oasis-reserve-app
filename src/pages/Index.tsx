import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LanguageSwitcher, useI18n } from '@/hooks/useI18n';
import { Button } from '@/components/ui/button';
import { ArrowRight, Menu, X } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import heroImg from '@/assets/hero-luxury.jpg';
import detail1Img from '@/assets/spa-detail-1.jpg';
import detail2Img from '@/assets/spa-detail-2.jpg';

const Index = () => {
  const { t } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: shopSettings } = useQuery({
    queryKey: ['shop-settings-public'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('key, value').in('key', ['shop_phone', 'shop_address']);
      const map: Record<string, string> = {};
      data?.forEach(r => { map[r.key] = r.value; });
      return map;
    },
  });

  const shopPhone = shopSettings?.shop_phone || '';
  const shopAddress = shopSettings?.shop_address || '';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 sm:gap-3">
            <img src={logoImg} alt="Royal Head Spa" className="h-8 w-8 sm:h-10 sm:w-10 object-contain" />
            <span className="text-xs sm:text-sm tracking-[0.2em] sm:tracking-[0.25em] uppercase text-foreground font-light">Royal Head Spa</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <LanguageSwitcher />
            <Link to="/services" className="text-xs tracking-[0.15em] uppercase text-muted-foreground hover:text-foreground transition-colors duration-300">
              {t('Dịch vụ')}
            </Link>
            <Link to="/booking">
              <Button size="sm" className="text-xs tracking-[0.15em] uppercase rounded-none px-6 h-9">
                {t('Đặt lịch')}
              </Button>
            </Link>
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-background/95 backdrop-blur-md border-t border-border/40 px-4 py-6 space-y-4">
            <Link
              to="/services"
              className="block text-sm tracking-[0.15em] uppercase text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('Dịch vụ')}
            </Link>
            <Link to="/booking" onClick={() => setMobileMenuOpen(false)}>
              <Button size="sm" className="text-xs tracking-[0.15em] uppercase rounded-none px-6 h-9 w-full">
                {t('Đặt lịch')}
              </Button>
            </Link>
            <div className="pt-2">
              <LanguageSwitcher />
            </div>
          </div>
        )}
      </header>

      {/* Hero — Full Screen */}
      <section className="relative h-[100svh] flex items-center justify-center">
        <div className="absolute inset-0">
          <img src={heroImg} alt="Royal Head Spa" className="w-full h-full object-cover" width={1920} height={1080} />
          <div className="absolute inset-0 bg-foreground/50" />
        </div>
        <div className="relative flex flex-col items-center justify-center text-center px-6 space-y-5 sm:space-y-8">
          <p className="text-xs sm:text-sm tracking-[0.35em] uppercase text-background/60">{t('Herbal Head Spa')}</p>
          <h1 className="text-[3.2rem] leading-[1.1] sm:text-7xl md:text-8xl text-background font-light">
            {t('A Ritual for')}
            <br />
            <em className="italic">{t('the Senses')}</em>
          </h1>
          <Link to="/booking" className="pt-2 sm:pt-4">
            <Button
              size="lg"
              className="rounded-none text-xs sm:text-sm tracking-[0.25em] uppercase px-10 sm:px-14 h-14 sm:h-16 bg-background text-foreground hover:bg-background/90"
            >
              {t('Book Experience')}
              <ArrowRight className="ml-3 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Philosophy */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-16 sm:py-28 md:py-40">
        <div className="grid md:grid-cols-2 gap-10 sm:gap-16 md:gap-24 items-center">
          <div className="space-y-6 sm:space-y-8">
            <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-muted-foreground">{t('Về chúng tôi')}</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl leading-[1.15] font-light">
              {t('Nghệ thuật')}<br />
              <em className="italic">{t('gội đầu dưỡng sinh')}</em>
            </h2>
            <div className="w-12 h-px bg-foreground/20" />
            <p className="text-muted-foreground leading-relaxed text-sm sm:text-[15px] max-w-md">
              {t('Royal Head Spa mang đến trải nghiệm gội đầu dưỡng sinh cao cấp, kết hợp giữa phương pháp truyền thống và thảo dược thiên nhiên. Mỗi liệu trình được thiết kế riêng biệt, giúp bạn thư giãn sâu, giảm stress và phục hồi năng lượng.')}
            </p>
            <p className="text-muted-foreground leading-relaxed text-sm sm:text-[15px] max-w-md">
              {t('Với đội ngũ thợ lành nghề và không gian yên tĩnh, chúng tôi cam kết mang đến cho bạn những phút giây thư thái trọn vẹn nhất.')}
            </p>
            <Link to="/services" className="inline-flex items-center gap-2 text-[10px] sm:text-xs tracking-[0.2em] uppercase text-foreground hover:text-muted-foreground transition-colors duration-300 pt-2">
              {t('Xem dịch vụ')}
              <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="pt-8 sm:pt-12">
              <img src={detail1Img} alt={t('Thảo dược thiên nhiên')} className="w-full aspect-[3/4] object-cover" loading="lazy" width={800} height={1000} />
            </div>
            <div>
              <img src={detail2Img} alt={t('Không gian spa')} className="w-full aspect-[3/4] object-cover" loading="lazy" width={800} height={1000} />
            </div>
          </div>
        </div>
      </section>

      {/* Info Strip */}
      <section className="border-y border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10">
          <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
            <div className="py-8 sm:py-14 sm:pr-10 space-y-2 sm:space-y-3">
              <p className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-muted-foreground">{t('Giờ mở cửa')}</p>
              <p className="text-foreground text-base sm:text-lg font-light">{t('9:00 SA – 6:00 CH')}</p>
              <p className="text-muted-foreground text-xs sm:text-sm">{t('Thứ 2 – Thứ 7')}</p>
            </div>
            <div className="py-8 sm:py-14 sm:px-10 space-y-2 sm:space-y-3">
              <p className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-muted-foreground">{t('Liên hệ')}</p>
              <p className="text-foreground text-base sm:text-lg font-light">
                {shopPhone ? <a href={`tel:${shopPhone}`} className="hover:text-muted-foreground transition-colors duration-300">{shopPhone}</a> : t('Gọi ngay để đặt lịch')}
              </p>
              <p className="text-muted-foreground text-xs sm:text-sm">{t('hoặc đặt online 24/7')}</p>
            </div>
            <div className="py-8 sm:py-14 sm:pl-10 space-y-2 sm:space-y-3">
              <p className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-muted-foreground">{t('Địa chỉ')}</p>
              <p className="text-foreground text-base sm:text-lg font-light">{shopAddress || t('Liên hệ để biết địa chỉ chi tiết')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-16 sm:py-28 md:py-40 text-center">
        <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4 sm:mb-6">{t('Sẵn sàng trải nghiệm?')}</p>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-light leading-[1.15] mb-6 sm:mb-8">
          {t('Đặt lịch ngay hôm nay')}<br />
          <em className="italic">{t('để tận hưởng liệu trình')}</em>
        </h2>
        <Link to="/booking">
          <Button size="lg" className="rounded-none text-[10px] sm:text-xs tracking-[0.2em] uppercase px-8 sm:px-12 h-10 sm:h-12">
            {t('Đặt lịch ngay')}
            <ArrowRight className="ml-2 h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-10 sm:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 flex flex-col items-center gap-4 sm:gap-5">
          <img src={logoImg} alt="Royal Head Spa" className="h-7 w-7 sm:h-8 sm:w-8 object-contain opacity-40" loading="lazy" />
          <p className="text-[10px] sm:text-xs tracking-[0.15em] text-muted-foreground/60 text-center">© 2026 Royal Head Spa. {t('Mọi quyền được bảo lưu.')}</p>
          <Link to="/admin" className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground/30 hover:text-muted-foreground transition-colors duration-300">
            {t('Quản trị')}
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default Index;
