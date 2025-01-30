export type PriceLevel = '$' | '$$' | '$$$' | null;

export type VibeCategory = 
    | 'cozy' | 'modern' | 'quiet' | 'lively' 
    | 'artistic' | 'traditional' | 'industrial'

export type AmenityType = 
    | 'wifi' | 'outdoor_seating' | 'power_outlets'
    | 'pet_friendly' | 'parking' | 'workspace_friendly'
    | 'food_menu'

export interface CafeRequest {
    mood: string
    location: string
    requirements: string[]
    priceRange?: string
}

export interface Cafe {
    id: string
    google_place_id: string
    name: string
    location: any // PostGIS point
    address: string
    price_level: PriceLevel
    reviews: any // JSONB
    operating_hours: any // JSONB
    photos: any // JSONB
    last_review_fetch: string
    created_at?: string
    updated_at?: string
}

export interface CafeVibe {
    cafe_id: string
    vibe_category: VibeCategory
    confidence_score: number
    last_analyzed: string
}

export interface CafeAmenity {
    cafe_id: string
    amenity: AmenityType
    confidence_score: number
    last_analyzed: string
}

export interface LocationCache {
    search_location: string
    cafe_ids: string[]
    last_updated: string
}

export interface ScoredCafe extends Cafe {
    distance: number
    vibe_scores: Record<VibeCategory, number>
    amenity_scores: Record<AmenityType, number>
    _score?: number
}