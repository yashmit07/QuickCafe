# QuickCafé

An AI-powered café recommendation engine that finds the perfect café based on your mood, preferences, and location.

## Features

- Location-based café search
- Mood-based recommendations (cozy, modern, quiet, lively, artistic, traditional, industrial)
- Amenity filtering (wifi, outdoor seating, power outlets, etc.)
- Price range filtering
- AI-powered analysis of café vibes and features
- Caching system for fast responses

## Quick Start

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Set up environment variables:
```bash
cp .env.example .env
```
Required variables:
- `GOOGLE_PLACES_API_KEY`: For café data
- `OPENAI_API_KEY`: For café analysis
- `UPSTASH_REDIS_URL`: For caching
- `SUPABASE_URL` and `SUPABASE_KEY`: For database

4. Start the development server:
```bash
npm run dev
```

## API Usage

### POST /api/getRecommendation
```typescript
{
  "location": "string",     // e.g., "San Francisco, CA"
  "mood": string,          // "cozy" | "modern" | "quiet" | "lively" | "artistic" | "traditional" | "industrial"
  "priceRange": string,    // "$" | "$$" | "$$$"
  "requirements": string[] // ["wifi", "outdoor_seating", "power_outlets", "pet_friendly", "parking", "workspace_friendly", "food_menu"]
}
```

## Architecture

- Frontend: SvelteKit
- Database: Supabase (PostgreSQL)
- Caching: Upstash Redis
- APIs: Google Places, OpenAI

## Performance

- Location-based caching
- Batch processing for café analysis
- Streaming responses for real-time updates

## Development

```bash
# Run tests
npm test

# Build for production
npm run build

# Preview production build
npm run preview
```

## License

MIT
