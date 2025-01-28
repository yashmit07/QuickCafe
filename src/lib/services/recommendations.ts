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
        limit: number = 20
    ): Promise<ScoredCafe[]> {
        try {
            console.log('Getting recommendations for:', { lat, lng, request, limit });

            // Search for nearby cafes
            const { data: cafes, error } = await supabase.rpc('find_cafes_v2', {
                search_lat: lat,
                search_lng: lng,
                radius_meters: 5000,
                price_filter: request.priceRange || null,
                page_size: limit
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
                distance: c.distance
            })));

            // Convert to ScoredCafe type and calculate scores
            const scoredCafes: ScoredCafe[] = cafes.map((cafe: any) => ({
                ...cafe,
                vibe_scores: cafe.vibe_scores || {},
                amenity_scores: cafe.amenity_scores || {},
                _score: this.calculateScore(
                    cafe,
                    request.mood,
                    request.requirements,
                    cafe.distance,
                    request.priceRange
                )
            }));

            // Sort by score and return results
            return scoredCafes.sort((a, b) => (b._score || 0) - (a._score || 0));
        } catch (error) {
            console.error('Error getting recommendations:', error);
            throw error;
        }
    }

    private calculateScore(
        cafe: any,
        targetMood: string,
        requirements: string[],
        distance: number,
        priceRange?: string
    ): number {
        // Calculate vibe score
        const vibeScore = cafe.vibe_scores[targetMood] || 0;

        // Calculate amenity score (average of required amenities)
        const amenityScores = requirements.map(req => cafe.amenity_scores[req] || 0);
        const amenityScore = amenityScores.length
            ? amenityScores.reduce((a, b) => a + b, 0) / amenityScores.length
            : 1; // If no requirements, give full score

        // Calculate distance score (inverse relationship - closer is better)
        const distanceScore = Math.max(0, 1 - (distance / this.MAX_PREFERRED_DISTANCE));

        // Calculate price score (exact match = 1, one level difference = 0.5, otherwise 0)
        const priceScore = this.calculatePriceScore(cafe.price_level, priceRange);

        // Calculate final weighted score
        return (
            this.WEIGHTS.vibe * vibeScore +
            this.WEIGHTS.amenity * amenityScore +
            this.WEIGHTS.distance * distanceScore +
            this.WEIGHTS.price * priceScore
        );
    }

    /**
     * Calculate how well cafe price matches user preference
     */
    private calculatePriceScore(cafePrice: string | null, targetPrice?: string): number {
        if (!targetPrice || !cafePrice) return 1; // If no price preference, give full score

        const priceToNumber = (price: string): number => {
            switch (price) {
                case '$': return 1;
                case '$$': return 2;
                case '$$$': return 3;
                default: return 0;
            }
        };

        const cafePriceNum = priceToNumber(cafePrice);
        const targetPriceNum = priceToNumber(targetPrice);
        const priceDiff = Math.abs(cafePriceNum - targetPriceNum);

        // Exact match = 1, one level difference = 0.5, otherwise 0
        return priceDiff === 0 ? 1 : priceDiff === 1 ? 0.5 : 0;
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
            distance: this.calculateDistanceScore(cafe.distance)
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
        // Direct match with the selected mood
        const directScore = vibeScores[mood.toLowerCase() as VibeCategory] || 0;
        
        // Also check mapped vibes if they exist
        const mappedVibes = this.VIBE_MAPPINGS[mood.toLowerCase()] || [];
        const mappedScores = mappedVibes.map(vibe => vibeScores[vibe] || 0);
        const mappedScore = mappedScores.length 
            ? mappedScores.reduce((sum, score) => sum + score, 0) / mappedScores.length
            : 0;

        // Use the better of the two scores
        return Math.max(directScore, mappedScore);
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
}