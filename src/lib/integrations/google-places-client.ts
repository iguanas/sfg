/**
 * Google Places API Client
 *
 * Searches for businesses and retrieves Google Business Profile information.
 * Used to find and connect client's GBP during onboarding.
 */

// ============================================
// TYPES
// ============================================

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  formattedAddress: string;
  businessStatus?: string;
  rating?: number;
  userRatingsTotal?: number;
  types?: string[];
  phoneNumber?: string;
  website?: string;
  openNow?: boolean;
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  formattedAddress: string;
  formattedPhoneNumber?: string;
  internationalPhoneNumber?: string;
  website?: string;
  url?: string; // Google Maps URL
  rating?: number;
  userRatingsTotal?: number;
  reviews?: PlaceReview[];
  photos?: PlacePhoto[];
  openingHours?: {
    openNow?: boolean;
    weekdayText?: string[];
    periods?: OpeningPeriod[];
  };
  businessStatus?: string;
  types?: string[];
  priceLevel?: number;
  geometry?: {
    lat: number;
    lng: number;
  };
  addressComponents?: AddressComponent[];
}

export interface PlaceReview {
  authorName: string;
  authorUrl?: string;
  profilePhotoUrl?: string;
  rating: number;
  relativeTimeDescription: string;
  text: string;
  time: number;
}

export interface PlacePhoto {
  photoReference: string;
  height: number;
  width: number;
  htmlAttributions: string[];
}

export interface OpeningPeriod {
  open: { day: number; time: string };
  close?: { day: number; time: string };
}

export interface AddressComponent {
  longName: string;
  shortName: string;
  types: string[];
}

export interface SearchOptions {
  location?: { lat: number; lng: number };
  radius?: number; // in meters, max 50000
  type?: string; // e.g., 'restaurant', 'store', 'establishment'
}

// ============================================
// GOOGLE PLACES CLIENT
// ============================================

