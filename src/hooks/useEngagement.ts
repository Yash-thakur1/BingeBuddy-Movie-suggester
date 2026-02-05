'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================
// Types
// ============================================

export type ReactionType = 'like' | 'dislike';

export interface EngagementCounts {
  likes: number;
  dislikes: number;
}

// ============================================
// Stable visitor ID (auth UID for logged-in, random for guests)
// ============================================

const GUEST_ID_KEY = 'flixora-guest-id';

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
// API helpers
// ============================================

interface APIResponse {
  counts: EngagementCounts;
  userReaction: ReactionType | null;
}

interface ToggleResponse {
  reaction: ReactionType | null;
  counts: EngagementCounts;
}

async function fetchEngagement(
  mediaType: 'movie' | 'tv',
  mediaId: number,
  visitorId: string,
): Promise<APIResponse> {
  try {
    const params = new URLSearchParams({
      mediaType,
      mediaId: String(mediaId),
      visitorId,
    });
    const res = await fetch(`/api/engagement?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[useEngagement] fetch failed:', err);
    return { counts: { likes: 0, dislikes: 0 }, userReaction: null };
  }
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
  return await res.json();
}

// ============================================
// Hook
// ============================================

interface UseEngagementOptions {
  mediaType: 'movie' | 'tv';
  mediaId: number;
  userId?: string | null; // Firebase UID — null means guest
}

interface UseEngagementReturn {
  counts: EngagementCounts;
  userReaction: ReactionType | null;
  isLoading: boolean;
  isToggling: boolean;
  toggle: (reaction: ReactionType) => Promise<void>;
}

/** Polling interval for live counter refresh (ms) */
const POLL_INTERVAL = 8_000;

export function useEngagement({
  mediaType,
  mediaId,
  userId,
}: UseEngagementOptions): UseEngagementReturn {
  const [counts, setCounts] = useState<EngagementCounts>({ likes: 0, dislikes: 0 });
  const [userReaction, setUserReaction] = useState<ReactionType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  // Stable visitor ID: Firebase UID when logged in, random guest ID otherwise
  const visitorId = userId || (typeof window !== 'undefined' ? getOrCreateGuestId() : '');

  // Refs for optimistic rollback
  const countsRef = useRef(counts);
  countsRef.current = counts;
  const userReactionRef = useRef(userReaction);
  userReactionRef.current = userReaction;

  // ---- initial fetch + polling for live updates ----
  useEffect(() => {
    if (!visitorId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load() {
      const data = await fetchEngagement(mediaType, mediaId, visitorId);
      if (!cancelled) {
        setCounts(data.counts);
        setUserReaction(data.userReaction);
        setIsLoading(false);
      }
    }

    // Initial load
    load();

    // Poll every few seconds so other users' reactions appear live
    timer = setInterval(() => {
      if (!cancelled) load();
    }, POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [mediaType, mediaId, visitorId]);

  // ---- toggle (optimistic UI) ----
  const toggle = useCallback(
    async (reaction: ReactionType) => {
      if (isToggling || !visitorId) return;
      setIsToggling(true);

      const prevCounts = { ...countsRef.current };
      const prevReaction = userReactionRef.current;

      // Compute optimistic next state
      let nextReaction: ReactionType | null;
      const nextCounts = { ...prevCounts };

      if (prevReaction === reaction) {
        nextReaction = null;
        if (reaction === 'like') nextCounts.likes = Math.max(0, nextCounts.likes - 1);
        else nextCounts.dislikes = Math.max(0, nextCounts.dislikes - 1);
      } else if (prevReaction && prevReaction !== reaction) {
        nextReaction = reaction;
        if (reaction === 'like') {
          nextCounts.likes += 1;
          nextCounts.dislikes = Math.max(0, nextCounts.dislikes - 1);
        } else {
          nextCounts.dislikes += 1;
          nextCounts.likes = Math.max(0, nextCounts.likes - 1);
        }
      } else {
        nextReaction = reaction;
        if (reaction === 'like') nextCounts.likes += 1;
        else nextCounts.dislikes += 1;
      }

      // Apply optimistic update
      setUserReaction(nextReaction);
      setCounts(nextCounts);

      try {
        // Persist via API route → Admin SDK (bypasses Firestore security rules)
        const result = await postToggle(mediaType, mediaId, visitorId, reaction);
        // Sync with server truth
        setCounts(result.counts);
        setUserReaction(result.reaction);
      } catch (error) {
        console.error('[useEngagement] toggle failed, rolling back:', error);
        setUserReaction(prevReaction);
        setCounts(prevCounts);
      } finally {
        setIsToggling(false);
      }
    },
    [mediaType, mediaId, visitorId, isToggling],
  );

  return { counts, userReaction, isLoading, isToggling, toggle };
}
