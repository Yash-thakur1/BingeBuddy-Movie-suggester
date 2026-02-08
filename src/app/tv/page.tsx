import { Suspense } from 'react';
import type { Metadata } from 'next';
import {
  getTrendingTVShows,
  getPopularTVShows,
  getTopRatedTVShows,
  getAiringTodayTVShows,
  getOnTheAirTVShows,
  getTVShowVideos,
} from '@/lib/tmdb';
import { HeroCarousel, HeroCarouselSkeleton } from '@/components/features';
import { ContentRail, ContentRailSkeleton } from '@/components/movies';

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

export const revalidate = 3600;

/**
 * TV Series Home Page — Streaming-platform dashboard with hero carousel and content rails.
 */

/** Fetch hero items with trailers */
async function TVHeroContent() {
  const trending = await getTrendingTVShows('day');
  const heroShows = trending.results.slice(0, 6);

  const heroItems = await Promise.all(
    heroShows.map(async (tvShow) => {
      try {
        const videos = await getTVShowVideos(tvShow.id);
        const trailer = videos.results.find(
          (v) => v.site === 'YouTube' && v.type === 'Trailer'
        );
        return { tvShow, trailerKey: trailer?.key || null };
      } catch {
        return { tvShow, trailerKey: null };
      }
    })
  );

  return <HeroCarousel items={heroItems} />;
}

async function AiringTodayRail() {
  const airingToday = await getAiringTodayTVShows();
  return (
    <ContentRail
      title="📺 Airing Today"
      description="New episodes dropping today"
      tvShows={airingToday.results.slice(0, 15)}
      viewAllHref="/tv/discover?sort=popularity.desc"
      autoSlide
      autoSlideInterval={3000}
    />
  );
}

async function TrendingTVRail() {
  const trending = await getTrendingTVShows('week');
  return (
    <ContentRail
      title="🔥 Trending This Week"
      description="Most popular TV shows right now"
      tvShows={trending.results.slice(0, 15)}
      viewAllHref="/tv/discover?sort=popularity.desc"
    />
  );
}

async function PopularTVRail() {
  const popular = await getPopularTVShows();
  return (
    <ContentRail
      title="⭐ Popular Shows"
      description="Fan favorites everyone loves"
      tvShows={popular.results.slice(0, 15)}
      viewAllHref="/tv/discover?sort=popularity.desc"
    />
  );
}

async function TopRatedTVRail() {
  const topRated = await getTopRatedTVShows();
  return (
    <ContentRail
      title="🏆 Top Rated"
      description="Critically acclaimed series"
      tvShows={topRated.results.slice(0, 15)}
      viewAllHref="/tv/discover?sort=vote_average.desc"
    />
  );
}

async function OnTheAirRail() {
  const onTheAir = await getOnTheAirTVShows();
  return (
    <ContentRail
      title="🗓️ On The Air"
      description="Currently airing series"
      tvShows={onTheAir.results.slice(0, 15)}
      viewAllHref="/tv/discover?sort=popularity.desc"
    />
  );
}

export default function TVHomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Carousel */}
      <Suspense fallback={<HeroCarouselSkeleton />}>
        <TVHeroContent />
      </Suspense>

      {/* Content Rails */}
      <div className="container mx-auto px-2 sm:px-4 md:px-8 -mt-10 md:-mt-16 relative z-10">

        <Suspense fallback={<ContentRailSkeleton />}>
          <AiringTodayRail />
        </Suspense>

        <Suspense fallback={<ContentRailSkeleton />}>
          <TrendingTVRail />
        </Suspense>

        <Suspense fallback={<ContentRailSkeleton />}>
          <PopularTVRail />
        </Suspense>

        <Suspense fallback={<ContentRailSkeleton />}>
          <TopRatedTVRail />
        </Suspense>

        <Suspense fallback={<ContentRailSkeleton />}>
          <OnTheAirRail />
        </Suspense>

        {/* Internal Links */}
        <section className="py-3 md:py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 md:gap-3">
            <a href="/tv/discover" className="group flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 md:p-4 rounded-lg md:rounded-xl bg-dark-900/60 border border-dark-800 hover:border-primary-600/30 transition-colors">
              <span className="text-lg sm:text-2xl">🔍</span>
              <div>
                <p className="text-white text-[11px] sm:text-sm font-medium group-hover:text-primary-400 transition-colors">Discover Shows</p>
                <p className="text-gray-500 text-[9px] sm:text-xs hidden sm:block">Filter by genre & year</p>
              </div>
            </a>
            <a href="/tv/recommendations" className="group flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 md:p-4 rounded-lg md:rounded-xl bg-dark-900/60 border border-dark-800 hover:border-primary-600/30 transition-colors">
              <span className="text-lg sm:text-2xl">✨</span>
              <div>
                <p className="text-white text-[11px] sm:text-sm font-medium group-hover:text-primary-400 transition-colors">AI Picks</p>
                <p className="text-gray-500 text-[9px] sm:text-xs hidden sm:block">Personalized for you</p>
              </div>
            </a>
            <a href="/discover" className="group flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 md:p-4 rounded-lg md:rounded-xl bg-dark-900/60 border border-dark-800 hover:border-primary-600/30 transition-colors">
              <span className="text-lg sm:text-2xl">🎬</span>
              <div>
                <p className="text-white text-[11px] sm:text-sm font-medium group-hover:text-primary-400 transition-colors">Browse Movies</p>
                <p className="text-gray-500 text-[9px] sm:text-xs hidden sm:block">Explore the film catalog</p>
              </div>
            </a>
            <a href="/watchlist" className="group flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 md:p-4 rounded-lg md:rounded-xl bg-dark-900/60 border border-dark-800 hover:border-primary-600/30 transition-colors">
              <span className="text-lg sm:text-2xl">🔖</span>
              <div>
                <p className="text-white text-[11px] sm:text-sm font-medium group-hover:text-primary-400 transition-colors">Watchlist</p>
                <p className="text-gray-500 text-[9px] sm:text-xs hidden sm:block">Save shows for later</p>
              </div>
            </a>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-6 md:py-12 text-center">
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2 md:mb-4">
            Looking for your next binge?
          </h2>
          <p className="text-gray-400 text-sm md:text-base mb-4 md:mb-8 max-w-xl mx-auto">
            Let our AI find the perfect TV series based on your mood, genre preferences, and viewing history.
          </p>
          <a
            href="/tv/recommendations"
            className="inline-flex items-center gap-1.5 md:gap-2 px-5 py-2.5 md:px-8 md:py-4 bg-primary-600 hover:bg-primary-500 text-white text-sm md:text-base font-semibold rounded-full transition-all duration-200 shadow-glow"
          >
            ✨ Get Personalized Recommendations
          </a>
        </section>

        {/* SEO content */}
        <section className="py-3 md:py-6 border-t border-dark-800/50">
          <h2 className="text-sm md:text-base font-semibold text-gray-300 mb-1.5 md:mb-2">Discover TV Shows on BingeBuddy</h2>
          <p className="text-[11px] md:text-xs text-gray-500 max-w-2xl">
            Browse trending TV series, top-rated shows, and new episodes airing today. BingeBuddy
            helps you find binge-worthy dramas, comedies, thrillers, and documentaries across every
            streaming platform with AI-powered recommendations tailored to your taste.
          </p>
        </section>
      </div>
    </div>
  );
}
