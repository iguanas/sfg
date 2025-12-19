import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { googlePlacesClient } from '@/lib/integrations';

const searchSchema = z.object({
  query: z.string().min(1),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

const detailsSchema = z.object({
  placeId: z.string().min(1),
});

const verifySchema = z.object({
  businessName: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
});

/**
 * POST /api/integrations/places
 * Search for businesses or get place details
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as string;

    switch (action) {
      case 'search': {
        const { query, address, lat, lng } = searchSchema.parse(body);

        let results;
        if (address) {
          results = await googlePlacesClient.searchNearAddress(query, address);
        } else {
          results = await googlePlacesClient.searchBusiness(query, {
            location: lat && lng ? { lat, lng } : undefined,
          });
        }

        return NextResponse.json({
          results: results.slice(0, 10), // Limit to 10 results
          count: results.length,
        });
      }

      case 'details': {
        const { placeId } = detailsSchema.parse(body);

        const details = await googlePlacesClient.getPlaceDetails(placeId);

        if (!details) {
          return NextResponse.json(
            { error: 'Place not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ place: details });
      }

      case 'verify': {
        const { businessName, address, phone } = verifySchema.parse(body);

        const verification = await googlePlacesClient.verifyBusiness(
          businessName,
          address,
          phone
        );

        return NextResponse.json(verification);
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: search, details, or verify' },
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

    console.error('Google Places error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/integrations/places/photo
 * Get a photo URL for a place
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const photoReference = searchParams.get('photoReference');
    const maxWidth = parseInt(searchParams.get('maxWidth') || '400', 10);

    if (!photoReference) {
      return NextResponse.json(
        { error: 'photoReference is required' },
        { status: 400 }
      );
    }

    const photoUrl = googlePlacesClient.getPhotoUrl(photoReference, maxWidth);

    return NextResponse.json({ url: photoUrl });
  } catch (error) {
    console.error('Photo URL error:', error);
    return NextResponse.json(
      { error: 'Failed to get photo URL' },
      { status: 500 }
    );
  }
}
