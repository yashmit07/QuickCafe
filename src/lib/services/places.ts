// src/lib/services/places.ts
import type { Cafe } from '$lib/types/database'
import { GOOGLE_PLACES_API_KEY } from '$env/static/private'
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

export class PlacesService {
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
            keyword: 'cafe coffee',
            rankby: 'distance'
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

        // Filter out non-cafes more strictly
        const filteredResults = data.results.filter(place => {
            const name = place.name.toLowerCase();
            // Exclude restaurants and non-cafe establishments
            const excludeTerms = [
                'restaurant', 'mcdonalds', 'burger', 'taco', 'subway', 'pizza',
                'pho', 'thai', 'sushi', 'chinese', 'indian', 'mexican',
                'bbq', 'grill', 'steakhouse', 'buffet', 'diner'
            ];
            // Include terms that suggest it's a cafe
            const includeTerms = ['cafe', 'coffee', 'tea', 'bakery', 'roaster'];
            
            // More lenient filtering - only need to match include terms
            return includeTerms.some(term => name.includes(term));
        });

        // Take top 20 results after filtering
        const limitedResults = filteredResults.slice(0, 20);
        const placesPromises = limitedResults.map(place => this.getPlaceDetails(place));
        const places = await Promise.all(placesPromises);
        return places.filter((place): place is Cafe => place !== null);
    }

    /**
     * Get detailed information about a specific place and transform to our format
     */
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
            const operating_hours = details.opening_hours ? {
                periods: details.opening_hours.periods,
                weekday_text: details.opening_hours.weekday_text
            } : null;

            // Process photos
            const photos = details.photos ? {
                references: details.photos.map(photo => ({
                    reference: photo.photo_reference,
                    width: photo.width,
                    height: photo.height
                }))
            } : null;

            const cafe: Cafe = {
                id: crypto.randomUUID(),
                google_place_id: place.place_id,
                name: place.name,
                location: `POINT(${place.geometry.location.lng} ${place.geometry.location.lat})`,
                address: details.formatted_address || '',
                price_level: this.getPriceLevel(details.price_level),
                reviews: details.reviews || null,
                operating_hours,
                photos,
                last_review_fetch: new Date().toISOString()
            };

            // Update or insert cafe
            const { data: existingCafes, error: lookupError } = await supabase
                .from('cafes')
                .select('id')
                .eq('google_place_id', place.place_id);

            if (lookupError) {
                console.error('Error looking up cafe:', lookupError);
                return null;
            }

            if (existingCafes && existingCafes.length > 0) {
                const existingCafe = existingCafes[0];
                const { error: updateError } = await supabase
                    .from('cafes')
                    .update(cafe)
                    .eq('id', existingCafe.id);
                
                if (updateError) {
                    console.error('Error updating cafe:', updateError);
                    return null;
                }
                return { ...cafe, id: existingCafe.id };
            } else {
                const { data: insertedCafes, error: insertError } = await supabase
                    .from('cafes')
                    .insert(cafe)
                    .select();
                
                if (insertError || !insertedCafes || insertedCafes.length === 0) {
                    console.error('Error inserting cafe:', insertError);
                    return null;
                }
                return insertedCafes[0];
            }
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