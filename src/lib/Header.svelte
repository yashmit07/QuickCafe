<script>
  import CoffeeIcon from './CoffeeIcon.svelte';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
</script>

<nav class="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center border-b border-neutral-200">
  <button on:click={() => dispatch('click')} class="flex items-center">
    <CoffeeIcon />
    <div class="text-2xl font-bold text-neutral-800 ml-2">quickcafe.dev</div>
  </button>
  <div class="space-x-8">
    <a
      href="https://github.com/yashmit07/quickcafe"
      target="_blank"
      rel="noopener noreferrer"
      class="px-6 py-3 rounded-full bg-white text-neutral-800 
      font-medium hover:bg-neutral-50 border border-neutral-200"
    >
      View on GitHub
    </a>
</div>
</nav>