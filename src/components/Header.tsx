import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { LanguageSwitcher, useI18n } from '@/hooks/useI18n';
import { useLogo } from '@/hooks/useLogo';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const Header = () => {
  const { t } = useI18n();
  const logoImg = useLogo();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const { data: spaName } = useQuery({
    queryKey: ['spa-name-header'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('key, value').eq('key', 'spa_name');
      return data?.[0]?.value || 'Oasis Reserve';
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { to: '/', label: t('Trang chủ') },
    { to: '/services', label: t('Dịch vụ') },
    { to: '/about', label: t('Về chúng tôi') },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-background/90 backdrop-blur-lg shadow-sm'
          : 'bg-background/60 backdrop-blur-md'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <img
            src={logoImg}
            alt={spaName || 'Oasis Reserve'}
            className="h-9 w-9 sm:h-11 sm:w-11 object-contain"
          />
          <span className="text-[11px] sm:text-xs tracking-[0.22em] uppercase text-foreground/90 font-light">
            {spaName || 'Oasis Reserve'}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-10">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-[11px] tracking-[0.18em] uppercase transition-colors duration-200 ${
                isActive(link.to)
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <LanguageSwitcher />
          <Link to="/booking" className="ml-2">
            <Button
              size="sm"
              className="text-[11px] tracking-[0.15em] uppercase rounded-none px-7 h-8"
            >
              {t('Đặt lịch')}
            </Button>
          </Link>
        </nav>

        {/* Mobile: book button + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <Link to="/booking">
            <Button
              size="sm"
              className="text-[10px] tracking-[0.12em] uppercase rounded-none px-4 h-7"
            >
              {t('Đặt lịch')}
            </Button>
          </Link>
          <button
            className="p-1.5 text-foreground/80 hover:text-foreground transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile slide-down menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
          menuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <nav className="bg-background/95 backdrop-blur-lg border-t border-border/30 px-6 py-5 space-y-1">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`block py-2.5 text-sm tracking-[0.12em] uppercase transition-colors ${
                isActive(link.to)
                  ? 'text-foreground font-normal'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-border/30">
            <LanguageSwitcher />
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Header;
