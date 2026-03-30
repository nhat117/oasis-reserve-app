import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Leaf } from 'lucide-react';

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'valid' | 'already' | 'invalid' | 'success' | 'error'>('loading');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    const validate = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
          headers: { apikey: anonKey },
        });
        const data = await res.json();
        if (res.ok && data.valid === true) setStatus('valid');
        else if (data.reason === 'already_unsubscribed') setStatus('already');
        else setStatus('invalid');
      } catch { setStatus('error'); }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('handle-email-unsubscribe', { body: { token } });
      if (error) throw error;
      if (data?.success) setStatus('success');
      else if (data?.reason === 'already_unsubscribed') setStatus('already');
      else setStatus('error');
    } catch { setStatus('error'); }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          <Leaf className="h-10 w-10 mx-auto text-primary" />
          {status === 'loading' && <p className="text-muted-foreground">Đang xác minh...</p>}
          {status === 'valid' && (
            <>
              <h2 className="text-xl font-semibold">Hủy đăng ký nhận email</h2>
              <p className="text-muted-foreground text-sm">Bạn sẽ không nhận được email từ Spa Bliss Bookings nữa.</p>
              <Button onClick={handleUnsubscribe} disabled={processing} className="w-full">
                {processing ? 'Đang xử lý...' : 'Xác nhận hủy đăng ký'}
              </Button>
            </>
          )}
          {status === 'success' && (
            <>
              <h2 className="text-xl font-semibold text-green-600">Đã hủy thành công</h2>
              <p className="text-muted-foreground text-sm">Bạn đã hủy nhận email từ chúng tôi.</p>
            </>
          )}
          {status === 'already' && (
            <>
              <h2 className="text-xl font-semibold">Đã hủy trước đó</h2>
              <p className="text-muted-foreground text-sm">Email này đã được hủy đăng ký rồi.</p>
            </>
          )}
          {status === 'invalid' && (
            <>
              <h2 className="text-xl font-semibold text-destructive">Link không hợp lệ</h2>
              <p className="text-muted-foreground text-sm">Link hủy đăng ký không hợp lệ hoặc đã hết hạn.</p>
            </>
          )}
          {status === 'error' && (
            <>
              <h2 className="text-xl font-semibold text-destructive">Lỗi</h2>
              <p className="text-muted-foreground text-sm">Đã xảy ra lỗi. Vui lòng thử lại sau.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Unsubscribe;
