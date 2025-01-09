# QuickCafé

QuickCafé is an AI-powered café recommendation system that suggests perfect coffee spots based on your preferences, mood, and requirements. Using OpenAI's GPT API, it generates contextual and personalized café recommendations instantly.

## Features

- 🎯 Simple preference-based input
- ☕️ AI-powered café suggestions
- 💨 Fast, real-time recommendations
- 🎨 Clean, modern interface

## How it works

This project uses the OpenAI GPT API and Vercel Edge functions with streaming. It generates 5 café recommendations based on your preferences and requirements, sends it to the GPT API via a Vercel Edge function, then streams the response back to the application.

## Running Locally

After cloning the repo, go to [OpenAI](https://platform.openai.com/signup) to make an account and put your API key in a file called `.env`.

For example:

```bash
OPENAI_API_KEY=your_api_key_here
```

Then, run the application in the command line and it will be available at `http://localhost:5173`.

```bash
npm run dev
```

## Tech Stack

- Frontend: SvelteKit
- Styling: Tailwind CSS
- AI: OpenAI GPT API
- Deployment: Vercel Edge Functions