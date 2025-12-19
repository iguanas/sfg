/**
 * WHOIS Domain Lookup Client
 *
 * Looks up domain registration info to detect the registrar
 * and determine if delegation access or credentials are needed.
 */

// ============================================
// TYPES
// ============================================

export interface WhoisResult {
  domain: string;
  registrar: string | null;
  registrarId: string | null;
  nameservers: string[];
  createdDate: string | null;
  expiryDate: string | null;
  updatedDate: string | null;
  status: string[];
  dnssec: boolean;
  raw?: string;
}

export interface RegistrarInfo {
  id: string;
  name: string;
  supportsDelegation: boolean;
  delegationInstructions?: string;
  credentialsRequired: boolean;
  loginUrl?: string;
}

// ============================================
// REGISTRAR DATABASE
// ============================================

export const KNOWN_REGISTRARS: Record<string, RegistrarInfo> = {
  godaddy: {
    id: 'godaddy',
    name: 'GoDaddy',
    supportsDelegation: true,
    delegationInstructions:
      'Go to your GoDaddy account > Domain Settings > Contacts > Add Delegate Access. Add the email: access@setforgetgrow.com',
    credentialsRequired: false,
    loginUrl: 'https://sso.godaddy.com/',
  },
  cloudflare: {
    id: 'cloudflare',
    name: 'Cloudflare',
    supportsDelegation: true,
    delegationInstructions:
      'Go to Cloudflare Dashboard > Manage Account > Members > Invite. Add access@setforgetgrow.com as Administrator.',
    credentialsRequired: false,
    loginUrl: 'https://dash.cloudflare.com/',
  },
  namecheap: {
    id: 'namecheap',
    name: 'Namecheap',
    supportsDelegation: false,
    credentialsRequired: true,
    loginUrl: 'https://www.namecheap.com/myaccount/login/',
  },
  squarespace: {
    id: 'squarespace',
    name: 'Squarespace',
    supportsDelegation: true,
    delegationInstructions:
      'Go to Settings > Permissions > Invite Contributor. Add access@setforgetgrow.com with Website Manager permissions.',
    credentialsRequired: false,
    loginUrl: 'https://account.squarespace.com/',
  },
  wix: {
    id: 'wix',
    name: 'Wix',
    supportsDelegation: false,
    credentialsRequired: true,
    loginUrl: 'https://users.wix.com/signin',
  },
  bluehost: {
    id: 'bluehost',
    name: 'Bluehost',
    supportsDelegation: false,
    credentialsRequired: true,
    loginUrl: 'https://my.bluehost.com/cgi/home',
  },
  hostgator: {
    id: 'hostgator',
    name: 'HostGator',
    supportsDelegation: false,
    credentialsRequired: true,
    loginUrl: 'https://portal.hostgator.com/',
  },
  hover: {
    id: 'hover',
    name: 'Hover',
    supportsDelegation: true,
    delegationInstructions:
      'Contact Hover support to add access@setforgetgrow.com as an authorized user.',
    credentialsRequired: false,
    loginUrl: 'https://www.hover.com/signin',
  },
  netlify: {
    id: 'netlify',
    name: 'Netlify',
    supportsDelegation: true,
    delegationInstructions:
      'Go to Team Settings > Members > Invite. Add access@setforgetgrow.com as a team member.',
    credentialsRequired: false,
    loginUrl: 'https://app.netlify.com/',
  },
  vercel: {
    id: 'vercel',
    name: 'Vercel',
    supportsDelegation: true,
    delegationInstructions:
      'Go to Team Settings > Members. Invite access@setforgetgrow.com as a team member.',
    credentialsRequired: false,
    loginUrl: 'https://vercel.com/login',
  },
  ionos: {
    id: 'ionos',
    name: 'IONOS (1&1)',
    supportsDelegation: false,
    credentialsRequired: true,
    loginUrl: 'https://my.ionos.com/',
  },
  networksolutions: {
    id: 'networksolutions',
    name: 'Network Solutions',
    supportsDelegation: false,
    credentialsRequired: true,
    loginUrl: 'https://www.networksolutions.com/manage-it/index.jsp',
  },
  googledomains: {
    id: 'googledomains',
    name: 'Google Domains (Squarespace)',
    supportsDelegation: true,
    delegationInstructions:
      'Google Domains was transferred to Squarespace. Go to Squarespace > Settings > Permissions to add delegate access.',
    credentialsRequired: false,
    loginUrl: 'https://domains.squarespace.com/',
  },
  dynadot: {
    id: 'dynadot',
    name: 'Dynadot',
    supportsDelegation: false,
    credentialsRequired: true,
    loginUrl: 'https://www.dynadot.com/account/signin.html',
  },
  porkbun: {
    id: 'porkbun',
    name: 'Porkbun',
    supportsDelegation: false,
    credentialsRequired: true,
    loginUrl: 'https://porkbun.com/account/login',
  },
};

