/**
 * Server-Side Daily Content Cache
 *
 * Uses Next.js `unstable_cache` to store precomputed rail content
 * (genre shuffles, hero trailers, core rails) in the persistent Data Cache.
 *
 * How it works:
 *   - Each cached function receives a date/hour key as an argument.
 *     `unstable_cache` includes serialized arguments in the cache key,
 *     so a new date automatically triggers a cache miss and fresh computation.
 *
 *   - Genre rails use a **daily** key (UTC date) because the deterministic
 *     shuffle already produces one unique order per day. Revalidate = 86 400 s.
 *
 *   - Hero content and core rails use an **hourly** key so trending /
 *     airing-today data stays reasonably fresh. Revalidate = 3 600 s.
 *
 * Benefits:
 *   - 28+ TMDB API calls reduced to 0 on ISR rebuilds within the same period
 *   - Deterministic daily content computed once, served to all users
 *   - Auto-expiration aligned with daily / hourly refresh cycle
 *   - Tag-based manual revalidation via `revalidateTag()` if needed
 */

import { unstable_cache } from 'next/cache';
import type { Movie, TVShow, MovieDetails, TVShowDetails, Credits, VideosResponse, WatchProvidersResponse } from '@/types/movie';
import { dailyShuffleMovies, dailyShuffleTVShows } from './dailyShuffle';
import {
  getMoviesByGenre,
  getTrendingMovies,
  getPopularMovies,
  getTopRatedMovies,
  getNowPlayingMovies,
  getUpcomingMovies,
  getMovieVideos,
  getSimilarMovies,
  getMovieRecommendations,
  getTrendingTVShows,
  getPopularTVShows,
  getTopRatedTVShows,
  getAiringTodayTVShows,
  getOnTheAirTVShows,
  getTVShowVideos,
  discoverTVShows,
  getSimilarTVShows,
  getTVShowRecommendations,
  getMovieDetails,
  getMovieCredits,
  getMovieWatchProviders,
  getTVShowDetails,
  getTVShowCredits,
  getTVShowWatchProviders,
} from './tmdb';
import { freshnessWeightedMovies, freshnessWeightedTVShows } from './freshnessRecommendations';

// ─── Helpers ──────────────────────────────────────────────────

/** UTC date key — rotates at midnight UTC. */
function getDailyKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Hourly key — rotates every UTC hour (for trending / airing-today). */
function getHourlyKey(): string {
  return `${getDailyKey()}-h${new Date().getUTCHours()}`;
}

// ═══════════════════════════════════════════════════════════════
// MOVIE CACHES
// ═══════════════════════════════════════════════════════════════

// ─── Movie Genre Rail ─────────────────────────────────────────

const _cachedMovieGenreRail = unstable_cache(
  async (genreId: number, _dateKey: string): Promise<Movie[]> => {
    const [page1, page2] = await Promise.all([
      getMoviesByGenre(genreId, 1),
      getMoviesByGenre(genreId, 2),
    ]);
    const pool = [...page1.results, ...page2.results];
    return dailyShuffleMovies(pool, genreId, 15);
  },
  ['movie-genre-rail'],
  { revalidate: 86400, tags: ['daily-content', 'movie-genre-rails'] },
);

/** Cached movie genre rail — computes once per day per genre. */
export function getCachedMovieGenreRail(genreId: number): Promise<Movie[]> {
  return _cachedMovieGenreRail(genreId, getDailyKey());
}

// ─── Movie Hero (trending + trailers) ─────────────────────────

export interface MovieHeroItem {
  movie: Movie;
  trailerKey: string | null;
}

const _cachedMovieHero = unstable_cache(
  async (_hourKey: string): Promise<MovieHeroItem[]> => {
    const trending = await getTrendingMovies('day');
    const heroMovies = trending.results.slice(0, 6);

    return Promise.all(
      heroMovies.map(async (movie) => {
        try {
          const videos = await getMovieVideos(movie.id);
          const trailer = videos.results.find(
            (v) => v.site === 'YouTube' && v.type === 'Trailer',
          );
          return { movie, trailerKey: trailer?.key || null };
        } catch {
          return { movie, trailerKey: null };
        }
      }),
    );
  },
  ['movie-hero'],
  { revalidate: 3600, tags: ['hero-content'] },
);

/** Cached movie hero carousel data — refreshes hourly. */
export function getCachedMovieHero(): Promise<MovieHeroItem[]> {
  return _cachedMovieHero(getHourlyKey());
}

// ─── New Releases (now playing + upcoming, de-duplicated) ─────

const _cachedNewReleases = unstable_cache(
  async (_hourKey: string): Promise<Movie[]> => {
    const [nowPlaying, upcoming] = await Promise.all([
      getNowPlayingMovies(),
      getUpcomingMovies(),
    ]);
    const seen = new Set<number>();
    return [...nowPlaying.results, ...upcoming.results]
      .filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      })
      .slice(0, 15);
  },
  ['movie-new-releases'],
  { revalidate: 3600, tags: ['core-rails'] },
);

