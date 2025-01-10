# QuickCafé

QuickCafé is an AI-powered café discovery platform that helps users find the perfect coffee spot based on their preferences. Utilizing OpenAI's GPT API for intelligent recommendations, Google Places API for real café data, and PostGIS for location-based searching, it delivers personalized café suggestions with atmosphere analysis.

## Features

- 🎯 Smart café matching based on atmosphere preferences
- 📍 Location-aware recommendations using PostGIS
- 🏃‍♂️ Real-time data streaming with server-sent events
- 💨 Redis-powered caching and rate limiting
- 🎨 Responsive UI with TailwindCSS

## Project Progress

### Completed ✅
- Basic project setup from template
- Core UI components modified for café theme:
  - Form component for café preferences
  - Header with café branding
  - Home page with updated messaging
  - Footer and GitHub button
  - Loading and recommendation card components
- Initial OpenAI GPT integration for recommendations
- Basic project structure and routing

### In Progress 🚧
- Development environment setup
- Testing basic recommendation flow
- Debugging initial implementation

### To Do 📝
1. Database Integration
   - Set up PostgreSQL with PostGIS
   - Design schema for café data
   - Implement database queries

2. API Integrations
   - Integrate Google Places API
   - Combine Google data with OpenAI analysis
   - Implement robust error handling

3. Caching Layer
   - Set up Redis
   - Implement caching strategy
   - Add rate limiting with Redis

4. Performance Optimization
   - Optimize database queries
   - Implement efficient data streaming
   - Add loading states and pagination

5. UI/UX Improvements
   - Add responsive design improvements
   - Implement error states
   - Add loading animations
   - Improve recommendation display

6. Testing & Documentation
   - Add unit tests
   - Write integration tests
   - Complete documentation
   - Add contribution guidelines

7. Deployment
   - Set up production database
   - Configure Redis in production
   - Set up monitoring
   - Deploy to Vercel

## Tech Stack

- **Frontend**: SvelteKit
- **Database**: PostgreSQL with PostGIS extension
- **Caching**: Redis
- **APIs**: OpenAI GPT-3.5, Google Places API
- **Styling**: TailwindCSS
- **Deployment**: Vercel Edge Functions

## How it works

The platform combines multiple technologies to provide intelligent café recommendations:
1. Uses Google Places API to fetch real café data
2. Analyzes reviews and descriptions using OpenAI GPT
3. Matches user preferences with café attributes
4. Streams recommendations in real-time
5. Caches results with Redis for improved performance

## Running Locally

1. Clone the repository
2. Create a `.env` file with the following keys:
```env
OPENAI_API_KEY=your_openai_key
GOOGLE_PLACES_API_KEY=your_google_key
POSTGRES_URL=your_postgres_connection_string
REDIS_URL=your_redis_url
```

3. Install dependencies and run the development server:
```bash
npm install
npm run dev
```

The application will be available at http://localhost:5173.

## Database Setup

1. Ensure PostgreSQL is installed with PostGIS extension
2. Run the database migrations:
```bash
npm run db:migrate
```

## Deployment

To deploy QuickCafé, you'll need:

1. A Vercel account for the main application
2. A PostgreSQL database with PostGIS extension
3. A Redis instance for caching
4. Valid API keys for OpenAI and Google Places

### Deployment Steps:
1. Set up your database and Redis instances
2. Deploy to Vercel with the following environment variables:
```
OPENAI_API_KEY=your_openai_key
GOOGLE_PLACES_API_KEY=your_google_key
POSTGRES_URL=your_postgres_connection_string
REDIS_URL=your_redis_url
```

For detailed deployment instructions, check out our deployment guide (coming soon).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
