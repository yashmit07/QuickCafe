# QuickCafé

QuickCafé is an AI-powered café discovery platform that helps users find the perfect coffee spot based on their preferences. By combining OpenAI's GPT API for intelligent analysis, Google Places API for real café data, and PostGIS for location-based searching, it delivers personalized café suggestions with detailed atmosphere and amenity analysis.

## Features

- 🎯 Intelligent café matching based on:
  - Mood preferences (cozy, modern, quiet, lively, artistic, traditional, industrial)
  - Required amenities (WiFi, outdoor seating, power outlets, etc.)
  - Price range preferences ($, $$, $$$)
  - Location proximity with configurable radius
- 📍 Location-aware recommendations using:
  - Google Geocoding API for address to coordinates conversion
  - PostGIS for efficient geographical queries
  - Location caching to minimize API calls
- 🤖 AI-powered analysis using OpenAI GPT-3.5:
  - Review analysis for vibe detection
  - Amenity identification from reviews
  - Confidence scoring for reliable results
- 🔄 Real-time data streaming with server-sent events
- 🎨 Modern, responsive UI with TailwindCSS
- ⚡ High-performance database queries with PostGIS spatial indexing
- 🧠 Smart scoring system for café ranking based on multiple factors

## System Architecture

```mermaid
graph TD
    A[User Interface] -->|Submit Preferences| B[API Layer]
    B -->|Geocode Location| C[Google Places API]
    B -->|Fetch Cafes| D[PostGIS Database]
    B -->|Analyze Reviews| E[OpenAI GPT]
    D -->|Return Nearby Cafes| B
    E -->|Return Analysis| B
    B -->|Stream Results| A
    
    subgraph Database
    D --> F[Cafes Table]
    D --> G[Cafe Vibes Table]
    D --> H[Cafe Amenities Table]
    D --> I[Location Cache Table]
    end
```

### Database Schema

```sql
-- Cafes Table
CREATE TABLE cafes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_place_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    location GEOGRAPHY(POINT) NOT NULL,
    address TEXT NOT NULL,
    price_level price_level,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cafe Vibes Table
CREATE TABLE cafe_vibes (
    cafe_id UUID REFERENCES cafes(id),
    vibe_categories vibe_category[] NOT NULL,
    confidence_scores FLOAT[] NOT NULL,
    last_analyzed TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (cafe_id)
);

-- Cafe Amenities Table
CREATE TABLE cafe_amenities (
    cafe_id UUID REFERENCES cafes(id),
    amenity_types amenity_type[] NOT NULL,
    confidence_scores FLOAT[] NOT NULL,
    last_analyzed TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (cafe_id)
);

-- Location Cache Table
CREATE TABLE location_cache (
    address TEXT PRIMARY KEY,
    coordinates GEOGRAPHY(POINT) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Recommendation System

The recommendation engine uses a sophisticated scoring algorithm that considers:

1. **Vibe Matching (30% weight)**
   - Analyzes café reviews using OpenAI GPT
   - Extracts and scores vibe categories
   - Only stores high-confidence (>0.4) assessments
   - Example vibes: cozy (0.5), modern (0.7), quiet (0.4)

2. **Amenity Scoring (30% weight)**
   - Identifies available amenities from reviews
   - Assigns confidence scores
   - Stores only high-confidence (>0.5) amenities
   - Example amenities: wifi (0.8), outdoor_seating (0.6), food_menu (0.9)

3. **Price Compatibility (20% weight)**
   - Flexible price range matching
   - Includes cafes within one price level of target
   - Scoring:
     - Exact match: 1.0
     - One level difference: 0.5
     - Two or more levels: 0.0

4. **Distance Calculation (20% weight)**
   - Uses PostGIS for efficient distance calculations
   - Prioritizes closer locations
   - Score = 1 - (distance / max_distance)
   - Default search radius: 5000 meters

### Geocoding System

The application implements a robust geocoding system:

1. **Location Caching**
   - Caches geocoded addresses to minimize API calls
   - Stores coordinates in PostGIS geography type
   - Automatic cache cleanup for old entries

2. **Google Geocoding Integration**
   - Converts user-input addresses to coordinates
   - Handles various address formats
   - Error handling for invalid addresses

3. **Reverse Geocoding**
   - Converts coordinates to readable addresses
   - Used for displaying café locations
   - Cached to minimize API usage

## API Integrations

### OpenAI GPT
- Model: GPT-3.5-turbo
- Purpose: Review analysis and scoring
- Configuration:
  - Max tokens: 300
  - Temperature: 0.7
  - Response format: Structured JSON
- Example response:
```json
{
  "vibe_scores": {
    "cozy": 0.5,
    "modern": 0.3,
    "quiet": 0.4
  },
  "amenity_scores": {
    "wifi": 0.8,
    "outdoor_seating": 0.6,
    "food_menu": 0.9
  }
}
```

### Google Places API
- Services used:
  - Places Search API
  - Place Details API
  - Geocoding API
- Features:
  - Nearby café search
  - Review retrieval
  - Address geocoding
  - Place details fetching

## Setup and Installation

### Prerequisites
- Node.js 16+
- PostgreSQL 13+ with PostGIS extension
- API keys for:
  - OpenAI GPT
  - Google Places API
  - Supabase (for database)

### Environment Variables

1. Create a `.env` file in the root directory
2. Add the following variables with your own values:
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co        # Your Supabase project URL
VITE_SUPABASE_ANON_KEY=your-anon-key                      # Your Supabase anon key

# API Keys (Keep these secret!)
VITE_GOOGLE_PLACES_API_KEY=your-google-places-key         # Get from Google Cloud Console
VITE_OPENAI_API_KEY=your-openai-key                       # Get from OpenAI dashboard
```

