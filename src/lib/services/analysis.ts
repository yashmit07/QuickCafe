import { OPENAI_API_KEY } from '$env/static/private'
import type { Cafe } from '$lib/types/database'

export class AnalysisService {
    async analyzeReviews(cafe: Cafe) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4",
                    messages: [{
                        role: "user",
                        content: this.createPrompt(cafe)
                    }],
                    temperature: 0,
                    response_format: { type: "json_object" }
                })
            })

            if (!response.ok) {
                throw new Error('OpenAI API error')
            }

            const result = await response.json()
            return JSON.parse(result.choices[0].message.content)
        } catch (error) {
            console.error('Error analyzing reviews:', error)
            return null
        }
    }

    private createPrompt(cafe: Cafe): string {
        return `Analyze these cafe reviews and determine:

        1. AMENITIES: For each amenity, provide a confidence score (0-1):
        - wifi
        - outdoor_seating
        - power_outlets
        - pet_friendly
        - parking
        - workspace_friendly
        - food_menu

        2. VIBES: For each vibe, provide a confidence score (0-1):
        - cozy
        - modern
        - quiet
        - lively
        - artistic
        - traditional
        - industrial

        Reviews:
        ${cafe.reviews.map(r => r.text).join('\n')}

        Return a JSON object with "amenities" and "vibes" sections, each containing amenity/vibe scores.
        Example:
        {
            "amenities": {
                "wifi": 0.9,
                "power_outlets": 0.8
            },
            "vibes": {
                "cozy": 0.85,
                "modern": 0.3
            }
        }`
    }
}