'use client';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { format } from 'date-fns';
import type { ChatMessage } from '@/types/onboarding';

interface MessageBubbleProps {
  message: ChatMessage;
  isLatest?: boolean;
}

export function MessageBubble({ message, isLatest }: MessageBubbleProps) {
  const isUser = message.role === 'USER';
  const isSystem = message.role === 'SYSTEM';

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-gray-100 text-gray-600 text-sm px-4 py-2 rounded-full">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex gap-3 mb-4',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback
          className={cn(
            'text-sm font-medium',
            isUser ? 'bg-blue-500 text-white' : 'bg-green-500 text-white'
          )}
        >
          {isUser ? 'U' : 'SFG'}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          'flex flex-col max-w-[80%]',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        <div
          className={cn(
            'px-4 py-3 rounded-2xl',
            isUser
              ? 'bg-blue-500 text-white rounded-tr-md'
              : 'bg-gray-100 text-gray-900 rounded-tl-md'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1 px-1">
          {message.isVoice && (
            <span className="text-xs text-gray-400">🎤 Voice</span>
          )}
          <span className="text-xs text-gray-400">
            {format(new Date(message.createdAt), 'h:mm a')}
          </span>
        </div>
      </div>
    </div>
  );
}
