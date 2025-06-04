<script lang="ts">
  import { onMount } from 'svelte';
  import CafeCard from '$lib/components/CafeCard.svelte';
  import '../app.css';
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

      console.log('Raw incoming stream:', incomingStream);

      recommendations = incomingStream
        .split('[TOP RECOMMENDATION]')
        .filter(text => text.trim())
        .map(text => {
          console.log('Parsing recommendation text:', text);
          const lines = text.trim().split('\n');
          const recommendation: any = {};
          
          lines.filter(line => line.trim()).forEach(line => {
            const [key, ...valueParts] = line.split(':');
            if (valueParts.length > 0) {
              const value = valueParts.join(':').trim();
              console.log('Parsing line:', { key: key.trim().toLowerCase(), value });
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
                case 'google_place_id':
                  recommendation.google_place_id = value;
                  break;
                default:
                  console.log('Unknown key:', key.trim().toLowerCase());
                  break;
              }
            }
          });
          
          // Set default values for missing fields
          recommendation.description = recommendation.description || 'A lovely local café';
          recommendation.features = recommendation.features || 'Local café';
          recommendation.bestFor = recommendation.bestFor || 'Casual visits';
          
          console.log('Parsed recommendation:', recommendation);
          return recommendation;
        })
        .filter(rec => rec.name);

      console.log('Final recommendations:', recommendations);

    } catch (error: any) {
      console.error('Error:', error);
      alert(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen bg-white">
  <Header on:click={handleReturnHome} />
  
  <main class="max-w-4xl mx-auto px-4 py-12">
    {#if !showSearchForm}
      <div class="text-center space-y-6">
        <h1 class="text-4xl font-bold text-neutral-900">
          Discover your perfect<br>café experience
        </h1>
        <p class="text-lg text-neutral-600">
          Find the ideal spot that matches your vibe and needs
        </p>
        <div class="flex justify-center">
          <button
            on:click={handleStartSearch}
            class="px-8 py-4 rounded-full bg-[#059669] text-white font-semibold 
            hover:bg-[#047857] transition-all duration-300 text-lg tracking-wide
            shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            style="font-family: 'Inter', 'Segoe UI', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif; 
                   letter-spacing: 0.8px; 
                   font-weight: 600;
                   text-transform: uppercase;
                   font-size: 0.95rem;"
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
</div>

<style>
  :global(html) {
    background-color: white;
  }
</style>