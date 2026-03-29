import { useState, useEffect, useCallback, useRef } from 'react';

const PAGE_SIZE = 30;

/**
 * Progressive rendering hook — shows items in batches,
 * with an IntersectionObserver sentinel for automatic "load more".
 */
export function useLoadMore<T>(items: T[], pageSize = PAGE_SIZE) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset visible count when items change significantly (e.g. filter applied)
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [items.length, pageSize]);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + pageSize, items.length));
  }, [pageSize, items.length]);

  // IntersectionObserver on the sentinel element
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return { visibleItems, hasMore, loadMore, sentinelRef, totalCount: items.length };
}
