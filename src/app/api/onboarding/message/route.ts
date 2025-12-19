import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client (will be null if API key not set)
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const messageSchema = z.object({
  sessionId: z.string(),
  content: z.string().min(1),
  isVoice: z.boolean().optional().default(false),
});

// System prompt for the AI
const getSystemPrompt = (checkpointData: Record<string, unknown>, currentCheckpoint: string) => `
You are a friendly and professional onboarding assistant for Set Forget Grow, a local business marketing agency.

Your role is to help clients complete their onboarding by collecting business information in a conversational way.
You should be warm, concise, and helpful - not robotic or overly formal.

Current checkpoint: ${currentCheckpoint}
Collected data so far: ${JSON.stringify(checkpointData, null, 2)}

Guidelines:
- Be conversational and natural, like a helpful human assistant
- Extract structured data from their responses
- Confirm important information back to them before moving on
- Ask one or two questions at a time, don't overwhelm them
- If they give incomplete info, gently ask for clarification
- Acknowledge what they've shared before asking for more
- Keep responses concise - 2-3 sentences typically

For WELCOME checkpoint:
- Greet them warmly and introduce yourself
- Explain the onboarding process briefly (10-15 minutes)
- Ask about their business to get started

For BUSINESS_INFO checkpoint:
- Collect: business name, type/industry, address, phone, email, services offered
- Ask about business hours and what makes them unique
- Be encouraging about their business

For DOMAIN_ACCESS checkpoint:
- Ask if they have a website/domain
- If yes, ask what the domain is
- Explain we'll need access to set up their new site

For GBP checkpoint:
- Ask if they have a Google Business Profile
- Help them understand its importance for local search
- Collect their Google account email if needed

For PHOTOS checkpoint:
- Explain we need photos of their business (exterior, interior, logo)
- Offer to collect photos now or schedule for later
- Be flexible about timing

For REVIEW checkpoint:
- Summarize everything collected
- Ask if anything needs to be corrected
- Confirm they're ready to proceed

Always respond with helpful, encouraging messages that move the conversation forward naturally.
`;

// Mock AI response for when API key is not configured
const getMockResponse = (content: string, currentCheckpoint: string): string => {
  const lowerContent = content.toLowerCase();

  if (currentCheckpoint === 'WELCOME') {
    if (lowerContent.includes('hello') || lowerContent.includes('hi') || lowerContent.includes('hey')) {
      return "Great to meet you! Let's get started with your business information. What's the name of your business?";
    }
    return "Thanks! Tell me a bit about your business - what's the name and what kind of services do you offer?";
  }

  if (currentCheckpoint === 'BUSINESS_INFO') {
    return "That's great information! Can you tell me your business address and phone number so customers can find and reach you?";
  }

  return "Thanks for sharing that! Let me note that down. What else can you tell me?";
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, content, isVoice } = messageSchema.parse(body);

    // Get session with client info
    const session = await prisma.onboardingSession.findUnique({
      where: { id: sessionId },
      include: {
        client: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Get last 10 messages for context
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

    // Build conversation history for AI
    const conversationHistory = session.messages
      .reverse()
      .map((m) => ({
        role: m.role === 'USER' ? 'user' : 'assistant',
        content: m.content,
      }));

    // Add current message
    conversationHistory.push({
      role: 'user',
      content,
    });

    let aiResponse: string;
    let extractedData: Record<string, unknown> | null = null;

    // Try to get AI response
    if (anthropic) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: getSystemPrompt(
            session.checkpointData as Record<string, unknown>,
            session.currentCheckpoint
          ),
          messages: conversationHistory.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        });

        // Extract text from response
        const textBlock = response.content.find((block) => block.type === 'text');
        aiResponse = textBlock ? textBlock.text : 'I apologize, I had trouble responding. Could you try again?';
      } catch (aiError) {
        console.error('AI error:', aiError);
        aiResponse = getMockResponse(content, session.currentCheckpoint);
      }
    } else {
      // Use mock response if no API key
      console.log('No ANTHROPIC_API_KEY configured, using mock response');
      aiResponse = getMockResponse(content, session.currentCheckpoint);
    }

    // Save assistant message
    const assistantMessage = await prisma.message.create({
      data: {
        sessionId,
        role: 'ASSISTANT',
        content: aiResponse,
        extractedData: extractedData ?? undefined,
      },
    });

    // Update session last activity
    await prisma.onboardingSession.update({
      where: { id: sessionId },
      data: { lastActivityAt: new Date() },
    });

    return NextResponse.json({
      messageId: assistantMessage.id,
      message: aiResponse,
      extractedData,
      checkpoint: session.currentCheckpoint,
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
