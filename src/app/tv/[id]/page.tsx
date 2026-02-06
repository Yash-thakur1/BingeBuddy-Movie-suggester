import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import type { Metadata } from 'next';
import {
  getTVShowDetails,
  getTVShowCredits,
  getTVShowVideos,
  getTVShowWatchProviders,
  getSimilarTVShows,
  getTVShowRecommendations,
  getImageUrl,
  formatDate,
  getMainTrailer,
} from '@/lib/tmdb';
import { RatingBadge, Badge, MovieDetailsSkeleton } from '@/components/ui';
import { CastSection, CrewSection, TrailerPlayer, TVShowCarousel } from '@/components/movies';
import { TVShowDetailsActions } from './TVShowDetailsActions';
import { TVWatchProvidersSection } from './TVWatchProviders';
import { TVWatchTracker } from './TVWatchTracker';
import { Credits, Cast, Crew, WatchProviderCountry } from '@/types/movie';

interface TVShowPageProps {
  params: { id: string };
}

// Generate metadata for SEO
export async function generateMetadata({ params }: TVShowPageProps): Promise<Metadata> {
  try {
    const show = await getTVShowDetails(parseInt(params.id));
    const year = show.first_air_date ? new Date(show.first_air_date).getFullYear() : 'TBA';
    const title = `${show.name} (${year}) - TV Series`;
    const description = show.overview
      ? show.overview.length > 155
        ? show.overview.substring(0, 152) + '...'
        : show.overview
      : `Watch ${show.name} — find ratings, trailers, cast, and streaming availability on BingeBuddy.`;
    const posterUrl = getImageUrl(show.poster_path, 'w500');

    return {
      title,
      description,
      alternates: {
        canonical: `/tv/${params.id}`,
      },
      openGraph: {
        title: `${show.name} (${year}) - TV Series Details & Trailers`,
        description,
        url: `/tv/${params.id}`,
        type: 'video.tv_show',
        images: posterUrl ? [{ url: posterUrl, width: 500, height: 750, alt: show.name }] : [],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${show.name} (${year}) - TV Series`,
        description,
        images: posterUrl ? [posterUrl] : [],
      },
    };
  } catch {
    return { title: 'TV Show Not Found' };
  }
}

function formatSeasons(numSeasons: number): string {
  return numSeasons === 1 ? '1 Season' : `${numSeasons} Seasons`;
}

function formatEpisodes(numEpisodes: number): string {
  return numEpisodes === 1 ? '1 Episode' : `${numEpisodes} Episodes`;
}

async function TVShowContent({ id }: { id: number }) {
  const details = await getTVShowDetails(id);
  
  let credits: Credits = { id, cast: [] as Cast[], crew: [] as Crew[] };
  let trailer: string | null = null;
  let watchProviders: WatchProviderCountry | null = null;
  
  try {
    const [creditsResult, videos, providers] = await Promise.all([
      getTVShowCredits(id),
      getTVShowVideos(id),
      getTVShowWatchProviders(id),
    ]);
    credits = creditsResult;
    trailer = getMainTrailer(videos);
    watchProviders = providers.results?.US || providers.results?.IN || 
      Object.values(providers.results || {})[0] || null;
  } catch (error) {
    console.error('Error loading credits/videos/providers:', error);
  }

  const creator = details.created_by?.[0];

  return (
    <>
      {/* Watch History Tracker */}
      <TVWatchTracker
        id={details.id}
        name={details.name}
        posterPath={details.poster_path}
        genreIds={details.genres.map(g => g.id)}
        voteAverage={details.vote_average}
        firstAirDate={details.first_air_date}
        originalLanguage={details.original_language}
      />

      {/* Hero Backdrop */}
      <div className="relative h-[50vh] min-h-[400px] w-full overflow-hidden">
        <Image
          src={getImageUrl(details.backdrop_path, 'original')}
          alt={details.name}
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/50 to-dark-950/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-transparent to-transparent" />
      </div>

      {/* Main Content */}
      <div className="relative -mt-64 container mx-auto px-4 md:px-8 pb-16">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Poster */}
          <div className="shrink-0">
            <div className="relative w-64 h-96 rounded-xl overflow-hidden shadow-2xl mx-auto lg:mx-0">
              <Image
                src={getImageUrl(details.poster_path, 'w500')}
                alt={details.name}
                fill
                className="object-cover"
                priority
                sizes="256px"
              />
              {/* TV Badge */}
              <div className="absolute top-3 left-3">
                <Badge variant="primary">TV Series</Badge>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            {/* Title */}
            <h1 className="text-3xl md:text-5xl font-display font-bold text-white mb-2">
              {details.name}
            </h1>
            
            {/* Tagline */}
            {details.tagline && (
              <p className="text-xl text-gray-400 italic mb-4">&ldquo;{details.tagline}&rdquo;</p>
            )}

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <RatingBadge rating={details.vote_average} size="lg" />
              <span className="text-gray-300">{formatDate(details.first_air_date)}</span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-300">{formatSeasons(details.number_of_seasons)}</span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-300">{formatEpisodes(details.number_of_episodes)}</span>
              <span className="text-gray-500">•</span>
              <Badge variant={details.status === 'Returning Series' ? 'success' : 'secondary'}>
                {details.status}
              </Badge>
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-2 mb-6">
              {details.genres.map((genre) => (
                <Badge key={genre.id} variant="genre">
                  {genre.name}
                </Badge>
              ))}
            </div>

            {/* Overview */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-2">Overview</h3>
              <p className="text-gray-300 leading-relaxed">{details.overview}</p>
            </div>

            {/* Creator */}
            {creator && (
              <div className="mb-6">
                <span className="text-gray-400">Created by:</span>{' '}
                <span className="text-white font-medium">{creator.name}</span>
              </div>
            )}

            {/* Networks */}
            {details.networks && details.networks.length > 0 && (
              <div className="mb-6">
                <span className="text-gray-400">Networks:</span>{' '}
                <span className="text-white font-medium">
                  {details.networks.map((n) => n.name).join(', ')}
                </span>
              </div>
            )}

            {/* Actions */}
            <TVShowDetailsActions
              show={{
                id: details.id,
                name: details.name,
                original_name: details.original_name,
                overview: details.overview,
                poster_path: details.poster_path,
                backdrop_path: details.backdrop_path,
                first_air_date: details.first_air_date,
                vote_average: details.vote_average,
                vote_count: details.vote_count,
                popularity: details.popularity,
                genre_ids: details.genres.map((g) => g.id),
                origin_country: details.origin_country || [],
                original_language: details.original_language,
              }}
              trailerKey={trailer}
            />
          </div>
        </div>

        {/* Where to Watch Section */}
        <TVWatchProvidersSection providers={watchProviders} showTitle={details.name} />

        {/* Trailer Section */}
        {trailer && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-4">🎬 Trailer</h2>
            <TrailerPlayer videoKey={trailer} title={details.name} className="max-w-4xl" />
          </section>
        )}

        {/* Seasons */}
        {details.seasons && details.seasons.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-4">📺 Seasons</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {details.seasons.filter(s => s.season_number > 0).map((season) => (
                <div key={season.id} className="bg-dark-800 rounded-xl overflow-hidden">
                  <div className="relative aspect-[2/3]">
                    <Image
                      src={getImageUrl(season.poster_path, 'w342')}
                      alt={season.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, 16vw"
                    />
                  </div>
                  <div className="p-3">
                    <h4 className="text-white font-medium text-sm line-clamp-1">{season.name}</h4>
                    <p className="text-gray-400 text-xs">{season.episode_count} Episodes</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Cast */}
        <CastSection cast={credits.cast} />

        {/* Crew */}
        <CrewSection crew={credits.crew} />
      </div>
    </>
  );
}

async function SimilarTVShowsSection({ id }: { id: number }) {
  try {
    const [similar, recommendations] = await Promise.all([
      getSimilarTVShows(id),
      getTVShowRecommendations(id),
    ]);

    const hasContent = recommendations.results.length > 0 || similar.results.length > 0;
    
    if (!hasContent) return null;

    return (
      <div className="container mx-auto px-4 md:px-8 pb-16">
        {recommendations.results.length > 0 && (
          <TVShowCarousel
            title="🎯 Recommended For You"
            description="Based on this show"
            shows={recommendations.results}
          />
        )}
        {similar.results.length > 0 && (
          <TVShowCarousel
            title="📺 Similar Shows"
            description="Shows like this one"
            shows={similar.results}
          />
        )}
      </div>
    );
  } catch (error) {
    console.error('Error loading similar shows:', error);
    return null;
  }
}

export default async function TVShowPage({ params }: TVShowPageProps) {
  const id = parseInt(params.id);

  if (isNaN(id)) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-dark-950">
      <Suspense fallback={<MovieDetailsSkeleton />}>
        <TVShowContent id={id} />
      </Suspense>

      <Suspense fallback={null}>
        <SimilarTVShowsSection id={id} />
      </Suspense>
    </div>
  );
}