#### Getting the API Keys:
1. **Supabase**:
   - Create a project at [supabase.com](https://supabase.com)
   - Find credentials in Project Settings > API

2. **Google Places API**:
   - Create a project in [Google Cloud Console](https://console.cloud.google.com)
   - Enable Places API and create credentials
   - Add restrictions to the API key (HTTP referrers, IP addresses)

3. **OpenAI API**:
   - Sign up at [OpenAI Platform](https://platform.openai.com)
   - Create an API key in the API Keys section
   - Set usage limits to control costs

### Local Development
1. Clone the repository:
```bash
git clone https://github.com/yourusername/QuickCafe.git
cd QuickCafe
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
# Run migrations
npm run db:migrate
```

4. Start the development server:
```bash
npm run dev
```

## Database Migrations

The project includes SQL migrations for:
1. Creating required extensions:
   - uuid-ossp for UUID generation
   - postgis for geographical queries
2. Setting up ENUM types:
   - price_level ('$', '$$', '$$$')
   - vibe_category (cozy, modern, quiet, etc.)
   - amenity_type (wifi, outdoor_seating, etc.)
3. Creating tables with proper indexes:
   - Spatial index on café locations
   - B-tree indexes on foreign keys
4. Defining functions:
   - search_nearby_cafes(lat, lng, radius, price)
   - update_cafe_analysis(id, vibes, amenities)
   - check_extensions()

## Testing

The project includes comprehensive tests:
- Unit tests for core services
- Integration tests for API endpoints
- Mock implementations for:
  - OpenAI API responses
  - Google Places API
  - Geocoding services
- Test coverage for:
  - Recommendation logic
  - Score calculation
  - Data processing
  - Error handling

Run tests with:
```bash
npm test
```

## Performance Considerations

1. **Database Optimization**
   - PostGIS spatial indexes for location queries
   - Efficient array storage for scores
   - Optimized SQL functions
   - Proper indexing on frequently queried columns

2. **API Usage**
   - Minimal token usage in OpenAI calls
   - Selective review analysis (max 3 reviews, 150 chars each)
   - Efficient Google Places API usage
   - Request caching where appropriate

3. **Caching Strategy**
   - Location caching for repeated searches
   - Analysis results caching with 24-hour expiration
   - High-confidence score storage
   - Automatic cache cleanup

4. **Query Optimization**
   - Efficient PostGIS queries
   - Proper use of indexes
   - Optimized joins
   - Result limiting

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
