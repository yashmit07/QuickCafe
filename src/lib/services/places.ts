// src/lib/services/places.ts
import type { Cafe } from '$lib/types/database'
import { GOOGLE_PLACES_API_KEY } from '$env/static/private'
import { supabase } from '$lib/db/supabase'

type PlaceType = 'cafe' | 'restaurant';
type PriceLevel = '$' | '$$' | '$$$' | null;

interface GooglePlace {
    place_id: string;
    name: string;
    geometry: {
        location: {
            lat: number;
            lng: number;
        };
    };
}

interface PlaceSearchResponse {
    status: string;
    results: GooglePlace[];
}

interface PlaceSearchParams {
    key: string;
    location: string;
    radius: string;
    type: PlaceType;
    rankby: string;
    minprice?: string;
    maxprice?: string;
}

interface PlaceDetailsParams {
    key: string;
    place_id: string;
    fields: string;
}

export class PlacesService {
    private readonly GEOCODING_API_BASE = 'https://maps.googleapis.com/maps/api/geocode'
    private readonly PLACES_API_BASE = 'https://maps.googleapis.com/maps/api/place'
    private readonly PLACES_TYPES: PlaceType[] = ['cafe']
    private readonly PLACE_DETAILS_FIELDS = [
        'reviews',
        'price_level',
        'formatted_address',
        'opening_hours',
        'website',
        'formatted_phone_number'
    ];

    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 2000; // 2 seconds

    constructor() {
        if (!GOOGLE_PLACES_API_KEY) {
            console.error('Google Places API key is not set!');
            throw new Error('Google Places API key is required');
        }
        console.log('Places Service initialized with API key:', GOOGLE_PLACES_API_KEY.substring(0, 8) + '...');
    }

