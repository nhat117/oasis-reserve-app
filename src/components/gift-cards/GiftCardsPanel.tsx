import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase, TENANT_ID } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/useI18n';
import { CreateGiftCardDialog } from './CreateGiftCardDialog';
import { GiftCardDetailDialog } from './GiftCardDetailDialog';
import { BatchCreateDialog } from './BatchCreateDialog';
import { formatAud } from './giftCardFormat';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Gift, Plus, Search, ChevronLeft, ChevronRight, Layers } from 'lucide-react';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | 'active' | 'disabled' | 'expired';
type SortOption = 'newest' | 'expiry' | 'balance';

const statusVariant = (status: string): 'default' | 'destructive' | 'outline' | 'secondary' =>
  status === 'active' ? 'default' : status === 'disabled' ? 'destructive' : 'secondary';

export function GiftCardsPanel() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();

  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [createOpen, setCreateOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [detailCardId, setDetailCardId] = useState<string | null>(null);

  useEffect(() => { setPage(0); }, [search, statusFilter, sortBy]);

  const { data, isLoading } = useQuery({
    queryKey: ['gift-cards', TENANT_ID, page, search, statusFilter, sortBy],
    queryFn: async () => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      let query = supabase
        .from('gift_cards')
        .select('*', { count: 'exact' })
        .eq('tenant_id', TENANT_ID)
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (search.trim()) query = query.ilike('code', `%${search.trim().toUpperCase()}%`);
      if (statusFilter === 'active') query = query.eq('status', 'active').gte('expiry_date', todayStr);
      else if (statusFilter === 'disabled') query = query.eq('status', 'disabled');
      else if (statusFilter === 'expired') query = query.lt('expiry_date', todayStr);
      if (sortBy === 'expiry') query = query.order('expiry_date', { ascending: true });
      else if (sortBy === 'balance') query = query.order('balance', { ascending: false });
      else query = query.order('created_at', { ascending: false });
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data, total: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const hasNext = (page + 1) * PAGE_SIZE < total;
  const hasPrev = page > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#1B1B1B] tracking-tight">{t('Thẻ quà tặng')}</h2>
          <p className="text-sm text-muted-foreground/70 mt-0.5">{total} {t('thẻ')}</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-9 px-4" onClick={() => setBatchOpen(true)}>
              <Layers className="h-4 w-4 mr-1.5" /> {t('Tạo theo lô')}
            </Button>
            <Button size="sm" className="h-9 px-4" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> {t('Tạo thẻ quà tặng')}
            </Button>
          </div>
        )}
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
            <SelectItem value="balance">{t('Số dư cao nhất')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-10">{t('Đang tải...')}</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground rounded-xl border border-[#E5E5E5]/50 bg-white">
          <Gift className="h-10 w-10 mx-auto mb-3 opacity-15" />
          <p className="text-sm font-medium">{t('Chưa có thẻ quà tặng')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map(card => {
            const isExpired = card.expiry_date < format(new Date(), 'yyyy-MM-dd');
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setDetailCardId(card.id)}
                className="relative text-left rounded-2xl p-4 overflow-hidden bg-gradient-to-br from-[#006AFF] to-indigo-600 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
                <div className="absolute -right-2 bottom-2 h-12 w-12 rounded-full bg-white/5" />
                <div className="relative flex items-start justify-between gap-2">
                  <Gift className="h-5 w-5 text-white/70" />
                  <Badge variant={statusVariant(card.status)} className="shrink-0">{card.status}</Badge>
                </div>
                <p className="relative mt-3 text-sm font-mono font-semibold tracking-wider truncate">{card.code}</p>
                <div className="relative mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] text-white/60 uppercase tracking-wider">{t('Số dư')}</p>
                    <p className="text-lg font-semibold">{formatAud(Number(card.balance))}</p>
                    <p className="text-[11px] text-white/60">/ {formatAud(Number(card.initial_value))}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-white/60 uppercase tracking-wider">{t('Hết hạn')}</p>
                    <p className={`text-xs font-medium ${isExpired ? 'text-red-200' : 'text-white/90'}`}>{card.expiry_date}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} / {total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={!hasPrev}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={!hasNext}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <CreateGiftCardDialog open={createOpen} onOpenChange={setCreateOpen} />
      <BatchCreateDialog open={batchOpen} onOpenChange={setBatchOpen} />
      {detailCardId && (
        <GiftCardDetailDialog giftCardId={detailCardId} open={!!detailCardId} onOpenChange={(open) => !open && setDetailCardId(null)} />
      )}
    </div>
  );
}
