import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { namecheapClient } from '@/lib/integrations';

const checkSchema = z.object({
  domain: z.string().min(1),
});

const suggestSchema = z.object({
  keyword: z.string().min(1).max(63),
});

/**
 * POST /api/integrations/namecheap
 * Check domain availability or get suggestions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as string;

    switch (action) {
      case 'check': {
        const { domain } = checkSchema.parse(body);

        const availability = await namecheapClient.checkAvailability(domain);
        const pricing = await namecheapClient.getPricing(domain);

        return NextResponse.json({
          domain: availability.domain,
          available: availability.available,
          premium: availability.premium,
          pricing: {
            registration: availability.premium
              ? availability.premiumPrice
              : pricing.registration,
            renewal: pricing.renewal,
            icannFee: availability.icannFee,
            currency: pricing.currency,
          },
        });
      }

      case 'suggest': {
        const { keyword } = suggestSchema.parse(body);

        const suggestions = await namecheapClient.getSuggestions(keyword);

        return NextResponse.json({
          suggestions: suggestions.slice(0, 10),
          count: suggestions.length,
        });
      }

      case 'checkMultiple': {
        const { domains } = z.object({
          domains: z.array(z.string()).min(1).max(50),
        }).parse(body);

        const availabilities = await namecheapClient.checkMultipleAvailability(domains);

        return NextResponse.json({
          results: availabilities,
          available: availabilities.filter((a) => a.available).length,
          total: availabilities.length,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: check, suggest, or checkMultiple' },
          { status: 400 }
        );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Namecheap error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
