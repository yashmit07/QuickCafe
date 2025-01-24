<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import LoadingIndicator from './Loading.svelte';

  export let mood = '';
  export let priceRange = '';
  export let location = '';
  export let requirements: string[] = [];
  export let loading = false;

  const dispatch = createEventDispatcher();

  const moodTypes = [
    { value: 'cozy', label: 'Cozy' },
    { value: 'modern', label: 'Modern' },
    { value: 'quiet', label: 'Quiet' },
    { value: 'lively', label: 'Lively' },
    { value: 'artistic', label: 'Artistic' },
    { value: 'traditional', label: 'Traditional' },
    { value: 'industrial', label: 'Industrial' }
  ];

  const priceRanges = [
    { value: '$', label: 'Budget Friendly' },
    { value: '$$', label: 'Moderate' },
    { value: '$$$', label: 'High-End' }
  ];

  const requirementTypes = [
    { value: 'wifi', label: 'WiFi' },
    { value: 'outdoor_seating', label: 'Outdoor Seating' },
    { value: 'power_outlets', label: 'Power Outlets' },
    { value: 'pet_friendly', label: 'Pet Friendly' },
    { value: 'parking', label: 'Parking Available' },
    { value: 'workspace_friendly', label: 'Workspace Friendly' },
    { value: 'food_menu', label: 'Food Menu' }
  ];
</script>

<div class="bg-white rounded-2xl p-8">
  <div class="space-y-8">
    <div>
      <div class="mb-4">
        <h3 class="text-xl font-semibold text-neutral-800"> What kind of vibe are you looking for? <span class="text-pink-500 text-sm">*</span> </h3>
      </div>
      <div class="flex flex-wrap gap-2">
        {#each moodTypes as type}
          <button
            on:click={() => mood = type.value}
            class="px-4 py-2 rounded-full border transition-all
            {mood === type.value 
              ? 'bg-pink-50 border-pink-500 text-pink-700' 
              : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'}"
          >
            {type.label}
          </button>
        {/each}
      </div>
    </div>

    <div>
      <div class="mb-4">
        <h3 class="text-xl font-semibold text-neutral-800">Where are you looking to go? <span class="text-pink-500 text-sm">*</span></h3>
      </div>
      <input
        bind:value={location}
        class="w-full px-4 py-3 rounded-xl border border-neutral-200 
        focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none
        placeholder:text-neutral-400 text-neutral-900"
        placeholder="Ex. Downtown Seattle, Capitol Hill, etc."
      />
    </div>

    <div>
      <div class="mb-4">
        <h3 class="text-xl font-semibold text-neutral-800">What's your price range? <span class="text-neutral-500 text-sm">(Optional)</span> </h3>
      </div>
      <div class="flex gap-2">
        {#each priceRanges as range}
          <button
            on:click={() => priceRange = range.value}
            class="px-6 py-3 rounded-full border transition-all text-center
            {priceRange === range.value 
              ? 'bg-pink-50 border-pink-500 text-pink-700' 
              : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'}"
          >
            <div class="font-bold">{range.value}</div>
            <div class="text-xs mt-1">{range.label}</div>
          </button>
        {/each}
      </div>
    </div>

    <div>
      <div class="mb-4">
        <h3 class="text-xl font-semibold text-neutral-800">Any specific requirements? <span class="text-neutral-500 text-sm">(Optional)</span> </h3>
      </div>
      <div class="flex flex-wrap gap-2">
        {#each requirementTypes as type}
          <label
            class="px-4 py-2 rounded-full border cursor-pointer transition-all
            {requirements.includes(type.value)
              ? 'bg-pink-50 border-pink-500 text-pink-700'
              : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'}"
          >
            <input
              type="checkbox"
              class="hidden"
              bind:group={requirements}
              name="requirements"
              value={type.value}
            />
            {type.label}
          </label>
        {/each}
      </div>
    </div>

    <button
      on:click={() => dispatch('submit')}
      disabled={!location || !mood || loading}
      class="w-full py-4 rounded-xl font-semibold transition-all
      {loading || !location || !mood
        ? 'bg-neutral-100 text-neutral-400'
        : 'bg-gradient-to-r from-pink-600 to-pink-500 text-white hover:from-pink-700 hover:to-pink-600'}"
    >
      {#if loading}
        <LoadingIndicator />
      {:else}
        Find My Perfect Café
      {/if}
    </button>

    {#if !mood || !location}
      <div class="text-sm text-pink-500 text-center">
        * Required fields must be filled
      </div>
    {/if}
  </div>
</div>