/**
 * Namecheap API Client
 *
 * Checks domain availability and handles domain registration
 * for clients who need a new domain.
 */

// ============================================
// TYPES
// ============================================

export interface DomainAvailability {
  domain: string;
  available: boolean;
  premium: boolean;
  premiumPrice?: number;
  regularPrice?: number;
  currency: string;
  icannFee?: number;
}

export interface DomainSuggestion {
  domain: string;
  available: boolean;
  price: number;
  currency: string;
}

export interface DomainRegistrationResult {
  success: boolean;
  domain: string;
  orderId?: string;
  transactionId?: string;
  chargedAmount?: number;
  error?: string;
}

// Common TLDs to check for suggestions
const COMMON_TLDS = ['.com', '.net', '.org', '.co', '.io', '.biz', '.info', '.us'];

// ============================================
// NAMECHEAP CLIENT
// ============================================

export class NamecheapClient {
  private apiUser: string | null;
  private apiKey: string | null;
  private username: string | null;
  private sandbox: boolean;
  private baseUrl: string;

  constructor() {
    this.apiUser = process.env.NAMECHEAP_API_USER || null;
    this.apiKey = process.env.NAMECHEAP_API_KEY || null;
    this.username = process.env.NAMECHEAP_USERNAME || null;
    this.sandbox = process.env.NAMECHEAP_SANDBOX === 'true';

    this.baseUrl = this.sandbox
      ? 'https://api.sandbox.namecheap.com/xml.response'
      : 'https://api.namecheap.com/xml.response';
  }

  /**
   * Check if a single domain is available
   */
  async checkAvailability(domain: string): Promise<DomainAvailability> {
    const normalizedDomain = this.normalizeDomain(domain);

    if (!this.isConfigured()) {
      console.log('Namecheap not configured, returning mock data');
      return this.getMockAvailability(normalizedDomain);
    }

    try {
      const clientIp = await this.getClientIp();
      const url = this.buildUrl('namecheap.domains.check', {
        DomainList: normalizedDomain,
        ClientIp: clientIp,
      });

      const response = await fetch(url);
      const text = await response.text();

      return this.parseAvailabilityResponse(normalizedDomain, text);
    } catch (error) {
      console.error('Namecheap availability check error:', error);
      throw error;
    }
  }

  /**
   * Check availability for multiple domains at once
   */
  async checkMultipleAvailability(domains: string[]): Promise<DomainAvailability[]> {
    const normalizedDomains = domains.map((d) => this.normalizeDomain(d));

    if (!this.isConfigured()) {
      console.log('Namecheap not configured, returning mock data');
      return normalizedDomains.map((d) => this.getMockAvailability(d));
    }

    try {
      const clientIp = await this.getClientIp();
      const url = this.buildUrl('namecheap.domains.check', {
        DomainList: normalizedDomains.join(','),
        ClientIp: clientIp,
      });

      const response = await fetch(url);
      const text = await response.text();

      return this.parseMultipleAvailabilityResponse(normalizedDomains, text);
    } catch (error) {
      console.error('Namecheap multi-availability check error:', error);
      throw error;
    }
  }

  /**
   * Get domain suggestions based on a keyword
   */
  async getSuggestions(keyword: string): Promise<DomainSuggestion[]> {
    // Generate variations to check
    const baseName = keyword
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 63);

    const domainsToCheck = COMMON_TLDS.map((tld) => `${baseName}${tld}`);

    // Also add some variations
    const variations = [
      `get${baseName}`,
      `${baseName}hq`,
      `${baseName}co`,
      `my${baseName}`,
      `the${baseName}`,
    ];

    for (const variation of variations) {
      domainsToCheck.push(`${variation}.com`);
    }

    // Check availability
    const availabilities = await this.checkMultipleAvailability(domainsToCheck);

