<script lang="ts">
  import { fade } from 'svelte/transition';
  export let recommendation: {
    name: string;
    description: string;
    features: string;
    bestFor: string;
    operating_hours?: {
      [day: string]: {
        open: string;
        close: string;
      };
    };
    photos?: {
      url: string;
      width: number;
      height: number;
    }[];
  };

  // Parse price and distance from name
  $: [cafeName, details] = recommendation.name.split('-').map(s => s.trim());
  $: priceLevel = details?.split('(')[0]?.trim() || '';
  $: distance = details?.match(/\(([^)]+)\)/)?.[1] || '';

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  function formatTime(time: string): string {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
  }
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
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-bold text-neutral-800">
            {cafeName}
          </h2>
          <div class="flex items-center gap-4">
            <span class="text-pink-600 font-semibold">{priceLevel}</span>
            <span class="text-neutral-500 text-sm">{distance}</span>
          </div>
        </div>

        <p class="text-neutral-600 mb-4">
          {recommendation.description}
        </p>

        <div class="space-y-2 mb-6">
          <div class="flex gap-2 items-start">
            <span class="font-medium text-neutral-800 whitespace-nowrap">Features:</span>
            <div class="flex flex-wrap gap-2">
              {#each recommendation.features.split(',') as feature}
                <span class="px-3 py-1 rounded-full text-xs border border-pink-200 bg-pink-50 text-pink-700">
                  {feature.trim()}
                </span>
              {/each}
            </div>
          </div>
          
          <div class="flex gap-2 items-start">
            <span class="font-medium text-neutral-800 whitespace-nowrap">Best for:</span>
            <span class="text-neutral-600">{recommendation.bestFor}</span>
          </div>
        </div>

        {#if recommendation.operating_hours}
          <div class="mt-6">
            <h4 class="font-semibold text-gray-900 mb-2">Hours</h4>
            <div class="grid grid-cols-1 gap-1">
              {#each days as day}
                {#if recommendation.operating_hours[day]}
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-600">{day}</span>
                    <span class="text-gray-900">
                      {formatTime(recommendation.operating_hours[day].open)} - 
                      {formatTime(recommendation.operating_hours[day].close)}
                    </span>
                  </div>
                {:else}
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-600">{day}</span>
                    <span class="text-gray-400">Closed</span>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>