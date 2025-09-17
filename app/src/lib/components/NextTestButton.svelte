<script lang="ts">
	export let onClick: () => void;
</script>

<button
	type="button"
	aria-label="Next test"
	class="group relative inline-flex h-9 w-9 translate-y-0 scale-100 transform-gpu
         items-center justify-center rounded-md
         shadow-none transition-all duration-150 ease-out
         hover:-translate-y-0.5 hover:scale-[1.08] hover:bg-white/10
         hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.5)] focus:outline-none
         focus:ring-2 focus:ring-purple-400/60
         focus-visible:-translate-y-0.5 focus-visible:scale-[1.05]
         active:translate-y-0 active:scale-95"
	on:click={onClick}
>
	<!-- chevron icon -->
	<svg
		viewBox="0 0 24 24"
		class="h-5 w-5 text-neutral-400 transition-colors duration-150 group-hover:text-purple-300"
	>
		<path
			d="M9 6l6 6-6 6"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>

	<!-- tooltip -->
	<div
		class="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 whitespace-nowrap
           rounded-md bg-black/80 px-2 py-1 font-mono text-xs text-neutral-200
           opacity-0 transition-opacity
           duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
	>
		new match
	</div>
</button>