    // Filter to available domains and format as suggestions
    return availabilities
      .filter((a) => a.available)
      .map((a) => ({
        domain: a.domain,
        available: true,
        price: a.regularPrice || 12.99,
        currency: a.currency,
      }))
      .sort((a, b) => {
        // Prioritize .com domains
        const aIsCom = a.domain.endsWith('.com');
        const bIsCom = b.domain.endsWith('.com');
        if (aIsCom && !bIsCom) return -1;
        if (!aIsCom && bIsCom) return 1;
        return a.price - b.price;
      });
  }

  /**
   * Get pricing for a domain
   */
  async getPricing(domain: string): Promise<{
    registration: number;
    renewal: number;
    transfer: number;
    currency: string;
  }> {
    const normalizedDomain = this.normalizeDomain(domain);
    const tld = this.extractTld(normalizedDomain);

    if (!this.isConfigured()) {
      return this.getMockPricing(tld);
    }

    try {
      const clientIp = await this.getClientIp();
      const url = this.buildUrl('namecheap.users.getPricing', {
        ProductType: 'DOMAIN',
        ProductCategory: 'DOMAINS',
        ProductName: tld.replace('.', ''),
        ClientIp: clientIp,
      });

      const response = await fetch(url);
      const text = await response.text();

      return this.parsePricingResponse(text, tld);
    } catch (error) {
      console.error('Namecheap pricing error:', error);
      return this.getMockPricing(tld);
    }
  }

  /**
   * Check if Namecheap API is configured
   */
  isConfigured(): boolean {
    return !!(this.apiUser && this.apiKey && this.username);
  }

  /**
   * Normalize a domain name
   */
  private normalizeDomain(domain: string): string {
    let normalized = domain.toLowerCase().trim();

    // Remove protocol
    normalized = normalized.replace(/^https?:\/\//, '');

    // Remove www
    normalized = normalized.replace(/^www\./, '');

    // Remove trailing slash and path
    normalized = normalized.split('/')[0];

    // Remove port
    normalized = normalized.split(':')[0];

    // Add .com if no TLD present
    if (!normalized.includes('.')) {
      normalized += '.com';
    }

    return normalized;
  }

  /**
   * Extract TLD from domain
   */
  private extractTld(domain: string): string {
    const parts = domain.split('.');
    return '.' + parts.slice(1).join('.');
  }

  /**
   * Build API URL with parameters
   */
  private buildUrl(command: string, params: Record<string, string>): string {
    const url = new URL(this.baseUrl);
    url.searchParams.set('ApiUser', this.apiUser!);
    url.searchParams.set('ApiKey', this.apiKey!);
    url.searchParams.set('UserName', this.username!);
    url.searchParams.set('Command', command);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  /**
   * Get client IP (required for Namecheap API)
   */
  private async getClientIp(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      // Fallback for development
      return '127.0.0.1';
    }
  }

  /**
   * Parse availability response XML
   */
  private parseAvailabilityResponse(domain: string, xml: string): DomainAvailability {
    // Simple XML parsing (in production, use a proper XML parser)
    const availableMatch = xml.match(/Available="([^"]+)"/);
    const premiumMatch = xml.match(/IsPremiumName="([^"]+)"/);
    const priceMatch = xml.match(/PremiumRegistrationPrice="([^"]+)"/);

    const available = availableMatch?.[1] === 'true';
    const premium = premiumMatch?.[1] === 'true';
    const premiumPrice = priceMatch ? parseFloat(priceMatch[1]) : undefined;

    return {
      domain,
      available,
      premium,
      premiumPrice,
      regularPrice: premium ? premiumPrice : 12.99,
      currency: 'USD',
      icannFee: 0.18,
    };
  }

  /**
   * Parse multiple availability response XML
   */
  private parseMultipleAvailabilityResponse(
    domains: string[],
    xml: string
  ): DomainAvailability[] {
    const results: DomainAvailability[] = [];

    // Simple regex-based parsing
    const domainMatches = xml.matchAll(
      /Domain="([^"]+)".*?Available="([^"]+)".*?IsPremiumName="([^"]+)"/g
    );

    const parsed = new Map<string, DomainAvailability>();

    for (const match of domainMatches) {
      const [, domain, available, premium] = match;
      parsed.set(domain.toLowerCase(), {
        domain,
        available: available === 'true',
        premium: premium === 'true',
        regularPrice: 12.99,
        currency: 'USD',
        icannFee: 0.18,
      });
    }

    // Return in original order
    for (const domain of domains) {
      const result = parsed.get(domain.toLowerCase());
      if (result) {
        results.push(result);
      } else {
        // If not found in response, mark as unavailable
        results.push({
          domain,
          available: false,
          premium: false,
          regularPrice: 12.99,
          currency: 'USD',
        });
      }
    }

    return results;
  }

  /**
   * Parse pricing response XML
   */
  private parsePricingResponse(
    xml: string,
    _tld: string
  ): { registration: number; renewal: number; transfer: number; currency: string } {
    // Simple XML parsing
    const regMatch = xml.match(/ActionName="register".*?Price="([^"]+)"/);
    const renewMatch = xml.match(/ActionName="renew".*?Price="([^"]+)"/);
    const transferMatch = xml.match(/ActionName="transfer".*?Price="([^"]+)"/);

    return {
      registration: regMatch ? parseFloat(regMatch[1]) : 12.99,
      renewal: renewMatch ? parseFloat(renewMatch[1]) : 14.99,
      transfer: transferMatch ? parseFloat(transferMatch[1]) : 9.99,
      currency: 'USD',
    };
  }

  /**
   * Get mock availability for development
   */
  private getMockAvailability(domain: string): DomainAvailability {
    // Simulate some domains being taken
    const takenDomains = ['google.com', 'facebook.com', 'amazon.com', 'apple.com'];

    const available = !takenDomains.includes(domain.toLowerCase());

    return {
      domain,
      available,
      premium: false,
      regularPrice: 12.99,
      currency: 'USD',
      icannFee: 0.18,
    };
  }

  /**
   * Get mock pricing for development
   */
  private getMockPricing(tld: string): {
    registration: number;
    renewal: number;
    transfer: number;
    currency: string;
  } {
    const pricing: Record<string, { registration: number; renewal: number; transfer: number }> = {
      '.com': { registration: 12.99, renewal: 14.99, transfer: 9.99 },
      '.net': { registration: 14.99, renewal: 16.99, transfer: 11.99 },
      '.org': { registration: 13.99, renewal: 15.99, transfer: 10.99 },
      '.co': { registration: 29.99, renewal: 29.99, transfer: 29.99 },
      '.io': { registration: 44.99, renewal: 44.99, transfer: 44.99 },
    };

    const prices = pricing[tld] || { registration: 12.99, renewal: 14.99, transfer: 9.99 };

    return {
      ...prices,
      currency: 'USD',
    };
  }
}

// Export singleton instance
export const namecheapClient = new NamecheapClient();
