'use client';

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  memo,
  useMemo,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Movie, TVShow } from '@/types/movie';
import { cn } from '@/lib/utils';
import { RailCard } from './RailCard';

/**
 * VirtualizedRail — A streaming-platform style horizontal rail that
 * **only renders cards visible in the scroll viewport**, plus a small
 * overscan buffer on each side.
 *
 * Benefits over the original ContentRail:
 *  - DOM pressure stays ~8–12 nodes instead of 15–20 per rail
 *  - Faster initial paint for below-fold rails
 *  - Smooth 60 fps scrolling even on low-end devices
 *
 * Falls back to full rendering when the rail has ≤ 8 items (no benefit
 * from virtualisation at that size).
 */

interface VirtualizedRailProps {
  title: string;
  description?: string;
  movies?: Movie[];
  tvShows?: TVShow[];
  viewAllHref?: string;
  autoSlide?: boolean;
  autoSlideInterval?: number;
  className?: string;
}

/** Fixed card widths matching RailCard sizing at each breakpoint */
const CARD_WIDTHS = {
  base: 105,
  sm: 130,
  md: 170,
  lg: 185,
};
const GAP = { base: 8, md: 12 };

/** Number of extra cards rendered beyond the visible window on each side */
const OVERSCAN = 3;

export const VirtualizedRail = memo(function VirtualizedRail({
  title,
  description,
  movies,
  tvShows,
  viewAllHref,
  autoSlide = false,
  autoSlideInterval = 3000,
  className,
}: VirtualizedRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Visible window tracking
  const [visibleRange, setVisibleRange] = useState<[number, number]>([0, 10]);
  const rafRef = useRef<number>(0);

  const items = movies || tvShows || [];
  const isTV = !!tvShows;

  // Use simple rendering for small lists
  const shouldVirtualize = items.length > 8;

  // Get current card+gap width (approximation based on innerWidth)
  const getCardStep = useCallback(() => {
    if (typeof window === 'undefined') return CARD_WIDTHS.lg + GAP.md;
    const w = window.innerWidth;
    const cardW = w < 480 ? CARD_WIDTHS.base : w < 640 ? CARD_WIDTHS.sm : w < 768 ? CARD_WIDTHS.md : CARD_WIDTHS.lg;
    const gap = w < 768 ? GAP.base : GAP.md;
    return cardW + gap;
  }, []);

  // Total virtual width (for the spacer)
  const totalWidth = useMemo(() => {
    const step = typeof window !== 'undefined' ? getCardStep() : CARD_WIDTHS.lg + GAP.md;
    return items.length * step;
  }, [items.length, getCardStep]);

  // Recompute visible range on scroll
  const updateVisibleRange = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !shouldVirtualize) return;

    const step = getCardStep();
    const scrollLeft = el.scrollLeft;
    const viewportWidth = el.clientWidth;

    const startIdx = Math.max(0, Math.floor(scrollLeft / step) - OVERSCAN);
    const endIdx = Math.min(items.length - 1, Math.ceil((scrollLeft + viewportWidth) / step) + OVERSCAN);

    setVisibleRange((prev) => {
      if (prev[0] === startIdx && prev[1] === endIdx) return prev;
      return [startIdx, endIdx];
    });

    // Arrow state
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, [getCardStep, items.length, shouldVirtualize]);

  // Throttled scroll handler using rAF
  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(updateVisibleRange);
  }, [updateVisibleRange]);

  // Scroll by a page width
  const scroll = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.85;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  }, []);

  // Auto-slide
  useEffect(() => {
    if (!autoSlide || isPaused || items.length === 0) return;

    intervalRef.current = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 50) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        const step = getCardStep();
        el.scrollBy({ left: step, behavior: 'smooth' });
      }
    }, autoSlideInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoSlide, autoSlideInterval, isPaused, items.length, getCardStep]);

  // Scroll listener + initial range
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    updateVisibleRange();
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleScroll, updateVisibleRange]);

  if (items.length === 0) return null;

  // Build card list — virtualised or full
  const cardElements = shouldVirtualize
    ? renderVirtualizedCards(items, isTV, visibleRange, getCardStep)
    : renderAllCards(items, isTV);

  return (
    <section
      className={cn('py-2 md:py-5', className)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      {/* Header */}
      <div className="flex items-end justify-between mb-2 md:mb-3 px-0.5 md:px-1">
        <div>
          <h2 className="text-base sm:text-lg md:text-2xl font-bold text-white leading-tight">
            {title}
          </h2>
          {description && (
            <p className="text-[11px] sm:text-xs md:text-sm text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-[11px] sm:text-xs md:text-sm text-primary-400 hover:text-primary-300 transition-colors font-medium whitespace-nowrap"
          >
            See all →
          </Link>
        )}
      </div>

      {/* Rail container */}
      <div className="relative group/rail">
        {/* Left arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className={cn(
              'absolute left-0 top-0 bottom-0 z-20 w-10 md:w-12',
              'bg-gradient-to-r from-dark-950 via-dark-950/80 to-transparent',
              'flex items-center justify-start pl-1',
              'opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200',
              'focus:opacity-100',
            )}
            aria-label={`Scroll ${title} left`}
          >
            <div className="w-8 h-8 rounded-full bg-dark-800/90 backdrop-blur-sm flex items-center justify-center hover:bg-dark-700 transition-colors">
              <ChevronLeft className="w-4 h-4 text-white" />
            </div>
          </button>
        )}

        {/* Right arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className={cn(
              'absolute right-0 top-0 bottom-0 z-20 w-10 md:w-12',
              'bg-gradient-to-l from-dark-950 via-dark-950/80 to-transparent',
              'flex items-center justify-end pr-1',
              'opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200',
              'focus:opacity-100',
            )}
            aria-label={`Scroll ${title} right`}
          >
            <div className="w-8 h-8 rounded-full bg-dark-800/90 backdrop-blur-sm flex items-center justify-center hover:bg-dark-700 transition-colors">
              <ChevronRight className="w-4 h-4 text-white" />
            </div>
          </button>
        )}

        {/* Scrollable rail */}
        <div
          ref={scrollRef}
          role="list"
          aria-label={title}
          className={cn(
            'flex overflow-x-auto pb-1 md:pb-2',
            'scroll-smooth snap-x snap-mandatory',
            'scrollbar-hide overscroll-x-contain',
          )}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') { scroll('right'); e.preventDefault(); }
            if (e.key === 'ArrowLeft') { scroll('left'); e.preventDefault(); }
          }}
        >
          {shouldVirtualize ? (
            /* Virtualised: a single wide container with absolutely positioned cards */
            <div className="relative" style={{ width: totalWidth, minHeight: '1px' }}>
              {cardElements}
            </div>
          ) : (
            /* Non-virtualised: normal flow */
            cardElements
          )}
        </div>
      </div>
    </section>
  );
});

