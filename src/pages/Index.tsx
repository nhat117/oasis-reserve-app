import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Clock, Phone, MapPin } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import heroImg from '@/assets/hero-spa.jpg';
import ingredientsImg from '@/assets/spa-ingredients.jpg';
import interiorImg from '@/assets/spa-interior.jpg';

const Index = () => {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-card/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoImg} alt="Royal Head Spa" className="h-12 w-12 object-contain" />
            <div className="hidden sm:block">
              <span className="text-lg font-semibold font-serif text-primary leading-tight block">Royal Head Spa</span>
              <span className="text-[11px] text-muted-foreground tracking-wider uppercase">Gội đầu dưỡng sinh</span>
            </div>
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Dịch vụ
            </Link>
            <Link to="/booking">
              <Button size="sm">Đặt lịch</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImg} alt="Royal Head Spa" className="w-full h-full object-cover" width={1920} height={1080} />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/70 via-foreground/40 to-transparent" />
        </div>
        <div className="container mx-auto px-4 py-28 md:py-40 relative">
          <div className="max-w-lg space-y-6">
            <img src={logoImg} alt="Royal Head Spa" className="h-20 w-20 object-contain opacity-90" />
            <h1 className="text-4xl md:text-5xl font-bold text-background leading-tight">
              Royal<br />Head Spa
            </h1>
            <p className="text-base text-background/80 max-w-md">
              Thư giãn tinh thần, lưu thông khí huyết với liệu pháp gội đầu dưỡng sinh truyền thống kết hợp thảo dược thiên nhiên.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/booking">
                <Button size="lg" className="text-base px-8">
                  Đặt lịch ngay
                </Button>
              </Link>
              <Link to="/services">
                <Button size="lg" variant="outline" className="text-base px-8 bg-background/10 border-background/30 text-background hover:bg-background/20">
                  Xem dịch vụ
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-5">
            <p className="text-sm font-medium text-primary tracking-wider uppercase">Về chúng tôi</p>
            <h2 className="text-3xl md:text-4xl font-bold">Nghệ thuật gội đầu dưỡng sinh</h2>
            <p className="text-muted-foreground leading-relaxed">
              Royal Head Spa mang đến trải nghiệm gội đầu dưỡng sinh cao cấp, kết hợp giữa phương pháp truyền thống và thảo dược thiên nhiên. Mỗi liệu trình được thiết kế riêng biệt, giúp bạn thư giãn sâu, giảm stress và phục hồi năng lượng.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Với đội ngũ thợ lành nghề và không gian yên tĩnh, chúng tôi cam kết mang đến cho bạn những phút giây thư thái trọn vẹn nhất.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <img src={ingredientsImg} alt="Thảo dược thiên nhiên" className="rounded-xl shadow-lg w-full h-64 object-cover" loading="lazy" width={800} height={800} />
            <img src={interiorImg} alt="Không gian spa" className="rounded-xl shadow-lg w-full h-64 object-cover mt-8" loading="lazy" width={800} height={600} />
          </div>
        </div>
      </section>

      {/* Info Cards */}
      <section className="bg-card/60 border-y">
        <div className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-background rounded-xl p-8 border shadow-sm text-center space-y-3">
              <Clock className="h-8 w-8 text-primary mx-auto" />
              <h3 className="font-semibold text-lg">Giờ mở cửa</h3>
              <p className="text-muted-foreground">9:00 SA – 6:00 CH<br />Thứ 2 – Thứ 7</p>
            </div>
            <div className="bg-background rounded-xl p-8 border shadow-sm text-center space-y-3">
              <Phone className="h-8 w-8 text-primary mx-auto" />
              <h3 className="font-semibold text-lg">Liên hệ</h3>
              <p className="text-muted-foreground">Gọi ngay để đặt lịch<br />hoặc đặt online 24/7</p>
            </div>
            <div className="bg-background rounded-xl p-8 border shadow-sm text-center space-y-3">
              <MapPin className="h-8 w-8 text-primary mx-auto" />
              <h3 className="font-semibold text-lg">Địa chỉ</h3>
              <p className="text-muted-foreground">Liên hệ để biết<br />địa chỉ chi tiết</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">Sẵn sàng trải nghiệm?</h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">Đặt lịch ngay hôm nay để tận hưởng liệu trình gội đầu dưỡng sinh tại Royal Head Spa.</p>
        <Link to="/booking">
          <Button size="lg" className="text-base px-10">Đặt lịch ngay</Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card/50 py-8">
        <div className="container mx-auto px-4 flex flex-col items-center gap-3">
          <img src={logoImg} alt="Royal Head Spa" className="h-10 w-10 object-contain opacity-60" loading="lazy" />
          <p className="text-sm text-muted-foreground">© 2026 Royal Head Spa. Mọi quyền được bảo lưu.</p>
          <Link to="/admin" className="text-xs text-muted-foreground/40 hover:text-muted-foreground">
            Quản trị
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default Index;
