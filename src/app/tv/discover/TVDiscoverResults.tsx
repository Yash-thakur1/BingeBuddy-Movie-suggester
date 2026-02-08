'use client';

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { TVShow, PaginatedResponse } from '@/types/movie';
import { discoverTVShows } from '@/lib/tmdb';
import { InfiniteTVGrid } from '@/components/movies';

/**
 * Client wrapper for TV discover results.
 * Receives initial server-fetched data and handles infinite scrolling.
 */

interface TVDiscoverResultsProps {
  initialShows: TVShow[];
  totalResults: number;
  totalPages: number;
}

export function TVDiscoverResults({
  initialShows,
  totalResults,
  totalPages,
}: TVDiscoverResultsProps) {
  const searchParams = useSearchParams();

  // Build stable filter params from URL
  const filterParams = useMemo(() => {
    const genreIds =
      searchParams
        .get('genres')
        ?.split(',')
        .map(Number)
        .filter(Boolean) || [];
    const year = searchParams.get('year')
      ? parseInt(searchParams.get('year')!)
      : undefined;
    const sortBy = searchParams.get('sort') || '';
    const lang = searchParams.get('lang') || '';

    return {
      with_genres: genreIds.length > 0 ? genreIds.join(',') : undefined,
      first_air_date_year: year,
      ...(sortBy ? { sort_by: sortBy as string } : {}),
      ...(lang ? { with_original_language: lang } : {}),
      'vote_count.gte': 50,
    };
  }, [searchParams]);

  // Stable fetcher for subsequent pages
  const fetchNextPage = useCallback(
    async (page: number): Promise<PaginatedResponse<TVShow>> => {
      return discoverTVShows({ ...filterParams, page });
    },
    [filterParams]
  );

  return (
    <>
      <div className="mb-4">
        <p className="text-sm text-gray-400">
          Found {totalResults.toLocaleString()} TV shows
        </p>
      </div>

      <InfiniteTVGrid
        initialShows={initialShows}
        totalResults={totalResults}
        totalPages={totalPages}
        fetchNextPage={fetchNextPage}
      />
    </>
  );
}
