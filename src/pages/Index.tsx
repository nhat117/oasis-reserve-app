import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LanguageSwitcher, useI18n } from '@/hooks/useI18n';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import logoImg from '@/assets/logo.png';
import heroImg from '@/assets/hero-luxury.jpg';
import detail1Img from '@/assets/spa-detail-1.jpg';
import detail2Img from '@/assets/spa-detail-2.jpg';

const luxuryEase = [0.25, 0.1, 0.25, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.8, delay: i * 0.15, ease: luxuryEase as unknown as string }
  })
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: (i: number = 0) => ({
    opacity: 1,
    transition: { duration: 1, delay: i * 0.2, ease: luxuryEase as unknown as string }
  })
};

const scaleReveal = {
  hidden: { opacity: 0, scale: 1.08 },
  visible: (i: number = 0) => ({
    opacity: 1, scale: 1,
    transition: { duration: 1.2, delay: i * 0.2, ease: luxuryEase as unknown as string }
  })
};

const Index = () => {
  const { t } = useI18n();
  const heroRef = useRef<HTMLDivElement>(null);
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
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoImg} alt="Royal Head Spa" className="h-10 w-10 object-contain" />
            <span className="text-sm tracking-[0.25em] uppercase text-foreground font-light">Royal Head Spa</span>
          </Link>
          <nav className="flex items-center gap-6">
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
        </div>
      </motion.header>

      {/* Hero — Full Screen with Parallax */}
      <section ref={heroRef} className="relative h-screen flex items-end overflow-hidden">
        <motion.div className="absolute inset-0" style={{ y: heroY }}>
          <motion.img
            src={heroImg}
            alt="Royal Head Spa"
            className="w-full h-[120%] object-cover"
            width={1920}
            height={1080}
            initial={{ scale: 1.15 }}
            animate={{ scale: 1 }}
            transition={{ duration: 2.5, ease: [0.25, 0.1, 0.25, 1] }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-foreground/20 to-transparent" />
        </motion.div>
        <motion.div
          className="relative w-full max-w-7xl mx-auto px-6 md:px-10 pb-20 md:pb-28"
          style={{ opacity: heroOpacity }}
        >
          <div className="max-w-xl space-y-8">
            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0}
              className="text-xs tracking-[0.3em] uppercase text-background/70"
            >
              {t('Gội đầu dưỡng sinh')}
            </motion.p>
            <motion.h1
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={1}
              className="text-5xl md:text-7xl text-background leading-[1.1] font-light"
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
                  className="rounded-none text-xs tracking-[0.2em] uppercase px-10 h-12 mt-4 bg-background text-foreground hover:bg-background/90"
                >
                  {t('Book Experience')}
                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Philosophy */}
      <section className="max-w-7xl mx-auto px-6 md:px-10 py-28 md:py-40">
        <div className="grid md:grid-cols-2 gap-16 md:gap-24 items-center">
          <div className="space-y-8">
            <motion.p
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} custom={0}
              className="text-xs tracking-[0.3em] uppercase text-muted-foreground"
            >
              {t('Về chúng tôi')}
            </motion.p>
            <motion.h2
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} custom={1}
              className="text-4xl md:text-5xl leading-[1.15] font-light"
            >
              {t('Nghệ thuật')}<br />
              <em className="italic">{t('gội đầu dưỡng sinh')}</em>
            </motion.h2>
            <motion.div
              variants={fadeIn} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} custom={2}
              className="w-12 h-px bg-foreground/20"
            />
            <motion.p
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} custom={2}
              className="text-muted-foreground leading-relaxed text-[15px] max-w-md"
            >
              {t('Royal Head Spa mang đến trải nghiệm gội đầu dưỡng sinh cao cấp, kết hợp giữa phương pháp truyền thống và thảo dược thiên nhiên. Mỗi liệu trình được thiết kế riêng biệt, giúp bạn thư giãn sâu, giảm stress và phục hồi năng lượng.')}
            </motion.p>
            <motion.p
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} custom={3}
              className="text-muted-foreground leading-relaxed text-[15px] max-w-md"
            >
              {t('Với đội ngũ thợ lành nghề và không gian yên tĩnh, chúng tôi cam kết mang đến cho bạn những phút giây thư thái trọn vẹn nhất.')}
            </motion.p>
            <motion.div
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} custom={4}
            >
              <Link to="/services" className="inline-flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-foreground hover:text-muted-foreground transition-colors duration-300 pt-2">
                {t('Xem dịch vụ')}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <motion.div
              variants={scaleReveal} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} custom={1}
              className="pt-12 overflow-hidden"
            >
              <img src={detail1Img} alt={t('Thảo dược thiên nhiên')} className="w-full aspect-[3/4] object-cover" loading="lazy" width={800} height={1000} />
            </motion.div>
            <motion.div
              variants={scaleReveal} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} custom={2}
              className="overflow-hidden"
            >
              <img src={detail2Img} alt={t('Không gian spa')} className="w-full aspect-[3/4] object-cover" loading="lazy" width={800} height={1000} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Info Strip */}
      <section className="border-y border-border/60">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/60">
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
                className={`py-14 space-y-3 ${i === 0 ? 'md:pr-10' : i === 1 ? 'md:px-10' : 'md:pl-10'}`}
              >
                <p className="text-xs tracking-[0.25em] uppercase text-muted-foreground">{item.label}</p>
                <p className="text-foreground text-lg font-light">{item.main}</p>
                {item.sub && <p className="text-muted-foreground text-sm">{item.sub}</p>}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 md:px-10 py-28 md:py-40 text-center">
        <motion.p
          variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} custom={0}
          className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-6"
        >
          {t('Sẵn sàng trải nghiệm?')}
        </motion.p>
        <motion.h2
          variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} custom={1}
          className="text-4xl md:text-5xl font-light leading-[1.15] mb-8"
        >
          {t('Đặt lịch ngay hôm nay')}<br />
          <em className="italic">{t('để tận hưởng liệu trình')}</em>
        </motion.h2>
        <motion.div
          variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} custom={2}
        >
          <Link to="/booking">
            <Button size="lg" className="rounded-none text-xs tracking-[0.2em] uppercase px-12 h-12">
              {t('Đặt lịch ngay')}
              <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <motion.footer
        variants={fadeIn} initial="hidden" whileInView="visible" viewport={{ once: true }}
        className="border-t border-border/60 py-14"
      >
        <div className="max-w-7xl mx-auto px-6 md:px-10 flex flex-col items-center gap-5">
          <img src={logoImg} alt="Royal Head Spa" className="h-8 w-8 object-contain opacity-40" loading="lazy" />
          <p className="text-xs tracking-[0.15em] text-muted-foreground/60">© 2026 Royal Head Spa. {t('Mọi quyền được bảo lưu.')}</p>
          <Link to="/admin" className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground/30 hover:text-muted-foreground transition-colors duration-300">
            {t('Quản trị')}
          </Link>
        </div>
      </motion.footer>
    </div>
  );
};

export default Index;
