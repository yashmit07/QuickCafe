// src/routes/api/getRecommendation/+server.ts
import { createParser } from 'eventsource-parser'
import { OPENAI_API_KEY } from '$env/static/private'
import type { RequestHandler } from './$types'
import type { Cafe, CafeRequest, VibeCategory, AmenityType } from '$lib/types/database'
import { AnalysisService } from '$lib/services/analysis'
import { RecommendationService } from '$lib/services/recommendations'
import { PlacesService } from '$lib/services/places'
import { CacheService } from '$lib/services/cache'
import { supabase, verifyDatabaseSetup } from '$lib/db/supabase'
import type { ParseEvent, EventSourceParseCallback } from 'eventsource-parser'

interface OpenAIPayload {
    model: string;
    messages: { role: string; content: string }[];
    temperature: number;
    max_tokens: number;
    top_p: number;
    frequency_penalty: number;
    presence_penalty: number;
    stream: boolean;
    n: number;
}

interface OpenAIStreamEvent {
    type: string;
    data: string;
}

interface OpenAIStreamChoice {
    delta: {
        content?: string;
    };
}

interface OpenAIStreamResponse {
    choices: OpenAIStreamChoice[];
}

const analysisService = new AnalysisService()
const recommendationService = new RecommendationService()
const placesService = new PlacesService()
const cacheService = new CacheService()

