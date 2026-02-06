'use client';

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Movie, PaginatedResponse } from '@/types/movie';
import { discoverMovies } from '@/lib/tmdb';
import { InfiniteMovieGrid } from '@/components/movies/InfiniteMovieGrid';

/**
 * Client wrapper for the discover results.
 * Receives initial server-fetched data and handles infinite scrolling + preview.
 */

interface DiscoverResultsProps {
  initialMovies: Movie[];
  totalResults: number;
  totalPages: number;
}

export function DiscoverResults({
  initialMovies,
  totalResults,
  totalPages,
}: DiscoverResultsProps) {
  const searchParams = useSearchParams();

  // Build stable filter params from URL
  const filterParams = useMemo(() => {
    const genreIds =
      searchParams
        .get('genre')
        ?.split(',')
        .map(Number)
        .filter(Boolean) || [];
    const year = searchParams.get('year')
      ? parseInt(searchParams.get('year')!)
      : undefined;
    const sortBy = searchParams.get('sort') || '';

    return {
      with_genres: genreIds.length > 0 ? genreIds.join(',') : undefined,
      primary_release_year: year,
      ...(sortBy ? { sort_by: sortBy as any } : {}),
      'vote_count.gte': 50,
    };
  }, [searchParams]);

  // Stable fetcher for every subsequent page
  const fetchNextPage = useCallback(
    async (page: number): Promise<PaginatedResponse<Movie>> => {
      return discoverMovies({ ...filterParams, page });
    },
    [filterParams]
  );

  return (
    <>
      <div className="mb-4">
        <p className="text-sm text-gray-400">
          Found {totalResults.toLocaleString()} movies
        </p>
      </div>

      <InfiniteMovieGrid
        initialMovies={initialMovies}
        totalResults={totalResults}
        totalPages={totalPages}
        fetchNextPage={fetchNextPage}
      />
    </>
  );
}
