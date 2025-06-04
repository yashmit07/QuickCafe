<script>
  import CoffeeIcon from './CoffeeIcon.svelte';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
</script>

<nav class="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center border-b border-white/30 bg-white/10 backdrop-blur-sm">
  <button on:click={() => dispatch('click')} class="flex items-center group hover:scale-105 transition-transform duration-200">
    <div class="text-orange-500 group-hover:text-pink-500 transition-colors">
      <CoffeeIcon />
    </div>
    <div class="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent ml-2">
      QuickCafé
    </div>
  </button>
  <div class="space-x-8">
    <a
      href="https://github.com/yashmit07/quickcafe"
      target="_blank"
      rel="noopener noreferrer"
      class="px-6 py-3 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 text-white 
      font-medium hover:from-violet-600 hover:to-purple-700 transition-all duration-300 
      transform hover:scale-105 shadow-lg hover:shadow-xl border border-white/20"
    >
      <span class="flex items-center">
        <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd"/>
        </svg>
        View on GitHub
      </span>
    </a>
</div>
</nav>