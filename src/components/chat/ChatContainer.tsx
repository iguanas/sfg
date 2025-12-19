'use client';

import { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { CheckpointProgress } from './CheckpointProgress';
import type { ChatMessage, Checkpoint } from '@/types/onboarding';

interface ChatContainerProps {
  messages: ChatMessage[];
  currentCheckpoint: Checkpoint;
  isLoading: boolean;
  onSendMessage: (content: string) => void;
  onStartRecording?: () => void;
}

export function ChatContainer({
  messages,
  currentCheckpoint,
  isLoading,
  onSendMessage,
  onStartRecording,
}: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Progress indicator */}
      <CheckpointProgress currentCheckpoint={currentCheckpoint} />

      {/* Messages area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium">Welcome to Set Forget Grow!</p>
              <p className="mt-2">We're here to help you get started. Send a message to begin.</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                isLatest={index === messages.length - 1}
              />
            ))
          )}
          {isLoading && <TypingIndicator />}
        </div>
      </ScrollArea>

      {/* Input area */}
      <MessageInput
        onSendMessage={onSendMessage}
        onStartRecording={onStartRecording}
        disabled={isLoading}
        placeholder={
          currentCheckpoint === 'WELCOME'
            ? 'Say hello to get started...'
            : 'Type or use the mic to respond...'
        }
      />
    </div>
  );
}
