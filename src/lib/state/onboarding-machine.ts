import { setup, assign } from 'xstate';
import type { Checkpoint } from '@/types/onboarding';

// ============================================
// TYPES
// ============================================

export interface CheckpointData {
  // Welcome
  greeted?: boolean;
  clientName?: string;

  // Business Info
  businessName?: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  services?: string[];
  businessType?: string;
  industry?: string;
  hours?: Record<string, unknown>;
  yearsInBusiness?: number;
  uniqueValue?: string;

  // Domain Access
  domainStatus?: 'has_domain' | 'no_domain' | 'needs_new';
  domainName?: string;
  registrar?: string;
  domainVerified?: boolean;
  accessMethod?: 'delegation' | 'credentials' | 'new_registration';

  // GBP
  gbpStatus?: 'found' | 'not_found' | 'needs_creation';
  placeId?: string;
  gbpName?: string;
  gbpRating?: number;
  gbpVerified?: boolean;

  // Photos
  photoStatus?: 'uploaded' | 'deferred';
  photoCount?: number;
  photoCategories?: string[];

  // Review
  confirmed?: boolean;
  editRequests?: string[];
}

export interface OnboardingContext {
  sessionId: string;
  clientId: string;
  checkpointData: CheckpointData;
  messageCount: number;
  lastActivityAt: Date;
  error?: string;
}

export type OnboardingEvent =
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'UPDATE_DATA'; data: Partial<CheckpointData> }
  | { type: 'EDIT_BUSINESS' }
  | { type: 'EDIT_DOMAIN' }
  | { type: 'EDIT_GBP' }
  | { type: 'EDIT_PHOTOS' }
  | { type: 'COMPLETE' }
  | { type: 'RESUME'; checkpoint: Checkpoint; data: CheckpointData }
  | { type: 'ERROR'; message: string }
  | { type: 'MESSAGE_SENT' };

// ============================================
// GUARD FUNCTIONS
// ============================================

function isWelcomeComplete(context: OnboardingContext): boolean {
  return context.checkpointData.greeted === true;
}

function isBusinessInfoComplete(context: OnboardingContext): boolean {
  const data = context.checkpointData;
  return !!(
    data.businessName &&
    data.email &&
    data.phone &&
    data.address?.street &&
    data.address?.city &&
    data.address?.state &&
    data.address?.zip &&
    data.services &&
    data.services.length >= 1
  );
}

function isDomainAccessComplete(context: OnboardingContext): boolean {
  const data = context.checkpointData;
  return !!(
    data.domainStatus === 'has_domain' ||
    data.domainStatus === 'needs_new' ||
    data.domainStatus === 'no_domain'
  );
}

function isGbpComplete(context: OnboardingContext): boolean {
  const data = context.checkpointData;
  return !!(
    data.gbpStatus === 'found' ||
    data.gbpStatus === 'not_found' ||
    data.gbpStatus === 'needs_creation'
  );
}

function isPhotosComplete(context: OnboardingContext): boolean {
  const data = context.checkpointData;
  return !!(
    data.photoStatus === 'uploaded' ||
    data.photoStatus === 'deferred'
  );
}

function isReviewComplete(context: OnboardingContext): boolean {
  return context.checkpointData.confirmed === true;
}

// ============================================
// STATE MACHINE
// ============================================

