<script lang="ts">
	export let incomingStream: string = '';
</script>

<div class="bg-white rounded-xl shadow-lg p-6 animate-pulse">
	<div class="flex items-center space-x-4 mb-4">
		<div class="h-12 w-12 bg-gray-200 rounded-full"></div>
		<div class="flex-1 space-y-2">
			<div class="h-4 bg-gray-200 rounded w-3/4"></div>
			<div class="h-4 bg-gray-200 rounded w-1/2"></div>
		</div>
	</div>
	
	{#if incomingStream}
		<div class="mt-4 text-gray-600">
			<p class="font-medium">Analyzing cafes...</p>
			<p class="text-sm mt-2">{incomingStream}</p>
		</div>
	{:else}
		<div class="space-y-3">
			<div class="h-4 bg-gray-200 rounded w-full"></div>
			<div class="h-4 bg-gray-200 rounded w-5/6"></div>
			<div class="h-4 bg-gray-200 rounded w-4/6"></div>
		</div>
	{/if}
</div>

<style>
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: .5; }
	}

	.animate-pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
</style>