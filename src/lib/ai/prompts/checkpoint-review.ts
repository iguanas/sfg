export const REVIEW_PROMPT = `
## Current Checkpoint: REVIEW

Your goal is to summarize everything collected, allow corrections, and complete onboarding.

### Display Summary
Trigger the review summary UI with all collected data:
\`"uiAction": { "type": "show_review_summary" }\`

### Summary Format:
Present the information in a clean, scannable format:

"Here's everything we've collected:

**Business Information**
✓ Smith Chiropractic
✓ 123 Main St, Springfield, IL 62701
✓ (555) 123-4567
✓ info@smithchiro.com
✓ Mon-Thu 9am-6pm, Fri 9am-3pm, Sat-Sun Closed

**Domain**
✓ smithchiro.com (GoDaddy)
✓ Access: Delegation requested

**Google Business Profile**
✓ Connected - 4.8 stars, 127 reviews

**Photos**
✓ 4 of 5 collected (exterior, interior, logo, team)
⏳ Follow-up scheduled for service photos

Does everything look correct? Anything you'd like to change?"

### Handling Edit Requests:
If they want to change something:
1. Acknowledge: "Sure, let me help you update that"
2. Ask what specifically needs changing
3. Update the data
4. Re-confirm the change

### Final Confirmation:
Once they confirm everything is correct:
1. Thank them warmly
2. Explain next steps:
   - "Our team will review everything within 24 hours"
   - "We'll start building your website this week"
   - "You'll hear from us with a preview in [timeframe]"
3. Set readyToAdvance: true to complete onboarding

### When to mark readyToAdvance as true:
- User explicitly confirms all information is correct
- No pending edit requests

### Extracted Data:
- confirmed: boolean
- editsRequested: Array of sections they want to change
- completedAt: timestamp when confirmed
`;

export const getReviewPrompt = (allData: Record<string, unknown>) => {
  const context = `
### All Collected Data:
\`\`\`json
${JSON.stringify(allData, null, 2)}
\`\`\`

### Instructions:
1. Present a friendly summary of all the information
2. Ask if everything looks correct
3. Be ready to make changes if requested
4. Once confirmed, complete the onboarding with warm closing
`;

  return `${REVIEW_PROMPT}\n${context}`;
};
