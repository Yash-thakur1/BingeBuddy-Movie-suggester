import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { discoverTVShows } from '@/lib/tmdb';
import { CompactPosterGrid } from '@/components/movies';
import { MovieGridSkeleton, Button } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Your TV Show Recommendations',
  description:
    'Your personalized TV show recommendations curated by AI based on your preferences and viewing taste.',
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

async function TVRecommendationResults({ searchParams }: ResultsPageProps) {
  const genreIds = searchParams.genres?.split(',').map(Number).filter(Boolean) || [];
  const yearGte = searchParams.year_gte ? parseInt(searchParams.year_gte) : undefined;
  const yearLte = searchParams.year_lte ? parseInt(searchParams.year_lte) : undefined;
  const language = searchParams.language;
  const voteGte = searchParams.vote_gte ? parseInt(searchParams.vote_gte) : undefined;

  // Build discovery params - only include defined values
  const params: Record<string, string | number> = {
    sort_by: 'popularity.desc',
  };
  
  if (genreIds.length > 0) {
    params.with_genres = genreIds.join(',');
  }
  
  if (yearGte) {
    params['first_air_date.gte'] = `${yearGte}-01-01`;
  }
  
  if (yearLte) {
    params['first_air_date.lte'] = `${yearLte}-12-31`;
  }
  
  if (language) {
    params.with_original_language = language;
  }
  
  if (voteGte) {
    params['vote_average.gte'] = voteGte;
  }

  let shows;
  try {
    shows = await discoverTVShows(params);
  } catch (error) {
    console.error('Error fetching TV shows:', error);
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-white mb-2">Connection Error</h2>
        <p className="text-gray-400 mb-6">
          Unable to connect to the server. Please check your internet connection and try again.
        </p>
        <Link href="/tv/recommendations/results">
          <Button className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
        </Link>
      </div>
    );
  }

  if (!shows || shows.results.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">📺</div>
        <h2 className="text-2xl font-bold text-white mb-2">No TV shows found</h2>
        <p className="text-gray-400 mb-6">
          Try adjusting your preferences to get more results
        </p>
        <Link href="/tv/recommendations">
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
            Found <span className="text-white font-semibold">{shows.total_results}</span> TV shows matching your preferences
          </p>
        </div>
        <Link href="/tv/recommendations">
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refine
          </Button>
        </Link>
      </div>
      <CompactPosterGrid tvShows={shows.results} />
    </div>
  );
}

export default function TVResultsPage({ searchParams }: ResultsPageProps) {
  return (
    <div className="container mx-auto px-4 md:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/tv/recommendations"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Preferences
        </Link>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-2">
          🎯 Your Personalized TV Picks
        </h1>
        <p className="text-gray-400">
          Based on your preferences, here are some TV shows you might love
        </p>
      </div>

      <Suspense fallback={<MovieGridSkeleton />}>
        <TVRecommendationResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
