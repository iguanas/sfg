'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Checkpoint } from '@/types/onboarding';
import type { CheckpointData } from '@/lib/state';

interface CheckpointStatus {
  sessionId: string;
  currentCheckpoint: Checkpoint;
  isComplete: boolean;
  completionPercentage: number;
  canAdvance: boolean;
  requiredFields: string[];
  missingFields: string[];
  checkpointData: CheckpointData;
  lastActivityAt: string;
}

interface TransitionResult {
  success: boolean;
  transitioned: boolean;
  previousCheckpoint: Checkpoint;
  currentCheckpoint: Checkpoint;
  completionPercentage: number;
  isComplete: boolean;
  canAdvance: boolean;
  requiredFields: string[];
  missingFields: string[];
}

interface UseOnboardingStateReturn {
  status: CheckpointStatus | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
  advance: () => Promise<TransitionResult | null>;
  goBack: () => Promise<TransitionResult | null>;
  goTo: (checkpoint: Checkpoint) => Promise<TransitionResult | null>;
  complete: () => Promise<TransitionResult | null>;
  updateData: (data: Partial<CheckpointData>) => Promise<TransitionResult | null>;
}

export function useOnboardingState(sessionId: string | null): UseOnboardingStateReturn {
  const [status, setStatus] = useState<CheckpointStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current checkpoint status
  const refresh = useCallback(async () => {
    if (!sessionId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/onboarding/checkpoint?sessionId=${sessionId}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch checkpoint status');
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Transition helper
  const transition = useCallback(async (
    action: 'next' | 'back' | 'goto' | 'complete',
    options?: { target?: Checkpoint; data?: Partial<CheckpointData> }
  ): Promise<TransitionResult | null> => {
    if (!sessionId) return null;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/checkpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          action,
          target: options?.target,
          data: options?.data,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Transition failed');
      }

      // Refresh status after transition
      await refresh();

      return data as TransitionResult;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, refresh]);

  // Action methods
  const advance = useCallback(() => transition('next'), [transition]);

  const goBack = useCallback(() => transition('back'), [transition]);

  const goTo = useCallback(
    (checkpoint: Checkpoint) => transition('goto', { target: checkpoint }),
    [transition]
  );

  const complete = useCallback(() => transition('complete'), [transition]);

  const updateData = useCallback(
    (data: Partial<CheckpointData>) => transition('next', { data }),
    [transition]
  );

  // Initial fetch
  useEffect(() => {
    if (sessionId) {
      refresh();
    }
  }, [sessionId, refresh]);

  return {
    status,
    isLoading,
    error,
    refresh,
    advance,
    goBack,
    goTo,
    complete,
    updateData,
  };
}

export type { CheckpointStatus, TransitionResult, UseOnboardingStateReturn };
