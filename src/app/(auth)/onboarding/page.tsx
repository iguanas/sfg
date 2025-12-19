'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChatContainer } from '@/components/chat';
import { useChatStore } from '@/stores/chat-store';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function OnboardingContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const {
    messages,
    currentCheckpoint,
    isLoading,
    setSession,
    setMessages,
    setCheckpoint,
    sendMessage,
    addMessage,
  } = useChatStore();

  // Initialize session
  useEffect(() => {
    if (!sessionId) {
      setInitError('No session ID provided');
      return;
    }

    const initSession = async () => {
      try {
        // Fetch existing session data
        const response = await fetch(`/api/onboarding/session?id=${sessionId}`);

        if (!response.ok) {
          if (response.status === 404) {
            setInitError('Session not found');
          } else {
            setInitError('Failed to load session');
          }
          return;
        }

        const data = await response.json();
        setSession(sessionId, data.clientId);
        setCheckpoint(data.currentCheckpoint);

        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        } else {
          // Add initial welcome message if no messages exist
          addMessage({
            id: 'welcome',
            role: 'ASSISTANT',
            content: `Hi${data.clientName ? ` ${data.clientName}` : ''}! Welcome to Set Forget Grow!\n\nI'm here to help you through our quick onboarding process. This usually takes about 10-15 minutes, and you can type or use the mic button to talk - whatever's easier for you.\n\nLet's start with your business. What's the name of your business?`,
            createdAt: new Date(),
          });
        }

        setInitialized(true);
      } catch (error) {
        console.error('Failed to initialize session:', error);
        setInitError('Failed to load session');
      }
    };

    initSession();
  }, [sessionId, setSession, setCheckpoint, setMessages, addMessage]);

  const handleSendMessage = async (content: string) => {
    await sendMessage(content);
  };

  // Show error state
  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h1>
          <p className="text-gray-600 mb-4">{initError}</p>
          <Button asChild>
            <Link href="/start">Start New Session</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Show loading state while initializing
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your session...</p>
        </div>
      </div>
    );
  }

  return (
    <ChatContainer
      messages={messages}
      currentCheckpoint={currentCheckpoint}
      isLoading={isLoading}
      onSendMessage={handleSendMessage}
    />
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OnboardingContent />
    </Suspense>
  );
}
