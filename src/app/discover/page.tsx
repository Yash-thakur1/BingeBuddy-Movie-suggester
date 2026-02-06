import { Suspense } from 'react';
import type { Metadata } from 'next';
import { discoverMovies } from '@/lib/tmdb';
import { MovieGridSkeleton } from '@/components/ui';
import { DiscoverFilters } from './DiscoverFilters';
import { DiscoverResults } from './DiscoverResults';

export const metadata: Metadata = {
  title: 'Discover Movies',
  description: 'Browse and discover movies by genre, year, rating, and more.',
};

interface DiscoverPageProps {
  searchParams: {
    genre?: string;
    year?: string;
    sort?: string;
    page?: string;
  };
}

async function DiscoverContent({ searchParams }: DiscoverPageProps) {
  const genreIds = searchParams.genre?.split(',').map(Number).filter(Boolean) || [];
  const year = searchParams.year ? parseInt(searchParams.year) : undefined;
  const sortBy = (searchParams.sort as string) || '';

  const movies = await discoverMovies({
    page: 1,
    with_genres: genreIds.length > 0 ? genreIds.join(',') : undefined,
    primary_release_year: year,
    ...(sortBy ? { sort_by: sortBy as any } : {}),
    'vote_count.gte': 50,
  });

  return (
    <DiscoverResults
      initialMovies={movies.results}
      totalResults={movies.total_results}
      totalPages={movies.total_pages}
    />
  );
}

export default function DiscoverPage({ searchParams }: DiscoverPageProps) {
  return (
    <div className="container mx-auto px-4 md:px-8 py-4 md:py-6">
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white mb-1">
          🎬 Discover Movies
        </h1>
        <p className="text-sm text-gray-400">
          Browse through thousands of movies and find your next favorite
        </p>
      </div>

      {/* Filters */}
      <DiscoverFilters />

      {/* Results with infinite scroll + preview */}
      <Suspense fallback={<MovieGridSkeleton />}>
        <DiscoverContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
