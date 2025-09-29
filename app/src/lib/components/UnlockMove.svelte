<script lang="ts">
	import { blur } from 'svelte/transition';

	const { visible, move, closeMove } = $props<{
		move: string;
		closeMove: () => void;
		visible: boolean;
	}>();
	let colorKey = 'deletion';
</script>

{#if visible}
	<div
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
		onclick={closeMove}
		transition:blur={{ duration: 200 }}
		data-rank={colorKey}
	>
		<div class="relative z-10 w-full max-w-md text-center text-white">
			<div class="rank-beam" aria-hidden="true"></div>
			<div class="rank-title mb-16 font-mono text-2xl tracking-widest uppercase">
				New Move Unlocked
			</div>
		</div>

		<button
			in:blur={{ duration: 500, delay: 800 }}
			class="text-mono absolute bottom-20 z-10 px-10 pt-10 !text-xs tracking-widest text-neutral-700 transition hover:text-neutral-500"
			onclick={closeMove}
		>
			CONTINUE
		</button>
	</div>
{/if}

<style>
	/* Respect reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.rank-beam,
		.rank-title {
			animation: none !important;
		}
	}

	[data-rank] {
		--rank-core-0: rgba(0, 0, 0, 0);
		--rank-core-1: rgba(167, 224, 255, 0);
		--rank-core-2: rgba(167, 224, 255, 0.92);
		--rank-core-3: rgba(167, 224, 255, 0);
		--rank-bloom-1: rgba(147, 197, 253, 0.08);
		--rank-bloom-2: rgba(147, 197, 253, 0.25);
		--rank-shadow-1: rgba(147, 197, 253, 0.75);
		--rank-shadow-2: rgba(147, 197, 253, 0.45);
		--rank-shadow-3: rgba(147, 197, 253, 0.25);
		--rank-title-glow-1: rgba(147, 197, 253, 0.55);
		--rank-title-glow-2: rgba(147, 197, 253, 0.35);
		--rank-title-color: #e6f6ff;
	}
	[data-rank='tutorial'] {
		--rank-core-0: rgba(0, 0, 0, 0);
		--rank-core-1: rgba(255, 255, 255, 0);
		--rank-core-2: rgba(255, 255, 255, 0.92);
		--rank-core-3: rgba(255, 255, 255, 0);
		--rank-bloom-1: rgba(255, 255, 255, 0.08);
		--rank-bloom-2: rgba(255, 255, 255, 0.25);
		--rank-shadow-1: rgba(255, 255, 255, 0.75);
		--rank-shadow-2: rgba(255, 255, 255, 0.45);
		--rank-shadow-3: rgba(255, 255, 255, 0.25);
		--rank-title-glow-1: rgba(255, 255, 255, 0.55);
		--rank-title-glow-2: rgba(255, 255, 255, 0.35);
		--rank-title-color: #fff;
	}

	[data-rank='movement'] {
		--rank-core-0: rgba(0, 0, 0, 0);
		--rank-core-1: rgba(194, 123, 255, 0);
		--rank-core-2: rgba(194, 123, 255, 0.92);
		--rank-core-3: rgba(194, 123, 255, 0);
		--rank-bloom-1: rgba(194, 123, 255, 0.08);
		--rank-bloom-2: rgba(194, 123, 255, 0.25);
		--rank-shadow-1: rgba(194, 123, 255, 0.75);
		--rank-shadow-2: rgba(194, 123, 255, 0.45);
		--rank-shadow-3: rgba(194, 123, 255, 0.25);
		--rank-title-glow-1: rgba(194, 123, 255, 0.55);
		--rank-title-glow-2: rgba(194, 123, 255, 0.35);
		--rank-title-color: #fae6fa;
	}
	[data-rank='deletion'] {
		--rank-core-1: rgba(239, 68, 68, 0);
		--rank-core-2: rgba(239, 68, 68, 0.95);
		--rank-core-3: rgba(239, 68, 68, 0);
		--rank-bloom-1: rgba(239, 68, 68, 0.12);
		--rank-bloom-2: rgba(239, 68, 68, 0.32);
		--rank-shadow-1: rgba(239, 68, 68, 0.7);
		--rank-shadow-2: rgba(239, 68, 68, 0.4);
		--rank-shadow-3: rgba(239, 68, 68, 0.2);
		--rank-title-glow-1: rgba(239, 68, 68, 0.55);
		--rank-title-glow-2: rgba(239, 68, 68, 0.3);
		--rank-title-color: #ffdddd;
	}
	[data-rank='undo'] {
		--rank-core-1: rgba(255, 213, 74, 0);
		--rank-core-2: rgba(255, 213, 74, 0.95);
		--rank-core-3: rgba(255, 213, 74, 0);
		--rank-bloom-1: rgba(255, 230, 140, 0.15);
		--rank-bloom-2: rgba(255, 220, 90, 0.38);
		--rank-shadow-1: rgba(255, 213, 74, 0.75);
		--rank-shadow-2: rgba(255, 196, 0, 0.45);
		--rank-shadow-3: rgba(255, 170, 0, 0.25);
		--rank-title-glow-1: rgba(255, 230, 150, 0.6);
		--rank-title-glow-2: rgba(255, 220, 120, 0.35);
		--rank-title-color: #fff6d8;
	}
	[data-rank='visual'] {
		--rank-core-1: rgba(56, 189, 248, 0);
		--rank-core-2: rgba(56, 189, 248, 0.95);
		--rank-core-3: rgba(56, 189, 248, 0);
		--rank-bloom-1: rgba(34, 211, 238, 0.14);
		--rank-bloom-2: rgba(59, 130, 246, 0.34);
		--rank-shadow-1: rgba(56, 189, 248, 0.75);
		--rank-shadow-2: rgba(59, 130, 246, 0.45);
		--rank-shadow-3: rgba(34, 211, 238, 0.25);
		--rank-title-glow-1: rgba(56, 189, 248, 0.6);
		--rank-title-glow-2: rgba(59, 130, 246, 0.35);
		--rank-title-color: #d9fbff;
	}

	/* Beam line */
	.rank-beam {
		position: absolute;
		left: 50%;
		top: 50%;
		height: 1px;
		width: min(30vw, 900px);
		transform: translate(-50%, -50%) scaleX(0);
		transform-origin: 50% 50%;
		background: linear-gradient(
			90deg,
			var(--rank-core-0) 0%,
			var(--rank-core-1) 12%,
			var(--rank-core-2) 50%,
			var(--rank-core-3) 88%,
			var(--rank-core-0) 100%
		);
		box-shadow:
			0 0 12px var(--rank-shadow-1),
			0 0 28px var(--rank-shadow-2),
			0 0 60px var(--rank-shadow-3);
		filter: saturate(1.2);
		animation:
			beam-grow 2000ms cubic-bezier(0.15, 0.8, 0.2, 1) forwards,
			beam-fade 900ms 700ms ease-out forwards,
			beam-pulse 1200ms 700ms ease-in-out 2;
	}

	/* Extra bloom around the beam */
	.rank-beam::before {
		content: '';
		position: absolute;
		inset: -14px 0;
		background: linear-gradient(
			90deg,
			transparent 0%,
			var(--rank-bloom-1) 20%,
			var(--rank-bloom-2) 50%,
			var(--rank-bloom-1) 80%,
			transparent 100%
		);
		filter: blur(12px);
		opacity: 0;
		animation: bloom-in 600ms 200ms ease-out forwards;
	}

	/* Title pop + subtle glow */
	.rank-title {
		position: relative;
		margin-top: 0.5rem;
		/* font-family: */
		/* 	ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', */
		/* 	monospace; */
		color: var(--rank-title-color);
		text-shadow:
			0 0 6px var(--rank-title-glow-1),
			0 0 18px var(--rank-title-glow-2);
		opacity: 0;
		transform: translateY(6px) scale(0.98);
		animation:
			title-in 2000ms 520ms cubic-bezier(0.12, 0.7, 0.2, 1) forwards,
			title-glow 1400ms 900ms ease-in-out 2;
	}

	/* Keyframes (unchanged) */
	@keyframes beam-grow {
		to {
			transform: translate(-50%, -50%) scaleX(1);
		}
	}
	@keyframes beam-fade {
		to {
			opacity: 0.35;
			box-shadow:
				0 0 8px rgba(147, 197, 253, 0.55),
				0 0 20px rgba(147, 197, 253, 0.28),
				0 0 36px rgba(147, 197, 253, 0.15);
		}
	}
	@keyframes beam-pulse {
		0%,
		100% {
			filter: brightness(1);
		}
		50% {
			filter: brightness(1.35);
		}
	}
	@keyframes bloom-in {
		to {
			opacity: 0.9;
		}
	}
	@keyframes title-in {
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	@keyframes title-glow {
		0%,
		100% {
			text-shadow:
				0 0 6px var(--rank-title-glow-1),
				0 0 14px var(--rank-title-glow-2);
		}
		50% {
			text-shadow:
				0 0 10px var(--rank-title-glow-1),
				0 0 26px var(--rank-title-glow-2);
		}
	}
</style>
