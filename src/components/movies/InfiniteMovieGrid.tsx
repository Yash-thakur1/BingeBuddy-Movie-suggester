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
import { Movie, PaginatedResponse } from '@/types/movie';
import { CompactPosterCard } from './CompactPosterCard';
import { MoviePreviewPanel } from './MoviePreviewPanel';
import { Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// =============================================
// Constants
// =============================================

/** How many rows ahead of viewport to keep rendered (virtualization buffer) */
const OVERSCAN_ROWS = 4;
/** IntersectionObserver rootMargin for triggering prefetch (pixels ahead) */
const PREFETCH_MARGIN = '1200px';
/** IntersectionObserver rootMargin for triggering append of buffered page */
const APPEND_MARGIN = '800px';
/** Minimum ms between fetches (throttle) */
const FETCH_COOLDOWN_MS = 250;
/** Maximum pages to buffer ahead */
const MAX_BUFFER_AHEAD = 2;
/** Number of skeleton cards to show while loading a batch */
const SKELETON_COUNT = 6;

// =============================================
// Breakpoint → column count mapping
// =============================================

const BREAKPOINTS = [
  { min: 1024, cols: 6 },
  { min: 768, cols: 5 },
  { min: 640, cols: 4 },
  { min: 0, cols: 3 },
] as const;

function getColumnCount(): number {
  if (typeof window === 'undefined') return 6;
  const w = window.innerWidth;
  for (const bp of BREAKPOINTS) {
    if (w >= bp.min) return bp.cols;
  }
  return 3;
}

// =============================================
// Prefetch buffer — fetches pages ahead of time
// =============================================

interface BufferedPage {
  page: number;
  movies: Movie[];
}

function createPrefetchBuffer(
  fetchFn: (page: number) => Promise<PaginatedResponse<Movie>>,
  maxPages: number
) {
  const buffer: BufferedPage[] = [];
  const inFlight = new Set<number>();
  let cancelled = false;

  async function prefetch(page: number) {
    if (page > maxPages || inFlight.has(page) || buffer.some((b) => b.page === page) || cancelled) {
      return;
    }
    inFlight.add(page);
    try {
      const res = await fetchFn(page);
      if (!cancelled) {
        buffer.push({ page, movies: res.results });
        buffer.sort((a, b) => a.page - b.page);
      }
    } catch {
      // Silently ignore prefetch failures — they'll be retried on demand
    } finally {
      inFlight.delete(page);
    }
  }

  function consume(page: number): Movie[] | null {
    const idx = buffer.findIndex((b) => b.page === page);
    if (idx === -1) return null;
    return buffer.splice(idx, 1)[0].movies;
  }

  function has(page: number): boolean {
    return buffer.some((b) => b.page === page);
  }

  function isInFlight(page: number): boolean {
    return inFlight.has(page);
  }

  function destroy() {
    cancelled = true;
    buffer.length = 0;
    inFlight.clear();
  }

  return { prefetch, consume, has, isInFlight, destroy };
}

// =============================================
// Virtualized Row Renderer
// =============================================

interface VirtualRowProps {
  movies: Movie[];
  startIndex: number;
  enablePreview: boolean;
  priorityCount: number;
  onMovieClick: (movie: Movie, e: React.MouseEvent) => void;
}

const VirtualRow = memo(function VirtualRow({
  movies,
  startIndex,
  enablePreview,
  priorityCount,
  onMovieClick,
}: VirtualRowProps) {
  return (
    <>
      {movies.map((movie, i) => {
        const globalIndex = startIndex + i;
        return (
          <div
            key={movie.id}
            onClick={(e) => onMovieClick(movie, e)}
            className={enablePreview ? 'cursor-pointer' : ''}
          >
            <CompactPosterCard
              movie={movie}
              priority={globalIndex < priorityCount}
              disableLink={enablePreview}
            />
          </div>
        );
      })}
    </>
  );
});

// =============================================
// Skeleton Row (inline loading placeholders)
// =============================================

function SkeletonRow({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={`skel-${i}`} className="animate-fade-in">
          <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-dark-800 ring-1 ring-dark-700/50">
            <Skeleton className="absolute inset-0" />
          </div>
          <Skeleton className="h-3 w-3/4 rounded mt-1.5" />
        </div>
      ))}
    </>
  );
}

