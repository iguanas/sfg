export const DOMAIN_ACCESS_PROMPT = `
## Current Checkpoint: DOMAIN_ACCESS

Your goal is to identify their domain situation and determine how we'll get access.

### Step 1: Determine Domain Status
Ask: "What's your current website address?" or "Do you have a website?"

### Three Possible Paths:

**Path A: They have a domain**
1. Capture the domain name (e.g., "smithchiro.com")
2. Tell them we'll look up their registrar
3. Set uiAction to trigger WHOIS lookup:
   \`"uiAction": { "type": "show_domain_lookup", "config": { "domain": "smithchiro.com" } }\`
4. Based on registrar, we'll either:
   - Guide them through delegation (GoDaddy, Cloudflare, etc.)
   - Or collect credentials via secure form (Wix, Namecheap, etc.)

**Path B: They don't have a domain**
1. Reassure them: "No problem! We'll register one for you - it's included."
2. Suggest domains based on their business name
3. Set uiAction to show domain search:
   \`"uiAction": { "type": "show_domain_search", "config": { "suggestions": ["smithchiro.com", "smithchiropractic.com"] } }\`

**Path C: They're not sure / It's complicated**
1. Ask clarifying questions
2. Common scenarios:
   - "My web guy handles it" → Ask for domain name, we'll figure out registrar
   - "It's through Wix/Squarespace" → That's probably their registrar too
   - "I think I bought it through GoDaddy" → Great, that supports delegation

### Registrar Capabilities:

**Supports Delegation (we can get access without password):**
- GoDaddy
- Cloudflare
- Squarespace
- DigitalOcean
- Hover
- Netlify
- Vercel

**Requires Credentials:**
- Wix
- Namecheap
- Bluehost
- HostGator
- Network Solutions
- IONOS
- Hostinger

### For Delegation-Supporting Registrars:
"Great news! [Registrar] lets you give us access without sharing your password. I'll show you the quick steps to add us as a delegate."

### For Credential-Required Registrars:
"[Registrar] doesn't support delegate access, so we'll need your login credentials to manage your domain. Don't worry - they're encrypted and stored securely. I'll show you a secure form to enter them."

### When to mark readyToAdvance as true:
- Domain identified AND (delegation confirmed OR credentials captured OR new domain selected)
- Or they explicitly don't have/want a domain and we've noted that

### Extracted Data:
- domainName: "example.com"
- domainStatus: "has_domain" | "no_domain" | "needs_new"
- registrar: "godaddy" | "wix" | etc. (if known)
- accessMethod: "delegation" | "credentials" | "owned_by_us"
`;

export const getDomainAccessPrompt = (collectedData: Record<string, unknown>, businessName?: string) => {
  const suggestions = businessName
    ? [
        businessName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com',
        businessName.toLowerCase().replace(/[^a-z0-9]/g, '') + 'local.com',
        businessName.toLowerCase().replace(/\s+/g, '') + '.com',
      ]
    : [];

  const context = `
### Context:
Business Name: ${businessName || 'Unknown'}
Suggested domains if needed: ${suggestions.join(', ')}

### Current State:
${JSON.stringify(collectedData, null, 2)}
`;

  return `${DOMAIN_ACCESS_PROMPT}\n${context}`;
};
