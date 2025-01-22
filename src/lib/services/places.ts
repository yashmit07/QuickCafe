// src/lib/services/places.ts
import { GOOGLE_PLACES_API_KEY } from '$env/static/private'
import type { Cafe } from '$lib/types/database'

export class PlacesService {
    private readonly API_BASE = 'https://maps.googleapis.com/maps/api'
    private readonly PLACES_TYPES = ['cafe', 'restaurant']

    /**
     * Geocode a location string to coordinates
     */
    async geocodeLocation(location: string): Promise<{ lat: number; lng: number }> {
        try {
            const url = `${this.API_BASE}/geocode/json?address=${encodeURIComponent(location)}&key=${GOOGLE_PLACES_API_KEY}`
            const response = await fetch(url)
            const data = await response.json()

            if (!data.results?.[0]) {
                throw new Error('No results found')
            }

            return data.results[0].geometry.location
        } catch (error) {
            console.error('Geocoding error:', error)
            throw new Error('Failed to geocode location')
        }
    }

    /**
     * Search for nearby cafes using Places API
     */
    async searchNearbyCafes(
        lat: number,
        lng: number,
        radius: number = 5000,
        minPrice?: number,
        maxPrice?: number
    ): Promise<Cafe[]> {
        const cafes: Cafe[] = []

        for (const type of this.PLACES_TYPES) {
            const url = new URL(`${this.API_BASE}/place/nearbysearch/json`)
            const params = {
                key: GOOGLE_PLACES_API_KEY,
                location: `${lat},${lng}`,
                radius: radius.toString(),
                type,
                rankby: 'rating',
                ...(minPrice !== undefined && { minprice: minPrice.toString() }),
                ...(maxPrice !== undefined && { maxprice: maxPrice.toString() })
            }

            url.search = new URLSearchParams(params).toString()

            try {
                const response = await fetch(url.toString())
                const data = await response.json()

                if (data.status !== 'OK') {
                    console.warn(`Places API warning for ${type}:`, data.status)
                    continue
                }

                // Transform and add results
                const transformed = await Promise.all(
                    data.results.map(async (place: any) => {
                        const details = await this.getPlaceDetails(place.place_id)
                        return this.transformToDbFormat(place, details)
                    })
                )

                cafes.push(...transformed)
            } catch (error) {
                console.error(`Error fetching ${type}:`, error)
            }
        }

        return cafes
    }

    /**
     * Get detailed information about a specific place
     */
    async getPlaceDetails(placeId: string): Promise<any> {
        const url = new URL(`${this.API_BASE}/place/details/json`)
        const params = {
            key: GOOGLE_PLACES_API_KEY,
            place_id: placeId,
            fields: [
                'reviews',
                'price_level',
                'formatted_address',
                'opening_hours',
                'website',
                'formatted_phone_number'
            ].join(',')
        }

        url.search = new URLSearchParams(params).toString()

        try {
            const response = await fetch(url.toString())
            const data = await response.json()

            if (data.status !== 'OK') {
                throw new Error(`Places Details API error: ${data.status}`)
            }

            return data.result
        } catch (error) {
            console.error('Error fetching place details:', error)
            throw error
        }
    }

    /**
     * Transform Google Places data to our database format
     */
    private transformToDbFormat(place: any, details: any): Cafe {
        return {
            id: crypto.randomUUID(), // Will be replaced by DB
            google_place_id: place.place_id,
            name: place.name,
            location: `POINT(${place.geometry.location.lng} ${place.geometry.location.lat})`,
            address: details.formatted_address,
            price_level: this.transformPriceLevel(details.price_level),
            reviews: details.reviews || [],
            last_review_fetch: new Date().toISOString()
        }
    }

    /**
     * Transform Google's numeric price level to our format
     */
    private transformPriceLevel(level: number): '$' | '$$' | '$$$' {
        const levels = {
            1: '$',
            2: '$$',
            3: '$$$',
            4: '$$$'
        }
        return levels[level as keyof typeof levels] || '$$'
    }
}