// =============================================
// InfiniteMovieGrid (main component)
// =============================================

interface InfiniteMovieGridProps {
  /** Initial batch of movies (from server) */
  initialMovies: Movie[];
  /** Total results reported by TMDB */
  totalResults?: number;
  /** Total pages reported by TMDB */
  totalPages?: number;
  /**
   * Fetcher for the next page. Receives 1-based page number.
   * Runs client-side.
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
  enablePreview = false,
}: InfiniteMovieGridProps) {
  // ---- State ----
  const [movies, setMovies] = useState<Movie[]>(initialMovies);
  const [page, setPage] = useState(1);
  const [isFetching, setIsFetching] = useState(false);
  const [showSkeletons, setShowSkeletons] = useState(false);
  const [hasMore, setHasMore] = useState(totalPages > 1);
  const [error, setError] = useState<string | null>(null);

  // Virtualization
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: 200, // render all initially (lazy-apply virtualization after mount)
  });
  const [colCount, setColCount] = useState(6);
  const [rowHeight, setRowHeight] = useState(0);
  const [virtualEnabled, setVirtualEnabled] = useState(false);

  // Refs
  const fetchingRef = useRef(false);
  const lastFetchTime = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const prefetchSentinelRef = useRef<HTMLDivElement>(null);
  const appendSentinelRef = useRef<HTMLDivElement>(null);
  const bufferRef = useRef<ReturnType<typeof createPrefetchBuffer> | null>(null);
  const movieIdsRef = useRef(new Set<number>());
  const rowObserverRef = useRef<IntersectionObserver | null>(null);
  const rowElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  // Preview panel state
  const [previewMovie, setPreviewMovie] = useState<Movie | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const maxPage = Math.min(totalPages, 500);

  // ---- Stable identity for initialMovies change detection ----
  const initialKey = useMemo(
    () => initialMovies.map((m) => m.id).join(','),
    [initialMovies]
  );

  // ---- Initialize / reset ----
  useEffect(() => {
    // Destroy old prefetch buffer
    bufferRef.current?.destroy();

    const ids = new Set(initialMovies.map((m) => m.id));
    movieIdsRef.current = ids;

    setMovies(initialMovies);
    setPage(1);
    setHasMore((totalPages ?? 500) > 1);
    setError(null);
    setShowSkeletons(false);
    fetchingRef.current = false;

    // Create new prefetch buffer
    const buf = createPrefetchBuffer(fetchNextPage, maxPage);
    bufferRef.current = buf;

    // Eagerly prefetch page 2
    if (maxPage > 1) {
      buf.prefetch(2);
    }

    return () => buf.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey, totalPages, fetchNextPage]);

  // ---- Column count tracking ----
  useEffect(() => {
    const update = () => setColCount(getColumnCount());
    update();
    window.addEventListener('resize', update, { passive: true });
    return () => window.removeEventListener('resize', update);
  }, []);

  // ---- Measure row height & enable virtualization ----
  useEffect(() => {
    if (!gridRef.current || movies.length === 0) return;

    const measure = () => {
      const grid = gridRef.current;
      if (!grid) return;
      const firstCard = grid.children[0] as HTMLElement | undefined;
      if (!firstCard) return;
      const h = firstCard.getBoundingClientRect().height;
      if (h > 0) {
        setRowHeight(h);
        // Only enable virtualization when we have enough items (100+)
        if (movies.length > 100) {
          setVirtualEnabled(true);
        }
      }
    };

    // Measure after paint
    requestAnimationFrame(measure);
  }, [movies.length, colCount]);

  // ---- Row-based virtualization via IntersectionObserver ----
  useEffect(() => {
    if (!virtualEnabled || rowHeight === 0) return;

    // Build row observer
    const overscanPx = OVERSCAN_ROWS * rowHeight;
    const observer = new IntersectionObserver(
      (entries) => {
        // Find which rows are visible
        let minRow = Infinity;
        let maxRow = -1;
        entries.forEach((entry) => {
          const row = Number(entry.target.getAttribute('data-row'));
          if (isNaN(row)) return;
          if (entry.isIntersecting) {
            minRow = Math.min(minRow, row);
            maxRow = Math.max(maxRow, row);
          }
        });

        if (minRow <= maxRow) {
          setVisibleRange((prev) => {
            const totalRows = Math.ceil(movies.length / colCount);
            const newStart = Math.max(0, minRow - OVERSCAN_ROWS);
            const newEnd = Math.min(totalRows - 1, maxRow + OVERSCAN_ROWS);
            if (prev.start === newStart && prev.end === newEnd) return prev;
            return { start: newStart, end: newEnd };
          });
        }
      },
      {
        rootMargin: `${overscanPx}px 0px`,
        threshold: 0,
      }
    );

    rowObserverRef.current = observer;

    // Observe all currently registered row elements
    rowElementsRef.current.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [virtualEnabled, rowHeight, colCount, movies.length]);

  // ---- Register/unregister row element for virtualization ----
  const registerRow = useCallback(
    (rowIndex: number, el: HTMLDivElement | null) => {
      if (el) {
        rowElementsRef.current.set(rowIndex, el);
        rowObserverRef.current?.observe(el);
      } else {
        const prev = rowElementsRef.current.get(rowIndex);
        if (prev) rowObserverRef.current?.unobserve(prev);
        rowElementsRef.current.delete(rowIndex);
      }
    },
    []
  );

  // ---- Append movies (from buffer or fresh fetch) ----
  const appendNextPage = useCallback(async () => {
    if (fetchingRef.current || !hasMore) return;

    const now = Date.now();
    if (now - lastFetchTime.current < FETCH_COOLDOWN_MS) return;

    const nextPage = page + 1;
    if (nextPage > maxPage) {
      setHasMore(false);
      return;
    }

    // Check buffer first — instant append
    const buffered = bufferRef.current?.consume(nextPage);
    if (buffered) {
      lastFetchTime.current = now;
      startTransition(() => {
        setMovies((prev) => {
          const newMovies = buffered.filter((m) => !movieIdsRef.current.has(m.id));
          newMovies.forEach((m) => movieIdsRef.current.add(m.id));
          return [...prev, ...newMovies];
        });
        setPage(nextPage);
        setHasMore(nextPage < maxPage);
      });

      // Prefetch the next 1-2 pages ahead
      for (let i = 1; i <= MAX_BUFFER_AHEAD; i++) {
        bufferRef.current?.prefetch(nextPage + i);
      }
      return;
    }

    // Not in buffer — fetch now, show skeletons
    fetchingRef.current = true;
    setIsFetching(true);
    setShowSkeletons(true);
    setError(null);

    try {
      const res = await fetchNextPage(nextPage);
      lastFetchTime.current = Date.now();

      startTransition(() => {
        setMovies((prev) => {
          const newMovies = res.results.filter((m) => !movieIdsRef.current.has(m.id));
          newMovies.forEach((m) => movieIdsRef.current.add(m.id));
          return [...prev, ...newMovies];
        });
        setPage(nextPage);
        setHasMore(nextPage < Math.min(res.total_pages, 500));
        setShowSkeletons(false);
      });

      // Prefetch upcoming pages
      for (let i = 1; i <= MAX_BUFFER_AHEAD; i++) {
        bufferRef.current?.prefetch(nextPage + i);
      }
    } catch {
      setError('Failed to load more movies. Tap to retry.');
      setShowSkeletons(false);
    } finally {
      setIsFetching(false);
      setTimeout(() => {
        fetchingRef.current = false;
      }, FETCH_COOLDOWN_MS);
    }
  }, [page, hasMore, maxPage, fetchNextPage]);

  // ---- Prefetch sentinel: fires early to start buffering ----
  useEffect(() => {
    const el = prefetchSentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      () => {
        const nextPage = page + 1;
        if (nextPage <= maxPage) {
          // Start prefetching 1-2 pages ahead
          for (let i = 0; i <= MAX_BUFFER_AHEAD; i++) {
            bufferRef.current?.prefetch(nextPage + i);
          }
        }
      },
      { rootMargin: PREFETCH_MARGIN, threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [page, maxPage]);

  // ---- Append sentinel: fires closer to bottom to trigger actual append ----
  useEffect(() => {
    const el = appendSentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !fetchingRef.current) {
          appendNextPage();
        }
      },
      { rootMargin: APPEND_MARGIN, threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [appendNextPage]);

  // ---- Preview handlers ----
  const handleMovieClick = useCallback(
    (movie: Movie, e: React.MouseEvent) => {
      if (!enablePreview) return;
      e.preventDefault();
      e.stopPropagation();
      setPreviewMovie(movie);
      setIsPreviewOpen(true);
    },
    [enablePreview]
  );

  const handleClosePreview = useCallback(() => {
    setIsPreviewOpen(false);
    setTimeout(() => setPreviewMovie(null), 300);
  }, []);

  // ---- Derived data for rendering ----
  const totalRows = Math.ceil(movies.length / colCount);
  const rows = useMemo(() => {
    const result: { rowIndex: number; movies: Movie[]; startIndex: number }[] = [];
    for (let r = 0; r < totalRows; r++) {
      // Virtualization: skip rows outside visible range when enabled
      if (virtualEnabled && (r < visibleRange.start || r > visibleRange.end)) {
        result.push({ rowIndex: r, movies: [], startIndex: r * colCount });
        continue;
      }
      const start = r * colCount;
      const end = Math.min(start + colCount, movies.length);
      result.push({
        rowIndex: r,
        movies: movies.slice(start, end),
        startIndex: start,
      });
    }
    return result;
  }, [movies, colCount, totalRows, virtualEnabled, visibleRange]);

  // ---- Empty state ----
  if (movies.length === 0 && !isFetching) {
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
      {/* Grid with virtualized rows */}
      <div
        ref={gridRef}
        className={cn(
          'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6',
          'gap-2.5 sm:gap-3',
          className
        )}
        style={
          virtualEnabled && rowHeight > 0
            ? { minHeight: totalRows * rowHeight }
            : undefined
        }
      >
        {rows.map(({ rowIndex, movies: rowMovies, startIndex }) => {
          // Empty placeholder row (virtualized out)
          if (rowMovies.length === 0 && virtualEnabled) {
            return (
              <div
                key={`row-${rowIndex}`}
                ref={(el) => registerRow(rowIndex, el)}
                data-row={rowIndex}
                className="col-span-full"
                style={{ height: rowHeight || 'auto' }}
              />
            );
          }

          return (
            <VirtualRow
              key={`vr-${rowIndex}`}
              movies={rowMovies}
              startIndex={startIndex}
              enablePreview={enablePreview}
              priorityCount={priorityCount}
              onMovieClick={handleMovieClick}
            />
          );
        })}

        {/* Inline skeleton placeholders during fetch */}
        {showSkeletons && <SkeletonRow count={SKELETON_COUNT} />}
      </div>

      {/* Prefetch sentinel (way ahead — triggers background buffering) */}
      <div
        ref={prefetchSentinelRef}
        className="w-full h-px"
        aria-hidden
      />

      {/* Append sentinel (closer — triggers visible append) */}
      <div ref={appendSentinelRef} className="w-full py-6 flex justify-center">
        {isFetching && !showSkeletons && (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading more movies…</span>
          </div>
        )}
        {error && (
          <button
            onClick={appendNextPage}
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
        <p className="text-center text-xs text-gray-600 -mt-2 mb-4">
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
