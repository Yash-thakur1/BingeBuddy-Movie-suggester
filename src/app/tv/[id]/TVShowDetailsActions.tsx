'use client';

import { Play, Bookmark, BookmarkCheck, Share2 } from 'lucide-react';
import { TVShow } from '@/types/movie';
import { Button } from '@/components/ui';
import { EngagementButtons } from '@/components/features';
import { useWatchlistStore, useUIStore } from '@/store';
import { cn } from '@/lib/utils';

interface TVShowDetailsActionsProps {
  show: TVShow;
  trailerKey: string | null;
}

export function TVShowDetailsActions({ show, trailerKey }: TVShowDetailsActionsProps) {
  const addTVShowToWatchlist = useWatchlistStore((state) => state.addTVShowToWatchlist);
  const removeTVShowFromWatchlist = useWatchlistStore((state) => state.removeTVShowFromWatchlist);
  const inWatchlist = useWatchlistStore((state) => state.tvItems.some((s) => s.id === show.id));
  const { openTrailerModal } = useUIStore();

  const handleWatchlistToggle = () => {
    if (inWatchlist) {
      removeTVShowFromWatchlist(show.id);
    } else {
      addTVShowToWatchlist(show);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: show.name,
          text: show.overview,
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
      <EngagementButtons mediaType="tv" mediaId={show.id} />

      {/* Action buttons */}
      <div className="flex flex-wrap gap-4">
      {trailerKey && (
        <Button
          size="lg"
          onClick={() => openTrailerModal(trailerKey, show.name)}
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
