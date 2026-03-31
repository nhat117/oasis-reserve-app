import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/hooks/useI18n';
import { ArrowLeft } from 'lucide-react';
import DOMPurify from 'dompurify';

const SoftwareTerms = () => {
  const { t } = useI18n();

  const { data: termsHtml } = useQuery({
    queryKey: ['terms-content'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'terms_content').single();
      return data?.value || '';
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-xs tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground transition-colors mb-10">
          <ArrowLeft className="h-3.5 w-3.5" /> {t('Quay lại')}
        </Link>

        <div className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-light mb-2">Software Terms and Conditions</h1>
          <p className="text-sm text-muted-foreground">Last updated: March 2026</p>
        </div>

        {termsHtml ? (
          <div
            className="prose prose-sm max-w-none text-muted-foreground [&_h2]:text-base [&_h2]:font-medium [&_h2]:text-foreground [&_h2]:mb-2 [&_h2]:mt-6 [&_p]:leading-relaxed"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(termsHtml, { ALLOWED_TAGS: ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'br'], ALLOWED_ATTR: ['href', 'target', 'rel'] }) }}
          />
        ) : (
          <div className="text-sm text-muted-foreground space-y-6 leading-relaxed">
            <p>{t('Đang tải...')}</p>
          </div>
        )}

        <div className="text-center pt-10 mt-10 border-t border-border/40 space-y-1">
          <p className="text-xs text-muted-foreground/50">
            Crafted with <span className="text-red-400">&#9829;</span> in Melbourne
          </p>
          <p className="text-xs text-muted-foreground/40">
            &copy; {new Date().getFullYear()} Olive Marketing. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SoftwareTerms;
