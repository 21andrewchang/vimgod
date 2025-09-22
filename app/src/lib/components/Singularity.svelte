<script>
	import { cn } from '$lib/utils';
</script>

<div class="z-10 flex items-center justify-center">
	<div class="swap-glow relative inline-flex overflow-hidden rounded-full p-px">
		<span
			class="absolute inset-[-1000%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#C9E0FD_0%,#A9CCFA_18%,#84B7EB_36%,#000000_54%,#000000_72%,#C9E0FD_100%)] opacity-40 will-change-[transform,background-position]"
		/>
		<span
			class="inline-flex h-full w-full items-center justify-center rounded-full bg-neutral-950 px-3 py-1 text-xs backdrop-blur-3xl"
		>
			<span
				class={cn(
					'animate-gradient inline bg-gradient-to-r from-[#EEE] via-[#C9E0FD] to-[#EEE] bg-clip-text font-mono text-sm text-transparent'
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
	.animate-gradient {
		animation: gradient 8s linear infinite;
	}

	/* Seamless there-and-back glow (no end-of-loop snap) */
	.swap-glow {
		/* start: red left, purple right */
		box-shadow:
			-10px 0 22px rgba(255, 0, 0, 0.28),
			10px 0 26px rgba(157, 78, 221, 0.3);
		will-change: box-shadow;
		animation: glowSwapPingPong 3.6s ease-in-out infinite;
	}

	@keyframes glowSwapPingPong {
		0% {
			/* red left, purple right */
			box-shadow:
				-10px 0 22px rgba(255, 0, 0, 0.28),
				10px 0 26px rgba(157, 78, 221, 0.3);
		}
		50% {
			/* swapped (meet in the middle briefly if you like a bloom) */
			box-shadow:
				10px 0 22px rgba(255, 0, 0, 0.28),
				-10px 0 26px rgba(157, 78, 221, 0.3);
		}
		100% {
			/* back to start — matches 0% to avoid the glitch */
			box-shadow:
				-10px 0 22px rgba(255, 0, 0, 0.28),
				10px 0 26px rgba(157, 78, 221, 0.3);
		}
	}

	/* Optional: if you prefer the browser to auto-reverse, use this instead:
	   .swap-glow { animation: glowSwap 1.8s ease-in-out infinite alternate; }
	   @keyframes glowSwap {
	     from { box-shadow: -10px 0 22px rgba(255,0,0,.28), 10px 0 26px rgba(157,78,221,.30); }
	     to   { box-shadow:  10px 0 22px rgba(255,0,0,.28), -10px 0 26px rgba(157,78,221,.30); }
	   }
	*/

	@media (prefers-reduced-motion: reduce) {
		.swap-glow {
			animation: none;
		}
	}
</style>
