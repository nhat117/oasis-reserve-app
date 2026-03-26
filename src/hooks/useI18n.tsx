import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Lang = 'vi' | 'en';

const DEFAULT_AUD_RATE = 0.000061;

interface I18nContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  loading: boolean;
  formatPrice: (vndAmount: number) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
  loading: false,
  formatPrice: (v) => String(v),
});

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem('app-lang') as Lang) || 'en';
  });
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [audRate, setAudRate] = useState(DEFAULT_AUD_RATE);
  const [loading, setLoading] = useState(false);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const requestedRef = React.useRef<Set<string>>(new Set());

  // Load AUD exchange rate from DB
  useEffect(() => {
    const loadRate = async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'exchange_rate_aud').single();
      if (data) {
        const rate = parseFloat(data.value);
        if (rate > 0) setAudRate(rate);
      }
    };
    loadRate();
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('app-lang', l);
    setTranslations({});
    requestedRef.current = new Set();
  }, []);

  const formatPrice = useCallback((vndAmount: number): string => {
    const converted = vndAmount * audRate;
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(converted);
  }, [audRate]);

  // Load cached translations from DB on lang change
  useEffect(() => {
    if (lang === 'vi') {
      setTranslations({});
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
    }, 300);
    return () => clearTimeout(timer);
  }, [pendingKeys, lang]);

  const t = useCallback((key: string): string => {
    if (lang === 'vi') return key;
    if (translations[key]) return translations[key];
    if (!requestedRef.current.has(key)) {
      requestedRef.current.add(key);
      // Defer state update to avoid setState during render
      queueMicrotask(() => {
        setPendingKeys(prev => new Set(prev).add(key));
      });
    }
    return key;
  }, [lang, translations]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t, loading, formatPrice }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);

// Language switcher component (no currency picker)
export const LanguageSwitcher = ({ className }: { className?: string }) => {
  const { lang, setLang } = useI18n();
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'vi' : 'en')}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border border-border bg-card hover:bg-accent transition-colors ${className || ''}`}
    >
      {lang === 'en' ? '🇻🇳 VI' : '🇬🇧 EN'}
    </button>
  );
};
