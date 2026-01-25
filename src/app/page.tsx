import { Suspense } from 'react';
import { getTrendingMovies, getPopularMovies, getTopRatedMovies, getMovieVideos } from '@/lib/tmdb';
import { HeroSection } from '@/components/features';
import { MovieSection, MovieCarousel } from '@/components/movies';
import { HeroSkeleton, MovieGridSkeleton } from '@/components/ui';
import { QuickMoodsSection } from './QuickMoodsSection';

export const revalidate = 3600; // Revalidate every hour

/**
 * Home Page
 * Main landing page with hero, quick moods, and movie sections
 */

// Fetch all data in parallel for better performance
async function fetchHomePageData() {
  const [trendingDay, trendingWeek, popular, topRated] = await Promise.all([
    getTrendingMovies('day'),
    getTrendingMovies('week'),
    getPopularMovies(),
    getTopRatedMovies(),
  ]);
  
  return { trendingDay, trendingWeek, popular, topRated };
}

async function HeroContent() {
  const trending = await getTrendingMovies('day');
  const featuredMovie = trending.results[0];

  // Get trailer for featured movie
  const videos = await getMovieVideos(featuredMovie.id);
  const trailer = videos.results.find(
    (v) => v.site === 'YouTube' && v.type === 'Trailer'
  );

  return <HeroSection movie={featuredMovie} trailerKey={trailer?.key} />;
}

async function MovieSections() {
  const { trendingWeek, popular, topRated } = await fetchHomePageData();
  
  return (
    <>
      <MovieSection
        title="🔥 Trending This Week"
        description="Most popular movies right now"
        movies={trendingWeek.results.slice(0, 12)}
        viewAllHref="/discover?sort=popularity.desc"
      />
      
      <MovieCarousel
        title="⭐ Popular Movies"
        description="Fan favorites everyone loves"
        movies={popular.results}
      />
      
      <MovieSection
        title="🏆 Top Rated"
        description="Critically acclaimed masterpieces"
        movies={topRated.results.slice(0, 12)}
        viewAllHref="/discover?sort=vote_average.desc"
      />
    </>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <Suspense fallback={<HeroSkeleton />}>
        <HeroContent />
      </Suspense>

      {/* Main Content */}
      <div className="container mx-auto px-4 md:px-8 -mt-16 relative z-10">
        {/* Quick Mood Selection */}
        <QuickMoodsSection />

        {/* All Movie Sections - fetched in parallel */}
        <Suspense fallback={<MovieGridSkeleton count={12} />}>
          <MovieSections />
        </Suspense>

        {/* CTA Section */}
        <section className="py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Can&apos;t decide what to watch?
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Let us help you find the perfect movie based on your mood and preferences.
          </p>
          <a
            href="/recommendations"
            className="inline-flex items-center gap-2 px-8 py-4 bg-primary-600 hover:bg-primary-500 text-white font-semibold rounded-full transition-all duration-200 shadow-glow"
          >
            ✨ Get Personalized Recommendations
          </a>
        </section>
      </div>
    </div>
  );
}
