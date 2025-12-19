import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { conversationEngine, type ConversationContext } from '@/lib/ai/conversation-engine';
import { mergeExtractedData } from '@/lib/ai/extraction';
import type { Checkpoint, ChatMessage } from '@/types/onboarding';

const messageSchema = z.object({
  sessionId: z.string(),
  content: z.string().min(1),
  isVoice: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, content, isVoice } = messageSchema.parse(body);

    // Get session with client info and message history
    const session = await prisma.onboardingSession.findUnique({
      where: { id: sessionId },
      include: {
        client: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 30, // Get recent messages for context
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        sessionId,
        role: 'USER',
        content,
        isVoice,
      },
    });

    // Build conversation context
    const checkpointData = (session.checkpointData as Record<string, unknown>) || {};
    const address = session.client.address as { street?: string; city?: string; state?: string; zip?: string } | null;

    const context: ConversationContext = {
      sessionId: session.id,
      clientId: session.clientId,
      clientName: session.client.firstName || undefined,
      businessName: session.client.businessName || undefined,
      address: address || undefined,
      currentCheckpoint: session.currentCheckpoint as Checkpoint,
      checkpointData,
      allCollectedData: {
        ...checkpointData,
        businessName: session.client.businessName,
        email: session.client.email,
        phone: session.client.phone,
        address: session.client.address,
      },
      messageHistory: session.messages.map((m) => ({
        id: m.id,
        role: m.role as ChatMessage['role'],
        content: m.content,
        isVoice: m.isVoice,
        createdAt: m.createdAt,
      })),
    };

    // Process message with conversation engine
    const response = await conversationEngine.processMessage(content, context);

    // Save assistant message
    const assistantMessage = await prisma.message.create({
      data: {
        sessionId,
        role: 'ASSISTANT',
        content: response.message,
        extractedData: response.extractedData ? JSON.parse(JSON.stringify(response.extractedData)) : undefined,
        tokensUsed: response.tokensUsed,
        modelUsed: 'gemini-2.0-flash',
      },
    });

    // Update session with extracted data and checkpoint progress
    const updatedCheckpointData = mergeExtractedData(
      checkpointData,
      response.extractedData
    );

    const updateData: Record<string, unknown> = {
      lastActivityAt: new Date(),
      checkpointData: updatedCheckpointData,
    };

    // If extracted data includes client info, update the client record too
    if (response.extractedData) {
      const clientUpdate: Record<string, unknown> = {};

      if (response.extractedData.businessName) {
        clientUpdate.businessName = response.extractedData.businessName;
      }
      if (response.extractedData.phone) {
        clientUpdate.phone = response.extractedData.phone;
      }
      if (response.extractedData.firstName) {
        clientUpdate.firstName = response.extractedData.firstName;
      }
      if (response.extractedData.address) {
        clientUpdate.address = response.extractedData.address;
      }
      if (response.extractedData.services) {
        clientUpdate.services = response.extractedData.services;
      }

      if (Object.keys(clientUpdate).length > 0) {
        await prisma.client.update({
          where: { id: session.clientId },
          data: clientUpdate,
        });
      }
    }

    // Handle checkpoint advancement
    if (response.shouldAdvanceCheckpoint && response.nextCheckpoint) {
      updateData.currentCheckpoint = response.nextCheckpoint;

      // Log checkpoint transition
      await prisma.checkpointHistory.create({
        data: {
          sessionId,
          checkpoint: response.nextCheckpoint,
        },
      });

      // Mark previous checkpoint as exited
      await prisma.checkpointHistory.updateMany({
        where: {
          sessionId,
          checkpoint: session.currentCheckpoint,
          exitedAt: null,
        },
        data: {
          exitedAt: new Date(),
          data: JSON.parse(JSON.stringify(updatedCheckpointData)),
        },
      });

      // If we've completed onboarding
      if (response.nextCheckpoint === 'COMPLETED') {
        updateData.completedAt = new Date();

        await prisma.client.update({
          where: { id: session.clientId },
          data: {
            status: 'ACTIVE',
            onboardedAt: new Date(),
          },
        });

        // TODO: Send completion notification (Slack webhook)
      }
    }

    // Update session
    await prisma.onboardingSession.update({
      where: { id: sessionId },
      data: updateData,
    });

    return NextResponse.json({
      messageId: assistantMessage.id,
      message: response.message,
      extractedData: response.extractedData,
      confirmationNeeded: response.confirmationNeeded,
      uiAction: response.uiAction,
      checkpoint: response.shouldAdvanceCheckpoint
        ? response.nextCheckpoint
        : session.currentCheckpoint,
      advanced: response.shouldAdvanceCheckpoint,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error processing message:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}
