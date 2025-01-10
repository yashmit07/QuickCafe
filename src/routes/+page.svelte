<script lang="ts">
    import Header from '$lib/Header.svelte';
    import Footer from '$lib/Footer.svelte';
    import Home from '$lib/Home.svelte';
    import Form from '$lib/Form.svelte';
    import LoadingCard from '$lib/LoadingCard.svelte';
    import RecommendationCard from '$lib/RecommendationCard.svelte';

    let showForm = false;
    let loading = false;
    let mood = '';
    let priceRange = '';
    let location = '';
    let requirements: string[] = [];
    let recommendations: any[] = [];
    let streamingText = '';

    function handleShowForm() {
        showForm = true;
    }

    async function handleSubmit() {
        loading = true;
        streamingText = '';
        recommendations = [];

        try {
            const response = await fetch('/api/getRecommendation', {
                method: 'POST',
                body: JSON.stringify({
                    searched: `Find cafés with these criteria:
                        Mood/Vibe: ${mood}
                        Price Range: ${priceRange}
                        Location: ${location}
                        Requirements: ${requirements.join(', ')}`
                }),
                headers: {
                    'content-type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader!.read();
                if (done) break;

                const text = decoder.decode(value);
                streamingText += text;

                // Try to parse the accumulated text into structured recommendations
                try {
                    const lines = streamingText.split('\n');
                    const currentRec = {
                        name: '',
                        description: '',
                        features: '',
                        bestFor: ''
                    };

                    lines.forEach(line => {
                        if (line.startsWith('Name:')) currentRec.name = line.replace('Name:', '').trim();
                        else if (line.startsWith('Description:')) currentRec.description = line.replace('Description:', '').trim();
                        else if (line.startsWith('Features:')) currentRec.features = line.replace('Features:', '').trim();
                        else if (line.startsWith('Best for:')) currentRec.bestFor = line.replace('Best for:', '').trim();
                    });

                    if (currentRec.name && !recommendations.some(r => r.name === currentRec.name)) {
                        recommendations = [...recommendations, { ...currentRec }];
                    }
                } catch (e) {
                    console.error('Error parsing recommendation:', e);
                }
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            loading = false;
        }
    }
</script>

<div class="min-h-screen">
    <Header />
    <main class="max-w-4xl mx-auto px-4 pb-12">
        {#if !showForm}
            <Home on:click={handleShowForm} />
        {:else}
            <Form
                {mood}
                {priceRange}
                {location}
                {requirements}
                {loading}
                on:click={handleSubmit}
            />
            {#if loading}
                <div class="mt-8 space-y-4">
                    <LoadingCard incomingStream={streamingText} />
                </div>
            {/if}
            {#if recommendations.length > 0}
                <div class="mt-8 space-y-4">
                    {#each recommendations as recommendation}
                        <RecommendationCard {recommendation} />
                    {/each}
                </div>
            {/if}
        {/if}
    </main>
    <Footer />
</div>