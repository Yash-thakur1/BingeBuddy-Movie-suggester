import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getImageUrl,
  getMainTrailer,
} from '@/lib/tmdb';
import { getCachedMovieDetailsData } from '@/lib/serverCache';
import { MovieDetailsSkeleton } from '@/components/ui';
import { OptimizedMoviePage } from './OptimizedMoviePage';
import { MovieSchema, BreadcrumbSchema } from '@/components/seo';
import { Crew } from '@/types/movie';

const SITE_URL = 'https://www.bingebuddy.in';

interface MoviePageProps {
  params: { id: string };
}

// Generate metadata for SEO
export async function generateMetadata({ params }: MoviePageProps): Promise<Metadata> {
  try {
    const { details: movie } = await getCachedMovieDetailsData(parseInt(params.id));
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
  // Fetch all data in parallel using cached function (single API call bundle)
  const { details, credits, videos, providers } = await getCachedMovieDetailsData(id);
  
  const trailer = getMainTrailer(videos);
  const results = providers.results || {};
  const watchProviders = (results as any).US || (results as any).IN || 
    Object.values(results)[0] || null;

  const director = credits.crew?.find((c: Crew) => c.job === 'Director');
  const genreNames = details.genres?.map((g: { name: string }) => g.name) || [];
  const durationISO = details.runtime ? `PT${details.runtime}M` : undefined;

  return (
    <>
      <MovieSchema
        name={details.title}
        description={details.overview || ''}
        image={getImageUrl(details.poster_path, 'w500') || undefined}
        datePublished={details.release_date}
        director={director?.name}
        genre={genreNames}
        rating={details.vote_average}
        ratingCount={details.vote_count}
        duration={durationISO}
        url={`${SITE_URL}/movie/${id}`}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'Movies', url: `${SITE_URL}/discover` },
          { name: details.title, url: `${SITE_URL}/movie/${id}` },
        ]}
      />
      <OptimizedMoviePage
        movieId={id}
        initialDetails={details}
        initialCredits={credits}
        initialTrailer={trailer}
        initialProviders={watchProviders}
      />
    </>
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
