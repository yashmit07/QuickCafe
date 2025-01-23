// src/lib/services/cache.ts
import { supabase } from '$lib/db/supabase'
import type { Cafe, VibeCategory, AmenityType } from '$lib/types/database'

interface VibeScore {
    vibe_category: VibeCategory;
    confidence_score: number;
}

interface AmenityScore {
    amenity: AmenityType;
    confidence_score: number;
}

export class CacheService {
    private static readonly ONE_DAY = 24 * 60 * 60 * 1000;
    private static readonly ONE_WEEK = 7 * CacheService.ONE_DAY;

    private readonly LOCATION_CACHE_DURATION = CacheService.ONE_DAY;
    private readonly ANALYSIS_CACHE_DURATION = CacheService.ONE_WEEK;

    /**
     * Check if we have cached results for a location
     */
    async getLocationCache(searchLocation: string, priceRange?: string, radius: number = 5000): Promise<string[] | null> {
        try {
            const cacheKey = `${searchLocation}:${priceRange || 'any'}:${radius}`;
            const { data, error } = await supabase
                .from('location_cache')
                .select('cafe_ids, last_updated')
                .eq('search_location', cacheKey)
                .single();

            if (error || !data) {
                return null;
            }

            const cacheAge = Date.now() - new Date(data.last_updated).getTime();
            if (cacheAge > this.LOCATION_CACHE_DURATION) {
                await this.invalidateLocationCache(cacheKey);
                return null;
            }

            return data.cafe_ids;
        } catch (error) {
            console.error('Error getting location cache:', error);
            return null;
        }
    }

    /**
     * Store location search results in cache
     */
    async cacheLocationResults(searchLocation: string, cafeIds: string[], priceRange?: string, radius: number = 5000): Promise<void> {
        try {
            const cacheKey = `${searchLocation}:${priceRange || 'any'}:${radius}`;
            const { error } = await supabase
                .from('location_cache')
                .upsert({
                    search_location: cacheKey,
                    cafe_ids: cafeIds,
                    last_updated: new Date().toISOString()
                });

            if (error) {
                throw error;
            }
        } catch (error) {
            console.error('Error caching location results:', error);
            throw error;
        }
    }

    /**
     * Check if we have a recent vibe analysis for a cafe
     */
    async hasRecentAnalysis(cafeId: string): Promise<boolean> {
        try {
            // Check both vibes and amenities
            const [vibesResult, amenitiesResult] = await Promise.all([
                supabase
                    .from('cafe_vibes')
                    .select('last_analyzed')
                    .eq('cafe_id', cafeId)
                    .single(),
                supabase
                    .from('cafe_amenities')
                    .select('last_analyzed')
                    .eq('cafe_id', cafeId)
                    .single()
            ]);

            if (vibesResult.error || !vibesResult.data || 
                amenitiesResult.error || !amenitiesResult.data) {
                return false;
            }

            const vibesAge = Date.now() - new Date(vibesResult.data.last_analyzed).getTime();
            const amenitiesAge = Date.now() - new Date(amenitiesResult.data.last_analyzed).getTime();

            return vibesAge <= this.ANALYSIS_CACHE_DURATION && 
                   amenitiesAge <= this.ANALYSIS_CACHE_DURATION;
        } catch (error) {
            console.error('Error checking analysis recency:', error);
            return false;
        }
    }

    /**
     * Store cafe analysis results
     */
    async cacheAnalysisResults(
        cafeId: string,
        vibes: Record<string, number> | null | undefined,
        amenities: Record<string, number> | null | undefined
    ): Promise<void> {
        if (!vibes || !amenities) {
            console.log('Skipping cache update - missing scores for cafe:', cafeId);
            return;
        }

        const timestamp = new Date().toISOString();

        try {
            const vibeScores: VibeScore[] = Object.entries(vibes).map(([category, score]) => ({
                vibe_category: category as VibeCategory,
                confidence_score: score
            }));

            const amenityScores: AmenityScore[] = Object.entries(amenities).map(([amenity, score]) => ({
                amenity: amenity as AmenityType,
                confidence_score: score
            }));

            console.log('Caching analysis results for cafe:', cafeId);
            console.log('Vibe scores:', vibeScores);
            console.log('Amenity scores:', amenityScores);

            const { error } = await supabase.rpc('update_cafe_analysis', {
                p_cafe_id: cafeId,
                p_timestamp: timestamp,
                p_vibes: vibeScores,
                p_amenities: amenityScores
            });

            if (error) {
                throw error;
            }
            console.log('Successfully cached analysis results');
        } catch (error) {
            console.error('Error caching analysis results:', error);
            throw error;
        }
    }

    /**
     * Remove location from cache
     */
    async invalidateLocationCache(searchLocation: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('location_cache')
                .delete()
                .eq('search_location', searchLocation);

            if (error) {
                console.error('Error invalidating location cache:', error);
            }
        } catch (error) {
            console.error('Error invalidating location cache:', error);
        }
    }
}