import { VITE_OPENAI_API_KEY } from '$env/static/private'
import type { Cafe } from '$lib/types/database'
import { supabase } from '$lib/db/supabase'

interface CacheEntry {
    analysis: any;
    timestamp: number;
}

export class AnalysisService {
    private static readonly RETRY_ATTEMPTS = 3;
    private static readonly RETRY_DELAY = 1000; // 1 second
    private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    private cache: Map<string, CacheEntry> = new Map();

    private async saveAnalysisToDatabase(cafeId: string, analysis: any) {
        try {
            // Filter and prepare vibe scores
            if (analysis.vibe_scores) {
                console.log('Filtering and saving vibe scores for cafe:', cafeId);
                const highConfidenceVibes = Object.entries(analysis.vibe_scores)
                    .filter(([_, score]) => (score as number) > 0.4);

                if (highConfidenceVibes.length > 0) {
                    const vibeCategories = highConfidenceVibes.map(([category]) => category);
                    const vibeScores = highConfidenceVibes.map(([_, score]) => score);
                    
                    console.log('High confidence vibes to insert:', { vibeCategories, vibeScores });
                    
                    const { error: vibeError } = await supabase
                        .from('cafe_vibes')
                        .upsert({
                            cafe_id: cafeId,
                            vibe_categories: vibeCategories,
                            confidence_scores: vibeScores,
                            last_analyzed: new Date().toISOString()
                        });
                        
                    if (vibeError) {
                        console.error('Error saving vibe scores:', vibeError);
                        throw vibeError;
                    }
                    console.log('Successfully saved high confidence vibes');
                }
            }

            // Filter and prepare amenity scores
            if (analysis.amenity_scores) {
                console.log('Filtering and saving amenity scores for cafe:', cafeId);
                const highConfidenceAmenities = Object.entries(analysis.amenity_scores)
                    .filter(([_, score]) => (score as number) > 0.5);

                if (highConfidenceAmenities.length > 0) {
                    const amenityTypes = highConfidenceAmenities.map(([amenity]) => amenity);
                    const amenityScores = highConfidenceAmenities.map(([_, score]) => score);
                    
                    console.log('High confidence amenities to insert:', { amenityTypes, amenityScores });
                    
                    const { error: amenityError } = await supabase
                        .from('cafe_amenities')
                        .upsert({
                            cafe_id: cafeId,
                            amenities: amenityTypes,
                            confidence_scores: amenityScores,
                            last_analyzed: new Date().toISOString()
                        });
                        
                    if (amenityError) {
                        console.error('Error saving amenity scores:', amenityError);
                        throw amenityError;
                    }
                    console.log('Successfully saved high confidence amenities');
                }
            }
        } catch (error) {
            console.error('Error saving analysis to database:', error);
            throw error;
        }
    }

    async analyzeReviews(cafe: Cafe) {
        if (!cafe.reviews?.length) return null;

        // Check cache first
        const cachedResult = this.getCachedAnalysis(cafe.id);
        if (cachedResult) {
            console.log(`Using cached analysis for cafe ${cafe.id}`);
            return cachedResult;
        }

        // Skip analysis if we don't have enough review text
        const totalReviewText = cafe.reviews.reduce((acc, review) => acc + (review.text?.length || 0), 0);
        if (totalReviewText < 50) return null;

        for (let attempt = 1; attempt <= AnalysisService.RETRY_ATTEMPTS; attempt++) {
            try {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${VITE_OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: "gpt-3.5-turbo",
                        messages: [{
                            role: "system",
                            content: "You are a cafe analysis expert. Return ONLY a compact, valid JSON object with numeric scores between 0 and 1."
                        }, {
                            role: "user",
                            content: this.createPrompt(cafe)
                        }],
                        temperature: 0,
                        max_tokens: 300,
                        response_format: { type: "json_object" }
                    })
                });

                if (!response.ok) {
                    if (response.status === 429 && attempt < AnalysisService.RETRY_ATTEMPTS) {
                        await new Promise(resolve => setTimeout(resolve, AnalysisService.RETRY_DELAY * attempt));
                        continue;
                    }
                    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
                }

