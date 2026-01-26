/**
 * API Routes for User Learning State
 * 
 * Handles persistence of AI preference learning data for authenticated users.
 * GET: Retrieve user's learning state
 * POST: Save/update user's learning state
 * DELETE: Reset user's learning state
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/user/learning
 * Retrieve the authenticated user's learning state
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const learningState = await prisma.userLearningState.findUnique({
      where: { userId: session.user.id }
    });

    if (!learningState) {
      // Return empty state for new users
      return NextResponse.json({
        learningData: null,
        totalLikes: 0,
        totalDislikes: 0
      });
    }

    return NextResponse.json({
      learningData: learningState.learningData ? JSON.parse(learningState.learningData) : null,
      totalLikes: learningState.totalLikes,
      totalDislikes: learningState.totalDislikes,
      updatedAt: learningState.updatedAt
    });
  } catch (error) {
    console.error('[API] Error fetching learning state:', error);
    return NextResponse.json(
      { error: 'Failed to fetch learning state' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/learning
 * Save or update the authenticated user's learning state
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { learningData, totalLikes, totalDislikes } = body;

    if (!learningData) {
      return NextResponse.json(
        { error: 'Missing learning data' },
        { status: 400 }
      );
    }

    // Upsert the learning state
    const result = await prisma.userLearningState.upsert({
      where: { userId: session.user.id },
      update: {
        learningData: JSON.stringify(learningData),
        totalLikes: totalLikes ?? 0,
        totalDislikes: totalDislikes ?? 0
      },
      create: {
        userId: session.user.id,
        learningData: JSON.stringify(learningData),
        totalLikes: totalLikes ?? 0,
        totalDislikes: totalDislikes ?? 0
      }
    });

    return NextResponse.json({
      success: true,
      updatedAt: result.updatedAt
    });
  } catch (error) {
    console.error('[API] Error saving learning state:', error);
    return NextResponse.json(
      { error: 'Failed to save learning state' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/learning
 * Reset the authenticated user's learning state
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await prisma.userLearningState.deleteMany({
      where: { userId: session.user.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error resetting learning state:', error);
    return NextResponse.json(
      { error: 'Failed to reset learning state' },
      { status: 500 }
    );
  }
}
