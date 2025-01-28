import { OPENAI_API_KEY } from '$env/static/private'
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
            const timestamp = new Date().toISOString();
            
            // Prepare vibe scores
            if (analysis.vibe_scores) {
                console.log('Filtering and saving vibe scores for cafe:', cafeId);
                const vibeScores = Object.entries(analysis.vibe_scores)
                    .filter(([_, score]) => (score as number) > 0.4)
                    .map(([category, score]) => ({
                        cafe_id: cafeId,
                        vibe_category: category,
                        confidence_score: score,
                        last_analyzed: timestamp
                    }));

                if (vibeScores.length > 0) {
                    console.log('High confidence vibes to insert:', vibeScores);
                    
                    // Delete existing vibes first
                    await supabase
                        .from('cafe_vibes')
                        .delete()
                        .eq('cafe_id', cafeId);

                    // Insert new vibes
                    const { error: vibeError } = await supabase
                        .from('cafe_vibes')
                        .insert(vibeScores);
                        
                    if (vibeError) {
                        console.error('Error saving vibe scores:', vibeError);
                        throw vibeError;
                    }
                    console.log('Successfully saved high confidence vibes');
                }
            }

            // Prepare amenity scores
            if (analysis.amenity_scores) {
                console.log('Filtering and saving amenity scores for cafe:', cafeId);
                const amenityScores = Object.entries(analysis.amenity_scores)
                    .filter(([_, score]) => (score as number) > 0.5)
                    .map(([amenity, score]) => ({
                        cafe_id: cafeId,
                        amenity: amenity,
                        confidence_score: score,
                        last_analyzed: timestamp
                    }));

                if (amenityScores.length > 0) {
                    console.log('High confidence amenities to insert:', amenityScores);
                    
                    // Delete existing amenities first
                    await supabase
                        .from('cafe_amenities')
                        .delete()
                        .eq('cafe_id', cafeId);

                    // Insert new amenities
                    const { error: amenityError } = await supabase
                        .from('cafe_amenities')
                        .insert(amenityScores);
                        
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
                        'Authorization': `Bearer ${OPENAI_API_KEY}`
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

        return `Analyze these reviews for ${cafe.name} and return a JSON object with vibe and amenity scores.

Reviews:
${limitedReviews}

Operating Hours: ${JSON.stringify(cafe.operating_hours)}
Address: ${cafe.address}

Consider:
1. Review content and sentiment
2. Operating hours (e.g., late night spots vs early morning cafes)
3. Location and neighborhood characteristics
4. Customer descriptions and experiences

Score these aspects from 0.0 to 1.0:

Vibes (only score high if explicitly mentioned or strongly implied):
- cozy: warm, comfortable atmosphere
- modern: contemporary design, minimalist
- quiet: peaceful, good for work/study
- lively: energetic, social atmosphere
- artistic: creative, unique decor
- traditional: classic cafe feel
- industrial: exposed elements, warehouse style

Amenities (only score high if explicitly mentioned or clearly evident):
- wifi: reliable internet access
- outdoor_seating: quality of outdoor space
- power_outlets: availability for devices
- pet_friendly: welcomes pets
- parking: ease of parking
- workspace_friendly: good for working
- food_menu: food options quality

Return ONLY a JSON object with this structure (no example scores):
{
  "vibe_scores": {
    "cozy": <score>,
    "modern": <score>,
    "quiet": <score>,
    "lively": <score>,
    "artistic": <score>,
    "traditional": <score>,
    "industrial": <score>
  },
  "amenity_scores": {
    "wifi": <score>,
    "outdoor_seating": <score>,
    "power_outlets": <score>,
    "pet_friendly": <score>,
    "parking": <score>,
    "workspace_friendly": <score>,
    "food_menu": <score>
  }
}

Important:
1. Score based ONLY on evidence in reviews and cafe details
2. Use high scores (>0.7) only when explicitly mentioned
3. Use low scores (<0.3) for aspects not mentioned
4. Keep JSON compact (no whitespace)
5. Include ALL properties with appropriate scores`;
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

    /**
     * Analyze multiple cafes in a single batch to reduce API calls
     */
    private async analyzeBatch(cafes: Cafe[], batchSize: number = 3): Promise<Map<string, AnalysisResult>> {
        const results = new Map<string, AnalysisResult>();
        
        // Process cafes in batches
        for (let i = 0; i < cafes.length; i += batchSize) {
            const batch = cafes.slice(i, i + batchSize);
            const batchPrompt = this.buildBatchPrompt(batch);
            
            try {
                const response = await this.openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are analyzing multiple cafes based on their reviews and details. For each cafe, provide vibe scores and amenity scores as JSON.'
                        },
                        {
                            role: 'user',
                            content: batchPrompt
                        }
                    ],
                    temperature: 0.3,
                    response_format: { type: 'json_object' }
                });

                const batchResults = this.parseBatchResponse(response.choices[0].message.content, batch);
                for (const [cafeId, result] of batchResults) {
                    results.set(cafeId, result);
                    this.cacheAnalysis(cafeId, result);
                }
            } catch (error) {
                console.error('Error analyzing batch:', error);
                // Continue with next batch
            }
        }
        
        return results;
    }

    /**
     * Build a prompt for batch analysis
     */
    private buildBatchPrompt(cafes: Cafe[]): string {
        return `Analyze each cafe's unique characteristics based on their reviews and details. Each cafe should have distinct scores that reflect their individual qualities.

Cafes to analyze:
${cafes.map((cafe, index) => `
Cafe ${index + 1}: ${cafe.name}
Reviews: ${cafe.reviews.slice(0, 3).map(r => r.text).filter(Boolean).join('\n')}
Operating Hours: ${JSON.stringify(cafe.operating_hours)}
Address: ${cafe.address}
---
`).join('\n')}

For each cafe, carefully consider:
1. Review content and sentiment
2. Operating hours patterns (early/late, weekday/weekend)
3. Location context and neighborhood type
4. Customer experiences and descriptions
5. Unique features mentioned

Score these aspects from 0.0 to 1.0 for EACH cafe:

Vibes (only score high if explicitly mentioned or strongly implied):
- cozy: warm, comfortable atmosphere
- modern: contemporary design, minimalist
- quiet: peaceful, good for work/study
- lively: energetic, social atmosphere
- artistic: creative, unique decor
- traditional: classic cafe feel
- industrial: exposed elements, warehouse style

Amenities (only score high if explicitly mentioned or clearly evident):
- wifi: reliable internet access
- outdoor_seating: quality of outdoor space
- power_outlets: availability for devices
- pet_friendly: welcomes pets
- parking: ease of parking
- workspace_friendly: good for working
- food_menu: food options quality

Return a JSON object with this structure:
{
    "results": [
        {
            "vibe_scores": {
                "cozy": <score>,
                "modern": <score>,
                "quiet": <score>,
                "lively": <score>,
                "artistic": <score>,
                "traditional": <score>,
                "industrial": <score>
            },
            "amenity_scores": {
                "wifi": <score>,
                "outdoor_seating": <score>,
                "power_outlets": <score>,
                "pet_friendly": <score>,
                "parking": <score>,
                "workspace_friendly": <score>,
                "food_menu": <score>
            }
        }
    ]
}

Important:
1. Each cafe MUST have different scores based on their unique characteristics
2. Use high scores (>0.7) only when explicitly mentioned
3. Use low scores (<0.3) for aspects not mentioned
4. Keep JSON compact (no whitespace)
5. Return scores for ALL properties
6. Ensure the number of results matches the number of cafes`;
    }

    /**
     * Parse batch response into individual results
     */
    private parseBatchResponse(response: string, cafes: Cafe[]): Map<string, AnalysisResult> {
        const results = new Map<string, AnalysisResult>();
        try {
            const parsed = JSON.parse(response);
            if (!parsed.results || !Array.isArray(parsed.results)) {
                throw new Error('Invalid response format');
            }

            parsed.results.forEach((result: any, index: number) => {
                if (index < cafes.length) {
                    const cafe = cafes[index];
                    results.set(cafe.id, {
                        vibe_scores: result.vibe_scores || {},
                        amenity_scores: result.amenity_scores || {}
                    });
                }
            });
        } catch (error) {
            console.error('Error parsing batch response:', error);
        }
        return results;
    }

    /**
     * Analyze multiple cafes and return their scores
     */
    async analyzeCafes(cafes: Cafe[]): Promise<Map<string, AnalysisResult>> {
        const results = new Map<string, AnalysisResult>();
        const cafesToAnalyze: Cafe[] = [];

        // Check cache first
        for (const cafe of cafes) {
            const cached = this.getCachedAnalysis(cafe.id);
            if (cached) {
                results.set(cafe.id, cached);
            } else {
                cafesToAnalyze.push(cafe);
            }
        }

        // If we have cafes to analyze, do it in batches
        if (cafesToAnalyze.length > 0) {
            console.log(`Analyzing ${cafesToAnalyze.length} cafes in batches...`);
            const batchResults = await this.analyzeBatch(cafesToAnalyze);
            
            // Merge batch results with cached results
            for (const [cafeId, result] of batchResults) {
                results.set(cafeId, result);
            }
        }

        return results;
    }
}