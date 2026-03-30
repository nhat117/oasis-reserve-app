import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LanguageSwitcher, useI18n } from '@/hooks/useI18n';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, Pause, Clock } from 'lucide-react';
import { useLogo } from '@/hooks/useLogo';
import { useReveal } from '@/hooks/useReveal';
import Header from '@/components/Header';
import heroImg from '@/assets/hero-luxury.jpg';
import detail1Img from '@/assets/spa-detail-1.jpg';
import detail2Img from '@/assets/spa-detail-2.jpg';

const DEFAULT_HERO_VIDEO = 'https://videos.pexels.com/video-files/3205012/3205012-uhd_2560_1440_25fps.mp4';

const SERVICE_STOCK_IMAGES = [
  'https://images.pexels.com/photos/939835/pexels-photo-939835.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3997391/pexels-photo-3997391.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3997390/pexels-photo-3997390.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3997385/pexels-photo-3997385.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/704815/pexels-photo-704815.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3997383/pexels-photo-3997383.jpeg?auto=compress&cs=tinysrgb&w=800',
];

const PRODUCT_IMAGES = [
  { src: 'https://images.pexels.com/photos/3997379/pexels-photo-3997379.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Nail polish collection' },
  { src: 'https://images.pexels.com/photos/3997376/pexels-photo-3997376.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Gel nail supplies' },
  { src: 'https://images.pexels.com/photos/3997381/pexels-photo-3997381.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Essential oils and cuticle care' },
  { src: 'https://images.pexels.com/photos/3997374/pexels-photo-3997374.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Nail art tools and accessories' },
];

