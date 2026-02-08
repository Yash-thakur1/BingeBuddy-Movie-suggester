import { Suspense } from 'react';
import type { Metadata } from 'next';
import { HeroCarousel, HeroCarouselSkeleton } from '@/components/features';
import { ContentRail, ContentRailSkeleton } from '@/components/movies';
import {
  getCachedTVHero,
  getCachedAiringToday,
  getCachedTrendingTV,
  getCachedPopularTV,
  getCachedTopRatedTV,
  getCachedOnTheAirTV,
  getCachedTVGenreRail,
} from '@/lib/serverCache';

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

// TV genre rail definitions
const TV_GENRE_RAILS = [
  { id: 18, title: '🎭 Drama Series', description: 'Compelling stories & complex characters', href: '/tv/discover?genre=18' },
  { id: 35, title: '😂 Comedy Shows', description: 'Laughs on demand', href: '/tv/discover?genre=35' },
  { id: 10765, title: '🚀 Sci-Fi & Fantasy', description: 'Worlds beyond imagination', href: '/tv/discover?genre=10765' },
  { id: 80, title: '🔪 Crime', description: 'Whodunits & heists', href: '/tv/discover?genre=80' },
  { id: 10759, title: '💥 Action & Adventure', description: 'Non-stop thrills', href: '/tv/discover?genre=10759' },
  { id: 99, title: '📹 Documentaries', description: 'True stories that inspire', href: '/tv/discover?genre=99' },
];

/** Fetch hero items with trailers (cached hourly) */
async function TVHeroContent() {
  const heroItems = await getCachedTVHero();
  return <HeroCarousel items={heroItems} />;
}

async function AiringTodayRail() {
  const tvShows = await getCachedAiringToday();
  return (
    <ContentRail
      title="📺 Airing Today"
      description="New episodes dropping today"
      tvShows={tvShows}
      viewAllHref="/tv/discover?sort=popularity.desc"
      autoSlide
      autoSlideInterval={3000}
    />
  );
}

async function TrendingTVRail() {
  const tvShows = await getCachedTrendingTV();
  return (
    <ContentRail
      title="🔥 Trending This Week"
      description="Most popular TV shows right now"
      tvShows={tvShows}
      viewAllHref="/tv/discover?sort=popularity.desc"
    />
  );
}

async function PopularTVRail() {
  const tvShows = await getCachedPopularTV();
  return (
    <ContentRail
      title="⭐ Popular Shows"
      description="Fan favorites everyone loves"
      tvShows={tvShows}
      viewAllHref="/tv/discover?sort=popularity.desc"
    />
  );
}

async function TopRatedTVRail() {
  const tvShows = await getCachedTopRatedTV();
  return (
    <ContentRail
      title="🏆 Top Rated"
      description="Critically acclaimed series"
      tvShows={tvShows}
      viewAllHref="/tv/discover?sort=vote_average.desc"
    />
  );
}

async function OnTheAirRail() {
  const tvShows = await getCachedOnTheAirTV();
  return (
    <ContentRail
      title="🗓️ On The Air"
      description="Currently airing series"
      tvShows={tvShows}
      viewAllHref="/tv/discover?sort=popularity.desc"
    />
  );
}

async function TVGenreRail({ genreId, title, description, href }: {
  genreId: number;
  title: string;
  description: string;
  href: string;
}) {
  const tvShows = await getCachedTVGenreRail(genreId);
  return (
    <ContentRail
      title={title}
      description={description}
      tvShows={tvShows}
      viewAllHref={href}
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

        {/* Genre Rails (daily smart shuffle) */}
        {TV_GENRE_RAILS.map((genre) => (
          <Suspense key={genre.id} fallback={<ContentRailSkeleton />}>
            <TVGenreRail
              genreId={genre.id}
              title={genre.title}
              description={genre.description}
              href={genre.href}
            />
          </Suspense>
        ))}

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
