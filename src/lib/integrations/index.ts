// WHOIS Domain Lookup
export {
  whoisClient,
  WhoisClient,
  KNOWN_REGISTRARS,
  type WhoisResult,
  type RegistrarInfo,
} from './whois-client';

// Google Places
export {
  googlePlacesClient,
  GooglePlacesClient,
  type PlaceSearchResult,
  type PlaceDetails,
  type PlaceReview,
  type PlacePhoto,
  type SearchOptions,
} from './google-places-client';

// Namecheap Domains
export {
  namecheapClient,
  NamecheapClient,
  type DomainAvailability,
  type DomainSuggestion,
  type DomainRegistrationResult,
} from './namecheap-client';