// ─── Render helpers ───────────────────────────────────────────

function renderVirtualizedCards(
  items: (Movie | TVShow)[],
  isTV: boolean,
  [startIdx, endIdx]: [number, number],
  getCardStep: () => number,
) {
  const step = getCardStep();
  const cards: JSX.Element[] = [];

  for (let i = startIdx; i <= endIdx && i < items.length; i++) {
    const item = items[i];
    cards.push(
      <div
        key={item.id}
        data-rail-card
        role="listitem"
        className="absolute top-0 shrink-0 w-[105px] sm:w-[130px] md:w-[170px] lg:w-[185px] snap-start"
        style={{ left: i * step, willChange: 'transform' }}
      >
        <RailCard
          movie={!isTV ? (item as Movie) : undefined}
          tvShow={isTV ? (item as TVShow) : undefined}
          priority={i < 6}
        />
      </div>,
    );
  }

  return cards;
}

function renderAllCards(items: (Movie | TVShow)[], isTV: boolean) {
  return items.map((item, index) => (
    <div
      key={item.id}
      data-rail-card
      role="listitem"
      className="shrink-0 w-[105px] sm:w-[130px] md:w-[170px] lg:w-[185px] snap-start"
      style={{ marginRight: index < items.length - 1 ? undefined : 0 }}
    >
      <RailCard
        movie={!isTV ? (item as Movie) : undefined}
        tvShow={isTV ? (item as TVShow) : undefined}
        priority={index < 6}
      />
    </div>
  ));
}

/** Skeleton loader matching VirtualizedRail layout */
export function VirtualizedRailSkeleton({ count = 10 }: { count?: number }) {
  return (
    <section className="py-2 md:py-5">
      <div className="mb-2 md:mb-3 px-0.5 md:px-1">
        <div className="h-5 md:h-6 w-36 md:w-48 bg-dark-800 rounded animate-pulse" />
        <div className="h-3 md:h-4 w-24 md:w-32 bg-dark-800/60 rounded animate-pulse mt-1" />
      </div>
      <div className="flex gap-2 md:gap-3 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-[105px] sm:w-[130px] md:w-[170px] lg:w-[185px]"
          >
            <div className="aspect-[2/3] bg-dark-800 rounded-lg animate-pulse" />
            <div className="h-2.5 md:h-3 w-3/4 bg-dark-800/60 rounded mt-1.5 animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default VirtualizedRail;
