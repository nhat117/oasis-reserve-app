import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/useI18n';
import { useToast } from '@/hooks/use-toast';
import { giftCardAdjustSchema, validateForm } from '@/lib/validation';
import { formatAud } from './giftCardFormat';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Ban, RotateCcw, PlusCircle } from 'lucide-react';

interface GiftCardDetailDialogProps {
  giftCardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusVariant = (status: string): 'default' | 'destructive' | 'outline' | 'secondary' =>
  status === 'active' ? 'default' : status === 'disabled' ? 'destructive' : 'secondary';

export function GiftCardDetailDialog({ giftCardId, open, onOpenChange }: GiftCardDetailDialogProps) {
  const { t } = useI18n();
  const { isAdmin, logActivity } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const { data: card } = useQuery({
    queryKey: ['gift-card-detail', giftCardId],
    queryFn: async () => {
      const { data, error } = await supabase.from('gift_cards').select('*').eq('id', giftCardId).single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: transactions } = useQuery({
    queryKey: ['gift-card-transactions', giftCardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gift_card_transactions')
        .select('*, sales(id, sale_date, customer_name)')
        .eq('gift_card_id', giftCardId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['gift-card-detail', giftCardId] });
    queryClient.invalidateQueries({ queryKey: ['gift-card-transactions', giftCardId] });
    queryClient.invalidateQueries({ queryKey: ['gift-cards'] });
    queryClient.invalidateQueries({ queryKey: ['gift-card-liability'] });
  };

  const setStatus = useMutation({
    mutationFn: async (status: 'active' | 'disabled') => {
      if (!isAdmin) throw new Error('Admin only');
      const { error } = await supabase.from('gift_cards').update({ status }).eq('id', giftCardId);
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      logActivity(status === 'disabled' ? 'disable_gift_card' : 'enable_gift_card', `Gift card ID: ${giftCardId}`);
      invalidateAll();
      toast({ title: status === 'disabled' ? t('Đã khoá thẻ') : t('Đã mở lại thẻ') });
    },
    onError: (e: Error) => toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }),
  });

  const adjustBalance = useMutation({
    mutationFn: async () => {
      const delta = parseFloat(adjustDelta);
      const vErr = validateForm(giftCardAdjustSchema, { delta, reason: adjustReason });
      if (vErr) throw new Error(vErr);
      const { data, error } = await supabase.rpc('adjust_gift_card_balance', {
        p_gift_card_id: giftCardId,
        p_delta: delta,
        p_reason: adjustReason.trim(),
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; new_balance?: number };
      if (!result.success) {
        const messages: Record<string, string> = {
          reason_required: t('Cần nhập lý do'),
          not_found: t('Không tìm thấy thẻ'),
          insufficient_balance: t('Số dư không đủ để trừ'),
          exceeds_initial_value: t('Vượt quá giá trị ban đầu của thẻ'),
        };
        throw new Error(messages[result.error || ''] || t('Không thể điều chỉnh số dư'));
      }
      return result;
    },
    onSuccess: () => {
      logActivity('adjust_gift_card_balance', `Gift card ID: ${giftCardId}, Delta: ${adjustDelta}, Reason: ${adjustReason}`);
      invalidateAll();
      setAdjustOpen(false);
      setAdjustDelta('');
      setAdjustReason('');
      toast({ title: t('Đã điều chỉnh số dư') });
    },
    onError: (e: Error) => toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }),
  });

  const typeLabel = (type: string) => {
    if (type === 'issue') return t('Tạo thẻ');
    if (type === 'redemption') return t('Sử dụng');
    return t('Điều chỉnh');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono">{card?.code}</DialogTitle>
          <DialogDescription>{t('Chi tiết thẻ quà tặng')}</DialogDescription>
        </DialogHeader>
        {card && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">{t('Số dư hiện tại')}</p>
                <p className="text-lg font-semibold">{formatAud(Number(card.balance))} <span className="text-xs text-muted-foreground">/ {formatAud(Number(card.initial_value))}</span></p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t('Trạng thái')}</p>
                <Badge variant={statusVariant(card.status)}>{card.status}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t('Ngày tạo')}</p>
                <p>{card.activation_date}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t('Hết hạn')}</p>
                <p>{card.expiry_date}</p>
              </div>
              {card.purchaser_name && (
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">{t('Người mua')}</p>
                  <p>{card.purchaser_name}</p>
                </div>
              )}
              {card.purchaser_note && (
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">{t('Ghi chú')}</p>
                  <p>{card.purchaser_note}</p>
                </div>
              )}
            </div>

            {isAdmin && (
              <div className="flex gap-2 border-t border-border/50 pt-3">
                {card.status === 'disabled' ? (
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setStatus.mutate('active')} disabled={setStatus.isPending}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> {t('Mở lại thẻ')}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={() => setStatus.mutate('disabled')} disabled={setStatus.isPending}>
                    <Ban className="h-3.5 w-3.5 mr-1.5" /> {t('Khoá thẻ')}
                  </Button>
                )}
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setAdjustOpen(v => !v)}>
                  <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> {t('Điều chỉnh số dư')}
                </Button>
              </div>
            )}

            {isAdmin && adjustOpen && (
              <div className="p-3 bg-[#F5F5F5] rounded-lg border border-[#E5E5E5]/60 space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">{t('Số tiền')} ({t('dương để cộng, âm để trừ')})</Label>
                  <Input type="number" step="0.01" value={adjustDelta} onChange={e => setAdjustDelta(e.target.value)} className="mt-1 bg-white" placeholder="10 hoặc -10" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t('Lý do')} ({t('bắt buộc')})</Label>
                  <Textarea value={adjustReason} onChange={e => setAdjustReason(e.target.value)} className="mt-1 bg-white min-h-[50px]" />
                </div>
                <Button size="sm" className="w-full" onClick={() => adjustBalance.mutate()} disabled={adjustBalance.isPending || !adjustDelta || !adjustReason.trim()}>
                  {adjustBalance.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null} {t('Xác nhận')}
                </Button>
              </div>
            )}

            <div className="border-t border-border/50 pt-3">
              <p className="text-sm font-medium mb-2">{t('Lịch sử giao dịch')}</p>
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {!transactions?.length && <p className="text-xs text-muted-foreground text-center py-4">{t('Chưa có giao dịch')}</p>}
                {transactions?.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/20 last:border-0">
                    <div>
                      <p className="font-medium">{typeLabel(tx.type)}</p>
                      <p className="text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()} {tx.reason ? `· ${tx.reason}` : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={Number(tx.amount) < 0 ? 'text-destructive font-medium' : 'text-emerald-600 font-medium'}>
                        {Number(tx.amount) >= 0 ? '+' : ''}{formatAud(Number(tx.amount))}
                      </p>
                      <p className="text-muted-foreground">{formatAud(Number(tx.balance_after))}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
