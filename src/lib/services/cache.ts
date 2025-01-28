// src/lib/services/cache.ts
import { supabase } from '$lib/db/supabase'
import type { Cafe, VibeCategory, AmenityType } from '$lib/types/database'
import { Redis } from '@upstash/redis'
import { UPSTASH_REDIS_URL, UPSTASH_REDIS_TOKEN } from '$env/static/private'

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
    private static readonly REDIS_TTL = 3600; // 1 hour in seconds

    private readonly LOCATION_CACHE_DURATION = CacheService.ONE_DAY;
    private readonly ANALYSIS_CACHE_DURATION = CacheService.ONE_WEEK;
    private redis: Redis;

    constructor() {
        this.redis = new Redis({
            url: UPSTASH_REDIS_URL,
            token: UPSTASH_REDIS_TOKEN
        });
    }

    /**
     * Check if we have cached results for a location
     */
    async getLocationCache(
        lat: number,
        lng: number,
        radius: number = 5000,
        priceLevel?: string
    ): Promise<string[] | null> {
        try {
            // Try Redis first
            const cacheKey = this.buildLocationCacheKey(lat, lng, radius, priceLevel);
            const redisCache = await this.redis.get<string[]>(cacheKey);
            
            if (redisCache) {
                console.log('Redis cache hit for location:', { lat, lng, priceLevel });
                return redisCache;
            }

            // Try Supabase if not in Redis
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

            // Store in Redis for faster subsequent access
            await this.redis.set(cacheKey, data.cafe_ids, {
                ex: CacheService.REDIS_TTL
            });

            return data.cafe_ids;
        } catch (error) {
            console.error('Error getting location cache:', error);
            return null;
        }
    }

    /**
     * Store location search results in cache
     */
    async cacheLocationResults(
        lat: number,
        lng: number,
        cafeIds: string[],
        radius: number = 5000,
        priceLevel?: string
    ): Promise<void> {
        try {
            const cacheKey = this.buildLocationCacheKey(lat, lng, radius, priceLevel);
            
            // Store in both Redis and Supabase
            await Promise.all([
                this.redis.set(cacheKey, cafeIds, {
                    ex: CacheService.REDIS_TTL
                }),
                supabase
                    .from('location_cache')
                    .upsert({
                        search_location: cacheKey,
                        cafe_ids: cafeIds,
                        last_updated: new Date().toISOString()
                    })
            ]);
        } catch (error) {
            console.error('Error caching location results:', error);
            throw error;
        }
    }

    /**
     * Check if we have a recent analysis for a cafe
     */
    async hasRecentAnalysis(cafeId: string): Promise<boolean> {
        try {
            // Check Redis first
            const redisKey = `analysis:${cafeId}`;
            const redisCache = await this.redis.get(redisKey);
            if (redisCache) {
                return true;
            }

            // Check database if not in Redis
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
            const isRecent = vibesAge <= this.ANALYSIS_CACHE_DURATION && 
                           amenitiesAge <= this.ANALYSIS_CACHE_DURATION;

            if (isRecent) {
                // Cache in Redis for faster subsequent checks
                await this.redis.set(redisKey, true, {
                    ex: CacheService.REDIS_TTL
                });
            }

            return isRecent;
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
            // Convert vibes and amenities to the format expected by the database function
            const vibeScores = Object.entries(vibes)
                .filter(([_, score]) => score > 0.4)
                .map(([category, score]) => ({
                    vibe_category: category,
                    confidence_score: score
                }));

            const amenityScores = Object.entries(amenities)
                .filter(([_, score]) => score > 0.5)
                .map(([amenity, score]) => ({
                    amenity: amenity,
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

    private buildLocationCacheKey(
        lat: number,
        lng: number,
        radius: number = 5000,
        priceLevel?: string
    ): string {
        // Round coordinates to 4 decimal places (about 11m precision)
        const roundedLat = Math.round(lat * 10000) / 10000;
        const roundedLng = Math.round(lng * 10000) / 10000;
        const baseKey = `${roundedLat},${roundedLng}:${radius}`;
        return priceLevel ? `${baseKey}:${priceLevel}` : baseKey;
    }
}