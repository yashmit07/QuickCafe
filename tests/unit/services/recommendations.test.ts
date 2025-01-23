// tests/unit/services/recommendations.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RecommendationService } from '$lib/services/recommendations'
import { supabase } from '$lib/db/supabase'
import type { Cafe } from '$lib/types/database'

interface ScoredCafe extends Cafe {
    distance: number;
    vibe_scores: Record<string, number>;
    amenity_scores: Record<string, number>;
}

vi.mock('$lib/db/supabase', () => ({
    supabase: {
        rpc: vi.fn()
    }
}))

describe('RecommendationService', () => {
    let recommendationService: RecommendationService

    beforeEach(() => {
        recommendationService = new RecommendationService()
        vi.clearAllMocks()
    })

    describe('getRecommendations', () => {
        const mockCafes = [
            {
                id: '123',
                google_place_id: 'place_123',
                name: 'Cozy Cafe',
                location: 'POINT(-122.4194 37.7749)',
                address: '123 Cozy St',
                price_level: '$',
                reviews: [],
                last_review_fetch: new Date().toISOString(),
                distance: 500,
                vibe_scores: { cozy: 0.9, quiet: 0.8 },
                amenity_scores: { wifi: 0.9, power_outlets: 0.8 }
            },
            {
                id: '456',
                google_place_id: 'place_456',
                name: 'Modern Cafe',
                location: 'POINT(-122.4194 37.7749)',
                address: '456 Modern St',
                price_level: '$$',
                reviews: [],
                last_review_fetch: new Date().toISOString(),
                distance: 1000,
                vibe_scores: { modern: 0.9, artistic: 0.7 },
                amenity_scores: { wifi: 0.7, outdoor_seating: 0.9 }
            }
        ] as ScoredCafe[]

        it('should rank cafes based on user preferences', async () => {
            vi.mocked(supabase.rpc).mockResolvedValue({
                data: mockCafes,
                error: null,
                count: null,
                status: 200,
                statusText: 'OK'
            })

            const request = {
                mood: 'relaxed',
                priceRange: '$',
                location: 'San Francisco',
                requirements: ['wifi']
            }

            const rankings = await recommendationService.getRecommendations(
                37.7749,
                -122.4194,
                request,
                2
            )

            expect(rankings).toHaveLength(2)
            expect(rankings[0].id).toBe('123') // Cozy Cafe should rank higher
        })

        it('should handle empty cafe list', async () => {
            vi.mocked(supabase.rpc).mockResolvedValue({
                data: [],
                error: null,
                count: null,
                status: 200,
                statusText: 'OK'
            })

            const request = {
                mood: 'relaxed',
                priceRange: '$',
                location: 'San Francisco',
                requirements: ['wifi']
            }

            const rankings = await recommendationService.getRecommendations(
                37.7749,
                -122.4194,
                request
            )

            expect(rankings).toHaveLength(0)
        })
    })
})