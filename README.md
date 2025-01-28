# QuickCafe

QuickCafe is an intelligent café recommendation platform that helps you find the perfect café based on your mood, location, and specific requirements.

## Features

- **Smart Café Recommendations**: Find cafes that match your vibe (cozy, modern, quiet, lively, artistic, traditional, industrial)
- **Location-Based Search**: Discover cafes near you or any location
- **Customizable Requirements**: Filter by amenities like:
  - WiFi
  - Outdoor Seating
  - Power Outlets
  - Pet Friendly
  - Parking
  - Workspace Friendly
  - Food Menu
- **Price Range Filtering**: Find cafes that match your budget

## Tech Stack

- Frontend: SvelteKit
- Backend: Node.js
- Database: Supabase (PostgreSQL)
- Caching: Redis (Upstash)
- APIs: Google Places API, OpenAI API

## Environment Setup

Create a `.env` file with the following variables:

```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
UPSTASH_REDIS_URL=your_upstash_redis_url
UPSTASH_REDIS_TOKEN=your_upstash_redis_token
```

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Start the development server:
```bash
npm run dev
```

## API Usage

Make a POST request to `/api/getRecommendation` with the following body:

```json
{
  "location": "City or Address",
  "mood": "modern",
  "priceRange": "$$",
  "requirements": ["wifi", "food_menu"]
}
```

### Valid Options

- **Moods**: cozy, modern, quiet, lively, artistic, traditional, industrial
- **Price Ranges**: $, $$, $$$, $$$$
- **Requirements**: wifi, outdoor_seating, power_outlets, pet_friendly, parking, workspace_friendly, food_menu

## How It Works

1. **Location Search**: 
   - First checks Redis cache for nearby cafes
   - If not found, queries Google Places API and caches results for 1 hour

2. **Café Analysis**:
   - Reviews are analyzed using OpenAI to determine vibes and amenities
   - Results are stored permanently in PostgreSQL
   - No need to reanalyze unless data is explicitly cleared

3. **Recommendations**:
   - Cafes are ranked based on matching mood and requirements
   - Results are sorted by relevance and distance

## Performance Optimizations

- Redis caching for location-based searches (1-hour TTL)
- Batch processing for café analysis
- Permanent storage of analysis results in PostgreSQL
- Coordinate rounding for better cache hits

## Contributing

Feel free to submit issues and pull requests.

## License

MIT License
