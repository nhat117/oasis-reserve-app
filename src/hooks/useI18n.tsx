import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Lang = 'vi' | 'en';
type Currency = 'VND' | 'USD' | 'EUR' | 'AUD';

const CURRENCY_MAP: Record<Lang, Currency> = {
  vi: 'VND',
  en: 'AUD',
};

const EXCHANGE_RATES: Record<Currency, number> = {
  VND: 1,
  USD: 0.000039,
  EUR: 0.000036,
  AUD: 0.000061,
};

interface I18nContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  loading: boolean;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  formatPrice: (vndAmount: number) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
  loading: false,
  currency: 'AUD',
  setCurrency: () => {},
  formatPrice: (v) => String(v),
});

// Default Vietnamese strings (dashboard default)
const VI_DEFAULTS: Record<string, string> = {
  // Navigation & general
  'Home': 'Trang chủ',
  'Services': 'Dịch vụ',
  'Book Now': 'Đặt lịch ngay',
  'Admin': 'Quản trị',
  'Log Out': 'Đăng xuất',
  'Back': 'Quay lại',
  'Save': 'Lưu',
  'Cancel': 'Hủy',
  'Delete': 'Xóa',
  'Edit': 'Sửa',
  'Add': 'Thêm',
  'Close': 'Đóng',
  'Loading...': 'Đang tải...',
  
  // Booking page
  'Select Service': 'Chọn dịch vụ',
  'Select Date': 'Chọn ngày',
  'Select Time': 'Chọn giờ',
  'Select Therapist': 'Chọn thợ',
  'Any available': '🎲 Tự động chọn (bất kỳ thợ trống)',
  'Your Information': 'Thông tin của bạn',
  'Full Name': 'Họ và tên',
  'Phone Number': 'Số điện thoại',
  'Email (optional)': 'Email (tùy chọn)',
  'Notes': 'Ghi chú',
  'Confirm Booking': 'Xác nhận đặt lịch',
  'Booking Successful!': 'Đặt lịch thành công!',
  'minutes': 'phút',
  'No available slots': 'Không có khung giờ trống',
  'Shop is closed on this day': 'Tiệm nghỉ ngày này',
  
  // Services page
  'Our Services': 'Dịch vụ của chúng tôi',
  'Duration': 'Thời gian',
  'Price': 'Giá',
  
  // Index/Home
  'Welcome': 'Chào mừng',
  'Book an appointment': 'Đặt lịch hẹn',
  'View all services': 'Xem tất cả dịch vụ',
};

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem('app-lang') as Lang) || 'en';
  });
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const saved = localStorage.getItem('app-currency') as Currency;
    if (saved) return saved;
    const savedLang = (localStorage.getItem('app-lang') as Lang) || 'en';
    return CURRENCY_MAP[savedLang];
  });
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const requestedRef = React.useRef<Set<string>>(new Set());

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('app-lang', l);
    setTranslations({});
    requestedRef.current = new Set();
    // Auto-switch currency
    const newCurrency = CURRENCY_MAP[l];
    setCurrencyState(newCurrency);
    localStorage.setItem('app-currency', newCurrency);
  }, []);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    localStorage.setItem('app-currency', c);
  }, []);

  const formatPrice = useCallback((vndAmount: number): string => {
    if (currency === 'VND') {
      return new Intl.NumberFormat('vi-VN').format(vndAmount) + 'đ';
    }
    const converted = vndAmount * EXCHANGE_RATES[currency];
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(converted);
  }, [currency]);

  // Load cached translations from DB on lang change
  useEffect(() => {
    if (lang === 'vi') {
      setTranslations(VI_DEFAULTS);
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from('translations')
        .select('key, value')
        .eq('lang', lang);
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((r: any) => { map[r.key] = r.value; });
        setTranslations(map);
      }
    };
    load();
  }, [lang]);

  // Batch translate missing keys
  useEffect(() => {
    if (lang === 'vi' || pendingKeys.size === 0) return;
    const timer = setTimeout(async () => {
      const keys = Array.from(pendingKeys);
      setPendingKeys(new Set());
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('translate', {
          body: { keys, lang },
        });
        if (!error && data?.translations) {
          setTranslations(prev => ({ ...prev, ...data.translations }));
        }
      } catch (e) {
        console.error('Translation error:', e);
      }
      setLoading(false);
    }, 300); // debounce 300ms
    return () => clearTimeout(timer);
  }, [pendingKeys, lang]);

  const t = useCallback((key: string): string => {
    if (lang === 'vi') return VI_DEFAULTS[key] || key;
    if (translations[key]) return translations[key];
    // Queue for translation
    if (!requestedRef.current.has(key)) {
      requestedRef.current.add(key);
      setPendingKeys(prev => new Set(prev).add(key));
    }
    return key; // Return key as fallback while translating
  }, [lang, translations]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t, loading, currency, setCurrency, formatPrice }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);

// Language switcher component
export const LanguageSwitcher = ({ className }: { className?: string }) => {
  const { lang, setLang } = useI18n();
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'vi' : 'en')}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-card hover:bg-accent transition-colors ${className || ''}`}
    >
      {lang === 'en' ? '🇻🇳 Tiếng Việt' : '🇬🇧 English'}
    </button>
  );
};
