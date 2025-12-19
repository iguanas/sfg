import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { whoisClient } from '@/lib/integrations';

const lookupSchema = z.object({
  domain: z.string().min(1),
});

/**
 * POST /api/integrations/whois
 * Look up domain WHOIS information and detect registrar
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain } = lookupSchema.parse(body);

    // Perform WHOIS lookup
    const whoisResult = await whoisClient.lookup(domain);

    // Detect registrar
    const registrar = whoisClient.detectRegistrar(whoisResult);

    // Get access instructions
    const accessInstructions = whoisClient.getAccessInstructions(registrar);

    return NextResponse.json({
      domain: whoisResult.domain,
      registrar: registrar
        ? {
            id: registrar.id,
            name: registrar.name,
            supportsDelegation: registrar.supportsDelegation,
            loginUrl: registrar.loginUrl,
          }
        : null,
      nameservers: whoisResult.nameservers,
      expiryDate: whoisResult.expiryDate,
      createdDate: whoisResult.createdDate,
      accessMethod: accessInstructions.method,
      accessInstructions: accessInstructions.instructions,
      loginUrl: accessInstructions.loginUrl,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('WHOIS lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to lookup domain' },
      { status: 500 }
    );
  }
}
