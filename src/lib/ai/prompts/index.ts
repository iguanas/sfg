import { BASE_SYSTEM_PROMPT, CHECKPOINT_REQUIREMENTS } from './base-system';
import { getWelcomePrompt } from './checkpoint-welcome';
import { getBusinessInfoPrompt } from './checkpoint-business';
import { getDomainAccessPrompt } from './checkpoint-domain';
import { getGBPPrompt } from './checkpoint-gbp';
import { getPhotosPrompt } from './checkpoint-photos';
import { getReviewPrompt } from './checkpoint-review';
import type { Checkpoint } from '@/types/onboarding';

export interface PromptContext {
  checkpoint: Checkpoint;
  clientName?: string;
  businessName?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  checkpointData: Record<string, unknown>;
  allCollectedData: Record<string, unknown>;
}

/**
 * Get the full system prompt for the current checkpoint
 */
export function getSystemPrompt(context: PromptContext): string {
  const { checkpoint, clientName, businessName, address, checkpointData, allCollectedData } = context;

  let checkpointPrompt: string;

  switch (checkpoint) {
    case 'WELCOME':
      checkpointPrompt = getWelcomePrompt(clientName);
      break;
    case 'BUSINESS_INFO':
      checkpointPrompt = getBusinessInfoPrompt(checkpointData);
      break;
    case 'DOMAIN_ACCESS':
      checkpointPrompt = getDomainAccessPrompt(checkpointData, businessName);
      break;
    case 'GBP':
      checkpointPrompt = getGBPPrompt(checkpointData, businessName, address);
      break;
    case 'PHOTOS':
      checkpointPrompt = getPhotosPrompt(checkpointData);
      break;
    case 'REVIEW':
      checkpointPrompt = getReviewPrompt(allCollectedData);
      break;
    case 'COMPLETED':
      checkpointPrompt = 'Onboarding is complete. Thank the user and let them know next steps.';
      break;
    default:
      checkpointPrompt = '';
  }

  return `${BASE_SYSTEM_PROMPT}\n\n${checkpointPrompt}`;
}

/**
 * Check if all required fields for a checkpoint are collected
 */
export function isCheckpointComplete(
  checkpoint: Checkpoint,
  data: Record<string, unknown>
): boolean {
  const requirements = CHECKPOINT_REQUIREMENTS[checkpoint];
  if (!requirements) return true;

  return requirements.required.every((field) => {
    const value = data[field];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0;
    return value !== undefined && value !== null && value !== '';
  });
}

/**
 * Get the next checkpoint in the sequence
 */
export function getNextCheckpoint(current: Checkpoint): Checkpoint {
  const order: Checkpoint[] = [
    'WELCOME',
    'BUSINESS_INFO',
    'DOMAIN_ACCESS',
    'GBP',
    'PHOTOS',
    'REVIEW',
    'COMPLETED',
  ];

  const currentIndex = order.indexOf(current);
  if (currentIndex === -1 || currentIndex === order.length - 1) {
    return 'COMPLETED';
  }

  return order[currentIndex + 1];
}

/**
 * Get list of missing required fields for a checkpoint
 */
export function getMissingFields(
  checkpoint: Checkpoint,
  data: Record<string, unknown>
): string[] {
  const requirements = CHECKPOINT_REQUIREMENTS[checkpoint];
  if (!requirements) return [];

  return requirements.required.filter((field) => {
    const value = data[field];
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object' && value !== null) return Object.keys(value).length === 0;
    return value === undefined || value === null || value === '';
  });
}

export {
  BASE_SYSTEM_PROMPT,
  CHECKPOINT_REQUIREMENTS,
  getWelcomePrompt,
  getBusinessInfoPrompt,
  getDomainAccessPrompt,
  getGBPPrompt,
  getPhotosPrompt,
  getReviewPrompt,
};
