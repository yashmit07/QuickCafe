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
    async searchNearbyCafes(lat: number, lng: number, radius: number = 4828, priceLevel?: string): Promise<Cafe[]> {
        const params = new URLSearchParams({
            key: GOOGLE_PLACES_API_KEY,
            location: `${lat},${lng}`,
            type: 'cafe',
            radius: radius.toString(),
            keyword: 'coffee cafe'
        });

        if (priceLevel) {
            const priceMap: Record<string, number> = { '$': 1, '$$': 2, '$$$': 3 };
            const price = priceMap[priceLevel];
            if (price) {
                params.append('minprice', price.toString());
                params.append('maxprice', price.toString());
            }
        }

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

    /**
     * Get detailed information about a specific place and transform to our format
     */
    private async getPlaceDetails(place: GooglePlace): Promise<Cafe | null> {
        try {
            const url = `${this.PLACES_API_BASE}/details/json?key=${GOOGLE_PLACES_API_KEY}&place_id=${place.place_id}&fields=${this.PLACE_DETAILS_FIELDS}`;
            const response = await this.retryableRequest(url);
            
            if (!response.ok) {
                throw new Error(`Places Details API error: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.status !== 'OK' || !data.result) {
                throw new Error(`Places Details API error: ${data.status}`);
            }

            const details = data.result;
            const priceMapping: Record<number, PriceLevel> = { 1: '$', 2: '$$', 3: '$$$' };

            const cafe: Cafe = {
                id: crypto.randomUUID(),
                google_place_id: place.place_id,
                name: place.name,
                location: `SRID=4326;POINT(${place.geometry.location.lng} ${place.geometry.location.lat})`,
                address: details.formatted_address,
                price_level: details.price_level ? priceMapping[details.price_level] : null,
                reviews: details.reviews?.map(review => ({
                    text: review.text,
                    rating: review.rating
                })) || [],
                last_review_fetch: new Date().toISOString()
            };

            // Update or insert cafe
            const { data: existingCafe } = await supabase
                .from('cafes')
                .select('id')
                .eq('google_place_id', place.place_id)
                .single();

            if (existingCafe) {
                await supabase
                    .from('cafes')
                    .update(cafe)
                    .eq('id', existingCafe.id);
                return { ...cafe, id: existingCafe.id };
            } else {
                await supabase
                    .from('cafes')
                    .insert(cafe);
                return cafe;
            }
        } catch (error) {
            console.error('Error processing place:', error);
            return null;
        }
    }
}