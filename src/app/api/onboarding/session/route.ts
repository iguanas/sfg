import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

// Schema for creating a new session
const createSessionSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

// GET - Retrieve session by ID
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('id');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID is required' },
      { status: 400 }
    );
  }

  try {
    const session = await prisma.onboardingSession.findUnique({
      where: { id: sessionId },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            email: true,
            businessName: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            isVoice: true,
            extractedData: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      sessionId: session.id,
      clientId: session.clientId,
      clientName: session.client.firstName,
      clientEmail: session.client.email,
      businessName: session.client.businessName,
      currentCheckpoint: session.currentCheckpoint,
      checkpointData: session.checkpointData,
      messages: session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        isVoice: m.isVoice,
        extractedData: m.extractedData,
        createdAt: m.createdAt,
      })),
      startedAt: session.startedAt,
      lastActivityAt: session.lastActivityAt,
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

// POST - Create new session or resume existing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name } = createSessionSchema.parse(body);

    // Check if client exists
    let client = await prisma.client.findUnique({
      where: { email },
      include: {
        sessions: {
          where: { completedAt: null },
          orderBy: { lastActivityAt: 'desc' },
          take: 1,
        },
      },
    });

    // If client has an active session, return it
    if (client && client.sessions.length > 0) {
      const existingSession = client.sessions[0];

      // Update last activity
      await prisma.onboardingSession.update({
        where: { id: existingSession.id },
        data: { lastActivityAt: new Date() },
      });

      return NextResponse.json({
        sessionId: existingSession.id,
        resumed: true,
        message: 'Resuming existing session',
      });
    }

    // Create new client if doesn't exist
    if (!client) {
      client = await prisma.client.create({
        data: {
          email,
          firstName: name?.split(' ')[0],
          lastName: name?.split(' ').slice(1).join(' ') || null,
          status: 'ONBOARDING',
        },
        include: { sessions: true },
      });
    }

    // Create new onboarding session
    const session = await prisma.onboardingSession.create({
      data: {
        clientId: client.id,
        currentCheckpoint: 'WELCOME',
        checkpointData: {
          welcome: { greeted: false, clientName: name },
        },
        userAgent: request.headers.get('user-agent') || undefined,
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
      },
    });

    // Log checkpoint entry
    await prisma.checkpointHistory.create({
      data: {
        sessionId: session.id,
        checkpoint: 'WELCOME',
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      resumed: false,
      message: 'New session created',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

// PATCH - Update session state
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, currentCheckpoint, checkpointData, machineState } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      lastActivityAt: new Date(),
    };

    if (currentCheckpoint) {
      updateData.currentCheckpoint = currentCheckpoint;
    }
    if (checkpointData) {
      updateData.checkpointData = checkpointData;
    }
    if (machineState) {
      updateData.machineState = machineState;
    }

    const session = await prisma.onboardingSession.update({
      where: { id: sessionId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      currentCheckpoint: session.currentCheckpoint,
    });
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}
