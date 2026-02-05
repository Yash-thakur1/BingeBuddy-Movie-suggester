import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

// ============================================
// Types
// ============================================

type ReactionType = 'like' | 'dislike';

interface EngagementCounts {
  likes: number;
  dislikes: number;
}

// ============================================
// Helpers
// ============================================

function docId(mediaType: string, mediaId: number) {
  return `${mediaType}_${mediaId}`;
}

function isValidMediaType(v: unknown): v is 'movie' | 'tv' {
  return v === 'movie' || v === 'tv';
}

// ============================================
// GET  /api/engagement?mediaType=movie&mediaId=123&visitorId=xxx
// Returns { counts, userReaction }
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mediaType = searchParams.get('mediaType');
    const mediaIdStr = searchParams.get('mediaId');
    const visitorId = searchParams.get('visitorId'); // authenticated uid OR guest id

    if (!isValidMediaType(mediaType) || !mediaIdStr) {
      return NextResponse.json({ error: 'Missing mediaType or mediaId' }, { status: 400 });
    }

    const mediaId = parseInt(mediaIdStr, 10);
    if (isNaN(mediaId)) {
      return NextResponse.json({ error: 'Invalid mediaId' }, { status: 400 });
    }

    const db = getAdminDb();
    const parentId = docId(mediaType, mediaId);
    const countsRef = db.collection('engagement').doc(parentId);

    // Fetch counts
    const countsSnap = await countsRef.get();
    const counts: EngagementCounts = countsSnap.exists
      ? { likes: countsSnap.data()?.likes ?? 0, dislikes: countsSnap.data()?.dislikes ?? 0 }
      : { likes: 0, dislikes: 0 };

    // Fetch user/guest reaction if visitorId provided
    let userReaction: ReactionType | null = null;
    if (visitorId) {
      const reactionSnap = await countsRef.collection('reactions').doc(visitorId).get();
      if (reactionSnap.exists) {
        userReaction = reactionSnap.data()?.reaction ?? null;
      }
    }

    return NextResponse.json({ counts, userReaction });
  } catch (error) {
    console.error('[Engagement API] GET error:', error);
    return NextResponse.json({ counts: { likes: 0, dislikes: 0 }, userReaction: null });
  }
}

// ============================================
// POST  /api/engagement
// Body: { mediaType, mediaId, visitorId, reaction }
// Toggle reaction → returns { reaction, counts }
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mediaType, mediaId, visitorId, reaction } = body as {
      mediaType: unknown;
      mediaId: unknown;
      visitorId: unknown;
      reaction: unknown;
    };

    if (!isValidMediaType(mediaType)) {
      return NextResponse.json({ error: 'Invalid mediaType' }, { status: 400 });
    }
    if (typeof mediaId !== 'number' || isNaN(mediaId)) {
      return NextResponse.json({ error: 'Invalid mediaId' }, { status: 400 });
    }
    if (typeof visitorId !== 'string' || !visitorId) {
      return NextResponse.json({ error: 'Missing visitorId' }, { status: 400 });
    }
    if (reaction !== 'like' && reaction !== 'dislike') {
      return NextResponse.json({ error: 'Invalid reaction' }, { status: 400 });
    }

    const db = getAdminDb();
    const parentId = docId(mediaType, mediaId);
    const countsRef = db.collection('engagement').doc(parentId);
    const reactionRef = countsRef.collection('reactions').doc(visitorId);

    // Run inside a Firestore transaction
    const result = await db.runTransaction(async (tx) => {
      const countsSnap = await tx.get(countsRef);
      const reactionSnap = await tx.get(reactionRef);

      const current: EngagementCounts = countsSnap.exists
        ? { likes: countsSnap.data()?.likes ?? 0, dislikes: countsSnap.data()?.dislikes ?? 0 }
        : { likes: 0, dislikes: 0 };

      const existing: ReactionType | null = reactionSnap.exists
        ? reactionSnap.data()?.reaction ?? null
        : null;

      let nextReaction: ReactionType | null;
      const nextCounts = { ...current };

      if (existing === reaction) {
        // Un-react
        nextReaction = null;
        tx.delete(reactionRef);
        if (reaction === 'like') nextCounts.likes = Math.max(0, nextCounts.likes - 1);
        else nextCounts.dislikes = Math.max(0, nextCounts.dislikes - 1);
      } else if (existing && existing !== reaction) {
        // Switch
        nextReaction = reaction;
        tx.set(reactionRef, { reaction, createdAt: FieldValue.serverTimestamp() });
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
        tx.set(reactionRef, { reaction, createdAt: FieldValue.serverTimestamp() });
        if (reaction === 'like') nextCounts.likes += 1;
        else nextCounts.dislikes += 1;
      }

      tx.set(countsRef, {
        likes: nextCounts.likes,
        dislikes: nextCounts.dislikes,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return { reaction: nextReaction, counts: nextCounts };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Engagement API] POST error:', error);
    return NextResponse.json({ error: 'Failed to toggle reaction' }, { status: 500 });
  }
}
