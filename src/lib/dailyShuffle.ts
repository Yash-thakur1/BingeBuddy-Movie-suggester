/**
 * Daily Smart Shuffle
 *
 * Produces a curated, deterministic daily lineup for genre rails.
 * Every user sees the same order on the same day; content refreshes
 * automatically at midnight UTC.
 *
 * Freshness weighting model:
 *   - Recent (0-2 years):  base weight × 3.0  → ~50 % of slots
 *   - Mid-age (2-8 years): base weight × 1.8  → ~35 % of slots
 *   - Classic (8+ years):  base weight × 0.6  → ~15 % of slots
 *
 * Within each tier, popularity and vote average further differentiate items.
 * A date-seeded PRNG injects controlled randomness so the lineup feels
 * fresh each day without chaotic jumps.
 */

import { Movie, TVShow } from '@/types/movie';

// ─── Date-seeded PRNG (Mulberry32) ────────────────────────────

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Daily seed — same value for every caller on a given UTC day. */
function getDailySeed(genreId: number): number {
  const today = new Date();
  const dayKey = today.getUTCFullYear() * 10000 + (today.getUTCMonth() + 1) * 100 + today.getUTCDate();
  // Mix the genre id into the seed so different genre rails get different shuffles
  return dayKey * 31 + genreId;
}

// ─── Freshness weight calculator ──────────────────────────────

interface Weighted<T> {
  item: T;
  weight: number;
}

function computeWeight(
  releaseDate: string | undefined,
  popularity: number,
  voteAverage: number,
  voteCount: number,
): number {
  const now = new Date();
  const year = releaseDate ? parseInt(releaseDate.substring(0, 4), 10) : now.getFullYear() - 5;
  const age = now.getFullYear() - year;

  // Freshness multiplier
  let freshness: number;
  if (age <= 2) {
    freshness = 3.0;
  } else if (age <= 8) {
    freshness = 1.8;
  } else {
    freshness = 0.6;
  }

  // Popularity score (log-scaled to tame outliers, 0–1 range approx)
  const popScore = Math.min(Math.log10(Math.max(popularity, 1)) / 4, 1);

  // Quality bonus for high-rated films with sufficient votes
  const qualityBonus = voteCount >= 100 && voteAverage >= 7 ? 0.3 : 0;

  // Composite weight
  return freshness * (0.4 + 0.4 * popScore + 0.2 * (voteAverage / 10) + qualityBonus);
}

// ─── Weighted shuffle (Fisher-Yates with bias) ────────────────

function weightedShuffle<T>(items: Weighted<T>[], rng: () => number): T[] {
  // Sort by weight descending first to give heavy items a head-start,
  // then apply controlled random swaps within neighbourhoods
  const arr = [...items].sort((a, b) => b.weight - a.weight);

  // Fisher-Yates with positional bias: items can only move ±windowSize positions
  const windowSize = Math.max(4, Math.floor(arr.length * 0.35));
  for (let i = arr.length - 1; i > 0; i--) {
    const lo = Math.max(0, i - windowSize);
    const j = lo + Math.floor(rng() * (i - lo + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr.map((w) => w.item);
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Apply daily smart shuffle to a list of movies for a genre rail.
 *
 * @param movies  Raw movie list from TMDB (ideally 30-40 items from 2 pages)
 * @param genreId Genre ID used to seed the shuffle (different genre = different order)
 * @param limit   Number of items to return (default 15)
 */
export function dailyShuffleMovies(
  movies: Movie[],
  genreId: number,
  limit: number = 15,
): Movie[] {
  if (movies.length === 0) return [];

  const rng = mulberry32(getDailySeed(genreId));

  // De-duplicate by ID
  const seen = new Set<number>();
  const unique = movies.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  // Compute weights
  const weighted: Weighted<Movie>[] = unique.map((m) => ({
    item: m,
    weight: computeWeight(m.release_date, m.popularity, m.vote_average, m.vote_count),
  }));

  // Shuffle and slice
  return weightedShuffle(weighted, rng).slice(0, limit);
}

/**
 * Apply daily smart shuffle to a list of TV shows for a genre rail.
 */
export function dailyShuffleTVShows(
  shows: TVShow[],
  genreId: number,
  limit: number = 15,
): TVShow[] {
  if (shows.length === 0) return [];

  const rng = mulberry32(getDailySeed(genreId));

  const seen = new Set<number>();
  const unique = shows.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  const weighted: Weighted<TVShow>[] = unique.map((s) => ({
    item: s,
    weight: computeWeight(s.first_air_date, s.popularity, s.vote_average, s.vote_count),
  }));

  return weightedShuffle(weighted, rng).slice(0, limit);
}
