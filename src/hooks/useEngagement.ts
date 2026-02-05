'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  subscribeToEngagement,
  subscribeToUserReaction,
  type ReactionType,
  type EngagementCounts,
} from '@/lib/firebase/engagement';

// Re-export types so consumers can import from the hook
export type { ReactionType, EngagementCounts };

// ============================================
// Stable visitor ID (Firebase UID or random guest)
// ============================================

const GUEST_ID_KEY = 'bingebuddy-guest-id';

function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = 'guest_' + crypto.randomUUID();
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

// ============================================
// Session cache (survives SPA navigations)
// ============================================

const CACHE_KEY = 'bingebuddy-engagement-cache';

interface CacheEntry {
  counts: EngagementCounts;
  reaction: ReactionType | null;
}

function getCached(key: string): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    return cache[key] ?? null;
  } catch {
    return null;
  }
}

function setCache(key: string, entry: CacheEntry) {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    const cache = raw ? JSON.parse(raw) : {};
    cache[key] = entry;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* quota exceeded – ignore */ }
}

// ============================================
// API helpers (writes go through Admin SDK)
// ============================================

interface ToggleResponse {
  reaction: ReactionType | null;
  counts: EngagementCounts;
}

async function postToggle(
  mediaType: 'movie' | 'tv',
  mediaId: number,
  visitorId: string,
  reaction: ReactionType,
): Promise<ToggleResponse> {
  const res = await fetch('/api/engagement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mediaType, mediaId, visitorId, reaction }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Polling fallback when Firestore rules block client reads
const POLL_INTERVAL = 5_000;

async function fetchViaAPI(
  mediaType: string,
  mediaId: number,
  visitorId: string,
): Promise<{ counts: EngagementCounts; userReaction: ReactionType | null }> {
  const params = new URLSearchParams({
    mediaType,
    mediaId: String(mediaId),
    visitorId,
  });
  const res = await fetch(`/api/engagement?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ============================================
// Hook
// ============================================

interface UseEngagementOptions {
  mediaType: 'movie' | 'tv';
  mediaId: number;
  userId?: string | null;
  /** Set to false to unsubscribe (IntersectionObserver) */
  isVisible?: boolean;
}

interface UseEngagementReturn {
  counts: EngagementCounts;
  userReaction: ReactionType | null;
  isLoading: boolean;
  isToggling: boolean;
  toggle: (reaction: ReactionType) => Promise<void>;
}

export function useEngagement({
  mediaType,
  mediaId,
  userId,
  isVisible = true,
}: UseEngagementOptions): UseEngagementReturn {
  const visitorId = userId || (typeof window !== 'undefined' ? getOrCreateGuestId() : '');
  const cacheKey = `${mediaType}_${mediaId}`;

  // Initialise from session cache for instant paint
  const cached = typeof window !== 'undefined' ? getCached(cacheKey) : null;

  const [counts, setCounts] = useState<EngagementCounts>(
    cached?.counts ?? { likes: 0, dislikes: 0 },
  );
  const [userReaction, setUserReaction] = useState<ReactionType | null>(
    cached?.reaction ?? null,
  );
  const [isLoading, setIsLoading] = useState(!cached);
  const [isToggling, setIsToggling] = useState(false);
  const [usePolling, setUsePolling] = useState(false);

  // Refs for stable optimistic rollback
  const countsRef = useRef(counts);
  countsRef.current = counts;
  const reactionRef = useRef(userReaction);
  reactionRef.current = userReaction;

  // ─── Real-time Firestore subscriptions ───────────────────────
  useEffect(() => {
    if (!visitorId || !isVisible || usePolling) return;

    let cancelled = false;
    let errCount = 0;

    const unsubCounts = subscribeToEngagement(
      mediaType,
      mediaId,
      (next) => {
        if (cancelled) return;
        setCounts(next);
        setIsLoading(false);
        setCache(cacheKey, { counts: next, reaction: reactionRef.current });
      },
      () => {
        errCount++;
        if (errCount >= 1 && !cancelled) setUsePolling(true);
      },
    );

    const unsubReaction = subscribeToUserReaction(
      mediaType,
      mediaId,
      visitorId,
      (next) => {
        if (cancelled) return;
        setUserReaction(next);
        setIsLoading(false);
        setCache(cacheKey, { counts: countsRef.current, reaction: next });
      },
      () => {
        errCount++;
        if (errCount >= 1 && !cancelled) setUsePolling(true);
      },
    );

    return () => {
      cancelled = true;
      unsubCounts();
      unsubReaction();
    };
  }, [mediaType, mediaId, visitorId, isVisible, usePolling, cacheKey]);

  // ─── Polling fallback (if Firestore rules block reads) ───────
  useEffect(() => {
    if (!visitorId || !isVisible || !usePolling) return;

    let cancelled = false;

    async function poll() {
      try {
        const data = await fetchViaAPI(mediaType, mediaId, visitorId);
        if (cancelled) return;
        setCounts(data.counts);
        setUserReaction(data.userReaction);
        setIsLoading(false);
        setCache(cacheKey, { counts: data.counts, reaction: data.userReaction });
      } catch { /* network error – try again next interval */ }
    }

    poll();
    const timer = setInterval(poll, POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [mediaType, mediaId, visitorId, isVisible, usePolling, cacheKey]);

  // ─── Toggle (optimistic + server sync) ───────────────────────
  const toggle = useCallback(
    async (reaction: ReactionType) => {
      if (isToggling || !visitorId) return;
      setIsToggling(true);

      const prev = {
        counts: { ...countsRef.current },
        reaction: reactionRef.current,
      };

      // Optimistic next state
      let nextReaction: ReactionType | null;
      const nextCounts = { ...prev.counts };

      if (prev.reaction === reaction) {
        // Un-react
        nextReaction = null;
        if (reaction === 'like') nextCounts.likes = Math.max(0, nextCounts.likes - 1);
        else nextCounts.dislikes = Math.max(0, nextCounts.dislikes - 1);
      } else if (prev.reaction && prev.reaction !== reaction) {
        // Switch
        nextReaction = reaction;
        if (reaction === 'like') {
          nextCounts.likes += 1;
          nextCounts.dislikes = Math.max(0, nextCounts.dislikes - 1);
        } else {
          nextCounts.dislikes += 1;
          nextCounts.likes = Math.max(0, nextCounts.likes - 1);
        }
      } else {
        // New
        nextReaction = reaction;
        if (reaction === 'like') nextCounts.likes += 1;
        else nextCounts.dislikes += 1;
      }

      // Apply immediately
      setUserReaction(nextReaction);
      setCounts(nextCounts);

      try {
        // Persist via Admin SDK API
        const result = await postToggle(mediaType, mediaId, visitorId, reaction);
        // Reconcile with server truth (onSnapshot will also deliver this,
        // but this ensures immediate consistency even if snapshots are delayed)
        setCounts(result.counts);
        setUserReaction(result.reaction);
        setCache(cacheKey, { counts: result.counts, reaction: result.reaction });
      } catch (err) {
        console.error('[useEngagement] toggle failed, rolling back:', err);
        setUserReaction(prev.reaction);
        setCounts(prev.counts);
      } finally {
        setIsToggling(false);
      }
    },
    [mediaType, mediaId, visitorId, isToggling, cacheKey],
  );

  return { counts, userReaction, isLoading, isToggling, toggle };
}
