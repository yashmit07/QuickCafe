// src/routes/api/getRecommendation/+server.ts
import { createParser } from 'eventsource-parser'
import { OPENAI_API_KEY, GOOGLE_PLACES_API_KEY } from '$env/static/private'
import type { RequestHandler } from './$types'
import type { CafeRequest } from '$lib/types/database'
import { AnalysisService } from '$lib/services/analysis'
import { supabase } from '$lib/db/supabase'

const analysisService = new AnalysisService()

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { mood, priceRange, location, requirements } = await request.json() as CafeRequest

        // 1. Geocode the location
        const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${GOOGLE_PLACES_API_KEY}`
        const geocodingRes = await fetch(geocodingUrl)
        const geocodingData = await geocodingRes.json()
        const { lat, lng } = geocodingData.results[0].geometry.location

        // 2. Search for cafes
        const { data: cafes, error } = await supabase.rpc('search_nearby_cafes', {
            search_lat: lat,
            search_lng: lng,
            radius_meters: 5000,
            price: priceRange
        })

        if (error) throw error

        // 3. Get or perform analysis for each cafe
        for (const cafe of cafes) {
            const { data: existing } = await supabase
                .from('cafe_vibes')
                .select('*')
                .eq('cafe_id', cafe.id)
                .single()

            if (!existing) {
                const analysis = await analysisService.analyzeReviews(cafe)
                if (analysis) {
                    // Store results in database
                    await Promise.all([
                        supabase.from('cafe_amenities').insert(
                            Object.entries(analysis.amenities)
                                .filter(([_, score]) => score > 0.5)
                                .map(([amenity, score]) => ({
                                    cafe_id: cafe.id,
                                    amenity,
                                    confidence_score: score
                                }))
                        ),
                        supabase.from('cafe_vibes').insert(
                            Object.entries(analysis.vibes)
                                .filter(([_, score]) => score > 0.5)
                                .map(([vibe, score]) => ({
                                    cafe_id: cafe.id,
                                    vibe_category: vibe,
                                    confidence_score: score
                                }))
                        )
                    ])
                }
            }
        }

        // 4. Create prompt using analyzed data
        const prompt = `Act as a knowledgeable local café expert. I have analyzed ${cafes.length} cafes in ${location} and will provide recommendations based on the following preferences:

        Desired Vibe: ${mood}
        Price Range: ${priceRange}
        Special Requirements: ${requirements.join(', ')}

        Using the verified data I have, here are the best matches. For each café, provide:
        1. Name
        2. Brief description of atmosphere and offerings
        3. Notable features that match the requirements
        4. Best suited for (e.g., working, meetings, casual hangout)

        Format each recommendation in a clean, easy-to-read way.`

        // 5. Stream recommendations using your existing code
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
        return new Response(JSON.stringify({ error: 'Failed to get recommendations' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

// Your existing OpenAIStream function remains unchanged
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