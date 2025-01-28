import { CacheService } from '$lib/services/cache';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
    try {
        const cacheService = new CacheService();
        await cacheService.clearRedisCache();
        
        return new Response(
            JSON.stringify({ message: 'Cache cleared successfully' }), 
            { status: 200 }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ 
                error: 'Failed to clear cache',
                details: error instanceof Error ? error.message : 'Unknown error'
            }), 
            { status: 500 }
        );
    }
}; 