export const onboardingMachine = setup({
  types: {
    context: {} as OnboardingContext,
    events: {} as OnboardingEvent,
  },
  guards: {
    welcomeComplete: ({ context }) => isWelcomeComplete(context),
    businessInfoComplete: ({ context }) => isBusinessInfoComplete(context),
    domainAccessComplete: ({ context }) => isDomainAccessComplete(context),
    gbpComplete: ({ context }) => isGbpComplete(context),
    photosComplete: ({ context }) => isPhotosComplete(context),
    reviewComplete: ({ context }) => isReviewComplete(context),
  },
  actions: {
    updateCheckpointData: assign(({ context, event }) => {
      if (event.type === 'UPDATE_DATA') {
        return {
          checkpointData: {
            ...context.checkpointData,
            ...event.data,
          },
          lastActivityAt: new Date(),
        };
      }
      return { lastActivityAt: new Date() };
    }),
    incrementMessageCount: assign(({ context }) => ({
      messageCount: context.messageCount + 1,
      lastActivityAt: new Date(),
    })),
    setError: assign(({ event }) => {
      if (event.type === 'ERROR') {
        return { error: event.message };
      }
      return {};
    }),
    clearError: assign(() => ({
      error: undefined,
    })),
  },
}).createMachine({
  id: 'onboarding',
  initial: 'welcome',
  context: {
    sessionId: '',
    clientId: '',
    checkpointData: {},
    messageCount: 0,
    lastActivityAt: new Date(),
    error: undefined,
  },

  states: {
    welcome: {
      meta: {
        checkpoint: 'WELCOME' as Checkpoint,
        description: 'Greet the client and set expectations',
      },
      on: {
        UPDATE_DATA: { actions: 'updateCheckpointData' },
        MESSAGE_SENT: { actions: 'incrementMessageCount' },
        NEXT: {
          target: 'businessInfo',
          guard: 'welcomeComplete',
        },
      },
    },

    businessInfo: {
      meta: {
        checkpoint: 'BUSINESS_INFO' as Checkpoint,
        description: 'Collect core business information',
      },
      on: {
        UPDATE_DATA: { actions: 'updateCheckpointData' },
        MESSAGE_SENT: { actions: 'incrementMessageCount' },
        NEXT: {
          target: 'domainAccess',
          guard: 'businessInfoComplete',
        },
        BACK: { target: 'welcome' },
      },
    },

    domainAccess: {
      meta: {
        checkpoint: 'DOMAIN_ACCESS' as Checkpoint,
        description: 'Determine domain situation and access method',
      },
      on: {
        UPDATE_DATA: { actions: 'updateCheckpointData' },
        MESSAGE_SENT: { actions: 'incrementMessageCount' },
        NEXT: {
          target: 'gbp',
          guard: 'domainAccessComplete',
        },
        BACK: { target: 'businessInfo' },
      },
    },

    gbp: {
      meta: {
        checkpoint: 'GBP' as Checkpoint,
        description: 'Connect to or create Google Business Profile',
      },
      on: {
        UPDATE_DATA: { actions: 'updateCheckpointData' },
        MESSAGE_SENT: { actions: 'incrementMessageCount' },
        NEXT: {
          target: 'photos',
          guard: 'gbpComplete',
        },
        BACK: { target: 'domainAccess' },
      },
    },

    photos: {
      meta: {
        checkpoint: 'PHOTOS' as Checkpoint,
        description: 'Collect business photos',
      },
      on: {
        UPDATE_DATA: { actions: 'updateCheckpointData' },
        MESSAGE_SENT: { actions: 'incrementMessageCount' },
        NEXT: {
          target: 'review',
          guard: 'photosComplete',
        },
        BACK: { target: 'gbp' },
      },
    },

    review: {
      meta: {
        checkpoint: 'REVIEW' as Checkpoint,
        description: 'Review and confirm all collected information',
      },
      on: {
        UPDATE_DATA: { actions: 'updateCheckpointData' },
        MESSAGE_SENT: { actions: 'incrementMessageCount' },
        COMPLETE: {
          target: 'completed',
          guard: 'reviewComplete',
        },
        EDIT_BUSINESS: { target: 'businessInfo' },
        EDIT_DOMAIN: { target: 'domainAccess' },
        EDIT_GBP: { target: 'gbp' },
        EDIT_PHOTOS: { target: 'photos' },
        BACK: { target: 'photos' },
      },
    },

    completed: {
      type: 'final',
      meta: {
        checkpoint: 'COMPLETED' as Checkpoint,
        description: 'Onboarding is complete',
      },
    },
  },
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the checkpoint name from a state value
 */
export function getCheckpointFromState(stateValue: string): Checkpoint {
  const stateToCheckpoint: Record<string, Checkpoint> = {
    welcome: 'WELCOME',
    businessInfo: 'BUSINESS_INFO',
    domainAccess: 'DOMAIN_ACCESS',
    gbp: 'GBP',
    photos: 'PHOTOS',
    review: 'REVIEW',
    completed: 'COMPLETED',
  };
  return stateToCheckpoint[stateValue] || 'WELCOME';
}

/**
 * Get the state name from a checkpoint
 */
export function getStateFromCheckpoint(checkpoint: Checkpoint): string {
  const checkpointToState: Record<Checkpoint, string> = {
    WELCOME: 'welcome',
    BUSINESS_INFO: 'businessInfo',
    DOMAIN_ACCESS: 'domainAccess',
    GBP: 'gbp',
    PHOTOS: 'photos',
    REVIEW: 'review',
    COMPLETED: 'completed',
  };
  return checkpointToState[checkpoint] || 'welcome';
}

/**
 * Check if a transition to the next checkpoint is allowed
 */
export function canAdvance(checkpoint: Checkpoint, data: CheckpointData): boolean {
  const context: OnboardingContext = {
    sessionId: '',
    clientId: '',
    checkpointData: data,
    messageCount: 0,
    lastActivityAt: new Date(),
  };

  switch (checkpoint) {
    case 'WELCOME':
      return isWelcomeComplete(context);
    case 'BUSINESS_INFO':
      return isBusinessInfoComplete(context);
    case 'DOMAIN_ACCESS':
      return isDomainAccessComplete(context);
    case 'GBP':
      return isGbpComplete(context);
    case 'PHOTOS':
      return isPhotosComplete(context);
    case 'REVIEW':
      return isReviewComplete(context);
    default:
      return false;
  }
}

/**
 * Get required fields for a checkpoint
 */
export function getRequiredFields(checkpoint: Checkpoint): string[] {
  const requirements: Record<Checkpoint, string[]> = {
    WELCOME: ['greeted'],
    BUSINESS_INFO: ['businessName', 'email', 'phone', 'address', 'services'],
    DOMAIN_ACCESS: ['domainStatus'],
    GBP: ['gbpStatus'],
    PHOTOS: ['photoStatus'],
    REVIEW: ['confirmed'],
    COMPLETED: [],
  };
  return requirements[checkpoint] || [];
}

/**
 * Get missing fields for a checkpoint
 */
export function getMissingFields(checkpoint: Checkpoint, data: CheckpointData): string[] {
  const required = getRequiredFields(checkpoint);
  const missing: string[] = [];

  for (const field of required) {
    if (field === 'address') {
      if (!data.address?.street || !data.address?.city || !data.address?.state || !data.address?.zip) {
        missing.push('address');
      }
    } else if (field === 'services') {
      if (!data.services || data.services.length === 0) {
        missing.push('services');
      }
    } else {
      const value = data[field as keyof CheckpointData];
      if (value === undefined || value === null || value === '') {
        missing.push(field);
      }
    }
  }

  return missing;
}

/**
 * Calculate completion percentage for the overall onboarding
 */
export function getCompletionPercentage(checkpoint: Checkpoint): number {
  const percentages: Record<Checkpoint, number> = {
    WELCOME: 0,
    BUSINESS_INFO: 17,
    DOMAIN_ACCESS: 34,
    GBP: 50,
    PHOTOS: 67,
    REVIEW: 84,
    COMPLETED: 100,
  };
  return percentages[checkpoint] || 0;
}

export type OnboardingMachine = typeof onboardingMachine;
