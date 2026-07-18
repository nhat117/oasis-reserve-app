import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase, TENANT_ID } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/useI18n';
import { useToast } from '@/hooks/use-toast';
import { discountCodeSchema, validateForm } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tag, Plus, Download, Pencil, Trash2, Loader2, Search } from 'lucide-react';

type StatusFilter = 'all' | 'active' | 'disabled' | 'expired';
type SortOption = 'newest' | 'expiry' | 'usage';

const isExpired = (dc: { valid_to: string | null }) =>
  !!dc.valid_to && dc.valid_to < format(new Date(), 'yyyy-MM-dd');

export function DiscountCodesPanel() {
  const { t } = useI18n();
  const { isAdmin, logActivity } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const requireAdmin = () => { if (!isAdmin) throw new Error('Admin only'); };

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const [discountDialog, setDiscountDialog] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<any>(null);
  const [discountCode, setDiscountCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [discountValidFrom, setDiscountValidFrom] = useState('');
  const [discountValidTo, setDiscountValidTo] = useState('');
  const [discountMaxUses, setDiscountMaxUses] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: discountCodes } = useQuery({
    queryKey: ['discount-codes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: discountCodesEnabled } = useQuery({
    queryKey: ['discount-codes-enabled'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'discount_codes_enabled').single();
      if (error) return false;
      return data.value === 'true';
    },
  });

  const toggleDiscountCodes = useMutation({
    mutationFn: async (enabled: boolean) => {
      requireAdmin();
      const { error } = await supabase.from('app_settings').upsert({ key: 'discount_codes_enabled', value: String(enabled), tenant_id: TENANT_ID }, { onConflict: 'tenant_id,key' });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['discount-codes-enabled'] }); toast({ title: t('Đã cập nhật') }); },
  });

  const saveDiscount = useMutation({
    mutationFn: async () => {
      requireAdmin();
      const vErr = validateForm(discountCodeSchema, {
        code: discountCode.toUpperCase().trim(),
        discount_percent: parseFloat(discountPercent),
        discount_amount: parseFloat(discountAmount),
        valid_from: discountValidFrom || '',
        valid_to: discountValidTo || '',
        max_uses: discountMaxUses ? parseInt(discountMaxUses) : null,
      });
      if (vErr) throw new Error(vErr);
      const payload: any = {
        code: discountCode.toUpperCase().trim(),
        discount_percent: parseFloat(discountPercent),
        discount_amount: parseFloat(discountAmount),
        valid_from: discountValidFrom || null,
        valid_to: discountValidTo || null,
        max_uses: discountMaxUses ? parseInt(discountMaxUses) : null,
      };
      if (editingDiscount) {
        const { error } = await supabase.from('discount_codes').update(payload).eq('id', editingDiscount.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('discount_codes').insert({ ...payload, tenant_id: TENANT_ID });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      logActivity('save_discount_code', `Code: ${discountCode}`);
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      setDiscountDialog(false);
      setEditingDiscount(null);
      toast({ title: t('Đã lưu mã giảm giá') });
    },
    onError: (e: Error) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  const deleteDiscount = useMutation({
    mutationFn: async (id: string) => {
      if (!isAdmin) throw new Error('Admin only');
      const dc = discountCodes?.find(d => d.id === id);
      // Already redeemed by a customer — deactivate instead of losing the usage history.
      if (dc && (dc.current_uses || 0) > 0) {
        const { error } = await supabase.from('discount_codes').update({ is_active: false }).eq('id', id);
        if (error) throw error;
        return { deactivated: true };
      }
      const { error } = await supabase.from('discount_codes').delete().eq('id', id);
      if (error) throw error;
      return { deactivated: false };
    },
    onSuccess: (result, id) => {
      logActivity(result?.deactivated ? 'deactivate_discount_code' : 'delete_discount_code', `Code ID: ${id}`);
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      setDeleteTarget(null);
      toast(result?.deactivated
        ? { title: t('Đã ẩn mã giảm giá'), description: t('Mã này đã được sử dụng nên không thể xoá hoàn toàn. Đã chuyển sang trạng thái tắt để giữ lịch sử sử dụng.') }
        : { title: t('Đã xoá') });
    },
    onError: (e: Error) => { toast({ title: t('Lỗi'), description: e.message, variant: 'destructive' }); },
  });

  const toggleDiscountActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      requireAdmin();
      const { error } = await supabase.from('discount_codes').update({ is_active: active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['discount-codes'] }); },
  });

  const visibleCodes = useMemo(() => {
    let rows = discountCodes || [];
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter(dc => dc.code.toLowerCase().includes(q));
    if (statusFilter === 'active') rows = rows.filter(dc => dc.is_active && !isExpired(dc));
    else if (statusFilter === 'disabled') rows = rows.filter(dc => !dc.is_active);
    else if (statusFilter === 'expired') rows = rows.filter(isExpired);
    const sorted = [...rows];
    if (sortBy === 'expiry') {
      sorted.sort((a, b) => (a.valid_to || '9999-99-99').localeCompare(b.valid_to || '9999-99-99'));
    } else if (sortBy === 'usage') {
      sorted.sort((a, b) => (b.current_uses || 0) - (a.current_uses || 0));
    } else {
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    return sorted;
  }, [discountCodes, search, statusFilter, sortBy]);

  const openCreate = () => {
    setEditingDiscount(null); setDiscountCode(''); setDiscountPercent('0'); setDiscountAmount('0');
    setDiscountValidFrom(''); setDiscountValidTo(''); setDiscountMaxUses(''); setDiscountDialog(true);
  };

  const openEdit = (dc: any) => {
    setEditingDiscount(dc); setDiscountCode(dc.code); setDiscountPercent(String(dc.discount_percent)); setDiscountAmount(String(dc.discount_amount));
    setDiscountValidFrom(dc.valid_from || ''); setDiscountValidTo(dc.valid_to || ''); setDiscountMaxUses(dc.max_uses ? String(dc.max_uses) : ''); setDiscountDialog(true);
  };

  const handleExportCsv = () => {
    if (!visibleCodes.length) return;
    const header = 'Code,Discount %,Discount Amount,Valid From,Valid To,Max Uses,Used,Active\n';
    const rows = visibleCodes.map(dc => `${dc.code},${dc.discount_percent},${dc.discount_amount},${dc.valid_from || ''},${dc.valid_to || ''},${dc.max_uses || ''},${dc.current_uses || 0},${dc.is_active}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `discount-codes-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#1B1B1B] tracking-tight">{t('Mã giảm giá')}</h2>
          <p className="text-sm text-muted-foreground/70 mt-0.5">{discountCodes?.length || 0} {t('mã')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t('Bật/Tắt')}</span>
            <Switch checked={discountCodesEnabled === true} onCheckedChange={(v) => toggleDiscountCodes.mutate(v)} disabled={toggleDiscountCodes.isPending} />
          </div>
          {isAdmin && (
            <Button size="sm" className="h-9 px-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" /> {t('Thêm')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" placeholder={t('Tìm theo mã...')} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('Tất cả')}</SelectItem>
            <SelectItem value="active">{t('Hoạt động')}</SelectItem>
            <SelectItem value="disabled">{t('Tắt')}</SelectItem>
            <SelectItem value="expired">{t('Hết hạn')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">{t('Mới nhất')}</SelectItem>
            <SelectItem value="expiry">{t('Hết hạn sớm nhất')}</SelectItem>
            <SelectItem value="usage">{t('Dùng nhiều nhất')}</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-9 text-xs" onClick={handleExportCsv} disabled={!visibleCodes.length}>
          <Download className="h-3.5 w-3.5 mr-1" /> CSV
        </Button>
      </div>

      <div className="rounded-xl border border-[#E5E5E5]/50 bg-white overflow-hidden">
        {!visibleCodes.length ? (
          <p className="text-sm text-muted-foreground text-center py-10">{t('Chưa có mã giảm giá nào')}</p>
        ) : (
          <div className="divide-y divide-[#E5E5E5]/20">
            {visibleCodes.map(dc => (
              <div key={dc.id} className="flex items-center justify-between p-3 px-5 hover:bg-[#F5F5F5]/60 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <Switch checked={dc.is_active} onCheckedChange={(v) => toggleDiscountActive.mutate({ id: dc.id, active: v })} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono font-semibold truncate">{dc.code}</p>
                      {isExpired(dc) && <Badge variant="secondary" className="text-[10px]">{t('Hết hạn')}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {Number(dc.discount_percent) > 0 && `${dc.discount_percent}%`}
                      {Number(dc.discount_percent) > 0 && Number(dc.discount_amount) > 0 && ' + '}
                      {Number(dc.discount_amount) > 0 && `A$ ${dc.discount_amount}`}
                      {dc.max_uses && ` · ${dc.current_uses}/${dc.max_uses} ${t('đã dùng')}`}
                      {dc.valid_to && ` · ${t('hết hạn')} ${dc.valid_to}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(dc)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(dc)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Discount Code Dialog */}
      <Dialog open={discountDialog} onOpenChange={setDiscountDialog}>
        <DialogContent className="max-w-[100vw] sm:max-w-[520px] p-0 gap-0 rounded-none sm:rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 bg-gradient-to-r from-blue-50 to-indigo-50">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                <Tag className="h-5 w-5 text-[#006AFF]" />
                {editingDiscount ? t('Sửa mã giảm giá') : t('Thêm mã giảm giá')}
              </DialogTitle>
              <DialogDescription className="text-sm">{t('Tạo mã khuyến mãi cho khách hàng')}</DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-5 py-5 space-y-5">
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Mã giảm giá')}</Label>
              <Input
                value={discountCode}
                onChange={e => setDiscountCode(e.target.value.toUpperCase())}
                placeholder="WELCOME10"
                className="mt-1.5 font-mono text-lg tracking-wider h-12 bg-[#F5F5F5] border-[#E5E5E5]/60"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Giá trị giảm')}</Label>
              <div className="grid grid-cols-2 gap-3 mt-1.5">
                <div className="relative">
                  <Input type="number" min="0" max="100" value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} className="bg-[#F5F5F5] border-[#E5E5E5]/60 pr-8" placeholder="0" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">%</span>
                </div>
                <div className="relative">
                  <Input type="number" min="0" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} className="bg-[#F5F5F5] border-[#E5E5E5]/60 pl-10" placeholder="0" />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">A$</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">{t('Có thể dùng % hoặc số tiền cố định, hoặc cả hai')}</p>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Thời gian hiệu lực')}</Label>
              <div className="grid grid-cols-2 gap-3 mt-1.5">
                <div>
                  <span className="text-[10px] text-muted-foreground">{t('Từ ngày')}</span>
                  <Input type="date" value={discountValidFrom} onChange={e => setDiscountValidFrom(e.target.value)} className="mt-0.5 bg-[#F5F5F5] border-[#E5E5E5]/60" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">{t('Đến ngày')}</span>
                  <Input type="date" value={discountValidTo} onChange={e => setDiscountValidTo(e.target.value)} className="mt-0.5 bg-[#F5F5F5] border-[#E5E5E5]/60" />
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('Giới hạn sử dụng')}</Label>
              <Input
                type="number" min="0"
                value={discountMaxUses}
                onChange={e => setDiscountMaxUses(e.target.value)}
                className="mt-1.5 bg-[#F5F5F5] border-[#E5E5E5]/60"
                placeholder={t('Không giới hạn')}
              />
            </div>
            {discountCode.trim() && (
              <div className="p-4 bg-gradient-to-r from-[#006AFF]/5 to-indigo-50 rounded-xl border border-[#006AFF]/20">
                <div className="flex items-center justify-between">
                  <code className="font-mono font-bold text-base text-[#006AFF]">{discountCode}</code>
                  <div className="text-right text-sm font-semibold text-[#1B1B1B]">
                    {Number(discountPercent) > 0 && <span>{discountPercent}%</span>}
                    {Number(discountPercent) > 0 && Number(discountAmount) > 0 && <span> + </span>}
                    {Number(discountAmount) > 0 && <span>A$ {discountAmount}</span>}
                    {!Number(discountPercent) && !Number(discountAmount) && <span className="text-muted-foreground text-xs">{t('Chưa có giá trị')}</span>}
                  </div>
                </div>
                {(discountValidFrom || discountValidTo || discountMaxUses) && (
                  <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                    {discountValidFrom && <span>{t('Từ')} {discountValidFrom}</span>}
                    {discountValidTo && <span>{t('Đến')} {discountValidTo}</span>}
                    {discountMaxUses && <span>· {t('tối đa')} {discountMaxUses} {t('lần')}</span>}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="px-5 py-4 border-t border-border/60">
            <Button
              className="w-full h-12 text-base font-medium bg-[#006AFF] hover:bg-[#1B1B1B]"
              onClick={() => saveDiscount.mutate()}
              disabled={!discountCode.trim() || saveDiscount.isPending}
            >
              {saveDiscount.isPending
                ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />{t('Đang lưu...')}</>
                : editingDiscount ? t('Cập nhật mã giảm giá') : <><Tag className="h-4 w-4 mr-2" />{t('Tạo mã giảm giá')}</>
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Xoá mã giảm giá')}</AlertDialogTitle>
            <AlertDialogDescription>
              {(deleteTarget?.current_uses || 0) > 0
                ? t('Mã này đã được sử dụng nên không thể xoá hoàn toàn. Sẽ chuyển sang trạng thái tắt để giữ lịch sử sử dụng.')
                : t('Xoá mã này?')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Huỷ')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteDiscount.mutate(deleteTarget.id)} disabled={deleteDiscount.isPending}>
              {deleteDiscount.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null} {t('Xác nhận')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
