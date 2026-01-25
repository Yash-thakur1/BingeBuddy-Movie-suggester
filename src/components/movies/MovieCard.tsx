'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Bookmark, BookmarkCheck, Play } from 'lucide-react';
import { Movie } from '@/types/movie';
import { getImageUrl, getYear, getGenreName } from '@/lib/tmdb';
import { cn, getPlaceholderDataUrl } from '@/lib/utils';
import { RatingBadge, Badge } from '@/components/ui';
import { useWatchlistStore } from '@/store';

/**
 * Movie Card Component
 * Displays movie poster with hover effects and quick actions
 */

interface MovieCardProps {
  movie: Movie;
  priority?: boolean;
  showRating?: boolean;
  showGenres?: boolean;
  variant?: 'default' | 'compact' | 'featured';
}

export function MovieCard({
  movie,
  priority = false,
  showRating = true,
  showGenres = true,
  variant = 'default',
}: MovieCardProps) {
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlistStore();
  const inWatchlist = isInWatchlist(movie.id);

  const handleWatchlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inWatchlist) {
      removeFromWatchlist(movie.id);
    } else {
      addToWatchlist(movie);
    }
  };

  const cardVariants = {
    default: 'aspect-[2/3]',
    compact: 'aspect-[2/3]',
    featured: 'aspect-[16/9]',
  };

  return (
    <div className="group relative">
      <Link href={`/movie/${movie.id}`} className="block">
        <div
          className={cn(
            'relative overflow-hidden rounded-xl bg-dark-800 shadow-card',
            'transition-all duration-300 group-hover:shadow-card-hover group-hover:scale-[1.02]',
            cardVariants[variant]
          )}
        >
          {/* Movie Poster */}
          <Image
            src={getImageUrl(
              variant === 'featured' ? movie.backdrop_path : movie.poster_path,
              variant === 'featured' ? 'w780' : 'w500'
            )}
            alt={movie.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            placeholder="blur"
            blurDataURL={getPlaceholderDataUrl()}
            priority={priority}
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />

          {/* Rating badge */}
          {showRating && movie.vote_average > 0 && (
            <div className="absolute top-3 left-3">
              <RatingBadge rating={movie.vote_average} size="sm" />
            </div>
          )}

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

          {/* Movie info */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="font-semibold text-white text-sm md:text-base line-clamp-2 mb-1 group-hover:text-primary-400 transition-colors">
              {movie.title}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{getYear(movie.release_date)}</span>
              {showGenres && movie.genre_ids.length > 0 && (
                <>
                  <span>•</span>
                  <span className="line-clamp-1">
                    {movie.genre_ids.slice(0, 2).map((id) => getGenreName(id)).join(', ')}
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
 * Horizontal movie card for search results and lists
 */
export function MovieCardHorizontal({ movie }: { movie: Movie }) {
  return (
    <Link
      href={`/movie/${movie.id}`}
      className="flex gap-3 p-3 rounded-lg hover:bg-dark-800 transition-colors"
    >
      <div className="relative w-16 h-24 shrink-0 rounded-lg overflow-hidden">
        <Image
          src={getImageUrl(movie.poster_path, 'w185')}
          alt={movie.title}
          fill
          className="object-cover"
          sizes="64px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-white line-clamp-1">{movie.title}</h4>
        <p className="text-sm text-gray-400">{getYear(movie.release_date)}</p>
        <div className="flex items-center gap-2 mt-1">
          <RatingBadge rating={movie.vote_average} size="sm" />
          {movie.genre_ids.length > 0 && (
            <Badge variant="genre" className="text-xs">
              {getGenreName(movie.genre_ids[0])}
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
