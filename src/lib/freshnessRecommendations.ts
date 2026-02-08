/**
 * Freshness-Weighted Recommendation Engine
 *
 * Enhances similar/recommended content by classifying candidates into age
 * buckets and selecting a balanced mix that feels fresh yet curated.
 *
 * Age Buckets:
 *   • Recent    (0–4 years)  →  50 % of final list
 *   • Mid-era   (4–8 years)  →  35 % of final list
 *   • Classics  (>8 years)   →  15 % of final list
 *
 * If a bucket has fewer titles than its allocation, surplus slots are
 * redistributed proportionally across remaining buckets.
 *
 * Within each bucket, items are scored by a composite of vote average,
 * vote count, and popularity, then shuffled with light randomisation to
 * avoid identical orderings across page loads while keeping quality high.
 *
 * Works in both server and client contexts (no browser APIs used).
 */

import type { Movie, TVShow } from '@/types/movie';

// ─── Configuration ────────────────────────────────────────────

/** Target distribution across age buckets (must sum to 1). */
const BUCKET_WEIGHTS = {
  recent: 0.50,
  midEra: 0.35,
  classic: 0.15,
} as const;

/** Age boundaries in years. */
const AGE_THRESHOLDS = {
  recentMax: 4,   // 0–4 years
  midEraMax: 8,   // 4–8 years
  // > 8 years → classic
} as const;

// ─── Helpers ──────────────────────────────────────────────────

interface ScoredItem<T> {
  item: T;
  score: number;
}

/** Compute a composite quality score for ranking within a bucket. */
function qualityScore(
  voteAverage: number,
  voteCount: number,
  popularity: number,
): number {
  // Bayesian average with a prior of 6.0 across 100 votes
  const bayesian = (voteCount * voteAverage + 100 * 6) / (voteCount + 100);
  // Log-scaled popularity (tame outliers)
  const popScore = Math.log10(Math.max(popularity, 1)) / 4;
  // Composite: 60 % quality, 40 % popularity
  return 0.6 * (bayesian / 10) + 0.4 * Math.min(popScore, 1);
}

/** Compute age of a title in years from a date string (YYYY-MM-DD). */
function ageInYears(dateStr: string | undefined | null): number {
  if (!dateStr) return 10; // treat unknown dates as classics
  const year = parseInt(dateStr.substring(0, 4), 10);
  if (isNaN(year)) return 10;
  return new Date().getFullYear() - year;
}

/**
 * Light shuffle that preserves quality ordering but injects variety.
 * Swaps neighbours within a small window so top items stay near the top.
 */
