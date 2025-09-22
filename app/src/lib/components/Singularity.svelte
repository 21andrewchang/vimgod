<script>
	import { cn } from '$lib/utils';
</script>

<div class="z-10 flex items-center justify-center">
	<div
		class="relative inline-flex overflow-hidden rounded-full p-px shadow-[0_0px_20px_rgba(255,0,0,0.25)] shadow-[0_0px_20px_rgba(255,0,255,0.25)]"
	>
		<span
			class="absolute inset-[-1000%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#C9E0FD_0%,#A9CCFA_18%,#84B7EB_36%,#000000_54%,#000000_72%,#C9E0FD_100%)] opacity-80
         will-change-[transform,background-position]"
		/>
		<span
			class="inline-flex h-full w-full items-center justify-center rounded-full bg-neutral-950 px-3 py-1 text-xs backdrop-blur-3xl"
		>
			<span
				class={cn(
					'animate-gradient inline bg-gradient-to-r from-[#EEE] via-[#C9E0FD] to-[#EEE] bg-clip-text  font-mono text-sm text-transparent'
				)}
				style="--bg-size:200%; background-size: var(--bg-size) 100%;"
			>
				Singularity
			</span>
		</span>
	</div>
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
