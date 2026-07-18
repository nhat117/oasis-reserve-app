import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase, TENANT_ID } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/useI18n';
import { useToast } from '@/hooks/use-toast';
import { generateGiftCardCode } from '@/lib/giftCardCode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Gift, Tag, Loader2, Download, Check } from 'lucide-react';

const YEARS_VALID = 3;

interface BatchCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type BatchResult =
  | { kind: 'gift_cards'; rows: { code: string; value: number; expiry: string; status: string }[] }
  | { kind: 'discount_codes'; rows: { code: string; percent: number; amount: number; validFrom: string; validTo: string; maxUses: string; status: string }[] };

const downloadCsv = (filename: string, header: string, lines: string[]) => {
  const blob = new Blob([header + lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// One dialog, two tabs — gift cards and discount codes are separate tables
// with different shapes, but staff think of both as "generate a batch of codes",
// so they share one entry point instead of two lookalike dialogs.
export function BatchCreateDialog({ open, onOpenChange }: BatchCreateDialogProps) {
  const { t } = useI18n();
  const { user, isAdmin, logActivity } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<'gift_cards' | 'discount_codes'>('gift_cards');
  const [result, setResult] = useState<BatchResult | null>(null);

  // Gift card batch fields
  const [gcAmount, setGcAmount] = useState('');
  const [gcCount, setGcCount] = useState('10');
  const [gcPurchaserNote, setGcPurchaserNote] = useState('');
  const [gcCreateDisabled, setGcCreateDisabled] = useState(false);

  // Discount code batch fields
  const [dcPrefix, setDcPrefix] = useState('');
  const [dcCount, setDcCount] = useState('10');
  const [dcPercent, setDcPercent] = useState('0');
  const [dcAmount, setDcAmount] = useState('0');
  const [dcValidFrom, setDcValidFrom] = useState('');
  const [dcValidTo, setDcValidTo] = useState('');
  const [dcMaxUses, setDcMaxUses] = useState('');
  const [dcCreateDisabled, setDcCreateDisabled] = useState(false);

  const resetForm = () => {
    setGcAmount(''); setGcCount('10'); setGcPurchaserNote(''); setGcCreateDisabled(false);
    setDcPrefix(''); setDcCount('10'); setDcPercent('0'); setDcAmount('0');
    setDcValidFrom(''); setDcValidTo(''); setDcMaxUses(''); setDcCreateDisabled(false);
    setResult(null);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const createGiftCardBatch = useMutation({
    mutationFn: async () => {
      const count = parseInt(gcCount) || 0;
      if (count < 1 || count > 200) throw new Error(t('Số lượng phải từ 1 đến 200'));
      const parsedAmount = parseFloat(gcAmount);
      if (!parsedAmount || parsedAmount <= 0) throw new Error(t('Cần nhập giá trị thẻ'));
      const activationDate = new Date();
      const expiryDate = new Date(activationDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + YEARS_VALID);
      const status = gcCreateDisabled ? 'disabled' : 'active';

      const rows: { code: string; value: number; expiry: string; status: string }[] = [];
      for (let i = 0; i < count; i++) {
        let inserted = false;
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
          const code = generateGiftCardCode();
          const { data, error } = await supabase.from('gift_cards').insert({
            code,
            initial_value: parsedAmount,
            balance: parsedAmount,
            purchaser_note: gcPurchaserNote.trim() || null,
            created_by: user?.id,
            tenant_id: TENANT_ID,
            activation_date: format(activationDate, 'yyyy-MM-dd'),
            expiry_date: format(expiryDate, 'yyyy-MM-dd'),
            status,
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
            rows.push({ code: data.code, value: parsedAmount, expiry: format(expiryDate, 'yyyy-MM-dd'), status });
            inserted = true;
          } else if ((error as { code?: string }).code === '23505') {
            lastError = error;
          } else {
            throw error;
          }
        }
        if (!inserted) throw lastError instanceof Error ? lastError : new Error('Failed to generate a unique code');
      }
      return rows;
    },
    onSuccess: (rows) => {
      logActivity('create_gift_card_batch', `Count: ${rows.length}, Amount: ${gcAmount}, Disabled: ${gcCreateDisabled}`);
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] });
      queryClient.invalidateQueries({ queryKey: ['gift-card-liability'] });
      setResult({ kind: 'gift_cards', rows });
      toast({ title: t('Đã tạo thẻ quà tặng'), description: `${rows.length} ${t('thẻ đã được tạo')}` });
    },
    onError: (e: Error) => toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }),
  });

  const createDiscountBatch = useMutation({
    mutationFn: async () => {
      if (!isAdmin) throw new Error('Admin only');
      const count = parseInt(dcCount) || 0;
      if (count < 1 || count > 500) throw new Error(t('Số lượng phải từ 1 đến 500'));
      const prefix = dcPrefix.toUpperCase().trim().replace(/[^A-Z0-9_-]/g, '');
      const percent = parseFloat(dcPercent) || 0;
      const amount = parseFloat(dcAmount) || 0;
      if (percent <= 0 && amount <= 0) throw new Error(t('Cần nhập giá trị giảm'));
      const isActive = !dcCreateDisabled;
      const rows = Array.from({ length: count }, () => ({
        code: `${prefix}${prefix ? '-' : ''}${generateGiftCardCode(6)}`,
        discount_percent: percent,
        discount_amount: amount,
        valid_from: dcValidFrom || null,
        valid_to: dcValidTo || null,
        max_uses: dcMaxUses ? parseInt(dcMaxUses) : null,
        is_active: isActive,
        tenant_id: TENANT_ID,
      }));
      const { data, error } = await supabase.from('discount_codes').insert(rows).select('code');
      if (error) throw error;
      return (data || []).map(d => ({
        code: d.code, percent, amount, validFrom: dcValidFrom, validTo: dcValidTo,
        maxUses: dcMaxUses, status: isActive ? 'active' : 'disabled',
      }));
    },
    onSuccess: (rows) => {
      logActivity('create_discount_batch', `Count: ${rows.length}, Prefix: ${dcPrefix}, Disabled: ${dcCreateDisabled}`);
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      setResult({ kind: 'discount_codes', rows });
      toast({ title: t('Đã tạo mã giảm giá'), description: `${rows.length} ${t('mã đã được tạo')}` });
    },
    onError: (e: Error) => toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }),
  });

  const handleDownload = () => {
    if (!result) return;
    if (result.kind === 'gift_cards') {
      const header = 'Code,Value,Expiry,Status\n';
      const lines = result.rows.map(r => `${r.code},${r.value},${r.expiry},${r.status}`);
      downloadCsv(`gift-cards-batch-${format(new Date(), 'yyyy-MM-dd')}.csv`, header, lines);
    } else {
      const header = 'Code,Discount %,Discount Amount,Valid From,Valid To,Max Uses,Status\n';
      const lines = result.rows.map(r => `${r.code},${r.percent},${r.amount},${r.validFrom || ''},${r.validTo || ''},${r.maxUses || ''},${r.status}`);
      downloadCsv(`discount-codes-batch-${format(new Date(), 'yyyy-MM-dd')}.csv`, header, lines);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        {result ? (
          <div className="space-y-4 pt-2">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-emerald-600" /> {t('Đã tạo theo lô')}
              </DialogTitle>
              <DialogDescription>
                {result.rows.length} {result.kind === 'gift_cards' ? t('thẻ đã được tạo') : t('mã đã được tạo')}
              </DialogDescription>
            </DialogHeader>
            <div className="p-4 bg-[#F5F5F5] rounded-xl border border-[#E5E5E5]/60 max-h-[200px] overflow-y-auto">
              <div className="space-y-1">
                {result.rows.slice(0, 50).map(r => (
                  <p key={r.code} className="text-xs font-mono">{r.code}</p>
                ))}
                {result.rows.length > 50 && (
                  <p className="text-xs text-muted-foreground pt-1">+{result.rows.length - 50} {t('khác')}</p>
                )}
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" /> {t('Tải file CSV')}
            </Button>
            <Button className="w-full" onClick={() => handleClose(false)}>{t('Xong')}</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-[#006AFF]" /> {t('Tạo theo lô')}
              </DialogTitle>
              <DialogDescription>{t('Tạo nhiều thẻ quà tặng hoặc mã giảm giá cùng lúc')}</DialogDescription>
            </DialogHeader>

            <Tabs value={tab} onValueChange={(v) => setTab(v as 'gift_cards' | 'discount_codes')}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="gift_cards"><Gift className="h-3.5 w-3.5 mr-1.5" /> {t('Thẻ quà tặng')}</TabsTrigger>
                <TabsTrigger value="discount_codes"><Tag className="h-3.5 w-3.5 mr-1.5" /> {t('Mã giảm giá')}</TabsTrigger>
              </TabsList>

              <TabsContent value="gift_cards" className="space-y-4 pt-2">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Giá trị mỗi thẻ (A$)')}</Label>
                  <Input type="number" min="1" step="0.01" value={gcAmount} onChange={e => setGcAmount(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60" placeholder="50" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Số lượng thẻ')}</Label>
                  <Input type="number" min="1" max="200" value={gcCount} onChange={e => setGcCount(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Ghi chú')} ({t('tuỳ chọn')})</Label>
                  <Input value={gcPurchaserNote} onChange={e => setGcPurchaserNote(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={gcCreateDisabled} onCheckedChange={(v) => setGcCreateDisabled(!!v)} />
                  <span className="text-sm text-muted-foreground">{t('Tạo ở trạng thái khoá (xem lại trước khi dùng)')}</span>
                </label>
                <Button
                  className="w-full h-11 bg-[#006AFF] hover:bg-[#1B1B1B]"
                  onClick={() => createGiftCardBatch.mutate()}
                  disabled={createGiftCardBatch.isPending || !gcAmount || parseFloat(gcAmount) <= 0 || !gcCount}
                >
                  {createGiftCardBatch.isPending
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang tạo...')}</>
                    : <><Gift className="h-4 w-4 mr-2" />{t('Tạo')} {gcCount || 0} {t('thẻ')}</>}
                </Button>
              </TabsContent>

              <TabsContent value="discount_codes" className="space-y-4 pt-2">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Tiền tố (không bắt buộc)')}</Label>
                  <Input
                    value={dcPrefix}
                    onChange={e => setDcPrefix(e.target.value.toUpperCase())}
                    placeholder="SUMMER"
                    className="mt-1.5 font-mono tracking-wider bg-[#F5F5F5] border-[#E5E5E5]/60"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {t('Ví dụ')}: {dcPrefix ? `${dcPrefix.toUpperCase().trim().replace(/[^A-Z0-9_-]/g, '')}-XXXXXX` : 'XXXXXX'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Số lượng mã')}</Label>
                  <Input type="number" min="1" max="500" value={dcCount} onChange={e => setDcCount(e.target.value)} className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Giá trị giảm')}</Label>
                  <div className="grid grid-cols-2 gap-3 mt-1.5">
                    <div className="relative">
                      <Input type="number" min="0" max="100" value={dcPercent} onChange={e => setDcPercent(e.target.value)} className="bg-[#F5F5F5] border-[#E5E5E5]/60 pr-8" placeholder="0" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">%</span>
                    </div>
                    <div className="relative">
                      <Input type="number" min="0" value={dcAmount} onChange={e => setDcAmount(e.target.value)} className="bg-[#F5F5F5] border-[#E5E5E5]/60 pl-10" placeholder="0" />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">A$</span>
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Thời gian hiệu lực')}</Label>
                  <div className="grid grid-cols-2 gap-3 mt-1.5">
                    <div>
                      <span className="text-[10px] text-muted-foreground">{t('Từ ngày')}</span>
                      <Input type="date" value={dcValidFrom} onChange={e => setDcValidFrom(e.target.value)} className="mt-0.5 bg-[#F5F5F5] border-[#E5E5E5]/60" />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground">{t('Đến ngày')}</span>
                      <Input type="date" value={dcValidTo} onChange={e => setDcValidTo(e.target.value)} className="mt-0.5 bg-[#F5F5F5] border-[#E5E5E5]/60" />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Giới hạn sử dụng mỗi mã')}</Label>
                  <Input
                    type="number" min="0"
                    value={dcMaxUses}
                    onChange={e => setDcMaxUses(e.target.value)}
                    className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60"
                    placeholder={t('Không giới hạn')}
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={dcCreateDisabled} onCheckedChange={(v) => setDcCreateDisabled(!!v)} />
                  <span className="text-sm text-muted-foreground">{t('Tạo ở trạng thái tắt (xem lại trước khi dùng)')}</span>
                </label>
                <Button
                  className="w-full h-11 bg-[#006AFF] hover:bg-[#1B1B1B]"
                  onClick={() => createDiscountBatch.mutate()}
                  disabled={createDiscountBatch.isPending || !dcCount || (!Number(dcPercent) && !Number(dcAmount))}
                >
                  {createDiscountBatch.isPending
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('Đang tạo...')}</>
                    : <><Tag className="h-4 w-4 mr-2" />{t('Tạo')} {dcCount || 0} {t('mã')}</>}
                </Button>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
