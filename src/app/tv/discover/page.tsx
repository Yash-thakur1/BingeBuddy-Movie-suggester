import { Suspense } from 'react';
import type { Metadata } from 'next';
import { discoverTVShows } from '@/lib/tmdb';
import { CompactPosterGrid } from '@/components/movies';
import { MovieGridSkeleton } from '@/components/ui';
import { TVDiscoverFilters } from './TVDiscoverFilters';

export const metadata: Metadata = {
  title: 'Discover TV Series - Browse Shows by Genre & Rating',
  description:
    'Explore TV series filtered by genre, year, and rating. Find binge-worthy dramas, comedies, thrillers, and more from every streaming platform.',
  alternates: {
    canonical: '/tv/discover',
  },
  openGraph: {
    title: 'Discover TV Series - Browse Shows by Genre & Rating',
    description:
      'Explore TV series filtered by genre, year, and rating. Find your next binge-worthy show.',
    url: '/tv/discover',
  },
};

interface DiscoverPageProps {
  searchParams: {
    genres?: string;
    year?: string;
    sort?: string;
    page?: string;
  };
}

async function DiscoverContent({ searchParams }: DiscoverPageProps) {
  const page = parseInt(searchParams.page || '1');
  const genreIds = searchParams.genres?.split(',').map(Number).filter(Boolean) || [];
  const year = searchParams.year ? parseInt(searchParams.year) : undefined;
  const sortBy = (searchParams.sort as string) || '';

  const shows = await discoverTVShows({
    page,
    with_genres: genreIds.length > 0 ? genreIds.join(',') : undefined,
    first_air_date_year: year,
    ...(sortBy ? { sort_by: sortBy as any } : {}),
    'vote_count.gte': 50,
  });

  return (
    <>
      <div className="mb-4">
        <p className="text-sm text-gray-400">
          Found {shows.total_results.toLocaleString()} TV shows
        </p>
      </div>

      <CompactPosterGrid tvShows={shows.results} />

      {/* Pagination */}
      {shows.total_pages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {page > 1 && (
            <a
              href={`/tv/discover?${new URLSearchParams({
                ...searchParams,
                page: String(page - 1),
              })}`}
              className="px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-dark-700 transition-colors"
            >
              Previous
            </a>
          )}
          <span className="px-4 py-2 text-gray-400">
            Page {page} of {Math.min(shows.total_pages, 500)}
          </span>
          {page < Math.min(shows.total_pages, 500) && (
            <a
              href={`/tv/discover?${new URLSearchParams({
                ...searchParams,
                page: String(page + 1),
              })}`}
              className="px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-dark-700 transition-colors"
            >
              Next
            </a>
          )}
        </div>
      )}
    </>
  );
}

export default function TVDiscoverPage({ searchParams }: DiscoverPageProps) {
  return (
    <div className="container mx-auto px-4 md:px-8 py-4 md:py-6">
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white mb-1">
          📺 Discover TV Series
        </h1>
        <p className="text-sm text-gray-400">
          Browse through thousands of TV shows and find your next binge
        </p>
      </div>

      {/* Filters */}
      <TVDiscoverFilters />

      {/* Results */}
      <Suspense fallback={<MovieGridSkeleton />}>
        <DiscoverContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
