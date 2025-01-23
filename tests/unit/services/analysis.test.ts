// tests/unit/services/analysis.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AnalysisService } from '$lib/services/analysis'
import type { Cafe } from '$lib/types/database'

describe('AnalysisService', () => {
    let analysisService: AnalysisService
    let mockCafe: Cafe

    beforeEach(() => {
        analysisService = new AnalysisService()
        vi.clearAllMocks()
        vi.spyOn(console, 'error').mockImplementation(() => {})

        mockCafe = {
            id: '123',
            google_place_id: 'place123',
            name: 'Test Cafe',
            location: 'POINT(-122.4194 37.7749)',
            address: '123 Test St',
            price_level: '$$',
            reviews: [
                { text: 'Great cozy place with fast wifi!' },
                { text: 'Modern atmosphere, plenty of outlets.' }
            ],
            last_review_fetch: new Date().toISOString()
        }
    })

    it('should analyze reviews successfully', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: JSON.stringify({
                        amenities: {
                            wifi: 0.9,
                            power_outlets: 0.8
                        },
                        vibes: {
                            cozy: 0.85,
                            modern: 0.7
                        }
                    })
                }
            }]
        }

        vi.spyOn(global, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockResponse)
        } as Response)

        const result = await analysisService.analyzeReviews(mockCafe)
        expect(result).toEqual({
            amenities: {
                wifi: 0.9,
                power_outlets: 0.8
            },
            vibes: {
                cozy: 0.85,
                modern: 0.7
            }
        })
    })

    it('should handle rate limiting with retries', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: JSON.stringify({
                        amenities: { wifi: 0.9 },
                        vibes: { cozy: 0.8 }
                    })
                }
            }]
        }

        vi.spyOn(global, 'fetch')
            .mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests'
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            } as Response)

        const result = await analysisService.analyzeReviews(mockCafe)
        expect(result).toEqual({
            amenities: { wifi: 0.9 },
            vibes: { cozy: 0.8 }
        })
    })

    it('should return null for invalid analysis format', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: JSON.stringify({
                        // Missing vibes section
                        amenities: { wifi: 0.9 }
                    })
                }
            }]
        }

        vi.spyOn(global, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockResponse)
        } as Response)

        const result = await analysisService.analyzeReviews(mockCafe)
        expect(result).toBeNull()
    })

    it('should return null for invalid score values', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: JSON.stringify({
                        amenities: { wifi: 1.5 }, // Invalid score > 1
                        vibes: { cozy: 0.8 }
                    })
                }
            }]
        }

        vi.spyOn(global, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockResponse)
        } as Response)

        const result = await analysisService.analyzeReviews(mockCafe)
        expect(result).toBeNull()
    })

    it('should return null after max retries', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests'
        } as Response)

        const result = await analysisService.analyzeReviews(mockCafe)
        expect(result).toBeNull()
        expect(global.fetch).toHaveBeenCalledTimes(3) // Max retries
    })

    it('should return null for cafe without reviews', async () => {
        const cafeWithoutReviews = { ...mockCafe, reviews: [] }
        const result = await analysisService.analyzeReviews(cafeWithoutReviews)
        expect(result).toBeNull()
    })

    it('should handle API errors gracefully', async () => {
        vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('API Error'))

        const result = await analysisService.analyzeReviews(mockCafe)
        expect(result).toBeNull()
    })
})