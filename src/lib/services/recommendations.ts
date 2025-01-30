// src/lib/services/recommendations.ts
import type { Cafe, CafeRequest, VibeCategory, AmenityType, PriceLevel } from '$lib/types/database'
import { supabase } from '$lib/db/supabase'

interface ScoredCafe extends Cafe {
    distance: number;
    vibe_scores: Record<string, number>;
    amenity_scores: Record<string, number>;
    _score?: number;
}

interface ScoreWeights {
    vibe: number;
    amenity: number;
    distance: number;
    price: number;
}

interface RecommendationResults {
    recommendations: ScoredCafe[];
    otherCafes: ScoredCafe[];
}

export class RecommendationService {
    private readonly WEIGHTS: ScoreWeights = {
        vibe: 0.35,
        amenity: 0.25,
        distance: 0.25,
        price: 0.15
    };

    private readonly MAX_PREFERRED_DISTANCE = 5000; // 5km

    private readonly COMPLEMENTARY_VIBES: Record<VibeCategory, VibeCategory[]> = {
        cozy: ['quiet', 'traditional'],
        modern: ['artistic', 'industrial', 'lively'],
        quiet: ['cozy', 'traditional'],
        lively: ['modern', 'artistic'],
        artistic: ['modern', 'industrial', 'lively'],
        traditional: ['cozy', 'quiet'],
        industrial: ['modern', 'artistic']
    } as const;

    /**
     * Get cafe recommendations based on user preferences
     */
    async getRecommendations(
        lat: number,
        lng: number,
        request: CafeRequest,
        limit: number = 20
    ): Promise<RecommendationResults> {
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
                    request.requirements || [],
                    cafe.distance,
                    request.priceRange
                )
            }));

            // Sort all cafes by score
            const sortedCafes = [...scoredCafes].sort((a, b) => (b._score || 0) - (a._score || 0));

            // Get top 5 recommendations and next 15 other cafes
            const recommendations = sortedCafes.slice(0, 5);
            const otherCafes = sortedCafes.slice(5, 20);

            console.log(`Got ${recommendations.length} recommendations and ${otherCafes.length} other cafes`);
            
            // Log the recommendations for debugging
            console.log('Top recommendations:', recommendations.map(cafe => ({
                name: cafe.name,
                score: cafe._score,
                vibeScores: cafe.vibe_scores,
                amenityScores: cafe.amenity_scores,
                distance: cafe.distance
            })));

            return { recommendations, otherCafes };
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
        const vibeScores = cafe.vibe_scores || {};
        console.log(`Raw vibe scores for ${cafe.name}:`, vibeScores);
        
        // Direct vibe score for target mood
        const directVibeScore = vibeScores[targetMood] || 0;
        console.log(`Direct ${targetMood} score for ${cafe.name}:`, directVibeScore);
        
        // Get complementary vibes for additional scoring
        const complementaryVibes = this.COMPLEMENTARY_VIBES[targetMood as VibeCategory] || [];
        const complementaryScores = complementaryVibes.map(vibe => vibeScores[vibe] || 0);
        
        // More generous complementary scoring - use 80% of complementary vibe scores
        const complementaryScore = complementaryScores.length > 0
            ? complementaryScores.reduce((sum, score) => sum + score, 0) * 0.8 / complementaryScores.length
            : 0;
        console.log(`Complementary vibe score for ${cafe.name}:`, complementaryScore);

        // Use weighted combination of direct and complementary scores
        const totalVibeScore = directVibeScore > 0 
            ? directVibeScore 
            : complementaryScore > 0 
                ? complementaryScore 
                : 0.3; // Base score for any cafe
        console.log(`Total vibe score for ${cafe.name}:`, totalVibeScore);

        // Calculate amenity score (average of required amenities)
        const amenityScores = cafe.amenity_scores || {};
        const amenityMatchScores = requirements.map(req => {
            const score = amenityScores[req] || 0;
            console.log(`Amenity ${req} score for ${cafe.name}:`, score);
            return score;
        });
        
        // More lenient amenity scoring - if no scores, assume neutral
        const amenityScore = amenityMatchScores.length
            ? amenityMatchScores.reduce((a, b) => a + b, 0) / amenityMatchScores.length || 0.4
            : 1; // If no requirements, give full score

        // Calculate distance score (inverse relationship - closer is better)
        const distanceScore = Math.max(0, 1 - (distance / this.MAX_PREFERRED_DISTANCE));

        // Calculate price score (exact match = 1, one level difference = 0.7, otherwise 0.4)
        const priceScore = this.calculatePriceScore(cafe.price_level, priceRange);

        // Calculate final weighted score
        const score = (
            this.WEIGHTS.vibe * totalVibeScore +
            this.WEIGHTS.amenity * amenityScore +
            this.WEIGHTS.distance * distanceScore +
            this.WEIGHTS.price * priceScore
        );

        console.log(`Scoring cafe ${cafe.name}:`, {
            vibeScore: totalVibeScore,
            amenityScore,
            distanceScore,
            priceScore,
            finalScore: score,
            rawVibeScores: vibeScores,
            rawAmenityScores: amenityScores,
            targetMood,
            requirements
        });

        return score;
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

        // More lenient price scoring
        return priceDiff === 0 ? 1 : priceDiff === 1 ? 0.7 : 0.4;
    }
}