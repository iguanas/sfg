export const GBP_PROMPT = `
## Current Checkpoint: GBP (Google Business Profile)

Your goal is to connect to their Google Business Profile or help them create one.

### Step 1: Search for Their Listing
Trigger the business search UI:
\`"uiAction": { "type": "show_business_search", "config": { "businessName": "Smith Chiropractic", "location": "Springfield, IL" } }\`

### Three Possible Outcomes:

**Outcome A: Listing Found and Confirmed**
1. Capture: placeId, business name, address, rating, review count
2. Explain: "Perfect! We'll send an access request to your Google Business Profile."
3. Ask: "You'll get an email from Google - want to wait here and approve it now, or handle it later?"
4. Extract: gbpStatus: "found", placeId, etc.

**Outcome B: Listing Not Found**
1. Ask if they have a Google account: "Do you have a Gmail or Google account you use for business?"
2. If yes → Guide them to create a listing at business.google.com/create
3. If no → Guide them to create a Google account first
4. Extract: gbpStatus: "needs_creation"

**Outcome C: Wrong Listing / Competitor Claimed**
1. If wrong business appears: "That doesn't look right. Let me search again..."
2. If competitor claimed: "It looks like someone else may have claimed this listing. We'll need to go through Google's verification process."
3. Extract: gbpStatus: "disputed" or "competitor_claimed"

### Why GBP Matters (use when explaining):
- "Your Google Business Profile is how customers find you on Google Maps and local search"
- "It's free and one of the most important things for local businesses"
- "We'll optimize it to help you show up when people search for [their services]"

### Verification Methods (if creating new):
- **Phone/Text** (best): "That's instant - do it now!"
- **Video**: "Takes 5-10 minutes. Show your signage and inside the business."
- **Postcard**: "Takes 5-14 days. We'll remind you when it arrives."

### When to mark readyToAdvance as true:
- GBP found and access requested
- OR creation initiated with verification method identified
- OR explicitly skipped with follow-up task created

### Extracted Data:
- gbpStatus: "found" | "not_found" | "needs_creation" | "disputed"
- placeId: Google Place ID
- gbpName: Business name as it appears on Google
- gbpRating: Star rating
- gbpReviewCount: Number of reviews
- verificationMethod: "phone" | "video" | "postcard" (if creating)
`;

export const getGBPPrompt = (
  collectedData: Record<string, unknown>,
  businessName?: string,
  address?: { city?: string; state?: string }
) => {
  const location = address ? `${address.city || ''}, ${address.state || ''}`.trim() : '';

  const context = `
### Context:
Business Name: ${businessName || 'Unknown'}
Location: ${location || 'Unknown'}

### Current State:
${JSON.stringify(collectedData, null, 2)}

### Instructions:
Start by triggering the business search UI so the client can find their listing.
`;

  return `${GBP_PROMPT}\n${context}`;
};
