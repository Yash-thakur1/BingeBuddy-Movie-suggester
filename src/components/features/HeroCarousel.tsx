'use client';

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Play, Info, Bookmark, BookmarkCheck } from 'lucide-react';
import { Movie, TVShow } from '@/types/movie';
import { getImageUrl, getYear, getGenreName, getTVGenreName } from '@/lib/tmdb';
import { Button, RatingBadge, Badge } from '@/components/ui';
import { useWatchlistStore, useUIStore } from '@/store';
import { cn } from '@/lib/utils';

/**
 * HeroCarousel — Full-width streaming-style hero carousel.
 * Supports both Movie and TVShow items.
 * • Auto-slides every 3 s in a circular loop
 * • Touch swipe on mobile, arrows on desktop
 * • Dot indicators + keyboard navigation
 * • GPU-accelerated opacity transitions
 * • Compact mobile layout, full-width desktop
 */

interface HeroItem {
  movie?: Movie;
  tvShow?: TVShow;
  trailerKey?: string | null;
}

interface HeroCarouselProps {
  items: HeroItem[];
  className?: string;
}

export const HeroCarousel = memo(function HeroCarousel({
  items,
  className,
}: HeroCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const isSwipingRef = useRef(false);
  const total = items.length;

  const goTo = useCallback(
    (index: number) => {
      if (isTransitioning) return;
      setIsTransitioning(true);
      setCurrent(((index % total) + total) % total);
      setTimeout(() => setIsTransitioning(false), 600);
    },
    [total, isTransitioning]
  );

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Touch swipe handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    isSwipingRef.current = false;
    setIsPaused(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = Math.abs(e.touches[0].clientX - touchStartRef.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
    if (dx > dy && dx > 10) isSwipingRef.current = true;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
      if (isSwipingRef.current && Math.abs(dx) > 50) {
        dx < 0 ? next() : prev();
      }
      // Resume auto-slide after interaction
      setTimeout(() => setIsPaused(false), 5000);
    },
    [next, prev]
  );

  // Auto-slide
  useEffect(() => {
    if (isPaused || total <= 1) return;
    intervalRef.current = setInterval(next, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, next, total]);

  if (total === 0) return null;

  const item = items[current];
  const media = item.movie || item.tvShow;
  if (!media) return null;

  const isTV = !!item.tvShow;
  const title = isTV ? (media as TVShow).name : (media as Movie).title;
  const overview = media.overview;
  const backdropPath = media.backdrop_path;
  const rating = media.vote_average;
  const date = isTV ? (media as TVShow).first_air_date : (media as Movie).release_date;
  const genreIds = media.genre_ids || [];
  const href = isTV ? `/tv/${media.id}` : `/movie/${media.id}`;

  return (
    <section
      className={cn(
        'relative w-full overflow-hidden',
        'h-[56vh] min-h-[360px]',          // mobile-first: compact hero
        'md:h-[80vh] md:min-h-[600px]',     // desktop: full cinematic
        className
      )}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="region"
      aria-label="Featured content carousel"
      aria-roledescription="carousel"
    >
      {/* Slides */}
      {items.map((slideItem, index) => {
        const slideMedia = slideItem.movie || slideItem.tvShow;
        if (!slideMedia) return null;
        const isActive = index === current;

        return (
          <div
            key={slideMedia.id}
            className={cn(
              'absolute inset-0 transition-opacity duration-700 ease-in-out',
              isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
            )}
            style={{ willChange: 'opacity' }}
            role="group"
            aria-roledescription="slide"
            aria-label={`Slide ${index + 1} of ${total}`}
            aria-hidden={!isActive}
          >
            <Image
              src={getImageUrl(slideMedia.backdrop_path, 'original')}
              alt=""
              fill
              className="object-cover"
              priority={index < 2}
              sizes="100vw"
              loading={index < 2 ? 'eager' : 'lazy'}
            />
            {/* Gradients */}
            <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-950/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-transparent to-dark-950/20" />
          </div>
        );
      })}

      {/* Content overlay */}
      <div className="relative z-20 h-full container mx-auto px-3 md:px-8 flex items-end pb-14 md:pb-28">
        <div
          key={current}
          className="max-w-2xl animate-fade-in-up"
        >
          {/* Type badge */}
          {isTV && (
            <Badge variant="primary" className="mb-2 md:mb-3">
              TV Series
            </Badge>
          )}

          {/* Title */}
          <h2 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-1.5 md:mb-3 leading-tight">
            {title}
          </h2>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-1.5 md:gap-3 mb-1.5 md:mb-3">
            {rating > 0 && <RatingBadge rating={rating} size="lg" />}
            {date && <span className="text-gray-300 text-xs md:text-base">{getYear(date)}</span>}
            {genreIds.length > 0 && (
              <>
                <span className="text-gray-500 hidden sm:inline">•</span>
                <div className="hidden sm:flex gap-1.5">
                  {genreIds.slice(0, 3).map((id) => (
                    <Badge key={id} variant="genre">
                      {isTV ? getTVGenreName(id) : getGenreName(id)}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Overview — 2 lines on mobile, 3 on desktop */}
          <p className="text-gray-300 text-xs sm:text-sm md:text-base lg:text-lg line-clamp-2 md:line-clamp-3 mb-3 md:mb-5">
            {overview}
          </p>

          {/* Actions */}
          <HeroActions item={item} href={href} />
        </div>
      </div>

      {/* Arrows — hidden on mobile (swipe instead), shown on md+ */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            className={cn(
              'absolute left-4 md:left-6 top-1/2 -translate-y-1/2 z-30',
              'hidden md:flex',
              'w-10 h-10 md:w-12 md:h-12 rounded-full',
              'bg-dark-900/60 backdrop-blur-sm border border-dark-700/50',
              'items-center justify-center text-white',
              'hover:bg-dark-800 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-primary-500'
            )}
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          <button
            onClick={next}
            className={cn(
              'absolute right-4 md:right-6 top-1/2 -translate-y-1/2 z-30',
              'hidden md:flex',
              'w-10 h-10 md:w-12 md:h-12 rounded-full',
              'bg-dark-900/60 backdrop-blur-sm border border-dark-700/50',
              'items-center justify-center text-white',
              'hover:bg-dark-800 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-primary-500'
            )}
            aria-label="Next slide"
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {total > 1 && (
        <div className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-1.5 md:gap-2">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => goTo(index)}
              className={cn(
                'rounded-full transition-all duration-300',
                'h-1 md:h-1.5',
                index === current
                  ? 'w-6 md:w-8 bg-primary-500'
                  : 'w-2 md:w-3 bg-white/30 hover:bg-white/50'
              )}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === current ? 'true' : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
});

/** Hero action buttons — compact on mobile, full on desktop */
function HeroActions({ item, href }: { item: HeroItem; href: string }) {
  const media = item.movie || item.tvShow;
  const isTV = !!item.tvShow;

  const addToWatchlist = useWatchlistStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useWatchlistStore((s) => s.removeFromWatchlist);
  const addTVToWatchlist = useWatchlistStore((s) => s.addTVShowToWatchlist);
  const removeTVFromWatchlist = useWatchlistStore((s) => s.removeTVShowFromWatchlist);
  const inWatchlist = useWatchlistStore((s) =>
    isTV
      ? s.tvItems.some((t) => t.id === media!.id)
      : s.items.some((m) => m.id === media!.id)
  );
  const { openTrailerModal } = useUIStore();

  const handleWatchlist = () => {
    if (!media) return;
    if (isTV) {
      inWatchlist
        ? removeTVFromWatchlist(media.id)
        : addTVToWatchlist(media as TVShow);
    } else {
      inWatchlist
        ? removeFromWatchlist(media.id)
        : addToWatchlist(media as Movie);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 md:gap-3">
      {item.trailerKey && (
        <Button
          onClick={() => openTrailerModal(item.trailerKey!, isTV ? (media as TVShow).name : (media as Movie).title)}
          className="gap-1.5 md:gap-2 px-3 py-2 text-sm md:px-8 md:py-3 md:text-lg"
        >
          <Play className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" />
          <span className="hidden sm:inline">Watch </span>Trailer
        </Button>
      )}
      <Link href={href}>
        <Button variant="secondary" className="gap-1.5 md:gap-2 px-3 py-2 text-sm md:px-8 md:py-3 md:text-lg">
          <Info className="w-4 h-4 md:w-5 md:h-5" />
          <span className="hidden sm:inline">More </span>Info
        </Button>
      </Link>
      <Button
        variant="outline"
        onClick={handleWatchlist}
        className={cn(
          'gap-1.5 md:gap-2 px-3 py-2 text-sm md:px-8 md:py-3 md:text-lg',
          inWatchlist && 'border-primary-500 text-primary-400'
        )}
      >
        {inWatchlist ? (
          <BookmarkCheck className="w-4 h-4 md:w-5 md:h-5" />
        ) : (
          <Bookmark className="w-4 h-4 md:w-5 md:h-5" />
        )}
        <span className="hidden sm:inline">{inWatchlist ? 'In Watchlist' : 'Add to List'}</span>
      </Button>
    </div>
  );
}

/** Skeleton for the hero carousel */
export function HeroCarouselSkeleton() {
  return (
    <section className="relative h-[56vh] min-h-[360px] md:h-[80vh] md:min-h-[600px] w-full bg-dark-900 animate-pulse">
      <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-950/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-transparent to-dark-950/20" />
      <div className="relative h-full container mx-auto px-3 md:px-8 flex items-end pb-14 md:pb-28">
        <div className="max-w-2xl space-y-2.5 md:space-y-4">
          <div className="h-7 w-64 md:h-10 md:w-96 bg-dark-800 rounded" />
          <div className="h-4 w-40 md:h-5 md:w-64 bg-dark-800 rounded" />
          <div className="h-10 md:h-16 w-full bg-dark-800 rounded" />
          <div className="flex gap-2 md:gap-3">
            <div className="h-9 w-24 md:h-12 md:w-40 bg-dark-800 rounded-lg" />
            <div className="h-9 w-20 md:h-12 md:w-32 bg-dark-800 rounded-lg" />
          </div>
        </div>
      </div>
    </section>
  );
}
