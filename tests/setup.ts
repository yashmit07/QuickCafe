// tests/setup.ts
import { beforeAll, afterAll, afterEach, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Mock environment variables
vi.mock('$env/static/private', () => ({
    VITE_OPENAI_API_KEY: 'test-openai-key',
    VITE_GOOGLE_PLACES_API_KEY: 'test-google-key',
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-supabase-key'
}))

// Mock Supabase client with all necessary methods
vi.mock('$lib/db/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn(() => Promise.resolve({ data: null, error: null }))
                }))
            })),
            upsert: vi.fn(() => Promise.resolve({ error: null })),
            delete: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ error: null }))
            }))
        })),
        rpc: vi.fn(() => Promise.resolve({ data: [], error: null }))
    }
}))

// Mock external API calls
const server = setupServer(
    // Mock Google Places API endpoints
    http.get('https://maps.googleapis.com/maps/api/geocode/json', () => {
        return HttpResponse.json({
            results: [{
                geometry: {
                    location: { lat: 37.7749, lng: -122.4194 }
                }
            }]
        })
    }),

    // Mock Places API endpoints
    http.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json*', () => {
        return HttpResponse.json({
            status: 'OK',
            results: [{
                place_id: 'test123',
                name: 'Test Cafe',
                geometry: {
                    location: { lat: 37.7749, lng: -122.4194 }
                }
            }]
        })
    }),

    // Mock OpenAI API for analysis
    http.post('https://api.openai.com/v1/chat/completions', () => {
        return HttpResponse.json({
            choices: [{
                message: {
                    content: JSON.stringify({
                        vibes: { cozy: 0.9, modern: 0.7 },
                        amenities: { wifi: 0.9, power_outlets: 0.8 }
                    })
                }
            }]
        })
    })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterAll(() => server.close())
afterEach(() => {
    server.resetHandlers()
    vi.clearAllMocks()
})