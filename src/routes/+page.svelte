<script lang="ts">
  import Form from '$lib/Form.svelte';
  import LoadingCard from '$lib/LoadingCard.svelte';
  import RecommendationCard from '$lib/RecommendationCard.svelte';
  import Header from '$lib/Header.svelte';
  import Home from '$lib/Home.svelte';
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
    let errorMessage = '';

    try {
      console.log('Submitting form with:', { mood, priceRange, location, requirements });
      
      const response = await fetch('/api/getRecommendation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mood,
          priceRange,
          location,
          requirements
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error || 'Failed to get recommendations');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        incomingStream += text;
      }

      // Once streaming is complete, parse the recommendations
      const recommendationTexts = incomingStream
        .split(/\d\.\s/)
        .filter(text => text.trim().length > 0);

      recommendations = recommendationTexts.map(text => {
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        return {
          name: lines[0]?.trim() || '',
          description: lines[1]?.trim() || '',
          features: lines[2]?.trim() || '',
          bestFor: lines[3]?.trim() || ''
        };
      });

    } catch (error) {
      console.error('Error:', error);
      errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    } finally {
      loading = false;
    }

    if (errorMessage) {
      // Show error message to user
      alert(errorMessage);
    }
  }
</script>

<div class="min-h-screen bg-neutral-900">
  <div class="max-w-4xl mx-auto px-4">
    <Header on:click={handleReturnHome} />
    
    {#if !showSearchForm}
      <Home on:click={handleStartSearch} />
    {:else}
      <div class="mt-8">
        <Form
          bind:mood
          bind:priceRange
          bind:location
          bind:requirements
          bind:loading
          on:submit={handleSubmit}
        />
      </div>

      {#if loading}
        <div class="mt-8">
          <LoadingCard {incomingStream} />
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

    <Footer />
  </div>
</div>