const Index = () => {
  const { t } = useI18n();
  const logoImg = useLogo();
  useReveal();
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
      const { data } = await supabase.from('app_settings').select('key, value').in('key', ['shop_phone', 'shop_address', 'spa_name', 'opening_hours', 'open_days', 'open_time', 'close_time', 'shop_state', 'show_holiday_closed', 'hero_mode', 'hero_media_path']);
      const map: Record<string, string> = {};
      data?.forEach(r => { map[r.key] = r.value; });
      return map;
    },
  });

  const shopPhone = shopSettings?.shop_phone || '';
  const shopAddress = shopSettings?.shop_address || '';
  const spaName = shopSettings?.spa_name || 'Oasis Reserve';
  const openingHours = shopSettings?.opening_hours || '';
  const openDays: number[] = shopSettings?.open_days ? JSON.parse(shopSettings.open_days) : [1, 2, 3, 4, 5, 6];
  const openTime = shopSettings?.open_time || '09:00';
  const closeTime = shopSettings?.close_time || '18:00';
  const shopState = shopSettings?.shop_state || 'VIC';
  const showHolidayClosed = shopSettings?.show_holiday_closed === 'true';
  const heroMode: 'video' | 'image' = (shopSettings?.hero_mode === 'image') ? 'image' : 'video';
  const heroMediaPath = shopSettings?.hero_media_path || '';
  const heroMediaUrl = heroMediaPath
    ? supabase.storage.from('hero-media').getPublicUrl(heroMediaPath).data.publicUrl
    : null;

  const dayNames: Record<number, string> = { 1: t('T2'), 2: t('T3'), 3: t('T4'), 4: t('T5'), 5: t('T6'), 6: t('T7'), 7: t('CN') };
  const openDaysList = (() => {
    if (!openDays.length) return '';
    const sorted = [...openDays].sort((a, b) => a - b);
    const ranges: number[][] = [];
    let current = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === current[current.length - 1] + 1) {
        current.push(sorted[i]);
      } else {
        ranges.push(current);
        current = [sorted[i]];
      }
    }
    ranges.push(current);
    return ranges.map(r =>
      r.length >= 3 ? `${dayNames[r[0]]} – ${dayNames[r[r.length - 1]]}` : r.map(d => dayNames[d]).join(', ')
    ).join(', ');
  })();
  const formatTime12 = (t24: string) => {
    const [h, m] = t24.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
  };

  // Fetch public holidays for the region
  const { data: publicHolidays } = useQuery({
    queryKey: ['public-holidays', shopState],
    queryFn: async () => {
      const year = new Date().getFullYear();
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/AU`);
      if (!res.ok) return [];
      const holidays: Array<{ date: string; localName: string; name: string; counties: string[] | null }> = await res.json();
      const stateCode = `AU-${shopState}`;
      return holidays.filter(h => !h.counties || h.counties.includes(stateCode));
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayHoliday = publicHolidays?.find(h => h.date === todayStr);
  const isClosedToday = showHolidayClosed && !!todayHoliday;
  const todayDayOfWeek = new Date().getDay(); // 0=Sun..6=Sat
  const todayIsoDay = todayDayOfWeek === 0 ? 7 : todayDayOfWeek; // 1=Mon..7=Sun
  const isClosedDayOff = !openDays.includes(todayIsoDay);

  const { formatPrice } = useI18n();
  const { data: services } = useQuery({
    queryKey: ['services-homepage'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('*').eq('is_active', true).limit(6);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="relative h-[100svh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          {heroMode === 'video' ? (
            <>
              {/* Fallback image while video loads */}
              <img src={heroMediaUrl && heroMediaPath.match(/\.(jpg|jpeg|png|webp)$/i) ? heroMediaUrl : heroImg} alt={spaName} className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-1000 ${videoLoaded ? 'opacity-0' : 'opacity-100'}`} width={1920} height={1080} />
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
                <source src={heroMediaUrl && heroMediaPath.match(/\.(mp4|webm|mov)$/i) ? heroMediaUrl : DEFAULT_HERO_VIDEO} type="video/mp4" />
              </video>
            </>
          ) : (
            <img
              src={heroMediaUrl || heroImg}
              alt={spaName}
              className="w-full h-full object-cover absolute inset-0"
              width={1920}
              height={1080}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-foreground/40 via-foreground/50 to-foreground/70" />
        </div>

        {/* Video play/pause control */}
        {heroMode === 'video' && (
          <button
            onClick={toggleVideo}
            className="absolute bottom-6 right-6 z-10 p-2.5 rounded-full bg-background/10 backdrop-blur-sm border border-background/20 text-background/60 hover:text-background hover:bg-background/20 transition-all duration-300"
            aria-label={videoPlaying ? 'Pause video' : 'Play video'}
          >
            {videoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        )}

        <div className="relative flex flex-col items-center justify-center text-center px-6 space-y-5 sm:space-y-8">
          <p className="text-xs sm:text-sm tracking-[0.35em] uppercase text-background/60 animate-[fadeIn_1s_ease-in_0.3s_both]">{spaName}</p>
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
          <div className="text-center mb-10 sm:mb-16 reveal">
            <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">{t('Sản phẩm cao cấp')}</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-light leading-[1.15]">
              {t('Thảo dược')}&nbsp;
              <em className="italic">{t('thiên nhiên')}</em>
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5 stagger-children">
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
          <div className="text-center mt-8 sm:mt-12 reveal">
            <p className="text-muted-foreground text-sm sm:text-[15px] max-w-lg mx-auto leading-relaxed">
              {t('Chúng tôi sử dụng các sản phẩm nail cao cấp — gel, bột acrylic, sơn OPI & CND — được tuyển chọn kỹ lưỡng để bảo vệ và làm đẹp đôi tay bạn.')}
            </p>
          </div>
        </div>
      </section>

      {/* Services Showcase */}
      {services && services.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-16 sm:py-24">
          <div className="text-center mb-10 sm:mb-16 reveal">
            <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">{t('Dịch vụ nổi bật')}</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-light leading-[1.15]">
              {t('Liệu trình')}&nbsp;
              <em className="italic">{t('của chúng tôi')}</em>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 stagger-children">
            {services.map((service: any, idx: number) => {
              const imageUrl = service.image_path
                ? supabase.storage.from('service-images').getPublicUrl(service.image_path).data.publicUrl
                : SERVICE_STOCK_IMAGES[idx % SERVICE_STOCK_IMAGES.length];
              return (
                <Link key={service.id} to={`/booking?service=${service.id}`} className="group block border border-border/60 hover:border-foreground/20 transition-all duration-300 overflow-hidden">
                  <div className="aspect-[4/3] overflow-hidden">
                    <img src={imageUrl} alt={service.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                  </div>
                  <div className="p-5 space-y-2">
                    <h3 className="text-base sm:text-lg font-light">{t(service.name)}</h3>
                    {service.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{t(service.description)}</p>
                    )}
                    <div className="flex items-center gap-3 text-sm text-muted-foreground pt-1">
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{service.duration_minutes} {t('phút')}</span>
                      <span className="text-foreground font-light">{formatPrice(service.price)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="text-center mt-8 sm:mt-12">
            <Link to="/services" className="inline-flex items-center gap-2 text-[10px] sm:text-xs tracking-[0.2em] uppercase text-foreground hover:text-muted-foreground transition-colors duration-300">
              {t('Xem tất cả dịch vụ')}
              <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </Link>
          </div>
        </section>
      )}

      {/* Philosophy */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-16 sm:py-28 md:py-40">
        <div className="grid md:grid-cols-2 gap-10 sm:gap-16 md:gap-24 items-center">
          <div className="space-y-6 sm:space-y-8 reveal-left">
            <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-muted-foreground">{t('Về chúng tôi')}</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl leading-[1.15] font-light">
              {t('Nghệ thuật')}<br />
              <em className="italic">{t('làm đẹp móng')}</em>
            </h2>
            <div className="w-12 h-px bg-foreground/20" />
            <p className="text-muted-foreground leading-relaxed text-sm sm:text-[15px] max-w-md">
              {spaName} {t('mang đến trải nghiệm làm nail cao cấp, kết hợp giữa xu hướng mới nhất và kỹ thuật chuyên nghiệp. Mỗi bộ nail được thiết kế riêng biệt, giúp bạn tự tin tỏa sáng với đôi tay hoàn hảo.')}
            </p>
            <p className="text-muted-foreground leading-relaxed text-sm sm:text-[15px] max-w-md">
              {t('Với đội ngũ thợ nail lành nghề và không gian sang trọng, chúng tôi cam kết mang đến cho bạn sự hài lòng tuyệt đối.')}
            </p>
            <Link to="/services" className="inline-flex items-center gap-2 text-[10px] sm:text-xs tracking-[0.2em] uppercase text-foreground hover:text-muted-foreground transition-colors duration-300 pt-2">
              {t('Xem dịch vụ')}
              <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 reveal-right">
            <div className="pt-8 sm:pt-12 overflow-hidden">
              <img src={detail1Img} alt={t('Nghệ thuật nail')} className="w-full aspect-[3/4] object-cover transition-transform duration-700 hover:scale-105" loading="lazy" width={800} height={1000} />
            </div>
            <div className="overflow-hidden">
              <img src={detail2Img} alt={t('Không gian salon')} className="w-full aspect-[3/4] object-cover transition-transform duration-700 hover:scale-105" loading="lazy" width={800} height={1000} />
            </div>
          </div>
        </div>
      </section>

      {/* Info Strip */}
      <section className="border-y border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10">
          {(isClosedToday || isClosedDayOff) && (
            <div className="py-3 text-center border-b border-border/40">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-destructive/10 text-destructive text-sm font-medium">
                {t('Hôm nay đóng cửa')}
                {todayHoliday && <span className="text-xs font-normal">— {todayHoliday.localName || todayHoliday.name}</span>}
              </span>
            </div>
          )}
          <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/60 stagger-children">
            <div className="py-8 sm:py-14 sm:pr-10 space-y-2 sm:space-y-3">
              <p className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-muted-foreground">{t('Giờ mở cửa')}</p>
              <p className="text-foreground text-base sm:text-lg font-light">{formatTime12(openTime)} – {formatTime12(closeTime)}</p>
              <p className="text-muted-foreground text-xs sm:text-sm">{openDaysList}</p>
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-16 sm:py-28 md:py-40 text-center reveal">
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
      <footer className="border-t border-border/60 bg-foreground/[0.02] py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8">
            {/* Brand */}
            <div className="flex flex-col items-center sm:items-start gap-3">
              <img src={logoImg} alt={spaName} className="h-14 w-14 object-contain opacity-60" loading="lazy" />
              <h3 className="text-base sm:text-lg tracking-[0.15em] uppercase font-light">{spaName}</h3>
              <p className="text-sm text-muted-foreground/60 text-center sm:text-left max-w-[240px]">
                {t('Trải nghiệm thư giãn cao cấp')}
              </p>
            </div>

            {/* Contact */}
            <div className="flex flex-col items-center sm:items-start gap-2">
              <h4 className="text-xs sm:text-sm tracking-[0.2em] uppercase text-muted-foreground/80 font-medium mb-1">{t('Liên hệ')}</h4>
              {shopAddress && (
                <p className="text-sm text-muted-foreground/60 text-center sm:text-left">{shopAddress}</p>
              )}
              {shopPhone && (
                <a href={`tel:${shopPhone}`} className="text-sm text-muted-foreground/60 hover:text-foreground transition-colors">{shopPhone}</a>
              )}
            </div>

            {/* Hours */}
            <div className="flex flex-col items-center sm:items-start gap-2">
              <h4 className="text-xs sm:text-sm tracking-[0.2em] uppercase text-muted-foreground/80 font-medium mb-1">{t('Giờ mở cửa')}</h4>
              <p className="text-sm text-muted-foreground/60 text-center sm:text-left">
                {formatTime12(openTime)} – {formatTime12(closeTime)}
              </p>
              <p className="text-sm text-muted-foreground/60 text-center sm:text-left">{openDaysList}</p>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs sm:text-sm tracking-[0.15em] text-muted-foreground/40">© {new Date().getFullYear()} {spaName}. {t('Mọi quyền được bảo lưu.')}</p>
            <div className="flex items-center gap-4">
              <Link to="/about" className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground/30 hover:text-muted-foreground transition-colors duration-300">
                {t('Điều khoản')}
              </Link>
              <Link to="/admin" className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground/30 hover:text-muted-foreground transition-colors duration-300">
                {t('Quản trị')}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
