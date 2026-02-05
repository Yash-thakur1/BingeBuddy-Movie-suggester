'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getEngagementCounts,
  getUserReaction,
  toggleReaction,
  subscribeToEngagement,
  type ReactionType,
  type EngagementCounts,
} from '@/lib/firebase/engagement';

// ============================================
// localStorage helpers for guest users
// ============================================

const GUEST_REACTIONS_KEY = 'flixora-guest-reactions';

interface GuestReactions {
  [docId: string]: ReactionType;
}

function getGuestReactions(): GuestReactions {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(GUEST_REACTIONS_KEY) || '{}');
  } catch {
    return {};
  }
}

function setGuestReaction(mediaType: 'movie' | 'tv', mediaId: number, reaction: ReactionType | null) {
  const key = `${mediaType}_${mediaId}`;
  const reactions = getGuestReactions();
  if (reaction) {
    reactions[key] = reaction;
  } else {
    delete reactions[key];
  }
  localStorage.setItem(GUEST_REACTIONS_KEY, JSON.stringify(reactions));
}

function getGuestReaction(mediaType: 'movie' | 'tv', mediaId: number): ReactionType | null {
  const key = `${mediaType}_${mediaId}`;
  return getGuestReactions()[key] ?? null;
}

// ============================================
// Hook
// ============================================

interface UseEngagementOptions {
  mediaType: 'movie' | 'tv';
  mediaId: number;
  userId?: string | null; // null → guest
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
}: UseEngagementOptions): UseEngagementReturn {
  const [counts, setCounts] = useState<EngagementCounts>({ likes: 0, dislikes: 0 });
  const [userReaction, setUserReaction] = useState<ReactionType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  // Keep latest values in refs for the toggle callback
  const countsRef = useRef(counts);
  countsRef.current = counts;
  const userReactionRef = useRef(userReaction);
  userReactionRef.current = userReaction;

  // ---- initial fetch + real-time subscription ----
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setIsLoading(true);

      // Fetch counts
      const initialCounts = await getEngagementCounts(mediaType, mediaId);
      if (!cancelled) setCounts(initialCounts);

      // Fetch user reaction
      if (userId) {
        const existing = await getUserReaction(mediaType, mediaId, userId);
        if (!cancelled) setUserReaction(existing);
      } else {
        // Guest: read from localStorage
        const guestReaction = getGuestReaction(mediaType, mediaId);
        if (!cancelled) setUserReaction(guestReaction);
      }

      if (!cancelled) setIsLoading(false);
    }

    init();

    // Real-time listener for counters so other users' reactions appear live
    const unsub = subscribeToEngagement(mediaType, mediaId, (updated) => {
      if (!cancelled) setCounts(updated);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [mediaType, mediaId, userId]);

  // ---- toggle reaction (optimistic) ----
  const toggle = useCallback(
    async (reaction: ReactionType) => {
      if (isToggling) return;
      setIsToggling(true);

      const prevCounts = { ...countsRef.current };
      const prevReaction = userReactionRef.current;

      // Compute optimistic next state
      let nextReaction: ReactionType | null;
      const nextCounts = { ...prevCounts };

      if (prevReaction === reaction) {
        // Un-react
        nextReaction = null;
        if (reaction === 'like') nextCounts.likes = Math.max(0, nextCounts.likes - 1);
        else nextCounts.dislikes = Math.max(0, nextCounts.dislikes - 1);
      } else if (prevReaction && prevReaction !== reaction) {
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

      // Apply optimistic update immediately
      setUserReaction(nextReaction);
      setCounts(nextCounts);

      try {
        if (userId) {
          // Persist to Firestore
          await toggleReaction(mediaType, mediaId, userId, reaction);
        } else {
          // Guest: persist to localStorage only
          setGuestReaction(mediaType, mediaId, nextReaction);
        }
      } catch (error) {
        console.error('[useEngagement] toggle failed, rolling back:', error);
        // Rollback
        setUserReaction(prevReaction);
        setCounts(prevCounts);
      } finally {
        setIsToggling(false);
      }
    },
    [mediaType, mediaId, userId, isToggling],
  );

  return { counts, userReaction, isLoading, isToggling, toggle };
}
