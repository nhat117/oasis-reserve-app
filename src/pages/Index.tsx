import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LanguageSwitcher, useI18n } from '@/hooks/useI18n';
import { Button } from '@/components/ui/button';
import { ArrowRight, Menu, X } from 'lucide-react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { useRef, useState } from 'react';
import logoImg from '@/assets/logo.png';
import heroImg from '@/assets/hero-headspa.png';
import detail1Img from '@/assets/spa-detail-1.jpg';
import detail2Img from '@/assets/spa-detail-2.jpg';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.8, delay: i * 0.15, ease: 'easeOut' as const }
  })
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: (i: number = 0) => ({
    opacity: 1,
    transition: { duration: 1, delay: i * 0.2, ease: 'easeOut' as const }
  })
};

const scaleReveal = {
  hidden: { opacity: 0, scale: 1.08 },
  visible: (i: number = 0) => ({
    opacity: 1, scale: 1,
    transition: { duration: 1.2, delay: i * 0.2, ease: 'easeOut' as const }
  })
};

const Index = () => {
  const { t } = useI18n();
  const heroRef = useRef<HTMLDivElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

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
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-3 sm:py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 sm:gap-3">
            <img src={logoImg} alt="Royal Head Spa" className="h-8 w-8 sm:h-10 sm:w-10 object-contain" />
            <span className="text-xs sm:text-sm tracking-[0.2em] sm:tracking-[0.25em] uppercase text-foreground font-light">Royal Head Spa</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-6">
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
          <div className="flex sm:hidden items-center gap-3">
            <LanguageSwitcher />
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-foreground p-1">
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="sm:hidden border-t border-border/40 bg-background/95 backdrop-blur-md overflow-hidden"
            >
              <div className="px-4 py-4 flex flex-col gap-3">
                <Link to="/services" onClick={() => setMobileMenuOpen(false)} className="text-xs tracking-[0.15em] uppercase text-muted-foreground py-2">
                  {t('Dịch vụ')}
                </Link>
                <Link to="/booking" onClick={() => setMobileMenuOpen(false)}>
                  <Button size="sm" className="text-xs tracking-[0.15em] uppercase rounded-none px-6 h-9 w-full">
                    {t('Đặt lịch')}
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Hero — Full Screen with Video Loop */}
      <section ref={heroRef} className="relative h-[100svh] flex items-end overflow-hidden">
        <motion.div className="absolute inset-0" style={{ y: heroY }}>
          {/* Video background — loops silently */}
          <video
            autoPlay
            loop
            muted
            playsInline
            poster={heroImg}
            className="w-full h-[120%] object-cover"
          >
            <source src="/hero-video.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-foreground/20 to-transparent" />
        </motion.div>
        <motion.div
          className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-10 pb-16 sm:pb-20 md:pb-28"
          style={{ opacity: heroOpacity }}
        >
          <div className="max-w-xl space-y-5 sm:space-y-8">
            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0}
              className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-background/70"
            >
              {t('Gội đầu dưỡng sinh')}
            </motion.p>
            <motion.h1
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={1}
              className="text-3xl sm:text-5xl md:text-7xl text-background leading-[1.1] font-light"
            >
              {t('A Ritual for')}
              <br />
              <em className="italic">{t('the Senses')}</em>
            </motion.h1>
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={2}
            >
              <Link to="/booking">
                <Button
                  size="lg"
                  className="rounded-none text-[10px] sm:text-xs tracking-[0.2em] uppercase px-8 sm:px-10 h-10 sm:h-12 mt-2 sm:mt-4 bg-background text-foreground hover:bg-background/90"
                >
                  {t('Book Experience')}
                  <ArrowRight className="ml-2 h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Philosophy */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-16 sm:py-28 md:py-40">
        <div className="grid md:grid-cols-2 gap-10 sm:gap-16 md:gap-24 items-center">
          <div className="space-y-5 sm:space-y-8">
            <motion.p
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} custom={0}
              className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-muted-foreground"
            >
              {t('Về chúng tôi')}
            </motion.p>
            <motion.h2
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} custom={1}
              className="text-3xl sm:text-4xl md:text-5xl leading-[1.15] font-light"
            >
              {t('Nghệ thuật')}<br />
              <em className="italic">{t('gội đầu dưỡng sinh')}</em>
            </motion.h2>
            <motion.div
              variants={fadeIn} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} custom={2}
              className="w-12 h-px bg-foreground/20"
            />
            <motion.p
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} custom={2}
              className="text-muted-foreground leading-relaxed text-sm sm:text-[15px] max-w-md"
            >
              {t('Royal Head Spa mang đến trải nghiệm gội đầu dưỡng sinh cao cấp, kết hợp giữa phương pháp truyền thống và thảo dược thiên nhiên. Mỗi liệu trình được thiết kế riêng biệt, giúp bạn thư giãn sâu, giảm stress và phục hồi năng lượng.')}
            </motion.p>
            <motion.p
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} custom={3}
              className="text-muted-foreground leading-relaxed text-sm sm:text-[15px] max-w-md"
            >
              {t('Với đội ngũ thợ lành nghề và không gian yên tĩnh, chúng tôi cam kết mang đến cho bạn những phút giây thư thái trọn vẹn nhất.')}
            </motion.p>
            <motion.div
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} custom={4}
            >
              <Link to="/services" className="inline-flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-foreground hover:text-muted-foreground transition-colors duration-300 pt-2">
                {t('Xem dịch vụ')}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <motion.div
              variants={scaleReveal} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} custom={1}
              className="pt-8 sm:pt-12 overflow-hidden"
            >
              <img src={detail1Img} alt={t('Thảo dược thiên nhiên')} className="w-full aspect-[3/4] object-cover" loading="lazy" width={800} height={1000} />
            </motion.div>
            <motion.div
              variants={scaleReveal} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} custom={2}
              className="overflow-hidden"
            >
              <img src={detail2Img} alt={t('Không gian spa')} className="w-full aspect-[3/4] object-cover" loading="lazy" width={800} height={1000} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Info Strip */}
      <section className="border-y border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
            {[
              {
                label: t('Giờ mở cửa'),
                main: t('9:00 SA – 6:00 CH'),
                sub: t('Thứ 2 – Thứ 7')
              },
              {
                label: t('Liên hệ'),
                main: shopPhone ? <a href={`tel:${shopPhone}`} className="hover:text-muted-foreground transition-colors duration-300">{shopPhone}</a> : t('Gọi ngay để đặt lịch'),
                sub: t('hoặc đặt online 24/7')
              },
              {
                label: t('Địa chỉ'),
                main: shopAddress || t('Liên hệ để biết địa chỉ chi tiết'),
                sub: null
              }
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                custom={i}
                className={`py-8 sm:py-14 space-y-2 sm:space-y-3 ${i === 0 ? 'sm:pr-10' : i === 1 ? 'sm:px-10' : 'sm:pl-10'}`}
              >
                <p className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-muted-foreground">{item.label}</p>
                <p className="text-foreground text-base sm:text-lg font-light">{item.main}</p>
                {item.sub && <p className="text-muted-foreground text-xs sm:text-sm">{item.sub}</p>}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-16 sm:py-28 md:py-40 text-center">
        <motion.p
          variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} custom={0}
          className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4 sm:mb-6"
        >
          {t('Sẵn sàng trải nghiệm?')}
        </motion.p>
        <motion.h2
          variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} custom={1}
          className="text-3xl sm:text-4xl md:text-5xl font-light leading-[1.15] mb-6 sm:mb-8"
        >
          {t('Đặt lịch ngay hôm nay')}<br />
          <em className="italic">{t('để tận hưởng liệu trình')}</em>
        </motion.h2>
        <motion.div
          variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} custom={2}
        >
          <Link to="/booking">
            <Button size="lg" className="rounded-none text-[10px] sm:text-xs tracking-[0.2em] uppercase px-10 sm:px-12 h-10 sm:h-12">
              {t('Đặt lịch ngay')}
              <ArrowRight className="ml-2 h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <motion.footer
        variants={fadeIn} initial="hidden" whileInView="visible" viewport={{ once: true }}
        className="border-t border-border/60 py-10 sm:py-14"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 flex flex-col items-center gap-4 sm:gap-5">
          <img src={logoImg} alt="Royal Head Spa" className="h-7 w-7 sm:h-8 sm:w-8 object-contain opacity-40" loading="lazy" />
          <p className="text-[10px] sm:text-xs tracking-[0.15em] text-muted-foreground/60 text-center">© 2026 Royal Head Spa. {t('Mọi quyền được bảo lưu.')}</p>
          <Link to="/admin" className="text-[9px] sm:text-[10px] tracking-[0.15em] uppercase text-muted-foreground/30 hover:text-muted-foreground transition-colors duration-300">
            {t('Quản trị')}
          </Link>
        </div>
      </motion.footer>
    </div>
  );
};

export default Index;
