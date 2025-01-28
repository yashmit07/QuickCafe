# QuickCafé

An AI-powered café recommendation engine that finds the perfect café based on your mood, preferences, and location.

## 🚀 Quick Start

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
```env
GOOGLE_PLACES_API_KEY=   # For café data
OPENAI_API_KEY=         # For café analysis
UPSTASH_REDIS_URL=      # For caching
SUPABASE_URL=          # For database
SUPABASE_KEY=          # For database auth
```

4. Start the development server:
```bash
npm run dev
```

## 🎯 Features

- **Smart Search**: Find cafes based on location, mood, and specific requirements
- **AI Analysis**: Intelligent scoring of café vibes and amenities
- **Real-time Updates**: Stream analysis progress as results come in
- **Fast Results**: Efficient caching for frequently searched locations

## 🏗 System Architecture

### Data Flow
```mermaid
graph TD
    A[Browser] -->|1. Search Request| B[SvelteKit Server]
    B -->|2. Check Cache| C[Redis]
    C -->|3a. Return Cached IDs| B
    C -->|3b. Cache Miss| B
    B -->|4. Search Cafes| D[Google Places API]
    D -->|5. Return Cafe Data| B
    B -->|6a. Store New Cafes| E[Postgres]
    B -->|6b. Check Existing Analysis| E
    E -->|7a. Return Analysis| B
    B -->|7b. Missing Analysis| F[OpenAI API]
    F -->|8. Return Analysis| B
    B -->|9. Store Analysis| E
    B -->|10. Stream Results| A

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#bbf,stroke:#333,stroke-width:2px
    style C fill:#dfd,stroke:#333,stroke-width:2px
    style D fill:#fdd,stroke:#333,stroke-width:2px
    style E fill:#dfd,stroke:#333,stroke-width:2px
    style F fill:#fdd,stroke:#333,stroke-width:2px
```

### Database Schema
```mermaid
erDiagram
    cafes {
        UUID id PK
        TEXT google_place_id UK
        TEXT name
        POINT location
        TEXT price_level
    }
    cafe_vibes {
        UUID cafe_id FK
        TEXT vibe_category
        FLOAT confidence_score
    }
    cafe_amenities {
        UUID cafe_id FK
        TEXT amenity
        FLOAT confidence_score
    }
    cafes ||--o{ cafe_vibes : has
    cafes ||--o{ cafe_amenities : has
```

## 🔄 Caching System

### Location-based Cache
- **Key Structure**: `location:{lat}:{lng}:{price_range}`
- **Value**: Array of café IDs within 5km radius
- **TTL**: 1 hour
- **Coordinate Rounding**: 4 decimal places for better cache hits

Example:
```typescript
// Cache key for location search
const cacheKey = `location:${roundCoord(lat)}:${roundCoord(lng)}:${priceRange}`

// Cache structure
{
  "location:33.6638:-117.9047:$": [
    "cafe_id_1",
    "cafe_id_2",
    ...
  ]
}
```

## 🎯 Scoring & Recommendation Logic

### 1. Vibe Analysis
```typescript
type VibeScore = {
  cozy: number;      // 0-1 score
  modern: number;    // 0-1 score
  quiet: number;     // 0-1 score
  lively: number;    // 0-1 score
  artistic: number;  // 0-1 score
  traditional: number; // 0-1 score
  industrial: number;  // 0-1 score
}
```

### 2. Amenity Detection
```typescript
type AmenityScore = {
  wifi: number;           // 0-1 score
  outdoor_seating: number; // 0-1 score
  power_outlets: number;   // 0-1 score
  pet_friendly: number;    // 0-1 score
  parking: number;         // 0-1 score
  workspace_friendly: number; // 0-1 score
  food_menu: number;         // 0-1 score
}
```

### 3. Ranking Algorithm
1. **Base Score**: Vibe match percentage (0-100%)
2. **Requirement Multiplier**: Each matched requirement adds 20%
3. **Distance Penalty**: -5% per kilometer from target location
4. **Final Score**: `(baseScore + requirementBonus) * (1 - distancePenalty)`

Example:
```typescript
const finalScore = (
  (vibeMatchScore + (matchedRequirements * 0.2)) * 
  (1 - (distanceKm * 0.05))
).toFixed(2)
```

## �� API Reference

### Endpoint: `/api/getRecommendation`

**Method**: `POST`

**Request Body**:
```typescript
{
  // The location to search for cafes
  location: "San Francisco, CA",
  
  // The desired vibe/mood of the cafe
  mood: "cozy" | "modern" | "quiet" | "lively" | "artistic" | "traditional" | "industrial",
  
  // Optional: Price range filter
  priceRange?: "$" | "$$" | "$$$",
  
  // Optional: Required amenities
  requirements?: [
    "wifi",
    "outdoor_seating",
    "power_outlets",
    "pet_friendly",
    "parking",
    "workspace_friendly",
    "food_menu"
  ]
}
```

**Response**: Stream of cafe recommendations, each separated by `###`

```typescript
// Each recommendation in the stream follows this format:
{
  // Name of the cafe
  name: "Cafe Example",
  
  // AI-generated description based on reviews and analysis
  description: "A cozy corner cafe with modern decor...",
  
  // List of notable features and amenities
  features: [
    "Strong wifi connection",
    "Plenty of power outlets",
    "Quiet atmosphere"
  ],
  
  // AI-generated summary of ideal use cases
  bestFor: "Perfect for focused work sessions or quiet meetings",
  
  // Distance from requested location in meters
  distance: 750,
  
  // Calculated match score (0-100)
  matchScore: 85.5
}
```

**Example Usage**:
```typescript
const response = await fetch('/api/getRecommendation', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    location: "San Francisco, CA",
    mood: "cozy",
    priceRange: "$$",
    requirements: ["wifi", "power_outlets"]
  })
});

// Response is streamed, so we need to read it chunk by chunk
const reader = response.body.getReader();
let recommendations = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  recommendations += new TextDecoder().decode(value);
}

// Split recommendations by separator
const cafeList = recommendations
  .split('###')
  .filter(text => text.trim())
  .map(text => parseRecommendation(text));
```

## 🔧 Development

```bash
# Run tests
npm test

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📄 License

MIT
