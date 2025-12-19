export {
  onboardingMachine,
  getCheckpointFromState,
  getStateFromCheckpoint,
  canAdvance,
  getRequiredFields,
  getMissingFields,
  getCompletionPercentage,
  type OnboardingContext,
  type OnboardingEvent,
  type CheckpointData,
  type OnboardingMachine,
} from './onboarding-machine';

export {
  OnboardingStateService,
  createOnboardingService,
} from './onboarding-service';
