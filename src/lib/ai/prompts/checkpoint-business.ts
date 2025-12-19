export const BUSINESS_INFO_PROMPT = `
## Current Checkpoint: BUSINESS_INFO

Your goal is to collect all core business details through natural conversation.

### Required Information:
1. **Business Name** - Official name for display
2. **Phone Number** - Business contact number
3. **Email Address** - Business email
4. **Physical Address** - Full address (street, city, state, zip)
5. **Services Offered** - At least 3 services they provide

### Optional but Valuable:
- Business type/industry
- Years in business
- Business hours (each day)
- What makes them unique/different
- Target customer description
- Specializations

### Conversation Strategy:
1. Start broad: "Tell me about your business - what do you do, who do you help?"
2. Extract structured data from natural responses
3. Confirm extracted info: "So you're at 123 Main St in Springfield - is that right?"
4. Ask for missing required fields naturally
5. For services, if vague, give examples based on business type

### Example Interactions:

**Client says:** "We're Smith Chiropractic, been here 12 years doing back and neck stuff"
**Extract:** businessName: "Smith Chiropractic", yearsInBusiness: 12, services: ["back pain treatment", "neck pain treatment"]
**Response:** "Great - Smith Chiropractic, 12 years in business! What's your address and phone number?"

**Client says:** "We're open 9 to 5 weekdays, closed weekends"
**Extract:** hours: { mon: {open: "9:00", close: "17:00"}, tue: {...}, ..., sat: "closed", sun: "closed" }
**Confirm:** "Got it - Monday through Friday 9am to 5pm, closed Saturday and Sunday. Perfect!"

### Data Validation:
- Email: Must contain @ and a domain
- Phone: Accept various formats (555-1234, (555) 123-4567, etc.)
- Address: Need at least street and city

### When to mark readyToAdvance as true:
- All 5 required fields are collected AND confirmed
- Don't rush - make sure the data is accurate

### Tips by Business Type:
- **Chiropractor:** Ask about specializations (sports, prenatal, pediatric)
- **Plumber:** Ask about emergency services, service area
- **Restaurant:** Ask about cuisine type, dine-in/takeout/delivery
- **Dentist:** Ask about specialties (cosmetic, general, orthodontics)
`;

export const getBusinessInfoPrompt = (collectedData: Record<string, unknown>) => {
  const missing: string[] = [];
  const collected: string[] = [];

  const required = ['businessName', 'phone', 'email', 'address', 'services'];

  for (const field of required) {
    if (collectedData[field]) {
      collected.push(`- ${field}: ${JSON.stringify(collectedData[field])}`);
    } else {
      missing.push(field);
    }
  }

  const context = `
### Current State:
**Collected so far:**
${collected.length > 0 ? collected.join('\n') : '- Nothing yet'}

**Still needed:**
${missing.length > 0 ? missing.map(f => `- ${f}`).join('\n') : '- All required fields collected!'}

${missing.length === 0 ? '**Ready to advance!** Confirm the information and set readyToAdvance: true' : ''}
`;

  return `${BUSINESS_INFO_PROMPT}\n${context}`;
};
