<script lang="ts">
	import CardIcon from '$lib/components/CardIcon.svelte';

	const { motion, count } = $props<{ motion: string; count: number }>();

	// Function to create separate keycaps for each keystroke
	function getKeycaps(motion: string): string[] {
		if (motion === 'Escape') {
			return ['esc'];
		}
		// Handle {motion} patterns - split operator and {motion}
		if (motion.includes('{motion}')) {
			const operator = motion.replace('{motion}', '');
			return [operator, '{motion}'];
		}
		// Split motion into individual keystrokes (preserve original casing)
		return motion.split('');
	}

	let isHovered = $state(false);

	function handleMouseEnter() {
		isHovered = true;
	}

	function handleMouseLeave() {
		isHovered = false;
	}
</script>

<div
	class="relative border border-dashed border-zinc-400 transition-all duration-300 dark:border-zinc-700"
	style="background:#0a0a0a; position: relative;"
	role="presentation"
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
>
	<!-- Solid border overlay that appears on hover -->
	<div
		class="pointer-events-none absolute inset-0 border border-solid border-zinc-400 transition-opacity duration-300 dark:border-zinc-700"
		style="opacity: {isHovered ? 1 : 0}; margin: -1px;"
	></div>

	<!-- corner pins -->
	<CardIcon class="-left-2 -top-2" />
	<CardIcon class="-right-2 -top-2" />
	<CardIcon class="-bottom-2 -left-2" />
	<CardIcon class="-bottom-2 -right-2" />

	<div class="flex min-h-[140px] flex-col items-center space-y-4 p-6 text-center">
		<!-- Motion name -->
		<div
			class="text-lg font-medium"
			style="color:#e8e8e8; font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;"
		>
			{motion}
		</div>

		<!-- Keycaps visual -->
		<div class="flex items-center justify-center gap-2">
			{#each getKeycaps(motion) as keycap}
				<div
					class="flex h-12 items-center justify-center rounded-md border-2 border-[#313131] bg-neutral-800 px-4 py-4 font-mono text-lg text-neutral-600 transition-all duration-200 ease-out hover:translate-y-1 hover:text-white hover:shadow-[0_6px_16px_rgba(255,255,255,0.25)]"
					style="width: {keycap.includes('{motion}')
						? 'auto'
						: '48px'}; min-width: {keycap.includes('{motion}') ? '80px' : '48px'};"
				>
					{keycap}
				</div>
			{/each}
		</div>

		<!-- Usage count -->
		<div
			class="text-lg font-light"
			style="color:#e8e8e8; font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;"
		>
			{count} times
		</div>
	</div>
</div>
