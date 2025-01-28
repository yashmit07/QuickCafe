import { PlacesServerService } from '$lib/services/places.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
    const location = url.searchParams.get('location');
    
    if (!location) {
        return new Response(
            JSON.stringify({ error: 'Location is required' }), 
            { status: 400 }
        );
    }

    try {
        const placesService = new PlacesServerService();
        await placesService.geocodeLocation(location);
        
        return new Response(
            JSON.stringify({ valid: true }), 
            { status: 200 }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ 
                error: 'Invalid location',
                details: error instanceof Error ? error.message : 'Failed to validate location'
            }), 
            { status: 400 }
        );
    }
}; 