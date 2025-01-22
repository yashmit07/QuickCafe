// src/routes/api/getRecommendation/+server.ts
import { createParser } from 'eventsource-parser'
import { OPENAI_API_KEY, GOOGLE_PLACES_API_KEY } from '$env/static/private'
import type { RequestHandler } from './$types'
import type { CafeRequest } from '$lib/types/database'
import { AnalysisService } from '$lib/services/analysis'
import { RecommendationService } from '$lib/services/recommendations'
import { PlacesService } from '$lib/services/places'
import { CacheService } from '$lib/services/cache'
import { supabase } from '$lib/db/supabase'

const analysisService = new AnalysisService()
const recommendationService = new RecommendationService()
const placesService = new PlacesService()
const cacheService = new CacheService()

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { mood, priceRange, location, requirements } = await request.json() as CafeRequest

        // 1. Check location cache first
        let cachedCafeIds = await cacheService.getLocationCache(location)
        let cafes

        if (cachedCafeIds) {
            // Use cached cafe IDs
            const { data, error } = await supabase
                .from('cafes')
                .select('*')
                .in('id', cachedCafeIds)
            
            if (error) throw error
            cafes = data
        } else {
            // 2. Geocode and search for new cafes
            const { lat, lng } = await placesService.geocodeLocation(location)
            
            // 3. Search for nearby cafes
            const nearbyCafes = await placesService.searchNearbyCafes(lat, lng, 5000)
            
            // 4. Store cafes and cache location
            const { data: storedCafes, error } = await supabase
                .from('cafes')
                .upsert(nearbyCafes, { 
                    onConflict: 'google_place_id',
                    returning: true 
                })
            
            if (error) throw error
            cafes = storedCafes

            // Cache the location results
            await cacheService.cacheLocationResults(
                location, 
                cafes.map(c => c.id)
            )
        }

        // 5. Get or perform analysis for each cafe
        for (const cafe of cafes) {
            if (!(await cacheService.hasRecentAnalysis(cafe.id))) {
                const analysis = await analysisService.analyzeReviews(cafe)
                if (analysis) {
                    // Store results using atomic update
                    await supabase.rpc('update_cafe_analysis', {
                        p_cafe_id: cafe.id,
                        p_timestamp: new Date().toISOString(),
                        p_vibes: Object.entries(analysis.vibes)
                            .filter(([_, score]) => score > 0.5)
                            .map(([vibe, score]) => ({
                                vibe_category: vibe,
                                confidence_score: score
                            })),
                        p_amenities: Object.entries(analysis.amenities)
                            .filter(([_, score]) => score > 0.5)
                            .map(([amenity, score]) => ({
                                amenity,
                                confidence_score: score
                            }))
                    })
                }
            }
        }

        // 6. Get scored and ranked recommendations
        const rankedCafes = await recommendationService.getRecommendations(
            lat,
            lng,
            { mood, priceRange, location, requirements },
            5 // Get top 5 recommendations
        )

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
        const payload = {
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
        return new Response(JSON.stringify({ 
            error: 'Failed to get recommendations',
            details: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

async function OpenAIStream(payload: any) {
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
            const onParse = (event: any) => {
                if (event.type === 'event') {
                    const data = event.data
                    
                    if (data === '[DONE]') {
                        controller.close()
                        return
                    }

                    try {
                        const json = JSON.parse(data)
                        const text = json.choices[0].delta.content || ''
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