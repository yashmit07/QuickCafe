# QuickCafé

QuickCafé is an AI-powered café discovery platform that helps users find the perfect coffee spot based on their preferences. By combining OpenAI's GPT API for intelligent analysis, Google Places API for real café data, and a multi-layer caching system, it delivers personalized café suggestions with detailed atmosphere and amenity analysis.

## Features

- 🎯 Intelligent café matching based on:
  - Mood preferences (cozy, modern, quiet, lively, artistic, traditional, industrial)
  - Required amenities (WiFi, outdoor seating, power outlets, etc.)
  - Smart price matching (exact match = 100%, one level difference = 50%)
  - Location proximity with weighted scoring
- 📍 Location-aware recommendations using:
  - Google Places Autocomplete for city selection
  - Geocoding API for coordinates conversion
  - PostGIS for efficient geographical queries
  - Coordinate-based caching with 11m precision
- 🤖 AI-powered analysis using OpenAI GPT-3.5:
  - Batch processing for review analysis
  - Parallel processing for better performance
  - Confidence scoring for reliable results
- 💨 High-performance caching system:
  - Redis for fast in-memory caching
  - Supabase for persistent storage
  - Price-aware caching strategy
  - Coordinate-based cache keys
  - Automatic cache invalidation
  - Cache warming for popular locations
- 🔄 Real-time data streaming with server-sent events
- 🎨 Modern, responsive UI with TailwindCSS

## System Architecture

### High-Level Overview

```mermaid
graph TD
    subgraph "Frontend Layer"
        UI[User Interface]
        Form[Search Form]
        AC[Places Autocomplete]
        Results[Results Display]
        Stream[Stream Handler]
    end

    subgraph "API Layer"
        Server[SvelteKit Server]
        Cache[Cache Service]
        Places[Places Service]
        Analysis[Analysis Service]
        Recommender[Recommendation Service]
    end

    subgraph "Cache Layer"
        Redis[(Redis Cache)]
        Supabase[(Supabase DB)]
    end

    subgraph "External Services"
        GP[Google Places API]
        GG[Google Geocoding API]
        OAI[OpenAI GPT API]
    end

    %% Frontend Flow
    Form --> AC
    AC --> Places
    Form -->|Submit Search| Server

    %% Cache Flow
    Server -->|1. Check Cache| Cache
    Cache -->|Fast Access| Redis
    Cache -->|Persistent Storage| Supabase

    %% Main Processing Flow
    Server -->|2. Geocode| Places
    Places -->|3. Search| GP
    Server -->|4. Batch Analysis| Analysis
    Analysis -->|5. Process Reviews| OAI
    Server -->|6. Get Recommendations| Recommender

    %% Response Flow
    Server -->|7. Generate Description| OAI
    Server -->|8. Stream Response| Stream
    Stream -->|9. Update UI| Results
```

### Scoring System

```mermaid
graph TD
    subgraph "Score Components"
        V[Vibe Score: 40%]
        A[Amenity Score: 30%]
        D[Distance Score: 20%]
        P[Price Score: 10%]
    end

    subgraph "Price Scoring"
        EM[Exact Match: 100%]
        OD[One Level Diff: 50%]
        TD[Two+ Level Diff: 0%]
    end

    subgraph "Distance Scoring"
        DS[Distance Score]
        MD[Max Distance: 2km]
    end

    V -->|Weight| TS[Total Score]
    A -->|Weight| TS
    D -->|Weight| TS
    P -->|Weight| TS

    P --> EM
    P --> OD
    P --> TD

    D --> DS
    DS -->|Inverse| MD
```

### Caching Strategy

```mermaid
graph TD
    subgraph "Cache Layers"
        R[(Redis Cache)]
        S[(Supabase DB)]
    end

    subgraph "Cache Keys"
        CK["{lat},{lng}:{radius}:{price}"]
        CP[Coordinate Precision: 4 decimals]
        PR[Price Level Segmentation]
    end

    subgraph "TTLs"
        RT[Redis TTL: 1 hour]
        ST[Supabase TTL: 24 hours]
    end

    CK -->|Format| CP
    CK -->|Include| PR
    
    CK -->|Store In| R
    CK -->|Store In| S

    R -->|Expires| RT
    S -->|Expires| ST
```

