// src/lib/services/cache.ts
import { supabase } from '$lib/db/supabase'
import type { Cafe } from '$lib/types/database'

export class CacheService {
    private readonly LOCATION_CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours
    private readonly ANALYSIS_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days

    /**
     * Check if we have cached results for a location
     */
    async getLocationCache(searchLocation: string): Promise<string[] | null> {
        const { data, error } = await supabase
            .from('location_cache')
            .select('cafe_ids, last_updated')
            .eq('search_location', searchLocation)
            .single()

        if (error || !data) {
            return null
        }

        // Check if cache is still valid
        const cacheAge = Date.now() - new Date(data.last_updated).getTime()
        if (cacheAge > this.LOCATION_CACHE_DURATION) {
            await this.invalidateLocationCache(searchLocation)
            return null
        }

        return data.cafe_ids
    }

    /**
     * Store location search results in cache
     */
    async cacheLocationResults(searchLocation: string, cafeIds: string[]): Promise<void> {
        const { error } = await supabase
            .from('location_cache')
            .upsert({
                search_location: searchLocation,
                cafe_ids: cafeIds,
                last_updated: new Date().toISOString()
            })

        if (error) {
            console.error('Error caching location results:', error)
        }
    }

    /**
     * Check if we have a recent vibe analysis for a cafe
     */
    async hasRecentAnalysis(cafeId: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('cafe_vibes')
            .select('last_analyzed')
            .eq('cafe_id', cafeId)
            .single()

        if (error || !data) {
            return false
        }

        const analysisAge = Date.now() - new Date(data.last_analyzed).getTime()
        return analysisAge <= this.ANALYSIS_CACHE_DURATION
    }

    /**
     * Store cafe analysis results
     */
    async cacheAnalysisResults(
        cafeId: string,
        vibes: Record<string, number>,
        amenities: Record<string, number>
    ): Promise<void> {
        const timestamp = new Date().toISOString()

        // Begin transaction
        const { error } = await supabase.rpc('update_cafe_analysis', {
            p_cafe_id: cafeId,
            p_timestamp: timestamp,
            p_vibes: Object.entries(vibes).map(([category, score]) => ({
                vibe_category: category,
                confidence_score: score
            })),
            p_amenities: Object.entries(amenities).map(([amenity, score]) => ({
                amenity,
                confidence_score: score
            }))
        })

        if (error) {
            console.error('Error caching analysis results:', error)
            throw error
        }
    }

    /**
     * Remove location from cache
     */
    private async invalidateLocationCache(searchLocation: string): Promise<void> {
        const { error } = await supabase
            .from('location_cache')
            .delete()
            .eq('search_location', searchLocation)

        if (error) {
            console.error('Error invalidating location cache:', error)
        }
    }
}