<script>
	export let incomingStream;
</script>

<div class="relative flex flex-col md:flex-row bg-neutral-800/70 shadow-md p-6">
	<div
		class="bg-gradient-to-br from-neutral-900 via-neutral-700 to-neutral-900 background-animate text-white/50 flex items-center justify-center h-[250px] flex-none w-1/5"
	>
		<svg
			width="35"
			height="35"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			class="text-pink-600/50"
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
		<div class="w-full">
			<div class="flex items-end mb-4">
				<div class="flex items-end">
					<div
						class="bg-gradient-to-r from-white/90 via-white/40 to-white/90 background-animate h-6 w-40 rounded-full"
					/>
					<div
						class="h-3 bg-gradient-to-r from-white/50 via-white/20 to-white/50 background-animate w-20 rounded-full ml-2"
					/>
				</div>
			</div>
			<div class="text-slate-200/90 mb-4 w-full">
				{#if incomingStream}
					{incomingStream}
				{:else}
					<div
						class="w-full h-2 rounded-full bg-gradient-to-r from-white/20 via-white/10 to-white/20 background-animate mb-2"
					/>
					<div
						class="w-full h-2 rounded-full bg-gradient-to-r from-white/20 via-white/10 to-white/20 background-animate mb-2"
					/>
					<div
						class="w-1/2 h-2 rounded-full bg-gradient-to-r from-white/20 via-white/10 to-white/20 background-animate"
					/>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.background-animate {
		background-size: 400%;
		-webkit-animation: AnimationName 3s ease infinite;
		-moz-animation: AnimationName 3s ease infinite;
		animation: AnimationName 3s ease infinite;
	}

	@keyframes AnimationName {
		0%,
		100% {
			background-position: 0% 50%;
		}
		50% {
			background-position: 100% 50%;
		}
	}
</style>