// tests/unit/services/cache.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CacheService } from '$lib/services/cache'
import { supabase } from '$lib/db/supabase'

vi.mock('$lib/db/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    single: vi.fn()
                })
            }),
            upsert: vi.fn(),
            delete: vi.fn(),
            url: new URL('http://localhost'),
            headers: {},
            insert: vi.fn(),
            update: vi.fn()
        }))
    }
}))

describe('CacheService', () => {
    let cacheService: CacheService

    beforeEach(() => {
        cacheService = new CacheService()
        vi.clearAllMocks()
    })

    describe('getLocationCache', () => {
        it('should return cached cafe IDs if found', async () => {
            const mockCafes = [{ id: 'test123' }]
            const mockSelect = vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                        data: { cafe_ids: ['test123'], last_updated: new Date().toISOString() },
                        error: null
                    })
                })
            })

            vi.mocked(supabase.from).mockReturnValue({
                select: mockSelect,
                upsert: vi.fn(),
                delete: vi.fn(),
                url: new URL('http://localhost'),
                headers: {},
                insert: vi.fn(),
                update: vi.fn()
            })

            const result = await cacheService.getLocationCache('San Francisco')
            expect(result).toEqual(['test123'])
        })

        it('should return null if no cache found', async () => {
            const mockSelect = vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                        data: null,
                        error: null
                    })
                })
            })

            vi.mocked(supabase.from).mockReturnValue({
                select: mockSelect,
                upsert: vi.fn(),
                delete: vi.fn(),
                url: new URL('http://localhost'),
                headers: {},
                insert: vi.fn(),
                update: vi.fn()
            })

            const result = await cacheService.getLocationCache('San Francisco')
            expect(result).toBeNull()
        })
    })

    describe('cacheLocationResults', () => {
        it('should store cafe IDs in cache', async () => {
            const mockUpsert = vi.fn().mockResolvedValue({
                data: null,
                error: null,
                count: null,
                status: 200,
                statusText: 'OK'
            })

            vi.mocked(supabase.from).mockReturnValue({
                select: vi.fn(),
                upsert: mockUpsert,
                delete: vi.fn(),
                url: new URL('http://localhost'),
                headers: {},
                insert: vi.fn(),
                update: vi.fn()
            })

            await cacheService.cacheLocationResults('San Francisco', ['test123'])
            expect(mockUpsert).toHaveBeenCalled()
        })
    })
})