export const POST: RequestHandler = async ({ request }) => {
    try {
        // 0. Verify database setup
        await verifyDatabaseSetup();

        const body = await request.json();
        console.log('Received request body:', body);

        const { mood, priceRange, location, requirements = [] } = body as CafeRequest;
        console.log('Parsed request:', { mood, priceRange, location, requirements });

        // Validate required fields
        if (!location) {
            return new Response(
                JSON.stringify({ error: 'Location is required' }), 
                { status: 400 }
            );
        }

        if (!mood) {
            return new Response(
                JSON.stringify({ error: 'Mood is required' }), 
                { status: 400 }
            );
        }

        // Validate mood is one of the allowed values
        const validMoods: VibeCategory[] = ['cozy', 'modern', 'quiet', 'lively', 'artistic', 'traditional', 'industrial'];
        if (!validMoods.includes(mood as VibeCategory)) {
            return new Response(
                JSON.stringify({ 
                    error: 'Invalid mood value',
                    validMoods 
                }), 
                { status: 400 }
            );
        }

        // Validate price range if provided
        if (priceRange && !['$', '$$', '$$$'].includes(priceRange)) {
            return new Response(
                JSON.stringify({ 
                    error: 'Invalid price range',
                    validPriceRanges: ['$', '$$', '$$$']
                }), 
                { status: 400 }
            );
        }

        // Validate requirements if provided
        const validRequirements: AmenityType[] = [
            'wifi', 'outdoor_seating', 'power_outlets',
            'pet_friendly', 'parking', 'workspace_friendly',
            'food_menu'
        ];
        
        const invalidRequirements = requirements.filter(req => !validRequirements.includes(req as AmenityType));
        if (invalidRequirements.length > 0) {
            return new Response(
                JSON.stringify({ 
                    error: 'Invalid requirements',
                    invalidRequirements,
                    validRequirements 
                }), 
                { status: 400 }
            );
        }

        // Variables used across both cache hit/miss paths
        let cafes: Cafe[] = []
        let coordinates: { lat: number; lng: number }

        // 1. Check location cache first
        try {
            console.log('Checking location cache for:', location);
            const cachedCafeIds = await cacheService.getLocationCache(location)

            if (cachedCafeIds) {
                console.log('Cache hit for location:', location);
                // Use cached cafe IDs
                const { data, error } = await supabase
                    .from('cafes')
                    .select('*')
                    .in('id', cachedCafeIds)
                
                if (error) {
                    console.error('Error fetching cafes from cache:', error);
                    throw error;
                }

                if (!data?.length) {
                    console.log('Cache invalid, proceeding with new search');
                    // Cache is invalid - proceed with new search
                    await cacheService.invalidateLocationCache(location)
                } else {
                    cafes = data;
                    console.log(`Found ${cafes.length} cafes in cache`);
                }
            } else {
                console.log('Cache miss for location:', location);
            }
        } catch (error) {
            console.error('Error getting location cache:', error)
            // Continue without cache
        }

        // If no cached results or cache was invalid
        if (!cafes.length) {
            try {
                // 2. Geocode location
                console.log('Geocoding location:', location);
                coordinates = await placesService.geocodeLocation(location)
                console.log('Geocoded coordinates:', coordinates);

                // 3. Search for nearby cafes
                console.log('Searching for nearby cafes...');
                const nearbyCafes = await placesService.searchNearbyCafes(
                    coordinates.lat,
                    coordinates.lng,
                    5000,
                    priceRange
                )
                console.log(`Found ${nearbyCafes.length} nearby cafes`);
                
                if (!nearbyCafes.length) {
                    return new Response(
                        JSON.stringify({ error: 'No cafes found in this location' }), 
                        { status: 404 }
                    )
                }

                // 4. Store cafes
                try {
                    console.log('Storing cafes in database...');
                    const { data: storedCafes, error } = await supabase
                        .from('cafes')
                        .upsert(nearbyCafes)
                        .select()
                    
                    if (error) {
                        console.error('Error storing cafes:', error);
                        throw error;
                    }

                    if (!storedCafes?.length) {
                        console.error('No cafes were stored');
                        throw new Error('Failed to store cafe data')
                    }
                    
                    cafes = storedCafes
                    console.log(`Stored ${cafes.length} cafes`);

                    // Cache the location results
                    console.log('Caching location results...');
                    await cacheService.cacheLocationResults(
                        location, 
                        cafes.map(cafe => cafe.id)
                    )
                    console.log('Location results cached');
                } catch (error) {
                    console.error('Error storing cafes:', error)
                    // Continue with the cafes we found
                    cafes = nearbyCafes
                }
            } catch (error) {
                console.error('Error in cafe search:', error);
                return new Response(
                    JSON.stringify({ 
                        error: 'Invalid location',
                        details: error instanceof Error ? error.message : 'Failed to geocode location'
                    }), 
                    { status: 400 }
                )
            }
        } else {
            // Get coordinates for recommendation service
            coordinates = await placesService.geocodeLocation(location)
        }

        // 5. Get or perform analysis for each cafe
        console.log('Analyzing cafes...');
        for (const cafe of cafes) {
            if (!(await cacheService.hasRecentAnalysis(cafe.id))) {
                console.log(`Analyzing cafe ${cafe.id}...`);
                const analysis = await analysisService.analyzeReviews(cafe)
                if (analysis) {
                    await cacheService.cacheAnalysisResults(
                        cafe.id,
                        analysis.vibes,
                        analysis.amenities
                    )
                }
            }
        }
        console.log('Cafe analysis complete');

        // 6. Get scored and ranked recommendations
        console.log('Getting recommendations...');
        const rankedCafes = await recommendationService.getRecommendations(
            coordinates.lat,
            coordinates.lng,
            { mood, priceRange, location, requirements },
            5
        )
        console.log(`Got ${rankedCafes.length} recommendations`);

        if (!rankedCafes.length) {
            return new Response(
                JSON.stringify({ error: 'No cafes match your preferences' }), 
                { status: 404 }
            )
        }

        // 7. Create prompt using ranked data
        const prompt = `Act as a knowledgeable local café expert. I have analyzed and ranked ${rankedCafes.length} best matching cafes in ${location} based on:

        Desired Vibe: ${mood}
        Price Range: ${priceRange}
        Special Requirements: ${requirements.join(', ')}

        Here are the best matches in order of relevance. For each café, provide:
        1. Name and key details (price, distance)
        2. Brief description of atmosphere and offerings
        3. Notable features that match the requirements
        4. Best suited for (e.g., working, meetings, casual hangout)

        Format each recommendation in a clean, easy-to-read way.

        Cafe data: ${JSON.stringify(rankedCafes, null, 2)}`

        // 8. Stream recommendations
        const payload: OpenAIPayload = {
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 1000,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
            stream: true,
            n: 1
        }

        const stream = await OpenAIStream(payload)
        return new Response(stream)

    } catch (error) {
        console.error('Error:', error)
        return new Response(
            JSON.stringify({ 
                error: 'Failed to get recommendations',
                details: error instanceof Error ? error.message : 'Unknown error'
            }), 
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        )
    }
}

async function OpenAIStream(payload: OpenAIPayload): Promise<ReadableStream> {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`
        },
        method: 'POST',
        body: JSON.stringify(payload)
    })

    if (!res.ok) {
        const error = await res.json()
        throw new Error(JSON.stringify(error))
    }

    const stream = new ReadableStream({
        async start(controller) {
            const onParse: EventSourceParseCallback = (event: ParseEvent) => {
                if (event.type === 'event') {
                    const data = event.data
                    
                    if (data === '[DONE]') {
                        controller.close()
                        return
                    }

                    try {
                        const json = JSON.parse(data) as OpenAIStreamResponse
                        const text = json.choices[0]?.delta?.content || ''
                        const queue = encoder.encode(text)
                        controller.enqueue(queue)
                    } catch (e) {
                        controller.error(e)
                    }
                }
            }

            const parser = createParser(onParse)

            for await (const chunk of res.body as any) {
                parser.feed(decoder.decode(chunk))
            }
        }
    })

    return stream
}