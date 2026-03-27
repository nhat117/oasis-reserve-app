import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import defaultLogo from '@/assets/logo.png';

export function useLogo() {
  const { data: logoUrl } = useQuery({
    queryKey: ['shop-logo'],
    queryFn: async () => {
      // Check if a custom logo exists in app_settings
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'shop_logo_path')
        .maybeSingle();
      
      if (data?.value) {
        const { data: urlData } = supabase.storage
          .from('logos')
          .getPublicUrl(data.value);
        return urlData.publicUrl + '?t=' + Date.now();
      }
      return null;
    },
    staleTime: 1000 * 60 * 5,
  });

  return logoUrl || defaultLogo;
}
