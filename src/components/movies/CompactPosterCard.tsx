'use client';

import { useState, useCallback, useRef, memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Movie } from '@/types/movie';
import { TVShow } from '@/types/movie';
import { getImageUrl } from '@/lib/tmdb';
import { cn, getPlaceholderDataUrl } from '@/lib/utils';
import { RatingBadge } from '@/components/ui';
import { useUIStore } from '@/store';
import { useLongPress } from '@/hooks/useLongPress';

/**
 * Compact poster-only card for Netflix-style dense grids
 * Minimal chrome — just the poster with a small rating badge.
 * Touch-optimised: tap goes to detail page.
 * Progressive image loading: blur placeholder → fade-in high-res.
 */

interface CompactPosterCardProps {
  /** Movie data (provide either movie or tvShow) */
  movie?: Movie;
  /** TV show data */
  tvShow?: TVShow;
  /** Load image eagerly for above-fold content */
  priority?: boolean;
  className?: string;
  /** When true, render as a div instead of a Link so parent can handle clicks */
  disableLink?: boolean;
}

export const CompactPosterCard = memo(function CompactPosterCard({
  movie,
  tvShow,
  priority = false,
  className,
  disableLink = false,
}: CompactPosterCardProps) {
  const item = movie || tvShow;
  if (!item) return null;

  return (
    <CompactPosterCardInner
      item={item}
      isTV={!!tvShow}
      priority={priority}
      className={className}
      disableLink={disableLink}
    />
  );
});

/** Inner component to keep the memo boundary clean */
function CompactPosterCardInner({
  item,
  isTV,
  priority,
  className,
  disableLink,
}: {
  item: Movie | TVShow;
  isTV: boolean;
  priority: boolean;
  className?: string;
  disableLink: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { openPreview, closePreview } = useUIStore();

  // Desktop hover
  const handleMouseEnter = useCallback(() => {
    hoverTimer.current = setTimeout(() => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (rect) openPreview(item, isTV, { top: rect.top, left: rect.left, width: rect.width, height: rect.height }, 'hover');
    }, 400);
  }, [item, isTV, openPreview]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    closePreview();
  }, [closePreview]);

  // Mobile long-press
  const longPressHandlers = useLongPress({
    delay: 450,
    onLongPress: () => openPreview(item, isTV, { top: 0, left: 0, width: 0, height: 0 }, 'longpress'),
  });

  const href = isTV ? `/tv/${item.id}` : `/movie/${item.id}`;
  const title = isTV ? (item as TVShow).name : (item as Movie).title;
  const posterPath = item.poster_path;
  const rating = item.vote_average;

  const handleLoad = useCallback(() => setLoaded(true), []);

  const cardContent = (
    <>
      <div
        className={cn(
          'relative aspect-[2/3] rounded-lg overflow-hidden bg-dark-800',
          'ring-1 ring-dark-700/50',
          'transition-transform duration-200 active:scale-[0.97]',
          'md:hover:scale-105 md:hover:ring-primary-600/60 md:hover:shadow-lg'
        )}
      >
        {/* Poster with progressive loading */}
        {posterPath ? (
          <Image
            src={getImageUrl(posterPath, 'w342')}
            alt={title}
            fill
            sizes="(max-width: 480px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw"
            className={cn(
              'object-cover transition-opacity duration-500',
              loaded ? 'opacity-100' : 'opacity-0'
            )}
            loading={priority ? 'eager' : 'lazy'}
            placeholder="blur"
            blurDataURL={getPlaceholderDataUrl()}
            priority={priority}
            onLoad={handleLoad}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
        )}

        {/* Subtle bottom gradient for readability */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

        {/* Rating badge — small, bottom-left */}
        {rating > 0 && (
          <div className="absolute bottom-1.5 left-1.5">
            <RatingBadge rating={rating} size="sm" />
          </div>
        )}

        {/* TV badge — top-right for TV shows */}
        {isTV && (
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-primary-600/90 text-white rounded">
            TV
          </span>
        )}
      </div>

      {/* Title — single line below poster */}
      <p className="mt-1.5 text-xs text-gray-300 line-clamp-1 px-0.5 leading-tight">
        {title}
      </p>
    </>
  );

  if (disableLink) {
    return (
      <div
        ref={cardRef}
        className={cn('block group relative', className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...longPressHandlers}
      >
        {cardContent}
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className={cn('relative', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...longPressHandlers}
    >
      <Link href={href} className="block group" prefetch={false}>
        {cardContent}
      </Link>
    </div>
  );
}
