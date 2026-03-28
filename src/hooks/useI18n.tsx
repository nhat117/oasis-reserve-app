import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EN_TRANSLATIONS } from '@/lib/i18n-en';

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

  const formatPrice = useCallback((amount: number): string => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  }, []);

  // Load cached translations from DB on lang change (only for English, for API-translated keys)
  useEffect(() => {
    if (lang === 'vi') { setTranslations({}); return; }
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

  // Batch translate missing keys (only for English, only for keys not in built-in dictionary)
  useEffect(() => {
    if (pendingKeys.size === 0 || lang === 'vi') return;
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
        } else if (data?.error) {
          console.warn('Translation skipped:', data.error);
        }
      } catch (e) {
        console.warn('Translation unavailable:', e);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [pendingKeys, lang]);

  const t = useCallback((key: string): string => {
    // Vietnamese: return key as-is (keys are Vietnamese)
    if (lang === 'vi') return key;
    // English: check built-in dictionary first
    if (EN_TRANSLATIONS[key]) return EN_TRANSLATIONS[key];
    // Then check API-fetched translations
    if (translations[key]) return translations[key];
    // Only call API for keys NOT in built-in dictionary
    if (!requestedRef.current.has(key)) {
      requestedRef.current.add(key);
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

const LANGUAGES = [
  { code: 'vi' as Lang, label: 'Tiếng Việt' },
  { code: 'en' as Lang, label: 'English' },
];

// Language switcher component with dropdown
export const LanguageSwitcher = ({ className }: { className?: string }) => {
  const { lang, setLang } = useI18n();
  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  return (
    <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
      <SelectTrigger className={`w-auto min-w-[100px] h-8 text-xs font-medium ${className || ''}`}>
        <SelectValue>{current.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.map(l => (
          <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
