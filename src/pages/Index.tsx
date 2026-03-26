import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Clock, Phone, MapPin, Leaf } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold font-serif text-primary">Dưỡng Sinh Spa</span>
          </div>
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
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/20 to-secondary/30" />
        <div className="container mx-auto px-4 py-24 md:py-36 relative">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
              Gội Đầu<br />
              <span className="text-primary">Dưỡng Sinh</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto">
              Thư giãn tinh thần, lưu thông khí huyết với liệu pháp gội đầu dưỡng sinh truyền thống kết hợp thảo dược thiên nhiên.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/booking">
                <Button size="lg" className="text-base px-8">
                  Đặt lịch ngay
                </Button>
              </Link>
              <Link to="/services">
                <Button size="lg" variant="outline" className="text-base px-8">
                  Xem dịch vụ
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Info Cards */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-card rounded-xl p-6 border shadow-sm text-center space-y-3">
            <Clock className="h-8 w-8 text-primary mx-auto" />
            <h3 className="font-semibold text-lg">Giờ mở cửa</h3>
            <p className="text-muted-foreground">9:00 SA – 6:00 CH<br />Thứ 2 – Thứ 7</p>
          </div>
          <div className="bg-card rounded-xl p-6 border shadow-sm text-center space-y-3">
            <Phone className="h-8 w-8 text-primary mx-auto" />
            <h3 className="font-semibold text-lg">Liên hệ</h3>
            <p className="text-muted-foreground">Gọi ngay để đặt lịch<br />hoặc đặt online</p>
          </div>
          <div className="bg-card rounded-xl p-6 border shadow-sm text-center space-y-3">
            <MapPin className="h-8 w-8 text-primary mx-auto" />
            <h3 className="font-semibold text-lg">Địa chỉ</h3>
            <p className="text-muted-foreground">Liên hệ để biết<br />địa chỉ chi tiết</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card/50 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2026 Dưỡng Sinh Spa. Mọi quyền được bảo lưu.</p>
          <Link to="/admin" className="text-xs text-muted-foreground/50 hover:text-muted-foreground mt-2 inline-block">
            Quản trị
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default Index;
