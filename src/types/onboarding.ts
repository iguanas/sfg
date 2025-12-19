// Core types for the onboarding system

export type ClientStatus = 'PROSPECT' | 'ONBOARDING' | 'ACTIVE' | 'INACTIVE';
export type Checkpoint = 'WELCOME' | 'BUSINESS_INFO' | 'DOMAIN_ACCESS' | 'GBP' | 'PHOTOS' | 'REVIEW' | 'COMPLETED';
export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';
export type CredentialType = 'DOMAIN_REGISTRAR' | 'GOOGLE_BUSINESS' | 'OTHER';
export type PhotoCategory = 'EXTERIOR' | 'INTERIOR' | 'TEAM' | 'LOGO' | 'OTHER';
export type TaskType = 'FOLLOW_UP' | 'CREDENTIAL_VERIFICATION' | 'DOMAIN_TRANSFER' | 'GBP_VERIFICATION' | 'OTHER';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

// Business Information
export interface BusinessAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
}

export interface BusinessHours {
  mon?: { open: string; close: string } | 'closed';
  tue?: { open: string; close: string } | 'closed';
  wed?: { open: string; close: string } | 'closed';
  thu?: { open: string; close: string } | 'closed';
  fri?: { open: string; close: string } | 'closed';
  sat?: { open: string; close: string } | 'closed';
  sun?: { open: string; close: string } | 'closed';
}

export interface BusinessInfo {
  businessName: string;
  businessType?: string;
  industry?: string;
  ownerName?: string;
  email: string;
  phone: string;
  address: BusinessAddress;
  hours?: BusinessHours;
  services: string[];
  yearsInBusiness?: number;
  uniqueValue?: string;
  targetCustomer?: string;
}

// Domain Information
export interface DomainInfo {
  domainName: string;
  registrar?: string;
  expiryDate?: string;
  nameservers?: string[];
  supportssDelegation?: boolean;
}

// Google Business Profile
export interface GBPInfo {
  placeId: string;
  name: string;
  address: string;
  rating?: number;
  reviewCount?: number;
  isVerified?: boolean;
  claimStatus?: 'owned' | 'needs_claim' | 'competitor_claimed';
}

// Onboarding Session State
export interface OnboardingSessionState {
  sessionId: string;
  clientId: string;
  currentCheckpoint: Checkpoint;

  checkpointData: {
    welcome?: {
      greeted: boolean;
      clientName?: string;
    };
    businessInfo?: Partial<BusinessInfo>;
    domainAccess?: {
      hasDomain?: boolean;
      domainInfo?: DomainInfo;
      accessMethod?: 'delegation' | 'credentials' | 'new_registration';
      verified?: boolean;
    };
    gbp?: {
      found?: boolean;
      gbpInfo?: GBPInfo;
      accessRequested?: boolean;
    };
    photos?: {
      uploaded: {
        category: PhotoCategory;
        url: string;
        filename: string;
      }[];
    };
    review?: {
      confirmed: boolean;
      editRequests?: string[];
    };
  };

  startedAt: Date;
  lastActivityAt: Date;
  completedAt?: Date;
}

// Chat Message
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  isVoice?: boolean;
  extractedData?: Record<string, unknown>;
  createdAt: Date;
}

// AI Response Format
export interface AIResponse {
  message: string;
  extractedData?: Record<string, unknown>;
  confirmationNeeded?: {
    field: string;
    value: unknown;
    question: string;
  }[];
  uiAction?: {
    type: 'show_upload' | 'show_credential_form' | 'show_search' | 'show_confirmation' | 'show_domain_lookup';
    config?: Record<string, unknown>;
  };
  readyToAdvance: boolean;
  suggestedCheckpoint?: Checkpoint;
}

// Checkpoint Configuration
export interface CheckpointConfig {
  id: Checkpoint;
  name: string;
  description: string;
  requiredFields: string[];
  icon: string;
}

export const CHECKPOINT_CONFIG: Record<Checkpoint, CheckpointConfig> = {
  WELCOME: {
    id: 'WELCOME',
    name: 'Welcome',
    description: 'Introduction and setup',
    requiredFields: ['greeted'],
    icon: 'wave',
  },
  BUSINESS_INFO: {
    id: 'BUSINESS_INFO',
    name: 'Business Info',
    description: 'Tell us about your business',
    requiredFields: ['businessName', 'email', 'phone', 'address', 'services'],
    icon: 'building',
  },
  DOMAIN_ACCESS: {
    id: 'DOMAIN_ACCESS',
    name: 'Domain',
    description: 'Website domain setup',
    requiredFields: ['domainIdentified'],
    icon: 'globe',
  },
  GBP: {
    id: 'GBP',
    name: 'Google Profile',
    description: 'Google Business Profile',
    requiredFields: ['gbpIdentified'],
    icon: 'map-pin',
  },
  PHOTOS: {
    id: 'PHOTOS',
    name: 'Photos',
    description: 'Business photos',
    requiredFields: ['photosUploaded'],
    icon: 'camera',
  },
  REVIEW: {
    id: 'REVIEW',
    name: 'Review',
    description: 'Confirm your information',
    requiredFields: ['confirmed'],
    icon: 'check-circle',
  },
  COMPLETED: {
    id: 'COMPLETED',
    name: 'Complete',
    description: 'Onboarding finished',
    requiredFields: [],
    icon: 'party-popper',
  },
};

// Registrar Configuration
export interface RegistrarConfig {
  name: string;
  supportsDelegation: boolean;
  delegationEmail?: string;
  delegationInstructions?: string;
  credentialsRequired?: boolean;
}

export const REGISTRAR_CONFIG: Record<string, RegistrarConfig> = {
  godaddy: {
    name: 'GoDaddy',
    supportsDelegation: true,
    delegationEmail: 'access@setforgetgrow.com',
    delegationInstructions: 'Go to Domain Settings > Contacts > Add Delegate Access',
  },
  cloudflare: {
    name: 'Cloudflare',
    supportsDelegation: true,
    delegationEmail: 'access@setforgetgrow.com',
    delegationInstructions: 'Go to Manage Account > Members > Invite',
  },
  namecheap: {
    name: 'Namecheap',
    supportsDelegation: false,
    credentialsRequired: true,
  },
  wix: {
    name: 'Wix',
    supportsDelegation: false,
    credentialsRequired: true,
  },
  squarespace: {
    name: 'Squarespace',
    supportsDelegation: true,
    delegationEmail: 'access@setforgetgrow.com',
    delegationInstructions: 'Go to Settings > Permissions > Invite Contributor',
  },
  bluehost: {
    name: 'Bluehost',
    supportsDelegation: false,
    credentialsRequired: true,
  },
  hostgator: {
    name: 'HostGator',
    supportsDelegation: false,
    credentialsRequired: true,
  },
};
