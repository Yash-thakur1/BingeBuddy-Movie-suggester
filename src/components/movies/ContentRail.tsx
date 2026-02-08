'use client';

import { useRef, useState, useEffect, useCallback, memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Movie, TVShow } from '@/types/movie';
import { cn } from '@/lib/utils';
import { RailCard } from './RailCard';

/**
 * Streaming-platform style content rail with auto-slide,
 * arrow navigation, and mobile swipe support.
 */

interface ContentRailProps {
  title: string;
  description?: string;
  movies?: Movie[];
  tvShows?: TVShow[];
  viewAllHref?: string;
  autoSlide?: boolean;
  autoSlideInterval?: number;
  className?: string;
}

export const ContentRail = memo(function ContentRail({
  title,
  description,
  movies,
  tvShows,
  viewAllHref,
  autoSlide = false,
  autoSlideInterval = 3000,
  className,
}: ContentRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const items = movies || tvShows || [];
  const isTV = !!tvShows;

  // Check scroll position for arrow visibility
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

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

  // Auto-slide logic with circular loop
  useEffect(() => {
    if (!autoSlide || isPaused || items.length === 0) return;

    intervalRef.current = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;

      // If near the end, loop back to start
      if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 50) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        // Scroll by one card width
        const cardWidth = el.querySelector('[data-rail-card]')?.clientWidth || 180;
        el.scrollBy({ left: cardWidth + 12, behavior: 'smooth' });
      }
    }, autoSlideInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoSlide, autoSlideInterval, isPaused, items.length]);

  // Listen for scroll events
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    updateScrollState();
    return () => el.removeEventListener('scroll', updateScrollState);
  }, [updateScrollState]);

  if (items.length === 0) return null;

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
              'focus:opacity-100'
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
              'focus:opacity-100'
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
            'flex gap-2 md:gap-3 overflow-x-auto pb-1 md:pb-2',
            'scroll-smooth snap-x snap-mandatory',
            'scrollbar-hide',
            'overscroll-x-contain'
          )}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') { scroll('right'); e.preventDefault(); }
            if (e.key === 'ArrowLeft') { scroll('left'); e.preventDefault(); }
          }}
        >
          {items.map((item, index) => (
            <div
              key={item.id}
              data-rail-card
              role="listitem"
              className="shrink-0 w-[105px] sm:w-[130px] md:w-[170px] lg:w-[185px] snap-start"
            >
              <RailCard
                movie={!isTV ? (item as Movie) : undefined}
                tvShow={isTV ? (item as TVShow) : undefined}
                priority={index < 6}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

/** Skeleton loader for a content rail */
export function ContentRailSkeleton({ count = 10 }: { count?: number }) {
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