export function getCachedNewReleases(): Promise<Movie[]> {
  return _cachedNewReleases(getHourlyKey());
}

// ─── Trending Movies (weekly) ─────────────────────────────────

const _cachedTrendingMovies = unstable_cache(
  async (_hourKey: string): Promise<Movie[]> => {
    const trending = await getTrendingMovies('week');
    return trending.results.slice(0, 15);
  },
  ['movie-trending'],
  { revalidate: 3600, tags: ['core-rails'] },
);

export function getCachedTrendingMovies(): Promise<Movie[]> {
  return _cachedTrendingMovies(getHourlyKey());
}

// ─── Popular Movies ───────────────────────────────────────────

const _cachedPopularMovies = unstable_cache(
  async (_hourKey: string): Promise<Movie[]> => {
    const popular = await getPopularMovies();
    return popular.results.slice(0, 15);
  },
  ['movie-popular'],
  { revalidate: 3600, tags: ['core-rails'] },
);

export function getCachedPopularMovies(): Promise<Movie[]> {
  return _cachedPopularMovies(getHourlyKey());
}

// ─── Top Rated Movies ─────────────────────────────────────────

const _cachedTopRatedMovies = unstable_cache(
  async (_hourKey: string): Promise<Movie[]> => {
    const topRated = await getTopRatedMovies();
    return topRated.results.slice(0, 15);
  },
  ['movie-top-rated'],
  { revalidate: 3600, tags: ['core-rails'] },
);

export function getCachedTopRatedMovies(): Promise<Movie[]> {
  return _cachedTopRatedMovies(getHourlyKey());
}

// ═══════════════════════════════════════════════════════════════
// TV SHOW CACHES
// ═══════════════════════════════════════════════════════════════

// ─── TV Genre Rail ────────────────────────────────────────────

const _cachedTVGenreRail = unstable_cache(
  async (genreId: number, _dateKey: string): Promise<TVShow[]> => {
    const [page1, page2] = await Promise.all([
      discoverTVShows({ with_genres: String(genreId), sort_by: 'popularity.desc', page: 1 }),
      discoverTVShows({ with_genres: String(genreId), sort_by: 'popularity.desc', page: 2 }),
    ]);
    const pool = [...page1.results, ...page2.results];
    return dailyShuffleTVShows(pool, genreId, 15);
  },
  ['tv-genre-rail'],
  { revalidate: 86400, tags: ['daily-content', 'tv-genre-rails'] },
);

/** Cached TV genre rail — computes once per day per genre. */
export function getCachedTVGenreRail(genreId: number): Promise<TVShow[]> {
  return _cachedTVGenreRail(genreId, getDailyKey());
}

// ─── TV Hero (trending + trailers) ────────────────────────────

export interface TVHeroItem {
  tvShow: TVShow;
  trailerKey: string | null;
}

const _cachedTVHero = unstable_cache(
  async (_hourKey: string): Promise<TVHeroItem[]> => {
    const trending = await getTrendingTVShows('day');
    const heroShows = trending.results.slice(0, 6);

    return Promise.all(
      heroShows.map(async (tvShow) => {
        try {
          const videos = await getTVShowVideos(tvShow.id);
          const trailer = videos.results.find(
            (v) => v.site === 'YouTube' && v.type === 'Trailer',
          );
          return { tvShow, trailerKey: trailer?.key || null };
        } catch {
          return { tvShow, trailerKey: null };
        }
      }),
    );
  },
  ['tv-hero'],
  { revalidate: 3600, tags: ['hero-content'] },
);

/** Cached TV hero carousel data — refreshes hourly. */
export function getCachedTVHero(): Promise<TVHeroItem[]> {
  return _cachedTVHero(getHourlyKey());
}

// ─── Airing Today ─────────────────────────────────────────────

const _cachedAiringToday = unstable_cache(
  async (_hourKey: string): Promise<TVShow[]> => {
    const airingToday = await getAiringTodayTVShows();
    return airingToday.results.slice(0, 15);
  },
  ['tv-airing-today'],
  { revalidate: 3600, tags: ['core-rails'] },
);

export function getCachedAiringToday(): Promise<TVShow[]> {
  return _cachedAiringToday(getHourlyKey());
}

// ─── Trending TV (weekly) ─────────────────────────────────────

const _cachedTrendingTV = unstable_cache(
  async (_hourKey: string): Promise<TVShow[]> => {
    const trending = await getTrendingTVShows('week');
    return trending.results.slice(0, 15);
  },
  ['tv-trending'],
  { revalidate: 3600, tags: ['core-rails'] },
);

export function getCachedTrendingTV(): Promise<TVShow[]> {
  return _cachedTrendingTV(getHourlyKey());
}

// ─── Popular TV ───────────────────────────────────────────────

const _cachedPopularTV = unstable_cache(
  async (_hourKey: string): Promise<TVShow[]> => {
    const popular = await getPopularTVShows();
    return popular.results.slice(0, 15);
  },
  ['tv-popular'],
  { revalidate: 3600, tags: ['core-rails'] },
);

