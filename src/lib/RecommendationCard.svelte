<script>
	import { fade } from 'svelte/transition';
	import LoadingCard from './LoadingCard.svelte';

	export let recommendation = {
		name: '',
		description: '',
		features: '',
		bestFor: ''
	};
</script>

<div>
	<div in:fade|global class="relative flex flex-col md:flex-row bg-neutral-800/70 shadow-md p-6">
		<div
			class="text-white/50 flex items-center justify-center h-[250px] flex-none w-1/5 bg-neutral-900"
		>
			<svg
				width="35"
				height="35"
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				class="text-pink-600"
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

		<div class="z-40 flex flex-col justify-between md:ml-6 w-full">
			<div>
				<div class="flex items-end mb-4">
					<div class="font-bold text-slate-200 text-3xl">
						{recommendation.name}
					</div>
				</div>
				<div class="text-slate-200/90 mb-4">
					{recommendation.description}
				</div>
				<div class="text-slate-200/70 mb-4">
					{recommendation.features}
				</div>
				<div class="text-slate-200/70 mb-4">
					Best for: {recommendation.bestFor}
				</div>
			</div>
			<div class="flex flex-wrap gap-2">
				{#if recommendation.features}
					{#each recommendation.features.split(',') as feature}
						<span class="py-1 px-2 rounded-full text-pink-600 border border-pink-600 text-xs">
							{feature.trim()}
						</span>
					{/each}
				{/if}
			</div>
		</div>
	</div>
</div>