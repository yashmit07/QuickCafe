<script>
  import { fade } from 'svelte/transition';
  export let recommendation = {
    name: '',
    description: '',
    features: '',
    bestFor: ''
  };
</script>

<div in:fade|global>
  <div class="bg-white rounded-2xl shadow-lg p-8">
    <div class="flex gap-8">
      <div class="w-1/4 aspect-square rounded-xl bg-neutral-100 flex items-center justify-center flex-none">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class="text-pink-600"
        >
          <path
            d="M18 8h1a4 4 0 1 1 0 8h-1"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M6 1v3M10 1v3M14 1v3"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <div class="flex-1">
        <h2 class="text-2xl font-bold text-neutral-800 mb-4">
          {recommendation.name}
        </h2>
        <p class="text-neutral-600 mb-4">
          {recommendation.description}
        </p>
        <p class="text-neutral-500 mb-4">
          {recommendation.features}
        </p>
        <p class="text-neutral-500 mb-6">
          <span class="font-medium">Best for:</span> {recommendation.bestFor}
        </p>
        
        <div class="flex flex-wrap gap-2">
          {#if recommendation.features}
            {#each recommendation.features.split(',') as feature}
              <span class="px-3 py-1 rounded-full text-xs border border-pink-200 bg-pink-50 text-pink-700">
                {feature.trim()}
              </span>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>