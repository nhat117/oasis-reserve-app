import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LanguageSwitcher, useI18n } from '@/hooks/useI18n';
import { Button } from '@/components/ui/button';
import { ArrowRight, Menu, X, Play, Pause } from 'lucide-react';
import { useLogo } from '@/hooks/useLogo';
import heroImg from '@/assets/hero-luxury.jpg';
import detail1Img from '@/assets/spa-detail-1.jpg';
import detail2Img from '@/assets/spa-detail-2.jpg';

const HERO_VIDEO_URL = 'https://videos.pexels.com/video-files/3188167/3188167-uhd_2560_1440_30fps.mp4';
const PRODUCT_IMAGES = [
  { src: 'https://images.pexels.com/photos/3735149/pexels-photo-3735149.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Luxury shampoo bottles' },
  { src: 'https://images.pexels.com/photos/3737586/pexels-photo-3737586.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Herbal hair rinse' },
  { src: 'https://images.pexels.com/photos/3997381/pexels-photo-3997381.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Essential oils collection' },
  { src: 'https://images.pexels.com/photos/3737579/pexels-photo-3737579.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Spa treatment products' },
];

const Index = () => {
  const { t } = useI18n();
  const logoImg = useLogo();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const toggleVideo = () => {
    if (!videoRef.current) return;
    if (videoPlaying) { videoRef.current.pause(); } else { videoRef.current.play(); }
    setVideoPlaying(!videoPlaying);
  };

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
            <img src={logoImg} alt="Royal Head Spa" className="h-14 w-14 sm:h-20 sm:w-20 object-contain" />
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

      {/* Hero — Full Screen Video */}
      <section className="relative h-[100svh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          {/* Fallback image while video loads */}
          <img src={heroImg} alt="Royal Head Spa" className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-1000 ${videoLoaded ? 'opacity-0' : 'opacity-100'}`} width={1920} height={1080} />
          {/* Video background */}
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            onCanPlay={() => setVideoLoaded(true)}
            className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-1000 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
          >
            <source src={HERO_VIDEO_URL} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-foreground/40 via-foreground/50 to-foreground/70" />
        </div>

        {/* Video play/pause control */}
        <button
          onClick={toggleVideo}
          className="absolute bottom-6 right-6 z-10 p-2.5 rounded-full bg-background/10 backdrop-blur-sm border border-background/20 text-background/60 hover:text-background hover:bg-background/20 transition-all duration-300"
          aria-label={videoPlaying ? 'Pause video' : 'Play video'}
        >
          {videoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>

        <div className="relative flex flex-col items-center justify-center text-center px-6 space-y-5 sm:space-y-8">
          <p className="text-xs sm:text-sm tracking-[0.35em] uppercase text-background/60 animate-[fadeIn_1s_ease-in_0.3s_both]">{t('Herbal Head Spa')}</p>
          <h1 className="text-[3.2rem] leading-[1.1] sm:text-7xl md:text-8xl text-background font-light animate-[fadeIn_1s_ease-in_0.5s_both]">
            {t('A Ritual for')}
            <br />
            <em className="italic">{t('the Senses')}</em>
          </h1>
          <Link to="/booking" className="pt-2 sm:pt-4 animate-[fadeIn_1s_ease-in_0.8s_both]">
            <Button
              size="lg"
              className="rounded-none text-xs sm:text-sm tracking-[0.25em] uppercase px-10 sm:px-14 h-14 sm:h-16 bg-background text-foreground hover:bg-background/90"
            >
              {t('Book Experience')}
              <ArrowRight className="ml-3 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-background/40 animate-bounce">
          <div className="w-px h-8 bg-gradient-to-b from-transparent to-background/40" />
        </div>
      </section>

      {/* Products Showcase */}
      <section className="bg-foreground/[0.03]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-16 sm:py-24">
          <div className="text-center mb-10 sm:mb-16">
            <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">{t('Sản phẩm cao cấp')}</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-light leading-[1.15]">
              {t('Thảo dược')}&nbsp;
              <em className="italic">{t('thiên nhiên')}</em>
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5">
            {PRODUCT_IMAGES.map((img, i) => (
              <div key={i} className="group relative overflow-hidden aspect-[3/4]">
                <img
                  src={img.src}
                  alt={img.alt}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            ))}
          </div>
          <div className="text-center mt-8 sm:mt-12">
            <p className="text-muted-foreground text-sm sm:text-[15px] max-w-lg mx-auto leading-relaxed">
              {t('Chúng tôi sử dụng các sản phẩm organic cao cấp — dầu gội thảo dược, nước xả dưỡng sinh, tinh dầu thiên nhiên — được tuyển chọn kỹ lưỡng cho mỗi liệu trình.')}
            </p>
          </div>
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
          <img src={logoImg} alt="Royal Head Spa" className="h-14 w-14 sm:h-16 sm:w-16 object-contain opacity-40" loading="lazy" />
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
