'use client';

import { cn } from '@/lib/utils';
import { Check, Building, Globe, MapPin, Camera, ClipboardCheck, Sparkles, PartyPopper } from 'lucide-react';
import { getCompletionPercentage } from '@/lib/state';
import type { Checkpoint } from '@/types/onboarding';

interface CheckpointProgressProps {
  currentCheckpoint: Checkpoint;
  className?: string;
  showPercentage?: boolean;
}

const checkpoints: {
  id: Checkpoint;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: 'WELCOME', label: 'Welcome', icon: Sparkles },
  { id: 'BUSINESS_INFO', label: 'Business', icon: Building },
  { id: 'DOMAIN_ACCESS', label: 'Domain', icon: Globe },
  { id: 'GBP', label: 'Google', icon: MapPin },
  { id: 'PHOTOS', label: 'Photos', icon: Camera },
  { id: 'REVIEW', label: 'Review', icon: ClipboardCheck },
];

const checkpointOrder: Checkpoint[] = [
  'WELCOME',
  'BUSINESS_INFO',
  'DOMAIN_ACCESS',
  'GBP',
  'PHOTOS',
  'REVIEW',
  'COMPLETED',
];

export function CheckpointProgress({
  currentCheckpoint,
  className,
  showPercentage = true,
}: CheckpointProgressProps) {
  const currentIndex = checkpointOrder.indexOf(currentCheckpoint);
  const percentage = getCompletionPercentage(currentCheckpoint);
  const isComplete = currentCheckpoint === 'COMPLETED';

  // Show completion state
  if (isComplete) {
    return (
      <div className={cn('bg-green-50 border-b border-green-200 py-4 px-4', className)}>
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-3">
          <PartyPopper className="w-6 h-6 text-green-600" />
          <span className="text-green-700 font-medium">Onboarding Complete!</span>
          <PartyPopper className="w-6 h-6 text-green-600" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white border-b border-gray-200 py-3 px-4', className)}>
      <div className="max-w-4xl mx-auto">
        {/* Progress bar */}
        {showPercentage && (
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-500">Progress</span>
              <span className="text-xs font-medium text-gray-700">{percentage}%</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Checkpoint steps */}
        <div className="flex items-center justify-between">
          {checkpoints.map((checkpoint, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = checkpoint.id === currentCheckpoint;
            const Icon = checkpoint.icon;

            return (
              <div key={checkpoint.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                      isCompleted && 'bg-green-500 text-white',
                      isCurrent && 'bg-blue-500 text-white ring-4 ring-blue-100',
                      !isCompleted && !isCurrent && 'bg-gray-200 text-gray-400'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs mt-1 font-medium',
                      isCurrent && 'text-blue-600',
                      isCompleted && 'text-green-600',
                      !isCompleted && !isCurrent && 'text-gray-400'
                    )}
                  >
                    {checkpoint.label}
                  </span>
                </div>

                {index < checkpoints.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 w-8 sm:w-12 md:w-16 mx-1 sm:mx-2 transition-colors',
                      index < currentIndex ? 'bg-green-500' : 'bg-gray-200'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
