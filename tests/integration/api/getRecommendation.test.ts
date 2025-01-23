// tests/integration/api/getRecommendation.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../../../src/routes/api/getRecommendation/+server'
import { supabase } from '$lib/db/supabase'
import { RecommendationService } from '$lib/services/recommendations'
import { PlacesService } from '$lib/services/places'
import { AnalysisService } from '$lib/services/analysis'
import { CacheService } from '$lib/services/cache'

vi.mock('$lib/db/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                        data: null,
                        error: null
                    })
                })
            }),
            upsert: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue({
                    data: [{ id: 'test123' }],
                    error: null
                })
            }),
            delete: vi.fn(),
            url: new URL('http://localhost'),
            headers: {},
            insert: vi.fn(),
            update: vi.fn()
        })),
        rpc: vi.fn().mockResolvedValue({
            data: [{
                id: 'test123',
                google_place_id: 'place123',
                name: 'Test Cafe',
                location: 'POINT(-122.4194 37.7749)',
                address: '123 Test St',
                price_level: '$',
                reviews: [{ text: 'Great cafe!', rating: 5 }],
                last_review_fetch: new Date().toISOString(),
                distance: 500,
                vibe_scores: { cozy: 0.9, quiet: 0.8 },
                amenity_scores: { wifi: 0.9, power_outlets: 0.8 }
            }],
            error: null,
            count: null,
            status: 200,
            statusText: 'OK'
        })
    }
}))

vi.mock('$lib/services/recommendations', () => ({
    RecommendationService: vi.fn().mockImplementation(() => ({
        getRecommendations: vi.fn().mockResolvedValue([{
            id: 'test123',
            name: 'Test Cafe',
            distance: 500,
            vibe_scores: { cozy: 0.9, quiet: 0.8 },
            amenity_scores: { wifi: 0.9, power_outlets: 0.8 }
        }])
    }))
}))

vi.mock('$lib/services/places', () => ({
    PlacesService: vi.fn().mockImplementation(() => ({
        geocodeLocation: vi.fn().mockResolvedValue({ lat: 37.7749, lng: -122.4194 }),
        searchNearbyCafes: vi.fn().mockResolvedValue([{
            id: 'test123',
            google_place_id: 'place123',
            name: 'Test Cafe',
            location: 'POINT(-122.4194 37.7749)',
            address: '123 Test St',
            price_level: '$',
            reviews: [{ text: 'Great cafe!', rating: 5 }],
            last_review_fetch: new Date().toISOString()
        }])
    }))
}))

vi.mock('$lib/services/analysis', () => ({
    AnalysisService: vi.fn().mockImplementation(() => ({
        analyzeReviews: vi.fn().mockResolvedValue({
            vibes: { cozy: 0.9, quiet: 0.8 },
            amenities: { wifi: 0.9, power_outlets: 0.8 }
        })
    }))
}))

vi.mock('$lib/services/cache', () => ({
    CacheService: vi.fn().mockImplementation(() => ({
        getLocationCache: vi.fn().mockResolvedValue(null),
        cacheLocationResults: vi.fn().mockResolvedValue(undefined),
        hasRecentAnalysis: vi.fn().mockResolvedValue(false),
        cacheAnalysisResults: vi.fn().mockResolvedValue(undefined),
        invalidateLocationCache: vi.fn().mockResolvedValue(undefined)
    }))
}))

describe('POST /api/getRecommendation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        
        // Mock OpenAI API call
        vi.spyOn(global, 'fetch').mockImplementation((url) => {
            if (url.toString().includes('openai.com')) {
                const encoder = new TextEncoder()
                const readable = new ReadableStream({
                    start(controller) {
                        const events = [
                            'data: {"choices":[{"delta":{"content":"Test "}}]}\n\n',
                            'data: {"choices":[{"delta":{"content":"recommendation"}}]}\n\n',
                            'data: [DONE]\n\n'
                        ]
                        events.forEach(event => controller.enqueue(encoder.encode(event)))
                        controller.close()
                    }
                })

                return Promise.resolve({
                    ok: true,
                    body: readable,
                    status: 200,
                    headers: new Headers({
                        'Content-Type': 'text/event-stream'
                    })
                } as Response)
            }
            return Promise.reject(new Error('Invalid URL'))
        })
    })

    it('should return cafe recommendations', async () => {
        const mockRequest = new Request('http://localhost:3000/api/getRecommendation', {
            method: 'POST',
            body: JSON.stringify({
                location: 'San Francisco',
                mood: 'relaxed',
                priceRange: '$',
                requirements: ['wifi']
            })
        })

        const response = await POST({ request: mockRequest } as any)
        expect(response.status).toBe(200)
        
        // Read and verify the stream
        const reader = response.body?.getReader()
        expect(reader).toBeDefined()
        
        if (reader) {
            const { done, value } = await reader.read()
            expect(done).toBe(false)
            expect(new TextDecoder().decode(value)).toContain('Test')
        }
    })

    it('should handle missing requirements', async () => {
        const mockRequest = new Request('http://localhost:3000/api/getRecommendation', {
            method: 'POST',
            body: JSON.stringify({
                location: 'San Francisco',
                mood: 'relaxed',
                priceRange: '$'
            })
        })

        const response = await POST({ request: mockRequest } as any)
        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.error).toBeDefined()
    })
})