// src/lib/services/cache.ts
import { Redis } from '@upstash/redis'
import { UPSTASH_REDIS_URL, UPSTASH_REDIS_TOKEN } from '$env/static/private'

export class CacheService {
    private static readonly REDIS_TTL = 86400; // 24 hours in seconds
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
        priceRange?: string
    ): Promise<string[] | null> {
        try {
            const key = this.getLocationCacheKey(lat, lng, radius, priceRange);
            console.log('Checking Redis cache for location:', { lat, lng, priceRange });
            
            // Get raw data from Redis
            const cached = await this.redis.get<string>(key);
            
            if (cached) {
                try {
                    // Safely parse the JSON string
                    const parsedData = typeof cached === 'string' ? JSON.parse(cached) : cached;
                    return Array.isArray(parsedData) ? parsedData : null;
                } catch (parseError) {
                    console.error('Error parsing cached data:', parseError);
                    return null;
                }
            }
            
            console.log('Redis cache miss for location:', { lat, lng, priceRange });
            return null;
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
        priceRange?: string
    ): Promise<void> {
        try {
            const key = this.getLocationCacheKey(lat, lng, radius, priceRange);
            
            // Ensure we're storing a valid JSON string
            const dataToCache = JSON.stringify(cafeIds);
            
            await this.redis.set(key, dataToCache, {
                ex: CacheService.REDIS_TTL // TTL in seconds
            });
            
            console.log('Successfully cached location results in Redis');
        } catch (error) {
            console.error('Error caching location results:', error);
            throw error;
        }
    }

    /**
     * Clear all data from Redis cache
     */
    async clearRedisCache(): Promise<void> {
        try {
            await this.redis.flushdb();
            console.log('Successfully cleared Redis cache');
        } catch (error) {
            console.error('Error clearing Redis cache:', error);
            throw error;
        }
    }

    private getLocationCacheKey(lat: number, lng: number, radius: number, priceRange?: string): string {
        const roundedLat = lat.toFixed(4);
        const roundedLng = lng.toFixed(4);
        return `location:${roundedLat}:${roundedLng}:${radius}${priceRange ? `:${priceRange}` : ''}`;
    }
}