'use client';

import { useEffect, useCallback, useRef, useState, memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Play,
  Bookmark,
  BookmarkCheck,
  Star,
  Clock,
  Calendar,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { Movie, MovieDetails, Video } from '@/types/movie';
import { getImageUrl, getGenreName, getYear } from '@/lib/tmdb';
import { cn, getPlaceholderDataUrl } from '@/lib/utils';
import { RatingBadge, Badge } from '@/components/ui';
import { useWatchlistStore, useUIStore } from '@/store';

// =============================================
// In-memory preview detail cache
// =============================================

interface PreviewDetail {
  details: MovieDetails;
  trailerKey: string | null;
  fetchedAt: number;
}

const previewCache = new Map<number, PreviewDetail>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedPreview(movieId: number): PreviewDetail | null {
  const cached = previewCache.get(movieId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached;
  }
  return null;
}

function setCachedPreview(movieId: number, detail: PreviewDetail) {
  previewCache.set(movieId, detail);
  // Evict oldest when cache grows beyond 50
  if (previewCache.size > 50) {
    const oldest = previewCache.keys().next().value;
    if (oldest !== undefined) previewCache.delete(oldest);
  }
}

// =============================================
// MoviePreviewPanel
// =============================================

interface MoviePreviewPanelProps {
  movie: Movie | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MoviePreviewPanel = memo(function MoviePreviewPanel({
  movie,
  isOpen,
  onClose,
}: MoviePreviewPanelProps) {
  const [details, setDetails] = useState<MovieDetails | null>(null);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const addToWatchlist = useWatchlistStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useWatchlistStore((s) => s.removeFromWatchlist);
  const inWatchlist = useWatchlistStore((s) =>
    movie ? s.items.some((m) => m.id === movie.id) : false
  );
  const openTrailerModal = useUIStore((s) => s.openTrailerModal);

  // Lazy-fetch details when panel opens
  useEffect(() => {
    if (!isOpen || !movie) {
      setDetails(null);
      setTrailerKey(null);
      return;
    }

    // Check cache first
    const cached = getCachedPreview(movie.id);
    if (cached) {
      setDetails(cached.details);
      setTrailerKey(cached.trailerKey);
      return;
    }

    let cancelled = false;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoadingDetails(true);

    (async () => {
      try {
        const [{ getMovieDetails }, { getMovieVideos }] = await Promise.all([
          import('@/lib/tmdb/api'),
          import('@/lib/tmdb/api'),
        ]);

        const [movieDetails, videosResponse] = await Promise.all([
          getMovieDetails(movie.id),
          getMovieVideos(movie.id),
        ]);

        if (cancelled) return;

        const trailer =
          videosResponse.results.find(
            (v: Video) => v.site === 'YouTube' && v.type === 'Trailer' && v.official
          ) ||
          videosResponse.results.find(
            (v: Video) => v.site === 'YouTube' && v.type === 'Trailer'
          ) ||
          null;

        const key = trailer?.key ?? null;

        setCachedPreview(movie.id, {
          details: movieDetails,
          trailerKey: key,
          fetchedAt: Date.now(),
        });

        setDetails(movieDetails);
        setTrailerKey(key);
      } catch {
        // Silently ignore — user still sees basic data
      } finally {
        if (!cancelled) setIsLoadingDetails(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isOpen, movie]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleWatchlistToggle = useCallback(() => {
    if (!movie) return;
    if (inWatchlist) {
      removeFromWatchlist(movie.id);
    } else {
      addToWatchlist(movie);
    }
  }, [movie, inWatchlist, addToWatchlist, removeFromWatchlist]);

  const handlePlayTrailer = useCallback(() => {
    if (trailerKey && movie) {
      onClose();
      // Small delay so close animation plays first
      setTimeout(() => {
        openTrailerModal(trailerKey, movie.title);
      }, 200);
    }
  }, [trailerKey, movie, onClose, openTrailerModal]);

  // Swipe-down to close on mobile
  const touchStartY = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (deltaY > 80) onClose();
  };

  const displayMovie = movie;
  const runtime = details?.runtime;
  const genres = details?.genres ?? movie?.genre_ids.map((id) => ({ id, name: getGenreName(id) }));
  const tagline = details?.tagline;

  return (
    <AnimatePresence>
      {isOpen && displayMovie && (
        <>
          {/* Backdrop */}
          <motion.div
            key="preview-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="preview-panel"
            ref={panelRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-dark-900 border-t border-dark-700 shadow-2xl"
            style={{ willChange: 'transform' }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Pull indicator */}
            <div className="sticky top-0 z-10 flex justify-center py-2 bg-dark-900/90 backdrop-blur-sm">
              <div className="w-10 h-1 rounded-full bg-dark-600" />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-20 p-2 rounded-full bg-dark-800/80 text-gray-300 hover:bg-dark-700 hover:text-white transition-colors"
              aria-label="Close preview"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Backdrop image */}
            <div className="relative w-full aspect-video max-h-56 sm:max-h-72 overflow-hidden">
              <Image
                src={getImageUrl(
                  displayMovie.backdrop_path || displayMovie.poster_path,
                  'w780'
                )}
                alt={displayMovie.title}
                fill
                className="object-cover"
                sizes="100vw"
                priority
                placeholder="blur"
                blurDataURL={getPlaceholderDataUrl()}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/40 to-transparent" />

              {/* Play trailer overlay */}
              {trailerKey && (
                <button
                  onClick={handlePlayTrailer}
                  className="absolute inset-0 flex items-center justify-center group/play"
                  aria-label="Play trailer"
                >
                  <div className="w-16 h-16 rounded-full bg-primary-600/90 flex items-center justify-center shadow-glow transform transition-transform group-hover/play:scale-110">
                    <Play className="w-7 h-7 text-white ml-1" fill="currentColor" />
                  </div>
                </button>
              )}
            </div>

            {/* Content */}
            <div className="px-4 sm:px-6 pb-8 -mt-8 relative z-10">
              {/* Title + rating */}
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold text-white line-clamp-2">
                    {displayMovie.title}
                  </h2>
                  {tagline && (
                    <p className="text-sm text-gray-400 italic mt-0.5 line-clamp-1">
                      &ldquo;{tagline}&rdquo;
                    </p>
                  )}
                </div>
                <RatingBadge rating={displayMovie.vote_average} size="md" />
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400 mb-4">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {getYear(displayMovie.release_date)}
                </span>
                {runtime && runtime > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {Math.floor(runtime / 60)}h {runtime % 60}m
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" />
                  {displayMovie.vote_average.toFixed(1)}
                  <span className="text-gray-500">
                    ({displayMovie.vote_count.toLocaleString()})
                  </span>
                </span>
                {isLoadingDetails && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
                )}
              </div>

              {/* Genres */}
              {genres && genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {genres.slice(0, 5).map((g) => (
                    <Badge key={g.id} variant="genre" className="text-xs">
                      {g.name}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Overview */}
              <p className="text-sm sm:text-base text-gray-300 leading-relaxed mb-6 line-clamp-4 sm:line-clamp-6">
                {displayMovie.overview || 'No description available.'}
              </p>

              {/* Action buttons */}
              <div className="flex gap-3">
                {trailerKey && (
                  <button
                    onClick={handlePlayTrailer}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-500 text-white font-semibold rounded-xl transition-colors"
                  >
                    <Play className="w-5 h-5" fill="currentColor" />
                    Watch Trailer
                  </button>
                )}

                <button
                  onClick={handleWatchlistToggle}
                  className={cn(
                    'flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-colors',
                    trailerKey ? 'flex-none' : 'flex-1',
                    inWatchlist
                      ? 'bg-primary-600/20 text-primary-400 border border-primary-600/40'
                      : 'bg-dark-800 text-gray-300 hover:bg-dark-700 hover:text-white border border-dark-700'
                  )}
                >
                  {inWatchlist ? (
                    <>
                      <BookmarkCheck className="w-5 h-5" />
                      <span className="hidden sm:inline">In Watchlist</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-5 h-5" />
                      <span className="hidden sm:inline">Watchlist</span>
                    </>
                  )}
                </button>

                <Link
                  href={`/movie/${displayMovie.id}`}
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-dark-800 text-gray-300 hover:bg-dark-700 hover:text-white border border-dark-700 rounded-xl font-semibold transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                  <span className="hidden sm:inline">Full Details</span>
                </Link>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});