function gentleShuffle<T>(items: T[]): T[] {
  const arr = [...items];
  const window = Math.max(2, Math.floor(arr.length * 0.3));
  for (let i = arr.length - 1; i > 0; i--) {
    const lo = Math.max(0, i - window);
    const j = lo + Math.floor(Math.random() * (i - lo + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Core Engine ──────────────────────────────────────────────

interface BucketedPool<T> {
  recent: ScoredItem<T>[];
  midEra: ScoredItem<T>[];
  classic: ScoredItem<T>[];
}

/** Classify items into age buckets and score them. */
function classifyAndScore<T>(
  items: T[],
  getDate: (item: T) => string | undefined | null,
  getVoteAvg: (item: T) => number,
  getVoteCount: (item: T) => number,
  getPopularity: (item: T) => number,
): BucketedPool<T> {
  const recent: ScoredItem<T>[] = [];
  const midEra: ScoredItem<T>[] = [];
  const classic: ScoredItem<T>[] = [];

  for (const item of items) {
    const age = ageInYears(getDate(item));
    const score = qualityScore(getVoteAvg(item), getVoteCount(item), getPopularity(item));
    const scored = { item, score };

    if (age <= AGE_THRESHOLDS.recentMax) {
      recent.push(scored);
    } else if (age <= AGE_THRESHOLDS.midEraMax) {
      midEra.push(scored);
    } else {
      classic.push(scored);
    }
  }

  // Sort each bucket by score descending
  recent.sort((a, b) => b.score - a.score);
  midEra.sort((a, b) => b.score - a.score);
  classic.sort((a, b) => b.score - a.score);

  return { recent, midEra, classic };
}

/**
 * Select `limit` items from a bucketed pool using the weighted distribution.
 * If a bucket can't fill its quota, surplus is redistributed proportionally.
 */
function selectFromBuckets<T>(pool: BucketedPool<T>, limit: number): T[] {
  // Calculate initial allocations
  let recentSlots = Math.round(limit * BUCKET_WEIGHTS.recent);
  let midEraSlots = Math.round(limit * BUCKET_WEIGHTS.midEra);
  let classicSlots = limit - recentSlots - midEraSlots; // remainder absorbs rounding

  // Redistribute surplus from under-populated buckets
  const redistribute = () => {
    let surplus = 0;
    let eligibleWeight = 0;

    // Detect surplus
    if (pool.recent.length < recentSlots) {
      surplus += recentSlots - pool.recent.length;
      recentSlots = pool.recent.length;
    } else {
      eligibleWeight += BUCKET_WEIGHTS.recent;
    }
    if (pool.midEra.length < midEraSlots) {
      surplus += midEraSlots - pool.midEra.length;
      midEraSlots = pool.midEra.length;
    } else {
      eligibleWeight += BUCKET_WEIGHTS.midEra;
    }
    if (pool.classic.length < classicSlots) {
      surplus += classicSlots - pool.classic.length;
      classicSlots = pool.classic.length;
    } else {
      eligibleWeight += BUCKET_WEIGHTS.classic;
    }

    if (surplus === 0 || eligibleWeight === 0) return;

    // Distribute surplus proportionally
    const addToRecent = pool.recent.length > recentSlots
      ? Math.round(surplus * (BUCKET_WEIGHTS.recent / eligibleWeight))
      : 0;
    const addToMidEra = pool.midEra.length > midEraSlots
      ? Math.round(surplus * (BUCKET_WEIGHTS.midEra / eligibleWeight))
      : 0;
    const addToClassic = surplus - addToRecent - addToMidEra;

    recentSlots = Math.min(recentSlots + addToRecent, pool.recent.length);
    midEraSlots = Math.min(midEraSlots + addToMidEra, pool.midEra.length);
    classicSlots = Math.min(classicSlots + addToClassic, pool.classic.length);
  };

  // Run redistribution twice to handle cascading shortfalls
  redistribute();
  redistribute();

  // Pick top items from each bucket, apply gentle shuffle
  const recentPicks = gentleShuffle(pool.recent.slice(0, recentSlots).map((s) => s.item));
  const midEraPicks = gentleShuffle(pool.midEra.slice(0, midEraSlots).map((s) => s.item));
  const classicPicks = gentleShuffle(pool.classic.slice(0, classicSlots).map((s) => s.item));

  // Interleave: recent → midEra → classic, cycling to create natural variety
  const result: T[] = [];
  const sources = [recentPicks, midEraPicks, classicPicks];
  const indices = [0, 0, 0];

  while (result.length < limit) {
    let added = false;
    for (let s = 0; s < sources.length; s++) {
      if (indices[s] < sources[s].length) {
        result.push(sources[s][indices[s]++]);
        added = true;
        if (result.length >= limit) break;
      }
    }
    if (!added) break;
  }

  return result;
}

// ─── De-duplicate across multiple source lists ────────────────

function deduplicateById<T extends { id: number }>(...lists: T[][]): T[] {
  const seen = new Set<number>();
  const result: T[] = [];
  for (const list of lists) {
    for (const item of list) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        result.push(item);
      }
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API — Movies
// ═══════════════════════════════════════════════════════════════

/**
 * Build a freshness-weighted recommendation list from TMDB similar + recommended pools.
 *
 * @param similar     Results from TMDB `/movie/{id}/similar`
 * @param recommended Results from TMDB `/movie/{id}/recommendations`
 * @param limit       Number of items per rail (default 20)
 * @param excludeId   Movie ID to exclude (the current movie)
 */
export function freshnessWeightedMovies(
  similar: Movie[],
  recommended: Movie[],
  limit: number = 20,
  excludeId?: number,
): { recommended: Movie[]; similar: Movie[] } {
  // Merge pools, de-duplicate, exclude current movie
  const allCandidates = deduplicateById(recommended, similar)
    .filter((m) => m.id !== excludeId);

  // Separate back into "recommended" (TMDB's picks) and "similar" (genre-based)
  const recIds = new Set(recommended.map((m) => m.id));
  const simOnly = allCandidates.filter((m) => !recIds.has(m.id));
  const recPool = allCandidates.filter((m) => recIds.has(m.id));

  // Classify and select for each rail
  const recBuckets = classifyAndScore(
    recPool,
    (m) => m.release_date,
    (m) => m.vote_average,
    (m) => m.vote_count,
    (m) => m.popularity,
  );
  const simBuckets = classifyAndScore(
    simOnly.length > 0 ? simOnly : allCandidates,
    (m) => m.release_date,
    (m) => m.vote_average,
    (m) => m.vote_count,
    (m) => m.popularity,
  );

  return {
    recommended: selectFromBuckets(recBuckets, Math.min(limit, recPool.length || allCandidates.length)),
    similar: selectFromBuckets(simBuckets, Math.min(limit, simOnly.length || allCandidates.length)),
  };
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API — TV Shows
// ═══════════════════════════════════════════════════════════════

/**
 * Build a freshness-weighted recommendation list for TV shows.
 *
 * @param similar     Results from TMDB `/tv/{id}/similar`
 * @param recommended Results from TMDB `/tv/{id}/recommendations`
 * @param limit       Number of items per rail (default 20)
 * @param excludeId   TV show ID to exclude (the current show)
 */
export function freshnessWeightedTVShows(
  similar: TVShow[],
  recommended: TVShow[],
  limit: number = 20,
  excludeId?: number,
): { recommended: TVShow[]; similar: TVShow[] } {
  const allCandidates = deduplicateById(recommended, similar)
    .filter((s) => s.id !== excludeId);

  const recIds = new Set(recommended.map((s) => s.id));
  const simOnly = allCandidates.filter((s) => !recIds.has(s.id));
  const recPool = allCandidates.filter((s) => recIds.has(s.id));

  const recBuckets = classifyAndScore(
    recPool,
    (s) => s.first_air_date,
    (s) => s.vote_average,
    (s) => s.vote_count,
    (s) => s.popularity,
  );
  const simBuckets = classifyAndScore(
    simOnly.length > 0 ? simOnly : allCandidates,
    (s) => s.first_air_date,
    (s) => s.vote_average,
    (s) => s.vote_count,
    (s) => s.popularity,
  );

  return {
    recommended: selectFromBuckets(recBuckets, Math.min(limit, recPool.length || allCandidates.length)),
    similar: selectFromBuckets(simBuckets, Math.min(limit, simOnly.length || allCandidates.length)),
  };
}
