import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import { Skeleton } from '@/components/ui/skeleton';
import { LanguageSwitcher, useI18n } from '@/hooks/useI18n';

const Services = () => {
  const { formatPrice, t } = useI18n();
  const { data: services, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('*').eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 sm:gap-3">
            <img src={logoImg} alt="Royal Head Spa" className="h-8 w-8 sm:h-10 sm:w-10 object-contain" />
            <span className="text-xs sm:text-sm tracking-[0.2em] sm:tracking-[0.25em] uppercase text-foreground font-light">Royal Head Spa</span>
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            <LanguageSwitcher />
            <Link to="/booking">
              <Button size="sm" className="text-xs tracking-[0.15em] uppercase rounded-none px-4 sm:px-6 h-9">
                {t('Đặt lịch')}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="pt-20 sm:pt-24 pb-16 sm:pb-24 max-w-4xl mx-auto px-4 sm:px-6 md:px-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground transition-colors mb-8 sm:mb-12">
          <ArrowLeft className="h-3.5 w-3.5" /> {t('Trang chủ')}
        </Link>

        <div className="mb-10 sm:mb-16">
          <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">{t('Khám phá')}</p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-light leading-tight">
            {t('Dịch vụ của chúng tôi')}
          </h1>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border border-border/60 p-5 sm:p-6">
                <Skeleton className="h-5 w-1/3 mb-3" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))
          ) : (
            services?.map((service) => (
              <div key={service.id} className="border border-border/60 p-5 sm:p-6 hover:border-foreground/20 transition-colors duration-200 group">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <h2 className="text-lg sm:text-xl font-light">{t(service.name)}</h2>
                    {service.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed">{t(service.description)}</p>
                    )}
                    <div className="flex items-center gap-3 text-sm text-muted-foreground pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {service.duration_minutes} {t('phút')}
                      </span>
                      <span className="text-foreground font-light">{formatPrice(service.price)}</span>
                    </div>
                  </div>
                  <Link to={`/booking?service=${service.id}`} className="shrink-0">
                    <Button className="rounded-none text-xs tracking-[0.15em] uppercase px-6 h-10 w-full sm:w-auto">
                      {t('Đặt lịch')}
                      <ArrowRight className="ml-2 h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Services;