// Nameserver patterns to detect registrars
const NAMESERVER_PATTERNS: [RegExp, string][] = [
  [/domaincontrol\.com$/i, 'godaddy'],
  [/cloudflare\.com$/i, 'cloudflare'],
  [/registrar-servers\.com$/i, 'namecheap'],
  [/squarespace\.com$/i, 'squarespace'],
  [/wixdns\.net$/i, 'wix'],
  [/bluehost\.com$/i, 'bluehost'],
  [/hostgator\.com$/i, 'hostgator'],
  [/hover\.com$/i, 'hover'],
  [/netlify\.com$/i, 'netlify'],
  [/vercel-dns\.com$/i, 'vercel'],
  [/ui-dns\.com$/i, 'ionos'],
  [/ui-dns\.org$/i, 'ionos'],
  [/ui-dns\.biz$/i, 'ionos'],
  [/worldnic\.com$/i, 'networksolutions'],
  [/googledomains\.com$/i, 'googledomains'],
  [/dynadot\.com$/i, 'dynadot'],
  [/porkbun\.com$/i, 'porkbun'],
];

// Registrar name patterns from WHOIS data
const REGISTRAR_NAME_PATTERNS: [RegExp, string][] = [
  [/godaddy/i, 'godaddy'],
  [/cloudflare/i, 'cloudflare'],
  [/namecheap/i, 'namecheap'],
  [/squarespace/i, 'squarespace'],
  [/wix\.com/i, 'wix'],
  [/bluehost/i, 'bluehost'],
  [/hostgator/i, 'hostgator'],
  [/hover/i, 'hover'],
  [/netlify/i, 'netlify'],
  [/vercel/i, 'vercel'],
  [/ionos|1&1/i, 'ionos'],
  [/network solutions/i, 'networksolutions'],
  [/google/i, 'googledomains'],
  [/dynadot/i, 'dynadot'],
  [/porkbun/i, 'porkbun'],
];

// ============================================
// WHOIS CLIENT
// ============================================

export class WhoisClient {
  private apiKey: string | null;
  private baseUrl: string = 'https://www.whoisxmlapi.com/whoisserver/WhoisService';

  constructor() {
    this.apiKey = process.env.WHOIS_API_KEY || null;
  }