1. **Redis Cache (Primary)**
   - In-memory caching for fast access
   - 1-hour TTL for all data
   - Coordinate-based cache keys
   - Price-level segmentation
   - Used for:
     - Location search results
     - Café analysis results
     - Frequently accessed data

2. **Supabase Cache (Secondary)**
   - Persistent storage for longer retention
   - 24-hour TTL for location cache
   - 7-day TTL for analysis cache
   - Matching cache key strategy
   - Used for:
     - Backup when Redis cache misses
     - Long-term storage of analysis results
     - Historical data retention

### Batch Processing

```mermaid
graph TD
    subgraph "Analysis Service"
        AB[Analysis Batching]
        PP[Parallel Processing]
        CR[Cache Results]
    end

    subgraph "Batch Size: 3"
        C1[Cafe 1]
        C2[Cafe 2]
        C3[Cafe 3]
    end

    AB -->|Process| C1
    AB -->|Process| C2
    AB -->|Process| C3

    C1 -->|Analyze| PP
    C2 -->|Analyze| PP
    C3 -->|Analyze| PP

    PP -->|Store| CR
    CR -->|Redis| Redis[(Redis)]
    CR -->|Supabase| DB[(Supabase)]
```

## Setup and Installation

### Prerequisites
- Node.js 16+
- PostgreSQL 13+ with PostGIS extension
- Upstash Redis account
- API keys for:
  - OpenAI GPT
  - Google Places API
  - Supabase
  - Upstash Redis

### Environment Variables

Create a `.env` file with:
```env
# OpenAI API Key
OPENAI_API_KEY=your_openai_key

# Supabase Configuration
PUBLIC_SUPABASE_URL=your_supabase_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_key

# Redis Configuration
UPSTASH_REDIS_URL=your_redis_url
UPSTASH_REDIS_TOKEN=your_redis_token

# Google Places API
GOOGLE_PLACES_API_KEY=your_google_places_key
PUBLIC_GOOGLE_PLACES_API_KEY=your_google_places_key
```

### Setting Up Redis Cache

1. Create Upstash Account:
   - Visit [upstash.com](https://upstash.com)
   - Sign up for free account
   - Create new database
   - Select closest region
   - Copy REST URL and token

2. Configure Redis:
   - Add environment variables
   - Install Redis client: `npm install @upstash/redis`
   - Redis cache will initialize automatically

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Run database migrations:
```bash
npm run db:migrate
```

3. Start development server:
```bash
npm run dev
```

## Performance Optimizations

1. **Caching System**
   - Two-layer cache architecture
   - Coordinate-based cache keys
   - Price-level segmentation
   - 4-decimal coordinate precision (11m)
   - Automatic cache warming
   - Smart TTL management
   - Efficient cache invalidation

2. **Recommendation Engine**
   - Weighted scoring system:
     - Vibe matching (40%)
     - Amenity matching (30%)
     - Distance scoring (20%)
     - Price matching (10%)
   - Smart price matching:
     - Exact match = 100%
     - One level difference = 50%
     - Two+ levels difference = 0%
   - Distance-based scoring up to 2km

3. **Location Services**
   - Google Places Autocomplete
   - Restricted to US cities
   - Coordinate-based caching
   - Cached geocoding results

4. **Analysis Optimization**
   - Parallel processing
   - Confidence thresholds
   - Selective review analysis
   - Cache reuse

## API Rate Limits

1. **Google Places API**
   - Autocomplete: 100 QPS
   - Places Search: 100 QPS
   - Geocoding: 50 QPS

2. **OpenAI API**
   - GPT-3.5 Turbo: 3000 RPM
   - Batch processing to optimize usage
   - Cached results to minimize calls

3. **Redis Cache**
   - Free tier: 10,000 commands/day
   - 256MB storage
   - Automatic eviction policy

4. **Supabase**
   - Database: 500MB storage
   - Rate limit: 50,000 rows/day
   - Cache table auto-cleanup

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT

## Acknowledgments

- OpenAI for GPT API
- Google for Places API
- PostGIS community
- SvelteKit team
- Supabase team
