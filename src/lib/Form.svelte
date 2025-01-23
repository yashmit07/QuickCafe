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

  function handleSubmit() {
    dispatch('submit');
  }
</script>

<div class="pt-6 md:pt-10 text-slate-200">
  <div>
    <div class="mb-8">
      <div class="mb-4 font-semibold text-lg flex items-center">
        What kind of vibe are you looking for?
        <span class="ml-2 text-sm text-pink-400">*</span>
      </div>
      <div class="flex items-center flex-wrap">
        {#each moodTypes as type}
          <button
            on:click={() => {
              mood = type.value;
            }}
            class={`${
              mood === type.value ? 'bg-pink-600/40' : ''
            } text-slate-200 font-bold mr-2 text-sm mt-2 py-2 px-4 rounded-full border border-pink-600`}
          >
            {type.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="mb-8">
      <div class="mb-4 font-semibold text-lg flex items-center">
        What's your price range?
        <span class="ml-2 text-sm text-slate-400">(Optional)</span>
      </div>
      <div class="flex items-center">
        {#each priceRanges as range}
          <button
            on:click={() => {
              priceRange = range.value;
            }}
            class={`${
              priceRange === range.value ? 'bg-pink-600/40' : ''
            } text-slate-200 font-bold mr-2 text-sm mt-2 py-2 px-4 rounded-full border border-pink-600`}
          >
            <div>{range.value}</div>
            <div class="text-xs">{range.label}</div>
          </button>
        {/each}
      </div>
    </div>

    <div class="mb-8">
      <div class="mb-4 font-semibold text-lg flex items-center">
        Where are you looking to go?
        <span class="ml-2 text-sm text-pink-400">*</span>
      </div>
      <input
        bind:value={location}
        class="bg-white/40 border border-white/0 p-2 rounded-md placeholder:text-slate-800 text-slate-900 w-full font-medium"
        placeholder="Ex. Downtown Seattle, Capitol Hill, etc."
      />
    </div>

    <div>
      <div class="mb-4 font-semibold text-lg flex items-center">
        Any specific requirements?
        <span class="ml-2 text-sm text-slate-400">(Optional)</span>
      </div>
      <div class="flex items-center flex-wrap">
        {#each requirementTypes as type}
          <label
            class={`${
              requirements.includes(type.value) ? 'bg-pink-600/40' : ''
            } text-slate-200 font-bold mr-2 mt-2 text-sm py-2 px-4 rounded-full border border-pink-600`}
          >
            <input
              class="hidden"
              type="checkbox"
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
      on:click={handleSubmit}
      class={`${
        loading
          ? 'bg-pink-400/50'
          : 'bg-gradient-to-r from-pink-700 via-pink-600 to-pink-700 hover:from-pink-600 hover:via-pink-500 hover:to-pink-600'
      } mt-8 w-full h-10 text-white font-bold p-3 rounded-full flex items-center justify-center`}
      disabled={!location || !mood || loading}
    >
      {#if loading}
        <LoadingIndicator />
      {:else}
        <p>Find My Perfect Café</p>
      {/if}
    </button>

    {#if !mood || !location}
      <div class="mt-2 text-sm text-pink-400 text-center">
        * Required fields must be filled
      </div>
    {/if}
  </div>
</div>