export function getCachedPopularTV(): Promise<TVShow[]> {
  return _cachedPopularTV(getHourlyKey());
}

// ─── Top Rated TV ─────────────────────────────────────────────

const _cachedTopRatedTV = unstable_cache(
  async (_hourKey: string): Promise<TVShow[]> => {
    const topRated = await getTopRatedTVShows();
    return topRated.results.slice(0, 15);
  },
  ['tv-top-rated'],
  { revalidate: 3600, tags: ['core-rails'] },
);

export function getCachedTopRatedTV(): Promise<TVShow[]> {
  return _cachedTopRatedTV(getHourlyKey());
}

// ─── On The Air ───────────────────────────────────────────────

const _cachedOnTheAirTV = unstable_cache(
  async (_hourKey: string): Promise<TVShow[]> => {
    const onTheAir = await getOnTheAirTVShows();
    return onTheAir.results.slice(0, 15);
  },
  ['tv-on-the-air'],
  { revalidate: 3600, tags: ['core-rails'] },
);

export function getCachedOnTheAirTV(): Promise<TVShow[]> {
  return _cachedOnTheAirTV(getHourlyKey());
}

// ═══════════════════════════════════════════════════════════════
// SIMILARITY POOL CACHES (freshness-weighted)
// ═══════════════════════════════════════════════════════════════

// ─── Similar Movies (cached similarity pool + freshness weighting) ──

export interface WeightedMovieRails {
  recommended: Movie[];
  similar: Movie[];
}

const _cachedSimilarMovies = unstable_cache(
  async (movieId: number, _hourKey: string): Promise<WeightedMovieRails> => {
    const [similar, recommended] = await Promise.all([
      getSimilarMovies(movieId),
      getMovieRecommendations(movieId),
    ]);
    return freshnessWeightedMovies(
      similar.results,
      recommended.results,
      20,
      movieId,
    );
  },
  ['movie-similar-pool'],
  { revalidate: 86400, tags: ['similarity-pools'] },
);

/** Cached freshness-weighted movie recommendations for a given movie. */
export function getCachedSimilarMovies(movieId: number): Promise<WeightedMovieRails> {
  return _cachedSimilarMovies(movieId, getHourlyKey());
}

// ─── Similar TV Shows (cached similarity pool + freshness weighting) ──

export interface WeightedTVRails {
  recommended: TVShow[];
  similar: TVShow[];
}

const _cachedSimilarTVShows = unstable_cache(
  async (tvId: number, _hourKey: string): Promise<WeightedTVRails> => {
    const [similar, recommended] = await Promise.all([
      getSimilarTVShows(tvId),
      getTVShowRecommendations(tvId),
    ]);
    return freshnessWeightedTVShows(
      similar.results,
      recommended.results,
      20,
      tvId,
    );
  },
  ['tv-similar-pool'],
  { revalidate: 86400, tags: ['similarity-pools'] },
);

/** Cached freshness-weighted TV show recommendations for a given show. */
export function getCachedSimilarTVShows(tvId: number): Promise<WeightedTVRails> {
  return _cachedSimilarTVShows(tvId, getHourlyKey());
}

// ═══════════════════════════════════════════════════════════════
// DETAIL PAGE CACHES (Movie & TV Show Details, Credits, etc.)
// ═══════════════════════════════════════════════════════════════

/**
 * Cached movie details page data
 * Fetches all essential data in parallel and caches for 1 hour
 */
const _cachedMovieDetailsData = unstable_cache(
  async (movieId: number, _hourKey: string) => {
    const [details, credits, videos, providers] = await Promise.all([
      getMovieDetails(movieId),
      getMovieCredits(movieId).catch(() => ({ id: movieId, cast: [], crew: [] })),
      getMovieVideos(movieId).catch(() => ({ id: movieId, results: [] })),
      getMovieWatchProviders(movieId).catch(() => ({ id: movieId, results: {} })),
    ]);
    return { details, credits, videos, providers };
  },
  ['movie-details-data'],
  { revalidate: 3600, tags: ['movie-details'] },
);

export function getCachedMovieDetailsData(movieId: number) {
  return _cachedMovieDetailsData(movieId, getHourlyKey());
}

/**
 * Cached TV show details page data
 * Fetches all essential data in parallel and caches for 1 hour
 */
const _cachedTVShowDetailsData = unstable_cache(
  async (tvId: number, _hourKey: string) => {
    const [details, credits, videos, providers] = await Promise.all([
      getTVShowDetails(tvId),
      getTVShowCredits(tvId).catch(() => ({ id: tvId, cast: [], crew: [] })),
      getTVShowVideos(tvId).catch(() => ({ id: tvId, results: [] })),
      getTVShowWatchProviders(tvId).catch(() => ({ id: tvId, results: {} })),
    ]);
    return { details, credits, videos, providers };
  },
  ['tv-details-data'],
  { revalidate: 3600, tags: ['tv-details'] },
);

export function getCachedTVShowDetailsData(tvId: number) {
  return _cachedTVShowDetailsData(tvId, getHourlyKey());
}
