import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase, TENANT_ID } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/useI18n';
import { useToast } from '@/hooks/use-toast';
import { generateGiftCardCode } from '@/lib/giftCardCode';
import { giftCardCreateSchema, validateForm } from '@/lib/validation';
import { formatAud } from './giftCardFormat';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Gift, Loader2, Copy, Check } from 'lucide-react';

const YEARS_VALID = 3;

interface CreateGiftCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateGiftCardDialog({ open, onOpenChange }: CreateGiftCardDialogProps) {
  const { t } = useI18n();
  const { user, logActivity } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState('');
  const [purchaserName, setPurchaserName] = useState('');
  const [purchaserNote, setPurchaserNote] = useState('');
  const [createdCard, setCreatedCard] = useState<{ code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setAmount('');
    setPurchaserName('');
    setPurchaserNote('');
    setCreatedCard(null);
    setCopied(false);
  };

  const activationDate = new Date();
  const expiryDate = new Date(activationDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + YEARS_VALID);

  const createGiftCard = useMutation({
    mutationFn: async () => {
      const parsedAmount = parseFloat(amount);
      const vErr = validateForm(giftCardCreateSchema, {
        initialValue: parsedAmount,
        purchaserName: purchaserName || '',
        purchaserNote: purchaserNote || '',
      });
      if (vErr) throw new Error(vErr);

      let lastError: unknown = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateGiftCardCode();
        const { data, error } = await supabase.from('gift_cards').insert({
          code,
          initial_value: parsedAmount,
          balance: parsedAmount,
          purchaser_name: purchaserName.trim() || null,
          purchaser_note: purchaserNote.trim() || null,
          created_by: user?.id,
          tenant_id: TENANT_ID,
          activation_date: format(activationDate, 'yyyy-MM-dd'),
          expiry_date: format(expiryDate, 'yyyy-MM-dd'),
        }).select('id, code').single();

        if (!error) {
          const { error: ledgerError } = await supabase.from('gift_card_transactions').insert({
            gift_card_id: data.id,
            amount: parsedAmount,
            type: 'issue',
            balance_after: parsedAmount,
            processed_by: user?.id,
            processed_by_email: user?.email || null,
            tenant_id: TENANT_ID,
          });
          if (ledgerError) throw ledgerError;
          return data;
        }
        if ((error as { code?: string }).code === '23505') { lastError = error; continue; }
        throw error;
      }
      throw lastError instanceof Error ? lastError : new Error('Failed to generate a unique code');
    },
    onSuccess: (data) => {
      logActivity('create_gift_card', `Code: ${data.code}, Amount: ${amount}`);
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] });
      queryClient.invalidateQueries({ queryKey: ['gift-card-liability'] });
      setCreatedCard({ code: data.code });
      toast({ title: t('Đã tạo thẻ quà tặng') });
    },
    onError: (e: Error) => {
      toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' });
    },
  });

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const handleCopy = () => {
    if (!createdCard) return;
    navigator.clipboard.writeText(createdCard.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px]">
        {createdCard ? (
          <div className="space-y-4 pt-2">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-[#006AFF]" /> {t('Đã tạo thẻ quà tặng')}
              </DialogTitle>
              <DialogDescription>{t('Gửi mã này cho khách hàng')}</DialogDescription>
            </DialogHeader>
            <div className="p-4 bg-[#F5F5F5] rounded-xl border border-[#E5E5E5]/60 flex items-center justify-between gap-3">
              <code className="text-2xl font-mono font-bold tracking-widest">{createdCard.code}</code>
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button className="w-full" onClick={() => handleClose(false)}>{t('Xong')}</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-[#006AFF]" /> {t('Tạo thẻ quà tặng')}
              </DialogTitle>
              <DialogDescription>{t('Thẻ quà tặng có giá trị lưu trữ, khách dùng dần qua nhiều lần')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Giá trị (A$)')}</Label>
                <Input type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60" placeholder="50" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Tên người mua')} ({t('tuỳ chọn')})</Label>
                <Input value={purchaserName} onChange={e => setPurchaserName(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Ghi chú')} ({t('tuỳ chọn')})</Label>
                <Textarea value={purchaserNote} onChange={e => setPurchaserNote(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60 min-h-[60px]" />
              </div>
              <div className="p-3 bg-[#F5F5F5] rounded-lg border border-[#E5E5E5]/40 text-xs text-muted-foreground">
                {t('Có hiệu lực đến')}: <strong className="text-[#1B1B1B]">{format(expiryDate, 'dd/MM/yyyy')}</strong>
                {amount && parseFloat(amount) > 0 && <> · {t('Giá trị')}: <strong className="text-[#1B1B1B]">{formatAud(parseFloat(amount))}</strong></>}
              </div>
              <Button className="w-full bg-[#006AFF] hover:bg-[#1B1B1B]" onClick={() => createGiftCard.mutate()} disabled={createGiftCard.isPending || !amount || parseFloat(amount) <= 0}>
                {createGiftCard.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang tạo...')}</> : <><Gift className="h-4 w-4 mr-2" />{t('Tạo thẻ')}</>}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
