/**
 * Firestore Engagement Service
 *
 * Handles Like / Dislike reactions for movies and TV shows.
 *
 * Collections:
 *   engagement/{mediaType}_{mediaId}          – aggregate counters
 *   engagement/{mediaType}_{mediaId}/reactions/{userId}  – per-user reaction
 */

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  increment,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from './config';

// ============================================
// Types
// ============================================

export type ReactionType = 'like' | 'dislike';

export interface EngagementCounts {
  likes: number;
  dislikes: number;
}

export interface UserReaction {
  reaction: ReactionType;
  createdAt: Timestamp;
}

// ============================================
// Helpers
// ============================================

function engagementDocId(mediaType: 'movie' | 'tv', mediaId: number): string {
  return `${mediaType}_${mediaId}`;
}

// ============================================
// Read Operations
// ============================================

/**
 * Fetch current like/dislike counts for a media item.
 */
export async function getEngagementCounts(
  mediaType: 'movie' | 'tv',
  mediaId: number,
): Promise<EngagementCounts> {
  try {
    const db = getFirebaseDb();
    const docRef = doc(db, 'engagement', engagementDocId(mediaType, mediaId));
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      return { likes: data.likes ?? 0, dislikes: data.dislikes ?? 0 };
    }
    return { likes: 0, dislikes: 0 };
  } catch (error) {
    console.error('[Engagement] Error fetching counts:', error);
    return { likes: 0, dislikes: 0 };
  }
}

/**
 * Subscribe to real-time count updates. Returns an unsubscribe function.
 */
export function subscribeToEngagement(
  mediaType: 'movie' | 'tv',
  mediaId: number,
  onUpdate: (counts: EngagementCounts) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  const docRef = doc(db, 'engagement', engagementDocId(mediaType, mediaId));

  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        onUpdate({ likes: data.likes ?? 0, dislikes: data.dislikes ?? 0 });
      } else {
        onUpdate({ likes: 0, dislikes: 0 });
      }
    },
    (err) => {
      console.error('[Engagement] Snapshot error:', err);
    },
  );
}

/**
 * Get the current user's reaction for a media item (or null).
 */
export async function getUserReaction(
  mediaType: 'movie' | 'tv',
  mediaId: number,
  userId: string,
): Promise<ReactionType | null> {
  try {
    const db = getFirebaseDb();
    const docRef = doc(
      db,
      'engagement',
      engagementDocId(mediaType, mediaId),
      'reactions',
      userId,
    );
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      return (snap.data() as UserReaction).reaction;
    }
    return null;
  } catch (error) {
    console.error('[Engagement] Error fetching user reaction:', error);
    return null;
  }
}

// ============================================
// Write Operations (Transactional)
// ============================================

/**
 * Toggle a reaction for the current user.
 *
 * - If the user has no reaction → set to `reaction`.
 * - If the user already has the same reaction → remove it (un-react).
 * - If the user has the opposite reaction → switch it.
 *
 * Returns the new reaction state (or null if removed).
 */
export async function toggleReaction(
  mediaType: 'movie' | 'tv',
  mediaId: number,
  userId: string,
  reaction: ReactionType,
): Promise<ReactionType | null> {
  const db = getFirebaseDb();
  const parentId = engagementDocId(mediaType, mediaId);
  const countsRef = doc(db, 'engagement', parentId);
  const reactionRef = doc(db, 'engagement', parentId, 'reactions', userId);

  return runTransaction(db, async (tx) => {
    const countsSnap = await tx.get(countsRef);
    const reactionSnap = await tx.get(reactionRef);

    const currentCounts: EngagementCounts = countsSnap.exists()
      ? { likes: countsSnap.data().likes ?? 0, dislikes: countsSnap.data().dislikes ?? 0 }
      : { likes: 0, dislikes: 0 };

    const existingReaction: ReactionType | null = reactionSnap.exists()
      ? (reactionSnap.data() as UserReaction).reaction
      : null;

    if (existingReaction === reaction) {
      // Un-react: remove the reaction
      tx.delete(reactionRef);
      tx.set(countsRef, {
        likes: reaction === 'like' ? Math.max(0, currentCounts.likes - 1) : currentCounts.likes,
        dislikes: reaction === 'dislike' ? Math.max(0, currentCounts.dislikes - 1) : currentCounts.dislikes,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return null;
    }

    if (existingReaction && existingReaction !== reaction) {
      // Switch reaction
      tx.set(reactionRef, { reaction, createdAt: serverTimestamp() });
      tx.set(countsRef, {
        likes:
          reaction === 'like'
            ? currentCounts.likes + 1
            : Math.max(0, currentCounts.likes - 1),
        dislikes:
          reaction === 'dislike'
            ? currentCounts.dislikes + 1
            : Math.max(0, currentCounts.dislikes - 1),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return reaction;
    }

    // New reaction
    tx.set(reactionRef, { reaction, createdAt: serverTimestamp() });
    tx.set(countsRef, {
      likes: reaction === 'like' ? currentCounts.likes + 1 : currentCounts.likes,
      dislikes: reaction === 'dislike' ? currentCounts.dislikes + 1 : currentCounts.dislikes,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return reaction;
  });
}
