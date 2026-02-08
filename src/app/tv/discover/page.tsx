import { Suspense } from 'react';
import type { Metadata } from 'next';
import { discoverTVShows } from '@/lib/tmdb';
import { MovieGridSkeleton } from '@/components/ui';
import { TVDiscoverFilters } from './TVDiscoverFilters';
import { TVDiscoverResults } from './TVDiscoverResults';

export const metadata: Metadata = {
  title: 'Discover TV Series - Browse Shows by Genre & Rating',
  description:
    'Explore TV series filtered by genre, year, language, and rating. Find binge-worthy dramas, comedies, thrillers, and more from every streaming platform.',
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
    lang?: string;
  };
}

async function DiscoverContent({ searchParams }: DiscoverPageProps) {
  const genreIds = searchParams.genres?.split(',').map(Number).filter(Boolean) || [];
  const year = searchParams.year ? parseInt(searchParams.year) : undefined;
  const sortBy = (searchParams.sort as string) || '';
  const lang = (searchParams.lang as string) || '';

  const shows = await discoverTVShows({
    page: 1,
    with_genres: genreIds.length > 0 ? genreIds.join(',') : undefined,
    first_air_date_year: year,
    ...(sortBy ? { sort_by: sortBy as string } : {}),
    ...(lang ? { with_original_language: lang } : {}),
    'vote_count.gte': 50,
  });

  return (
    <TVDiscoverResults
      initialShows={shows.results}
      totalResults={shows.total_results}
      totalPages={shows.total_pages}
    />
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

      {/* Results with infinite scroll */}
      <Suspense fallback={<MovieGridSkeleton />}>
        <DiscoverContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
