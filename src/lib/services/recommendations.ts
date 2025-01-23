// src/lib/services/recommendations.ts
import type { Cafe, CafeRequest, VibeCategory, AmenityType, PriceLevel } from '$lib/types/database'
import { supabase } from '$lib/db/supabase'

interface ScoredCafe extends Cafe {
    distance: number;
    vibe_scores: Record<VibeCategory, number>;
    amenity_scores: Record<AmenityType, number>;
    _score?: number;
}

interface ScoreWeights {
    vibe: number;
    amenity: number;
    distance: number;
    price: number;
}

interface VibeScore {
    vibe_category: VibeCategory;
    confidence_score: number;
}

interface AmenityScore {
    amenity: AmenityType;
    confidence_score: number;
}

interface CafeWithDistance extends Cafe {
    distance: number;
}

interface CafeWithBasicInfo {
    id: string;
    name: string;
    price_level: PriceLevel;
    distance: number;
    _score?: number;
}

export class RecommendationService {
    private readonly WEIGHTS: ScoreWeights = {
        vibe: 0.4,
        amenity: 0.3,
        distance: 0.2,
        price: 0.1
    };

    private readonly MAX_PREFERRED_DISTANCE = 2000; // 2km

    private readonly VIBE_MAPPINGS: Record<string, VibeCategory[]> = {
        'relaxed': ['cozy', 'quiet'],
        'productive': ['quiet', 'modern'],
        'social': ['lively', 'artistic'],
        'inspiring': ['artistic', 'modern'],
        'traditional': ['traditional', 'cozy'],
        'trendy': ['modern', 'industrial']
    } as const;

    /**
     * Get cafe recommendations based on user preferences
     */
    async getRecommendations(
        lat: number,
        lng: number,
        request: CafeRequest,
        limit: number = 5
    ): Promise<ScoredCafe[]> {
        try {
            console.log('Getting recommendations for:', { lat, lng, request, limit });

            // Search for nearby cafes with pagination
            const { data: cafes, error } = await supabase.rpc('search_nearby_cafes', {
                search_lat: lat,
                search_lng: lng,
                radius_meters: 5000,
                price_filter: request.priceRange || null,
                page_size: Math.min(20, limit * 2), // Get a reasonable sample size for ranking
                page_number: 1
            });

            if (error) {
                console.error('Error searching nearby cafes:', error);
                throw error;
            }

            if (!cafes?.length) {
                console.warn('No cafes found in the area');
                throw new Error('No cafes found in this location');
            }

            console.log(`Found ${cafes.length} nearby cafes:`, cafes.map((c: any) => ({
                id: c.id,
                name: c.name,
                price: c.price_level,
                distance: c.distance
            })));

            // Process and rank cafes
            const scoredCafes: ScoredCafe[] = cafes.map((cafe: {
                id: string;
                google_place_id: string;
                name: string;
                location: string;
                address: string;
                distance: number;
                price_level: PriceLevel;
                reviews: any[];
                last_review_fetch: string;
                vibe_scores: Record<VibeCategory, number>;
                amenity_scores: Record<AmenityType, number>;
            }) => {
                // Check if cafe has scores
                const hasScores = cafe.vibe_scores && 
                    Object.keys(cafe.vibe_scores).length > 0 && 
                    cafe.amenity_scores && 
                    Object.keys(cafe.amenity_scores).length > 0;

                console.log(`Processing cafe ${cafe.name} (${cafe.id}):`, {
                    hasScores,
                    price: cafe.price_level,
                    distance: cafe.distance,
                    vibeScores: cafe.vibe_scores,
                    amenityScores: cafe.amenity_scores
                });

                // If no scores, use default scores
                if (!hasScores) {
                    console.log(`No scores found for cafe ${cafe.id}, using defaults`);
                    return {
                        ...cafe,
                        distance: cafe.distance,
                        vibe_scores: {
                            cozy: 0.5,
                            modern: 0.5,
                            quiet: 0.5,
                            lively: 0.5,
                            artistic: 0.5,
                            traditional: 0.5,
                            industrial: 0.5
                        } satisfies Record<VibeCategory, number>,
                        amenity_scores: {
                            wifi: 0.5,
                            outdoor_seating: 0.5,
                            power_outlets: 0.5,
                            pet_friendly: 0.5,
                            parking: 0.5,
                            workspace_friendly: 0.5,
                            food_menu: 0.5
                        } satisfies Record<AmenityType, number>
                    };
                }

                return {
                    ...cafe,
                    distance: cafe.distance,
                    vibe_scores: cafe.vibe_scores as Record<VibeCategory, number>,
                    amenity_scores: cafe.amenity_scores as Record<AmenityType, number>
                };
            });

            // Rank cafes based on scores
            const rankedCafes = this.rankCafes(scoredCafes, request);
            console.log(`Ranked ${rankedCafes.length} cafes:`, rankedCafes.map(c => ({
                name: c.name,
                score: c._score,
                price: c.price_level,
                distance: c.distance
            })));

            // Return top results
            const topCafes = rankedCafes.slice(0, limit);
            console.log(`Returning top ${topCafes.length} cafes:`, topCafes.map(c => ({
                name: c.name,
                score: c._score,
                price: c.price_level,
                distance: c.distance
            })));

            if (topCafes.length === 0) {
                throw new Error('No cafes match your preferences');
            }

            return topCafes;
        } catch (error) {
            console.error('Error in getRecommendations:', error);
            throw error;
        }
    }

