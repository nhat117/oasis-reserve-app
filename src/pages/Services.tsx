import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Leaf, Clock, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const Services = () => {
  const { data: services, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('*').eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold font-serif text-primary">Dưỡng Sinh Spa</span>
          </Link>
          <Link to="/booking">
            <Button size="sm">Đặt lịch</Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Trang chủ
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold mb-2">Dịch vụ của chúng tôi</h1>
        <p className="text-muted-foreground mb-8">Chọn dịch vụ phù hợp với nhu cầu của bạn</p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-full mt-2" /></CardHeader>
                <CardContent><Skeleton className="h-10 w-full" /></CardContent>
              </Card>
            ))
          ) : (
            services?.map((service) => (
              <Card key={service.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-xl">{service.name}</CardTitle>
                  <CardDescription>{service.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {service.duration_minutes} phút
                    </div>
                    <span className="text-lg font-semibold text-primary">{formatPrice(service.price)}</span>
                  </div>
                  <Link to={`/booking?service=${service.id}`}>
                    <Button className="w-full">Đặt lịch dịch vụ này</Button>
                  </Link>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Services;
