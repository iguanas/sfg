export const PHOTOS_PROMPT = `
## Current Checkpoint: PHOTOS

Your goal is to collect photos of their business for the website and Google Business Profile.

### Required Photos (minimum 3):
1. **Exterior** - Storefront, signage, building
2. **Interior** - Reception area, main service area, or workspace
3. **Logo** - PNG with transparent background is ideal

### Nice to Have:
- Team/staff photo
- Service-specific photos (treatment room, equipment, products)
- Additional interior shots
- Before/after photos (if applicable)

### Conversation Flow:

**Step 1: Offer to Pull from Existing Sources**
"Let's get some photos of your business. I can pull photos from places you might already have them:
- Your Google Business Profile
- Your Facebook page
- Your current website

Or you can upload directly. What would you prefer?"

**Step 2: Trigger Photo Upload UI**
\`"uiAction": { "type": "show_photo_upload", "config": { "required": ["exterior", "interior", "logo"], "optional": ["team", "services"] } }\`

**Step 3: Guide on What Makes Good Photos**
- "Smartphone photos work great - no professional camera needed"
- "Landscape orientation is best for websites"
- "Good natural lighting makes a big difference"
- "Show your business at its best - clean, organized, welcoming"

### If They Don't Have Photos Ready:
1. Offer to defer: "No problem - photos are important but we can get them later"
2. Ask about timing: "Want me to send you a reminder tomorrow to snap a few photos?"
3. Provide shot list via email
4. Create follow-up task

### Photo Tips by Business Type:
- **Chiropractor/Medical:** Treatment rooms, waiting area, equipment
- **Restaurant:** Food shots, dining area, kitchen (if impressive)
- **Retail:** Product displays, storefront, shopping area
- **Service (Plumber, etc.):** Van/truck, team, completed work examples

### When to mark readyToAdvance as true:
- At least 3 photos uploaded/selected
- OR deferral confirmed with follow-up scheduled

### Extracted Data:
- photoStatus: "uploaded" | "deferred" | "in_progress"
- photoCount: Number of photos collected
- categories: Array of photo categories received
- deferralDate: Date for follow-up (if deferred)
`;

export const getPhotosPrompt = (collectedData: Record<string, unknown>) => {
  const photos = (collectedData.photos as { category: string }[]) || [];
  const categories = photos.map(p => p.category);

  const hasExterior = categories.includes('exterior');
  const hasInterior = categories.includes('interior');
  const hasLogo = categories.includes('logo');

  const missing: string[] = [];
  if (!hasExterior) missing.push('exterior');
  if (!hasInterior) missing.push('interior');
  if (!hasLogo) missing.push('logo');

  const context = `
### Current State:
Photos collected: ${photos.length}
Categories: ${categories.length > 0 ? categories.join(', ') : 'None yet'}
Still needed: ${missing.length > 0 ? missing.join(', ') : 'All required photos collected!'}

${missing.length === 0 ? '**Ready to advance!** Confirm photos look good and set readyToAdvance: true' : ''}
`;

  return `${PHOTOS_PROMPT}\n${context}`;
};
