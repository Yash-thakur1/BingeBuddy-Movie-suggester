import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { discoverMovies } from '@/lib/tmdb';
import { CompactPosterGrid } from '@/components/movies';
import { MovieGridSkeleton, Button } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Your Movie Recommendations',
  description:
    'Your personalized movie recommendations curated by AI based on your mood, genre preferences, and viewing history.',
  robots: { index: false, follow: true },
};

interface ResultsPageProps {
  searchParams: {
    genres?: string;
    year_gte?: string;
    year_lte?: string;
    language?: string;
    vote_gte?: string;
  };
}

async function RecommendationResults({ searchParams }: ResultsPageProps) {
  const genreIds = searchParams.genres?.split(',').map(Number).filter(Boolean) || [];
  const yearGte = searchParams.year_gte ? parseInt(searchParams.year_gte) : undefined;
  const yearLte = searchParams.year_lte ? parseInt(searchParams.year_lte) : undefined;
  const language = searchParams.language;
  const voteGte = searchParams.vote_gte ? parseInt(searchParams.vote_gte) : undefined;

  // Build discovery params
  const params: Record<string, string | number | undefined> = {
    sort_by: 'vote_average.desc',
    'vote_count.gte': 100, // Ensure popular enough movies
    with_genres: genreIds.length > 0 ? genreIds.join(',') : undefined,
    'primary_release_date.gte': yearGte ? `${yearGte}-01-01` : undefined,
    'primary_release_date.lte': yearLte ? `${yearLte}-12-31` : undefined,
    with_original_language: language,
    'vote_average.gte': voteGte,
  };

  // Clean undefined values
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== undefined)
  ) as Record<string, string | number>;

  const movies = await discoverMovies(cleanParams);

  if (movies.results.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🎬</div>
        <h2 className="text-2xl font-bold text-white mb-2">No movies found</h2>
        <p className="text-gray-400 mb-6">
          Try adjusting your preferences to get more results
        </p>
        <Link href="/recommendations">
          <Button className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-400">
            Found <span className="text-white font-semibold">{movies.total_results}</span> movies matching your preferences
          </p>
        </div>
        <Link href="/recommendations">
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refine
          </Button>
        </Link>
      </div>
      <CompactPosterGrid movies={movies.results} />
    </div>
  );
}

export default function ResultsPage({ searchParams }: ResultsPageProps) {
  return (
    <div className="container mx-auto px-4 md:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/recommendations"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Preferences
        </Link>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-2">
          🎯 Your Personalized Picks
        </h1>
        <p className="text-gray-400">
          Movies curated just for you based on your preferences
        </p>
      </div>

      {/* Results */}
      <Suspense fallback={<MovieGridSkeleton count={12} />}>
        <RecommendationResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
