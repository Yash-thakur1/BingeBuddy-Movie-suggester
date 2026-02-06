import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTrendingTVShows, getPopularTVShows, getTopRatedTVShows, getAiringTodayTVShows, getTVShowVideos } from '@/lib/tmdb';
import { TVHeroSection } from '@/components/features';
import { TVShowCarousel, CompactPosterSection } from '@/components/movies';
import { HeroSkeleton, MovieGridSkeleton } from '@/components/ui';
import { TVQuickMoodsSection } from './TVQuickMoodsSection';

export const metadata: Metadata = {
  title: 'TV Shows - Trending, Popular & Top Rated Series',
  description:
    'Browse trending TV shows, top-rated series, and shows airing today. Discover your next binge-worthy show with AI-powered recommendations on BingeBuddy.',
  alternates: {
    canonical: '/tv',
  },
  openGraph: {
    title: 'TV Shows - Trending, Popular & Top Rated Series',
    description:
      'Browse trending TV shows, top-rated series, and shows airing today. Find your next binge.',
    url: '/tv',
  },
};

export const revalidate = 3600; // Revalidate every hour

/**
 * TV Series Home Page
 * Main landing page for TV shows with hero, quick moods, and show sections
 */

// Fetch all data in parallel for better performance
async function fetchTVPageData() {
  const [trendingDay, trendingWeek, popular, topRated, airingToday] = await Promise.all([
    getTrendingTVShows('day'),
    getTrendingTVShows('week'),
    getPopularTVShows(),
    getTopRatedTVShows(),
    getAiringTodayTVShows(),
  ]);
  
  return { trendingDay, trendingWeek, popular, topRated, airingToday };
}

async function HeroContent() {
  const trending = await getTrendingTVShows('day');
  const featuredShow = trending.results[0];

  // Get trailer for featured show
  const videos = await getTVShowVideos(featuredShow.id);
  const trailer = videos.results.find(
    (v) => v.site === 'YouTube' && v.type === 'Trailer'
  );

  return <TVHeroSection show={featuredShow} trailerKey={trailer?.key} />;
}

async function TVSections() {
  const { trendingWeek, popular, topRated, airingToday } = await fetchTVPageData();
  
  return (
    <>
      <CompactPosterSection
        title="🔥 Trending This Week"
        description="Most popular TV shows right now"
        tvShows={trendingWeek.results.slice(0, 18)}
        viewAllHref="/tv/discover?sort=popularity.desc"
      />
      
      <TVShowCarousel
        title="📺 Airing Today"
        description="New episodes dropping today"
        shows={airingToday.results}
      />
      
      <CompactPosterSection
        title="⭐ Popular Shows"
        description="Fan favorites everyone loves"
        tvShows={popular.results.slice(0, 18)}
        viewAllHref="/tv/discover?sort=popularity.desc"
      />
      
      <TVShowCarousel
        title="🏆 Top Rated"
        description="Critically acclaimed series"
        shows={topRated.results}
      />
    </>
  );
}

export default function TVHomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <Suspense fallback={<HeroSkeleton />}>
        <HeroContent />
      </Suspense>

      {/* Main Content */}
      <div className="container mx-auto px-4 md:px-8 -mt-16 relative z-10">
        {/* Quick Mood Selection */}
        <TVQuickMoodsSection />

        {/* All TV Show Sections - fetched in parallel */}
        <Suspense fallback={<MovieGridSkeleton count={12} />}>
          <TVSections />
        </Suspense>

        {/* CTA Section */}
        <section className="py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Looking for your next binge?
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Let us help you find the perfect TV series based on your mood and preferences.
          </p>
          <a
            href="/tv/recommendations"
            className="inline-flex items-center gap-2 px-8 py-4 bg-primary-600 hover:bg-primary-500 text-white font-semibold rounded-full transition-all duration-200 shadow-glow"
          >
            ✨ Get Personalized Recommendations
          </a>
        </section>
      </div>
    </div>
  );
}
