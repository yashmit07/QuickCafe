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
    'Cozy',
    'Modern',
    'Quiet',
    'Lively',
    'Artistic',
    'Traditional',
    'Industrial'
  ];

  const priceRanges = [
    { value: '$', label: 'Budget Friendly' },
    { value: '$$', label: 'Moderate' },
    { value: '$$$', label: 'High-End' }
  ];

  const requirementTypes = [
    'WiFi',
    'Outdoor Seating',
    'Power Outlets',
    'Pet Friendly',
    'Parking Available',
    'Workspace Friendly',
    'Food Menu'
  ];

  function handleSubmit() {
    dispatch('submit');
  }
</script>

<div class="pt-6 md:pt-10 text-slate-200">
  <div>
    <div class="mb-8">
      <div class="mb-4 font-semibold text-lg">What kind of vibe are you looking for?</div>
      <div class="flex items-center flex-wrap">
        {#each moodTypes as type}
          <button
            on:click={() => {
              mood = type;
            }}
            class={`${
              mood === type ? 'bg-pink-600/40' : ''
            } text-slate-200 font-bold mr-2 text-sm mt-2 py-2 px-4 rounded-full border border-pink-600`}
          >
            {type}
          </button>
        {/each}
      </div>
    </div>

    <div class="mb-8">
      <div class="mb-4 font-semibold text-lg">What's your price range?</div>
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
      <div class="mb-4 font-semibold text-lg">Where are you looking to go?</div>
      <input
        bind:value={location}
        class="bg-white/40 border border-white/0 p-2 rounded-md placeholder:text-slate-800 text-slate-900 w-full font-medium"
        placeholder="Ex. Downtown Seattle, Capitol Hill, etc."
      />
    </div>

    <div>
      <div class="mb-4 font-semibold text-lg">Any specific requirements?</div>
      <div class="flex items-center flex-wrap">
        {#each requirementTypes as type}
          <label
            class={`${
              requirements.includes(type) ? 'bg-pink-600/40' : ''
            } text-slate-200 font-bold mr-2 mt-2 text-sm py-2 px-4 rounded-full border border-pink-600`}
          >
            <input
              class="hidden"
              type="checkbox"
              bind:group={requirements}
              name="requirements"
              value={type}
            />
            {type}
          </label>
        {/each}
      </div>
    </div>

    <button
      on:click={handleSubmit}
      class={`${
        loading
          ? 'bg-pink-400/50'
          : 'bg-pink-600 hover:bg-gradient-to-r from-pink-700 via-pink-600 to-pink-700 '
      } mt-8 w-full h-10 text-white font-bold p-3 rounded-full flex items-center justify-center`}
      disabled={!mood || !priceRange || !location || loading}
    >
      {#if loading}
        <LoadingIndicator />
      {:else}
        <p>Find My Perfect Café</p>
      {/if}
    </button>
  </div>
</div>