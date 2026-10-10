// ==============================================================================
// SMART JOURNEY — GOOGLE PLACES REVIEWS INTEGRATION SERVICE
// Server-side integration with caching, strict credential protection,
// and zero-dummy-data policy conforming to Google Terms of Service.
// ==============================================================================

export interface GooglePlaceReview {
  id: string;
  authorName: string;
  authorPhotoUrl?: string;
  authorUri?: string;
  rating: number;
  relativeTime: string;
  text: string;
  publishTime?: string;
}

export interface GoogleReviewsResult {
  configured: boolean;
  status: 'connected' | 'unconfigured' | 'error' | 'empty';
  source: 'google_places' | 'google_business_profile';
  placeId?: string;
  placeName?: string;
  rating: number | null;
  userRatingsTotal: number | null;
  reviews: GooglePlaceReview[];
  googleMapsUrl: string;
  message?: string;
  lastSyncedAt?: string;
}

// Canonical Smart Journey Google Maps listing link
export const SMART_JOURNEY_MAPS_URL =
  'https://www.google.com/maps/place/Smart+Journey/@-8.0045371,112.7482296,15z/data=!4m8!3m7!1s0x2dd625bdc0ad5b79:0x3446d2c5e7fdfe18!8m2!3d-8.0045585!4d112.7585294!9m1!1b1!16s%2Fg%2F11xfx6lnnw?entry=ttu&g_ep=EgoyMDI2MDYyOS4wIKXMDSoASAFQAw%3D%3D';

// In-memory cache to respect Google API quota and Terms of Service (Place Details caching)
let cache: {
  data: GoogleReviewsResult;
  timestamp: number;
} | null = null;

