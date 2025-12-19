import { create } from 'zustand';
import type { ChatMessage, Checkpoint } from '@/types/onboarding';

interface ChatState {
  sessionId: string | null;
  clientId: string | null;
  messages: ChatMessage[];
  currentCheckpoint: Checkpoint;
  isLoading: boolean;
  error: string | null;

  // Actions
  setSession: (sessionId: string, clientId: string) => void;
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setCheckpoint: (checkpoint: Checkpoint) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  sendMessage: (content: string, isVoice?: boolean) => Promise<void>;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  clientId: null,
  messages: [],
  currentCheckpoint: 'WELCOME' as Checkpoint,
  isLoading: false,
  error: null,
};

export const useChatStore = create<ChatState>((set, get) => ({
  ...initialState,

  setSession: (sessionId, clientId) => set({ sessionId, clientId }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setMessages: (messages) => set({ messages }),

  setCheckpoint: (checkpoint) => set({ currentCheckpoint: checkpoint }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  sendMessage: async (content: string, isVoice = false) => {
    const { sessionId, addMessage, setLoading, setError, setCheckpoint } = get();

    if (!sessionId) {
      setError('No active session');
      return;
    }

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'USER',
      content,
      isVoice,
      createdAt: new Date(),
    };
    addMessage(userMessage);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          content,
          isVoice,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send message');
      }

      const data = await response.json();

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: data.messageId || `assistant-${Date.now()}`,
        role: 'ASSISTANT',
        content: data.message,
        extractedData: data.extractedData,
        createdAt: new Date(),
      };
      addMessage(assistantMessage);

      // Update checkpoint if advanced
      if (data.advanced && data.checkpoint) {
        setCheckpoint(data.checkpoint);
      }

      // Handle UI actions from AI response
      if (data.uiAction) {
        // TODO: Trigger UI component display
        console.log('UI Action:', data.uiAction);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  },

  reset: () => set(initialState),
}));
