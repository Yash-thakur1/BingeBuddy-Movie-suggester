'use client';

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { TVShow, PaginatedResponse } from '@/types/movie';
import { CompactPosterCard } from './CompactPosterCard';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

/**
 * Infinite-scrolling TV show grid.
 * Uses IntersectionObserver to trigger page fetches.
 * Prefetches the next page ahead of time.
 * Shows skeleton placeholders while loading.
 */

interface InfiniteTVGridProps {
  initialShows: TVShow[];
  totalResults: number;
  totalPages: number;
  fetchNextPage: (page: number) => Promise<PaginatedResponse<TVShow>>;
}

const SKELETON_COUNT = 6;

export const InfiniteTVGrid = memo(function InfiniteTVGrid({
  initialShows,
  totalResults,
  totalPages,
  fetchNextPage,
}: InfiniteTVGridProps) {
  const [shows, setShows] = useState<TVShow[]>(initialShows);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(totalPages > 1);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);
  const prefetchedRef = useRef<TVShow[] | null>(null);

  // Reset when initial data changes (filter change)
  useEffect(() => {
    setShows(initialShows);
    setPage(1);
    setHasMore(totalPages > 1);
    prefetchedRef.current = null;
    fetchingRef.current = false;
  }, [initialShows, totalPages]);

  // Prefetch next page
  useEffect(() => {
    if (page + 1 > totalPages || prefetchedRef.current) return;
    const nextPage = page + 1;
    fetchNextPage(nextPage)
      .then((res) => {
        prefetchedRef.current = res.results;
      })
      .catch(() => {});
  }, [page, totalPages, fetchNextPage]);

  const loadMore = useCallback(async () => {
    if (fetchingRef.current || !hasMore) return;
    fetchingRef.current = true;
    setIsLoading(true);

    const nextPage = page + 1;

    try {
      let newShows: TVShow[];
      if (prefetchedRef.current) {
        newShows = prefetchedRef.current;
        prefetchedRef.current = null;
      } else {
        const res = await fetchNextPage(nextPage);
        newShows = res.results;
      }

      setShows((prev) => {
        const ids = new Set(prev.map((s) => s.id));
        const unique = newShows.filter((s) => !ids.has(s.id));
        return [...prev, ...unique];
      });
      setPage(nextPage);
      setHasMore(nextPage < Math.min(totalPages, 500));
    } catch {
      // Silently fail, user can scroll again
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [page, hasMore, totalPages, fetchNextPage]);

  // Intersection observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !fetchingRef.current) {
          loadMore();
        }
      },
      { rootMargin: '800px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  return (
    <div>
      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4">
        {shows.map((show, i) => (
          <CompactPosterCard key={show.id} tvShow={show} priority={i < 12} />
        ))}

        {/* Skeleton placeholders */}
        {isLoading &&
          Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <div key={`skel-${i}`} className="space-y-2">
              <div className="aspect-[2/3] bg-dark-800 rounded-lg animate-pulse" />
              <div className="h-3 w-3/4 bg-dark-800/60 rounded animate-pulse" />
            </div>
          ))}
      </div>

      {/* Sentinel for intersection observer */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          {isLoading && (
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
          )}
        </div>
      )}

      {/* End of content */}
      {!hasMore && shows.length > 0 && (
        <p className="text-center text-sm text-gray-500 py-8">
          You&apos;ve seen all {totalResults.toLocaleString()} results
        </p>
      )}
    </div>
  );
});

/** Skeleton for the initial load */
export function InfiniteTVGridSkeleton() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4">
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="aspect-[2/3] bg-dark-800 rounded-lg animate-pulse" />
          <div className="h-3 w-3/4 bg-dark-800/60 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
