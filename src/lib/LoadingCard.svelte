<script lang="ts">
	export let incomingStream: string = '';
</script>

<div class="bg-white rounded-xl shadow-lg p-6">
	<div class="flex items-center space-x-4 mb-4">
		<div class="h-12 w-12 bg-pink-100 rounded-full flex items-center justify-center">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
		</div>
		<div class="flex-1 space-y-2">
			<div class="h-4 bg-pink-100 rounded w-3/4 animate-pulse"></div>
			<div class="h-4 bg-pink-100 rounded w-1/2 animate-pulse"></div>
		</div>
	</div>
	
	{#if incomingStream}
		<div class="mt-4 text-gray-600">
			<p class="font-medium text-pink-600">Finding your perfect café...</p>
			<p class="text-sm mt-2 leading-relaxed">{incomingStream}</p>
			<div class="mt-4 h-1 bg-pink-100 rounded-full overflow-hidden">
				<div class="h-full bg-pink-500 rounded-full animate-progress"></div>
			</div>
		</div>
	{:else}
		<div class="space-y-3">
			<div class="h-4 bg-pink-100 rounded w-full animate-pulse"></div>
			<div class="h-4 bg-pink-100 rounded w-5/6 animate-pulse"></div>
			<div class="h-4 bg-pink-100 rounded w-4/6 animate-pulse"></div>
		</div>
	{/if}
</div>

<style>
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: .7; }
	}

	@keyframes progress {
		0% { width: 0%; }
		50% { width: 70%; }
		100% { width: 100%; }
	}

	.animate-pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	.animate-progress {
		animation: progress 2s ease-in-out infinite;
	}
</style>