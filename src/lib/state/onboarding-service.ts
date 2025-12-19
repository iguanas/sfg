import { createActor } from 'xstate';
import { prisma } from '@/lib/db/prisma';
import {
  onboardingMachine,
  getCheckpointFromState,
  type OnboardingEvent,
  type CheckpointData,
} from './onboarding-machine';
import type { Checkpoint } from '@/types/onboarding';

// ============================================
// ONBOARDING STATE SERVICE
// ============================================

export class OnboardingStateService {
  private sessionId: string;
  private actor: ReturnType<typeof createActor<typeof onboardingMachine>> | null = null;
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private saveDebounceMs: number = 2000;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Initialize the state machine
   */
  async initialize(options?: {
    clientId?: string;
    existingData?: CheckpointData;
    currentCheckpoint?: Checkpoint;
  }): Promise<void> {
    // Try to load existing state from database
    const session = await prisma.onboardingSession.findUnique({
      where: { id: this.sessionId },
      select: {
        clientId: true,
        currentCheckpoint: true,
        checkpointData: true,
      },
    });

    // Create new actor
    this.actor = createActor(onboardingMachine, {
      input: {
        sessionId: this.sessionId,
        clientId: options?.clientId || session?.clientId || '',
        checkpointData: options?.existingData || (session?.checkpointData as CheckpointData) || {},
      },
    });

    // Subscribe to state changes for auto-save
    this.actor.subscribe((state) => {
      this.debouncedSave(state);
    });

    this.actor.start();
  }

  /**
   * Get current state snapshot
   */
  getSnapshot() {
    if (!this.actor) {
      throw new Error('State machine not initialized');
    }
    return this.actor.getSnapshot();
  }

  /**
   * Get current checkpoint
   */
  getCurrentCheckpoint(): Checkpoint {
    const snapshot = this.getSnapshot();
    const stateValue = typeof snapshot.value === 'string'
      ? snapshot.value
      : Object.keys(snapshot.value)[0];
    return getCheckpointFromState(stateValue);
  }

  /**
   * Get current checkpoint data
   */
  getCheckpointData(): CheckpointData {
    return this.getSnapshot().context.checkpointData;
  }

  /**
   * Send an event to the state machine
   */
  send(event: OnboardingEvent): void {
    if (!this.actor) {
      throw new Error('State machine not initialized');
    }
    this.actor.send(event);
  }

  /**
   * Update checkpoint data
   */
  updateData(data: Partial<CheckpointData>): void {
    this.send({ type: 'UPDATE_DATA', data });
  }

  /**
   * Try to advance to the next checkpoint
   */
  tryAdvance(): boolean {
    const snapshot = this.getSnapshot();
    const canTransition = snapshot.can({ type: 'NEXT' });
    if (canTransition) {
      this.send({ type: 'NEXT' });
      return true;
    }
    return false;
  }

  /**
   * Go back to the previous checkpoint
   */
  goBack(): boolean {
    const snapshot = this.getSnapshot();
    const canTransition = snapshot.can({ type: 'BACK' });
    if (canTransition) {
      this.send({ type: 'BACK' });
      return true;
    }
    return false;
  }

  /**
   * Complete the onboarding process
   */
  complete(): boolean {
    const snapshot = this.getSnapshot();
    const canComplete = snapshot.can({ type: 'COMPLETE' });
    if (canComplete) {
      this.send({ type: 'COMPLETE' });
      return true;
    }
    return false;
  }

  /**
   * Record a message being sent (for tracking)
   */
  recordMessage(): void {
    this.send({ type: 'MESSAGE_SENT' });
  }

  /**
   * Check if we can advance to the next checkpoint
   */
  canAdvance(): boolean {
    return this.getSnapshot().can({ type: 'NEXT' });
  }

  /**
   * Check if we can go back
   */
  canGoBack(): boolean {
    return this.getSnapshot().can({ type: 'BACK' });
  }

  /**
   * Check if onboarding is complete
   */
  isComplete(): boolean {
    return this.getSnapshot().status === 'done';
  }

  /**
   * Debounced save to database
   */
  private debouncedSave(state: ReturnType<typeof this.getSnapshot>): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    this.saveDebounceTimer = setTimeout(async () => {
      await this.saveToDatabase(state);
    }, this.saveDebounceMs);
  }

  /**
   * Save current state to database
   */
  private async saveToDatabase(state: ReturnType<typeof this.getSnapshot>): Promise<void> {
    try {
      const checkpoint = this.getCurrentCheckpoint();

      await prisma.onboardingSession.update({
        where: { id: this.sessionId },
        data: {
          currentCheckpoint: checkpoint,
          checkpointData: JSON.parse(JSON.stringify(state.context.checkpointData)),
          lastActivityAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to save state to database:', error);
    }
  }

  /**
   * Force save immediately (useful before page unload)
   */
  async forceSave(): Promise<void> {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    await this.saveToDatabase(this.getSnapshot());
  }

  /**
   * Stop the state machine and clean up
   */
  stop(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    if (this.actor) {
      this.actor.stop();
      this.actor = null;
    }
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

/**
 * Create and initialize an onboarding state service
 */
export async function createOnboardingService(
  sessionId: string,
  options?: {
    clientId?: string;
    existingData?: CheckpointData;
    currentCheckpoint?: Checkpoint;
  }
): Promise<OnboardingStateService> {
  const service = new OnboardingStateService(sessionId);
  await service.initialize(options);
  return service;
}
