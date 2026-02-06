import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getMovieDetails,
  getMovieCredits,
  getMovieVideos,
  getMovieWatchProviders,
  getImageUrl,
  getMainTrailer,
} from '@/lib/tmdb';
import { MovieDetailsSkeleton } from '@/components/ui';
import { OptimizedMoviePage } from './OptimizedMoviePage';
import { Credits, Cast, Crew, WatchProviderCountry } from '@/types/movie';

interface MoviePageProps {
  params: { id: string };
}

// Generate metadata for SEO
export async function generateMetadata({ params }: MoviePageProps): Promise<Metadata> {
  try {
    const movie = await getMovieDetails(parseInt(params.id));
    const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 'TBA';
    const title = `${movie.title} (${year})`;
    const description = movie.overview
      ? movie.overview.length > 155
        ? movie.overview.substring(0, 152) + '...'
        : movie.overview
      : `Watch ${movie.title} — find ratings, trailers, cast, and streaming availability on BingeBuddy.`;
    const posterUrl = getImageUrl(movie.poster_path, 'w500');

    return {
      title,
      description,
      alternates: {
        canonical: `/movie/${params.id}`,
      },
      openGraph: {
        title: `${movie.title} (${year}) - Movie Details & Trailers`,
        description,
        url: `/movie/${params.id}`,
        type: 'video.movie',
        images: posterUrl ? [{ url: posterUrl, width: 500, height: 750, alt: movie.title }] : [],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${movie.title} (${year})`,
        description,
        images: posterUrl ? [posterUrl] : [],
      },
    };
  } catch {
    return { title: 'Movie Not Found' };
  }
}

async function MovieContent({ id }: { id: number }) {
  // Fetch essential data first (details only for fast initial render)
  const details = await getMovieDetails(id);
  
  // Fetch secondary data with error handling
  let credits: Credits = { id, cast: [] as Cast[], crew: [] as Crew[] };
  let trailer: string | null = null;
  let watchProviders: WatchProviderCountry | null = null;
  
  try {
    const [creditsResult, videos, providers] = await Promise.all([
      getMovieCredits(id),
      getMovieVideos(id),
      getMovieWatchProviders(id),
    ]);
    credits = creditsResult;
    trailer = getMainTrailer(videos);
    watchProviders = providers.results?.US || providers.results?.IN || 
      Object.values(providers.results || {})[0] || null;
  } catch (error) {
    console.error('Error loading credits/videos/providers:', error);
  }

  return (
    <OptimizedMoviePage
      movieId={id}
      initialDetails={details}
      initialCredits={credits}
      initialTrailer={trailer}
      initialProviders={watchProviders}
    />
  );
}

export default async function MoviePage({ params }: MoviePageProps) {
  const id = parseInt(params.id);

  if (isNaN(id)) {
    notFound();
  }

  return (
    <Suspense fallback={<MovieDetailsSkeleton />}>
      <MovieContent id={id} />
    </Suspense>
  );
}
