'use client';

import { useCallback } from 'react';
import { Movie, PaginatedResponse } from '@/types/movie';
import { searchMovies } from '@/lib/tmdb';
import { InfiniteMovieGrid } from '@/components/movies/InfiniteMovieGrid';

/**
 * Client wrapper for movie search results with infinite scroll + preview.
 */

interface SearchMovieResultsProps {
  query: string;
  initialMovies: Movie[];
  totalResults: number;
  totalPages: number;
}

export function SearchMovieResults({
  query,
  initialMovies,
  totalResults,
  totalPages,
}: SearchMovieResultsProps) {
  const fetchNextPage = useCallback(
    async (page: number): Promise<PaginatedResponse<Movie>> => {
      return searchMovies(query, page);
    },
    [query]
  );

  return (
    <>
      <p className="text-gray-400 mb-6">
        Found {totalResults.toLocaleString()} movies for &ldquo;{query}&rdquo;
      </p>
      <InfiniteMovieGrid
        initialMovies={initialMovies}
        totalResults={totalResults}
        totalPages={totalPages}
        fetchNextPage={fetchNextPage}
      />
    </>
  );
}
