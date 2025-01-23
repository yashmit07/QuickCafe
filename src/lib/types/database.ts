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
    priceRange: string
    location: string
    requirements: string[]
}

export interface Cafe {
    id: string
    google_place_id: string
    name: string
    location: any // PostGIS point
    address: string
    price_level: PriceLevel
    reviews: any[]
    last_review_fetch: string
}