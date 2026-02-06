import { MetadataRoute } from 'next';
import {
  getTrendingMovies,
  getPopularMovies,
  getTopRatedMovies,
  getTrendingTVShows,
  getPopularTVShows,
  getTopRatedTVShows,
} from '@/lib/tmdb';

const SITE_URL = 'https://www.bingebuddy.in';

export const revalidate = 3600; // Regenerate sitemap every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Static pages with priorities
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/discover`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/search`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/recommendations`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/watchlist`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/tv`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/tv/discover`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/tv/recommendations`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];

  // Fetch popular/trending content for dynamic URLs
  let movieUrls: MetadataRoute.Sitemap = [];
  let tvUrls: MetadataRoute.Sitemap = [];

  try {
    const [trending, popular, topRated] = await Promise.all([
      getTrendingMovies('week'),
      getPopularMovies(),
      getTopRatedMovies(),
    ]);

    // Combine and dedupe movie IDs
    const movieIds = new Set<number>();
    [...trending.results, ...popular.results, ...topRated.results].forEach((m) =>
      movieIds.add(m.id)
    );

    movieUrls = Array.from(movieIds).map((id) => ({
      url: `${SITE_URL}/movie/${id}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch (error) {
    console.error('Sitemap: failed to fetch movies', error);
  }

  try {
    const [trendingTV, popularTV, topRatedTV] = await Promise.all([
      getTrendingTVShows('week'),
      getPopularTVShows(),
      getTopRatedTVShows(),
    ]);

    const tvIds = new Set<number>();
    [...trendingTV.results, ...popularTV.results, ...topRatedTV.results].forEach((s) =>
      tvIds.add(s.id)
    );

    tvUrls = Array.from(tvIds).map((id) => ({
      url: `${SITE_URL}/tv/${id}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  } catch (error) {
    console.error('Sitemap: failed to fetch TV shows', error);
  }

  return [...staticPages, ...movieUrls, ...tvUrls];
}
