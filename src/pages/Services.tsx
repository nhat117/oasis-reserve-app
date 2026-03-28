import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/hooks/useI18n';
import { useReveal } from '@/hooks/useReveal';
import Header from '@/components/Header';

const SERVICE_STOCK_IMAGES = [
  'https://images.pexels.com/photos/3997993/pexels-photo-3997993.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3757952/pexels-photo-3757952.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3997989/pexels-photo-3997989.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/5240677/pexels-photo-5240677.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3997986/pexels-photo-3997986.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3738349/pexels-photo-3738349.jpeg?auto=compress&cs=tinysrgb&w=800',
];

const Services = () => {
  const { formatPrice, t } = useI18n();
  useReveal();
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
      <Header />

      <div className="pt-20 sm:pt-24 pb-16 sm:pb-24 max-w-4xl mx-auto px-4 sm:px-6 md:px-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground transition-colors mb-8 sm:mb-12">
          <ArrowLeft className="h-3.5 w-3.5" /> {t('Trang chủ')}
        </Link>

        <div className="mb-10 sm:mb-16 reveal">
          <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">{t('Khám phá')}</p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-light leading-tight">
            {t('Dịch vụ của chúng tôi')}
          </h1>
        </div>

        <div className="space-y-3 sm:space-y-4 stagger-children">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border border-border/60 p-5 sm:p-6">
                <Skeleton className="h-5 w-1/3 mb-3" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))
          ) : (
            services?.map((service, idx) => {
              const imageUrl = service.image_path
                ? supabase.storage.from('service-images').getPublicUrl(service.image_path).data.publicUrl
                : SERVICE_STOCK_IMAGES[idx % SERVICE_STOCK_IMAGES.length];
              return (
                <div key={service.id} className="border border-border/60 hover:border-foreground/20 transition-colors duration-200 group overflow-hidden">
                  <div className="flex flex-col sm:flex-row">
                    <div className="shrink-0 h-48 sm:h-48 sm:w-48 md:w-56 overflow-hidden">
                      <img src={imageUrl} alt={service.name} className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 flex-1 min-h-[192px]">
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
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Services;