    private async retryableRequest(
        request: string | (() => Promise<Response>),
        retries = this.MAX_RETRIES
    ): Promise<Response> {
        let lastError: Error | null = null
        
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const response = await (typeof request === 'string' ? fetch(request) : request())
                
                if (response.status === 429) {
                    await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY))
                    continue
                }
                
                return response
            } catch (error) {
                lastError = error as Error
                if (attempt < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY))
                }
            }
        }
        
        throw lastError || new Error('Request failed after retries')
    }

    /**
     * Convert price level to Google Places API format
     */
    private convertPriceLevel(price?: string): number | undefined {
        const mapping: Record<string, number> = {
            '$': 1,
            '$$': 2,
            '$$$': 3
        };
        return price ? mapping[price] : undefined;
    }

    /**
     * Geocode a location string to coordinates using the Geocoding API
     */
    async geocodeLocation(location: string): Promise<{ lat: number; lng: number }> {
        try {
            console.log('Geocoding location:', location);
            const url = `${this.GEOCODING_API_BASE}/json?address=${encodeURIComponent(location)}&key=${GOOGLE_PLACES_API_KEY}`;
            console.log('Geocoding URL:', url.replace(GOOGLE_PLACES_API_KEY, 'REDACTED'));
            
            const response = await this.retryableRequest(url);
            console.log('Geocoding response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Geocoding API error:', errorData);
                throw new Error(`Failed to geocode location: ${errorData.status || response.statusText}`);
            }

            const data = await response.json();
            console.log('Geocoding response:', JSON.stringify(data, null, 2));

            if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) {
                throw new Error(`No results found for location: ${location}`);
            }

            const { lat, lng } = data.results[0].geometry.location;
            console.log('Geocoded coordinates:', { lat, lng });
            return { lat, lng };
        } catch (error) {
            console.error('Geocoding error:', error);
            throw error;
        }
    }

    /**
     * Search for nearby cafes using Places API
     */
    async searchNearbyCafes(lat: number, lng: number, radius: number = 5000, priceLevel?: string): Promise<Cafe[]> {
        console.log('Searching for cafes:', { lat, lng, radius, priceLevel });

        // Convert price level to Google Places API format (1-4)
        let minPrice: number | undefined;
        let maxPrice: number | undefined;
        
        if (priceLevel) {
            const priceMap: Record<string, number> = {
                '$': 1,
                '$$': 2,
                '$$$': 3,
                '$$$$': 4
            };
            const targetPrice = priceMap[priceLevel];
            
            // For $$$ and $$$$, also include one level below to ensure results
            if (targetPrice >= 3) {
                minPrice = targetPrice - 1;
                maxPrice = targetPrice;
            } else {
                minPrice = targetPrice;
                maxPrice = targetPrice;
            }
        }

        const params = new URLSearchParams({
            key: GOOGLE_PLACES_API_KEY,
            location: `${lat},${lng}`,
            type: 'cafe',
            radius: radius.toString(),
            keyword: 'coffee cafe bakery'
        });

        // Only add price parameters if specified
        if (minPrice !== undefined) {
            params.append('minprice', minPrice.toString());
        }
        if (maxPrice !== undefined) {
            params.append('maxprice', maxPrice.toString());
        }

        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
        console.log('Searching for cafe places with params:', {
            key: 'REDACTED',
            location: `${lat},${lng}`,
            type: 'cafe',
            radius: radius.toString(),
            keyword: 'coffee cafe bakery',
            minprice: minPrice?.toString(),
            maxprice: maxPrice?.toString(),
            url: url.replace(GOOGLE_PLACES_API_KEY, 'REDACTED')
        });

        try {
            const response = await this.retryableRequest(() => fetch(url));
            console.log('Places API response status:', response.status);
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Places API error:', errorData);
                throw new Error(`Places API error: ${errorData.status || response.statusText}`);
            }

            const data = await response.json() as PlaceSearchResponse;
            console.log('Search response:', {
                status: data.status,
                resultsCount: data.results?.length || 0,
                firstResult: data.results?.[0] ? {
                    name: data.results[0].name,
                    place_id: data.results[0].place_id
                } : null
            });

            if (data.status === 'ZERO_RESULTS') {
                console.warn('No results found');
                return [];
            }

            if (data.status !== 'OK') {
                throw new Error(`Places API error: ${data.status}`);
            }

            if (!data.results?.length) {
                console.warn('No places found');
                return [];
            }

            // Improved cafe filtering
            const filteredResults = data.results.filter(place => {
                const name = place.name.toLowerCase();
                // Exclude obvious non-cafes and restaurants
                const excludeTerms = [
                    'mcdonalds',
                    "mcdonald's",
                    'burger',
                    'taco',
                    'subway',
                    'pizza',
                    'pho',
                    'thai',
                    'sushi',
                    'curry',
                    'grill',
                    'buffet',
                    'restaurant'
                ];
                return !excludeTerms.some(term => name.includes(term));
            });

            console.log(`Processing ${filteredResults.length} filtered places`);

            const placesPromises = filteredResults.map(async (place: GooglePlace) => {
                try {
                    const details = await this.getPlaceDetails(place.place_id);
                    return this.transformToDbFormat(place, details);
                } catch (error) {
                    console.error(`Error fetching details for place ${place.place_id}:`, error);
                    return null;
                }
            });

            const places = await Promise.all(placesPromises);
            const validPlaces = places.filter((place): place is Cafe => place !== null);
            console.log(`Successfully processed ${validPlaces.length} places`);
            
            return validPlaces;
        } catch (error) {
            console.error('Error searching cafes:', error);
            throw error;
        }
    }

    /**
     * Calculate distance between two points using the Haversine formula
     */
    private calculateDistance(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
    ): number {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance in meters
    }

    /**
     * Get detailed information about a specific place
     */
    async getPlaceDetails(placeId: string): Promise<any> {
        const params: Record<string, string> = {
            key: GOOGLE_PLACES_API_KEY,
            place_id: placeId,
            fields: this.PLACE_DETAILS_FIELDS.join(',')
        };

        const url = new URL(`${this.PLACES_API_BASE}/details/json`);
        url.search = new URLSearchParams(params).toString();

        try {
            const response = await this.retryableRequest(() => fetch(url.toString()));
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Place Details API error:', errorData);
                throw new Error(`Places Details API error: ${errorData.status || response.statusText}`);
            }

            const data = await response.json();
            if (data.status !== 'OK' || !data.result) {
                throw new Error(`Places Details API error: ${data.status}`);
            }

            return data.result;
        } catch (error) {
            console.error('Error fetching place details:', error);
            throw error;
        }
    }

    /**
     * Transform Google Places data to our database format and save to database
     */
    private async transformToDbFormat(place: any, details: any): Promise<Cafe | null> {
        try {
            const priceMapping: Record<number, PriceLevel> = {
                1: '$',
                2: '$$',
                3: '$$$'
            };

            const cafe: Cafe = {
                id: crypto.randomUUID(),
                google_place_id: place.place_id,
                name: place.name,
                location: `SRID=4326;POINT(${place.geometry.location.lng} ${place.geometry.location.lat})`,
                address: details.formatted_address,
                price_level: details.price_level ? priceMapping[details.price_level] : null,
                reviews: details.reviews?.map((review: any) => ({
                    text: review.text,
                    rating: review.rating
                })) || [],
                last_review_fetch: new Date().toISOString()
            };

            // Try to find existing cafe
            const { data: existingCafe } = await supabase
                .from('cafes')
                .select('id')
                .eq('google_place_id', place.place_id)
                .single();

            if (existingCafe) {
                // Update existing cafe
                const { error: updateError } = await supabase
                    .from('cafes')
                    .update(cafe)
                    .eq('id', existingCafe.id);

                if (updateError) {
                    console.error('Error updating cafe:', updateError);
                    return null;
                }

                // Return the updated cafe
                return {
                    ...cafe,
                    id: existingCafe.id
                };
            } else {
                // Insert new cafe
                const { error: insertError } = await supabase
                    .from('cafes')
                    .insert(cafe);

                if (insertError) {
                    console.error('Error inserting cafe:', insertError);
                    return null;
                }
            }

            return cafe;
        } catch (error) {
            console.error('Error transforming and saving cafe:', error);
            return null;
        }
    }

    /**
     * Transform Google's numeric price level to our format
     */
    private transformPriceLevel(level: number): PriceLevel {
        const levels: Record<number, PriceLevel> = {
            1: '$',
            2: '$$',
            3: '$$$',
            4: '$$$'
        };
        return levels[level] || '$$';
    }
}