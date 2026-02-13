'use client';

import { useState, useCallback, useRef, memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Movie, TVShow } from '@/types/movie';
import { getImageUrl, getYear, getGenreName } from '@/lib/tmdb';
import { cn, getPlaceholderDataUrl } from '@/lib/utils';
import { RatingBadge } from '@/components/ui';
import { useUIStore } from '@/store';
import { useLongPress } from '@/hooks/useLongPress';

/**
 * Rail card with poster + hover preview for desktop.
 * Touch-friendly on mobile; hover preview only shows on md+.
 */

interface RailCardProps {
  movie?: Movie;
  tvShow?: TVShow;
  priority?: boolean;
  className?: string;
}

export const RailCard = memo(function RailCard({
  movie,
  tvShow,
  priority = false,
  className,
}: RailCardProps) {
  const item = movie || tvShow;
  if (!item) return null;

  const isTV = !!tvShow;
  const title = isTV ? (item as TVShow).name : (item as Movie).title;
  const href = isTV ? `/tv/${item.id}` : `/movie/${item.id}`;
  const posterPath = item.poster_path;
  const rating = item.vote_average;
  const year = isTV
    ? (item as TVShow).first_air_date
    : (item as Movie).release_date;

  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { openPreview, scheduleClosePreview } = useUIStore();

  const handleMouseEnter = useCallback(() => {
    hoverTimer.current = setTimeout(() => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (rect) openPreview(item, isTV, { top: rect.top, left: rect.left, width: rect.width, height: rect.height }, 'hover');
    }, 400);
  }, [item, isTV, openPreview]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    scheduleClosePreview();
  }, [scheduleClosePreview]);

  // Mobile long-press
  const longPressHandlers = useLongPress({
    delay: 450,
    onLongPress: () => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (rect) openPreview(item, isTV, { top: rect.top, left: rect.left, width: rect.width, height: rect.height }, 'longpress');
    },
  });

  return (
    <div
      ref={cardRef}
      className={cn('relative group/card', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...longPressHandlers}
    >
      <Link href={href} className="block" prefetch={false}>
        <div
          className={cn(
            'relative aspect-[2/3] rounded-lg overflow-hidden bg-dark-800',
            'ring-1 ring-dark-700/50',
            'transition-all duration-200 ease-out',
            'active:scale-[0.97]',
            'md:group-hover/card:ring-primary-500/60 md:group-hover/card:shadow-lg md:group-hover/card:shadow-primary-900/20'
          )}
        >
          {posterPath ? (
            <Image
              src={imgError ? '/fallback-poster.png' : getImageUrl(posterPath, 'w342')}
              alt={title}
              fill
              sizes="(max-width: 480px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 185px"
              className={cn(
                'object-cover transition-opacity duration-400',
                loaded ? 'opacity-100' : 'opacity-0'
              )}
              loading={priority ? 'eager' : 'lazy'}
              placeholder="blur"
              blurDataURL={getPlaceholderDataUrl()}
              priority={priority}
              onLoad={() => setLoaded(true)}
              onError={() => { setImgError(true); setLoaded(true); }}
            />
          ) : (
            <Image
              src="/fallback-poster.png"
              alt={title}
              fill
              className="object-cover"
              sizes="(max-width: 480px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 185px"
              loading="lazy"
            />
          )}

          {/* Gradient */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

          {/* Rating badge */}
          {rating > 0 && (
            <div className="absolute bottom-1.5 left-1.5">
              <RatingBadge rating={rating} size="sm" />
            </div>
          )}

          {/* TV badge */}
          {isTV && (
            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-primary-600/90 text-white rounded">
              TV
            </span>
          )}
        </div>

        {/* Title */}
        <p className="mt-1 md:mt-1.5 text-[11px] md:text-xs text-gray-300 line-clamp-1 px-0.5 leading-tight">
          {title}
        </p>
        {year && (
          <p className="text-[9px] md:text-[10px] text-gray-500 px-0.5">{getYear(year)}</p>
        )}
      </Link>
    </div>
  );
});
