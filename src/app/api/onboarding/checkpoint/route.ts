import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { canAdvance, getRequiredFields, getMissingFields, getCompletionPercentage, type CheckpointData } from '@/lib/state';
import type { Checkpoint } from '@/types/onboarding';

// ============================================
// GET - Get checkpoint status
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const session = await prisma.onboardingSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        currentCheckpoint: true,
        checkpointData: true,
        completedAt: true,
        lastActivityAt: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const checkpoint = session.currentCheckpoint as Checkpoint;
    const data = (session.checkpointData as CheckpointData) || {};

    return NextResponse.json({
      sessionId: session.id,
      currentCheckpoint: checkpoint,
      isComplete: session.completedAt !== null,
      completionPercentage: getCompletionPercentage(checkpoint),
      canAdvance: canAdvance(checkpoint, data),
      requiredFields: getRequiredFields(checkpoint),
      missingFields: getMissingFields(checkpoint, data),
      checkpointData: data,
      lastActivityAt: session.lastActivityAt,
    });
  } catch (error) {
    console.error('Error getting checkpoint status:', error);
    return NextResponse.json(
      { error: 'Failed to get checkpoint status' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Transition checkpoint
// ============================================

const transitionSchema = z.object({
  sessionId: z.string(),
  action: z.enum(['next', 'back', 'goto', 'complete']),
  target: z.string().optional(), // For 'goto' action
  data: z.record(z.string(), z.unknown()).optional(), // Optional data update
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, action, target, data } = transitionSchema.parse(body);

    const session = await prisma.onboardingSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        clientId: true,
        currentCheckpoint: true,
        checkpointData: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const currentCheckpoint = session.currentCheckpoint as Checkpoint;
    let checkpointData = (session.checkpointData as CheckpointData) || {};

    // Apply data updates if provided
    if (data) {
      checkpointData = { ...checkpointData, ...data };
    }

    const checkpointOrder: Checkpoint[] = [
      'WELCOME',
      'BUSINESS_INFO',
      'DOMAIN_ACCESS',
      'GBP',
      'PHOTOS',
      'REVIEW',
      'COMPLETED',
    ];

    const currentIndex = checkpointOrder.indexOf(currentCheckpoint);
    let newCheckpoint: Checkpoint = currentCheckpoint;
    let transitioned = false;

    switch (action) {
      case 'next':
        // Check if we can advance
        if (!canAdvance(currentCheckpoint, checkpointData)) {
          const missing = getMissingFields(currentCheckpoint, checkpointData);
          return NextResponse.json(
            {
              error: 'Cannot advance: missing required fields',
              missingFields: missing,
            },
            { status: 400 }
          );
        }

        if (currentIndex < checkpointOrder.length - 1) {
          newCheckpoint = checkpointOrder[currentIndex + 1];
          transitioned = true;
        }
        break;

      case 'back':
        if (currentIndex > 0) {
          newCheckpoint = checkpointOrder[currentIndex - 1];
          transitioned = true;
        }
        break;

      case 'goto':
        if (target && checkpointOrder.includes(target as Checkpoint)) {
          const targetIndex = checkpointOrder.indexOf(target as Checkpoint);
          // Only allow going back or to completed checkpoints from review
          if (targetIndex <= currentIndex || currentCheckpoint === 'REVIEW') {
            newCheckpoint = target as Checkpoint;
            transitioned = true;
          } else {
            return NextResponse.json(
              { error: 'Cannot skip ahead to future checkpoints' },
              { status: 400 }
            );
          }
        }
        break;

      case 'complete':
        if (currentCheckpoint !== 'REVIEW') {
          return NextResponse.json(
            { error: 'Can only complete from REVIEW checkpoint' },
            { status: 400 }
          );
        }
        if (!checkpointData.confirmed) {
          return NextResponse.json(
            { error: 'Must confirm before completing' },
            { status: 400 }
          );
        }
        newCheckpoint = 'COMPLETED';
        transitioned = true;
        break;
    }

    // Update database if transition occurred
    if (transitioned) {
      // Log checkpoint history
      if (newCheckpoint !== currentCheckpoint) {
        await prisma.checkpointHistory.create({
          data: {
            sessionId,
            checkpoint: newCheckpoint,
          },
        });

        // Mark previous checkpoint as exited
        await prisma.checkpointHistory.updateMany({
          where: {
            sessionId,
            checkpoint: currentCheckpoint,
            exitedAt: null,
          },
          data: {
            exitedAt: new Date(),
            data: JSON.parse(JSON.stringify(checkpointData)),
          },
        });
      }

      const updateData: Record<string, unknown> = {
        currentCheckpoint: newCheckpoint,
        checkpointData: JSON.parse(JSON.stringify(checkpointData)),
        lastActivityAt: new Date(),
      };

      // Handle completion
      if (newCheckpoint === 'COMPLETED') {
        updateData.completedAt = new Date();

        await prisma.client.update({
          where: { id: session.clientId },
          data: {
            status: 'ACTIVE',
            onboardedAt: new Date(),
          },
        });
      }

      await prisma.onboardingSession.update({
        where: { id: sessionId },
        data: updateData,
      });
    }

    return NextResponse.json({
      success: true,
      transitioned,
      previousCheckpoint: currentCheckpoint,
      currentCheckpoint: newCheckpoint,
      completionPercentage: getCompletionPercentage(newCheckpoint),
      isComplete: newCheckpoint === 'COMPLETED',
      canAdvance: canAdvance(newCheckpoint, checkpointData),
      requiredFields: getRequiredFields(newCheckpoint),
      missingFields: getMissingFields(newCheckpoint, checkpointData),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error transitioning checkpoint:', error);
    return NextResponse.json(
      { error: 'Failed to transition checkpoint' },
      { status: 500 }
    );
  }
}
