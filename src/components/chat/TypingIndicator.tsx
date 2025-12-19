'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function TypingIndicator() {
  return (
    <div className="flex gap-3 mb-4">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className="bg-green-500 text-white text-sm font-medium">
          SFG
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col items-start">
        <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-tl-md">
          <div className="flex gap-1">
            <span
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
