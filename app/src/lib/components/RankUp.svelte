<script lang="ts">
	import { blur } from 'svelte/transition';

	// keep your prop so the API stays the same; we’ll ignore the incoming rank for the demo
	const { rank, closeRankup } = $props<{ rank: string; closeRankup: () => void }>();

	const RANKS = ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const;

	// start at bronze for the demo
	let idx = $state(0);
	const normalizeRank = (label: string) => label.toLowerCase().replace(/[^a-z]/g, '');
	const colorKey = $derived(normalizeRank(rank));

	const currentRank = $derived(RANKS[idx]);
	const pretty = (r: string) => r.charAt(0).toUpperCase() + r.slice(1);

	function next() {
		if (idx < RANKS.length - 1) {
			idx += 1; // go to next rank
		} else {
			closeRankup(); // finished slideshow
		}
	}
</script>

<div
	class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
	transition:blur={{ duration: 200 }}
	data-rank={colorKey}
>
	<div class="relative z-10 w-full max-w-md text-center text-white">
		<div class="rank-beam" aria-hidden="true"></div>
		<div class="rank-title mb-16 font-mono uppercase tracking-widest">{pretty(rank)}</div>
	</div>

	<button
		class="text-mono absolute bottom-20 z-10 text-neutral-600 transition hover:text-neutral-200"
		onclick={closeRankup}
	>
		Continue
	</button>
</div>

<style>
	/* Respect reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.rank-beam,
		.rank-title {
			animation: none !important;
		}
	}

	/* === Rank theme variables (bronze/silver/gold/platinum/diamond) === */
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
	[data-rank='bronze'] {
		--rank-core-1: rgba(205, 127, 50, 0);
		--rank-core-2: rgba(205, 127, 50, 0.95);
		--rank-core-3: rgba(205, 127, 50, 0);
		--rank-bloom-1: rgba(237, 178, 116, 0.1);
		--rank-bloom-2: rgba(237, 178, 116, 0.35);
		--rank-shadow-1: rgba(237, 178, 116, 0.7);
		--rank-shadow-2: rgba(237, 178, 116, 0.4);
		--rank-shadow-3: rgba(237, 178, 116, 0.22);
		--rank-title-glow-1: rgba(237, 178, 116, 0.55);
		--rank-title-glow-2: rgba(237, 178, 116, 0.3);
		--rank-title-color: #ffe9d3;
	}
	[data-rank='silver'] {
		--rank-core-1: rgba(192, 192, 192, 0);
		--rank-core-2: rgba(210, 220, 230, 0.95);
		--rank-core-3: rgba(192, 192, 192, 0);
		--rank-bloom-1: rgba(200, 210, 220, 0.12);
		--rank-bloom-2: rgba(200, 220, 240, 0.32);
		--rank-shadow-1: rgba(208, 220, 232, 0.7);
		--rank-shadow-2: rgba(208, 220, 232, 0.4);
		--rank-shadow-3: rgba(208, 220, 232, 0.2);
		--rank-title-glow-1: rgba(208, 220, 232, 0.55);
		--rank-title-glow-2: rgba(208, 220, 232, 0.3);
		--rank-title-color: #f4f7fa;
	}
	[data-rank='gold'] {
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
	[data-rank='platinum'] {
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
	[data-rank='diamond'] {
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
		font-size: clamp(2rem, 3.2vw, 2.25rem);
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