    private processVibeScores(vibeData: VibeScore[]): Record<VibeCategory, number> {
        const scores: Partial<Record<VibeCategory, number>> = {};
        vibeData.forEach(({ vibe_category, confidence_score }) => {
            scores[vibe_category] = confidence_score;
        });
        return scores as Record<VibeCategory, number>;
    }

    private processAmenityScores(amenityData: AmenityScore[]): Record<AmenityType, number> {
        const scores: Partial<Record<AmenityType, number>> = {};
        amenityData.forEach(({ amenity, confidence_score }) => {
            scores[amenity] = confidence_score;
        });
        return scores as Record<AmenityType, number>;
    }

    private rankCafes(cafes: ScoredCafe[], request: CafeRequest): ScoredCafe[] {
        return cafes
            .map(cafe => ({
                ...cafe,
                _score: this.calculateTotalScore(cafe, request)
            }))
            .sort((a, b) => (b._score ?? 0) - (a._score ?? 0))
            .slice(0, 5);
    }

    /**
     * Calculate the overall score for a cafe based on user preferences
     */
    private calculateTotalScore(cafe: ScoredCafe, request: CafeRequest): number {
        const scores = {
            vibe: this.calculateVibeScore(cafe.vibe_scores, request.mood),
            amenity: this.calculateAmenityScore(cafe.amenity_scores, request.requirements),
            distance: this.calculateDistanceScore(cafe.distance),
            price: this.calculatePriceScore(cafe.price_level, request.priceRange)
        };

        return Object.entries(scores)
            .reduce((total, [key, score]) => 
                total + score * this.WEIGHTS[key as keyof ScoreWeights], 0);
    }

    /**
     * Calculate how well cafe vibes match desired mood
     */
    private calculateVibeScore(
        vibeScores: Record<VibeCategory, number>,
        mood: string
    ): number {
        const desiredVibes = this.VIBE_MAPPINGS[mood.toLowerCase()] || [];
        if (!desiredVibes.length) return 0.5;

        const scores = desiredVibes.map(vibe => vibeScores[vibe] || 0);
        return scores.reduce((sum, score) => sum + score, 0) / desiredVibes.length;
    }

    /**
     * Calculate how well cafe amenities match requirements
     */
    private calculateAmenityScore(
        amenityScores: Record<AmenityType, number>,
        requirements: string[]
    ): number {
        if (!requirements.length) return 1;

        const scores = requirements.map(req => 
            amenityScores[req as AmenityType] || 0
        );
        return scores.reduce((sum, score) => sum + score, 0) / requirements.length;
    }

    /**
     * Calculate distance-based score (closer is better)
     */
    private calculateDistanceScore(distanceMeters: number): number {
        return Math.max(0, 1 - (distanceMeters / this.MAX_PREFERRED_DISTANCE));
    }

    /**
     * Calculate price match score
     */
    private calculatePriceScore(cafePrice: PriceLevel, targetPrice: string | undefined): number {
        if (!cafePrice || !targetPrice) return 0.5;
        
        // Convert price levels to numbers for comparison
        const priceToNum = (price: string): number => price.length;
        const cafeNum = priceToNum(cafePrice);
        const targetNum = priceToNum(targetPrice);
        
        // Calculate score based on price difference
        const diff = Math.abs(cafeNum - targetNum);
        if (diff === 0) return 1;
        if (diff === 1) return 0.5;
        return 0;
    }
}