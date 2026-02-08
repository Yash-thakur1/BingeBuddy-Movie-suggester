import { Suspense } from 'react';
import {
  getTrendingMovies,
  getPopularMovies,
  getTopRatedMovies,
  getNowPlayingMovies,
  getUpcomingMovies,
  getMoviesByGenre,
  getMovieVideos,
} from '@/lib/tmdb';
import { HeroCarousel, HeroCarouselSkeleton } from '@/components/features';
import { ContentRail, ContentRailSkeleton } from '@/components/movies';
import { FAQSchema } from '@/components/seo';

export const revalidate = 3600;

/**
 * Home Page — Streaming-platform dashboard with hero carousel and content rails.
 */

// Genre rail definitions
const GENRE_RAILS = [
  { id: 35, title: '😂 Comedy Hits', description: 'Laughs guaranteed', href: '/discover?genre=35' },
  { id: 10749, title: '💕 Romance', description: 'Love stories for every mood', href: '/discover?genre=10749' },
  { id: 878, title: '🚀 Sci-Fi', description: 'Beyond the imagination', href: '/discover?genre=878' },
  { id: 27, title: '👻 Horror', description: 'For brave souls only', href: '/discover?genre=27' },
  { id: 53, title: '😰 Thrillers', description: 'Edge-of-your-seat suspense', href: '/discover?genre=53' },
  { id: 12, title: '🗺️ Adventure', description: 'Epic journeys await', href: '/discover?genre=12' },
  { id: 99, title: '📹 Documentaries', description: 'True stories that inspire', href: '/discover?genre=99' },
  { id: 16, title: '🎨 Animation', description: 'Animated masterpieces', href: '/discover?genre=16' },
];

/** Fetch hero items with trailers */
async function HeroContent() {
  const trending = await getTrendingMovies('day');
  const heroMovies = trending.results.slice(0, 6);

  // Fetch trailers in parallel for first 6 items
  const heroItems = await Promise.all(
    heroMovies.map(async (movie) => {
      try {
        const videos = await getMovieVideos(movie.id);
        const trailer = videos.results.find(
          (v) => v.site === 'YouTube' && v.type === 'Trailer'
        );
        return { movie, trailerKey: trailer?.key || null };
      } catch {
        return { movie, trailerKey: null };
      }
    })
  );

  return <HeroCarousel items={heroItems} />;
}

/** New Releases rail (now playing + upcoming) — auto-slides */
async function NewReleasesRail() {
  const [nowPlaying, upcoming] = await Promise.all([
    getNowPlayingMovies(),
    getUpcomingMovies(),
  ]);

  const seen = new Set<number>();
  const merged = [...nowPlaying.results, ...upcoming.results].filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  }).slice(0, 15);

  return (
    <ContentRail
      title="🆕 New Releases"
      description="Just hit theaters & streaming"
      movies={merged}
      viewAllHref="/discover?sort=release_date.desc"
      autoSlide
      autoSlideInterval={3000}
    />
  );
}

async function TrendingRail() {
  const trending = await getTrendingMovies('week');
  return (
    <ContentRail
      title="🔥 Trending This Week"
      description="Most popular right now"
      movies={trending.results.slice(0, 15)}
      viewAllHref="/discover?sort=popularity.desc"
    />
  );
}

async function PopularRail() {
  const popular = await getPopularMovies();
  return (
    <ContentRail
      title="⭐ Popular Movies"
      description="Fan favorites everyone loves"
      movies={popular.results.slice(0, 15)}
      viewAllHref="/discover?sort=popularity.desc"
    />
  );
}

async function TopRatedRail() {
  const topRated = await getTopRatedMovies();
  return (
    <ContentRail
      title="🏆 Top Rated"
      description="Critically acclaimed masterpieces"
      movies={topRated.results.slice(0, 15)}
      viewAllHref="/discover?sort=vote_average.desc"
    />
  );
}

