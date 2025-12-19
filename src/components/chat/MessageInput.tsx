'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Mic } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  onStartRecording?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSendMessage,
  onStartRecording,
  disabled = false,
  placeholder = 'Type your message...',
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="min-h-[44px] max-h-[150px] resize-none pr-12 py-3 rounded-2xl border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            rows={1}
          />
        </div>

        {onStartRecording && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-full flex-shrink-0"
            onClick={onStartRecording}
            disabled={disabled}
          >
            <Mic className="h-5 w-5" />
            <span className="sr-only">Record voice message</span>
          </Button>
        )}

        <Button
          type="button"
          size="icon"
          className="h-11 w-11 rounded-full flex-shrink-0"
          onClick={handleSend}
          disabled={disabled || !message.trim()}
        >
          <Send className="h-5 w-5" />
          <span className="sr-only">Send message</span>
        </Button>
      </div>

      <p className="text-xs text-gray-400 text-center mt-2">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
