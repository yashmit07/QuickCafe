# src/lib/components/CafeCard.svelte
<script lang="ts">
    export let name: string;
    export let distance: number;
    export let description: string;
    export let priceLevel: string;
    export let vibes: Array<{category: string, score: number}>;
    export let amenities: Array<{type: string, score: number}>;
    export let bestFor: string;

    // Format distance to be more readable
    $: formattedDistance = distance < 1000 
        ? `${Math.round(distance)}m` 
        : `${(distance/1000).toFixed(1)}km`;

    // Get top 3 vibes and amenities
    $: topVibes = vibes
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(v => v.category);

    $: topAmenities = amenities
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(a => a.type);
</script>

<div class="cafe-card">
    <div class="header">
        <div class="title-section">
            <h2>{name}</h2>
            <div class="meta">
                <span class="price">{priceLevel}</span>
                <span class="dot">•</span>
                <span class="distance">{formattedDistance}</span>
            </div>
        </div>
        <div class="cafe-icon">☕</div>
    </div>

    <p class="description">{description}</p>

    <div class="features">
        <div class="section">
            <h3>Features</h3>
            <div class="tags">
                {#each topVibes as vibe}
                    <span class="tag vibe">{vibe}</span>
                {/each}
                {#each topAmenities as amenity}
                    <span class="tag amenity">{amenity}</span>
                {/each}
            </div>
        </div>
        
        <div class="section">
            <h3>Best for</h3>
            <p class="best-for">{bestFor}</p>
        </div>
    </div>
</div>

<style>
    .cafe-card {
        background: white;
        border-radius: 16px;
        padding: 1.5rem;
        margin-bottom: 1rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        transition: transform 0.2s, box-shadow 0.2s;
    }

    .cafe-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1rem;
    }

    .title-section {
        flex: 1;
    }

    h2 {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0;
        color: #333;
    }

    .meta {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #666;
        font-size: 0.9rem;
        margin-top: 0.25rem;
    }

    .dot {
        color: #ccc;
    }

    .cafe-icon {
        font-size: 2rem;
        color: #059669;
        margin-left: 1rem;
    }

    .description {
        color: #555;
        margin: 0.5rem 0 1rem;
        line-height: 1.5;
    }

    .features {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .section h3 {
        font-size: 0.9rem;
        font-weight: 600;
        color: #666;
        margin: 0 0 0.5rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .tag {
        padding: 0.25rem 0.75rem;
        border-radius: 999px;
        font-size: 0.85rem;
        font-weight: 500;
    }

    .tag.vibe {
        background: #FCE4EC;
        color: #C2185B;
    }

    .tag.amenity {
        background: #E8F5E9;
        color: #2E7D32;
    }

    .best-for {
        color: #555;
        margin: 0;
        font-size: 0.95rem;
    }

    @media (min-width: 768px) {
        .features {
            flex-direction: row;
            justify-content: space-between;
        }

        .section {
            flex: 1;
        }
    }
</style> 