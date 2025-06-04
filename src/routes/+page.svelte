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

<div class="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-100">
  <!-- Decorative background elements -->
  <div class="fixed inset-0 overflow-hidden pointer-events-none">
    <div class="absolute top-20 left-10 w-24 h-24 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full opacity-20 blur-xl"></div>
    <div class="absolute top-40 right-20 w-32 h-32 bg-gradient-to-r from-pink-400 to-red-500 rounded-full opacity-15 blur-xl"></div>
    <div class="absolute bottom-40 left-1/4 w-28 h-28 bg-gradient-to-r from-purple-400 to-blue-500 rounded-full opacity-20 blur-xl"></div>
    <div class="absolute bottom-20 right-1/3 w-20 h-20 bg-gradient-to-r from-green-400 to-teal-500 rounded-full opacity-25 blur-xl"></div>
  </div>

  <Header on:click={handleReturnHome} />
  
  <main class="max-w-4xl mx-auto px-4 py-12 relative z-10">
    {#if !showSearchForm}
      <div class="text-center space-y-8">
        <!-- Colorful badge -->
        <div class="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white text-sm font-medium shadow-lg">
          <span class="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
          Discover Amazing Cafés Near You
        </div>

        <!-- Main heading with colorful gradient text -->
        <h1 class="text-5xl md:text-6xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 bg-clip-text text-transparent leading-tight">
          Discover your perfect<br>café experience
        </h1>
        
        <!-- Subtitle with vibrant color -->
        <p class="text-xl text-slate-600 max-w-2xl mx-auto">
          Find the ideal spot that matches your vibe and needs with our 
          <span class="text-emerald-600 font-semibold">AI-powered</span> 
          café recommendation system
        </p>

        <!-- Colorful feature highlights -->
        <div class="flex flex-wrap justify-center gap-4 mb-8">
          <div class="flex items-center bg-blue-100 text-blue-800 px-4 py-2 rounded-full">
            <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Personalized Matches
          </div>
          <div class="flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-full">
            <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
            </svg>
            Real-time Results
          </div>
          <div class="flex items-center bg-purple-100 text-purple-800 px-4 py-2 rounded-full">
            <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
            </svg>
            Mood-based Search
          </div>
        </div>

        <!-- Enhanced CTA button with gradient and shadow -->
        <div class="flex justify-center">
          <button
            on:click={handleStartSearch}
            class="group relative px-8 py-4 rounded-full bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-white font-bold text-lg 
            hover:from-pink-600 hover:via-red-600 hover:to-yellow-600 transition-all duration-300 transform hover:scale-105 
            shadow-xl hover:shadow-2xl border-2 border-white/20"
          >
            <span class="relative z-10 flex items-center">
              ✨ Find My Perfect Café
              <svg class="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
            </span>
            <!-- Animated gradient overlay -->
            <div class="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
          </button>
        </div>

        <!-- Colorful stats section -->
        <div class="grid grid-cols-3 gap-6 max-w-2xl mx-auto mt-12">
          <div class="text-center p-4 bg-white/70 backdrop-blur-sm rounded-2xl border border-orange-200 shadow-md">
            <div class="text-2xl font-bold text-orange-600">500+</div>
            <div class="text-sm text-orange-800">Cafés Discovered</div>
          </div>
          <div class="text-center p-4 bg-white/70 backdrop-blur-sm rounded-2xl border border-pink-200 shadow-md">
            <div class="text-2xl font-bold text-pink-600">95%</div>
            <div class="text-sm text-pink-800">Match Accuracy</div>
          </div>
          <div class="text-center p-4 bg-white/70 backdrop-blur-sm rounded-2xl border border-purple-200 shadow-md">
            <div class="text-2xl font-bold text-purple-600">24/7</div>
            <div class="text-sm text-purple-800">Always Available</div>
          </div>
        </div>
      </div>
    {:else}
      <div class="space-y-8">
        <!-- Colorful form container -->
        <div class="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/50">
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
          <div class="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/50">
            <LoadingCard {incomingStream} />
          </div>
        {/if}

        {#if recommendations.length > 0}
          <div class="space-y-4">
            {#each recommendations as recommendation}
              <div class="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/50 overflow-hidden">
                <RecommendationCard {recommendation} />
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </main>
</div>

<style>
  :global(html) {
    background: linear-gradient(135deg, #fef7cd 0%, #fce7f3 50%, #e0e7ff 100%);
  }

  /* Add some colorful animations */
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }

  .group:hover {
    animation: float 2s ease-in-out infinite;
  }
</style>