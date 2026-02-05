'use client';

import { Play, Bookmark, BookmarkCheck, Share2 } from 'lucide-react';
import { Movie } from '@/types/movie';
import { Button } from '@/components/ui';
import { EngagementButtons } from '@/components/features';
import { useWatchlistStore, useUIStore } from '@/store';
import { cn } from '@/lib/utils';

interface MovieDetailsActionsProps {
  movie: Movie;
  trailerKey: string | null;
}

export function MovieDetailsActions({ movie, trailerKey }: MovieDetailsActionsProps) {
  const addToWatchlist = useWatchlistStore((state) => state.addToWatchlist);
  const removeFromWatchlist = useWatchlistStore((state) => state.removeFromWatchlist);
  const inWatchlist = useWatchlistStore((state) => state.items.some((m) => m.id === movie.id));
  const { openTrailerModal } = useUIStore();

  const handleWatchlistToggle = () => {
    if (inWatchlist) {
      removeFromWatchlist(movie.id);
    } else {
      addToWatchlist(movie);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: movie.title,
          text: movie.overview,
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="space-y-4">
      {/* Like / Dislike */}
      <EngagementButtons mediaType="movie" mediaId={movie.id} />

      {/* Action buttons */}
      <div className="flex flex-wrap gap-4">
      {trailerKey && (
        <Button
          size="lg"
          onClick={() => openTrailerModal(trailerKey, movie.title)}
          className="gap-2"
        >
          <Play className="w-5 h-5" fill="currentColor" />
          Watch Trailer
        </Button>
      )}
      
      <Button
        variant="secondary"
        size="lg"
        onClick={handleWatchlistToggle}
        className={cn('gap-2', inWatchlist && 'bg-primary-600 hover:bg-primary-500')}
      >
        {inWatchlist ? (
          <>
            <BookmarkCheck className="w-5 h-5" />
            In Watchlist
          </>
        ) : (
          <>
            <Bookmark className="w-5 h-5" />
            Add to Watchlist
          </>
        )}
      </Button>

      <Button variant="outline" size="lg" onClick={handleShare} className="gap-2">
        <Share2 className="w-5 h-5" />
        Share
      </Button>
      </div>
    </div>
  );
}
