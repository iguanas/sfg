import { GoogleGenerativeAI, GenerativeModel, Content } from '@google/generative-ai';
import { getSystemPrompt, getNextCheckpoint, isCheckpointComplete, type PromptContext } from './prompts';
import { parseAIResponse, mergeExtractedData, type AIResponseData } from './extraction';
import type { Checkpoint, ChatMessage } from '@/types/onboarding';

// ============================================
// TYPES
// ============================================

export interface ConversationContext {
  sessionId: string;
  clientId: string;
  clientName?: string;
  businessName?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  currentCheckpoint: Checkpoint;
  checkpointData: Record<string, unknown>;
  allCollectedData: Record<string, unknown>;
  messageHistory: ChatMessage[];
}

export interface ConversationResponse {
  message: string;
  extractedData: Record<string, unknown> | null;
  confirmationNeeded: AIResponseData['confirmationNeeded'];
  uiAction: AIResponseData['uiAction'];
  shouldAdvanceCheckpoint: boolean;
  nextCheckpoint?: Checkpoint;
  tokensUsed?: number;
}

// ============================================
// CONVERSATION ENGINE
// ============================================

export class ConversationEngine {
  private genAI: GoogleGenerativeAI | null;
  private model: GenerativeModel | null;
  private modelName: string = 'gemini-2.0-flash';
  private maxHistoryMessages: number = 20;

  constructor() {
    if (process.env.GOOGLE_API_KEY) {
      this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: this.modelName });
    } else {
      this.genAI = null;
      this.model = null;
    }
  }

  /**
   * Process a user message and generate an AI response
   */
  async processMessage(
    userMessage: string,
    context: ConversationContext
  ): Promise<ConversationResponse> {
    // Build the prompt context
    const promptContext: PromptContext = {
      checkpoint: context.currentCheckpoint,
      clientName: context.clientName,
      businessName: context.businessName,
      address: context.address,
      checkpointData: context.checkpointData,
      allCollectedData: context.allCollectedData,
    };

    // Get the system prompt for the current checkpoint
    const systemPrompt = getSystemPrompt(promptContext);

    // Build conversation history for context
    const conversationHistory = this.buildConversationHistory(
      context.messageHistory,
      userMessage
    );

    // Get AI response
    let responseData: AIResponseData;
    let tokensUsed: number | undefined;

    if (this.model) {
      try {
        // Start a chat session with the system prompt
        const chat = this.model.startChat({
          history: conversationHistory,
          generationConfig: {
            maxOutputTokens: 1024,
          },
          systemInstruction: systemPrompt,
        });

        // Send the current message
        const result = await chat.sendMessage(userMessage);
        const response = result.response;
        const responseText = response.text();

        responseData = parseAIResponse(responseText);

        // Get token usage if available
        const usageMetadata = response.usageMetadata;
        tokensUsed = usageMetadata?.candidatesTokenCount;
      } catch (error) {
        console.error('Gemini API error:', error);
        responseData = this.getFallbackResponse(context.currentCheckpoint, userMessage);
      }
    } else {
      // No API key - use fallback responses
      console.log('No GOOGLE_API_KEY configured, using fallback response');
      responseData = this.getFallbackResponse(context.currentCheckpoint, userMessage);
    }

    // Merge extracted data with existing data
    const mergedData = mergeExtractedData(
      context.checkpointData,
      responseData.extractedData
    );

    // Check if we should advance to the next checkpoint
    const shouldAdvance = responseData.readyToAdvance &&
      isCheckpointComplete(context.currentCheckpoint, mergedData);

    return {
      message: responseData.message,
      extractedData: responseData.extractedData,
      confirmationNeeded: responseData.confirmationNeeded,
      uiAction: responseData.uiAction,
      shouldAdvanceCheckpoint: shouldAdvance,
      nextCheckpoint: shouldAdvance ? getNextCheckpoint(context.currentCheckpoint) : undefined,
      tokensUsed,
    };
  }

  /**
   * Build conversation history for the AI in Gemini format
   */
  private buildConversationHistory(
    history: ChatMessage[],
    _currentMessage: string
  ): Content[] {
    // Take the last N messages for context
    const recentHistory = history.slice(-this.maxHistoryMessages);

    const contents: Content[] = [];

    for (const msg of recentHistory) {
      if (msg.role === 'USER') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content }],
        });
      } else if (msg.role === 'ASSISTANT') {
        contents.push({
          role: 'model',
          parts: [{ text: msg.content }],
        });
      }
      // Skip SYSTEM messages in history
    }

    // Note: Don't add current message here - it's sent via sendMessage()
    return contents;
  }

  /**
   * Generate fallback responses when API is not available
   */
  private getFallbackResponse(
    checkpoint: Checkpoint,
    userMessage: string
  ): AIResponseData {
    const lowerMessage = userMessage.toLowerCase();

    switch (checkpoint) {
      case 'WELCOME':
        if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
          return {
            message: "Great to meet you! Let's get started with your business information. What's the name of your business and what kind of services do you offer?",
            extractedData: { greeted: true },
            confirmationNeeded: [],
            readyToAdvance: true,
            uiAction: null,
          };
        }
        return {
          message: "Thanks for that! Tell me a bit about your business - what's the name and what services do you provide?",
          extractedData: { greeted: true },
          confirmationNeeded: [],
          readyToAdvance: true,
          uiAction: null,
        };

      case 'BUSINESS_INFO':
        return {
          message: "That's great information! Can you tell me your business address and phone number so customers can find and reach you?",
          extractedData: null,
          confirmationNeeded: [],
          readyToAdvance: false,
          uiAction: null,
        };

      case 'DOMAIN_ACCESS':
        return {
          message: "Do you have a website or domain name currently? If so, what's the address (like yoursite.com)?",
          extractedData: null,
          confirmationNeeded: [],
          readyToAdvance: false,
          uiAction: null,
        };

      case 'GBP':
        return {
          message: "Let's set up your Google Business Profile. I'll help you search for your business on Google to see if you already have a listing.",
          extractedData: null,
          confirmationNeeded: [],
          readyToAdvance: false,
          uiAction: { type: 'show_business_search' },
        };

      case 'PHOTOS':
        return {
          message: "Now let's get some photos of your business. We need at least an exterior shot, interior shot, and your logo. You can upload them here or I can pull them from your Google profile or website.",
          extractedData: null,
          confirmationNeeded: [],
          readyToAdvance: false,
          uiAction: { type: 'show_photo_upload' },
        };

      case 'REVIEW':
        return {
          message: "Here's a summary of everything we've collected. Does everything look correct?",
          extractedData: null,
          confirmationNeeded: [],
          readyToAdvance: false,
          uiAction: { type: 'show_review_summary' },
        };

      default:
        return {
          message: "Thanks for sharing that! What else can you tell me?",
          extractedData: null,
          confirmationNeeded: [],
          readyToAdvance: false,
          uiAction: null,
        };
    }
  }

  /**
   * Generate the initial welcome message for a new session
   */
  getWelcomeMessage(clientName?: string): string {
    const name = clientName ? ` ${clientName}` : '';
    return `Hi${name}! Welcome to Set Forget Grow!

I'm here to help you through our quick onboarding process. This usually takes about 10-15 minutes, and you can type or use the mic button to talk - whatever's easier for you.

Let's start with your business. What's the name of your business and what do you do?`;
  }
}

// Export singleton instance
export const conversationEngine = new ConversationEngine();
