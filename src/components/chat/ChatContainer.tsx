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
  onSendMessage: (content: string, isVoice?: boolean) => void;
}

export function ChatContainer({
  messages,
  currentCheckpoint,
  isLoading,
  onSendMessage,
}: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = (content: string, isVoice = false) => {
    onSendMessage(content, isVoice);
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Progress indicator */}
      <CheckpointProgress currentCheckpoint={currentCheckpoint} />

      {/* Messages area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium">Welcome to Set Forget Grow!</p>
              <p className="mt-2">We&apos;re here to help you get started. Send a message to begin.</p>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isLatest={index === messages.length - 1}
                />
              ))}
              {isLoading && <TypingIndicator />}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <MessageInput
        onSendMessage={handleSendMessage}
        disabled={isLoading}
        showVoice={true}
        placeholder={
          currentCheckpoint === 'WELCOME'
            ? 'Say hello to get started...'
            : 'Type or tap the mic to respond...'
        }
      />
    </div>
  );
}
