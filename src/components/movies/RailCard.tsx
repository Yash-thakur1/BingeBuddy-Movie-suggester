'use client';

import { useState, useCallback, useRef, memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Movie, TVShow } from '@/types/movie';
import { getImageUrl, getYear, getGenreName } from '@/lib/tmdb';
import { cn, getPlaceholderDataUrl } from '@/lib/utils';
import { RatingBadge } from '@/components/ui';
import { HoverPreview } from './HoverPreview';

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
  const [showPreview, setShowPreview] = useState(false);
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    hoverTimer.current = setTimeout(() => setShowPreview(true), 400);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setShowPreview(false);
  }, []);

  return (
    <div
      ref={cardRef}
      className={cn('relative group/card', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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
              src={getImageUrl(posterPath, 'w342')}
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
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
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

      {/* Desktop hover preview */}
      {showPreview && (
        <HoverPreview
          movie={movie}
          tvShow={tvShow}
          anchorRef={cardRef}
        />
      )}
    </div>
  );
});
