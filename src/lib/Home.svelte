<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
</script>

<div class="w-full">
    <div
        class="text-center md:text-left font-bold text-slate-200 text-4xl md:text-5xl mb-8 md:mb-16 w-full"
    >
        Discover your perfect <br class="hidden md:block" /> café experience
        <br class="hidden md:block" /> with AI assistance
    </div>
    <div class="flex flex-wrap items-center mr-auto">
        <button
            on:click={() => dispatch('click')}
            class="w-full md:w-auto text-center bg-pink-600 hover:bg-pink-700 mb-4 flex-none rounded-full text-white font-medium py-3 px-6 mr-8
                   transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            style="font-family: 'Playfair Display', 'Georgia', 'Times New Roman', serif; 
                   letter-spacing: 1.2px; 
                   font-weight: 700;
                   text-transform: none;
                   font-size: 1.1rem;
                   font-style: italic;"
        >
            Find My Perfect Café
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