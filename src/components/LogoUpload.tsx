import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, TENANT_ID } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Upload, Trash2 } from 'lucide-react';

const defaultLogo =
  'https://res.cloudinary.com/dzzoimn4v/image/upload/v1778645820/estique_logo_transparent_kwyboz.png';

export function LogoUpload({ t }: { t: (s: string) => string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: logoInfo } = useQuery({
    queryKey: ['shop-logo-admin'],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'shop_logo_path')
        .maybeSingle();
      if (data?.value) {
        const { data: urlData } = supabase.storage.from('logos').getPublicUrl(data.value);
        return { path: data.value, url: urlData.publicUrl + '?t=' + Date.now() };
      }
      return null;
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: t('Lỗi'), description: t('Chỉ chấp nhận file ảnh'), variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `shop-logo.${ext}`;

      // Delete old logo if exists
      if (logoInfo?.path) {
        await supabase.storage.from('logos').remove([logoInfo.path]);
      }

      const { error: uploadErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      // Save path to settings
      await supabase.from('app_settings').upsert(
        { key: 'shop_logo_path', value: path, updated_at: new Date().toISOString(), tenant_id: TENANT_ID },
        { onConflict: 'tenant_id,key' },
      );

      queryClient.invalidateQueries({ queryKey: ['shop-logo-admin'] });
      queryClient.invalidateQueries({ queryKey: ['shop-logo'] });
      toast({ title: t('Đã cập nhật logo') });
    } catch (err: any) {
      toast({ title: t('Lỗi'), description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!logoInfo?.path) return;
    try {
      await supabase.storage.from('logos').remove([logoInfo.path]);
      await supabase.from('app_settings').delete().eq('key', 'shop_logo_path').eq('tenant_id', TENANT_ID);
      queryClient.invalidateQueries({ queryKey: ['shop-logo-admin'] });
      queryClient.invalidateQueries({ queryKey: ['shop-logo'] });
      toast({ title: t('Đã xoá logo, sử dụng logo mặc định') });
    } catch (err: any) {
      toast({ title: t('Lỗi'), description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <img
          src={logoInfo?.url || defaultLogo}
          alt="Logo"
          className="h-16 w-16 object-contain rounded-lg border border-border bg-muted/30 p-1"
        />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            {logoInfo ? t('Logo tuỳ chỉnh') : t('Logo mặc định')}
          </Label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="h-3.5 w-3.5 mr-1" />
              {uploading ? t('Đang tải...') : t('Tải lên')}
            </Button>
            {logoInfo && (
              <Button size="sm" variant="ghost" className="text-destructive" onClick={handleRemove}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> {t('Xoá')}
              </Button>
            )}
          </div>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <p className="text-xs text-muted-foreground">{t('Logo sẽ hiển thị trên tất cả các trang công khai')}</p>
    </div>
  );
}
