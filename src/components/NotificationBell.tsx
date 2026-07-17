import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { vi as viLocale, enAU as enLocale } from 'date-fns/locale';
import { Bell } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';

interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: unreadCount } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false);
      if (error) throw error;
      return count || 0;
    },
  });

  // Lazy-loaded: only fetches the actual list once the popover is opened.
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, body, is_read, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as NotificationRow[];
    },
    enabled: open,
  });

  const clearAll = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative h-8 w-8 flex items-center justify-center rounded-lg text-[#737373] hover:text-[#1B1B1B] hover:bg-[#F5F5F5] transition-colors"
          aria-label={t('Thông báo')}
        >
          <Bell className="h-4.5 w-4.5" />
          {!!unreadCount && unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
          <span className="text-sm font-semibold">{t('Thông báo')}</span>
          {!!notifications?.length && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearAll}>
              {t('Xoá tất cả')}
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[320px]">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t('Đang tải...')}</div>
          ) : !notifications?.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t('Không có thông báo')}</div>
          ) : (
            <div className="divide-y divide-border/40">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn('px-3 py-2.5 text-sm', !n.is_read && 'bg-[#006AFF]/5')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn('font-medium', !n.is_read && 'text-[#006AFF]')}>{n.title}</span>
                    {!n.is_read && <Badge className="h-1.5 w-1.5 rounded-full p-0 bg-[#006AFF] shrink-0 mt-1" />}
                  </div>
                  {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: lang === 'vi' ? viLocale : enLocale })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
