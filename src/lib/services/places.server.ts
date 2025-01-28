import { GOOGLE_PLACES_API_KEY } from '$env/static/private'
import type { Cafe } from '$lib/types/database'
import { supabase } from '$lib/db/supabase'

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

interface GooglePlaceDetails extends GooglePlace {
    opening_hours?: {
        periods: {
            open: { day: number; time: string };
            close: { day: number; time: string };
        }[];
        weekday_text: string[];
    };
    photos?: {
        photo_reference: string;
        width: number;
        height: number;
    }[];
}

export class PlacesServerService {
    private readonly GEOCODING_API_BASE = 'https://maps.googleapis.com/maps/api/geocode'
    private readonly PLACES_API_BASE = 'https://maps.googleapis.com/maps/api/place'
    private readonly PLACE_DETAILS_FIELDS = [
        'reviews',
        'price_level',
        'formatted_address',
        'opening_hours',
        'website',
        'formatted_phone_number'
    ].join(',');

    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 2000; // 2 seconds
    private readonly DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    constructor() {
        if (!GOOGLE_PLACES_API_KEY) {
            throw new Error('Google Places API key is required');
        }
    }

    private async retryableRequest(url: string): Promise<Response> {
        let lastError: Error | null = null;
        
        for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
            try {
                const response = await fetch(url);
                
                if (response.status === 429) {
                    await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
                    continue;
                }
                
                return response;
            } catch (error) {
                lastError = error as Error;
                if (attempt < this.MAX_RETRIES - 1) {
                    await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
                }
            }
        }
        
        throw lastError || new Error('Request failed after retries');
    }

    /**
     * Geocode a location string to coordinates using the Geocoding API
     */
    async geocodeLocation(location: string): Promise<{ lat: number; lng: number }> {
        const url = `${this.GEOCODING_API_BASE}/json?address=${encodeURIComponent(location)}&key=${GOOGLE_PLACES_API_KEY}`;
        
        const response = await this.retryableRequest(url);
        if (!response.ok) {
            throw new Error(`Failed to geocode location: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) {
            throw new Error(`No results found for location: ${location}`);
        }

        return data.results[0].geometry.location;
    }

    /**
     * Search for nearby cafes using Places API
     */
    async searchNearbyCafes(lat: number, lng: number, radius: number = 4828): Promise<Cafe[]> {
        const params = new URLSearchParams({
            key: GOOGLE_PLACES_API_KEY,
            location: `${lat},${lng}`,
            type: 'cafe',
            radius: radius.toString(),
            keyword: 'coffee cafe'
        });

        const url = `${this.PLACES_API_BASE}/nearbysearch/json?${params.toString()}`;
        const response = await this.retryableRequest(url);
        
        if (!response.ok) {
            throw new Error(`Places API error: ${response.statusText}`);
        }

        const data = await response.json() as PlaceSearchResponse;
        if (data.status === 'ZERO_RESULTS' || !data.results?.length) {
            return [];
        }

        if (data.status !== 'OK') {
            throw new Error(`Places API error: ${data.status}`);
        }

        // Filter out non-cafes
        const filteredResults = data.results.filter(place => {
            const name = place.name.toLowerCase();
            const excludeTerms = ['mcdonalds', 'burger', 'taco', 'subway', 'pizza', 'restaurant'];
            return !excludeTerms.some(term => name.includes(term));
        });

        const placesPromises = filteredResults.map(place => this.getPlaceDetails(place));
        const places = await Promise.all(placesPromises);
        return places.filter((place): place is Cafe => place !== null);
    }

    private async getPlaceDetails(place: GooglePlace): Promise<Cafe | null> {
        try {
            const detailsUrl = `${this.PLACES_API_BASE}/details/json?place_id=${place.place_id}&fields=name,geometry,formatted_address,price_level,reviews,opening_hours,photos&key=${GOOGLE_PLACES_API_KEY}`;
            const response = await this.retryableRequest(detailsUrl);
            const data = await response.json();
            
            if (data.status !== 'OK' || !data.result) {
                throw new Error(`Failed to get place details: ${data.status}`);
            }

            const details: GooglePlaceDetails = data.result;

            // Process operating hours
            const operating_hours = details.opening_hours?.periods.reduce((acc, period) => {
                const openDay = this.DAYS[period.open.day];
                const closeDay = this.DAYS[period.close.day];
                
                if (openDay === closeDay) {
                    acc[openDay] = {
                        open: `${period.open.time.slice(0, 2)}:${period.open.time.slice(2)}`,
                        close: `${period.close.time.slice(0, 2)}:${period.close.time.slice(2)}`
                    };
                }
                return acc;
            }, {} as Record<string, { open: string; close: string }>) || null;

            // Process photos
            const photos = await Promise.all(
                (details.photos || []).slice(0, 3).map(async photo => {
                    const photoUrl = `${this.PLACES_API_BASE}/photo?maxwidth=${photo.width}&photoreference=${photo.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
                    return {
                        url: photoUrl,
                        width: photo.width,
                        height: photo.height
                    };
                })
            );

            const cafe: Cafe = {
                id: crypto.randomUUID(),
                google_place_id: place.place_id,
                name: place.name,
                location: `POINT(${place.geometry.location.lng} ${place.geometry.location.lat})`,
                address: details.formatted_address || '',
                price_level: this.getPriceLevel(details.price_level),
                reviews: details.reviews || [],
                operating_hours,
                photos,
                last_review_fetch: new Date().toISOString()
            };

            return cafe;
        } catch (error) {
            console.error('Error processing place:', error);
            return null;
        }
    }

    private getPriceLevel(level?: number): PriceLevel {
        switch (level) {
            case 1: return '$';
            case 2: return '$$';
            case 3: return '$$$';
            default: return null;
        }
    }
} 