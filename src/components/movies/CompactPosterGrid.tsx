'use client';

import { Movie, TVShow } from '@/types/movie';
import { CompactPosterCard } from './CompactPosterCard';
import { Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * Dense Netflix-style poster grid
 * 3 cols on phone → 4 on large phone → 5 on tablet → 6 on desktop
 * Tight gaps for maximum content density.
 */

interface CompactPosterGridProps {
  movies?: Movie[];
  tvShows?: TVShow[];
  /** Number of items above the fold that get eager loading */
  priorityCount?: number;
  className?: string;
}

export function CompactPosterGrid({
  movies,
  tvShows,
  priorityCount = 6,
  className,
}: CompactPosterGridProps) {
  const items = movies || tvShows || [];

  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6',
        'gap-2.5 sm:gap-3',
        className
      )}
    >
      {items.map((item, i) => (
        <CompactPosterCard
          key={item.id}
          movie={movies ? (item as Movie) : undefined}
          tvShow={tvShows ? (item as TVShow) : undefined}
          priority={i < priorityCount}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton loader matching CompactPosterGrid layout
 */
export function CompactPosterGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[2/3] w-full rounded-lg" />
          <Skeleton className="h-3 w-3/4 rounded mt-1.5" />
        </div>
      ))}
    </div>
  );
}

/**
 * Section wrapper for compact poster grids
 * Includes title, description, and optional "View All" link
 */
interface CompactPosterSectionProps {
  title: string;
  description?: string;
  viewAllHref?: string;
  movies?: Movie[];
  tvShows?: TVShow[];
  className?: string;
}

export function CompactPosterSection({
  title,
  description,
  viewAllHref,
  movies,
  tvShows,
  className,
}: CompactPosterSectionProps) {
  return (
    <section className={cn('py-6 md:py-8', className)}>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">{title}</h2>
          {description && (
            <p className="text-sm text-gray-400 mt-0.5">{description}</p>
          )}
        </div>
        {viewAllHref && (
          <a
            href={viewAllHref}
            className="text-sm text-primary-500 hover:text-primary-400 font-medium transition-colors whitespace-nowrap ml-4"
          >
            View All →
          </a>
        )}
      </div>

      {/* Grid */}
      <CompactPosterGrid movies={movies} tvShows={tvShows} />
    </section>
  );
}
