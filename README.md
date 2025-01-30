# QuickCafé

<div align="center">

An AI-powered café recommendation engine that finds your perfect café based on mood, preferences, and location.

</div>

---

## 📚 Table of Contents
- [About](#-about)
- [System Design](#-system-design)
- [Data Flow](#-data-flow)
- [Recommendation Engine](#-recommendation-engine)
- [Technical Implementation](#-technical-implementation)
- [Getting Started](#-getting-started)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

## 🎯 About

QuickCafé revolutionizes café discovery by combining location data with AI-powered analysis of café vibes and amenities. Unlike traditional platforms that only show ratings and reviews, we understand the actual atmosphere and features of each café.

### The Problem
Finding the right café isn't just about location - it's about finding a space that matches your mood and needs. Traditional review platforms don't capture the "vibe" or specific amenities you're looking for.

### Our Solution
QuickCafé uses AI to analyze thousands of reviews and data points to understand café characteristics and match them to your preferences.

## 🏗 System Design

### Architecture Components

1. **Frontend (SvelteKit)**
   - Server-side rendering for performance
   - Real-time streaming updates
   - Progressive web app capabilities

2. **Database (Supabase PostgreSQL)**
   ```sql
   -- Core Tables
   cafes (
       id UUID PRIMARY KEY,
       google_place_id TEXT UNIQUE,
       name TEXT,
       location POINT,
       price_level TEXT,
       created_at TIMESTAMP,
       updated_at TIMESTAMP
   )

   cafe_vibes (
       cafe_id UUID REFERENCES cafes(id),
       vibe_category TEXT,
       confidence_score FLOAT,
       analyzed_at TIMESTAMP
   )

   cafe_amenities (
       cafe_id UUID REFERENCES cafes(id),
       amenity TEXT,
       confidence_score FLOAT,
       analyzed_at TIMESTAMP
   )
   ```

3. **Caching (Upstash Redis)**
   - Location-based caching with 24-hour TTL
   - Cache key format: `location:{lat}:{lng}:{price_range}`
   - 5km radius coverage per cache entry
   - Coordinate rounding to 4 decimal places for better cache hits

## 🔄 Data Flow

1. **Initial Search**
   ```mermaid
   sequenceDiagram
       User->>+Server: Search Request
       Server->>+Redis: Check Cache
       Redis-->>-Server: Cache Hit/Miss
       Server->>+Google: If Cache Miss
       Google-->>-Server: Places Data
       Server->>+DB: Store New Places
       DB-->>-Server: Confirmation
       Server->>+OpenAI: Analyze Reviews
       OpenAI-->>-Server: Vibe/Amenity Scores
       Server->>+DB: Store Analysis
       DB-->>-Server: Confirmation
       Server-->>-User: Stream Results
   ```

2. **Data Processing Pipeline**
   - Geocode location → 5km radius search
   - Filter and deduplicate results
   - Batch process reviews (3 cafes at a time)
   - Store results in PostgreSQL
   - Cache location results in Redis

## 🎯 Recommendation Engine

### Scoring System

1. **Vibe Scoring (40% weight)**
   ```typescript
   interface VibeScore {
       primary: number;      // Direct mood match (0-1)
       secondary: number;    // Complementary vibes bonus (0.7 weight)
       final: number;       // Combined vibe score
   }
   ```

2. **Complementary Vibes Map**
   ```typescript
   const vibeRelations = {
       cozy: ['quiet', 'traditional'],
       modern: ['artistic', 'industrial'],
       quiet: ['cozy', 'traditional'],
       lively: ['modern', 'artistic'],
       artistic: ['modern', 'industrial'],
       traditional: ['cozy', 'quiet'],
       industrial: ['modern', 'artistic']
   }
   ```

3. **Scoring Weights**
   ```typescript
   const weights = {
       vibe: 0.4,        // Primary factor
       amenity: 0.3,     // Required features
       distance: 0.2,    // Location proximity
       price: 0.1        // Price match
   }
   ```

4. **Final Score Calculation**
   ```typescript
   finalScore = (
       vibeScore * weights.vibe +
       amenityScore * weights.amenity +
       distanceScore * weights.distance +
       priceScore * weights.price
   )
   ```

### Ranking Process

1. **Initial Filtering**
   - Location-based search within 5km
   - Price range filter (if specified)
   - Basic amenity requirements

2. **Score Calculation**
   - Direct vibe match
   - Complementary vibe bonuses (0.7 weight)
   - Amenity match scoring (0.5 default for missing scores)
   - Distance penalty calculation
   - Price match scoring (0.3 for near matches)

3. **Result Ranking**
   - Sort by final score
   - Return top 5 recommendations
   - Include up to 15 other options

### Recent Improvements

1. **Enhanced Scoring**
   - More lenient complementary vibe scoring (0.7 weight)
   - Default amenity scores (0.5) for missing data
   - Improved price matching with partial scores
   - Better handling of missing scores

2. **Detailed Descriptions**
   - Rich, contextual café descriptions
   - Atmosphere details based on vibe scores
   - Notable amenity highlights
   - Specific space and ambiance information

3. **UI Improvements**
   - Consistent recommendation display
   - Clear feature highlighting
   - Better distance and price visibility
   - Improved recommendation parsing

## 🛠 Technical Implementation

### API Endpoints

1. **Recommendation API**
   ```typescript
   POST /api/getRecommendation
   {
       location: string,      // e.g., "San Francisco"
       mood: VibeCategory,    // e.g., "cozy"
       priceRange?: string,   // "$" to "$$$"
       requirements?: string[] // e.g., ["wifi", "outdoor_seating"]
   }
   ```

2. **Response Streaming**
   - Server-sent events for real-time updates
   - Progress indicators during analysis
   - Chunked recommendation delivery

### Optimization Techniques

1. **Cache Strategy**
   - Geospatial indexing
   - Coordinate rounding for cache efficiency
   - 24-hour TTL with manual invalidation
   - Batch processing for analysis

2. **Performance**
   - Parallel processing of café analysis
   - Efficient PostgreSQL queries
   - Streaming responses
   - Edge function deployment

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm/pnpm
- Google Places API key
- OpenAI API key
- Upstash Redis account
- Supabase account

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/quickcafe.git
cd quickcafe
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
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

4. Initialize the database
```bash
npm run db:setup
```

5. Start the development server
```bash
npm run dev
```

## 🛣 Roadmap

### Phase 1: Core Features ✅
- [x] Basic café search with Google Places API
- [x] AI-powered vibe and amenity analysis
- [x] Location-based caching with Redis
- [x] Real-time recommendation streaming
- [x] Smart scoring and ranking system
- [x] Distance-based results
- [x] Mood-based filtering

### Phase 2: Enhanced Analysis 🚧
- [ ] Time-based recommendations
- [ ] Crowd level prediction
- [ ] Photo-based vibe analysis
- [ ] Menu analysis and categorization
- [ ] Price analysis for better matching

### Phase 3: User Features 📋
- [ ] User accounts and profiles
- [ ] Personalized recommendations
- [ ] Favorite cafés and lists
- [ ] Search history
- [ ] Personal preferences storage
- [ ] Custom lists

### Phase 4: Social Features 🤝
- [ ] User reviews and ratings
- [ ] Shared café lists
- [ ] Social recommendations
- [ ] Community contributions
- [ ] Café owner verification

### Phase 5: Advanced Features 🚀
- [ ] Real-time occupancy tracking
- [ ] Table/space reservations
- [ ] Mobile app development
- [ ] Offline support
- [ ] API marketplace for developers

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Code Contributions**
   ```bash
   # Fork and clone
   git clone https://github.com/yourusername/quickcafe.git
   cd quickcafe

   # Create branch
   git checkout -b feature/amazing-feature

   # Commit changes
   git commit -m 'Add amazing feature'

   # Push and create PR
   git push origin feature/amazing-feature
   ```

2. **Development Guidelines**
   - Follow TypeScript best practices
   - Add tests for new features
   - Update documentation
   - Follow existing code style

3. **Bug Reports**
   - Use the issue tracker
   - Include reproduction steps
   - Attach relevant logs
   - Specify your environment

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">

Made with ☕ by [Yashmit Singh](https://github.com/yashmit07)

</div>
