import { createParser } from 'eventsource-parser';
import { OPENAI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

interface CafeRequest {
  mood: string;
  priceRange: string;
  location: string;
  requirements: string[];
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { mood, priceRange, location, requirements } = await request.json() as CafeRequest;

    const prompt = `Act as a knowledgeable local café expert. Generate 5 café recommendations based on the following preferences:

Desired Vibe: ${mood}
Price Range: ${priceRange}
Location: ${location}
Special Requirements: ${requirements.join(', ')}

For each café, provide:
1. Name
2. Brief description of atmosphere and offerings
3. Notable features that match the requirements
4. Best suited for (e.g., working, meetings, casual hangout)

Format each recommendation in a clean, easy-to-read way. Be creative but realistic in your suggestions.`;

    const payload = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      stream: true,
      n: 1
    };

    const stream = await OpenAIStream(payload);
    return new Response(stream);
  } catch (error) {
    console.error('Error in recommendation endpoint:', error);
    return new Response(JSON.stringify({ error: 'Failed to get recommendations' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};

async function OpenAIStream(payload: any) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(JSON.stringify(error));
  }

  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: any) => {
        if (event.type === 'event') {
          const data = event.data;
          
          // Handle [DONE] message
          if (data === '[DONE]') {
            controller.close();
            return;
          }

          try {
            const json = JSON.parse(data);
            const text = json.choices[0].delta.content || '';
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      };

      const parser = createParser(onParse);

      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    }
  });

  return stream;
}