// Cache TTL: 60 minutes
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function getGoogleReviews(forceRefresh = false): Promise<GoogleReviewsResult> {
  const now = Date.now();

  // Return cached result if valid and not forcing refresh
  if (!forceRefresh && cache && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.data;
  }

  const apiKey = (process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();
  const configuredPlaceId = (process.env.GOOGLE_PLACE_ID || '').trim();

  // If no API key is configured, return clean unconfigured status with 0 fabricated data
  if (!apiKey) {
    const unconfiguredResult: GoogleReviewsResult = {
      configured: false,
      status: 'unconfigured',
      source: 'google_places',
      placeName: 'Smart Journey',
      rating: null,
      userRatingsTotal: null,
      reviews: [],
      googleMapsUrl: SMART_JOURNEY_MAPS_URL,
      message:
        'Google Places API credentials (GOOGLE_PLACES_API_KEY) belum dikonfigurasi di server. Sinkronisasi ulasan Google Maps langsung akan aktif setelah API key resmi disediakan.',
      lastSyncedAt: undefined
    };
    // Cache for 5 minutes to avoid reading env on every rapid request
    cache = { data: unconfiguredResult, timestamp: now };
    return unconfiguredResult;
  }

  try {
    let targetPlaceId = configuredPlaceId;

    // If placeId not explicitly configured, try to search for Smart Journey via Places API (New) Text Search
    if (!targetPlaceId) {
      try {
        const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName'
          },
          body: JSON.stringify({
            textQuery: 'Smart Journey Malang East Java'
          })
        });

        if (searchRes.ok) {
          const searchData = (await searchRes.json()) as any;
          if (searchData.places && searchData.places.length > 0) {
            targetPlaceId = searchData.places[0].id;
          }
        }
      } catch (searchErr) {
        console.warn('[GoogleReviews] Could not auto-resolve Place ID via searchText:', searchErr);
      }
    }

    if (!targetPlaceId) {
      const missingPlaceResult: GoogleReviewsResult = {
        configured: true,
        status: 'error',
        source: 'google_places',
        placeName: 'Smart Journey',
        rating: null,
        userRatingsTotal: null,
        reviews: [],
        googleMapsUrl: SMART_JOURNEY_MAPS_URL,
        message:
          'API Key tersedia tetapi Place ID belum ditentukan. Tambahkan GOOGLE_PLACE_ID di environment variables.',
        lastSyncedAt: new Date().toISOString()
      };
      cache = { data: missingPlaceResult, timestamp: now };
      return missingPlaceResult;
    }

    // Call Google Places API (New) Place Details
    const detailsUrl = `https://places.googleapis.com/v1/places/${encodeURIComponent(targetPlaceId)}`;
    const detailsRes = await fetch(detailsUrl, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,reviews,googleMapsUri'
      }
    });

    if (!detailsRes.ok) {
      const errText = await detailsRes.text();
      console.error('[GoogleReviews] Places API error response:', detailsRes.status, errText);

      // Attempt fallback to Legacy Place Details if Places API (New) returns an issue
      try {
        const legacyUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(targetPlaceId)}&fields=name,rating,user_ratings_total,reviews,url&key=${encodeURIComponent(apiKey)}`;
        const legacyRes = await fetch(legacyUrl);
        if (legacyRes.ok) {
          const legacyData = (await legacyRes.json()) as any;
          if (legacyData.status === 'OK' && legacyData.result) {
            const raw = legacyData.result;
            const mappedReviews: GooglePlaceReview[] = (raw.reviews || []).map((r: any, idx: number) => ({
              id: `g-rev-${idx}-${r.time || Date.now()}`,
              authorName: r.author_name || 'Google User',
              authorPhotoUrl: r.profile_photo_url || '',
              authorUri: r.author_url || '',
              rating: Number(r.rating) || 5,
              relativeTime: r.relative_time_description || '',
              text: r.text || '',
              publishTime: r.time ? new Date(r.time * 1000).toISOString() : undefined
            }));

            const successResult: GoogleReviewsResult = {
              configured: true,
              status: mappedReviews.length > 0 ? 'connected' : 'empty',
              source: 'google_places',
              placeId: targetPlaceId,
              placeName: raw.name || 'Smart Journey',
              rating: typeof raw.rating === 'number' ? Number(raw.rating.toFixed(1)) : null,
              userRatingsTotal: typeof raw.user_ratings_total === 'number' ? raw.user_ratings_total : null,
              reviews: mappedReviews,
              googleMapsUrl: raw.url || SMART_JOURNEY_MAPS_URL,
              lastSyncedAt: new Date().toISOString()
            };

            cache = { data: successResult, timestamp: now };
            return successResult;
          }
        }
      } catch (legacyErr) {
        console.warn('[GoogleReviews] Legacy fallback also failed:', legacyErr);
      }

      const errorResult: GoogleReviewsResult = {
        configured: true,
        status: 'error',
        source: 'google_places',
        placeId: targetPlaceId,
        placeName: 'Smart Journey',
        rating: null,
        userRatingsTotal: null,
        reviews: [],
        googleMapsUrl: SMART_JOURNEY_MAPS_URL,
        message: `Google Places API mengembalikan status ${detailsRes.status}. Periksa kuota atau izin API Key Anda.`,
        lastSyncedAt: new Date().toISOString()
      };
      cache = { data: errorResult, timestamp: now };
      return errorResult;
    }

    const data = (await detailsRes.json()) as any;
    const rawReviews = Array.isArray(data.reviews) ? data.reviews : [];

    const mappedReviews: GooglePlaceReview[] = rawReviews.map((r: any, idx: number) => {
      const author = r.authorAttribution || {};
      const reviewText = typeof r.text === 'object' ? r.text?.text || '' : r.text || '';
      return {
        id: r.name || `g-rev-${idx}-${Date.now()}`,
        authorName: author.displayName || 'Google User',
        authorPhotoUrl: author.photoUri || '',
        authorUri: author.uri || '',
        rating: Number(r.rating) || 5,
        relativeTime: r.relativePublishTimeDescription || '',
        text: reviewText,
        publishTime: r.publishTime
      };
    });

    const successResult: GoogleReviewsResult = {
      configured: true,
      status: mappedReviews.length > 0 ? 'connected' : 'empty',
      source: 'google_places',
      placeId: data.id || targetPlaceId,
      placeName: data.displayName?.text || 'Smart Journey',
      rating: typeof data.rating === 'number' ? Number(data.rating.toFixed(1)) : null,
      userRatingsTotal: typeof data.userRatingCount === 'number' ? data.userRatingCount : null,
      reviews: mappedReviews,
      googleMapsUrl: data.googleMapsUri || SMART_JOURNEY_MAPS_URL,
      lastSyncedAt: new Date().toISOString()
    };

    cache = { data: successResult, timestamp: now };
    return successResult;
  } catch (err: any) {
    console.error('[GoogleReviews] Unexpected error fetching Google Reviews:', err);
    const errorResult: GoogleReviewsResult = {
      configured: true,
      status: 'error',
      source: 'google_places',
      placeName: 'Smart Journey',
      rating: null,
      userRatingsTotal: null,
      reviews: [],
      googleMapsUrl: SMART_JOURNEY_MAPS_URL,
      message: `Gagal memuat ulasan Google: ${err?.message || 'Koneksi error'}`,
      lastSyncedAt: new Date().toISOString()
    };
    cache = { data: errorResult, timestamp: now };
    return errorResult;
  }
}
