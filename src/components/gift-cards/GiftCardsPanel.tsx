import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, TENANT_ID } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/useI18n';
import { CreateGiftCardDialog } from './CreateGiftCardDialog';
import { GiftCardDetailDialog } from './GiftCardDetailDialog';
import { formatAud } from './giftCardFormat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Gift, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 20;

const statusVariant = (status: string): 'default' | 'destructive' | 'outline' | 'secondary' =>
  status === 'active' ? 'default' : status === 'disabled' ? 'destructive' : 'secondary';

export function GiftCardsPanel() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();

  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailCardId, setDetailCardId] = useState<string | null>(null);

  useEffect(() => { setPage(0); }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['gift-cards', TENANT_ID, page, search],
    queryFn: async () => {
      let query = supabase
        .from('gift_cards')
        .select('*', { count: 'exact' })
        .eq('tenant_id', TENANT_ID)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (search.trim()) query = query.ilike('code', `%${search.trim().toUpperCase()}%`);
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
          <Button size="sm" className="h-9 px-4" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> {t('Tạo thẻ quà tặng')}
          </Button>
        )}
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
        <Input value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" placeholder={t('Tìm theo mã...')} />
      </div>

      <div className="rounded-xl border border-[#E5E5E5]/50 bg-white overflow-hidden">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-10">{t('Đang tải...')}</p>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Gift className="h-10 w-10 mx-auto mb-3 opacity-15" />
            <p className="text-sm font-medium">{t('Chưa có thẻ quà tặng')}</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E5E5]/20">
            {rows.map(card => (
              <button
                key={card.id}
                type="button"
                onClick={() => setDetailCardId(card.id)}
                className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-[#F5F5F5]/60 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-mono font-semibold">{card.code}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('Hết hạn')} {card.expiry_date}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatAud(Number(card.balance))}</p>
                    <p className="text-xs text-muted-foreground">/ {formatAud(Number(card.initial_value))}</p>
                  </div>
                  <Badge variant={statusVariant(card.status)}>{card.status}</Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

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
      {detailCardId && (
        <GiftCardDetailDialog giftCardId={detailCardId} open={!!detailCardId} onOpenChange={(open) => !open && setDetailCardId(null)} />
      )}
    </div>
  );
}
