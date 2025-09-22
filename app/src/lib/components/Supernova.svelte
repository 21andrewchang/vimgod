<script>
	import AnimatedGradientText from './AnimatedGradientText.svelte';
	import { cn } from '$lib/utils';
</script>

<div class="z-10 flex items-center justify-center">
	<AnimatedGradientText>
		<span
			class={cn(
				'animate-gradient inline rounded-xl bg-gradient-to-r from-[#ffaa40] via-[#9c40ff] to-[#ffaa40] bg-clip-text px-3 py-1 font-mono text-sm text-transparent'
			)}
			style="--bg-size:200%; background-size: var(--bg-size) 100%;"
		>
			Supernova
		</span>
	</AnimatedGradientText>
</div>

<style>
	:root {
		--bg-size: 200%;
	}
	@keyframes gradient {
		to {
			background-position: 200% center;
		}
	}
	/* Tailwind-like utility recreated locally */
	.animate-gradient {
		animation: gradient 8s linear infinite;
	}
</style>