  /**
   * Look up domain WHOIS information
   */
  async lookup(domain: string): Promise<WhoisResult> {
    // Normalize domain (remove protocol, www, trailing slash)
    const normalizedDomain = this.normalizeDomain(domain);

    if (!this.apiKey) {
      // Return mock data if no API key (for development)
      console.log('No WHOIS_API_KEY configured, returning mock data');
      return this.getMockResult(normalizedDomain);
    }

    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set('apiKey', this.apiKey);
      url.searchParams.set('domainName', normalizedDomain);
      url.searchParams.set('outputFormat', 'JSON');

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`WHOIS API error: ${response.status}`);
      }

      const data = await response.json();
      return this.parseWhoisResponse(normalizedDomain, data);
    } catch (error) {
      console.error('WHOIS lookup error:', error);
      throw error;
    }
  }

  /**
   * Detect the registrar from WHOIS data
   */
  detectRegistrar(whoisResult: WhoisResult): RegistrarInfo | null {
    // Try to detect from registrar name first
    if (whoisResult.registrar) {
      for (const [pattern, registrarId] of REGISTRAR_NAME_PATTERNS) {
        if (pattern.test(whoisResult.registrar)) {
          return KNOWN_REGISTRARS[registrarId] || null;
        }
      }
    }

    // Fall back to nameserver detection
    for (const ns of whoisResult.nameservers) {
      for (const [pattern, registrarId] of NAMESERVER_PATTERNS) {
        if (pattern.test(ns)) {
          return KNOWN_REGISTRARS[registrarId] || null;
        }
      }
    }

    return null;
  }

  /**
   * Get instructions for accessing a domain based on registrar
   */
  getAccessInstructions(registrarInfo: RegistrarInfo | null): {
    method: 'delegation' | 'credentials' | 'unknown';
    instructions: string;
    loginUrl?: string;
  } {
    if (!registrarInfo) {
      return {
        method: 'unknown',
        instructions:
          "We couldn't identify your domain registrar. You can either share your login credentials securely, or contact your domain provider to add access@setforgetgrow.com as an authorized user.",
      };
    }

    if (registrarInfo.supportsDelegation) {
      return {
        method: 'delegation',
        instructions:
          registrarInfo.delegationInstructions ||
          `Please add access@setforgetgrow.com as a delegate user in your ${registrarInfo.name} account.`,
        loginUrl: registrarInfo.loginUrl,
      };
    }

    return {
      method: 'credentials',
      instructions: `${registrarInfo.name} doesn't support delegate access. We'll need your login credentials to manage your domain. Your credentials are encrypted and stored securely.`,
      loginUrl: registrarInfo.loginUrl,
    };
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

    return normalized;
  }

  /**
   * Parse WHOIS API response
   */
  private parseWhoisResponse(domain: string, data: Record<string, unknown>): WhoisResult {
    const whoisRecord = data.WhoisRecord as Record<string, unknown> || {};
    const registryData = whoisRecord.registryData as Record<string, unknown> || {};

    // Get nameservers
    let nameservers: string[] = [];
    const nsData = registryData.nameServers || whoisRecord.nameServers;
    if (nsData) {
      if (typeof nsData === 'object' && 'hostNames' in (nsData as Record<string, unknown>)) {
        nameservers = ((nsData as Record<string, unknown>).hostNames as string[]) || [];
      } else if (Array.isArray(nsData)) {
        nameservers = nsData;
      }
    }

    // Get status
    let status: string[] = [];
    const statusData = registryData.status || whoisRecord.status;
    if (typeof statusData === 'string') {
      status = [statusData];
    } else if (Array.isArray(statusData)) {
      status = statusData;
    }

    return {
      domain,
      registrar: (whoisRecord.registrarName as string) || null,
      registrarId: (whoisRecord.registrarIANAID as string) || null,
      nameservers,
      createdDate: (registryData.createdDate as string) || (whoisRecord.createdDate as string) || null,
      expiryDate: (registryData.expiresDate as string) || (whoisRecord.expiresDate as string) || null,
      updatedDate: (registryData.updatedDate as string) || (whoisRecord.updatedDate as string) || null,
      status,
      dnssec: (whoisRecord.dnssec as string) === 'signedDelegation',
      raw: JSON.stringify(data),
    };
  }

  /**
   * Get mock WHOIS result for development
   */
  private getMockResult(domain: string): WhoisResult {
    // Return different mock data based on domain for testing
    const mockRegistrars: Record<string, Partial<WhoisResult>> = {
      'example-godaddy.com': {
        registrar: 'GoDaddy.com, LLC',
        nameservers: ['ns1.domaincontrol.com', 'ns2.domaincontrol.com'],
      },
      'example-cloudflare.com': {
        registrar: 'Cloudflare, Inc.',
        nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      },
      'example-namecheap.com': {
        registrar: 'NameCheap, Inc.',
        nameservers: ['dns1.registrar-servers.com', 'dns2.registrar-servers.com'],
      },
    };

    const mock = mockRegistrars[domain] || {
      registrar: 'Unknown Registrar',
      nameservers: ['ns1.unknown.com', 'ns2.unknown.com'],
    };

    return {
      domain,
      registrar: mock.registrar || null,
      registrarId: null,
      nameservers: mock.nameservers || [],
      createdDate: '2020-01-15T00:00:00Z',
      expiryDate: '2025-01-15T00:00:00Z',
      updatedDate: '2024-01-15T00:00:00Z',
      status: ['clientTransferProhibited'],
      dnssec: false,
    };
  }
}

// Export singleton instance
export const whoisClient = new WhoisClient();