export class GooglePlacesClient {
  private apiKey: string | null;
  private baseUrl: string = 'https://maps.googleapis.com/maps/api/place';

  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY || null;
  }

  /**
   * Search for businesses by name and optional location
   */
  async searchBusiness(
    query: string,
    options?: SearchOptions
  ): Promise<PlaceSearchResult[]> {
    if (!this.apiKey) {
      console.log('No GOOGLE_PLACES_API_KEY configured, returning mock data');
      return this.getMockSearchResults(query);
    }

    try {
      const url = new URL(`${this.baseUrl}/textsearch/json`);
      url.searchParams.set('key', this.apiKey);
      url.searchParams.set('query', query);

      if (options?.location) {
        url.searchParams.set(
          'location',
          `${options.location.lat},${options.location.lng}`
        );
      }

      if (options?.radius) {
        url.searchParams.set('radius', options.radius.toString());
      }

      if (options?.type) {
        url.searchParams.set('type', options.type);
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Google Places API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API status: ${data.status}`);
      }

      return this.parseSearchResults(data.results || []);
    } catch (error) {
      console.error('Google Places search error:', error);
      throw error;
    }
  }

  /**
   * Search for businesses near an address
   */
  async searchNearAddress(
    businessName: string,
    address: string
  ): Promise<PlaceSearchResult[]> {
    // Combine business name and address for better results
    const query = `${businessName} ${address}`;
    return this.searchBusiness(query);
  }

  /**
   * Get detailed information about a place
   */
  async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    if (!this.apiKey) {
      console.log('No GOOGLE_PLACES_API_KEY configured, returning mock data');
      return this.getMockPlaceDetails(placeId);
    }

    try {
      const url = new URL(`${this.baseUrl}/details/json`);
      url.searchParams.set('key', this.apiKey);
      url.searchParams.set('place_id', placeId);
      url.searchParams.set(
        'fields',
        [
          'place_id',
          'name',
          'formatted_address',
          'formatted_phone_number',
          'international_phone_number',
          'website',
          'url',
          'rating',
          'user_ratings_total',
          'reviews',
          'photos',
          'opening_hours',
          'business_status',
          'types',
          'price_level',
          'geometry',
          'address_components',
        ].join(',')
      );

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Google Places API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        if (data.status === 'NOT_FOUND') {
          return null;
        }
        throw new Error(`Google Places API status: ${data.status}`);
      }

      return this.parsePlaceDetails(data.result);
    } catch (error) {
      console.error('Google Places details error:', error);
      throw error;
    }
  }

  /**
   * Get a photo URL for a place
   */
  getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    if (!this.apiKey) {
      return 'https://via.placeholder.com/400x300?text=No+Photo';
    }

    return `${this.baseUrl}/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${this.apiKey}`;
  }

  /**
   * Verify if a business exists and get its GBP info
   */
  async verifyBusiness(
    businessName: string,
    address?: string,
    phone?: string
  ): Promise<{
    found: boolean;
    confidence: 'high' | 'medium' | 'low' | 'none';
    match?: PlaceDetails;
    alternatives?: PlaceSearchResult[];
  }> {
    let query = businessName;
    if (address) {
      query += ` ${address}`;
    }

    const searchResults = await this.searchBusiness(query);

    if (searchResults.length === 0) {
      return { found: false, confidence: 'none' };
    }

    // Get details for the top result
    const topResult = searchResults[0];
    const details = await this.getPlaceDetails(topResult.placeId);

    if (!details) {
      return {
        found: false,
        confidence: 'none',
        alternatives: searchResults.slice(0, 5),
      };
    }

    // Calculate confidence based on matching criteria
    let confidenceScore = 0;

    // Name match
    if (this.normalizeString(details.name).includes(this.normalizeString(businessName))) {
      confidenceScore += 40;
    } else if (this.normalizeString(businessName).includes(this.normalizeString(details.name))) {
      confidenceScore += 30;
    }

    // Address match (if provided)
    if (address && details.formattedAddress) {
      const normalizedAddress = this.normalizeString(address);
      const normalizedDetailsAddress = this.normalizeString(details.formattedAddress);
      if (normalizedDetailsAddress.includes(normalizedAddress) ||
          normalizedAddress.includes(normalizedDetailsAddress)) {
        confidenceScore += 30;
      }
    }

    // Phone match (if provided)
    if (phone && details.formattedPhoneNumber) {
      const normalizedPhone = phone.replace(/\D/g, '');
      const normalizedDetailsPhone = details.formattedPhoneNumber.replace(/\D/g, '');
      if (normalizedPhone === normalizedDetailsPhone ||
          normalizedPhone.endsWith(normalizedDetailsPhone) ||
          normalizedDetailsPhone.endsWith(normalizedPhone)) {
        confidenceScore += 30;
      }
    }

    let confidence: 'high' | 'medium' | 'low' | 'none';
    if (confidenceScore >= 70) {
      confidence = 'high';
    } else if (confidenceScore >= 40) {
      confidence = 'medium';
    } else if (confidenceScore > 0) {
      confidence = 'low';
    } else {
      confidence = 'none';
    }

    return {
      found: confidence !== 'none',
      confidence,
      match: details,
      alternatives: searchResults.slice(1, 5),
    };
  }

  /**
   * Normalize a string for comparison
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Parse search results from API response
   */
  private parseSearchResults(results: Record<string, unknown>[]): PlaceSearchResult[] {
    return results.map((result) => ({
      placeId: result.place_id as string,
      name: result.name as string,
      formattedAddress: result.formatted_address as string,
      businessStatus: result.business_status as string | undefined,
      rating: result.rating as number | undefined,
      userRatingsTotal: result.user_ratings_total as number | undefined,
      types: result.types as string[] | undefined,
      openNow: (result.opening_hours as Record<string, unknown>)?.open_now as boolean | undefined,
    }));
  }

  /**
   * Parse place details from API response
   */
  private parsePlaceDetails(result: Record<string, unknown>): PlaceDetails {
    const geometry = result.geometry as Record<string, unknown> | undefined;
    const location = geometry?.location as Record<string, unknown> | undefined;
    const openingHours = result.opening_hours as Record<string, unknown> | undefined;

    return {
      placeId: result.place_id as string,
      name: result.name as string,
      formattedAddress: result.formatted_address as string,
      formattedPhoneNumber: result.formatted_phone_number as string | undefined,
      internationalPhoneNumber: result.international_phone_number as string | undefined,
      website: result.website as string | undefined,
      url: result.url as string | undefined,
      rating: result.rating as number | undefined,
      userRatingsTotal: result.user_ratings_total as number | undefined,
      reviews: (result.reviews as Record<string, unknown>[])?.map((review) => ({
        authorName: review.author_name as string,
        authorUrl: review.author_url as string | undefined,
        profilePhotoUrl: review.profile_photo_url as string | undefined,
        rating: review.rating as number,
        relativeTimeDescription: review.relative_time_description as string,
        text: review.text as string,
        time: review.time as number,
      })),
      photos: (result.photos as Record<string, unknown>[])?.map((photo) => ({
        photoReference: photo.photo_reference as string,
        height: photo.height as number,
        width: photo.width as number,
        htmlAttributions: photo.html_attributions as string[],
      })),
      openingHours: openingHours
        ? {
            openNow: openingHours.open_now as boolean | undefined,
            weekdayText: openingHours.weekday_text as string[] | undefined,
            periods: (openingHours.periods as Record<string, unknown>[])?.map((period) => ({
              open: period.open as { day: number; time: string },
              close: period.close as { day: number; time: string } | undefined,
            })),
          }
        : undefined,
      businessStatus: result.business_status as string | undefined,
      types: result.types as string[] | undefined,
      priceLevel: result.price_level as number | undefined,
      geometry: location
        ? {
            lat: location.lat as number,
            lng: location.lng as number,
          }
        : undefined,
      addressComponents: (result.address_components as Record<string, unknown>[])?.map(
        (component) => ({
          longName: component.long_name as string,
          shortName: component.short_name as string,
          types: component.types as string[],
        })
      ),
    };
  }

  /**
   * Get mock search results for development
   */
  private getMockSearchResults(query: string): PlaceSearchResult[] {
    return [
      {
        placeId: 'mock_place_id_1',
        name: `${query} - Main Location`,
        formattedAddress: '123 Main St, Anytown, CA 12345',
        businessStatus: 'OPERATIONAL',
        rating: 4.5,
        userRatingsTotal: 127,
        types: ['establishment', 'point_of_interest'],
        openNow: true,
      },
      {
        placeId: 'mock_place_id_2',
        name: `${query} - Downtown`,
        formattedAddress: '456 Oak Ave, Anytown, CA 12345',
        businessStatus: 'OPERATIONAL',
        rating: 4.2,
        userRatingsTotal: 89,
        types: ['establishment', 'point_of_interest'],
        openNow: false,
      },
    ];
  }

  /**
   * Get mock place details for development
   */
  private getMockPlaceDetails(placeId: string): PlaceDetails {
    return {
      placeId,
      name: 'Mock Business Name',
      formattedAddress: '123 Main St, Anytown, CA 12345',
      formattedPhoneNumber: '(555) 123-4567',
      internationalPhoneNumber: '+1 555-123-4567',
      website: 'https://example.com',
      url: 'https://maps.google.com/?cid=mock',
      rating: 4.5,
      userRatingsTotal: 127,
      reviews: [
        {
          authorName: 'John D.',
          rating: 5,
          relativeTimeDescription: '2 weeks ago',
          text: 'Great service! Highly recommend.',
          time: Date.now() / 1000 - 1209600,
        },
      ],
      openingHours: {
        openNow: true,
        weekdayText: [
          'Monday: 9:00 AM – 5:00 PM',
          'Tuesday: 9:00 AM – 5:00 PM',
          'Wednesday: 9:00 AM – 5:00 PM',
          'Thursday: 9:00 AM – 5:00 PM',
          'Friday: 9:00 AM – 5:00 PM',
          'Saturday: 10:00 AM – 2:00 PM',
          'Sunday: Closed',
        ],
      },
      businessStatus: 'OPERATIONAL',
      types: ['establishment', 'point_of_interest'],
      geometry: {
        lat: 37.7749,
        lng: -122.4194,
      },
    };
  }
}

// Export singleton instance
export const googlePlacesClient = new GooglePlacesClient();