                const result = await response.json();
                if (!result.choices?.[0]?.message?.content) {
                    throw new Error('Invalid API response format');
                }

                try {
                    const rawContent = result.choices[0].message.content;
                    console.log('Raw OpenAI response:', rawContent);
                    
                    // Pre-validate JSON format
                    if (!rawContent.includes('"vibe_scores"') || !rawContent.includes('"amenity_scores"')) {
                        throw new Error('Response missing required properties');
                    }
                    
                    const analysis = JSON.parse(rawContent);
                    if (!this.isValidAnalysis(analysis)) {
                        console.error('Invalid analysis format:', analysis);
                        throw new Error('Invalid analysis format');
                    }

                    // Save filtered results to database
                    await this.saveAnalysisToDatabase(cafe.id, analysis);

                    // Cache the result
                    this.cacheAnalysis(cafe.id, analysis);
                    return analysis;
                } catch (parseError) {
                    console.error('Error parsing analysis result:', parseError);
                    console.error('Raw content:', result.choices[0].message.content);
                    return null;
                }
            } catch (error) {
                if (attempt === AnalysisService.RETRY_ATTEMPTS) {
                    console.error('Error analyzing reviews:', error);
                    return null;
                }
                await new Promise(resolve => setTimeout(resolve, AnalysisService.RETRY_DELAY * attempt));
            }
        }
        return null;
    }

    private createPrompt(cafe: Cafe): string {
        const limitedReviews = cafe.reviews
            .slice(0, 3)
            .map(review => review.text?.slice(0, 150) || '')
            .filter(text => text.length > 0)
            .join('\n\n');

        return `Analyze these reviews for ${cafe.name} and return a compact JSON object with these exact properties:
{
  "vibe_scores": {"cozy": 0.5, "modern": 0.3, "quiet": 0.4, "lively": 0.2, "artistic": 0.1, "traditional": 0.3, "industrial": 0.2},
  "amenity_scores": {"wifi": 0.8, "outdoor_seating": 0.6, "power_outlets": 0.4, "pet_friendly": 0.2, "parking": 0.5, "workspace_friendly": 0.7, "food_menu": 0.9}
}

Reviews:
${limitedReviews}

Important:
1. Return ONLY the JSON object above
2. Replace scores with your analysis (0-1)
3. Keep ALL properties and closing braces
4. Use high scores (>0.7) only when explicitly mentioned
5. Keep JSON compact (no extra whitespace)
6. Do not change property names`;
    }

    private isValidAnalysis(analysis: any): boolean {
        const requiredVibeCategories = [
            'cozy', 'modern', 'quiet', 'lively', 
            'artistic', 'traditional', 'industrial'
        ];
        const requiredAmenities = [
            'wifi', 'outdoor_seating', 'power_outlets', 
            'pet_friendly', 'parking', 'workspace_friendly', 
            'food_menu'
        ];

        return (
            analysis &&
            typeof analysis === 'object' &&
            'vibe_scores' in analysis &&
            'amenity_scores' in analysis &&
            typeof analysis.vibe_scores === 'object' &&
            typeof analysis.amenity_scores === 'object' &&
            // Check that all required categories exist
            requiredVibeCategories.every(cat => cat in analysis.vibe_scores) &&
            requiredAmenities.every(amenity => amenity in analysis.amenity_scores) &&
            // Check all scores are valid numbers
            Object.values(analysis.vibe_scores).every(score => 
                typeof score === 'number' && score >= 0 && score <= 1
            ) &&
            Object.values(analysis.amenity_scores).every(score => 
                typeof score === 'number' && score >= 0 && score <= 1
            )
        );
    }

    private getCachedAnalysis(cafeId: string): any | null {
        const cached = this.cache.get(cafeId);
        if (!cached) return null;

        // Check if cache has expired
        if (Date.now() - cached.timestamp > AnalysisService.CACHE_DURATION) {
            this.cache.delete(cafeId);
            return null;
        }

        return cached.analysis;
    }

    private cacheAnalysis(cafeId: string, analysis: any) {
        this.cache.set(cafeId, {
            analysis,
            timestamp: Date.now()
        });
    }
}