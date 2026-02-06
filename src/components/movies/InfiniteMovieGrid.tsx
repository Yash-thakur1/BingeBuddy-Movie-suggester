'use client';

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  memo,
  startTransition,
} from 'react';
import { Movie, TVShow, PaginatedResponse } from '@/types/movie';
import { CompactPosterCard } from './CompactPosterCard';
import { MoviePreviewPanel } from './MoviePreviewPanel';
import { Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// =============================================
// Infinite Scroll Grid with Preview Panel
// =============================================

interface InfiniteMovieGridProps {
  /** Initial batch of movies (from server) */
  initialMovies: Movie[];
  /** Total results reported by TMDB */
  totalResults?: number;
  /** Total pages reported by TMDB */
  totalPages?: number;
  /**
   * Fetcher for the next page.
   * It receives the 1-based page number and should return a PaginatedResponse.
   * This runs client-side so the function must use a client-callable API.
   */
  fetchNextPage: (page: number) => Promise<PaginatedResponse<Movie>>;
  /** Number of items above the fold that get eager loading */
  priorityCount?: number;
  className?: string;
  /** Enable the bottom-sheet preview panel (default true) */
  enablePreview?: boolean;
}

export const InfiniteMovieGrid = memo(function InfiniteMovieGrid({
  initialMovies,
  totalResults,
  totalPages = 500,
  fetchNextPage,
  priorityCount = 6,
  className,
  enablePreview = true,
}: InfiniteMovieGridProps) {
  // All loaded movies
  const [movies, setMovies] = useState<Movie[]>(initialMovies);
  const [page, setPage] = useState(1);
  const [isFetching, setIsFetching] = useState(false);
  const [hasMore, setHasMore] = useState(totalPages > 1);
  const [error, setError] = useState<string | null>(null);

  // Dedup guard
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Preview panel state
  const [previewMovie, setPreviewMovie] = useState<Movie | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Reset when initialMovies change (e.g. filter change)
  const initialKey = useMemo(
    () => initialMovies.map((m) => m.id).join(','),
    [initialMovies]
  );

  useEffect(() => {
    setMovies(initialMovies);
    setPage(1);
    setHasMore((totalPages ?? 500) > 1);
    setError(null);
    fetchingRef.current = false;
  }, [initialKey, totalPages, initialMovies]);

  // Fetch next page
  const loadMore = useCallback(async () => {
    if (fetchingRef.current || !hasMore) return;
    fetchingRef.current = true;
    setIsFetching(true);
    setError(null);

    try {
      const nextPage = page + 1;
      const res = await fetchNextPage(nextPage);

      startTransition(() => {
        setMovies((prev) => {
          // Deduplicate by movie id
          const existingIds = new Set(prev.map((m) => m.id));
          const newMovies = res.results.filter((m) => !existingIds.has(m.id));
          return [...prev, ...newMovies];
        });
        setPage(nextPage);
        setHasMore(nextPage < Math.min(res.total_pages, 500));
      });
    } catch (err) {
      setError('Failed to load more movies. Tap to retry.');
    } finally {
      setIsFetching(false);
      // Throttle: wait a bit before allowing next fetch
      setTimeout(() => {
        fetchingRef.current = false;
      }, 300);
    }
  }, [page, hasMore, fetchNextPage]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !fetchingRef.current) {
          loadMore();
        }
      },
      { rootMargin: '600px', threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // Preview handlers
  const handleMovieClick = useCallback(
    (movie: Movie, e: React.MouseEvent) => {
      if (!enablePreview) return; // let default Link navigate
      e.preventDefault();
      e.stopPropagation();
      setPreviewMovie(movie);
      setIsPreviewOpen(true);
    },
    [enablePreview]
  );

  const handleClosePreview = useCallback(() => {
    setIsPreviewOpen(false);
    // Keep movie data briefly for exit animation
    setTimeout(() => setPreviewMovie(null), 300);
  }, []);

  if (movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-24 h-24 mb-4 rounded-full bg-dark-800 flex items-center justify-center">
          <span className="text-4xl">🎬</span>
        </div>
        <p className="text-gray-400 text-lg">No movies found</p>
      </div>
    );
  }

  return (
    <>
      {/* Grid */}
      <div
        className={cn(
          'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6',
          'gap-2.5 sm:gap-3',
          className
        )}
      >
        {movies.map((movie, i) => (
          <div
            key={movie.id}
            onClick={(e) => handleMovieClick(movie, e)}
            className={enablePreview ? 'cursor-pointer' : ''}
          >
            <CompactPosterCard
              movie={movie}
              priority={i < priorityCount}
              disableLink={enablePreview}
            />
          </div>
        ))}
      </div>

      {/* Scroll sentinel + loading indicator */}
      <div ref={sentinelRef} className="w-full py-8 flex justify-center">
        {isFetching && (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading more movies…</span>
          </div>
        )}
        {error && (
          <button
            onClick={loadMore}
            className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
          >
            {error}
          </button>
        )}
        {!hasMore && movies.length > 20 && (
          <p className="text-sm text-gray-500">You&apos;ve reached the end</p>
        )}
      </div>

      {/* Total count */}
      {totalResults && totalResults > 0 && (
        <p className="text-center text-xs text-gray-600 -mt-4 mb-4">
          Showing {movies.length.toLocaleString()} of{' '}
          {totalResults.toLocaleString()} movies
        </p>
      )}

      {/* Preview Panel */}
      {enablePreview && (
        <MoviePreviewPanel
          movie={previewMovie}
          isOpen={isPreviewOpen}
          onClose={handleClosePreview}
        />
      )}
    </>
  );
});

/**
 * Skeleton matching the infinite grid layout
 */
export function InfiniteMovieGridSkeleton({ count = 18 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[2/3] w-full rounded-lg" />
          <Skeleton className="h-3 w-3/4 rounded mt-1.5" />
        </div>
      ))}
    </div>
  );
}
