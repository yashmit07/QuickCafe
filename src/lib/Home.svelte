<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
</script>

<div class="w-full">
    <div
        class="text-center md:text-left font-bold text-slate-200 text-4xl md:text-5xl mb-8 md:mb-16 w-full leading-tight tracking-tight"
        style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;"
    >
        Discover your perfect <br class="hidden md:block" /> café sanctuary
        <br class="hidden md:block" /> with AI assistance
    </div>
    <div class="flex flex-wrap items-center mr-auto">
        <button
            on:click={() => dispatch('click')}
            class="w-full md:w-auto text-center bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-700 hover:to-pink-800 mb-4 flex-none rounded-full text-white font-bold py-3 px-8 mr-8 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl tracking-wide"
            style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; letter-spacing: 0.5px;"
        >
            Discover Your Café Sanctuary
        </button>
        <a
            href="https://github.com/yashmit07/quickcafe"
            target="_blank"
            rel="noopener noreferrer"
            class="w-full md:w-auto text-center bg-white/20 hover:bg-white/50 mb-4 flex-none rounded-full text-white font-medium py-3 px-6"
        >
            View on GitHub
        </a>
    </div>
</div>