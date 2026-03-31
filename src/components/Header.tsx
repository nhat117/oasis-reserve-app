import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { LanguageSwitcher, useI18n } from '@/hooks/useI18n';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const Header = () => {
  const { t } = useI18n();
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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-out ${
        scrolled
          ? 'bg-background/95 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border-b border-border/20 py-0'
          : 'bg-background/60 backdrop-blur-md py-0.5'
      }`}
    >
      <div className={`max-w-7xl mx-auto px-5 sm:px-8 md:px-10 flex items-center justify-between transition-all duration-300 ${
        scrolled ? 'h-14' : 'h-16'
      }`}>
        {/* Brand text */}
        <Link
          to="/"
          className="flex items-center group"
        >
          <span className="text-sm sm:text-base tracking-[0.18em] uppercase text-foreground font-medium group-hover:opacity-80 transition-opacity duration-250">
            {spaName || 'Oasis Reserve'}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`group relative text-[11.5px] tracking-[0.14em] uppercase transition-colors duration-250 py-1 ${
                isActive(link.to)
                  ? 'text-foreground font-medium'
                  : 'text-foreground/50 hover:text-foreground/80'
              }`}
            >
              {link.label}
              <span
                className={`absolute -bottom-0.5 left-0 h-[1.5px] bg-foreground/70 transition-all duration-250 ease-out ${
                  isActive(link.to) ? 'w-full' : 'w-0 group-hover:w-full'
                }`}
              />
            </Link>
          ))}
          <div className="ml-1">
            <LanguageSwitcher />
          </div>
          <Link to="/booking" className="ml-1.5">
            <Button
              size="sm"
              className="text-[11px] tracking-[0.14em] uppercase rounded-none px-7 h-8 font-medium transition-all duration-250 hover:opacity-90"
            >
              {t('Đặt lịch')}
            </Button>
          </Link>
        </nav>

        {/* Mobile: book button + hamburger */}
        <div className="flex md:hidden items-center gap-2.5">
          <Link to="/booking">
            <Button
              size="sm"
              className="text-[10px] tracking-[0.12em] uppercase rounded-none px-5 h-7 font-medium"
            >
              {t('Đặt lịch')}
            </Button>
          </Link>
          <button
            className="p-1.5 text-foreground/70 hover:text-foreground transition-colors duration-250"
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
        <nav className="bg-background/97 backdrop-blur-xl border-t border-border/20 px-6 py-5 space-y-0.5">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`block py-2.5 text-[13px] tracking-[0.1em] uppercase transition-colors duration-250 ${
                isActive(link.to)
                  ? 'text-foreground font-medium'
                  : 'text-foreground/45 hover:text-foreground/75'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-border/20">
            <LanguageSwitcher />
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Header;
