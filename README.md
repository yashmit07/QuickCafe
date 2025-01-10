# QuickCafé

QuickCafé is an AI-powered café discovery platform that helps users find the perfect coffee spot based on their preferences. Utilizing OpenAI's GPT API for intelligent recommendations, Google Places API for real café data, and PostGIS for location-based searching, it delivers personalized café suggestions with atmosphere analysis.

## Features

- 🎯 Smart café matching based on atmosphere preferences
- 📍 Location-aware recommendations using PostGIS
- 🏃‍♂️ Real-time data streaming with server-sent events
- 💨 Redis-powered caching and rate limiting
- 🎨 Responsive UI with TailwindCSS

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

Deploy your own instance of QuickCafé with Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2F[YOUR-USERNAME]%2Fquickcafe)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
