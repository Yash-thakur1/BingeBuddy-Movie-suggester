'use client';

import { useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bookmark, BookmarkCheck, Play } from 'lucide-react';
import { TVShow } from '@/types/movie';
import { getImageUrl, getYear, getTVGenreName } from '@/lib/tmdb';
import { cn, getPlaceholderDataUrl } from '@/lib/utils';
import { RatingBadge, Badge } from '@/components/ui';
import { useWatchlistStore, useUIStore } from '@/store';
import { useLongPress } from '@/hooks/useLongPress';

/**
 * TV Show Card Component
 * Displays TV show poster with hover effects and quick actions
 */

interface TVShowCardProps {
  show: TVShow;
  priority?: boolean;
  showRating?: boolean;
  showGenres?: boolean;
  variant?: 'default' | 'compact' | 'featured';
}

export function TVShowCard({
  show,
  priority = false,
  showRating = true,
  showGenres = true,
  variant = 'default',
}: TVShowCardProps) {
  const addTVShowToWatchlist = useWatchlistStore((state) => state.addTVShowToWatchlist);
  const removeTVShowFromWatchlist = useWatchlistStore((state) => state.removeTVShowFromWatchlist);
  // Subscribe to tvItems array so component re-renders when watchlist changes
  const inWatchlist = useWatchlistStore((state) => state.tvItems.some((s) => s.id === show.id));
  const { openPreview, scheduleClosePreview } = useUIStore();

  // Hover preview state (desktop — dispatches to global singleton)
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    hoverTimer.current = setTimeout(() => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (rect) openPreview(show, true, { top: rect.top, left: rect.left, width: rect.width, height: rect.height }, 'hover');
    }, 400);
  }, [show, openPreview]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    scheduleClosePreview();
  }, [scheduleClosePreview]);

  // Mobile long-press
  const longPressHandlers = useLongPress({
    delay: 450,
    onLongPress: () => openPreview(show, true, { top: 0, left: 0, width: 0, height: 0 }, 'longpress'),
  });

  const handleWatchlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inWatchlist) {
      removeTVShowFromWatchlist(show.id);
    } else {
      addTVShowToWatchlist(show);
    }
  };

  const cardVariants = {
    default: 'aspect-[2/3]',
    compact: 'aspect-[2/3]',
    featured: 'aspect-[16/9]',
  };

  return (
    <div
      ref={cardRef}
      className="group relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...longPressHandlers}
    >
      <Link href={`/tv/${show.id}`} className="block">
        <div
          className={cn(
            'relative overflow-hidden rounded-xl bg-dark-800 shadow-card',
            'transition-all duration-300 group-hover:shadow-card-hover group-hover:scale-[1.02]',
            cardVariants[variant]
          )}
        >
          {/* TV Show Poster */}
          <Image
            src={getImageUrl(
              variant === 'featured' ? show.backdrop_path : show.poster_path,
              variant === 'featured' ? 'w780' : 'w500'
            )}
            alt={show.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            placeholder="blur"
            blurDataURL={getPlaceholderDataUrl()}
            loading={priority ? 'eager' : 'lazy'}
            priority={priority}
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />

          {/* Rating badge */}
          {showRating && show.vote_average > 0 && (
            <div className="absolute top-3 left-3">
              <RatingBadge rating={show.vote_average} size="sm" />
            </div>
          )}

          {/* TV Badge */}
          <div className="absolute top-3 left-14">
            <Badge variant="primary" className="text-xs">
              TV
            </Badge>
          </div>

          {/* Watchlist button */}
          <button
            onClick={handleWatchlistToggle}
            className={cn(
              'absolute top-3 right-3 p-2 rounded-full transition-all duration-200',
              'opacity-0 group-hover:opacity-100',
              inWatchlist
                ? 'bg-primary-600 text-white'
                : 'bg-dark-800/80 text-gray-300 hover:bg-dark-700 hover:text-white'
            )}
            aria-label={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            {inWatchlist ? (
              <BookmarkCheck className="w-4 h-4" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </button>

          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-14 h-14 rounded-full bg-primary-600/90 flex items-center justify-center shadow-glow transform scale-75 group-hover:scale-100 transition-transform duration-300">
              <Play className="w-6 h-6 text-white ml-1" fill="currentColor" />
            </div>
          </div>

          {/* TV Show info */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="font-semibold text-white text-sm md:text-base line-clamp-2 mb-1 group-hover:text-primary-400 transition-colors">
              {show.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{getYear(show.first_air_date)}</span>
              {showGenres && show.genre_ids.length > 0 && (
                <>
                  <span>•</span>
                  <span className="line-clamp-1">
                    {show.genre_ids.slice(0, 2).map((id) => getTVGenreName(id)).join(', ')}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

/**
 * Horizontal TV show card for search results and lists
 */
export function TVShowCardHorizontal({ show }: { show: TVShow }) {
  return (
    <Link
      href={`/tv/${show.id}`}
      className="flex gap-3 p-3 rounded-lg hover:bg-dark-800 transition-colors"
    >
      <div className="relative w-16 h-24 shrink-0 rounded-lg overflow-hidden">
        <Image
          src={getImageUrl(show.poster_path, 'w185')}
          alt={show.name}
          fill
          className="object-cover"
          sizes="64px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-white line-clamp-1">{show.name}</h4>
          <Badge variant="primary" className="text-xs">TV</Badge>
        </div>
        <p className="text-sm text-gray-400">{getYear(show.first_air_date)}</p>
        <div className="flex items-center gap-2 mt-1">
          <RatingBadge rating={show.vote_average} size="sm" />
          {show.genre_ids.length > 0 && (
            <Badge variant="genre" className="text-xs">
              {getTVGenreName(show.genre_ids[0])}
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
