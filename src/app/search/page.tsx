import { Suspense } from 'react';
import type { Metadata } from 'next';
import { searchMovies, searchTVShows, multiSearch } from '@/lib/tmdb';
import { CompactPosterGrid } from '@/components/movies';
import { MovieGridSkeleton } from '@/components/ui';
import { SearchBar } from '@/components/layout';
import { Movie, TVShow, isMovie, isTVShow } from '@/types/movie';
import { SearchMovieResults } from './SearchMovieResults';

export const metadata: Metadata = {
  title: 'Search Movies & TV Shows - Find Any Title',
  description:
    'Search our database of movies and TV shows by title. Instantly find details, ratings, trailers, and streaming availability for any film or series.',
  alternates: {
    canonical: '/search',
  },
  openGraph: {
    title: 'Search Movies & TV Shows',
    description:
      'Search our database of movies and TV shows. Find details, ratings, trailers, and streaming availability instantly.',
    url: '/search',
  },
};

interface SearchPageProps {
  searchParams: { q?: string; page?: string; type?: string };
}

async function SearchResults({ query, page, type }: { query: string; page: number; type: string }) {
  if (!query) {
    return (
      <div className="text-center py-16">
        <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-dark-800 flex items-center justify-center">
          <span className="text-4xl">🔍</span>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Search for movies & TV shows</h2>
        <p className="text-gray-400">Enter a title to get started</p>
      </div>
    );
  }

  // Fetch based on type filter
  if (type === 'movie') {
    const results = await searchMovies(query, 1);
    if (results.results.length === 0) {
      return <NoResults />;
    }
    return (
      <SearchMovieResults
        query={query}
        initialMovies={results.results}
        totalResults={results.total_results}
        totalPages={results.total_pages}
      />
    );
  }

  if (type === 'tv') {
    const results = await searchTVShows(query, page);
    if (results.results.length === 0) {
      return <NoResults />;
    }
    return (
      <>
        <p className="text-gray-400 mb-6">
          Found {results.total_results.toLocaleString()} TV shows for &ldquo;{query}&rdquo;
        </p>
        <CompactPosterGrid tvShows={results.results} />
        <Pagination query={query} page={page} totalPages={results.total_pages} type={type} />
      </>
    );
  }

  // Default: multi search (both movies and TV shows)
  const [movieResults, tvResults] = await Promise.all([
    searchMovies(query, page),
    searchTVShows(query, page),
  ]);

  const totalResults = movieResults.total_results + tvResults.total_results;

  if (totalResults === 0) {
    return <NoResults />;
  }

  return (
    <>
      <p className="text-gray-400 mb-6">
        Found {totalResults.toLocaleString()} results for &ldquo;{query}&rdquo;
      </p>

      {/* Movies Section */}
      {movieResults.results.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              🎬 Movies ({movieResults.total_results.toLocaleString()})
            </h2>
            {movieResults.total_results > 20 && (
              <a
                href={`/search?q=${encodeURIComponent(query)}&type=movie`}
                className="text-primary-400 hover:text-primary-300 text-sm transition-colors"
              >
                View all movies →
              </a>
            )}
          </div>
          <CompactPosterGrid movies={movieResults.results.slice(0, 12)} />
        </div>
      )}

      {/* TV Shows Section */}
      {tvResults.results.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              📺 TV Shows ({tvResults.total_results.toLocaleString()})
            </h2>
            {tvResults.total_results > 20 && (
              <a
                href={`/search?q=${encodeURIComponent(query)}&type=tv`}
                className="text-primary-400 hover:text-primary-300 text-sm transition-colors"
              >
                View all TV shows →
              </a>
            )}
          </div>
          <CompactPosterGrid tvShows={tvResults.results.slice(0, 12)} />
        </div>
      )}
    </>
  );
}

function NoResults() {
  return (
    <div className="text-center py-16">
      <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-dark-800 flex items-center justify-center">
        <span className="text-4xl">😕</span>
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">No results found</h2>
      <p className="text-gray-400">Try a different search term</p>
    </div>
  );
}

function Pagination({ query, page, totalPages, type }: { query: string; page: number; totalPages: number; type: string }) {
  if (totalPages <= 1) return null;
  
  const typeParam = type ? `&type=${type}` : '';
  
  return (
    <div className="mt-8 flex justify-center gap-2">
      {page > 1 && (
        <a
          href={`/search?q=${encodeURIComponent(query)}&page=${page - 1}${typeParam}`}
          className="px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-dark-700 transition-colors"
        >
          Previous
        </a>
      )}
      <span className="px-4 py-2 text-gray-400">
        Page {page} of {Math.min(totalPages, 500)}
      </span>
      {page < Math.min(totalPages, 500) && (
        <a
          href={`/search?q=${encodeURIComponent(query)}&page=${page + 1}${typeParam}`}
          className="px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-dark-700 transition-colors"
        >
          Next
        </a>
      )}
    </div>
  );
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams.q || '';
  const page = parseInt(searchParams.page || '1');
  const type = searchParams.type || 'all';

  return (
    <div className="container mx-auto px-4 md:px-8 py-4 md:py-6">
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white mb-3">
          🔍 Search Movies & TV Shows
        </h1>
        <div className="max-w-xl">
          <SearchBar />
        </div>
        
        {/* Type Filter Tabs */}
        {query && (
          <div className="flex gap-2 mt-4">
            <a
              href={`/search?q=${encodeURIComponent(query)}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                type === 'all' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-dark-800 text-gray-400 hover:text-white'
              }`}
            >
              All
            </a>
            <a
              href={`/search?q=${encodeURIComponent(query)}&type=movie`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                type === 'movie' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-dark-800 text-gray-400 hover:text-white'
              }`}
            >
              🎬 Movies
            </a>
            <a
              href={`/search?q=${encodeURIComponent(query)}&type=tv`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                type === 'tv' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-dark-800 text-gray-400 hover:text-white'
              }`}
            >
              📺 TV Shows
            </a>
          </div>
        )}
      </div>

      <Suspense fallback={<MovieGridSkeleton />}>
        <SearchResults query={query} page={page} type={type} />
      </Suspense>
    </div>
  );
}
