import { z } from 'zod';

// ============================================
// VALIDATION SCHEMAS
// ============================================

export const phoneSchema = z.string().transform((val) => {
  // Remove all non-numeric characters
  const digits = val.replace(/\D/g, '');

  // Handle different formats
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return val; // Return original if can't parse
});

export const emailSchema = z.string().email().toLowerCase();

export const addressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(2).max(2).toUpperCase().optional(),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional(),
  country: z.string().default('US'),
});

export const hoursSchema = z.record(
  z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  z.union([
    z.object({
      open: z.string(),
      close: z.string(),
    }),
    z.literal('closed'),
  ])
);

export const businessInfoSchema = z.object({
  businessName: z.string().min(1),
  businessType: z.string().optional(),
  industry: z.string().optional(),
  ownerName: z.string().optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  address: addressSchema.optional(),
  hours: hoursSchema.optional(),
  services: z.array(z.string()).min(1).optional(),
  yearsInBusiness: z.number().int().positive().optional(),
  uniqueValue: z.string().optional(),
  targetCustomer: z.string().optional(),
});

// ============================================
// AI RESPONSE PARSING
// ============================================

export interface AIResponseData {
  message: string;
  extractedData: Record<string, unknown> | null;
  confirmationNeeded: Array<{
    field: string;
    value: unknown;
    question: string;
  }>;
  readyToAdvance: boolean;
  uiAction: {
    type: string;
    config?: Record<string, unknown>;
  } | null;
}

/**
 * Parse and validate AI response JSON
 */
export function parseAIResponse(responseText: string): AIResponseData {
  // Try to extract JSON from the response
  let jsonString = responseText.trim();

  // If response is wrapped in markdown code blocks, extract the JSON
  const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonString = jsonMatch[1].trim();
  }

  // Try to find JSON object in the response
  const jsonObjectMatch = jsonString.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    jsonString = jsonObjectMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonString);

    return {
      message: parsed.message || responseText,
      extractedData: parsed.extractedData || null,
      confirmationNeeded: parsed.confirmationNeeded || [],
      readyToAdvance: parsed.readyToAdvance || false,
      uiAction: parsed.uiAction || null,
    };
  } catch {
    // If JSON parsing fails, return the raw message
    return {
      message: responseText,
      extractedData: null,
      confirmationNeeded: [],
      readyToAdvance: false,
      uiAction: null,
    };
  }
}

// ============================================
// DATA NORMALIZATION
// ============================================

/**
 * Normalize phone number to consistent format
 */
export function normalizePhone(phone: string): string {
  const result = phoneSchema.safeParse(phone);
  return result.success ? result.data : phone;
}

/**
 * Normalize email to lowercase
 */
export function normalizeEmail(email: string): string {
  const result = emailSchema.safeParse(email);
  return result.success ? result.data : email.toLowerCase();
}

/**
 * Parse time string to 24-hour format
 */
export function parseTime(timeStr: string): string {
  const normalized = timeStr.toLowerCase().trim();

  // Handle common formats
  const patterns = [
    // "9am", "9 am", "9:00am", "9:00 am"
    /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i,
    // "9:00", "09:00"
    /^(\d{1,2}):(\d{2})$/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      const meridiem = match[3]?.toLowerCase();

      if (meridiem === 'pm' && hours !== 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;

      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }

  return timeStr;
}

/**
 * Parse business hours from natural language
 */
export function parseBusinessHours(hoursText: string): Record<string, { open: string; close: string } | 'closed'> {
  const hours: Record<string, { open: string; close: string } | 'closed'> = {};
  const dayMap: Record<string, string> = {
    monday: 'mon', mon: 'mon', m: 'mon',
    tuesday: 'tue', tue: 'tue', tu: 'tue', t: 'tue',
    wednesday: 'wed', wed: 'wed', w: 'wed',
    thursday: 'thu', thu: 'thu', th: 'thu',
    friday: 'fri', fri: 'fri', f: 'fri',
    saturday: 'sat', sat: 'sat', sa: 'sat',
    sunday: 'sun', sun: 'sun', su: 'sun',
  };

  const normalized = hoursText.toLowerCase();

  // Check for "closed" days
  if (normalized.includes('closed')) {
    const closedDays = ['sat', 'sun']; // Default assumption
    for (const day of closedDays) {
      hours[day] = 'closed';
    }
  }

  // Look for time ranges like "9-5", "9am-5pm", "9:00-17:00"
  const timeRangeMatch = normalized.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);

  if (timeRangeMatch) {
    const open = parseTime(timeRangeMatch[1]);
    const close = parseTime(timeRangeMatch[2]);

    // Apply to weekdays by default
    const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri'];
    for (const day of weekdays) {
      if (!hours[day]) {
        hours[day] = { open, close };
      }
    }
  }

  return hours;
}

/**
 * Parse address from natural language
 */
export function parseAddress(addressText: string): Partial<z.infer<typeof addressSchema>> {
  const address: Partial<z.infer<typeof addressSchema>> = {};

  // Try to extract ZIP code
  const zipMatch = addressText.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zipMatch) {
    address.zip = zipMatch[1];
  }

  // Try to extract state (2-letter abbreviation)
  const stateMatch = addressText.match(/\b([A-Z]{2})\b/);
  if (stateMatch) {
    address.state = stateMatch[1];
  }

  // Common US state names to abbreviations
  const stateNames: Record<string, string> = {
    alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
    colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
    hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
    kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
    massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
    montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
    'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
    oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
    virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
  };

  for (const [name, abbr] of Object.entries(stateNames)) {
    if (addressText.toLowerCase().includes(name)) {
      address.state = abbr;
      break;
    }
  }

  return address;
}

// ============================================
// DATA MERGING
// ============================================

/**
 * Merge new extracted data with existing data
 * New values override old values, but we don't delete existing data
 */
export function mergeExtractedData(
  existing: Record<string, unknown>,
  newData: Record<string, unknown> | null
): Record<string, unknown> {
  if (!newData) return existing;

  const merged = { ...existing };

  for (const [key, value] of Object.entries(newData)) {
    if (value === null || value === undefined) continue;

    if (Array.isArray(value) && Array.isArray(merged[key])) {
      // Merge arrays, avoiding duplicates
      const existingArray = merged[key] as unknown[];
      merged[key] = [...new Set([...existingArray, ...value])];
    } else if (typeof value === 'object' && typeof merged[key] === 'object' && !Array.isArray(value)) {
      // Deep merge objects
      merged[key] = mergeExtractedData(
        merged[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      // Override with new value
      merged[key] = value;
    }
  }

  return merged;
}

/**
 * Extract services from a text description
 */
export function extractServices(text: string): string[] {
  const services: string[] = [];

  // Common service indicators
  const servicePatterns = [
    /(?:we (?:do|offer|provide|specialize in)|services include|our services)[:\s]+([^.]+)/gi,
    /(?:specializ(?:e|ing) in)[:\s]+([^.]+)/gi,
  ];

  for (const pattern of servicePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      // Split by common delimiters
      const serviceList = match[1].split(/[,;]|(?:\s+and\s+)/i);
      services.push(...serviceList.map(s => s.trim()).filter(s => s.length > 0));
    }
  }

  return [...new Set(services)];
}
