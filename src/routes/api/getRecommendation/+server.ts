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

        const { mood, location, requirements = [], priceRange } = body as CafeRequest;
        console.log('Parsed request:', { mood, location, requirements, priceRange });

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

        // 1. Geocode location first (needed for both cache and search)
        try {
            console.log('Geocoding location:', location);
            coordinates = await placesService.geocodeLocation(location)
            console.log('Geocoded coordinates:', coordinates);
        } catch (error) {
            console.error('Error geocoding location:', error);
            return new Response(
                JSON.stringify({ 
                    error: 'Invalid location',
                    details: error instanceof Error ? error.message : 'Failed to geocode location'
                }), 
                { status: 400 }
            )
        }

        // 2. Check location cache with coordinates
        try {
            console.log('Checking location cache...');
            const cachedCafeIds = await cacheService.getLocationCache(
                coordinates.lat,
                coordinates.lng,
                5000,
                priceRange
            );
            
            if (cachedCafeIds?.length) {
                console.log('Cache hit! Getting cafes from cache...');
                const { data: cachedCafes, error: cacheError } = await supabase
                    .from('cafes')
                    .select('*')
                    .in('id', cachedCafeIds);

                if (cacheError) {
                    console.error('Error getting cafes from cache:', cacheError);
                    throw cacheError;
                }

                if (cachedCafes?.length) {
                    cafes = cachedCafes;
                    console.log(`Retrieved ${cafes.length} cafes from cache`);
                }
            } else {
                console.log('Cache miss for location:', { 
                    lat: coordinates.lat, 
                    lng: coordinates.lng,
                    priceRange: priceRange 
                });
            }
        } catch (error) {
            console.error('Error getting location cache:', error)
            // Continue without cache
        }

        // If no cached results or cache was invalid
        if (!cafes.length) {
            try {
                // 3. Search for nearby cafes
                console.log('Searching for nearby cafes...');
                const nearbyCafes = await placesService.searchNearbyCafes(
                    coordinates.lat,
                    coordinates.lng,
                    5000
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
                    // First, upsert the cafes
                    await supabase
                        .from('cafes')
                        .upsert(nearbyCafes, {
                            onConflict: 'google_place_id',
                            ignoreDuplicates: true
                        });
                    
                    // Then fetch all cafes with these google_place_ids
                    const { data: allCafes, error: fetchError } = await supabase
                        .from('cafes')
                        .select('*')
                        .in('google_place_id', nearbyCafes.map(cafe => cafe.google_place_id));

                    if (fetchError) {
                        console.error('Error fetching cafes:', fetchError);
                        throw fetchError;
                    }

                    if (!allCafes?.length) {
                        console.error('No cafes were found');
                        throw new Error('Failed to get cafe data')
                    }
                    
                    cafes = allCafes;
                    console.log(`Retrieved ${cafes.length} cafes`);

                    // Only cache after we have the proper database IDs
                    console.log('Caching location results...');
                    await cacheService.cacheLocationResults(
                        coordinates.lat,
                        coordinates.lng,
                        cafes.map(cafe => cafe.id),
                        5000,
                        priceRange
                    );
                    console.log('Location results cached');
                } catch (error) {
                    console.error('Error storing/retrieving cafes:', error);
                    // Continue with the cafes we found
                    cafes = nearbyCafes;
                }
            } catch (error) {
                console.error('Error in cafe search:', error);
                return new Response(
                    JSON.stringify({ 
                        error: 'Invalid location',
                        details: error instanceof Error ? error.message : 'Failed to search for cafes'
                    }), 
                    { status: 400 }
                )
            }
        }

        // 5. Analyze cafes in batches
        const BATCH_SIZE = 3;
        const cafesToAnalyze = [];
        
        for (const cafe of cafes) {
            // Check if cafe has been analyzed in Postgres
            const { data: existingVibes } = await supabase
                .from('cafe_vibes')
                .select('vibe_category, confidence_score')
                .eq('cafe_id', cafe.id);
            
            const { data: existingAmenities } = await supabase
                .from('cafe_amenities')
                .select('amenity, confidence_score')
                .eq('cafe_id', cafe.id);

            if (!existingVibes?.length && !existingAmenities?.length) {
                cafesToAnalyze.push(cafe);
            }
        }

        if (cafesToAnalyze.length > 0) {
            console.log(`Analyzing ${cafesToAnalyze.length} cafes in batches of ${BATCH_SIZE}...`);
            for (let i = 0; i < cafesToAnalyze.length; i += BATCH_SIZE) {
                const batch = cafesToAnalyze.slice(i, i + BATCH_SIZE);
                await Promise.all(
                    batch.map(async (cafe) => {
                        console.log(`Analyzing cafe ${cafe.id}...`);
                        await analysisService.analyzeReviews(cafe);
                    })
                );
            }
        }

        // 6. Get scored and ranked recommendations
        console.log('Getting recommendations...');
        const rankedCafes = await recommendationService.getRecommendations(
            coordinates.lat,
            coordinates.lng,
            { mood, location, requirements },
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

For each café, provide a recommendation in this exact format (including the ### separators):

###
Name: [Cafe Name] - [Price Level] ([Distance] meters)
Description: [2-3 sentences about atmosphere and offerings]
Features: [List key features and amenities that match requirements]
Best For: [Specific use cases like working, meetings, casual hangout]
###

Important:
1. Keep recommendations concise and factual
2. Include EXACT distance in meters from the data
3. Use the exact price level from the data
4. Separate each recommendation with ###
5. Start each field with the exact labels shown above
6. Focus on features that match the user's requirements
7. ALWAYS provide exactly 5 recommendations
8. Do not include any text before the first ### or after the last ###
9. Ensure each recommendation follows the exact format with all fields

Here is the cafe data to use:
${JSON.stringify(rankedCafes, null, 2)}`

        // 8. Stream recommendations
        const payload: OpenAIPayload = {
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            max_tokens: 1500,
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