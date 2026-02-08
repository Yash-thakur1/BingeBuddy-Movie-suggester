'use client';

import { useRef, useEffect, useState, useCallback, memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { Bookmark, BookmarkCheck, Play, Star, MonitorPlay } from 'lucide-react';
import { Movie, TVShow } from '@/types/movie';
import { getImageUrl, getYear, getGenreName } from '@/lib/tmdb';
import { cn, getPlaceholderDataUrl } from '@/lib/utils';
import { useWatchlistStore, useUIStore } from '@/store';
import { FeedbackButtons } from '@/components/features/FeedbackButtons';
import { extractAttributesFromMovie } from '@/lib/ai/preferenceLearning';

/**
 * Desktop hover preview popup.
 * Shows poster, title, overview, and quick actions.
 * Positions itself relative to the anchor card, auto-adjusting horizontally.
 * Hidden on mobile (md+ only via portal + CSS).
 */

interface HoverPreviewProps {
  movie?: Movie;
  tvShow?: TVShow;
  /** Pre-computed anchor rect (from store-based singleton mode) */
  anchorRect?: { top: number; left: number; width: number; height: number };
  /** Callback to close preview (singleton mode) */
  onClose?: () => void;
}

export const HoverPreview = memo(function HoverPreview({
  movie,
  tvShow,
  anchorRect,
  onClose,
}: HoverPreviewProps) {
  const item = movie || tvShow;
  if (!item) return null;

  return <HoverPreviewInner movie={movie} tvShow={tvShow} anchorRect={anchorRect} onClose={onClose} />;
});

function HoverPreviewInner({
  movie,
  tvShow,
  anchorRect: externalRect,
  onClose,
}: HoverPreviewProps) {
  const item = (movie || tvShow)!;
  const isTV = !!tvShow;
  const title = isTV ? (item as TVShow).name : (item as Movie).title;
  const overview = item.overview;
  const href = isTV ? `/tv/${item.id}` : `/movie/${item.id}`;
  const date = isTV ? (item as TVShow).first_air_date : (item as Movie).release_date;
  const rating = item.vote_average;
  const genreIds = item.genre_ids || [];
  const backdropPath = item.backdrop_path;

  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Watchlist state
  const addToWatchlist = useWatchlistStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useWatchlistStore((s) => s.removeFromWatchlist);
  const inWatchlist = useWatchlistStore((s) =>
    isTV
      ? s.tvItems.some((t) => t.id === item.id)
      : s.items.some((m) => m.id === item.id)
  );
  const addTVToWatchlist = useWatchlistStore((s) => s.addTVShowToWatchlist);
  const removeTVFromWatchlist = useWatchlistStore((s) => s.removeTVShowFromWatchlist);
  const { openTrailerModal } = useUIStore();

  // Fetch YouTube trailer key and open trailer modal
  const handlePlayTrailer = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const fetchVideos = isTV
        ? (await import('@/lib/tmdb/api')).getTVShowVideos
        : (await import('@/lib/tmdb/api')).getMovieVideos;
      const videosResponse = await fetchVideos(item.id);
      const trailer =
        videosResponse.results.find(
          (v: any) => v.site === 'YouTube' && v.type === 'Trailer' && v.official
        ) ||
        videosResponse.results.find(
          (v: any) => v.site === 'YouTube' && v.type === 'Trailer'
        ) ||
        videosResponse.results.find(
          (v: any) => v.site === 'YouTube'
        );
      if (trailer?.key) {
        openTrailerModal(trailer.key, title);
      }
    } catch {
      // silently fail
    }
  }, [isTV, item.id, title, openTrailerModal]);

  // Build attributes for feedback buttons
  const mediaType = isTV ? 'tv' as const : 'movie' as const;
  const feedbackAttributes = extractAttributesFromMovie(
    {
      id: item.id,
      title: isTV ? undefined : title,
      name: isTV ? title : undefined,
      original_language: item.original_language,
      genre_ids: genreIds,
      release_date: isTV ? undefined : date,
      first_air_date: isTV ? date : undefined,
      vote_average: rating,
      popularity: item.popularity,
    },
    mediaType
  );

  // Position calculation
  useEffect(() => {
    if (!externalRect) return;

    const previewWidth = 320;
    const previewHeight = 380;

    let left = externalRect.left + externalRect.width / 2 - previewWidth / 2;
    const top = externalRect.top + externalRect.height / 2 - previewHeight / 2;

    // Keep within viewport
    if (left < 12) left = 12;
    if (left + previewWidth > window.innerWidth - 12) {
      left = window.innerWidth - previewWidth - 12;
    }

    setPos({ top: Math.max(12, top), left, width: previewWidth });
  }, [externalRect]);

  const handleWatchlist = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isTV) {
        inWatchlist
          ? removeTVFromWatchlist(item.id)
          : addTVToWatchlist(item as TVShow);
      } else {
        inWatchlist
          ? removeFromWatchlist(item.id)
          : addToWatchlist(item as Movie);
      }
    },
    [isTV, inWatchlist, item, addToWatchlist, removeFromWatchlist, addTVToWatchlist, removeTVFromWatchlist]
  );

  if (!pos || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={previewRef}
      className={cn(
        'fixed z-[100] hidden md:block',
        'animate-preview-in'
      )}
      style={{
        top: pos.top,
        left: pos.left,
        width: pos.width,
      }}
      onMouseEnter={() => {
        const { cancelClosePreview } = useUIStore.getState();
        cancelClosePreview();
      }}
      onMouseLeave={() => onClose?.()}
    >
      <div className="bg-dark-900 rounded-xl overflow-hidden shadow-2xl shadow-black/60 border border-dark-700/60 ring-1 ring-white/5">
        {/* Backdrop / Poster header */}
        <div className="relative aspect-video bg-dark-800 overflow-hidden">
          <Image
            src={getImageUrl(backdropPath || item.poster_path, backdropPath ? 'w780' : 'w500')}
            alt={title}
            fill
            className="object-cover"
            sizes="320px"
            loading="eager"
            placeholder="blur"
            blurDataURL={getPlaceholderDataUrl()}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-transparent to-transparent" />

          {/* Title overlay */}
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="text-sm font-bold text-white line-clamp-1 drop-shadow-lg">
              {title}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-300 mt-0.5">
              {date && <span>{getYear(date)}</span>}
              {rating > 0 && (
                <span className="flex items-center gap-0.5">
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  {rating.toFixed(1)}
                </span>
              )}
              {isTV && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-primary-600/90 text-white rounded">
                  TV
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3">
          {/* Action buttons */}
          <div className="flex items-center gap-2 mb-2.5">
            <Link
              href={href}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-dark-950 rounded-md text-xs font-semibold hover:bg-gray-200 transition-colors"
            >
              <Play className="w-3.5 h-3.5" fill="currentColor" />
              Details
            </Link>
            <button
              onClick={handlePlayTrailer}
              className="p-1.5 rounded-full border border-dark-600 text-gray-400 hover:border-primary-500 hover:text-primary-400 transition-colors"
              aria-label="Watch Trailer"
              title="Watch Trailer"
            >
              <MonitorPlay className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleWatchlist}
              className={cn(
                'p-1.5 rounded-full border transition-colors',
                inWatchlist
                  ? 'bg-primary-600/20 border-primary-500 text-primary-400'
                  : 'border-dark-600 text-gray-400 hover:border-gray-400 hover:text-white'
              )}
              aria-label={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              {inWatchlist ? (
                <BookmarkCheck className="w-3.5 h-3.5" />
              ) : (
                <Bookmark className="w-3.5 h-3.5" />
              )}
            </button>
            <FeedbackButtons
              mediaId={item.id}
              mediaType={mediaType}
              attributes={feedbackAttributes}
              size="sm"
            />
          </div>

          {/* Genres */}
          {genreIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {genreIds.slice(0, 3).map((id) => (
                <span
                  key={id}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-dark-800 text-gray-400"
                >
                  {getGenreName(id)}
                </span>
              ))}
            </div>
          )}

          {/* Overview */}
          {overview && (
            <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed">
              {overview}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
