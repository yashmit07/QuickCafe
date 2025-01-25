<script lang="ts">
  import Form from '$lib/Form.svelte';
  import LoadingCard from '$lib/LoadingCard.svelte';
  import RecommendationCard from '$lib/RecommendationCard.svelte';
  import Header from '$lib/Header.svelte';
  import Footer from '$lib/Footer.svelte';

  let showSearchForm = false;
  let mood = '';
  let priceRange = '';
  let location = '';
  let requirements: string[] = [];
  let loading = false;
  let incomingStream = '';
  let recommendations: any[] = [];

  function handleStartSearch() {
    showSearchForm = true;
  }

  function handleReturnHome() {
    showSearchForm = false;
    mood = '';
    priceRange = '';
    location = '';
    requirements = [];
    recommendations = [];
    incomingStream = '';
  }

  async function handleSubmit() {
    loading = true;
    incomingStream = '';
    recommendations = [];
    
    try {
      const response = await fetch('/api/getRecommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood, priceRange, location, requirements })
      });

      if (!response.ok) throw new Error('Failed to get recommendations');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        incomingStream += new TextDecoder().decode(value);
      }

      // Parse the recommendations using the ### separator
      recommendations = incomingStream
        .split('###')
        .filter(text => text.trim())
        .map(text => {
          const lines = text.trim().split('\n');
          const recommendation: any = {};
          
          // Skip empty lines and ensure we have content
          lines.filter(line => line.trim()).forEach(line => {
            const [key, ...valueParts] = line.split(':');
            if (valueParts.length > 0) {
              const value = valueParts.join(':').trim();
              switch(key.trim().toLowerCase()) {
                case 'name':
                  recommendation.name = value;
                  break;
                case 'description':
                  recommendation.description = value;
                  break;
                case 'features':
                  recommendation.features = value;
                  break;
                case 'best for':
                  recommendation.bestFor = value;
                  break;
              }
            }
          });
          
          // Log for debugging
          if (!recommendation.name || !recommendation.description) {
            console.log('Incomplete recommendation:', { text, recommendation });
          }
          
          return recommendation;
        })
        .filter(rec => {
          const isComplete = rec.name && rec.description && rec.features && rec.bestFor;
          if (!isComplete) {
            console.log('Filtered out incomplete recommendation:', rec);
          }
          return isComplete;
        });

      console.log(`Parsed ${recommendations.length} recommendations`);
    } catch (error) {
      console.error('Error:', error);
      alert(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen bg-[#FBF7F4]">
  <Header on:click={handleReturnHome} />
  
  <main class="max-w-4xl mx-auto px-4 py-12">
    {#if !showSearchForm}
      <div class="text-center space-y-8">
        <h1 class="text-5xl font-bold text-neutral-800">
          Discover your perfect<br>café experience
        </h1>
        <p class="text-xl text-neutral-600">
          Find the ideal spot that matches your vibe and needs
        </p>
        <div class="flex justify-center gap-4">
          <button
            on:click={handleStartSearch}
            class="px-6 py-3 rounded-full bg-gradient-to-r from-pink-600 to-pink-500 
            text-white font-medium hover:from-pink-700 hover:to-pink-600"
          >
            Find My Perfect Café
          </button>
        </div>
      </div>
    {:else}
      <div class="space-y-8">
        <Form
          bind:mood
          bind:priceRange
          bind:location
          bind:requirements
          bind:loading
          on:submit={handleSubmit}
        />

        {#if loading}
          <LoadingCard {incomingStream} />
        {/if}

        {#if recommendations.length > 0}
          <div class="space-y-4">
            {#each recommendations as recommendation}
              <RecommendationCard {recommendation} />
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </main>

  <Footer />
</div>