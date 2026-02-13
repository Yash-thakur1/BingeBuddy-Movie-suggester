'use client';

import { useCallback, useEffect, memo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { Bookmark, BookmarkCheck, Play, Star, MonitorPlay, X } from 'lucide-react';
import { Movie, TVShow } from '@/types/movie';
import { getImageUrl, getYear, getGenreName } from '@/lib/tmdb';
import { cn, getPlaceholderDataUrl } from '@/lib/utils';
import { useWatchlistStore, useUIStore } from '@/store';
import { FeedbackButtons } from '@/components/features/FeedbackButtons';
import { extractAttributesFromMovie } from '@/lib/ai/preferenceLearning';

/**
 * Mobile long-press preview overlay.
 *
 * Renders as a portal-based bottom sheet / centred card.
 * Shows poster, title, overview, and quick actions
 * (Like, Dislike, Watch Trailer, Watchlist, Full Details).
 *
 * - Only visible on screens < md (hidden on desktop via CSS).
 * - Closes on backdrop tap, scroll or back button.
 * - GPU-friendly animation via CSS transform.
 */

interface MobileLongPressPreviewProps {
  movie?: Movie;
  tvShow?: TVShow;
  isOpen: boolean;
  onClose: () => void;
}

export const MobileLongPressPreview = memo(function MobileLongPressPreview({
  movie,
  tvShow,
  isOpen,
  onClose,
}: MobileLongPressPreviewProps) {
  const item = movie || tvShow;
  if (!item || !isOpen) return null;
  return (
    <MobileLongPressPreviewInner movie={movie} tvShow={tvShow} onClose={onClose} />
  );
});

function MobileLongPressPreviewInner({
  movie,
  tvShow,
  onClose,
}: Omit<MobileLongPressPreviewProps, 'isOpen'>) {
  const item = (movie || tvShow)!;
  const isTV = !!tvShow;
  const title = isTV ? (item as TVShow).name : (item as Movie).title;
  const overview = item.overview;
  const href = isTV ? `/tv/${item.id}` : `/movie/${item.id}`;
  const date = isTV ? (item as TVShow).first_air_date : (item as Movie).release_date;
  const rating = item.vote_average;
  const genreIds = item.genre_ids || [];
  const backdropPath = item.backdrop_path;

  const [closing, setClosing] = useState(false);
  const [imgError, setImgError] = useState(false);

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

  // Animated close
  const animatedClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 180);
  }, [onClose]);

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
        animatedClose();
      }
    } catch {
      // silently fail
    }
  }, [isTV, item.id, title, openTrailerModal, animatedClose]);

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

  // Close on scroll (any scroll on the page body)
  useEffect(() => {
    const handler = () => animatedClose();
    window.addEventListener('scroll', handler, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', handler, true);
  }, [animatedClose]);

  // Close on back button / escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') animatedClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [animatedClose]);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[200] md:hidden',
        'flex items-end justify-center',
        closing ? 'animate-mobile-preview-out' : 'animate-mobile-preview-backdrop-in'
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) animatedClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${title}`}
    >
      {/* Backdrop dim */}
      <div
        className={cn(
          'absolute inset-0 bg-black/70 transition-opacity duration-200',
          closing ? 'opacity-0' : 'opacity-100'
        )}
        onClick={animatedClose}
      />

      {/* Bottom sheet card */}
      <div
        className={cn(
          'relative w-full max-w-[420px] max-h-[85vh] overflow-y-auto',
          'bg-dark-900 rounded-t-2xl border-t border-dark-700/60',
          'shadow-2xl shadow-black/80',
          closing ? 'animate-mobile-preview-slide-out' : 'animate-mobile-preview-slide-in'
        )}
      >
        {/* Drag handle */}
        <div className="sticky top-0 z-10 flex justify-center pt-2 pb-1 bg-dark-900/95 backdrop-blur-sm">
          <div className="w-10 h-1 rounded-full bg-dark-600" />
        </div>

        {/* Close button */}
        <button
          onClick={animatedClose}
          className="absolute top-2.5 right-3 z-10 p-1.5 rounded-full bg-dark-800/80 text-gray-400 active:bg-dark-700"
          aria-label="Close preview"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Backdrop / Poster header */}
        <div className="relative aspect-video bg-dark-800 overflow-hidden">
          <Image
            src={imgError ? '/fallback-poster.png' : getImageUrl(backdropPath || item.poster_path, backdropPath ? 'w780' : 'w500')}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 420px) 100vw, 420px"
            loading="eager"
            placeholder="blur"
            blurDataURL={getPlaceholderDataUrl()}
            onError={() => setImgError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/30 to-transparent" />

          {/* Play icon centred */}
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handlePlayTrailer(e);
              }}
              className="w-14 h-14 rounded-full bg-primary-600/90 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              aria-label="Watch Trailer"
            >
              <Play className="w-6 h-6 text-white ml-0.5" fill="currentColor" />
            </button>
          </div>

          {/* Title overlay */}
          <div className="absolute bottom-3 left-3 right-12">
            <h3 className="text-base font-bold text-white line-clamp-2 drop-shadow-lg">
              {title}
            </h3>
            <div className="flex items-center gap-2. text-xs text-gray-300 mt-0.5">
              {date && <span>{getYear(date)}</span>}
              {rating > 0 && (
                <span className="flex items-center gap-0.5 ml-1.5">
                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  {rating.toFixed(1)}
                </span>
              )}
              {isTV && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-bold uppercase bg-primary-600/90 text-white rounded">
                  TV
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Genres */}
          {genreIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {genreIds.slice(0, 4).map((id) => (
                <span
                  key={id}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-dark-800 text-gray-400 border border-dark-700/50"
                >
                  {getGenreName(id)}
                </span>
              ))}
            </div>
          )}

          {/* Overview */}
          {overview && (
            <p className="text-sm text-gray-400 line-clamp-4 leading-relaxed mb-4">
              {overview}
            </p>
          )}

          {/* Action buttons row */}
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={handlePlayTrailer}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold active:scale-[0.97] transition-all"
            >
              <MonitorPlay className="w-4 h-4" />
              Watch Trailer
            </button>
            <button
              onClick={handleWatchlist}
              className={cn(
                'p-2.5 rounded-lg border transition-colors active:scale-[0.95]',
                inWatchlist
                  ? 'bg-primary-600/20 border-primary-500 text-primary-400'
                  : 'border-dark-600 text-gray-400 active:border-gray-400 active:text-white'
              )}
              aria-label={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              {inWatchlist ? (
                <BookmarkCheck className="w-5 h-5" />
              ) : (
                <Bookmark className="w-5 h-5" />
              )}
            </button>
            <FeedbackButtons
              mediaId={item.id}
              mediaType={mediaType}
              attributes={feedbackAttributes}
              size="md"
            />
          </div>

          {/* Full Details link */}
          <Link
            href={href}
            onClick={animatedClose}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dark-600 text-gray-300 text-sm font-medium active:bg-dark-800 transition-colors"
          >
            Full Details
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}
