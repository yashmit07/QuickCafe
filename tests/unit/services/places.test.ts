// tests/unit/services/places.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlacesService } from '$lib/services/places'

describe('PlacesService', () => {
    let placesService: PlacesService

    beforeEach(() => {
        placesService = new PlacesService()
        vi.clearAllMocks()
    })

    describe('geocodeLocation', () => {
        it('should geocode location successfully', async () => {
            vi.spyOn(global, 'fetch').mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    status: 'OK',
                    results: [{
                        geometry: {
                            location: { lat: 37.7749, lng: -122.4194 }
                        }
                    }]
                })
            } as Response)

            const result = await placesService.geocodeLocation('San Francisco')
            expect(result).toEqual({ lat: 37.7749, lng: -122.4194 })
        })
    })

    describe('searchNearbyCafes', () => {
        it('should search cafes successfully', async () => {
            vi.spyOn(global, 'fetch')
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({
                        status: 'OK',
                        results: [{
                            place_id: 'test123',
                            name: 'Test Cafe',
                            vicinity: '123 Test St',
                            geometry: {
                                location: {
                                    lat: 37.7749,
                                    lng: -122.4194
                                }
                            }
                        }]
                    })
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({
                        status: 'ZERO_RESULTS',
                        results: []
                    })
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({
                        status: 'OK',
                        result: {
                            place_id: 'test123',
                            name: 'Test Cafe',
                            formatted_address: '123 Test St',
                            price_level: 2,
                            reviews: [
                                {
                                    text: 'Great cafe!',
                                    rating: 5
                                }
                            ]
                        }
                    })
                } as Response)

            const cafes = await placesService.searchNearbyCafes(37.7749, -122.4194)
            expect(cafes).toHaveLength(1)
            expect(cafes[0].name).toBe('Test Cafe')
        })
    })

    describe('transformToDbFormat', () => {
        it('should transform place data correctly', () => {
            const mockPlace = {
                place_id: 'test123',
                name: 'Test Cafe',
                geometry: {
                    location: { lat: 37.7749, lng: -122.4194 }
                }
            }

            const mockDetails = {
                formatted_address: '123 Test St',
                reviews: [{ text: 'Great place!', rating: 5 }],
                price_level: 2
            }

            const result = placesService['transformToDbFormat'](mockPlace, mockDetails)

            expect(result).toMatchObject({
                google_place_id: 'test123',
                name: 'Test Cafe',
                location: 'POINT(-122.4194 37.7749)',
                address: '123 Test St',
                price_level: '$$',
                reviews: [{ text: 'Great place!', rating: 5 }]
            })
        })
    })
})