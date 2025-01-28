# QuickCafé

An AI-powered café recommendation engine that finds the perfect café based on your mood, preferences, and location.

## Features

- Location-based café search
- Mood-based recommendations (cozy, modern, quiet, lively, artistic, traditional, industrial)
- Amenity filtering (wifi, outdoor seating, power outlets, etc.)
- Price range filtering
- AI-powered analysis of café vibes and features
- Caching system for fast responses

## System Design

### Tech Stack & Services
```
┌─────────────────────────────────────────────────────────────┐
│                        QuickCafé App                        │
├─────────────────────────────────────────────────────────────┤
│ Frontend                    │ Backend (Server-side)         │
├────────────────────────────┼─────────────────────────────┤
│ ┌──────────────────┐       │ ┌───────────────────┐      │
│ │     SvelteKit    │       │ │    SvelteKit      │      │
│ │ - Components     │       │ │ - API Routes      │      │
│ │ - State Mgmt     │       │ │ - Server Actions  │      │
│ │ - Routing        │       │ │ - Auth           │      │
│ └──────────────────┘       │ └───────────────────┘      │
│                            │           │                 │
└────────────────────────────┼───────────┼─────────────────┘
                             │           │
                             │           ▼
┌────────────────┐    ┌──────┴─────┐    ┌──────────────┐
│  Upstash Redis │◄───┤ Data Layer ├───►│   Supabase   │
│  - Geo Cache   │    └──────┬─────┘    │  PostgreSQL  │
└────────────────┘           │          └──────────────┘
                             │
                    ┌────────┴───────┐
                    │  External APIs  │
                    └────────────────┘
                    ┌────────┐ ┌──────┐
                    │ Google │ │OpenAI│
                    │ Places │ │ API  │
                    └────────┘ └──────┘
```

### Service Call Flow
```
┌──────────┐          ┌────────────┐          ┌─────────┐
│  Client  │          │  SvelteKit │          │  Redis  │
│ Browser  │          │   Server   │          │ Cache   │
└────┬─────┘          └─────┬──────┘          └────┬────┘
     │                      │                       │
     │   1. Search Request  │                       │
     │ ─────────────────────>                       │
     │                      │                       │
     │                      │    2. Check Cache     │
     │                      │ ──────────────────────>
     │                      │                       │
     │                      │    3. Cache Miss      │
     │                      │ <──────────────────────
     │                      │                       │
     │                      │                  ┌────┴────┐
     │                      │                  │ Google  │
     │                      │                  │ Places  │
     │                      │                  └────┬────┘
     │                      │                       │
     │                      │   4. Search Cafes     │
     │                      │ ──────────────────────>
     │                      │                       │
     │                      │   5. Cafe Results     │
     │                      │ <──────────────────────
     │                      │                       │
     │                      │              ┌────────┴─────┐
     │                      │              │  Supabase    │
     │                      │              │ PostgreSQL   │
     │                      │              └──────┬───────┘
     │                      │                     │
     │                      │   6. Store Cafes    │
     │                      │ ───────────────────>│
     │                      │                     │
     │                      │                ┌────┴────┐
     │                      │                │ OpenAI  │
     │                      │                │  API    │
     │                      │                └────┬────┘
     │                      │                     │
     │                      │  7. Analyze Reviews │
     │                      │ ───────────────────>│
     │                      │                     │
     │                      │  8. Vibe Scores     │
     │                      │ <───────────────────│
     │                      │                     │
     │                      │   9. Store Scores   │
     │                      │ ───────────────────>│
     │                      │                     │
     │   10. Stream Results │                     │
     │ <─────────────────────                     │
     │                      │                     │
```

### Architecture Overview
```
┌───────────────────────┐     ┌──────────────┐
│       SvelteKit       │     │   Supabase   │
│  Frontend + Backend   │────▶│  PostgreSQL  │
└─────────────┬─────────┘     └──────────────┘
              │
              │
        ┌─────┴─────┐
        │  Upstash  │
        │   Redis   │
        └─────┬─────┘
              │
    ┌─────────┴──────────┐
    │                    │
┌────┴────┐        ┌─────┴─────┐
│ Google  │        │  OpenAI   │
│ Places  │        │    API    │
└─────────┘        └───────────┘
```

### Key Components

#### 1. Data Flow
- **Initial Request**: User submits location, mood, and preferences
- **Location Search**: 
  - First checks Redis cache (5km radius)
  - Falls back to Google Places API if cache miss
  - Stores results in both Redis (1hr TTL) and Postgres
- **Café Analysis**:
  - Reviews analyzed by OpenAI for vibes and amenities
  - Results stored permanently in Postgres
  - Batch processing (3 cafes at a time) to manage API limits

#### 2. Database Schema
```sql
cafes (
  id UUID PRIMARY KEY,
  google_place_id TEXT UNIQUE,
  name TEXT,
  location POINT,
  price_level TEXT,
  ...
)

cafe_vibes (
  cafe_id UUID REFERENCES cafes(id),
  vibe_category TEXT,
  confidence_score FLOAT,
  ...
)

cafe_amenities (
  cafe_id UUID REFERENCES cafes(id),
  amenity TEXT,
  confidence_score FLOAT,
  ...
)
```

### Design Decisions

#### 1. Caching Strategy
- **Why Redis?** 
  - Fast geospatial queries
  - Automatic TTL for fresh data
  - Low latency for frequent locations
- **Cache Design:**
  - Key: `{lat}:{lng}:{price_range}`
  - Value: Array of cafe IDs
  - TTL: 1 hour to balance freshness and performance

#### 2. Analysis Storage
- **Why Permanent Storage?**
  - Café vibes rarely change
  - Reduces OpenAI API costs
  - Faster subsequent queries
- **Batch Processing:**
  - Processes 3 cafes simultaneously
  - Balances speed vs API rate limits
  - Manages token context length

#### 3. Real-time Updates
- **Streaming Response:**
  - Shows analysis progress
  - Better UX for longer searches
  - Manages timeout risks

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

## Performance Optimizations

- **Location Caching:**
  - 5km radius coverage
  - 1-hour cache duration
  - Coordinate rounding for better cache hits

- **Analysis Optimization:**
  - Batch processing reduces API calls
  - Permanent storage prevents reanalysis
  - Parallel processing where possible

- **Response Handling:**
  - Streaming updates for long operations
  - Early termination for no results
  - Error recovery with partial results

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
