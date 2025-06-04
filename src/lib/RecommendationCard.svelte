<script lang="ts">
  import { fade } from 'svelte/transition';
  export let recommendation: {
    name: string;
    description: string;
    features: string;
    bestFor: string;
    google_place_id?: string;
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

  function getGoogleMapsUrl(): string {
    if (recommendation.google_place_id) {
      return `https://www.google.com/maps/place/?q=place_id:${recommendation.google_place_id}`;
    }
    // Fallback to search by name if no place ID
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cafeName)}`;
  }
</script>

<div in:fade|global>
  <div class="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
    <div class="p-8">
      <div class="flex gap-8">
        <div class="w-1/4 aspect-square rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center flex-none">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class="text-emerald-600"
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
            <div>
              <h2 class="text-2xl font-bold text-neutral-800 mb-1">
                {cafeName}
              </h2>
              <div class="flex items-center gap-2 text-sm">
                <span class="text-emerald-600 font-semibold">{priceLevel}</span>
                <span class="text-neutral-300">•</span>
                <span class="text-neutral-500">{distance}</span>
                <span class="text-neutral-300">•</span>
                <a 
                  href={getGoogleMapsUrl()} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  class="text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  View on Maps
                </a>
              </div>
            </div>
          </div>

          <p class="text-neutral-600 mb-6 leading-relaxed">
            {recommendation.description}
          </p>

          <div class="space-y-4 mb-6">
            <div>
              <h4 class="text-sm font-medium text-neutral-800 mb-2">Features</h4>
              <div class="flex flex-wrap gap-2">
                {#each recommendation.features.split(',') as feature}
                  <span class="px-3 py-1 rounded-full text-xs border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                    {feature.trim()}
                  </span>
                {/each}
              </div>
            </div>
            
            <div>
              <h4 class="text-sm font-medium text-neutral-800 mb-2">Best for</h4>
              <p class="text-neutral-600">{recommendation.bestFor}</p>
            </div>
          </div>

          {#if recommendation.operating_hours}
            <div class="border-t border-neutral-100 pt-6">
              <h4 class="text-sm font-medium text-neutral-800 mb-3">Hours of Operation</h4>
              <div class="grid grid-cols-2 gap-2">
                {#each days as day}
                  {#if recommendation.operating_hours[day]}
                    <div class="flex justify-between text-sm">
                      <span class="text-neutral-500">{day}</span>
                      <span class="text-neutral-800 font-medium">
                        {formatTime(recommendation.operating_hours[day].open)} - 
                        {formatTime(recommendation.operating_hours[day].close)}
                      </span>
                    </div>
                  {:else}
                    <div class="flex justify-between text-sm">
                      <span class="text-neutral-500">{day}</span>
                      <span class="text-neutral-400">Closed</span>
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
</div>