async function GenreRail({ genreId, title, description, href }: {
  genreId: number;
  title: string;
  description: string;
  href: string;
}) {
  const data = await getMoviesByGenre(genreId);
  return (
    <ContentRail
      title={title}
      description={description}
      movies={data.results.slice(0, 15)}
      viewAllHref={href}
    />
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Carousel */}
      <Suspense fallback={<HeroCarouselSkeleton />}>
        <HeroContent />
      </Suspense>

      {/* Content Rails */}
      <div className="container mx-auto px-2 sm:px-4 md:px-8 -mt-10 md:-mt-16 relative z-10">

        {/* New Releases */}
        <Suspense fallback={<ContentRailSkeleton />}>
          <NewReleasesRail />
        </Suspense>

        {/* Trending */}
        <Suspense fallback={<ContentRailSkeleton />}>
          <TrendingRail />
        </Suspense>

        {/* Popular */}
        <Suspense fallback={<ContentRailSkeleton />}>
          <PopularRail />
        </Suspense>

        {/* Top Rated */}
        <Suspense fallback={<ContentRailSkeleton />}>
          <TopRatedRail />
        </Suspense>

        {/* Genre Rails */}
        {GENRE_RAILS.map((genre) => (
          <Suspense key={genre.id} fallback={<ContentRailSkeleton />}>
            <GenreRail
              genreId={genre.id}
              title={genre.title}
              description={genre.description}
              href={genre.href}
            />
          </Suspense>
        ))}

        {/* Internal Navigation Links */}
        <section className="py-4 md:py-8">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2 md:gap-3">
            <a href="/discover" className="group flex flex-col sm:flex-row items-center gap-1 sm:gap-3 p-2 sm:p-3 md:p-4 rounded-lg md:rounded-xl bg-dark-900/60 border border-dark-800 hover:border-primary-600/30 transition-colors">
              <span className="text-lg sm:text-2xl">🎬</span>
              <div className="text-center sm:text-left">
                <p className="text-white text-[11px] sm:text-sm font-medium group-hover:text-primary-400 transition-colors">Discover</p>
                <p className="text-gray-500 text-[9px] sm:text-xs hidden sm:block">Browse by genre</p>
              </div>
            </a>
            <a href="/search" className="group flex flex-col sm:flex-row items-center gap-1 sm:gap-3 p-2 sm:p-3 md:p-4 rounded-lg md:rounded-xl bg-dark-900/60 border border-dark-800 hover:border-primary-600/30 transition-colors">
              <span className="text-lg sm:text-2xl">🔍</span>
              <div className="text-center sm:text-left">
                <p className="text-white text-[11px] sm:text-sm font-medium group-hover:text-primary-400 transition-colors">Search</p>
                <p className="text-gray-500 text-[9px] sm:text-xs hidden sm:block">Find any title</p>
              </div>
            </a>
            <a href="/tv" className="group flex flex-col sm:flex-row items-center gap-1 sm:gap-3 p-2 sm:p-3 md:p-4 rounded-lg md:rounded-xl bg-dark-900/60 border border-dark-800 hover:border-primary-600/30 transition-colors">
              <span className="text-lg sm:text-2xl">📺</span>
              <div className="text-center sm:text-left">
                <p className="text-white text-[11px] sm:text-sm font-medium group-hover:text-primary-400 transition-colors">TV Series</p>
                <p className="text-gray-500 text-[9px] sm:text-xs hidden sm:block">Top rated shows</p>
              </div>
            </a>
            <a href="/recommendations" className="group flex flex-col sm:flex-row items-center gap-1 sm:gap-3 p-2 sm:p-3 md:p-4 rounded-lg md:rounded-xl bg-dark-900/60 border border-dark-800 hover:border-primary-600/30 transition-colors">
              <span className="text-lg sm:text-2xl">✨</span>
              <div className="text-center sm:text-left">
                <p className="text-white text-[11px] sm:text-sm font-medium group-hover:text-primary-400 transition-colors">AI Picks</p>
                <p className="text-gray-500 text-[9px] sm:text-xs hidden sm:block">Personalized for you</p>
              </div>
            </a>
            <a href="/watchlist" className="group flex flex-col sm:flex-row items-center gap-1 sm:gap-3 p-2 sm:p-3 md:p-4 rounded-lg md:rounded-xl bg-dark-900/60 border border-dark-800 hover:border-primary-600/30 transition-colors">
              <span className="text-lg sm:text-2xl">🔖</span>
              <div className="text-center sm:text-left">
                <p className="text-white text-[11px] sm:text-sm font-medium group-hover:text-primary-400 transition-colors">Watchlist</p>
                <p className="text-gray-500 text-[9px] sm:text-xs hidden sm:block">Save for later</p>
              </div>
            </a>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-6 md:py-12 text-center">
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2 md:mb-4">
            Can&apos;t decide what to watch?
          </h2>
          <p className="text-gray-400 text-sm md:text-base mb-4 md:mb-8 max-w-xl mx-auto">
            Let our AI recommendation engine find the perfect movie based on your mood, favorite genres, and viewing history.
          </p>
          <a
            href="/recommendations"
            className="inline-flex items-center gap-1.5 md:gap-2 px-5 py-2.5 md:px-8 md:py-4 bg-primary-600 hover:bg-primary-500 text-white text-sm md:text-base font-semibold rounded-full transition-all duration-200 shadow-glow"
          >
            ✨ Get Personalized Recommendations
          </a>
        </section>

        {/* SEO Content Section */}
        <section className="py-4 md:py-8 border-t border-dark-800/50">
          <h2 className="text-sm md:text-lg font-semibold text-white mb-2 md:mb-3">About BingeBuddy</h2>
          <div className="text-xs md:text-sm text-gray-500 space-y-2 max-w-3xl">
            <p>
              BingeBuddy is a free AI-powered movie and TV show discovery platform. Browse trending films,
              explore top-rated series, and get personalized recommendations based on your mood and genre preferences.
            </p>
            <p>
              Search any movie or TV show to find ratings, trailers, cast information, and where to stream.
              Build your watchlist and never run out of things to watch.
            </p>
          </div>
        </section>

        {/* FAQ structured data */}
        <FAQSchema
          questions={[
            {
              question: 'How does BingeBuddy recommend movies?',
              answer: 'BingeBuddy uses AI to analyze your mood, genre preferences, and viewing history to suggest movies and TV shows tailored to your taste.',
            },
            {
              question: 'Is BingeBuddy free to use?',
              answer: 'Yes, BingeBuddy is completely free. Browse trending movies, get AI recommendations, and build your watchlist at no cost.',
            },
            {
              question: 'Can I find where to stream a movie?',
              answer: 'Yes, each movie and TV show page shows available streaming platforms so you know exactly where to watch.',
            },
          ]}
        />
      </div>
    </div>
  );
}
